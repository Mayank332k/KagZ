import React, { useState, useRef, useEffect, useContext, useLayoutEffect, useMemo } from 'react';
import { Loading03Icon } from "hugeicons-react";
import { HugeiconsIcon } from '@hugeicons/react';
import { Edit03Icon, Copy01Icon, File02Icon, Cancel01Icon, Brain03Icon, ChatAdd01Icon, ExpandIcon, SidebarRightIcon, LimitationIcon, Add01Icon } from '@hugeicons/core-free-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChatContext } from '../../context/ChatContextDefinition';
import { EditorContext } from '../../context/EditorContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import MarkdownRenderer from '../UI/MarkdownRenderer';
import ThinkingOrb from './ThinkingOrb';
import InteractiveChoiceCard from './InteractiveChoiceCard';
import DeepResearchCard from './DeepResearchCard';
import ToolMentionMenu, { AVAILABLE_TOOLS } from './ToolMentionMenu';
import MemoryUpdateIcon from './MemoryUpdateIcon';
import { CHAT_MODELS } from '../../constants/chatModels';
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
      const normalizedUrl = src.url.startsWith('http://') || src.url.startsWith('https://')
        ? src.url
        : `https://${src.url}`;
      const parsed = new URL(normalizedUrl);
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
        url: normalizedUrl,
      };
    } catch {
      const fallbackUrl = src.url.startsWith('http://') || src.url.startsWith('https://')
        ? src.url
        : `https://${src.url}`;
      return {
        domain: 'web',
        siteName: 'Web',
        isWeb: true,
        title: src.title || 'Web Result',
        url: fallbackUrl,
      };
    }
  }

  return {
    domain: 'workspace',
    siteName: 'Workspace Note',
    isWeb: false,
    title: src.title || 'Untitled Note',
    pageId: src.pageId || src._id || src.id,
  };
};

const SourcesSheetContext = React.createContext({
  openSources: () => {},
});

const SourcesBottomSheet = ({ sources, onClose, isRightPanel }) => {
  const navigate = useNavigate();
  const [openingIndex, setOpeningIndex] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[150] flex flex-col justify-end pointer-events-auto">
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-[2px]"
      />

      {/* Sheet Content matching Obsidian / Mobile bottom sheet inspiration */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 380 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 60 || info.velocity.y > 220) {
            onClose();
          }
        }}
        className={`relative z-10 bg-[#eeece8] dark:bg-[#161616] border-t border-black/[0.08] dark:border-white/[0.08] shadow-[0_-16px_40px_rgba(0,0,0,0.18)] dark:shadow-[0_-20px_50px_rgba(0,0,0,0.65)] flex flex-col max-h-[80%] overflow-hidden ${
          isRightPanel
            ? 'w-full rounded-t-[28px]'
            : 'w-full sm:w-[94%] max-w-[560px] mx-auto rounded-t-[34px] border-x border-black/[0.08] dark:border-white/[0.08]'
        }`}
      >
        {/* Top bar with grab handle & subtle controls */}
        <div className="relative pt-3 pb-2 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 z-10">
            <span className="text-[12px] font-medium tracking-tight text-neutral-600 dark:text-neutral-400">
              Sources
            </span>
            <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
              • {sources.length}
            </span>
          </div>

          {/* Centered Grab Handle Pill */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-3 cursor-grab active:cursor-grabbing py-1"
            onClick={onClose}
          >
            <div className="w-12 h-1 bg-black/25 dark:bg-[#505050] rounded-full" />
          </div>

          {/* Subtle Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="z-10 w-6 h-6 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-[15px] leading-none select-none">close</span>
          </button>
        </div>

        {/* Inner nested rounded component with color hierarchy */}
        <div className="mx-3.5 sm:mx-4 mb-4 rounded-[20px] bg-white dark:bg-[#2d2d2f] border border-black/[0.06] dark:border-white/[0.06] shadow-sm overflow-hidden divide-y divide-black/[0.06] dark:divide-[#3c3c3e] max-h-[52vh] overflow-y-auto custom-scrollbar">
          {sources.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                setOpeningIndex(idx);
                if (item.isWeb && item.url) {
                  const targetUrl = item.url.startsWith('http://') || item.url.startsWith('https://')
                    ? item.url
                    : `https://${item.url}`;
                  window.open(targetUrl, '_blank', 'noopener,noreferrer');
                  setTimeout(() => {
                    setOpeningIndex(null);
                    onClose();
                  }, 120);
                } else {
                  const targetPageId = item.pageId || item._id || item.id;
                  if (targetPageId) {
                    navigate(`/dashboard/page/${targetPageId}`);
                    setTimeout(() => {
                      setOpeningIndex(null);
                      onClose();
                    }, 120);
                  } else {
                    setOpeningIndex(null);
                    onClose();
                  }
                }
              }}
              className="group flex items-center justify-between px-4 py-3.5 hover:bg-black/[0.035] dark:hover:bg-white/[0.05] active:bg-black/[0.06] dark:active:bg-white/[0.09] transition-colors cursor-pointer select-none"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-5 h-5 flex items-center justify-center shrink-0 text-neutral-500 dark:text-[#a0a0a0]">
                  {item.isWeb ? (
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${item.domain}&sz=32`}
                      alt=""
                      className="w-4 h-4 rounded-xs object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) {
                          e.target.nextSibling.style.display = 'block';
                        }
                      }}
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[19px] leading-none select-none">
                      description
                    </span>
                  )}
                  {item.isWeb && (
                    <span
                      style={{ display: 'none' }}
                      className="material-symbols-outlined text-[18px] leading-none select-none"
                    >
                      language
                    </span>
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[14.5px] font-normal text-gray-900 dark:text-[#ececec] truncate leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {item.title}
                  </span>
                  <span className="text-[12px] text-gray-400 dark:text-[#8e8e93] truncate mt-0.5">
                    {item.isWeb ? item.domain || item.siteName : 'Workspace Note'}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-neutral-400 dark:text-[#6a6a6a] group-hover:text-neutral-700 dark:group-hover:text-neutral-300 transition-colors pl-2 flex items-center justify-center min-w-[20px]">
                {openingIndex === idx ? (
                  <div className="w-3.5 h-3.5 border-2 border-neutral-300 dark:border-neutral-600 border-t-neutral-800 dark:border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[15px] leading-none select-none">
                    {item.isWeb ? 'arrow_outward' : 'chevron_right'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

const SourcesPill = ({ sources }) => {
  const { openSources } = useContext(SourcesSheetContext);
  if (!sources || sources.length === 0) return null;

  const formattedSources = sources.map(formatSource);
  const primarySource = formattedSources[0];
  const primaryLabel = primarySource.domain !== 'workspace' ? primarySource.domain : primarySource.title;
  const extraCount = sources.length - 1;

  return (
    <div className="relative inline-flex items-center self-start w-fit mt-2 mb-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openSources(formattedSources);
        }}
        className="sources-peanut-btn group inline-flex items-center gap-2 h-[34px] px-4 rounded-full bg-[var(--sources-pill-bg)] hover:bg-[var(--sources-pill-hover)] transition-colors focus:outline-none cursor-pointer"
        title="View sources"
      >
        <span className="text-[14px] font-medium text-[var(--sources-pill-text)] group-hover:text-black dark:group-hover:text-white transition-colors truncate max-w-[200px]">
          {primaryLabel}
        </span>
        {extraCount > 0 && (
          <span className="text-[12.5px] font-semibold text-[var(--sources-pill-count)] group-hover:text-black dark:group-hover:text-white transition-colors">
            +{extraCount}
          </span>
        )}
      </button>
    </div>
  );
};

const MessageActions = ({ content, timestamp, isLatest }) => {
  const { isPageOpen, appendContent, workspaceTree, triggerSidebarRefresh, activePage } = useContext(EditorContext);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const isCreatingPageRef = useRef(false);
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
    if (isCreatingPageRef.current || isCreatingPage) return;
    isCreatingPageRef.current = true;
    setIsCreatingPage(true);
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
    } finally {
      isCreatingPageRef.current = false;
      setIsCreatingPage(false);
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
              role="listbox"
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="absolute left-0 bottom-full mb-1.5 z-50 min-w-[220px] p-1 rounded-[6px] bg-white dark:bg-[#202020] border border-[#f0efed] dark:border-[#2c2c2b] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] flex flex-col gap-0.5 select-none"
            >
              <button
                type="button"
                role="option"
                onClick={() => {
                  setShowAddMenu(false);
                  handleAddToCurrentPage();
                }}
                className="flex items-center gap-2 h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] text-[#2c2c2b] dark:text-[#f0efed] text-[14px] leading-[16.8px] transition-colors text-left cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center text-[#7d7a75] dark:text-[#a19e99] shrink-0">
                  <span className="material-symbols-outlined text-[16px] leading-none select-none">
                    post_add
                  </span>
                </div>
                <span className="truncate flex-1">
                  Add to <strong className="font-medium text-[#2c2c2b] dark:text-[#f0efed]">{activePage?.title && activePage.title !== 'Untitled' ? activePage.title : 'Current page'}</strong>
                </span>
              </button>

              <button
                type="button"
                role="option"
                onClick={() => {
                  setShowAddMenu(false);
                  handleCreateNewPage();
                }}
                className="flex items-center gap-2 h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] text-[#2c2c2b] dark:text-[#f0efed] text-[14px] leading-[16.8px] transition-colors text-left cursor-pointer"
              >
                <div className="w-5 h-5 flex items-center justify-center text-[#7d7a75] dark:text-[#a19e99] shrink-0">
                  <span className="material-symbols-outlined text-[16px] leading-none select-none">
                    note_add
                  </span>
                </div>
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

const MessageSkeletonLoader = ({ isRightPanel = false }) => (
  <div className={`w-full flex flex-col gap-3 py-2 animate-pulse ${isRightPanel ? 'px-1' : ''}`}>
    {/* Assistant message skeleton */}
    <div className="flex items-start gap-2.5 w-full">
      <div className="shrink-0 pt-1">
        <div className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/10" />
      </div>
      <div className="flex flex-col gap-2 flex-1 max-w-[78%] pt-1">
        <div className="h-3.5 bg-black/[0.08] dark:bg-white/10 rounded-md w-3/4" />
        <div className="h-3.5 bg-black/[0.06] dark:bg-white/[0.07] rounded-md w-1/2" />
      </div>
    </div>
    {/* User message skeleton */}
    <div className="flex flex-col items-end w-full">
      <div className="h-8 bg-black/[0.06] dark:bg-white/10 rounded-[20px] w-44 max-w-[70%]" />
    </div>
    {/* Another Assistant message skeleton */}
    <div className="flex items-start gap-2.5 w-full">
      <div className="shrink-0 pt-1">
        <div className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/10" />
      </div>
      <div className="flex flex-col gap-2 flex-1 max-w-[85%] pt-1">
        <div className="h-3.5 bg-black/[0.08] dark:bg-white/10 rounded-md w-5/6" />
        <div className="h-3.5 bg-black/[0.06] dark:bg-white/[0.07] rounded-md w-3/5" />
      </div>
    </div>
  </div>
);

const ChatMessageItem = React.memo(({ msg, isLatest, isStreaming }) => {
  const isLatestStreaming = isStreaming && isLatest;
  const { stopGeneration } = useContext(ChatContext);

  if (msg.role === 'user') {
    const { tool, cleanContent } = parseUserToolMessage(msg.content);

    return (
      <div className="flex flex-col items-end group/msg">
        <div className="bg-gray-100 dark:bg-[#202020] text-gray-800 dark:text-gray-200 text-[13.5px] px-4 py-2 rounded-[20px] max-w-[85%] leading-normal shadow-sm [&_p]:mb-0">
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

  // 3. Raw JSON containing "question" and "options" anywhere in text
  const rawJsonMatch = content.match(/\{[\s\r\n]*"(?:question|prompt)"[\s\S]*?"options"[\s\S]*?\}/);
  if (rawJsonMatch) {
    const result = tryParseJson(rawJsonMatch[0]);
    if (result) return result;
  }

  // 4. Fallback: Auto-detect delete confirmation
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

  // 5. Fallback: Detect markdown multiple-choice questions (e.g. A) / B), 1. / 2.)
  const parseMarkdownChoices = () => {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const choiceRegex = /^(?:(?:\(([a-fA-F1-6])\))|(?:([a-fA-F1-6])[\.\)]))\s+(.+)$/;

    const choices = [];
    let questionLine = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(choiceRegex);
      if (match) {
        const titleAndDesc = match[3].trim();
        const splitMatch = titleAndDesc.match(/^([^:\-\–—]+)\s*[:\-\–—]\s*(.+)$/);
        if (splitMatch) {
          choices.push({
            title: splitMatch[1].trim(),
            description: splitMatch[2].trim(),
          });
        } else {
          choices.push({
            title: titleAndDesc,
            description: '',
          });
        }
      } else if (choices.length === 0 && (line.includes('?') || line.endsWith(':'))) {
        questionLine = line.replace(/\*+/g, '').trim();
      }
    }

    if (choices.length >= 2 && choices.length <= 6) {
      return {
        question: questionLine || 'Please choose an option:',
        options: choices,
      };
    }
    return null;
  };

  const mdChoices = parseMarkdownChoices();
  if (mdChoices) return mdChoices;

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

const ModelBurstIcon = ({ color = '#f97316', size = 15, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <path
      d="M12 2.5V21.5M2.5 12H21.5M5.28 5.28L18.72 18.72M5.28 18.72L18.72 5.28"
      stroke={color}
      strokeWidth="2.75"
      strokeLinecap="round"
    />
  </svg>
);

const ModelPreviewCard = ({ model, side = 'right' }) => {
  if (!model) return null;

  const renderMeter = (value = 4, total = 5) => (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`w-[20px] h-[3.5px] rounded-full transition-colors ${
            i < value
              ? 'bg-[#181817] dark:bg-[#ededed]'
              : 'bg-black/10 dark:bg-white/20'
          }`}
        />
      ))}
    </div>
  );

  const isLeft = side === 'left';

  return (
    <motion.div
      role="tooltip"
      initial={{ opacity: 0, x: isLeft ? 6 : -6, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: isLeft ? 6 : -6, scale: 0.98 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
      className={`absolute ${
        isLeft ? 'right-[calc(100%+10px)]' : 'left-[calc(100%+10px)]'
      } top-0 w-[252px] p-3.5 rounded-[14px] bg-[var(--c-surface-elevated)] border border-[var(--c-border-hairline)] shadow-[var(--shadow-menu)] z-50 select-none pointer-events-none`}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <img src="/kagz.png" alt="kagZ" className="w-[28px] h-[28px] object-contain shrink-0 select-none" />
        <span className="font-semibold text-[15px] text-[var(--c-text-primary)] leading-tight">
          {model.label}
        </span>
      </div>

      <p className="text-[12.5px] text-[var(--c-text-tertiary)] leading-snug mb-3.5">
        {model.description || model.subtitle}
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[13px] text-[var(--c-text-secondary)] font-normal">
          <span>Speed</span>
          {renderMeter(model.speed ?? 4)}
        </div>
        <div className="flex items-center justify-between text-[13px] text-[var(--c-text-secondary)] font-normal">
          <span>Intelligence</span>
          {renderMeter(model.intelligence ?? 4)}
        </div>
      </div>
    </motion.div>
  );
};

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
  const { showToast } = useToast();
  const [attachedPage, setAttachedPage] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredModel, setHoveredModel] = useState(null);
  const [openDirection, setOpenDirection] = useState('down');
  const [previewSide, setPreviewSide] = useState('right');
  const dropdownRef = useRef(null);

  // Advanced Tools (@ Mention) State
  const [activeTool, setActiveTool] = useState(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [choiceSelectedIndex, setChoiceSelectedIndex] = useState(-1);

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
        setHoveredModel(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!dropdownRef.current) return;

    const updatePlacement = () => {
      if (!dropdownRef.current) return;
      const rect = dropdownRef.current.getBoundingClientRect();
      const menuHeight = 175;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (!isRightPanel) {
        if (spaceBelow >= menuHeight + 14) {
          setOpenDirection('down');
        } else if (spaceAbove >= menuHeight + 14 || spaceAbove > spaceBelow) {
          setOpenDirection('up');
        } else {
          setOpenDirection('down');
        }
      } else {
        if (spaceBelow >= menuHeight + 14) {
          setOpenDirection('down');
        } else {
          setOpenDirection('up');
        }
      }

      const previewWidth = 262;
      if (rect.right + 10 + previewWidth > window.innerWidth - 12) {
        setPreviewSide('left');
      } else {
        setPreviewSide('right');
      }
    };

    if (isDropdownOpen) {
      updatePlacement();
      window.addEventListener('resize', updatePlacement);
      window.addEventListener('scroll', updatePlacement, true);
      return () => {
        window.removeEventListener('resize', updatePlacement);
        window.removeEventListener('scroll', updatePlacement, true);
      };
    }
  }, [isDropdownOpen, isRightPanel]);

  // Auto-add the open page into textarea context ONLY if not in sidebar panel
  useEffect(() => {
    if (!isRightPanel && activePage && activePage.id) {
      setAttachedPage(activePage);
    } else if (!isRightPanel) {
      setAttachedPage(null);
    }
  }, [activePage?.id, isRightPanel]);

  // Keep attached page in sync with live title/content updates in NoteEditor
  useEffect(() => {
    if (attachedPage && activePage && attachedPage.id === activePage.id) {
      setAttachedPage(activePage);
    }
  }, [activePage?.title, activePage?.content]);

  const handleToggleAttachPage = () => {
    if (attachedPage) {
      setAttachedPage(null);
    } else if (activePage && activePage.id) {
      setAttachedPage(activePage);
    } else {
      showToast('No active page open to add', 'info');
    }
  };

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
        setChoiceSelectedIndex((prev) => (prev <= 0 ? opts.length - 1 : prev - 1));
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

  const models = CHAT_MODELS;

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

      <form onSubmit={onFormSubmit} className="flex flex-col bg-[var(--composer-bg)] border border-black/[0.08] dark:border-transparent focus-within:border-black/[0.16] dark:focus-within:border-transparent rounded-[18px] shadow-[0_2px_12px_rgb(0,0,0,0.04)] focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-all duration-200 px-4 pt-3 pb-2.5 mx-auto">
        {/* Top Context Pills (Page Context) */}
        {attachedPage && (
          <div className="flex items-center gap-1.5 mb-2 pt-0.5 flex-wrap">
            <div className="inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-[10px] bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.07] dark:hover:bg-white/[0.1] border border-black/[0.04] dark:border-white/[0.08] text-[13px] font-medium text-gray-600 dark:text-neutral-300 transition-colors select-none group max-w-full">
              <HugeiconsIcon icon={File02Icon} size={15} className="shrink-0 text-gray-400 dark:text-neutral-400" />
              <span className="max-w-[260px] truncate leading-tight">
                {attachedPage.title || "Untitled"}
              </span>
              <button
                type="button"
                onClick={() => setAttachedPage(null)}
                className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ml-0.5"
                title="Remove page context"
                aria-label="Remove page context"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={10} className="shrink-0 select-none" />
              </button>
            </div>
          </div>
        )}

        <div 
          className="flex items-start flex-wrap w-full cursor-text gap-x-1.5"
          onClick={() => textareaRef?.current?.focus()}
        >
          {activeTool && (
            <div className="inline-flex items-center gap-1.5 py-1 select-none shrink-0 text-[16px] leading-[1.5]">
              <span className="text-gray-400 dark:text-neutral-500 font-normal select-none">-</span>
              {activeTool.icon && (
                <HugeiconsIcon 
                  icon={activeTool.icon} 
                  size={17} 
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
          className="w-full bg-transparent resize-none outline-none border-0 m-0 text-[15px] leading-[22px] font-normal text-gray-900 dark:text-[#f0efed] placeholder-[var(--text-muted)] px-1 py-1 custom-scrollbar min-h-[28px]"
          style={{ maxHeight: '250px' }}
        />
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-1.5 pt-0.5 relative">
          {/* Left Controls */}
          <div className="flex items-center gap-1 -ml-1">
            <button
              type="button"
              onClick={handleToggleAttachPage}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none border-0 ${
                attachedPage 
                  ? 'text-[#007AFF] dark:text-[#2f88ff] bg-[#007AFF]/10 dark:bg-[#007AFF]/15 hover:bg-[#007AFF]/20' 
                  : 'text-gray-400 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={
                attachedPage 
                  ? `Page added: ${attachedPage.title || "Untitled"} (Click to remove)` 
                  : activePage 
                  ? `Add current page: ${activePage.title || "Untitled"}` 
                  : "Add current page"
              }
              aria-label="Add current page context"
            >
              <HugeiconsIcon 
                icon={Add01Icon} 
                size={18.5} 
                strokeWidth={1.8} 
                className="shrink-0" 
              />
            </button>

            <button 
              type="button"
              onClick={() => setIsThinking(!isThinking)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none border-0 ${
                isThinking 
                  ? 'text-red-500 dark:text-red-400 hover:bg-red-500/10' 
                  : 'text-gray-400 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={isThinking ? "Thinking Enabled" : "Enable Thinking"}
              aria-label="Toggle Thinking"
            >
              <HugeiconsIcon 
                icon={isThinking ? LimitationIcon : Brain03Icon} 
                size={18.5} 
                strokeWidth={1.8} 
                className="shrink-0" 
              />
            </button>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen((prev) => !prev);
                  setHoveredModel(null);
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[13px] font-normal transition-colors duration-160 cursor-pointer ${
                  isDropdownOpen
                    ? 'text-[var(--c-text-primary)] bg-black/5 dark:bg-white/10'
                    : 'text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <img src="/kagz.png" alt="kagZ" className="w-[18px] h-[18px] object-contain shrink-0 select-none" />
                <span>{activeModel.label}</span>
                <span className={`material-symbols-outlined text-[15px] leading-none select-none text-[var(--c-icon-secondary)] transition-transform duration-160 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                  {openDirection === 'down' ? 'expand_more' : 'expand_less'}
                </span>
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    role="listbox"
                    initial={{ opacity: 0, y: openDirection === 'down' ? -4 : 4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: openDirection === 'down' ? -4 : 4, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    onMouseLeave={() => setHoveredModel(null)}
                    className={`absolute right-0 ${
                      openDirection === 'down' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                    } w-[315px] bg-[var(--c-surface-elevated)] border border-[var(--c-border-hairline)] shadow-[var(--shadow-menu)] z-50 overflow-visible rounded-[14px] p-1.5 select-none`}
                  >
                    {!isRightPanel && hoveredModel && (
                      <ModelPreviewCard model={hoveredModel} side={previewSide} />
                    )}

                    <div className="flex flex-col gap-0.5">
                      {models.map((model) => {
                        const isActive = selectedModel === model.value;

                        return (
                          <button
                            key={model.value}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => {
                              if (!isRightPanel) setHoveredModel(model);
                            }}
                            onClick={() => {
                              setSelectedModel(model.value);
                              setIsDropdownOpen(false);
                              setHoveredModel(null);
                            }}
                            className={`flex items-start w-full px-2.5 py-2 rounded-[8px] text-left transition-colors duration-160 cursor-pointer ${
                              isActive 
                                ? 'bg-[var(--ca-selected)] text-[var(--c-text-primary)]' 
                                : 'text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-[var(--ca-hover)]'
                            }`}
                          >
                            <div className="w-7 h-7 shrink-0 flex items-center justify-center mt-0.5">
                              <img src="/kagz.png" alt="kagZ" className="w-[24px] h-[24px] object-contain select-none" />
                            </div>
                            <div className="flex flex-col ml-1.5 min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-[14.5px] leading-snug ${isActive ? 'font-medium text-[var(--c-text-primary)]' : 'font-normal text-[var(--c-text-primary)]'}`}>
                                  {model.label}
                                </span>
                                {model.badge && (
                                  <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--ca-hover)] text-[10.5px] font-medium text-[var(--c-text-tertiary)]">
                                    {model.badge}
                                  </span>
                                )}
                              </div>
                              <span className="text-[12.5px] text-[var(--c-text-tertiary)] leading-tight mt-0.5">
                                {model.subtitle}
                              </span>
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
                className="w-[38px] h-[38px] rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-sm ml-1 cursor-pointer"
                title="Stop generation"
              >
                <div className="w-3.5 h-3.5 bg-white rounded-[2px]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!query.trim()}
                className="w-[38px] h-[38px] rounded-full bg-[#9CA3AF] dark:bg-white flex items-center justify-center text-white dark:text-black hover:bg-[#6B7280] dark:hover:bg-gray-200 disabled:opacity-40 transition-colors shadow-sm ml-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] leading-none select-none">arrow_upward</span>
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Subtle Bottom Keyboard Helper (matching Linear / Apple native spec) */}
      {activeChoicePrompt && (
        <div className="flex items-center justify-center gap-2 mt-2.5 text-[12px] text-[#8E8B86] dark:text-[#777777] select-none font-sans">
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded-[5px] bg-white border border-[#D4D3CF] text-[11px] text-[#5F5E59] dark:bg-[#1c1c1c] dark:border-[#3A3A3A] dark:text-[#999999] font-mono leading-none">↑</kbd>
            <kbd className="px-1.5 py-0.5 rounded-[5px] bg-white border border-[#D4D3CF] text-[11px] text-[#5F5E59] dark:bg-[#1c1c1c] dark:border-[#3A3A3A] dark:text-[#999999] font-mono leading-none">↓</kbd>
            <span>to navigate</span>
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded-[5px] bg-white border border-[#D4D3CF] text-[11px] text-[#5F5E59] dark:bg-[#1c1c1c] dark:border-[#3A3A3A] dark:text-[#999999] font-mono leading-none">↵</kbd>
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
  const { user } = useAuth();
  
  const textareaRef = useRef(null);
  const chatScrollRef = useRef(null);
  const navigate = useNavigate();

  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    const period =
      hour >= 5 && hour < 12
        ? 'Good morning'
        : hour >= 12 && hour < 17
          ? 'Good afternoon'
          : 'Good evening';

    const name = user?.username || (user?.name ? user.name.trim().split(' ')[0] : '');
    return name ? `${period}, ${name}` : period;
  }, [user]);

  const greetings = useMemo(() => [
    timeGreeting,
    "How can I help you today?",
    "How is your day going?",
    "Search anything across your workspace",
    "Write an email or draft a page",
    "Brainstorm ideas for your project",
    "Summarize your recent notes"
  ], [timeGreeting]);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [dismissedChoiceId, setDismissedChoiceId] = useState(null);
  const [activeSources, setActiveSources] = useState(null);

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
      <SourcesSheetContext.Provider value={{ openSources: setActiveSources }}>
        <div className="flex flex-col h-full bg-white dark:bg-[var(--color-dark-bg)] border-l border-black/[0.06] dark:border-white/[0.07] overflow-hidden relative shadow-sm">
          {/* Right Panel Header */}
          <div className="flex items-center justify-end px-3.5 py-2.5 bg-white dark:bg-[var(--color-dark-bg)]">
            <div className="inline-flex items-center p-1 gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <button
                onClick={() => clearChat()}
                className="w-8.5 h-8.5 flex items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="New Chat"
                aria-label="New Chat"
              >
                <HugeiconsIcon icon={ChatAdd01Icon} size={20} className="shrink-0 select-none" />
              </button>
              <button
                onClick={() => navigate('/dashboard/chat')}
                className="w-8.5 h-8.5 flex items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Expand Chat"
                aria-label="Expand Chat"
              >
                <HugeiconsIcon icon={ExpandIcon} size={20} className="shrink-0 select-none" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4" ref={chatScrollRef} onScroll={handleScroll}>
            {isLoadingMore && <MessageSkeletonLoader />}
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

          {/* Full-width bottom sheet sources in window mode */}
          <AnimatePresence>
            {activeSources && (
              <SourcesBottomSheet
                sources={activeSources}
                onClose={() => setActiveSources(null)}
                isRightPanel={true}
              />
            )}
          </AnimatePresence>
        </div>
      </SourcesSheetContext.Provider>
    );
  }


  // Full Screen View (/dashboard/chat)
  return (
    <SourcesSheetContext.Provider value={{ openSources: setActiveSources }}>
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
            
            <div className="inline-flex items-center p-1 gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] pointer-events-auto">
              <button 
                onClick={() => clearChat()}
                className="w-8.5 h-8.5 flex items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="New Chat"
                aria-label="New Chat"
              >
                <HugeiconsIcon icon={ChatAdd01Icon} size={20} className="shrink-0 select-none" />
              </button>

              <button 
                onClick={handleDockToSidebar}
                className="w-8.5 h-8.5 flex items-center justify-center rounded-full text-gray-500 dark:text-neutral-400 hover:text-gray-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Open in Sidebar"
                aria-label="Open in Sidebar"
              >
                <HugeiconsIcon icon={SidebarRightIcon} size={20} className="shrink-0 select-none" />
              </button>
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[770px] mx-auto px-4 mt-[-10vh] z-10 relative">
              {/* Logo Doodle */}
              <div className="flex items-center justify-center mb-8 relative group cursor-default">
                <img src="/kagz.png" alt="KagZ Logo" className="w-[64px] h-[64px] object-contain transition-transform duration-300 group-hover:scale-105 select-none" />
              </div>

              <div className="h-[40px] mb-8 w-full relative flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.h1
                    key={greetingIndex}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="text-[28px] sm:text-[30px] leading-[36px] font-semibold text-gray-900 dark:text-[#f0efed] tracking-tight absolute text-center w-full"
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
                {isLoadingMore && <MessageSkeletonLoader isRightPanel={true} />}
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

          {/* Bottom-middle floating sheet on full chat page */}
          <AnimatePresence>
            {activeSources && (
              <SourcesBottomSheet
                sources={activeSources}
                onClose={() => setActiveSources(null)}
                isRightPanel={false}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </SourcesSheetContext.Provider>
  );
};

export default AIChat;