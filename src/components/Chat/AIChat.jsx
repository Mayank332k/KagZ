import React, { useState, useRef, useEffect, useContext, useLayoutEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, Plus, X, FileText, Maximize2, Mic, ChevronDown, PlusCircle, Loader, Copy, Check, MoreVertical, ArrowLeft } from 'lucide-react';
import { ResourcesAddIcon, FolderLibraryIcon, Brain03Icon, ChatGptIcon, MetaIcon, ClaudeIcon, File01Icon, SidebarLeft01Icon, Loading03Icon, MaximizeScreenIcon, Edit02Icon } from 'hugeicons-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChatContext } from '../../context/ChatContext';
import { EditorContext } from '../../context/EditorContext';
import { AiCodeBlock } from '@/components/lightswind/ai-code-block';
import MarkdownRenderer from '../UI/MarkdownRenderer';
import { ShinyText } from '@/components/lightswind/shiny-text';
import './AIChat.css';

// Time ago utility
const timeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

// MarkdownRenderer imported from UI

// Message action toolbar for assistant result cards

const SourcesBottomSheet = ({ sources, onClose }) => {
  const navigate = useNavigate();
  return (
    <div className="absolute inset-0 z-[100] overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[770px] bg-[#1c1c1c] rounded-t-[20px] shadow-2xl z-[101] flex flex-col overflow-hidden text-gray-200 pointer-events-auto max-h-[80%]"
      >
        <div className="w-full flex justify-center pt-3 pb-2 cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1 bg-gray-600 rounded-full" />
        </div>
        <div className="px-4 pb-8 pt-2">
          <h3 className="flex items-center justify-center gap-2 font-semibold text-[15px] mb-4">
            <ResourcesAddIcon className="w-[18px] h-[18px] text-gray-400" />
            Sources
          </h3>
          
          <div className="flex flex-col rounded-[12px] bg-[#2a2a2a] overflow-hidden">
            {sources.map((src, i) => (
              <React.Fragment key={i}>
                <button
                  onClick={() => {
                    navigate(`/dashboard/page/${src.pageId}`);
                    onClose();
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#333] transition-colors text-left"
                >
                  <File01Icon className="w-[18px] h-[18px] text-gray-400 shrink-0" />
                  <span className="text-[14px] truncate">{src.title || "Source document"}</span>
                </button>
                {i < sources.length - 1 && <div className="h-[1px] w-full bg-[#3a3a3a]" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const MessageActions = ({ content, timestamp, isLatest, sources, onShowSources }) => {
  const { isPageOpen, appendContent, workspaceTree, triggerSidebarRefresh } = useContext(EditorContext);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleAdd = async () => {
    if (isPageOpen) {
      appendContent(content);
    } else {
      try {
        let workspaceId = workspaceTree?.[0]?.id;
        
        if (!workspaceId) {
          const { workspacesAPI } = await import('../../services/api');
          const resWs = await workspacesAPI.getAll();
          const workspaces = resWs.data?.workspaces || [];
          workspaceId = workspaces.length > 0 ? workspaces[0]._id : null;
        }

        const title = content.substring(0, 30).split('\n')[0].replace(/[#*`]/g, '').trim() || 'AI Note';
        
        const { pagesAPI } = await import('../../services/api');
        const resPage = await pagesAPI.create({
          title,
          content,
          workspaceId
        });
        
        if (resPage.data?.success) {
           const newPage = resPage.data.page;
           triggerSidebarRefresh?.();
           // Notify optimistic UI if needed, but triggerSidebarRefresh usually handles it
           const event = new CustomEvent("optimistic-add-page", { detail: { ...newPage, type: 'page', path: `/dashboard/page/${newPage._id}` } });
           window.dispatchEvent(event);
           navigate(`/dashboard/page/${newPage._id}`);
        }
      } catch (err) {
        console.error('Failed to create page:', err);
      }
    }
  };

  return (
    <div className={`flex items-center gap-1 mt-2 transition-opacity duration-200 ${isLatest ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'}`}>
      {/* Copy */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 px-2 py-1 text-[12px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        title="Copy"
      >
        {copied ? (
          <><Check className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500">Copied</span></>
        ) : (
          <><Copy className="w-3.5 h-3.5" /><span>Copy</span></>
        )}
      </button>

      {/* Sources Button */}
      {sources && sources.length > 0 && (
        <button
          onClick={() => onShowSources(sources)}
          className="flex items-center gap-1 px-2 py-1 text-[12px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="Sources"
        >
          <ResourcesAddIcon className="w-3.5 h-3.5" />
          <span>Sources</span>
        </button>
      )}

      {/* Add to page */}
      <button
        onClick={handleAdd}
        className={`flex items-center gap-1 px-2 py-1 text-[12px] rounded-lg transition-colors text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer`}
        title={isPageOpen ? 'Add to current page' : 'Create new page with this content'}
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add</span>
      </button>

      {/* More menu with timestamp */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center px-1.5 py-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          title="More"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        {showMenu && (
          <div className="absolute left-0 bottom-full mb-1 bg-white rounded-[10px] shadow-lg border border-gray-200 py-1.5 px-3 z-50 whitespace-nowrap text-[12px] text-gray-500">
            {timeAgo(timestamp) || 'Just now'}
          </div>
        )}
      </div>
    </div>
  );
};

const ThinkingAnimation = () => {
  const [frame, setFrame] = useState(0);
  const frames = [
    '❄', '❅', '❆', '✻', '✼', '❉', '❇', '❈', '❊', '❋', 
    '✧', '✦', '✥', '❂', '✴', '✵', '✶', '✷', '✸', '✹'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 150);
    return () => clearInterval(interval);
  }, [frames.length]);

  return (
    <div className="flex items-center text-[var(--text-secondary)] font-medium py-1">
      <span className="w-6 text-xl text-center mr-2 opacity-80">{frames[frame]}</span>
      <ShinyText 
        className="text-[15px]"
        baseColor="var(--color-shiny-base)"
        shineColor="var(--color-shiny-shine)"
        speed={2}
      >
        Thinking...
      </ShinyText>
    </div>
  );
};

const ChatComposer = ({ textareaRef, query, setQuery, handleKeyDown, handleSend, isStreaming }) => {
  const { isThinking, setIsThinking, selectedModel, setSelectedModel, stopGeneration } = useContext(ChatContext);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const models = [
    { value: 'meta/llama-3.2-11b-vision-instruct', label: 'Meta Llama 3.2 Vision', icon: <MetaIcon className="w-[18px] h-[18px]" /> },
    { value: 'nvidia/nemotron-3-super-120b-a12b', label: 'NVIDIA Nemotron 120B', icon: <ClaudeIcon className="w-[18px] h-[18px]" /> },
  ];

  const activeModel = models.find(m => m.value === selectedModel) || models[0];

  return (
    <div className="w-full">
      <form onSubmit={handleSend} className="flex flex-col bg-[var(--composer-bg)] border border-[var(--border)] rounded-[24px] shadow-[0_2px_12px_rgb(0,0,0,0.04)] focus-within:border-[var(--accent-warm)] focus-within:shadow-[0_4px_20px_rgb(0,0,0,0.08)] transition-all duration-300 p-2.5 mx-auto">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Do anything..."
          rows={1}
          autoFocus
          className="w-full bg-transparent resize-none outline-none text-[16px] text-[var(--composer-text)] placeholder-[var(--text-muted)] px-2 py-1 custom-scrollbar leading-relaxed"
          style={{ maxHeight: '250px' }}
        />
        
        <div className="flex items-center justify-between mt-2 px-1 relative">
          {/* Left Controls */}
          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={() => setIsThinking(!isThinking)}
              className={`flex items-center justify-center gap-1.5 rounded-full text-[14px] font-medium transition-all duration-300 ${
                isThinking 
                  ? 'bg-blue-500/5 text-blue-600 px-3 py-1.5' 
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600 p-2'
              }`}
              title="Toggle Deep Thinking"
            >
              <Brain03Icon className={isThinking ? "w-[18px] h-[18px]" : "w-[22px] h-[22px]"} />
              {isThinking && <span>Thinking</span>}
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[14px] font-bold text-[#4B5563] dark:text-[#9CA3AF] transition-colors"
              >
                {activeModel.icon}
                {activeModel.label}
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 mb-2 w-[240px] bg-white border border-gray-200 shadow-lg z-50 overflow-hidden rounded-[10px]"
                  >
                    <div className="flex flex-col">
                      {models.map((model, index) => {
                        const isActive = selectedModel === model.value;

                        return (
                          <button
                            key={model.value}
                            type="button"
                            onClick={() => {
                              setSelectedModel(model.value);
                              setIsDropdownOpen(false);
                            }}
                            className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-colors ${
                              index !== models.length - 1 ? 'border-b border-gray-100' : ''
                            } ${
                              isActive 
                                ? 'bg-gray-50 text-gray-900 font-medium' 
                                : 'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                          >
                            <div className={`${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                              {React.cloneElement(model.icon, { className: "w-[18px] h-[18px]" })}
                            </div>
                            <div className="text-[14px]">
                              <span>{model.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="w-[36px] h-[36px] rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-sm ml-1"
                title="Stop generation"
              >
                <div className="w-3.5 h-3.5 bg-white rounded-[3px]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!query.trim()}
                className="w-[36px] h-[36px] rounded-full bg-[#9CA3AF] dark:bg-white flex items-center justify-center text-white dark:text-black hover:bg-[#6B7280] dark:hover:bg-gray-200 disabled:opacity-40 transition-colors shadow-sm ml-1"
              >
                <ArrowUp className="w-[20px] h-[20px]" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

const AIChat = ({ isRightPanel = false }) => {
  const [activeSources, setActiveSources] = useState(null);
  const {
    messages,
    query,
    setQuery,
    isStreaming,
    currentSources,
    sendMessage,
    clearChat,
    setIsRightChatOpen,
    isLoadingMore,
    hasMore,
    fetchMoreMessages
  } = useContext(ChatContext);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const textareaRef = useRef(null);
  const chatScrollRef = useRef(null);
  const navigate = useNavigate();

  const greetings = [
    "How is your day going?",
    "Search anything across your workspace",
    "Write an email or draft a page",
    "Brainstorm ideas for your project",
    "Summarize your recent notes"
  ];
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (messages.length === 0) {
      const interval = setInterval(() => {
        setGreetingIndex((prev) => (prev + 1) % greetings.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [messages.length]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (query.trim() !== '') {
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
      }
    }
  }, [query]);

  const prevScrollHeightRef = useRef(0);
  const wasLoadingMoreRef = useRef(false);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // Show scroll button if scrolled up more than 150px
    if (scrollHeight - scrollTop - clientHeight > 150) {
      setShowScrollButton(true);
    } else {
      setShowScrollButton(false);
    }

    if (scrollTop === 0 && !isLoadingMore && hasMore) {
      prevScrollHeightRef.current = scrollHeight;
      wasLoadingMoreRef.current = true;
      fetchMoreMessages();
    }
  };

  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useLayoutEffect(() => {
    if (chatScrollRef.current) {
      if (wasLoadingMoreRef.current) {
        const newScrollHeight = chatScrollRef.current.scrollHeight;
        chatScrollRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
        wasLoadingMoreRef.current = false;
      } else {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    }
  }, [messages]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || isStreaming) return;
    await sendMessage(query.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpenDoc = (pageId) => {
    setIsRightChatOpen(true);
    navigate(`/dashboard/editor/${pageId}`);
  };

  // If rendered as a Right Sidebar Panel in Dashboard
  if (isRightPanel) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-[var(--color-dark-bg)] border-l border-gray-200 dark:border-[var(--color-dark-border)] overflow-hidden relative shadow-sm">
        {/* Right Panel Header */}
        <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100 dark:border-[var(--color-dark-border)] bg-white dark:bg-[var(--color-dark-bg)]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => clearChat()}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
              title="New Chat"
            >
              <PlusCircle className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/dashboard/chat')}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
              title="Expand Chat"
            >
              <MaximizeScreenIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsRightChatOpen(false)}
              className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
              title="Close Chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4" ref={chatScrollRef} onScroll={handleScroll}>
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loading03Icon className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <div className="relative w-full h-[28px] mb-1">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={greetingIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="text-base font-semibold text-gray-700 dark:text-gray-200 absolute w-full text-center"
                  >
                    {greetings[greetingIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group/msg`}>
                {msg.role === 'user' ? (
                  <div className="bg-gray-100 dark:bg-[#202020] text-gray-800 dark:text-gray-200 text-[15px] px-5 py-3 rounded-[20px] max-w-[85%] leading-relaxed shadow-sm">
                    <MarkdownRenderer content={msg.content} />
                  </div>
                ) : (
                  <div className="bg-transparent text-gray-800 dark:text-gray-200 text-[14px] py-1 max-w-[100%] leading-relaxed w-full">
                    
                    {msg.content === '' && isStreaming && idx === messages.length - 1 ? (
                      <ThinkingAnimation />
                    ) : (
                      <div className="markdown-content text-[14px] leading-relaxed">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    )}
                    {msg.content && !(msg.content === '' && isStreaming && idx === messages.length - 1) && (
                      <MessageActions content={msg.content} timestamp={msg.createdAt || msg.timestamp} isLatest={idx === messages.length - 1} sources={msg.sources} onShowSources={setActiveSources} />
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Composer */}
        <div className="p-4 bg-white/80 dark:bg-[var(--color-dark-bg)]/80 backdrop-blur-md z-10 relative">
          <AnimatePresence>
            {showScrollButton && (
              <motion.button
                initial={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
                exit={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                onClick={scrollToBottom}
                className="absolute -top-12 left-1/2 z-50 p-2 bg-white dark:bg-[#2A2A2A] border border-gray-200 dark:border-gray-600 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.4)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white dark:hover:bg-[#333] transition-all hover:scale-105"
                title="Scroll to bottom"
              >
                <ArrowDown className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>
          <ChatComposer 
            textareaRef={textareaRef}
            query={query}
            setQuery={setQuery}
            handleKeyDown={handleKeyDown}
            handleSend={handleSend}
            isStreaming={isStreaming}
          />
        </div>

        <AnimatePresence>
          {activeSources && <SourcesBottomSheet sources={activeSources} onClose={() => setActiveSources(null)} />}
        </AnimatePresence>
      </div>
    );
  }


  // Full Screen View (/dashboard/chat)
  return (
    <div className="flex flex-row w-full h-full relative bg-white dark:bg-[var(--color-dark-bg)] overflow-hidden">
      <div className="chat-container flex-1">
        {/* Header with Blurs & Actions */}
        <div className="chat-header relative flex justify-between items-start p-4 z-50 pointer-events-none">
          <button 
            onClick={() => navigate(-1)}
            className="pointer-events-auto relative z-10 flex items-center justify-center shrink-0 w-[34px] h-[34px] bg-[var(--composer-bg)] border border-[var(--border)] text-[var(--composer-text)] rounded-full shadow-sm hover:border-[var(--accent-warm)] transition-all"
            title="Go back"
          >
            <ArrowLeft className="w-[18px] h-[18px] stroke-[2]" />
          </button>
          
          <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`pointer-events-auto relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium border rounded-full shadow-sm transition-all ${
              isSidebarOpen 
                ? "bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100" 
                : "bg-[var(--composer-bg)] border-[var(--border)] text-[var(--composer-text)] hover:border-[var(--accent-warm)]"
            }`}
          >
            <FolderLibraryIcon className="w-4 h-4" />
            Sources
          </button>

          <button 
            onClick={() => {
              setIsRightChatOpen(true);
              navigate('/dashboard');
            }}
            className="pointer-events-auto relative z-10 flex items-center justify-center w-[34px] h-[34px] bg-[var(--composer-bg)] border border-[var(--border)] text-[var(--composer-text)] rounded-full shadow-sm hover:border-[var(--accent-warm)] transition-all"
            title="Open in Sidebar"
          >
            <SidebarLeft01Icon className="w-[18px] h-[18px]" />
          </button>
          
            <button 
              onClick={clearChat}
              className="pointer-events-auto relative z-10 flex items-center justify-center w-[34px] h-[34px] bg-[var(--composer-bg)] border border-[var(--border)] text-[var(--composer-text)] rounded-full shadow-sm hover:border-[var(--accent-warm)] transition-all"
              title="New Chat"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4 mt-[-10vh] z-10 relative">
            {/* Logo Doodle */}
            <div className="flex items-center justify-center mb-8 relative group cursor-default">
              <img src="/kag-z.png" alt="KagZ Logo" className="w-[64px] h-[64px] object-contain transition-transform duration-300 group-hover:scale-110" />
            </div>

            <div className="h-[40px] mb-8 w-full relative flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={greetingIndex}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  className="text-[32px] font-bold text-gray-900 dark:text-[var(--color-dark-title)] tracking-tight absolute text-center w-full"
                >
                  {greetings[greetingIndex]}
                </motion.h1>
              </AnimatePresence>
            </div>

            {/* Centered Composer */}
            <div className="w-full max-w-[770px] mb-8 relative z-20 px-4">
              <ChatComposer 
                textareaRef={textareaRef}
                query={query}
                setQuery={setQuery}
                handleKeyDown={handleKeyDown}
                handleSend={handleSend}
                isStreaming={isStreaming}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Chat Scroll Area */}
            <div className="chat-scroll-area custom-scrollbar" ref={chatScrollRef} onScroll={handleScroll}>
              {isLoadingMore && (
                <div className="flex justify-center py-4">
                  <Loading03Icon className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              )}
              <div className="message-list">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message-row ${msg.role} group/msg`}>
                    {msg.role === 'user' ? (
                      <div className="message-bubble-user">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    ) : (
                      <div className="message-bubble-assistant">
                        <div className="markdown-content">
                          
                          {msg.content === '' && isStreaming && idx === messages.length - 1 ? (
                            <ThinkingAnimation />
                          ) : (
                            <MarkdownRenderer content={msg.content} />
                          )}
                        </div>
                        {msg.content && !(msg.content === '' && isStreaming && idx === messages.length - 1) && (
                          <MessageActions content={msg.content} timestamp={msg.createdAt || msg.timestamp} isLatest={idx === messages.length - 1} sources={msg.sources} onShowSources={setActiveSources} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer with Blurs & Composer */}
            <div className="chat-footer">
              <div className="footer-blur-layer-1" />
              <div className="footer-blur-layer-2" />
              <div className="footer-blur-layer-3" />
              
              <div className="w-full max-w-[770px] mx-auto px-4 relative z-20">
                <AnimatePresence>
                  {showScrollButton && (
                    <motion.button
                      initial={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                      animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
                      exit={{ opacity: 0, y: 10, scale: 0.9, x: '-50%' }}
                      onClick={scrollToBottom}
                      className="absolute -top-16 left-1/2 z-50 p-2.5 bg-white dark:bg-[#2A2A2A] border border-gray-200 dark:border-gray-600 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.4)] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white dark:hover:bg-[#333] transition-all hover:scale-105"
                      title="Scroll to bottom"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </motion.button>
                  )}
                </AnimatePresence>
                <ChatComposer 
                  textareaRef={textareaRef}
                  query={query}
                  setQuery={setQuery}
                  handleKeyDown={handleKeyDown}
                  handleSend={handleSend}
                  isStreaming={isStreaming}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Sidebar for Sources */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="h-full bg-white dark:bg-[var(--color-dark-bg)] border-l border-gray-100 dark:border-[var(--color-dark-border)] flex flex-col shrink-0 overflow-hidden relative z-50"
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 w-[320px]">
              <h2 className="text-[14px] font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                Sources
              </h2>
              <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 w-[320px] custom-scrollbar">
              {currentSources.length > 0 ? (
                currentSources.map((src, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleOpenDoc(src.pageId)}
                    className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-[var(--color-dark-border)] hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm cursor-pointer transition-all bg-gray-50/50 dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#202020]"
                  >
                    <div className="flex-1">
                      <h3 className="text-[13px] font-medium text-gray-800 dark:text-gray-200 leading-snug">{src.title}</h3>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 tracking-wide flex items-center">
                        Document
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <FolderLibraryIcon className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                  </div>
                  <h3 className="text-[13px] font-medium text-gray-600 dark:text-gray-300 mb-1">No Sources Yet</h3>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500">Sources used by the AI will appear here.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    
      <AnimatePresence>
        {activeSources && <SourcesBottomSheet sources={activeSources} onClose={() => setActiveSources(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default AIChat;