import React, { useState, useRef, useEffect, useContext, useLayoutEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, Plus, X, FileText, Copy, Check, MoreVertical, ArrowLeft, RotateCcw, AlertCircle } from 'lucide-react';
import { FolderLibraryIcon, Brain03Icon, ClaudeIcon, NotebookIcon, SidebarLeft01Icon, Loading03Icon, Add01Icon, ArrowExpand01Icon } from 'hugeicons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChatContext } from '../../context/ChatContextDefinition';
import { EditorContext } from '../../context/EditorContext';
import MarkdownRenderer from '../UI/MarkdownRenderer';
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

const formatSource = (src) => {
  if (src.url) {
    try {
      const parsed = new URL(src.url);
      const domain = parsed.hostname.replace(/^www\./, '');
      const domainMap = {
        'nobroker.in': 'NoBroker',
        'economictimes.indiatimes.com': 'The Economic Times',
        'ilovenavimumbai.com': 'I Love Navi Mumbai',
        'tavily.com': 'Tavily',
        'github.com': 'GitHub',
        'wikipedia.org': 'Wikipedia',
        'en.wikipedia.org': 'Wikipedia',
        'medium.com': 'Medium',
        'nytimes.com': 'The New York Times',
        'youtube.com': 'YouTube',
      };
      const parts = domain.split('.');
      const baseName = parts.length > 2 ? parts[parts.length - 2] : parts[0];
      const siteName = domainMap[domain] || (baseName.charAt(0).toUpperCase() + baseName.slice(1));
      return {
        domain,
        siteName,
        isWeb: true,
        title: src.title || domain,
        url: src.url,
      };
    } catch {
      return {
        domain: 'web',
        siteName: 'Web',
        isWeb: true,
        title: src.title || 'Web Result',
        url: src.url,
      };
    }
  }

  return {
    domain: 'workspace',
    siteName: 'Workspace Note',
    isWeb: false,
    title: src.title || 'Untitled Note',
    pageId: src.pageId,
  };
};

const SourcesPill = ({ sources, align = 'side' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!sources || sources.length === 0) return null;

  const formattedSources = sources.map(formatSource);
  const primarySource = formattedSources[0];
  const primaryLabel = primarySource.domain !== 'workspace' ? primarySource.domain : primarySource.title;
  const extraCount = sources.length - 1;

  const isTopAlign = align === 'top';

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 130; // 130px for composer footer
      const shouldOpenUp = spaceBelow < 280 && rect.top > 250;
      setOpenUpwards(shouldOpenUp);

      // Smooth auto-scroll so the popover is completely in view and never goes under textarea
      setTimeout(() => {
        if (!shouldOpenUp && spaceBelow < 280) {
          containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative inline-flex items-center self-start w-fit mt-2 mb-1" ref={containerRef}>
      {/* Single Unified Pill for Source + Quantity */}
      <button
        type="button"
        onClick={handleToggle}
        className="sources-peanut-btn group inline-flex items-center gap-1.5 h-[28px] px-3 rounded-full bg-[var(--sources-pill-bg)] hover:bg-[var(--sources-pill-hover)] transition-colors focus:outline-none"
        title="View sources"
      >
        <span className="text-[12.5px] font-medium text-[var(--sources-pill-text)] group-hover:text-black dark:group-hover:text-white transition-colors truncate max-w-[170px]">
          {primaryLabel}
        </span>
        {extraCount > 0 && (
          <span className="text-[11.5px] font-semibold text-[var(--sources-pill-count)] group-hover:text-black dark:group-hover:text-white transition-colors">
            +{extraCount}
          </span>
        )}
      </button>

      {/* Floating Popover Window on Right Side matching Image 2 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: isTopAlign ? 0 : -6, y: isTopAlign ? 6 : 0 }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, x: isTopAlign ? 0 : -6, y: isTopAlign ? 6 : 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`sources-popover-card absolute z-[120] w-[330px] sm:w-[350px] p-4 text-gray-800 dark:text-gray-200 ${
              isTopAlign
                ? 'bottom-full mb-3 left-0'
                : 'left-full ml-[7px]'
            }`}
            style={
              !isTopAlign
                ? openUpwards
                  ? { bottom: '-26px' }
                  : { top: '-26px' }
                : undefined
            }
          >
            {/* Directional pointer arrow pointing directly to the capsule */}
            {isTopAlign ? (
              <svg
                className="absolute -bottom-[8px] left-[24px] pointer-events-none"
                width="16"
                height="9"
                viewBox="0 0 16 9"
                fill="none"
              >
                <path
                  d="M0.5 0.5L7.29289 7.5C7.68342 7.89052 8.31658 7.89052 8.70711 7.5L15.5 0.5"
                  stroke="var(--sources-arrow-stroke)"
                  strokeWidth="1"
                />
                <path
                  d="M1 0L7.64645 7.14645C8.03697 7.53697 8.67014 7.53697 9.06066 7.14645L15.7071 0H1Z"
                  fill="var(--sources-arrow-fill)"
                />
              </svg>
            ) : (
              <svg
                className="absolute -left-[8px] pointer-events-none"
                style={openUpwards ? { bottom: '32px' } : { top: '32px' }}
                width="9"
                height="16"
                viewBox="0 0 9 16"
                fill="none"
              >
                <path
                  d="M8.5 0.5L1 7.29289C0.609476 7.68342 0.609476 8.31658 1 8.70711L8.5 15.5"
                  stroke="var(--sources-arrow-stroke)"
                  strokeWidth="1"
                />
                <path
                  d="M9 1L1.5 7.64645C1.10948 8.03697 1.10948 8.67014 1.5 9.06066L9 15.7071V1Z"
                  fill="var(--sources-arrow-fill)"
                />
              </svg>
            )}

            {/* Centered Header */}
            <h4 className="text-center font-medium text-[13.5px] text-gray-700 dark:text-gray-300 pb-2.5 border-b border-black/[0.08] dark:border-white/10 mb-1.5 tracking-tight">
              Sources
            </h4>

            {/* Sources List */}
            <div className="flex flex-col max-h-[320px] overflow-y-auto pr-0.5">
              {formattedSources.map((item, i) => (
                <React.Fragment key={i}>
                  <div
                    onClick={() => {
                      if (item.isWeb && item.url) {
                        window.open(item.url, '_blank', 'noopener,noreferrer');
                      } else if (item.pageId) {
                        navigate(`/dashboard/page/${item.pageId}`);
                        setIsOpen(false);
                      }
                    }}
                    className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      {item.isWeb ? (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${item.domain}&sz=32`}
                          alt=""
                          className="w-3.5 h-3.5 rounded-sm object-contain shrink-0 opacity-75 group-hover:opacity-100"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <NotebookIcon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
                      )}
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 truncate">
                        {item.siteName}
                      </span>
                    </div>
                    <div className="text-[12.5px] font-medium text-gray-800 dark:text-gray-200 group-hover:text-black dark:group-hover:text-white line-clamp-1 leading-snug">
                      {item.title}
                    </div>
                  </div>
                  {i < formattedSources.length - 1 && (
                    <div className="h-[1px] w-full bg-black/[0.06] dark:bg-white/[0.07] my-1" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const MessageActions = ({ content, timestamp, isLatest }) => {
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

const ThinkingSparkle = React.memo(() => {
  const [frame, setFrame] = useState(0);
  const frames = [
    '❄', '+', '❆', '✻', '❇', '❈', '❊', '❋', 
    '✧', '✦', '✥', '❂', '✴', '✵', '✶', '✸', '✹'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 150);
    return () => clearInterval(interval);
  }, [frames.length]);

  return (
    <span className="w-5 h-5 flex items-center justify-center text-[16px] leading-none mr-2 select-none opacity-80 shrink-0">
      {frames[frame]}
    </span>
  );
});

const StatusScrollReveal = React.memo(({ text }) => {
  const words = useMemo(() => {
    return (text || '').split(/(\s+)/).filter(Boolean);
  }, [text]);

  return (
    <motion.div
      key={text}
      initial="hidden"
      animate="visible"
      exit={{
        opacity: 0,
        y: -8,
        filter: 'blur(6px)',
        transition: { duration: 0.45, ease: 'easeInOut' },
      }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.09,
            delayChildren: 0.04,
          },
        },
      }}
      className="flex items-center flex-wrap leading-none"
    >
      {words.map((word, i) => {
        if (/^\s+$/.test(word)) {
          return <span key={i} className="inline-block w-1" />;
        }
        return (
          <motion.span
            key={i}
            variants={{
              hidden: {
                opacity: 0,
                y: 14,
                filter: 'blur(8px)',
              },
              visible: {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                transition: {
                  duration: 1.0,
                  ease: [0.22, 1, 0.36, 1],
                },
              },
            }}
            className="inline-block select-none"
          >
            <span className="shimmer-text text-[15px] font-medium leading-none select-none">
              {word}
            </span>
          </motion.span>
        );
      })}
    </motion.div>
  );
});

const MIN_STATE_DISPLAY_MS = 2800; // Guaranteed 2.8s per state

const ThinkingAnimation = ({ status = 'Thinking...' }) => {
  const incomingStatus = (!status || /connecting to ai/i.test(status)) ? 'Thinking...' : status;
  const [displayStatus, setDisplayStatus] = useState(incomingStatus);
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const isPacingRef = useRef(false);

  useEffect(() => {
    if (!incomingStatus) return;

    // Deduplicate against currently displayed or last queued status
    const lastInQueue = queueRef.current[queueRef.current.length - 1];
    if (incomingStatus !== displayStatus && incomingStatus !== lastInQueue) {
      queueRef.current.push(incomingStatus);
      // Keep queue concise (max 2 pending states) so it never lags indefinitely
      if (queueRef.current.length > 2) {
        queueRef.current = [queueRef.current[queueRef.current.length - 1]];
      }
    }

    const drainQueue = () => {
      if (queueRef.current.length === 0) {
        isPacingRef.current = false;
        return;
      }
      isPacingRef.current = true;
      const next = queueRef.current.shift();
      setDisplayStatus(next);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        drainQueue();
      }, MIN_STATE_DISPLAY_MS);
    };

    if (!isPacingRef.current && queueRef.current.length > 0) {
      drainQueue();
    }
  }, [incomingStatus, displayStatus]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="flex items-center text-[var(--text-secondary)] font-medium py-1 min-h-[28px]">
      <ThinkingSparkle />
      <div className="overflow-visible flex items-center py-0.5">
        <AnimatePresence mode="wait">
          <StatusScrollReveal key={displayStatus} text={displayStatus} />
        </AnimatePresence>
      </div>
    </div>
  );
};

const ChatMessageItem = React.memo(({ msg, isLatest, isStreaming }) => {
  const isLatestStreaming = isStreaming && isLatest;

  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end group/msg">
        <div className="bg-gray-100 dark:bg-[#202020] text-gray-800 dark:text-gray-200 text-[15px] px-5 py-3 rounded-[20px] max-w-[85%] leading-relaxed shadow-sm">
          <MarkdownRenderer content={msg.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start group/msg">
      <div className="bg-transparent text-gray-800 dark:text-gray-200 text-[14px] py-1 max-w-[100%] leading-relaxed w-full">
        {msg.content === '' && isLatestStreaming ? (
          <ThinkingAnimation status={msg.status || 'Thinking...'} />
        ) : (
          <div className="markdown-content text-[14px] leading-relaxed">
            <MarkdownRenderer content={msg.content} />
          </div>
        )}
        {msg.sources && msg.sources.length > 0 && !(msg.content === '' && isLatestStreaming) && (
          <SourcesPill sources={msg.sources} align="side" />
        )}
        {msg.content && !(msg.content === '' && isLatestStreaming) && (
          <MessageActions
            content={msg.content}
            timestamp={msg.createdAt || msg.timestamp}
            isLatest={isLatest}
          />
        )}
      </div>
    </div>
  );
});

const RightPanelMessageItem = React.memo(({ msg, isLatest, isStreaming }) => {
  const isLatestStreaming = isStreaming && isLatest;

  if (msg.role === 'user') {
    return (
      <div className="message-row user group/msg">
        <div className="message-bubble-user">
          <MarkdownRenderer content={msg.content} />
        </div>
      </div>
    );
  }

  return (
    <div className="message-row assistant group/msg">
      <div className="message-bubble-assistant">
        <div className="markdown-content">
          {msg.content === '' && isLatestStreaming ? (
            <ThinkingAnimation status={msg.status || 'Thinking...'} />
          ) : (
            <MarkdownRenderer content={msg.content} />
          )}
        </div>
        {msg.sources && msg.sources.length > 0 && !(msg.content === '' && isLatestStreaming) && (
          <SourcesPill sources={msg.sources} align="side" />
        )}
        {msg.content && !(msg.content === '' && isLatestStreaming) && (
          <MessageActions
            content={msg.content}
            timestamp={msg.createdAt || msg.timestamp}
            isLatest={isLatest}
          />
        )}
      </div>
    </div>
  );
});

const ChatComposer = ({ textareaRef, query, setQuery, handleKeyDown, handleSend, isStreaming }) => {
  const { isThinking, setIsThinking, selectedModel, setSelectedModel, stopGeneration, chatError, clearChatError, retryLastMessage } = useContext(ChatContext);
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
    { value: 'meta/llama-3.2-11b-vision-instruct', label: 'Llama 3.2 11B', icon: <Brain03Icon className="w-[18px] h-[18px]" /> },
    { value: 'nvidia/nemotron-3-super-120b-a12b', label: 'NVIDIA Nemotron 120B', icon: <ClaudeIcon className="w-[18px] h-[18px]" /> },
  ];

  const activeModel = models.find(m => m.value === selectedModel) || models[0];

  return (
    <div className="w-full">
      <AnimatePresence>
        {chatError && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="flex items-center justify-between mb-2 px-3.5 py-2 rounded-[16px] bg-[var(--sources-card-bg)] border border-[var(--border)] shadow-[0_4px_16px_rgba(0,0,0,0.06)] text-[13.5px] backdrop-blur-md"
          >
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="truncate font-medium text-[var(--composer-text)]">
                {chatError.message || "Failed to generate response"}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={retryLastMessage}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 stroke-[2.2]" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={clearChatError}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
  }, [messages.length, greetings.length]);

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
        const container = chatScrollRef.current;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
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
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400 transition-colors"
              title="New Chat"
            >
              <Add01Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/dashboard/chat')}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md text-gray-500 dark:text-gray-400 transition-colors"
              title="Expand Chat"
            >
              <ArrowExpand01Icon className="w-4 h-4" />
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
              <ChatMessageItem
                key={msg.id || msg._id || `${msg.role}-${msg.createdAt || msg.timestamp || idx}`}
                msg={msg}
                isLatest={idx === messages.length - 1}
                isStreaming={isStreaming}
              />
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
            className="pointer-events-auto relative z-10 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors p-1"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
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
              <Add01Icon className="w-5 h-5" />
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
                  <RightPanelMessageItem
                    key={msg.id || msg._id || `${msg.role}-${msg.createdAt || msg.timestamp || idx}`}
                    msg={msg}
                    isLatest={idx === messages.length - 1}
                    isStreaming={isStreaming}
                  />
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
                    onClick={() => src.pageId && handleOpenDoc(src.pageId)}
                    className={`flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-[var(--color-dark-border)] hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-sm transition-all bg-gray-50/50 dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#202020] ${src.pageId ? 'cursor-pointer' : ''}`}
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
    </div>
  );
};

export default AIChat;