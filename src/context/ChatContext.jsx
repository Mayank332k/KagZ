import React, { createContext, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { chatAPI } from '../services/api';
import { useToast } from './ToastContext';
import { validateAiInput } from '../utils/aiValidation';

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { showToast } = useToast();
  const [sessionId, setSessionId] = useState(() => uuidv4());
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  
  const [query, setQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSources, setCurrentSources] = useState([]);
  const [isRightChatOpen, setIsRightChatOpen] = useState(false);
  
  // Model & Thinking States
  const [selectedModel, setSelectedModel] = useState('meta/llama-3.2-11b-vision-instruct');
  const [isThinking, setIsThinking] = useState(false);
  const [chatError, setChatError] = useState(null); // { message: string, query: string }
  
  const hasAutoOpened = useRef(false);
  const userClosedSidebar = useRef(false);
  const abortControllerRef = useRef(null);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const sendMessage = async (userQuery) => {
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
    const chatHistory = messages.map(msg => ({ role: msg.role, content: msg.content }));

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userQuery },
      { role: 'assistant', content: '', sources: [], status: 'Thinking...' },
    ]);
    setIsStreaming(true);

    const activeModel = selectedModel;
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    let contentBuffer = '';
    let rafId = null;

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
            return [...prev.slice(0, lastIndex), { ...lastMsg, sources: event.data }];
          });
          setCurrentSources(event.data);
        } else if (event.type === 'state') {
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          flushContentBuffer();
          if (event.data && /connecting to ai/i.test(event.data)) {
            // Ignore internal retry/connection state so it never displays on UI
            return;
          }
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (lastIndex < 0) return prev;
            const lastMsg = prev[lastIndex];
            if (lastMsg.role !== 'assistant') return prev;
            return [...prev.slice(0, lastIndex), { ...lastMsg, status: event.data }];
          });
        } else if (event.type === 'content') {
          contentBuffer += event.data;
          scheduleContentFlush();
        } else if (event.type === 'done') {
          break;
        } else if (event.type === 'error') {
          const errText = event.error || event.data || "An error occurred.";
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
      flushContentBuffer();
      setIsStreaming(false);
      setMessages((prev) => {
        const msgs = [...prev];
        const lastIndex = msgs.length - 1;
        if (lastIndex >= 0) {
          const last = msgs[lastIndex];
          if (last.role === 'assistant' && !last.content.trim()) {
            msgs.pop(); // Remove the empty reply bubble
            // Give message to frontend
            if (!signal.aborted) {
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
    setMessages((prev) => {
      let clean = [...prev];
      if (clean.length > 0 && clean[clean.length - 1].role === 'assistant' && !clean[clean.length - 1].content.trim()) {
        clean.pop();
      }
      if (clean.length > 0 && clean[clean.length - 1].role === 'user' && clean[clean.length - 1].content === failedQuery) {
        clean.pop();
      }
      return clean;
    });

    sendMessage(failedQuery);
  };

  const loadSession = async (id) => {
    try {
      const res = await chatAPI.getHistory(id);
      if (res.data.success) {
        setSessionId(id);
        setMessages(res.data.messages || []);
        setNextCursor(res.data.nextCursor || null);
        setHasMore(!!res.data.nextCursor);
        setQuery('');
        setCurrentSources([]);
        setChatError(null);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

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
    setMessages([]);
    setQuery('');
    setCurrentSources([]);
    setSessionId(uuidv4());
    setNextCursor(null);
    setHasMore(false);
    setChatError(null);
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
        setSelectedModel,
        isThinking,
        setIsThinking,
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
        retryLastMessage
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
