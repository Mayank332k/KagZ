import { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatAPI, invalidateCache } from '../services/api';
import { useToast } from './ToastContext';
import { validateAiInput } from '../utils/aiValidation';

import { ChatContext } from './ChatContextDefinition';
import { normalizeChatModel } from '../constants/chatModels';

export const ChatProvider = ({ children }) => {
  const { showToast } = useToast();

  // Startup & Reload behavior: 'resume' (remember last chat/state) or 'fresh' (start fresh on new page)
  const [chatStartupMode, setChatStartupModeState] = useState(
    () => localStorage.getItem('noema-chat-startup-mode') || 'resume'
  );

  const [sessionId, setSessionId] = useState(() => {
    const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
    if (mode === 'resume') {
      const saved = localStorage.getItem('noema-last-chat-session');
      if (saved) return saved;
    }
    return uuidv4();
  });

  const [messages, setMessages] = useState(() => {
    const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
    if (mode === 'resume') {
      try {
        const saved = localStorage.getItem('noema-last-chat-messages');
        if (saved) return JSON.parse(saved);
      } catch (err) {
        console.warn('Failed to parse cached chat messages:', err);
      }
    }
    return [];
  });

  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  
  const [query, setQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  
  const [isRightChatOpen, setIsRightChatOpenState] = useState(() => {
    const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
    if (mode === 'resume') {
      return localStorage.getItem('noema-right-chat-open') === 'true';
    }
    return false;
  });

  const setIsRightChatOpen = (valOrFn) => {
    setIsRightChatOpenState((prev) => {
      const nextVal = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
      if (mode === 'resume') {
        localStorage.setItem('noema-right-chat-open', String(nextVal));
      } else {
        localStorage.removeItem('noema-right-chat-open');
      }
      return nextVal;
    });
  };

  const updateChatStartupMode = (mode) => {
    setChatStartupModeState(mode);
    localStorage.setItem('noema-chat-startup-mode', mode);
    if (mode === 'fresh') {
      localStorage.removeItem('noema-last-chat-session');
      localStorage.removeItem('noema-last-chat-messages');
      localStorage.removeItem('noema-right-chat-open');
    } else {
      if (messages.length > 0 && sessionId) {
        localStorage.setItem('noema-last-chat-session', sessionId);
        try {
          localStorage.setItem('noema-last-chat-messages', JSON.stringify(messages));
        } catch {
          // Ignore localStorage quota / serialization errors
        }
      }
      if (isRightChatOpen) {
        localStorage.setItem('noema-right-chat-open', 'true');
      }
    }
  };
  
  // Model & Thinking States
  const [selectedModel, setSelectedModel] = useState(
    () => normalizeChatModel(localStorage.getItem('noema-chat-model')),
  );
  const [isThinking, setIsThinking] = useState(
    () => localStorage.getItem('noema-chat-thinking') === 'true',
  );
  const [chatError, setChatError] = useState(null); // { message: string, query: string }
  
  const abortControllerRef = useRef(null);

  const updateSelectedModel = (model) => {
    const normalized = normalizeChatModel(model);
    setSelectedModel(normalized);
    localStorage.setItem('noema-chat-model', normalized);
  };

  const updateIsThinking = (enabled) => {
    setIsThinking(enabled);
    localStorage.setItem('noema-chat-thinking', String(enabled));
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const sendMessage = async (userQuery, historyOverride = null, pageContext = null) => {
    if (!userQuery.trim() || isStreaming) return;

    // Validate chat input before proceeding
    const validation = validateAiInput('chat', userQuery);
    if (!validation.valid) {
      showToast(validation.message, "warning");
      return;
    }

    setChatError(null);
    setQuery('');

    // Capture history before appending new user message
    const history = historyOverride || messages;
    let chatHistory = history.map(msg => ({ role: msg.role, content: msg.content }));

    // If pageContext is provided, prepend a system context with open page details
    if (pageContext && pageContext.title) {
      const truncatedContent = pageContext.content && pageContext.content.length > 15000
        ? pageContext.content.slice(0, 15000) + "\n...[truncated]"
        : (pageContext.content || "(Empty page)");

      chatHistory = [
        {
          role: 'system',
          content: `The user currently has this note/page open in the editor and attached as context:\nTitle: "${pageContext.title}"\nContent:\n${truncatedContent}`
        },
        ...chatHistory
      ];
    }

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userQuery,
        pageContext: pageContext ? { id: pageContext.id, title: pageContext.title } : null
      },
      {
        role: 'assistant',
        content: '',
        sources: [],
        status: null,
        stateType: 'thinking',
        startedAt: Date.now(),
        workingSteps: [],
      },
    ]);
    setIsStreaming(true);

    const activeModel = selectedModel;
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Smooth Token-by-Token Streaming Pacer (rAF-capped ~30fps)
    let streamQueue = '';
    let isStreamNetworkDone = false;
    let isPacerRunning = false;
    let streamError = false;
    let memoryStartedAt = 0;
    let rafId = null;
    let lastFlushTime = 0;

    const pumpNextTokens = () => {
      if (signal.aborted) {
        streamQueue = '';
        isPacerRunning = false;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        return;
      }

      const now = performance.now();

      if (streamQueue.length === 0) {
        isPacerRunning = false;
        if (isStreamNetworkDone) {
          setIsStreaming(false);
        }
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        return;
      }

      if (memoryStartedAt > 0) {
        const elapsed = Date.now() - memoryStartedAt;
        const MIN_MEMORY_DWELL_MS = 1800;
        if (elapsed < MIN_MEMORY_DWELL_MS) {
          isPacerRunning = true;
          rafId = requestAnimationFrame(pumpNextTokens);
          return;
        }
        memoryStartedAt = 0;
      }

      // rAF-capped pacing: target ~30fps = ~33ms per frame
      // Only flush if enough time has passed since last flush
      const minFrameInterval = 33; // ~30fps cap
      if (now - lastFlushTime < minFrameInterval) {
        rafId = requestAnimationFrame(pumpNextTokens);
        return;
      }

      isPacerRunning = true;

      // Dynamic token-aware pacing:
      // Stream tokens smoothly by syllables / words rather than 1-char stuttering
      const qLen = streamQueue.length;
      // eslint-disable-next-line no-useless-assignment -- used at line 257, 258
      let chunkSize = 1;
      if (qLen > 120) {
        chunkSize = Math.min(qLen, Math.ceil(qLen / 6));
      } else if (qLen > 40) {
        chunkSize = Math.min(qLen, Math.ceil(qLen / 8));
      } else if (qLen > 10) {
        // Find next word/punctuation boundary within 3-8 chars
        const spaceIdx = streamQueue.slice(2).search(/\s|[.,!?;:\n]/);
        if (spaceIdx >= 0) {
          chunkSize = Math.min(spaceIdx + 3, qLen);
        } else {
          chunkSize = Math.min(4, qLen);
        }
      } else {
        // Small queue: take up to next space or 2-3 chars
        const spaceIdx = streamQueue.search(/\s/);
        if (spaceIdx >= 0 && spaceIdx <= 3) {
          chunkSize = spaceIdx + 1;
        } else {
          chunkSize = Math.min(2, qLen);
        }
      }

      const chunk = streamQueue.slice(0, chunkSize);
      streamQueue = streamQueue.slice(chunkSize);

      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0) return prev;
        const lastMsg = prev[lastIndex];
        if (lastMsg.role !== 'assistant') return prev;
        return [
          ...prev.slice(0, lastIndex),
          { ...lastMsg, content: lastMsg.content + chunk }
        ];
      });

      lastFlushTime = now;
      rafId = requestAnimationFrame(pumpNextTokens);
    };

    const enqueueStreamContent = (text, immediate = false) => {
      if (immediate) {
        setMessages((prev) => {
          const lastIndex = prev.length - 1;
          if (lastIndex < 0) return prev;
          const lastMsg = prev[lastIndex];
          if (lastMsg.role !== 'assistant') return prev;
          return [
            ...prev.slice(0, lastIndex),
            { ...lastMsg, content: lastMsg.content + text }
          ];
        });
        return;
      }

      streamQueue += text;
      if (!isPacerRunning) {
        pumpNextTokens();
      }
    };

    const flushQueueImmediately = () => {
      memoryStartedAt = 0;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      isPacerRunning = false;
      if (!streamQueue) return;
      const remaining = streamQueue;
      streamQueue = '';
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0) return prev;
        const lastMsg = prev[lastIndex];
        if (lastMsg.role !== 'assistant') return prev;
        return [
          ...prev.slice(0, lastIndex),
          { ...lastMsg, content: lastMsg.content + remaining }
        ];
      });
    };

    const MAX_RECONNECT_ATTEMPTS = 3;
    let attempt = 0;
    let completedSuccessfully = false;

    try {
      while (attempt <= MAX_RECONNECT_ATTEMPTS && !signal.aborted) {
        try {
          for await (const event of chatAPI.ask(userQuery, chatHistory, activeModel, sessionId, isThinking, signal)) {
            if (signal.aborted) break;

            if (event.type === 'sources') {
              flushQueueImmediately();
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;
                const incomingSources = Array.isArray(event.data) ? event.data : [];
                const prevSteps = Array.isArray(lastMsg.workingSteps) ? lastMsg.workingSteps : [];
                const sourceSteps = incomingSources.map((s) => ({
                  text: s.domain ? `Read ${s.domain}${s.url ? '/' + s.url.replace(/^https?:\/\/[^/]+\/?/, '') : ''}` : `Read ${s.title || s.url}`,
                  domain: s.domain || (s.url ? (() => { try { return new URL(s.url).hostname; } catch { return ''; } })() : ''),
                  url: s.url,
                  stateType: 'web_search',
                  timestamp: Date.now(),
                }));
                return [
                  ...prev.slice(0, lastIndex),
                  {
                    ...lastMsg,
                    sources: incomingSources,
                    workingSteps: [...prevSteps, ...sourceSteps],
                  }
                ];
              });
            } else if (event.type === 'tool_start') {
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;

                const prevSteps = Array.isArray(lastMsg.workingSteps) ? [...lastMsg.workingSteps] : [];
                const newSteps = [];

                // 1. Humanly Thought (if event.event exists)
                const thoughtText = typeof event.event === 'string' ? event.event.trim() : '';
                if (thoughtText && !prevSteps.some((s) => s.text === thoughtText)) {
                  newSteps.push({
                    type: 'thought',
                    text: thoughtText,
                    tool: event.tool,
                    timestamp: Date.now(),
                  });
                }

                // 2. Concrete Execution Step
                const execText =
                  (typeof event.message === 'string' && event.message.trim()) ||
                  (event.query ? `Searching web for "${event.query}"...` : (thoughtText ? '' : `Running ${event.tool}...`));

                if (execText && !prevSteps.some((s) => s.text === execText)) {
                  newSteps.push({
                    type: 'execution',
                    text: execText,
                    tool: event.tool,
                    query: event.query,
                    action: event.action,
                    stateType: event.tool || event.stateType || 'action',
                    status: 'running',
                    isLive: true,
                    timestamp: Date.now(),
                  });
                }

                // Order Guarantee: Ensure thought always comes before execution steps
                let combinedSteps;
                const thoughtStep = newSteps.find((s) => s.type === 'thought');
                const otherNewSteps = newSteps.filter((s) => s.type !== 'thought');

                if (thoughtStep && prevSteps.length > 0) {
                  const lastPrev = prevSteps[prevSteps.length - 1];
                  if (lastPrev.type === 'execution' && (lastPrev.tool === event.tool || !lastPrev.tool)) {
                    combinedSteps = [
                      ...prevSteps.slice(0, prevSteps.length - 1),
                      thoughtStep,
                      lastPrev,
                      ...otherNewSteps,
                    ];
                  } else {
                    combinedSteps = [...prevSteps, ...newSteps];
                  }
                } else {
                  combinedSteps = [...prevSteps, ...newSteps];
                }

                return [
                  ...prev.slice(0, lastIndex),
                  {
                    ...lastMsg,
                    status: thoughtText || execText || lastMsg.status,
                    stateType: event.tool || lastMsg.stateType,
                    workingSteps: combinedSteps,
                  }
                ];
              });
            } else if (event.type === 'tool_end') {
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;

                const prevSteps = Array.isArray(lastMsg.workingSteps) ? [...lastMsg.workingSteps] : [];
                const updatedSteps = prevSteps.map((s) => {
                  if (s.tool === event.tool && s.isLive) {
                    return { ...s, isLive: false, status: event.status || 'success', error: event.error };
                  }
                  return s;
                });

                // Completion thought event
                const completionThought = typeof event.event === 'string' ? event.event.trim() : '';
                if (completionThought && !updatedSteps.some((s) => s.text === completionThought)) {
                  updatedSteps.push({
                    type: 'thought',
                    text: completionThought,
                    tool: event.tool,
                    status: event.status || 'success',
                    timestamp: Date.now(),
                  });
                }

                return [
                  ...prev.slice(0, lastIndex),
                  {
                    ...lastMsg,
                    workingSteps: updatedSteps,
                  }
                ];
              });
            } else if (event.type === 'state') {
              const isMemory = event.stateType === 'remembering' || event.stateType === 'memory' || (typeof event.data === 'string' && /remember|yaad/i.test(event.data));
              if (isMemory) {
                memoryStartedAt = Date.now();
              }
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;
                const stepText = typeof event.data === 'string' ? event.data.trim() : '';

                // Generic thinking stays with native ThinkingOrb, NOT in working steps
                const isGenericThinking = (!event.stateType || event.stateType === 'thinking') &&
                  (!stepText || /^thinking(\.{1,3})?$/i.test(stepText) || /^reasoning(\.{1,3})?$/i.test(stepText));

                const prevSteps = Array.isArray(lastMsg.workingSteps) ? lastMsg.workingSteps : [];
                const alreadyExists = prevSteps.some((s) => s.text === stepText);
                const updatedSteps = (!isGenericThinking && stepText && !alreadyExists)
                  ? [...prevSteps, { type: 'execution', text: stepText, stateType: event.stateType || 'action', timestamp: Date.now() }]
                  : prevSteps;

                return [
                  ...prev.slice(0, lastIndex),
                  {
                    ...lastMsg,
                    status: event.data,
                    stateType: event.stateType || 'thinking',
                    workingSteps: updatedSteps,
                  }
                ];
              });
            } else if (event.type === 'research_update') {
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;

                const researchData = event.data;
                const prevSteps = Array.isArray(lastMsg.workingSteps) ? lastMsg.workingSteps : [];

                const researchSteps = [];
                if (researchData?.topic && !prevSteps.some((s) => s.type === 'thought' && s.text.includes(researchData.topic))) {
                  researchSteps.push({
                    type: 'thought',
                    text: `Researching: ${researchData.topic}`,
                    timestamp: Date.now(),
                  });
                }
                if (Array.isArray(researchData?.steps) && researchData.steps.length > 0) {
                  researchData.steps.forEach((st) => {
                    researchSteps.push({
                      type: 'execution',
                      text: st.title,
                      stateType: 'deep_research',
                      isLive: st.status === 'in_progress',
                      status: st.status === 'completed' ? 'success' : st.status,
                      timestamp: Date.now(),
                    });
                  });
                } else if (researchData?.currentAction) {
                  researchSteps.push({
                    type: 'execution',
                    text: researchData.currentAction,
                    stateType: 'deep_research',
                    isLive: true,
                    timestamp: Date.now(),
                  });
                }

                return [
                  ...prev.slice(0, lastIndex),
                  {
                    ...lastMsg,
                    researchData: event.data,
                    stateType: 'deep_research',
                    status: researchData?.currentAction || lastMsg.status,
                    workingSteps: researchSteps.length > 0 ? researchSteps : prevSteps,
                  }
                ];
              });
            } else if (event.type === 'content') {
              enqueueStreamContent(event.data);
            } else if (event.type === 'ask_user') {
              flushQueueImmediately();
              enqueueStreamContent(`\n<interactive_choice>${JSON.stringify(event.data)}</interactive_choice>\n`, true);
            } else if (event.type === 'tasks_updated') {
              invalidateCache('tasks');
              try {
                localStorage.removeItem('noema_kanban_tasks');
              } catch {
                // Ignore localStorage error
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('tasks:refresh'));
              }
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;
                const prevSteps = Array.isArray(lastMsg.workingSteps) ? lastMsg.workingSteps : [];
                return [
                  ...prev.slice(0, lastIndex),
                  {
                    ...lastMsg,
                    workingSteps: [
                      ...prevSteps,
                      { text: 'Updated tasks and kanban board', stateType: 'task_management', timestamp: Date.now() }
                    ],
                  }
                ];
              });
            } else if (event.type === 'memory_saved') {
              const savedFact = event.data?.fact || event.data;
              const factText = typeof savedFact === 'string' ? savedFact : JSON.stringify(savedFact);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:memory-updated'));
              }
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;
                const prevSteps = Array.isArray(lastMsg.workingSteps) ? lastMsg.workingSteps : [];
                return [
                  ...prev.slice(0, lastIndex),
                  {
                    ...lastMsg,
                    memorySaved: true,
                    memoryFact: factText,
                    isNewMemory: true,
                    workingSteps: [
                      ...prevSteps,
                      { text: `Updated memory: ${factText}`, stateType: 'memory', timestamp: Date.now() }
                    ],
                  }
                ];
              });
            } else if (event.type === 'done') {
              completedSuccessfully = true;
              isStreamNetworkDone = true;
              // Smoothly let the remaining tokens drain into the chat before closing the stream
              while (streamQueue.length > 0 && !signal.aborted) {
                await new Promise((resolve) => setTimeout(resolve, 20));
              }
              break;
            } else if (event.type === 'error') {
              const errText = event.error || event.data || "An error occurred.";
              throw new Error(errText);
            }
          }

          if (completedSuccessfully) {
            break;
          }
        } catch (err) {
          if (err.name === 'AbortError' || signal.aborted) {
            console.log('Chat generation aborted by user.');
            break;
          }

          attempt++;
          if (attempt <= MAX_RECONNECT_ATTEMPTS && !signal.aborted) {
            console.warn(`[Chat] Connection error, reconnecting (${attempt}/${MAX_RECONNECT_ATTEMPTS})...`, err);

            if (rafId) {
              cancelAnimationFrame(rafId);
              rafId = null;
            }
            streamQueue = '';
            isPacerRunning = false;

            setMessages((prev) => {
              const lastIndex = prev.length - 1;
              if (lastIndex < 0) return prev;
              const lastMsg = prev[lastIndex];
              if (lastMsg.role !== 'assistant') return prev;
              return [
                ...prev.slice(0, lastIndex),
                {
                  ...lastMsg,
                  content: '',
                  status: `${attempt}/${MAX_RECONNECT_ATTEMPTS} trying to reconnect...`,
                  stateType: 'reconnecting',
                },
              ];
            });

            // Wait with backoff or wait for 'online' event if offline
            await new Promise((resolve) => {
              let timer = null;
              const cleanup = () => {
                if (timer) clearTimeout(timer);
                window.removeEventListener('online', onOnline);
              };
              const onOnline = () => {
                cleanup();
              };
              window.addEventListener('online', onOnline);

              const delay = !navigator.onLine ? 4000 : 1200 * attempt;
              timer = setTimeout(() => {
                cleanup();
                resolve();
              }, delay);
            });

            if (signal.aborted) break;

            continue;
          } else {
            // All attempts exhausted
            streamError = true;
            console.error('[Chat] All reconnect attempts failed:', err);
            const errText = !navigator.onLine
              ? "No internet connection. Please check your network and try again."
              : (err.message || "Failed to generate response.");
            showToast(errText, "error");
            setChatError({ message: errText, query: userQuery });
            break;
          }
        }
      }
    } finally {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (signal.aborted) {
        streamQueue = '';
      } else if (streamQueue.length > 0) {
        flushQueueImmediately();
      }
      if (abortControllerRef.current?.signal === signal) {
        abortControllerRef.current = null;
      }
      setIsStreaming(false);
      setMessages((prev) => {
        const msgs = [...prev];
        const lastIndex = msgs.length - 1;
        if (lastIndex >= 0) {
          const last = msgs[lastIndex];
          if (last.role === 'assistant') {
            const duration = last.workingDuration || (last.startedAt ? Math.max(1, Math.round((Date.now() - last.startedAt) / 1000)) : 0);
            if (!last.content.trim()) {
              if (signal.aborted) {
                // User intentionally stopped / paused generation - never treat as failure
                if (last.workingSteps && last.workingSteps.length > 0) {
                  return [...msgs.slice(0, lastIndex), { ...last, workingDuration: duration }];
                }
                msgs.pop();
                return msgs;
              }

              if (completedSuccessfully) {
                // If stream completed successfully without text tokens, use status or safe fallback
                const fallbackContent = last.status || "Completed.";
                return [...msgs.slice(0, lastIndex), { ...last, content: fallbackContent, workingDuration: duration }];
              }
              msgs.pop(); // Remove the empty reply bubble only on genuine unhandled failure
              if (!streamError && !signal.aborted) {
                setChatError({ message: "LLM failed to generate a response.", query: userQuery });
                setTimeout(() => {
                  showToast("LLM failed to generate a response. Please try again.", "error");
                }, 10);
              }
              return msgs;
            }
            return [...msgs.slice(0, lastIndex), { ...last, workingDuration: duration }];
          }
        }
        return msgs;
      });
    }
  };

  const clearChatError = () => {
    setChatError(null);
  };

  const retryLastMessage = () => {
    if (!chatError?.query || isStreaming) return;
    const failedQuery = chatError.query;
    setChatError(null);

    // Clean up trailing unfulfilled user message or empty assistant message so history stays clean
    const cleanedMessages = [...messages];
    if (cleanedMessages.at(-1)?.role === 'assistant' && !cleanedMessages.at(-1).content.trim()) {
      cleanedMessages.pop();
    }
    if (cleanedMessages.at(-1)?.role === 'user' && cleanedMessages.at(-1).content === failedQuery) {
      cleanedMessages.pop();
    }

    setMessages(() => {
      return cleanedMessages;
    });

    sendMessage(failedQuery, cleanedMessages);
  };

  const loadSession = async (id) => {
    stopGeneration();
    try {
      const res = await chatAPI.getHistory(id);
      if (res.data.success) {
        const msgs = res.data.messages || [];
        setSessionId(id);
        setMessages(msgs);
        setNextCursor(res.data.nextCursor || null);
        setHasMore(!!res.data.nextCursor);
        setQuery('');
        setChatError(null);

        const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
        if (mode === 'resume') {
          localStorage.setItem('noema-last-chat-session', id);
          try {
            localStorage.setItem('noema-last-chat-messages', JSON.stringify(msgs));
          } catch {
            // Ignore quota or serialize errors
          }
        }
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  // Sync latest chat messages to localStorage when streaming concludes
  useEffect(() => {
    const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
    if (mode === 'resume' && !isStreaming && messages.length > 0 && sessionId) {
      localStorage.setItem('noema-last-chat-session', sessionId);
      try {
        localStorage.setItem('noema-last-chat-messages', JSON.stringify(messages));
      } catch (err) {
        console.warn('Could not save chat messages to localStorage', err);
      }
    }
  }, [messages, sessionId, isStreaming]);

  // Background sync on reload to reconcile cache with server state
  useEffect(() => {
    const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
    const savedSession = localStorage.getItem('noema-last-chat-session');
    if (mode === 'resume' && savedSession) {
      chatAPI.getHistory(savedSession).then((res) => {
        if (res.data?.success && res.data.messages) {
          setMessages(res.data.messages);
          setNextCursor(res.data.nextCursor || null);
          setHasMore(!!res.data.nextCursor);
          try {
            localStorage.setItem('noema-last-chat-messages', JSON.stringify(res.data.messages));
          } catch {
            // Ignore quota or serialize errors
          }
        }
      }).catch((err) => {
        console.debug('Background sync of last chat session:', err);
      });
    }
  }, []);

  const fetchMoreMessages = async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;
    setIsLoadingMore(true);
    try {
      const res = await chatAPI.getHistory(sessionId, nextCursor);
      if (res.data.success) {
        setMessages(prev => [...(res.data.messages || []), ...prev]);
        setNextCursor(res.data.nextCursor || null);
        setHasMore(!!res.data.nextCursor);
      }
    } catch (err) {
      console.error('Failed to fetch more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const clearChat = () => {
    stopGeneration();
    setMessages([]);
    setQuery('');
    setSessionId(uuidv4());
    setNextCursor(null);
    setHasMore(false);
    setChatError(null);
    localStorage.removeItem('noema-last-chat-session');
    localStorage.removeItem('noema-last-chat-messages');
  };

  const contextValue = useMemo(() => ({
    messages,
    query,
    setQuery,
    isStreaming,
    isRightChatOpen,
    setIsRightChatOpen,
    selectedModel,
    setSelectedModel: updateSelectedModel,
    isThinking,
    setIsThinking: updateIsThinking,
    sendMessage,
    stopGeneration,
    clearChat,
    loadSession,
    fetchMoreMessages,
    isLoadingMore,
    hasMore,
    sessionId,
    chatError,
    clearChatError,
    retryLastMessage,
    chatStartupMode,
    setChatStartupMode: updateChatStartupMode
  }), [
    messages,
    query,
    isStreaming,
    isRightChatOpen,
    selectedModel,
    isThinking,
    sendMessage,
    stopGeneration,
    loadSession,
    fetchMoreMessages,
    isLoadingMore,
    hasMore,
    sessionId,
    chatError,
    retryLastMessage,
    chatStartupMode
  ]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};
