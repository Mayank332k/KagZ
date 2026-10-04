import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatAPI } from '../services/api';
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

    let contentBuffer = '';
    let rafId = null;
    let streamError = false;

    const flushContentBuffer = () => {
      if (!contentBuffer) return;
      const chunk = contentBuffer;
      contentBuffer = '';
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex < 0) return prev;
        const lastMsg = prev[lastIndex];
        if (lastMsg.role !== 'assistant') return prev;
        return [...prev.slice(0, lastIndex), { ...lastMsg, content: lastMsg.content + chunk }];
      });
    };

    const scheduleContentFlush = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        flushContentBuffer();
      });
    };

    try {
      for await (const event of chatAPI.ask(userQuery, chatHistory, activeModel, sessionId, isThinking, signal)) {
        if (event.type === 'sources') {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          flushContentBuffer();
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (lastIndex < 0) return prev;
            const lastMsg = prev[lastIndex];
            if (lastMsg.role !== 'assistant') return prev;
            return [...prev.slice(0, lastIndex), { ...lastMsg, sources: Array.isArray(event.data) ? event.data : [] }];
          });
          setCurrentSources(Array.isArray(event.data) ? event.data : []);
        } else if (event.type === 'state') {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          flushContentBuffer();
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (lastIndex < 0) return prev;
            const lastMsg = prev[lastIndex];
            if (lastMsg.role !== 'assistant') return prev;
            return [...prev.slice(0, lastIndex), { ...lastMsg, status: event.data, stateType: event.stateType || 'thinking' }];
          });
        } else if (event.type === 'content') {
          contentBuffer += event.data;
          scheduleContentFlush();
        } else if (event.type === 'done') {
          break;
        } else if (event.type === 'error') {
          const errText = event.error || event.data || "An error occurred.";
          streamError = true;
          showToast(errText, "error");
          setChatError({ message: errText, query: userQuery });
          break;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Chat generation aborted by user.');
      } else {
        console.error('Chat error:', err);
        setChatError({ message: err.message || "Failed to generate response.", query: userQuery });
      }
    } finally {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (signal.aborted) {
        contentBuffer = '';
      }
      if (abortControllerRef.current?.signal === signal) {
        abortControllerRef.current = null;
      }
      if (!signal.aborted) {
        flushContentBuffer();
        setIsStreaming(false);
        setMessages((prev) => {
          const msgs = [...prev];
          const lastIndex = msgs.length - 1;
          if (lastIndex >= 0) {
            const last = msgs[lastIndex];
            if (last.role === 'assistant' && !last.content.trim()) {
              msgs.pop(); // Remove the empty reply bubble
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
