import React, { useState, useRef, useEffect, useContext, useLayoutEffect, useMemo } from 'react';
import { Loading03Icon } from "hugeicons-react";
import { HugeiconsIcon } from '@hugeicons/react';
import { Edit03Icon, Copy01Icon, File02Icon, Cancel01Icon, Brain03Icon, ChatAdd01Icon, ExpandIcon, SidebarRightIcon } from '@hugeicons/core-free-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChatContext } from '../../context/ChatContextDefinition';
import { EditorContext } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import MarkdownRenderer from '../UI/MarkdownRenderer';
import ThinkingOrb from './ThinkingOrb';
import InteractiveChoiceCard from './InteractiveChoiceCard';
import DeepResearchCard from './DeepResearchCard';
import ToolMentionMenu, { AVAILABLE_TOOLS } from './ToolMentionMenu';
import MemoryUpdateIcon from './MemoryUpdateIcon';
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
        className="sources-peanut-btn group inline-flex items-center gap-2 h-[30px] px-3.5 rounded-full bg-[var(--sources-pill-bg)] hover:bg-[var(--sources-pill-hover)] transition-colors focus:outline-none"
        title="View sources"
      >
        <span className="text-[13px] font-medium text-[var(--sources-pill-text)] group-hover:text-black dark:group-hover:text-white transition-colors truncate max-w-[180px]">
          {primaryLabel}
        </span>
        {extraCount > 0 && (
          <span className="text-[12px] font-semibold text-[var(--sources-pill-count)] group-hover:text-black dark:group-hover:text-white transition-colors">
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
  const { isPageOpen, appendContent, workspaceTree, triggerSidebarRefresh, activePage } = useContext(EditorContext);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showAddMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAddMenu]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleAddToCurrentPage = () => {
    appendContent(content);
    const targetTitle = activePage?.title && activePage.title !== 'Untitled' ? activePage.title : 'Current page';
    showToast(`Added to "${targetTitle}"`, 'success');
  };

  const handleCreateNewPage = async () => {
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
        showToast(`Created new page: "${title}"`, 'success');
        navigate(`/dashboard/page/${newPage._id}`);
      }
    } catch (err) {
      console.error('Failed to create page:', err);
      showToast('Failed to create page', 'error');
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
        {copied ? (
          <span className="material-symbols-outlined text-[13px] leading-none select-none text-green-500">
            check
          </span>
        ) : (
          <HugeiconsIcon icon={Copy01Icon} size={14.5} className="select-none" />
        )}
      </button>

      {/* Add to page / Options popup */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => {
            if (isPageOpen) {
              setShowAddMenu((prev) => !prev);
            } else {
              handleCreateNewPage();
            }
          }}
          className={`w-6.5 h-6.5 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer ${showAddMenu ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white' : ''}`}
          title={isPageOpen ? 'Add options' : 'Create new page with this note'}
          aria-label="Add to page"
        >
          <span className="material-symbols-outlined text-[16px] leading-none select-none">
            add
          </span>
        </button>

        <AnimatePresence>
          {showAddMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.14 }}
              className="absolute left-0 bottom-full mb-1.5 z-50 min-w-[220px] py-1 px-1 rounded-[12px] bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-[#2C2C2C] shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.5)] flex flex-col gap-0.5 text-[13px]"
            >
              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  handleAddToCurrentPage();
                }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] hover:bg-black/5 dark:hover:bg-white/10 text-gray-800 dark:text-[#E5E5E5] transition-colors text-left cursor-pointer group"
              >
                <span className="material-symbols-outlined text-[18px] text-gray-400 dark:text-neutral-400 group-hover:text-gray-700 dark:group-hover:text-white leading-none shrink-0">
                  post_add
                </span>
                <span className="truncate flex-1">
                  Add to <strong className="font-medium text-gray-950 dark:text-white">{activePage?.title && activePage.title !== 'Untitled' ? activePage.title : 'Current page'}</strong>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  handleCreateNewPage();
                }}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] hover:bg-black/5 dark:hover:bg-white/10 text-gray-800 dark:text-[#E5E5E5] transition-colors text-left cursor-pointer group"
              >
                <span className="material-symbols-outlined text-[18px] text-gray-400 dark:text-neutral-400 group-hover:text-gray-700 dark:group-hover:text-white leading-none shrink-0">
                  note_add
                </span>
                <span className="truncate flex-1">
                  Create new page
                </span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timestamp */}
      {formattedTime && (
        <span className="text-[12px] text-gray-400 dark:text-[#7d7a75] font-normal tracking-tight ml-1 select-none">
          {formattedTime}
        </span>
      )}
    </div>
  );
};

const StatusScrollReveal = React.memo(({ text }) => {
  return (
    <motion.div
      key={text}
      initial={{ opacity: 0, y: 3, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{
        opacity: 0,
        y: -3,
        filter: 'blur(3px)',
        transition: { duration: 0.2, ease: 'easeIn' },
      }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center select-none py-0.5"
    >
      <span className="shimmer-sentence text-[16px] font-medium leading-none tracking-tight select-none">
        {text}
      </span>
    </motion.div>
  );
});

const MIN_STATE_DISPLAY_MS = 2800; // Guaranteed 2.8s per state

const resolveStateType = (type, text) => {
  if (type === 'web_search' || type === 'workspace_search' || type === 'reconnecting' || type === 'task_management' || type === 'manage_tasks' || type === 'remembering' || type === 'memory') {
    return type === 'manage_tasks' ? 'task_management' : type;
  }
  if (!text) return 'thinking';
  const lower = text.toLowerCase();
  if (lower.includes('remember') || lower.includes('memory') || lower.includes('yaad')) {
    return 'remembering';
  }
  if (lower.includes('reconnect') || lower.includes('trying to reconnect') || lower.includes('wifi')) {
    return 'reconnecting';
  }
  if (lower.includes('task') || lower.includes('fetching your task') || lower.includes('creating task') || lower.includes('updating task') || lower.includes('deleting task') || lower.includes('managing task') || lower.includes('kanban')) {
    return 'task_management';
  }
  if (lower.includes('file') || lower.includes('workspace') || lower.includes('note') || lower.includes('document')) {
    return 'workspace_search';
  }
  if (lower.includes('web') || lower.includes('google') || lower.includes('internet') || lower.includes('search')) {
    return 'web_search';
  }
  return 'thinking';
};

const ThinkingAnimation = ({ status, stateType = 'thinking' }) => {
  const incomingStatus = status || null;
  const currentType = resolveStateType(stateType, incomingStatus);

  const [activeItem, setActiveItem] = useState({
    status: incomingStatus,
    stateType: currentType,
  });
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const isPacingRef = useRef(false);

  useEffect(() => {
    if (!incomingStatus) return;

    const drainQueue = () => {
      if (queueRef.current.length === 0) {
        isPacingRef.current = false;
        return;
      }
      isPacingRef.current = true;
      const next = queueRef.current.shift();
      setActiveItem(next);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        drainQueue();
      }, MIN_STATE_DISPLAY_MS);
    };

    // High priority: if reconnecting, immediately show WiFi animation without queue delay
    if (currentType === 'reconnecting') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      queueRef.current = [];
      isPacingRef.current = false;
      setActiveItem({ status: incomingStatus, stateType: 'reconnecting' });
      return;
    }

    // High priority: if remembering / memory, immediately show without queue delay and hold dwell time
    if (currentType === 'remembering' || currentType === 'memory') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      queueRef.current = [];
      isPacingRef.current = true;
      setActiveItem({ status: incomingStatus, stateType: currentType });
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        drainQueue();
      }, MIN_STATE_DISPLAY_MS);
      return;
    }

    // Deduplicate against currently displayed or last queued status
    const lastInQueue = queueRef.current[queueRef.current.length - 1];
    if (incomingStatus !== activeItem.status && (!lastInQueue || lastInQueue.status !== incomingStatus)) {
      queueRef.current.push({ status: incomingStatus, stateType: currentType });
      // Keep queue concise (max 2 pending states) so it never lags indefinitely
      if (queueRef.current.length > 2) {
        queueRef.current = [queueRef.current[queueRef.current.length - 1]];
      }
    }

    if (!isPacingRef.current && queueRef.current.length > 0) {
      drainQueue();
    }
  }, [incomingStatus, currentType, activeItem.status]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const hasStatus = Boolean(activeItem.status);
  const activeStateType = activeItem.status ? activeItem.stateType : currentType;
  const isMemoryState = activeStateType === 'remembering' || activeStateType === 'memory';

  return (
    <div className="flex items-center text-[var(--text-secondary)] font-medium py-0.5 min-h-[30px]">
      <motion.div
        animate={{ x: hasStatus ? 0 : 4 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="flex items-center shrink-0"
      >
        {isMemoryState ? (
          <div className="w-6 h-6 flex items-center justify-center">
            <MemoryUpdateIcon isUpdating={true} showText={false} size={20} />
          </div>
        ) : (
          <ThinkingOrb size={26} stateType={activeStateType} />
        )}
      </motion.div>
      <AnimatePresence>
        {hasStatus && (
          <motion.div
            initial={{ opacity: 0, x: 4, filter: 'blur(3px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: -4, filter: 'blur(3px)' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-visible flex items-center py-0.5 ml-1"
          >
            <AnimatePresence mode="wait">
              <StatusScrollReveal key={activeItem.status} text={activeItem.status} />
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
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
        <HugeiconsIcon icon={Edit03Icon} size={14} className="select-none" />
      </button>
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 rounded-[5px] text-gray-400 hover:text-gray-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center"
        title={copied ? "Copied!" : "Copy"}
        aria-label="Copy message"
      >
        {copied ? (
          <span className="material-symbols-outlined text-[12.5px] leading-none select-none text-green-500">
            check
          </span>
        ) : (
          <HugeiconsIcon icon={Copy01Icon} size={14} className="select-none" />
        )}
      </button>
    </div>
  );
};

const parseUserToolMessage = (content) => {
  if (!content || typeof content !== 'string') {
    return { tool: null, cleanContent: content || '' };
  }

  // 1. Check Deep Research
  const researchMatch = content.match(/^(?:@research\b|(?:Research deeply|Deep research):)\s*/i);
  if (researchMatch) {
    const researchTool = AVAILABLE_TOOLS.find((t) => t.id === 'research');
    return {
      tool: researchTool,
      cleanContent: content.slice(researchMatch[0].length),
    };
  }

  // 2. Check Web Search
  const webMatch = content.match(/^(?:@web\b|(?:Search web|Web search):)\s*/i);
  if (webMatch) {
    const webTool = AVAILABLE_TOOLS.find((t) => t.id === 'web');
    return {
      tool: webTool,
      cleanContent: content.slice(webMatch[0].length),
    };
  }

  // 3. Check Workspace Search
  const workspaceMatch = content.match(/^(?:@workspace\b|(?:Search workspace|Workspace search):)\s*/i);
  if (workspaceMatch) {
    const workspaceTool = AVAILABLE_TOOLS.find((t) => t.id === 'workspace');
    return {
      tool: workspaceTool,
      cleanContent: content.slice(workspaceMatch[0].length),
    };
  }

  return { tool: null, cleanContent: content };
};

const ChatMessageItem = React.memo(({ msg, isLatest, isStreaming }) => {
  const isLatestStreaming = isStreaming && isLatest;
  const { stopGeneration } = useContext(ChatContext);

  if (msg.role === 'user') {
    const { tool, cleanContent } = parseUserToolMessage(msg.content);

    return (
      <div className="flex flex-col items-end group/msg">
        <div className="bg-gray-100 dark:bg-[#202020] text-gray-800 dark:text-gray-200 text-[13px] px-3.5 py-1.5 rounded-[13px] max-w-[85%] leading-normal shadow-sm [&_p]:mb-0">
          {msg.pageContext?.title && (
            <div className="inline-flex items-center gap-1.5 mb-1 px-2.5 py-0.5 rounded-[6px] bg-black/5 dark:bg-white/10 text-[12px] font-medium text-gray-600 dark:text-gray-300 select-none">
              <span className="material-symbols-outlined text-[14px] leading-none text-current">description</span>
              <span className="truncate max-w-[220px]">{msg.pageContext.title}</span>
            </div>
          )}
          {tool ? (
            <div className="flex flex-wrap items-baseline gap-x-1.5 [&_p]:inline [&_p]:mb-0">
              <span
                className="inline-flex items-center gap-1 font-medium select-none shrink-0"
                style={{ color: tool.iconColor || '#007AFF' }}
              >
                {tool.icon && (
                  <HugeiconsIcon icon={tool.icon} size={14} strokeWidth={2} className="shrink-0" />
                )}
                <span>{tool.label}</span>
              </span>
              <MarkdownRenderer content={cleanContent} />
            </div>
          ) : (
            <MarkdownRenderer content={msg.content} />
          )}
        </div>
        <UserMessageActions content={cleanContent || msg.content} timestamp={msg.createdAt || msg.timestamp} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start group/msg w-full">
      <div className="bg-transparent text-gray-800 dark:text-gray-200 text-[15px] py-0.5 max-w-[100%] leading-relaxed w-full min-w-0">
        {/* Deep Research Area on Canvas */}
        {msg.researchData && (
          <DeepResearchCard
            researchData={msg.researchData}
            isStreaming={isLatestStreaming}
            onStop={stopGeneration}
          />
        )}

        {/* Memory Updated Event Pill */}
        {msg.memoryFact && (
          <div className="flex items-center mb-2.5 pt-0.5">
            <MemoryUpdateIcon
              isCompleted={true}
              animate={Boolean(isLatestStreaming || msg.isNewMemory)}
              tooltip={`Memory updated: ${msg.memoryFact}`}
              size={18}
            />
          </div>
        )}

        {msg.content === '' && isLatestStreaming && !msg.researchData ? (
          <ThinkingAnimation status={msg.status} stateType={msg.stateType} />
        ) : (
          msg.content && (
            <div className="markdown-content text-[15px] leading-relaxed">
              <MarkdownRenderer content={msg.content} isStreaming={isLatestStreaming} />
            </div>
          )
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
  const { stopGeneration } = useContext(ChatContext);

  if (msg.role === 'user') {
    const { tool, cleanContent } = parseUserToolMessage(msg.content);

    return (
      <div className="message-row user group/msg flex flex-col items-end">
        <div className="message-bubble-user">
          {msg.pageContext?.title && (
            <div className="inline-flex items-center gap-1.5 mb-1 px-2.5 py-0.5 rounded-[6px] bg-black/5 dark:bg-white/10 text-[12px] font-medium text-gray-600 dark:text-gray-300 select-none">
              <span className="material-symbols-outlined text-[14px] leading-none text-current">description</span>
              <span className="truncate max-w-[220px]">{msg.pageContext.title}</span>
            </div>
          )}
          {tool ? (
            <div className="flex flex-wrap items-baseline gap-x-1.5 [&_p]:inline [&_p]:mb-0">
              <span
                className="inline-flex items-center gap-1 font-medium select-none shrink-0"
                style={{ color: tool.iconColor || '#007AFF' }}
              >
                {tool.icon && (
                  <HugeiconsIcon icon={tool.icon} size={14} strokeWidth={2} className="shrink-0" />
                )}
                <span>{tool.label}</span>
              </span>
              <MarkdownRenderer content={cleanContent} />
            </div>
          ) : (
            <MarkdownRenderer content={msg.content} />
          )}
        </div>
        <UserMessageActions content={cleanContent || msg.content} timestamp={msg.createdAt || msg.timestamp} />
      </div>
    );
  }

  return (
    <div className="message-row assistant group/msg w-full">
      <div className="message-bubble-assistant w-full min-w-0">
        {/* Deep Research Area on Canvas */}
        {msg.researchData && (
          <DeepResearchCard
            researchData={msg.researchData}
            isStreaming={isLatestStreaming}
            onStop={stopGeneration}
          />
        )}

        {/* Memory Updated Event Pill */}
        {msg.memoryFact && (
          <div className="flex items-center mb-2.5 pt-0.5">
            <MemoryUpdateIcon
              isCompleted={true}
              animate={Boolean(isLatestStreaming || msg.isNewMemory)}
              tooltip={`Memory updated: ${msg.memoryFact}`}
              size={18}
            />
          </div>
        )}

        <div className="markdown-content">
          {msg.content === '' && isLatestStreaming && !msg.researchData ? (
            <ThinkingAnimation status={msg.status} stateType={msg.stateType} />
          ) : (
            msg.content && <MarkdownRenderer content={msg.content} isStreaming={isLatestStreaming} />
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

const parseInteractiveChoice = (content) => {
  if (!content || typeof content !== 'string') return null;

  const tryParseJson = (str) => {
    try {
      let clean = str.trim();
      if (clean.startsWith('```')) {
        clean = clean.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
      }
      const data = JSON.parse(clean);
      if (data && (data.question || data.prompt) && Array.isArray(data.options) && data.options.length > 0) {
        const normalizedOptions = data.options.map((opt) => {
          if (typeof opt === 'string') {
            return { title: opt, description: '' };
          }
          return {
            title: opt.title || opt.text || opt.label || '',
            description: opt.description || opt.desc || opt.subtitle || '',
          };
        }).filter((opt) => opt.title);

        if (normalizedOptions.length > 0) {
          return {
            question: data.question || data.prompt,
            options: normalizedOptions,
          };
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return null;
  };

  // 1. Tag format: <interactive_choice>...</interactive_choice>
  const tagMatch = content.match(/<interactive_choice>([\s\S]*?)<\/interactive_choice>/i);
  if (tagMatch) {
    const result = tryParseJson(tagMatch[1]);
    if (result) return result;
  }

  // 2. Code block format: ```interactive-choice ... ``` or ```interactive_choice ... ```
  const codeBlockMatch = content.match(/```(?:interactive-choice|interactive_choice)\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    const result = tryParseJson(codeBlockMatch[1]);
    if (result) return result;
  }

  // 3. Fallback: Auto-detect delete confirmation
  const isDeleteConfirmation = /(delete\s+(?:karna\s+chahte|kardun|karu|karein|karoon|this|these|task)|sure\s+you\s+want\s+to\s+delete|confirm\s+deletion)/i.test(content);
  if (isDeleteConfirmation && content.length < 350) {
    return {
      question: content.trim(),
      options: [
        { title: 'Yes, delete', description: 'Confirm and proceed with deletion' },
        { title: 'Cancel', description: 'Keep task and cancel deletion' },
      ],
    };
  }

  return null;
};

const PROMPT_SUGGESTIONS = [
  {
    placeholder: "Try @ for tools",
    tabValue: "@",
  },
  {
    placeholder: "Try asking what's going on in my workspace",
    tabValue: "What's going on in my workspace?",
  },
  {
    placeholder: "Try asking to summarize my recent notes",
    tabValue: "Summarize my recent notes",
  },
  {
    placeholder: "Try asking to find notes about...",
    tabValue: "Find notes about ",
  },
  {
    placeholder: "Try asking what should I focus on today",
    tabValue: "What should I focus on today?",
  },
];

const ChatComposer = ({
  textareaRef,
  query,
  setQuery,
  handleKeyDown,
  handleSend,
  isStreaming,
  dismissedChoiceId,
  setDismissedChoiceId,
  isRightPanel = false,
}) => {
  const {
    messages = [],
    isThinking,
    setIsThinking,
    selectedModel,
    setSelectedModel,
    stopGeneration,
    chatError,
    clearChatError,
    retryLastMessage,
  } = useContext(ChatContext);
  const { activePage } = useContext(EditorContext);
  const [attachedPage, setAttachedPage] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Advanced Tools (@ Mention) State
  const [activeTool, setActiveTool] = useState(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [choiceSelectedIndex, setChoiceSelectedIndex] = useState(0);

  // Rotating prompt suggestions for empty query
  const activeSuggestions = useMemo(() => {
    if (attachedPage) {
      const pageTitle = attachedPage.title && attachedPage.title !== "Untitled" ? attachedPage.title : "this note";
      return [
        {
          placeholder: `Try asking to summarize "${pageTitle}"`,
          tabValue: `Summarize "${pageTitle}"`,
        },
        {
          placeholder: `Try asking key takeaways from ${pageTitle}`,
          tabValue: `What are the key takeaways from ${pageTitle}?`,
        },
        {
          placeholder: "Try @ for tools",
          tabValue: "@",
        },
      ];
    }
    return PROMPT_SUGGESTIONS;
  }, [attachedPage]);

  const [suggestionIndex, setSuggestionIndex] = useState(0);

  useEffect(() => {
    if (query.trim() !== '') return;
    const interval = setInterval(() => {
      setSuggestionIndex((prev) => (prev + 1) % activeSuggestions.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [query, activeSuggestions.length]);

  const currentSuggestion = activeSuggestions[suggestionIndex % activeSuggestions.length];

  // Derive active choice prompt from last message if it's from assistant and streaming is done
  const activeChoicePrompt = useMemo(() => {
    if (isStreaming || !messages || messages.length === 0) return null;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return null;

    const parsed = parseInteractiveChoice(lastMsg.content);
    if (!parsed) return null;

    const promptId = lastMsg.id || lastMsg._id || `${lastMsg.createdAt || lastMsg.timestamp || (messages.length - 1)}`;
    if (dismissedChoiceId === promptId) return null;

    return {
      id: promptId,
      ...parsed,
    };
  }, [messages, isStreaming, dismissedChoiceId]);

  const handleSelectChoice = (chosenAnswer) => {
    if (activeChoicePrompt?.id && setDismissedChoiceId) {
      setDismissedChoiceId(activeChoicePrompt.id);
    }
    let payload = chosenAnswer;
    if (
      activeChoicePrompt?.question &&
      /delete/i.test(activeChoicePrompt.question) &&
      !/^delete/i.test(chosenAnswer) &&
      !/^(yes|no|cancel|skip)/i.test(chosenAnswer)
    ) {
      payload = `Delete task: ${chosenAnswer}`;
    }
    handleSend(attachedPage, payload);
  };

  const handleSkipChoice = () => {
    if (activeChoicePrompt?.id && setDismissedChoiceId) {
      setDismissedChoiceId(activeChoicePrompt.id);
    }
  };

  useEffect(() => {
    setChoiceSelectedIndex(0);
  }, [activeChoicePrompt?.id]);

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
    if (activeChoicePrompt?.id && setDismissedChoiceId) {
      setDismissedChoiceId(activeChoicePrompt.id);
    }

    let finalQuery = query.trim();
    if (activeTool?.id === 'research') {
      finalQuery = `@research ${finalQuery}`;
    } else if (activeTool?.id === 'web') {
      finalQuery = `@web ${finalQuery}`;
    } else if (activeTool?.id === 'workspace') {
      finalQuery = `@workspace ${finalQuery}`;
    }

    handleSend(attachedPage, finalQuery);
    setActiveTool(null);
  };

  const onKeyDown = (e) => {
    if (isMentionOpen) {
      const filtered = AVAILABLE_TOOLS.filter((tool) => {
        if (!mentionFilter) return true;
        const clean = mentionFilter.toLowerCase().replace(/^@/, '');
        return (
          tool.id.toLowerCase().includes(clean) ||
          tool.label.toLowerCase().includes(clean) ||
          tool.tag.toLowerCase().includes(clean)
        );
      });

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && filtered.length > 0) {
        e.preventDefault();
        const chosen = filtered[mentionSelectedIndex] || filtered[0];
        if (chosen.id === 'thinking') {
          setIsThinking(true);
        } else {
          setActiveTool(chosen);
        }
        setIsMentionOpen(false);
        const cleaned = query.replace(/(?:^|\s)@[a-zA-Z0-9_-]*$/, '').trim();
        setQuery(cleaned);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
    }

    if (e.key === 'Backspace' && query === '' && activeTool) {
      e.preventDefault();
      setActiveTool(null);
      return;
    }

    // Tab autocompletion for suggested query when textarea is empty
    if (e.key === 'Tab' && !e.shiftKey && !query && !isMentionOpen && !activeChoicePrompt && currentSuggestion) {
      e.preventDefault();
      const insertVal = currentSuggestion.tabValue;
      setQuery(insertVal);
      if (insertVal === '@') {
        setIsMentionOpen(true);
        setMentionFilter('');
        setMentionSelectedIndex(0);
      }
      setTimeout(() => {
        if (textareaRef?.current) {
          textareaRef.current.focus();
          const len = insertVal.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 0);
      return;
    }

    // Interactive Question Navigation (1-9, Arrows, and Enter)
    if (activeChoicePrompt && Array.isArray(activeChoicePrompt.options) && activeChoicePrompt.options.length > 0) {
      const opts = activeChoicePrompt.options;

      // 1. Enter key
      if (e.key === 'Enter' && !e.shiftKey) {
        const trimmed = query.trim();
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= opts.length) {
          e.preventDefault();
          const targetOpt = opts[num - 1];
          handleSelectChoice(targetOpt.title || targetOpt.text || String(targetOpt));
          setQuery('');
          return;
        }
        if (trimmed === '') {
          e.preventDefault();
          const targetOpt = opts[choiceSelectedIndex] || opts[0];
          handleSelectChoice(targetOpt.title || targetOpt.text || String(targetOpt));
          return;
        }
        // If user typed custom text, fall through to regular form submission
      }

      // 2. Numeric hotkeys (1-9) when textarea is empty
      if (query === '' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= opts.length) {
          e.preventDefault();
          const targetOpt = opts[num - 1];
          handleSelectChoice(targetOpt.title || targetOpt.text || String(targetOpt));
          return;
        }
      }

      // 3. ArrowUp / ArrowDown navigation when textarea is empty
      if (query === '' && e.key === 'ArrowDown') {
        e.preventDefault();
        setChoiceSelectedIndex((prev) => (prev + 1) % opts.length);
        return;
      }
      if (query === '' && e.key === 'ArrowUp') {
        e.preventDefault();
        setChoiceSelectedIndex((prev) => (prev - 1 + opts.length) % opts.length);
        return;
      }
    }

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
    <div className="w-full relative">
      {/* Floating Tool Mention Menu */}
      <AnimatePresence>
        {isMentionOpen && (
          <ToolMentionMenu
            isOpen={isMentionOpen}
            selectedIndex={mentionSelectedIndex}
            filterText={mentionFilter}
            onSelect={(tool) => {
              if (tool.id === 'thinking') {
                setIsThinking(true);
              } else {
                setActiveTool(tool);
              }
              setIsMentionOpen(false);
              const cleaned = query.replace(/(?:^|\s)@[a-zA-Z0-9_-]*$/, '').trim();
              setQuery(cleaned);
              if (textareaRef?.current) textareaRef.current.focus();
            }}
            onClose={() => setIsMentionOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Floating Interactive Choices Card */}
      <AnimatePresence>
        {activeChoicePrompt && (
          <InteractiveChoiceCard
            question={activeChoicePrompt.question}
            options={activeChoicePrompt.options}
            selectedIndex={choiceSelectedIndex}
            onSelectedIndexChange={setChoiceSelectedIndex}
            onSelect={handleSelectChoice}
            onSkip={handleSkipChoice}
            onDismiss={handleSkipChoice}
          />
        )}
      </AnimatePresence>

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

      <form onSubmit={onFormSubmit} className="flex flex-col bg-[var(--composer-bg)] border border-[var(--border)] rounded-[16px] shadow-[0_2px_12px_rgb(0,0,0,0.04)] focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:focus-within:border-white/20 transition-all duration-200 px-4 pt-2.5 pb-2.5 mx-auto">
        {/* Top Context Pills (Page Context) */}
        {attachedPage && (
          <div className="flex items-center gap-1.5 mb-1.5 pt-0.5 flex-wrap">
            <div className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-[8px] bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] border border-black/[0.04] dark:border-white/[0.08] text-[12px] font-medium text-gray-600 dark:text-neutral-300 transition-colors select-none group max-w-full">
              <HugeiconsIcon icon={File02Icon} size={13.5} className="shrink-0 text-gray-400 dark:text-neutral-400" />
              <span className="max-w-[240px] truncate leading-tight">
                {attachedPage.title || "Untitled"}
              </span>
              <button
                type="button"
                onClick={() => setAttachedPage(null)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ml-0.5"
                title="Remove page context"
                aria-label="Remove page context"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={9} className="shrink-0 select-none" />
              </button>
            </div>
          </div>
        )}

        <div 
          className="flex items-start flex-wrap w-full cursor-text gap-x-1.5"
          onClick={() => textareaRef?.current?.focus()}
        >
          {activeTool && (
            <div className="inline-flex items-center gap-1.5 py-1 select-none shrink-0 text-[15.5px] leading-[1.5]">
              <span className="text-gray-400 dark:text-neutral-500 font-normal select-none">-</span>
              {activeTool.icon && (
                <HugeiconsIcon 
                  icon={activeTool.icon} 
                  size={16} 
                  strokeWidth={2} 
                  className="shrink-0 text-[#007AFF] dark:text-[#2f88ff]" 
                />
              )}
              <span className="text-[#007AFF] dark:text-[#2f88ff] font-medium leading-[1.5]">
                {activeTool.label}
              </span>
            </div>
          )}
          <div className={`relative ${activeTool ? "flex-1 min-w-[120px]" : "w-full"}`}>
            {!query && !activeChoicePrompt && !activeTool && (
              <div className="absolute top-0 left-0 right-0 pointer-events-none px-1 py-1 text-[15.5px] leading-[1.5] text-[var(--text-muted)] select-none overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={suggestionIndex}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="inline-flex items-baseline gap-2 truncate max-w-full leading-[1.5]"
                  >
                    <span className="truncate leading-[1.5]">{currentSuggestion?.placeholder}</span>
                    {!isRightPanel && (
                      <span className="shrink-0 text-[11px] leading-none px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-neutral-400 font-mono tracking-wide align-middle inline-block">
                        Tab ⇥
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
            <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            const cursor = e.target.selectionStart ?? val.length;
            const textBeforeCursor = val.slice(0, cursor);
            const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
            if (match) {
              setIsMentionOpen(true);
              setMentionFilter(match[1]);
              setMentionSelectedIndex(0);
            } else if (isMentionOpen) {
              setIsMentionOpen(false);
            }
          }}
          onKeyUp={(e) => {
            const cursor = e.target.selectionStart ?? e.target.value.length;
            const textBeforeCursor = e.target.value.slice(0, cursor);
            const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_-]*)$/);
            if (match) {
              setIsMentionOpen(true);
              setMentionFilter(match[1]);
            } else if (isMentionOpen) {
              setIsMentionOpen(false);
            }
          }}
          onKeyDown={onKeyDown}
          placeholder={
            activeChoicePrompt
              ? "Or reply directly..."
              : activeTool?.id === 'research'
              ? "Ask anything to research deeply..."
              : activeTool
              ? `Ask anything with ${activeTool.label.toLowerCase()}...`
              : ""
          }
          rows={1}
          autoFocus
          className="w-full bg-transparent resize-none outline-none border-0 m-0 text-[15.5px] text-[var(--composer-text)] placeholder-[var(--text-muted)] px-1 py-1 custom-scrollbar leading-[1.5] min-h-[26px]"
          style={{ maxHeight: '250px' }}
        />
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-1.5 pt-0.5 px-0.5 relative">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setIsThinking(!isThinking)}
              className={`h-8 transition-all duration-200 cursor-pointer select-none flex items-center border-0 ${
                isThinking 
                  ? 'px-3 gap-2 rounded-full bg-[#007AFF]/10 dark:bg-[#007AFF]/15 text-[#007AFF] dark:text-[#0A84FF] text-[13px] font-medium hover:bg-[#007AFF]/15 dark:hover:bg-[#007AFF]/20' 
                  : 'w-8 justify-center rounded-full text-gray-400 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={isThinking ? "Thinking Enabled" : "Enable Thinking"}
              aria-label="Toggle Thinking"
            >
              <HugeiconsIcon icon={Brain03Icon} size={isThinking ? 16 : 18} strokeWidth={1.8} className="shrink-0" />
              {isThinking && <span className="leading-none text-[13px] font-medium">Thinking</span>}
            </button>


          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
              >
                <span>{activeModel.label}</span>
                <span className={`material-symbols-outlined text-[15px] leading-none select-none text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_less</span>
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 mb-2 w-[240px] bg-white dark:bg-[#191919] border border-gray-200 dark:border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.6)] z-50 overflow-hidden rounded-[16px] p-2"
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
                <div className="w-3 h-3 bg-white rounded-[2px]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!query.trim()}
                className="w-[36px] h-[36px] rounded-full bg-[#9CA3AF] dark:bg-white flex items-center justify-center text-white dark:text-black hover:bg-[#6B7280] dark:hover:bg-gray-200 disabled:opacity-40 transition-colors shadow-sm ml-1"
              >
                <span className="material-symbols-outlined text-[17px] leading-none select-none">arrow_upward</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Subtle Bottom Keyboard Helper (matching Linear / Apple native spec) */}
      {activeChoicePrompt && (
        <div className="flex items-center justify-center gap-2 mt-2.5 text-[12px] text-[#777777] select-none font-sans">
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded-[5px] bg-[#1c1c1c] border border-[#3A3A3A] text-[11px] text-[#999999] font-mono leading-none">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded-[5px] bg-[#1c1c1c] border border-[#3A3A3A] text-[11px] text-[#999999] font-mono leading-none">↓</kbd>
            <span>to navigate</span>
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded-[5px] bg-[#1c1c1c] border border-[#3A3A3A] text-[11px] text-[#999999] font-mono leading-none">↵</kbd>
            <span>to select</span>
          </span>
          <span>·</span>
          <span>or type below</span>
        </div>
      )}
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
  const [dismissedChoiceId, setDismissedChoiceId] = useState(null);

  const handleDockToSidebar = () => {
    setIsRightChatOpen(true);
    const lastPage = localStorage.getItem('noema-last-page-route');
    const targetRoute = (lastPage && lastPage.startsWith('/dashboard/') && lastPage !== '/dashboard/chat')
      ? lastPage
      : '/dashboard/page/new';

    const mode = localStorage.getItem('noema-chat-startup-mode') || 'resume';
    if (mode === 'resume') {
      localStorage.setItem('noema-last-route', targetRoute);
    }
    navigate(targetRoute);
  };

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
  const prevMessagesCountRef = useRef(messages.length);

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

  const scrollToBottom = (behavior = 'smooth') => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior
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
        const isNewMessage = messages.length > prevMessagesCountRef.current;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 250;

        if (isNewMessage) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
          setTimeout(() => {
            if (chatScrollRef.current) {
              chatScrollRef.current.scrollTo({
                top: chatScrollRef.current.scrollHeight,
                behavior: 'smooth'
              });
            }
          }, 80);
        } else if (isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
      prevMessagesCountRef.current = messages.length;
    }
  }, [messages]);

  const handleSend = async (pageCtx = null, overrideText = null) => {
    const text = (overrideText !== null && overrideText !== undefined ? overrideText : query).trim();
    if (!text || isStreaming) return;
    sendMessage(text, null, pageCtx);
    setTimeout(() => {
      scrollToBottom('smooth');
    }, 40);
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
        <div className="flex items-center justify-end px-3.5 py-2.5 bg-white dark:bg-[var(--color-dark-bg)]">
          <div className="inline-flex items-center p-[3px] gap-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <button
              onClick={() => clearChat()}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="New Chat"
              aria-label="New Chat"
            >
              <HugeiconsIcon icon={ChatAdd01Icon} size={19} className="shrink-0 select-none" />
            </button>
            <button
              onClick={() => navigate('/dashboard/chat')}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Expand Chat"
              aria-label="Expand Chat"
            >
              <HugeiconsIcon icon={ExpandIcon} size={19} className="shrink-0 select-none" />
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
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                onClick={() => {
                  setShowScrollButton(false);
                  scrollToBottom('smooth');
                }}
                className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 w-8 h-8 rounded-full bg-white/95 dark:bg-[#222]/95 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.1] shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] flex items-center justify-center text-gray-600 hover:text-black dark:text-neutral-300 dark:hover:text-white hover:bg-white dark:hover:bg-[#2c2c2c] transition-all hover:scale-105 cursor-pointer"
                title="Scroll to bottom"
                aria-label="Scroll to bottom"
              >
                <span className="material-symbols-outlined text-[18px] leading-none select-none">arrow_downward</span>
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
            dismissedChoiceId={dismissedChoiceId}
            setDismissedChoiceId={setDismissedChoiceId}
            isRightPanel={isRightPanel}
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
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                const lastPage = localStorage.getItem('noema-last-page-route');
                navigate(lastPage || '/dashboard/page/new');
              }
            }}
            className="pointer-events-auto relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Go back"
            aria-label="Go back"
          >
            <span className="material-symbols-outlined text-[17px] leading-none select-none text-current">keyboard_backspace</span>
          </button>
          
          <div className="inline-flex items-center p-[3px] gap-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] pointer-events-auto">
            <button 
              onClick={() => clearChat()}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="New Chat"
              aria-label="New Chat"
            >
              <HugeiconsIcon icon={ChatAdd01Icon} size={19} className="shrink-0 select-none" />
            </button>

            <button 
              onClick={handleDockToSidebar}
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Open in Sidebar"
              aria-label="Open in Sidebar"
            >
              <HugeiconsIcon icon={SidebarRightIcon} size={19} className="shrink-0 select-none" />
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
                  className="text-[24px] font-semibold text-gray-900 dark:text-[var(--color-dark-title)] tracking-tight absolute text-center w-full"
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
                dismissedChoiceId={dismissedChoiceId}
                setDismissedChoiceId={setDismissedChoiceId}
                isRightPanel={isRightPanel}
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

            {/* Footer with Composer */}
            <div className="chat-footer">
              <div className="w-full max-w-[770px] mx-auto px-4 relative z-20 pointer-events-auto">
                <AnimatePresence>
                  {showScrollButton && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        setShowScrollButton(false);
                        scrollToBottom('smooth');
                      }}
                      className="absolute -top-13 left-1/2 -translate-x-1/2 z-50 w-8 h-8 rounded-full bg-white/95 dark:bg-[#222]/95 backdrop-blur-md border border-black/[0.08] dark:border-white/[0.1] shadow-[0_2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)] flex items-center justify-center text-gray-600 hover:text-black dark:text-neutral-300 dark:hover:text-white hover:bg-white dark:hover:bg-[#2c2c2c] transition-all hover:scale-105 cursor-pointer"
                      title="Scroll to bottom"
                      aria-label="Scroll to bottom"
                    >
                      <span className="material-symbols-outlined text-[18px] leading-none select-none">arrow_downward</span>
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
                  dismissedChoiceId={dismissedChoiceId}
                  setDismissedChoiceId={setDismissedChoiceId}
                  isRightPanel={isRightPanel}
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