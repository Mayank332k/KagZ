import { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatAPI, invalidateCache } from '../services/api';
import { useToast } from './ToastContext';
import { createStreamPacer } from '../utils/streamPacer';

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

  const sendMessage = async (userQuery, historyOverride = null, pageContext = null, options = {}) => {
    if (!userQuery.trim() || isStreaming) return;

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
        pageContext: pageContext ? { id: pageContext.id, title: pageContext.title } : null,
        isChoiceResponse: Boolean(options?.isChoiceResponse),
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

    // Ultra-smooth, adaptive token pacer via requestAnimationFrame & word-boundary pacing
    const pacer = createStreamPacer({
      onFlush: (chunk) => {
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
      },
    });

    const enqueueStreamContent = (text, immediate = false) => {
      if (immediate) {
        pacer.flushImmediately();
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

      pacer.push(text);
    };

    const flushQueueImmediately = () => {
      pacer.flushImmediately();
    };

    const MAX_RECONNECT_ATTEMPTS = 3;
    let attempt = 0;
    let completedSuccessfully = false;
    let streamError = false;
    let memoryStartedAt = null;

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

                // 2. Concrete Execution Step (always record for tool execution)
                let execText = typeof event.message === 'string' ? event.message.trim() : '';
                if (!execText) {
                  if (event.tool === 'user_memory') {
                    const action = event.action || 'recall';
                    execText = action === 'save'
                      ? 'Updating user memory'
                      : action === 'forget'
                        ? 'Clearing user memory'
                        : 'Recalled memory & context';
                  } else if (event.tool === 'web_search' && event.query) {
                    execText = `Searching web for "${event.query}"...`;
                  } else if (event.tool === 'search_workspace' && event.query) {
                    execText = `Searching notes for "${event.query}"...`;
                  } else if (event.tool === 'manage_tasks') {
                    execText = 'Updating tasks & kanban board...';
                  } else if (!thoughtText) {
                    execText = `Running ${event.tool}...`;
                  }
                }

                if (execText && !prevSteps.some((s) => s.text === execText)) {
                  newSteps.push({
                    type: 'execution',
                    text: execText,
                    tool: event.tool,
                    query: event.query,
                    action: event.action,
                    stateType: event.tool === 'user_memory'
                      ? (event.action === 'save' ? 'memory' : 'remembering')
                      : (event.tool || event.stateType || 'action'),
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
                const completionEvent = typeof event.event === 'string' ? event.event.trim() : '';

                const updatedSteps = prevSteps.map((s) => {
                  if (s.tool === event.tool && s.isLive) {
                    return {
                      ...s,
                      isLive: false,
                      status: event.status || 'success',
                      error: event.error,
                      completionEvent: completionEvent || s.completionEvent,
                    };
                  }
                  return s;
                });

                // Attach completionEvent to the last step of this tool if not already attached
                if (completionEvent) {
                  const lastToolStep = [...updatedSteps].reverse().find((s) => s.tool === event.tool);
                  if (lastToolStep && !lastToolStep.completionEvent) {
                    lastToolStep.completionEvent = completionEvent;
                  }
                  if (!updatedSteps.some((s) => s.text === completionEvent)) {
                    updatedSteps.push({
                      type: 'tool_completion',
                      text: completionEvent,
                      tool: event.tool,
                      status: event.status || 'success',
                      timestamp: Date.now(),
                    });
                  }
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
              const memoryDuration = memoryStartedAt ? Math.max(1, Math.round((Date.now() - memoryStartedAt) / 1000)) : undefined;
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
                    memoryDuration,
                    isNewMemory: true,
                    workingSteps: [
                      ...prevSteps,
                      { type: 'execution', text: `Updated memory: ${factText}`, stateType: 'memory', timestamp: Date.now() }
                    ],
                  }
                ];
              });
            } else if (event.type === 'done') {
              completedSuccessfully = true;
              await pacer.drain();
              break;
            } else if (event.type === 'error') {
              const errText = event.error || event.data || "Failed to generate response. Please try again.";
              streamError = true;
              setChatError({ message: errText, query: userQuery });
              showToast(errText, "error");
              break;
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

            pacer.abort();

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
      if (signal.aborted) {
        pacer.abort();
      } else {
        pacer.flushImmediately();
      }
      if (abortControllerRef.current?.signal === signal) {
        abortControllerRef.current = null;
      }
      const stoppedByUser = signal.aborted && !completedSuccessfully;
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
                  return [...msgs.slice(0, lastIndex), { ...last, workingDuration: duration, stoppedByUser: true }];
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
            return [...msgs.slice(0, lastIndex), { ...last, workingDuration: duration, stoppedByUser }];
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
