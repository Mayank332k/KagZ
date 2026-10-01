import React, { useState, useRef, useEffect, useContext, useLayoutEffect, useMemo } from 'react';
import { Loading03Icon } from "hugeicons-react";
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
                        <span className="material-symbols-outlined text-[14px] leading-none select-none text-gray-500 dark:text-gray-400 shrink-0">book</span>
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
           const event = new CustomEvent("optimistic-add-page", { detail: { ...newPage, type: 'page', path: `/dashboard/page/${newPage._id}` } });
           window.dispatchEvent(event);
           navigate(`/dashboard/page/${newPage._id}`);
        }
      } catch (err) {
        console.error('Failed to create page:', err);
      }
    }
  };

  const formattedTime = (() => {
    if (!timestamp) return "";
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return "";
    }
  })();

  return (
    <div className={`flex items-center gap-1.5 mt-2 select-none transition-opacity duration-200 ${isLatest ? 'opacity-100' : 'opacity-0 group-hover/msg:opacity-100'}`}>
      {/* Copy */}
      <button
        onClick={handleCopy}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
        title={copied ? "Copied!" : "Copy"}
        aria-label="Copy"
      >
        <span className={`material-symbols-outlined text-[15px] leading-none select-none ${copied ? 'text-green-500' : ''}`}>
          {copied ? 'check' : 'content_copy'}
        </span>
      </button>

      {/* Add to page */}
      <button
        onClick={handleAdd}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
        title={isPageOpen ? 'Add to current page' : 'Create new page with this note'}
        aria-label="Add to page"
      >
        <span className="material-symbols-outlined text-[17px] leading-none select-none">
          add
        </span>
      </button>

      {/* Timestamp */}
      {formattedTime && (
        <span className="text-[12px] text-gray-400 dark:text-[#7d7a75] font-normal tracking-tight ml-1 select-none">
          {formattedTime}
        </span>
      )}
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
        filter: 'blur(4px)',
        transition: { duration: 0.25, ease: 'easeInOut' },
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
                filter: 'blur(4px)',
              },
              visible: {
                opacity: 1,
                filter: 'blur(0px)',
                transition: {
                  duration: 0.6,
                  ease: 'easeOut',
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

const UserMessageActions = ({ content, timestamp }) => {
  const { setQuery } = useContext(ChatContext);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const formattedTime = (() => {
    if (!timestamp) return "";
    try {
      const d = new Date(timestamp);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return "";
    }
  })();

  return (
    <div className="flex items-center gap-1 mt-1 px-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 select-none">
      {formattedTime && (
        <span className="text-[11px] font-sans text-gray-400 dark:text-neutral-500 mr-0.5">
          {formattedTime}
        </span>
      )}
      <button
        type="button"
        onClick={() => setQuery(content)}
        className="p-1 rounded-[5px] text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
        title="Edit message"
        aria-label="Edit message"
      >
        <span className="material-symbols-outlined text-[14px] leading-none select-none">edit</span>
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 rounded-[5px] text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
        title={copied ? "Copied!" : "Copy"}
        aria-label="Copy message"
      >
        <span className="material-symbols-outlined text-[14px] leading-none select-none">
          {copied ? "check" : "content_copy"}
        </span>
      </button>
    </div>
  );
};

const ChatMessageItem = React.memo(({ msg, isLatest, isStreaming }) => {
  const isLatestStreaming = isStreaming && isLatest;

  if (msg.role === 'user') {
    return (
      <div className="flex flex-col items-end group/msg">
        <div className="bg-gray-100 dark:bg-[#202020] text-gray-800 dark:text-gray-200 text-[14.5px] px-4 py-2 rounded-[14px] max-w-[85%] leading-normal shadow-sm [&_p]:mb-0">
          {msg.pageContext?.title && (
            <div className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-[6px] bg-black/5 dark:bg-white/10 text-[11.5px] font-medium text-gray-600 dark:text-gray-300 select-none">
              <span className="material-symbols-outlined text-[13px] leading-none text-current">description</span>
              <span className="truncate max-w-[200px]">{msg.pageContext.title}</span>
            </div>
          )}
          <MarkdownRenderer content={msg.content} />
        </div>
        <UserMessageActions content={msg.content} timestamp={msg.createdAt || msg.timestamp} />
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
      <div className="message-row user group/msg flex flex-col items-end">
        <div className="message-bubble-user">
          {msg.pageContext?.title && (
            <div className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-[6px] bg-black/5 dark:bg-white/10 text-[11.5px] font-medium text-gray-600 dark:text-gray-300 select-none">
              <span className="material-symbols-outlined text-[13px] leading-none text-current">description</span>
              <span className="truncate max-w-[200px]">{msg.pageContext.title}</span>
            </div>
          )}
          <MarkdownRenderer content={msg.content} />
        </div>
        <UserMessageActions content={msg.content} timestamp={msg.createdAt || msg.timestamp} />
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
  const { activePage } = useContext(EditorContext);
  const [attachedPage, setAttachedPage] = useState(null);
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

  // Auto-add the open page into textarea context
  useEffect(() => {
    if (activePage && activePage.id) {
      setAttachedPage(activePage);
    } else {
      setAttachedPage(null);
    }
  }, [activePage?.id]);

  // Keep attached page in sync with live title/content updates in NoteEditor
  useEffect(() => {
    if (attachedPage && activePage && attachedPage.id === activePage.id) {
      setAttachedPage(activePage);
    }
  }, [activePage?.title, activePage?.content]);

  const onFormSubmit = (e) => {
    if (e) e.preventDefault();
    if (!query.trim() || isStreaming) return;
    handleSend(attachedPage);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onFormSubmit(e);
    } else if (handleKeyDown) {
      handleKeyDown(e);
    }
  };

  const models = [
    { 
      value: 'meta/llama-3.2-11b-vision-instruct', 
      label: 'kagZ lite',
      subtitle: 'Fastest answers',
    },
    { 
      value: 'nvidia/nemotron-3-super-120b-a12b', 
      label: 'kagZ pro',
      subtitle: 'Advanced reasoning',
      badge: 'New',
    },
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
              <span className="material-symbols-outlined text-[16px] leading-none select-none text-red-500 shrink-0">error</span>
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
                <span className="material-symbols-outlined text-[14px] leading-none select-none">refresh</span>
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={clearChatError}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <span className="material-symbols-outlined text-[14px] leading-none select-none">close</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={onFormSubmit} className="flex flex-col bg-[var(--composer-bg)] border border-[var(--border)] rounded-[21px] shadow-[0_2px_12px_rgb(0,0,0,0.04)] focus-within:shadow-[0_4px_20px_rgb(0,0,0,0.08)] transition-all duration-300 p-2.5 mx-auto">
        {/* Minimal Context Pill inside textarea container */}
        {attachedPage && (
          <div className="flex items-center px-2 pt-0.5 pb-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[7px] bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-[11.5px] text-gray-700 dark:text-gray-300 font-medium select-none">
              <span className="material-symbols-outlined text-[13px] leading-none text-gray-400 dark:text-gray-400">
                description
              </span>
              <span className="max-w-[180px] truncate leading-none">
                {attachedPage.title || "Untitled"}
              </span>
              <button
                type="button"
                onClick={() => setAttachedPage(null)}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                title="Remove page context"
                aria-label="Remove page context"
              >
                <span className="material-symbols-outlined text-[11px] leading-none">close</span>
              </button>
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            attachedPage
              ? `Ask anything about "${attachedPage.title || 'this page'}"...`
              : "Search anything across your workspace..."
          }
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
              <span className={`material-symbols-outlined leading-none select-none ${isThinking ? "text-[18px]" : "text-[22px]"}`}>psychology</span>
              {isThinking && <span>Thinking</span>}
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
              >
                <span>{activeModel.label}</span>
                <span className={`material-symbols-outlined text-[14px] leading-none select-none text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_less</span>
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 mb-2 w-[240px] bg-white dark:bg-[#191919] border border-gray-200 dark:border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] z-50 overflow-hidden rounded-[24px] p-2"
                  >
                    <div className="flex flex-col gap-0.5">
                      {models.map((model) => {
                        const isActive = selectedModel === model.value;

                        return (
                          <button
                            key={model.value}
                            type="button"
                            onClick={() => {
                              setSelectedModel(model.value);
                              setIsDropdownOpen(false);
                            }}
                            className="flex items-start w-full px-3 py-2.5 rounded-[16px] text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.07] cursor-pointer"
                          >
                            <div className="w-4 h-4 shrink-0 flex items-center justify-center mt-0.5">
                              {isActive && (
                                <span className="material-symbols-outlined text-[16px] leading-none select-none text-gray-900 dark:text-white stroke-[2.2]">check</span>
                              )}
                            </div>
                            <div className="flex flex-col ml-3 min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[14px] font-medium text-gray-900 dark:text-white leading-snug">
                                  {model.label}
                                </span>
                                {model.badge && (
                                  <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[10.5px] font-medium text-gray-600 dark:text-gray-300">
                                    {model.badge}
                                  </span>
                                )}
                              </div>
                              <span className="text-[12px] text-gray-500 dark:text-[#9a9a9a] leading-tight mt-0.5">
                                {model.subtitle}
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      <div className="h-[1px] bg-gray-100 dark:bg-white/10 my-1 mx-2" />

                      <button
                        type="button"
                        onClick={() => setIsThinking(!isThinking)}
                        className="flex items-start w-full px-3 py-2.5 rounded-[16px] text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.07] cursor-pointer"
                      >
                        <div className="w-4 h-4 shrink-0 flex items-center justify-center mt-0.5">
                          {isThinking && (
                            <span className="material-symbols-outlined text-[16px] leading-none select-none text-gray-900 dark:text-white stroke-[2.2]">check</span>
                          )}
                        </div>
                        <div className="flex flex-col ml-3 min-w-0">
                          <span className="text-[14px] font-medium text-gray-900 dark:text-white leading-snug">
                            Extended thinking
                          </span>
                          <span className="text-[12px] text-gray-500 dark:text-[#9a9a9a] leading-tight mt-0.5">
                            Complex problem solving
                          </span>
                        </div>
                      </button>
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
                <span className="material-symbols-outlined text-[20px] leading-none select-none">arrow_upward</span>
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
    sendMessage,
    clearChat,
    setIsRightChatOpen,
    isLoadingMore,
    hasMore,
    fetchMoreMessages
  } = useContext(ChatContext);
  
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

  const handleSend = async (pageCtx = null) => {
    if (!query.trim() || isStreaming) return;
    await sendMessage(query.trim(), null, pageCtx);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="New Chat"
            >
              <span className="material-symbols-outlined text-[18px] leading-none select-none">
                chat_add_on
              </span>
            </button>
            <button
              onClick={() => navigate('/dashboard/chat')}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Expand Chat"
            >
              <span className="material-symbols-outlined text-[18px] leading-none select-none">open_in_full</span>
            </button>
            <button
              onClick={() => setIsRightChatOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Close Chat"
            >
              <span className="material-symbols-outlined text-[18px] leading-none select-none">close</span>
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
                <span className="material-symbols-outlined text-[20px] leading-none select-none">arrow_downward</span>
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
        <div className="chat-header relative flex justify-between items-center p-4 z-50 pointer-events-none">
          <button 
            onClick={() => navigate(-1)}
            className="pointer-events-auto relative z-10 flex items-center justify-center w-8 h-8 rounded-[8px] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Go back"
          >
            <span className="material-symbols-outlined text-[20px] leading-none select-none text-current">keyboard_backspace</span>
          </button>
          
          <div className="flex items-center gap-1 pointer-events-auto">
            <button 
              onClick={clearChat}
              className="relative z-10 flex items-center justify-center w-8 h-8 rounded-[8px] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="New Chat"
            >
              <span className="material-symbols-outlined text-[20px] leading-none select-none">
                chat_add_on
              </span>
            </button>

            <button 
              onClick={() => {
                setIsRightChatOpen(true);
                navigate('/dashboard');
              }}
              className="relative z-10 flex items-center justify-center w-8 h-8 rounded-[8px] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Open in Sidebar"
            >
              <span className="material-symbols-outlined text-[20px] leading-none select-none">
                view_sidebar
              </span>
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
                      <span className="material-symbols-outlined text-[20px] leading-none select-none">arrow_downward</span>
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
    </div>
  );
};

export default AIChat;