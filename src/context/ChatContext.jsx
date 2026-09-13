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

    setQuery('');

    // Capture history before appending new user message
    const chatHistory = messages.map(msg => ({ role: msg.role, content: msg.content }));

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userQuery },
      { role: 'assistant', content: '', sources: [] },
    ]);
    setIsStreaming(true);

    const activeModel = selectedModel;
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      for await (const event of chatAPI.ask(userQuery, chatHistory, activeModel, sessionId, isThinking, signal)) {
        if (event.type === 'sources') {
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (lastIndex < 0) return prev;
            const lastMsg = prev[lastIndex];
            if (lastMsg.role !== 'assistant') return prev;
            return [...prev.slice(0, lastIndex), { ...lastMsg, sources: event.data }];
          });
          setCurrentSources(event.data);
        } else if (event.type === 'content') {
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (lastIndex < 0) return prev;
            const lastMsg = prev[lastIndex];
            if (lastMsg.role !== 'assistant') return prev;
            return [...prev.slice(0, lastIndex), { ...lastMsg, content: lastMsg.content + event.data }];
          });
        } else if (event.type === 'done') {
          break;
        } else if (event.type === 'error') {
          showToast(event.error || event.data || "An error occurred.", "error");
          break;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Chat generation aborted by user.');
      } else {
        console.error('Chat error:', err);
      }
    } finally {
      setIsStreaming(false);
      setMessages((prev) => {
        const msgs = [...prev];
        const lastIndex = msgs.length - 1;
        if (lastIndex >= 0) {
          const last = msgs[lastIndex];
          if (last.role === 'assistant' && !last.content.trim()) {
            msgs.pop(); // Remove the empty reply bubble
            // Give message to frontend
            setTimeout(() => {
              showToast("LLM failed to generate a response. Please try again.", "error");
            }, 10);
          }
        }
        return msgs;
      });
    }
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
        userClosedSidebar
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
