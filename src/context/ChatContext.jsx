import { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatAPI, invalidateCache } from '../services/api';
import { useToast } from './ToastContext';
import { createStreamPacer } from '../utils/streamPacer';

import { ChatContext, ChatStreamContext } from './ChatContextDefinition';
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
  const [streamingMessage, setStreamingMessage] = useState(null);
  const [isResponseWriting, setIsResponseWriting] = useState(false);
  const streamingMessageRef = useRef(null);
  const isResponseWritingRef = useRef(false);

  const updateStreamingMessage = (updater) => {
    setStreamingMessage((prev) => {
      const current = prev || streamingMessageRef.current;
      const next = typeof updater === 'function' ? updater(current) : updater;
      streamingMessageRef.current = next;
      return next;
    });
  };
  
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
    }
    setIsStreaming(false);
    setIsResponseWriting(false);
    isResponseWritingRef.current = false;
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
    ]);

    const initialStreamMsg = {
      role: 'assistant',
      content: '',
      sources: [],
      status: null,
      stateType: 'thinking',
      startedAt: Date.now(),
      workingSteps: [],
      thoughts: [],
      thinkingContent: '',
    };
    streamingMessageRef.current = initialStreamMsg;
    setStreamingMessage(initialStreamMsg);
    setIsStreaming(true);
    setIsResponseWriting(false);
    isResponseWritingRef.current = false;

    const activeModel = selectedModel;
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Ultra-smooth, bounded-lag token pacer via requestAnimationFrame
    const makePacer = () => createStreamPacer({
      onFlush: (chunk) => {
        updateStreamingMessage((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            content: (prev.content || '') + chunk,
          };
        });
      },
    });
    let pacer = makePacer();

    const enqueueStreamContent = (text, immediate = false) => {
      if (!isResponseWritingRef.current) {
        isResponseWritingRef.current = true;
        setIsResponseWriting(true);
      }
      if (immediate) {
        pacer.flushImmediately();
        updateStreamingMessage((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            content: (prev.content || '') + text,
          };
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
              updateStreamingMessage((prev) => {
                if (!prev) return prev;
                const incomingSources = Array.isArray(event.data) ? event.data : [];
                const prevSteps = Array.isArray(prev.workingSteps) ? [...prev.workingSteps] : [];
                
                // Attach source sub-steps to the active or latest search tool
                const updatedSteps = prevSteps.map((s, idx) => {
                  const isMatch = s.isLive || idx === prevSteps.length - 1;
                  if (isMatch && (s.tool === 'search_workspace' || s.tool === 'web_search' || s.tool === 'deep_research')) {
                    const existingTexts = new Set((s.subSteps || []).map(st => st.text));
                    const newSubSteps = [...(s.subSteps || [])];
                    incomingSources.forEach((src) => {
                      const title = src.domain ? `Read ${src.domain}` : `Read ${src.title || src.url}`;
                      if (!existingTexts.has(title)) {
                        existingTexts.add(title);
                        newSubSteps.push({
                          text: title,
                          title: src.title,
                          domain: src.domain,
                          url: src.url,
                          stateType: s.tool === 'search_workspace' ? 'workspace_search' : 'web_search',
                          timestamp: Date.now(),
                        });
                      }
                    });
                    return {
                      ...s,
                      subSteps: newSubSteps,
                    };
                  }
                  return s;
                });

                return {
                  ...prev,
                  sources: incomingSources,
                  workingSteps: updatedSteps,
                };
              });
            } else if (event.type === 'tool_start') {
              updateStreamingMessage((prev) => {
                if (!prev) return prev;
                const prevSteps = Array.isArray(prev.workingSteps) ? [...prev.workingSteps] : [];
                
                // Single dedicated entry per tool call with human event narration
                const eventText = typeof event.event === 'string' ? event.event.trim() : '';
                const msgText = typeof event.message === 'string' ? event.message.trim() : '';
                const isMonologue = /^(?:the\s+user|i\s+need\s+to|let\s+me|things\s+in\s+one\s+turn)\b/i.test(eventText);
                const cleanEvent = (!isMonologue && eventText) ? eventText : '';
                const runningText = cleanEvent || msgText || `Running ${event.tool}...`;

                const execText = (event.query && event.tool === 'search_workspace')
                  ? `Searching notes for "${event.query}"...`
                  : (event.query && event.tool === 'web_search')
                    ? `Searching for "${event.query}"`
                    : (msgText || `Running ${event.tool}...`);

                const subSteps = [];
                if (execText && execText !== cleanEvent) {
                  subSteps.push({
                    text: execText,
                    tool: event.tool,
                    query: event.query,
                    action: event.action,
                    stateType: event.tool === 'user_memory' ? 'memory' : event.tool,
                  });
                }

                const newStep = {
                  id: `tool-${event.tool}-${Date.now()}-${prevSteps.length}`,
                  type: 'tool_call',
                  event: cleanEvent || runningText,
                  tool: event.tool,
                  text: runningText,
                  runningLabel: runningText,
                  execMessage: execText,
                  subSteps,
                  query: event.query,
                  action: event.action,
                  domain: event.domain,
                  url: event.url,
                  stateType: event.tool === 'user_memory'
                    ? (event.action === 'save' ? 'memory' : 'remembering')
                    : (event.tool || event.stateType || 'action'),
                  status: 'running',
                  isLive: true,
                  timestamp: Date.now(),
                };

                return {
                  ...prev,
                  status: runningText,
                  stateType: event.tool || prev.stateType,
                  workingSteps: [...prevSteps, newStep],
                };
              });
            } else if (event.type === 'tool_end') {
              updateStreamingMessage((prev) => {
                if (!prev) return prev;
                const prevSteps = Array.isArray(prev.workingSteps) ? [...prev.workingSteps] : [];
                const completionEvent = typeof event.event === 'string' ? event.event.trim() : '';

                const updatedSteps = prevSteps.map((s) => {
                  if (s.tool === event.tool && s.isLive) {
                    const resolvedText = completionEvent || s.runningLabel || s.text;
                    return {
                      ...s,
                      text: resolvedText,
                      resolvedLabel: resolvedText,
                      isLive: false,
                      status: event.status || 'success',
                      error: event.error,
                      completionEvent: completionEvent || s.completionEvent,
                    };
                  }
                  return s;
                });

                return {
                  ...prev,
                  workingSteps: updatedSteps,
                };
              });
            } else if (event.type === 'state') {
              const isMemory = event.stateType === 'remembering' || event.stateType === 'memory' || (typeof event.data === 'string' && /remember|yaad/i.test(event.data));
              if (isMemory) {
                memoryStartedAt = Date.now();
              }
              updateStreamingMessage((prev) => {
                if (!prev) return prev;
                const nextStateType = (prev.stateType === 'deep_research' && (!event.stateType || event.stateType === 'thinking'))
                  ? 'deep_research'
                  : (event.stateType || prev.stateType || 'thinking');

                return {
                  ...prev,
                  status: event.data,
                  stateType: nextStateType,
                };
              });
            } else if (event.type === 'thinking' || event.type === 'thought') {
              // Completely ignored. User explicitly does NOT want internal thinking rendered on UI.
            } else if (event.type === 'research_update' || event.type === 'research_start') {
              updateStreamingMessage((prev) => {
                if (!prev) return prev;
                const researchData = event.data || (typeof event.topic === 'string' ? { topic: event.topic } : event);
                const prevSteps = Array.isArray(prev.workingSteps) ? [...prev.workingSteps] : [];

                // 1. Preserve or insert root research topic thought
                if (researchData?.topic && !prevSteps.some((s) => s.type === 'thought' && s.text.includes(researchData.topic))) {
                  if (!prevSteps.some((s) => s.type === 'thought')) {
                    prevSteps.unshift({
                      type: 'thought',
                      text: `Researching: ${researchData.topic}`,
                      timestamp: Date.now(),
                    });
                  }
                }

                // If currentAction is a companion thought (first person sentence), ensure it's recorded as thought
                if (
                  researchData?.currentAction &&
                  /^(?:I am|Main|We are)\b/i.test(researchData.currentAction.trim()) &&
                  !prevSteps.some((s) => s.text === researchData.currentAction.trim())
                ) {
                  prevSteps.push({
                    type: 'thought',
                    text: researchData.currentAction.trim(),
                    timestamp: Date.now(),
                  });
                }

                // 2. In-place merge of structured research steps by ID or title (never wipes out existing thoughts/sources)
                if (Array.isArray(researchData?.steps) && researchData.steps.length > 0) {
                  researchData.steps.forEach((st) => {
                    const existingIdx = prevSteps.findIndex(
                      (s) => s.id === st.id || (s.text === st.title && s.stateType === 'deep_research')
                    );
                    const stepItem = {
                      id: st.id,
                      type: 'execution',
                      text: st.title,
                      stateType: 'deep_research',
                      isLive: st.status === 'in_progress',
                      status: st.status === 'completed' ? 'success' : st.status,
                      timestamp: Date.now(),
                    };

                    if (existingIdx >= 0) {
                      prevSteps[existingIdx] = {
                        ...prevSteps[existingIdx],
                        ...stepItem,
                      };
                    } else {
                      prevSteps.push(stepItem);
                    }
                  });
                }

                return {
                  ...prev,
                  researchData: event.data,
                  stateType: 'deep_research',
                  status: researchData?.currentAction || prev.status,
                  workingSteps: prevSteps,
                };
              });
            } else if (event.type === 'content' || event.type === 'chunk') {
              const text = event.data ?? event.chunk ?? event.content ?? '';
              enqueueStreamContent(text);
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
              updateStreamingMessage((prev) => {
                if (!prev) return prev;
                const prevSteps = Array.isArray(prev.workingSteps) ? prev.workingSteps : [];
                return {
                  ...prev,
                  workingSteps: [
                    ...prevSteps,
                    { text: 'Updated tasks and kanban board', stateType: 'task_management', timestamp: Date.now() }
                  ],
                };
              });
            } else if (event.type === 'memory_saved') {
              const savedFact = event.data?.fact || event.data;
              const factText = typeof savedFact === 'string' ? savedFact : JSON.stringify(savedFact);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:memory-updated'));
              }
              const memoryDuration = memoryStartedAt ? Math.max(1, Math.round((Date.now() - memoryStartedAt) / 1000)) : undefined;
              updateStreamingMessage((prev) => {
                if (!prev) return prev;
                const prevSteps = Array.isArray(prev.workingSteps) ? prev.workingSteps : [];
                return {
                  ...prev,
                  memorySaved: true,
                  memoryFact: factText,
                  memoryDuration,
                  isNewMemory: true,
                  workingSteps: [
                    ...prevSteps,
                    { type: 'execution', text: `Updated memory: ${factText}`, stateType: 'memory', timestamp: Date.now() }
                  ],
                };
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
            pacer = makePacer();

            updateStreamingMessage((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                content: '',
                status: `${attempt}/${MAX_RECONNECT_ATTEMPTS} trying to reconnect...`,
                stateType: 'reconnecting',
              };
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
      setIsResponseWriting(false);
      isResponseWritingRef.current = false;

      const finalMsg = streamingMessageRef.current;
      setStreamingMessage(null);
      streamingMessageRef.current = null;

      if (finalMsg) {
        const duration = finalMsg.workingDuration || (finalMsg.startedAt ? Math.max(1, Math.round((Date.now() - finalMsg.startedAt) / 1000)) : 0);
        if (!finalMsg.content.trim()) {
          if (signal.aborted) {
            // User intentionally stopped / paused generation - never treat as failure
            if (finalMsg.workingSteps && finalMsg.workingSteps.length > 0) {
              setMessages((prev) => [...prev, { ...finalMsg, workingDuration: duration, stoppedByUser: true }]);
            }
          } else if (completedSuccessfully) {
            // If stream completed successfully without text tokens, use a clean non-thought fallback
            const isStatusAThought = finalMsg.status && /^(?:the\s+user|i\s+am|main\b|we\s+are)\b/i.test(finalMsg.status.trim());
            const fallbackContent = (!isStatusAThought && finalMsg.status) ? finalMsg.status : "Completed.";
            setMessages((prev) => [...prev, { ...finalMsg, content: fallbackContent, workingDuration: duration }]);
          } else {
            if (!streamError && !signal.aborted) {
              setChatError({ message: "LLM failed to generate a response.", query: userQuery });
              setTimeout(() => {
                showToast("LLM failed to generate a response. Please try again.", "error");
              }, 10);
            }
          }
        } else {
          setMessages((prev) => [...prev, { ...finalMsg, workingDuration: duration, stoppedByUser }]);
        }
      }
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
    setStreamingMessage(null);
    streamingMessageRef.current = null;
    setIsResponseWriting(false);
    isResponseWritingRef.current = false;
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
    isResponseWriting,
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
    isResponseWriting,
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
      <ChatStreamContext.Provider value={streamingMessage}>
        {children}
      </ChatStreamContext.Provider>
    </ChatContext.Provider>
  );
};
