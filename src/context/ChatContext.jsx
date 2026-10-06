import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatAPI, invalidateCache } from '../services/api';
import { useToast } from './ToastContext';
import { validateAiInput } from '../utils/aiValidation';

import { ChatContext } from './ChatContextDefinition';

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
  const [currentSources, setCurrentSources] = useState([]);
  
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
        } catch (e) {}
      }
      if (isRightChatOpen) {
        localStorage.setItem('noema-right-chat-open', 'true');
      }
    }
  };
  
  // Model & Thinking States
  const [selectedModel, setSelectedModel] = useState(
    () => localStorage.getItem('noema-chat-model') || 'meta/llama-3.2-11b-vision-instruct',
  );
  const [isThinking, setIsThinking] = useState(
    () => localStorage.getItem('noema-chat-thinking') === 'true',
  );
  const [chatError, setChatError] = useState(null); // { message: string, query: string }
  
  const hasAutoOpened = useRef(false);
  const userClosedSidebar = useRef(false);
  const abortControllerRef = useRef(null);

  const updateSelectedModel = (model) => {
    setSelectedModel(model);
    localStorage.setItem('noema-chat-model', model);
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
    setCurrentSources([]);

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
      { role: 'assistant', content: '', sources: [], status: null, stateType: 'thinking' },
    ]);
    setIsStreaming(true);

    const activeModel = selectedModel;
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Smooth Token-by-Token Streaming Pacer
    let streamQueue = '';
    let isStreamNetworkDone = false;
    let tickTimeoutId = null;
    let isPacerRunning = false;
    let streamError = false;
    let memoryStartedAt = 0;

    const pumpNextTokens = () => {
      if (signal.aborted) {
        streamQueue = '';
        isPacerRunning = false;
        return;
      }

      if (streamQueue.length === 0) {
        isPacerRunning = false;
        if (isStreamNetworkDone) {
          setIsStreaming(false);
        }
        return;
      }

      if (memoryStartedAt > 0) {
        const elapsed = Date.now() - memoryStartedAt;
        const MIN_MEMORY_DWELL_MS = 1800;
        if (elapsed < MIN_MEMORY_DWELL_MS) {
          isPacerRunning = true;
          tickTimeoutId = setTimeout(pumpNextTokens, MIN_MEMORY_DWELL_MS - elapsed);
          return;
        }
        memoryStartedAt = 0;
      }

      isPacerRunning = true;

      // Dynamic pacing:
      // When queue is small (< 12 chars): take 1-2 chars for human-pace, organic token-by-token flow
      // When large bursts arrive from backend SSE: smoothly divide over frames so it never drops all at once
      let take = 1;
      const qLen = streamQueue.length;
      if (qLen > 100) {
        take = Math.min(qLen, Math.ceil(qLen / 10));
      } else if (qLen > 40) {
        take = Math.min(qLen, Math.ceil(qLen / 14));
      } else if (qLen > 12) {
        take = 2;
      } else {
        take = 1;
      }

      const chunk = streamQueue.slice(0, take);
      streamQueue = streamQueue.slice(take);

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

      const delay = qLen > 60 ? 14 : 20;
      tickTimeoutId = setTimeout(pumpNextTokens, delay);
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
      if (tickTimeoutId) {
        clearTimeout(tickTimeoutId);
        tickTimeoutId = null;
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
                return [...prev.slice(0, lastIndex), { ...lastMsg, sources: Array.isArray(event.data) ? event.data : [] }];
              });
              setCurrentSources(Array.isArray(event.data) ? event.data : []);
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
                return [...prev.slice(0, lastIndex), { ...lastMsg, status: event.data, stateType: event.stateType || 'thinking' }];
              });
            } else if (event.type === 'research_update') {
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;
                return [...prev.slice(0, lastIndex), { ...lastMsg, researchData: event.data }];
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
              } catch {}
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('tasks:refresh'));
              }
            } else if (event.type === 'memory_saved') {
              const savedFact = event.data?.fact || event.data;
              setMessages((prev) => {
                const lastIndex = prev.length - 1;
                if (lastIndex < 0) return prev;
                const lastMsg = prev[lastIndex];
                if (lastMsg.role !== 'assistant') return prev;
                return [
                  ...prev.slice(0, lastIndex),
                  {
                    ...lastMsg,
                    memorySaved: true,
                    memoryFact: typeof savedFact === 'string' ? savedFact : JSON.stringify(savedFact),
                    isNewMemory: true,
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

            if (tickTimeoutId) {
              clearTimeout(tickTimeoutId);
              tickTimeoutId = null;
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
      if (tickTimeoutId) {
        clearTimeout(tickTimeoutId);
        tickTimeoutId = null;
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
          if (last.role === 'assistant' && !last.content.trim()) {
            if (completedSuccessfully) {
              // If stream completed successfully without text tokens, use status or safe fallback
              const fallbackContent = last.status || "Completed.";
              return [...msgs.slice(0, lastIndex), { ...last, content: fallbackContent }];
            }
            msgs.pop(); // Remove the empty reply bubble only on genuine unhandled failure
            if (!streamError) {
              setChatError({ message: "LLM failed to generate a response.", query: userQuery });
              setTimeout(() => {
                showToast("LLM failed to generate a response. Please try again.", "error");
              }, 10);
            }
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
        setCurrentSources([]);
        setChatError(null);

        const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
        if (mode === 'resume') {
          localStorage.setItem('noema-last-chat-session', id);
          try {
            localStorage.setItem('noema-last-chat-messages', JSON.stringify(msgs));
          } catch (e) {}
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
          } catch (e) {}
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
    setCurrentSources([]);
    setSessionId(uuidv4());
    setNextCursor(null);
    setHasMore(false);
    setChatError(null);
    localStorage.removeItem('noema-last-chat-session');
    localStorage.removeItem('noema-last-chat-messages');
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        query,
        setQuery,
        isStreaming,
        currentSources,
        setCurrentSources,
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
        nextCursor,
        isLoadingMore,
        hasMore,
        sessionId,
        setSessionId,
        hasAutoOpened,
        userClosedSidebar,
        chatError,
        clearChatError,
        retryLastMessage,
        chatStartupMode,
        setChatStartupMode: updateChatStartupMode
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
