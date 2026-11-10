import React, { useEffect, useRef, useState, useContext, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  BubbleChatNotificationIcon,
  LibrariesIcon,
  Copy01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  File02Icon,
} from '@hugeicons/core-free-icons';

import { EditorContext } from '../../context/EditorContext';
import { ChatContext } from '../../context/ChatContextDefinition';
import { useToast } from '../../context/ToastContext';
import { chatAPI, pagesAPI } from '../../services/api';
import MarkdownRenderer from './MarkdownRenderer';

const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 34,
  mass: 1,
};

const FILTER_TABS = [
  { id: 'workspace', label: 'Workspaces' },
  { id: 'page', label: 'Pages' },
  { id: 'chat', label: 'Chats' },
];

const formatRelativeTime = (dateInput) => {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

const SearchPalette = ({ isOpen, onClose, recentPages = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('workspace');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewContent, setPreviewContent] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { workspaceTree, loadWorkspaceData } = useContext(EditorContext);
  const { loadSession } = useContext(ChatContext) || {};

  // Resolve target route
  const resolveItemPath = useCallback((item) => {
    if (!item) return null;
    if (item.type === 'new_page') return '/dashboard/page/new';
    const id = item.id || item._id;
    if (item.type === 'page' || item.type === 'document') return `/dashboard/page/${id}`;
    if (item.type === 'chat') return '/dashboard/chat';
    if (item.children && item.children.length > 0) {
      const firstChild = item.children.find((c) => c.type === 'page') || item.children[0];
      if (firstChild) return `/dashboard/page/${firstChild.id || firstChild._id}`;
    }
    if (item.path && !item.path.includes('/dashboard/workspace/')) return item.path;
    return `/dashboard/page/new`;
  }, []);

  const handleSelectItem = useCallback((item) => {
    if (!item) return;
    const targetPath = resolveItemPath(item);
    if (!targetPath) return;

    if (item.type === 'chat' && item.sessionId && loadSession) {
      loadSession(item.sessionId);
    }

    onClose();
    navigate(targetPath);
  }, [resolveItemPath, loadSession, onClose, navigate]);

  // Copy page link
  const handleCopyLink = useCallback((item) => {
    if (!item) return;
    const targetPath = resolveItemPath(item);
    if (!targetPath) return;
    const fullUrl = `${window.location.origin}${targetPath}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      showToast('Page link copied to clipboard', 'success');
    }).catch(() => {
      showToast('Failed to copy link', 'error');
    });
  }, [resolveItemPath, showToast]);

  // Aggregate and filter results
  const results = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const items = [];
    const seenIds = new Set();

    if (activeFilter === 'workspace') {
      if (workspaceTree && workspaceTree.length > 0) {
        for (const ws of workspaceTree) {
          const wsName = ws.name || 'Workspace';
          if (!query || wsName.toLowerCase().includes(query)) {
            const rawId = ws.id || ws._id;
            if (!seenIds.has(`ws-${rawId}`)) {
              seenIds.add(`ws-${rawId}`);
              const count = ws.children?.length || 0;
              items.push({
                id: rawId,
                type: 'workspace',
                title: wsName,
                breadcrumb: `${count} ${count === 1 ? 'item' : 'items'}`,
                children: ws.children || [],
                raw: ws,
                updatedAt: ws.updatedAt || ws.createdAt,
              });
            }
          }
        }
      }
      return items;
    }

    if (activeFilter === 'page') {
      if (!query) {
        items.push({
          id: 'new-page-default',
          type: 'new_page',
          title: 'New page',
          breadcrumb: 'Create a new blank note',
          path: '/dashboard/page/new',
        });
      }

      if (workspaceTree && workspaceTree.length > 0) {
        const traversePages = (nodes, parentWorkspaceName = '', parentFolderName = '') => {
          for (const node of nodes) {
            const rawId = node.id || node._id;
            const nodeName = node.name || node.title || 'Untitled';
            if (node.type === 'page') {
              const matchesQuery = !query || nodeName.toLowerCase().includes(query);
              if (matchesQuery && !seenIds.has(`pg-${rawId}`)) {
                seenIds.add(`pg-${rawId}`);
                const crumbs = [parentWorkspaceName, parentFolderName].filter(Boolean).join(' / ');
                items.push({
                  id: rawId,
                  type: 'page',
                  title: nodeName,
                  breadcrumb: crumbs ? `— ${crumbs}` : '',
                  content: node.content || '',
                  updatedAt: node.updatedAt || node.createdAt,
                  raw: node,
                });
              }
            } else if (node.children) {
              const wsName = node.type === 'workspace' ? nodeName : parentWorkspaceName;
              const fldName = node.type === 'folder' ? nodeName : parentFolderName;
              traversePages(node.children, wsName, fldName);
            }
          }
        };
        traversePages(workspaceTree);
      }

      if (recentPages && recentPages.length > 0) {
        for (const p of recentPages) {
          const rawId = p.id || p._id;
          if (!seenIds.has(`pg-${rawId}`)) {
            const title = p.title || p.name || 'Untitled Note';
            if (!query || title.toLowerCase().includes(query)) {
              seenIds.add(`pg-${rawId}`);
              items.push({
                id: rawId,
                type: 'page',
                title,
                breadcrumb: p.workspaceName ? `— ${p.workspaceName}` : '— Recent',
                content: p.content || '',
                updatedAt: p.updatedAt || p.createdAt,
                raw: p,
              });
            }
          }
        }
      }

      return items;
    }

    if (activeFilter === 'chat') {
      if (chatSessions && chatSessions.length > 0) {
        for (const s of chatSessions) {
          const title = s.title || 'Untitled Chat';
          if (!query || title.toLowerCase().includes(query)) {
            const rawId = s.sessionId || s._id;
            if (!seenIds.has(`chat-${rawId}`)) {
              seenIds.add(`chat-${rawId}`);
              items.push({
                id: rawId,
                sessionId: s.sessionId,
                type: 'chat',
                title,
                breadcrumb: 'AI Chat',
                updatedAt: s.updatedAt || s.createdAt,
                raw: s,
              });
            }
          }
        }
      }
      return items;
    }

    return items;
  }, [searchQuery, activeFilter, workspaceTree, recentPages, chatSessions]);

  // Reset selected index when activeFilter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeFilter]);

  // Keep selected item within bounds
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (results.length === 0) return 0;
      return Math.min(prev, results.length - 1);
    });
  }, [results]);

  const activeItem = results[selectedIndex] || null;

  // Live preview fetch for selected page
  useEffect(() => {
    if (!activeItem || activeItem.type !== 'page') {
      setPreviewContent(null);
      setIsPreviewLoading(false);
      return;
    }

    // If item already contains content, show immediately
    if (activeItem.content && activeItem.content.trim().length > 0) {
      setPreviewContent({
        title: activeItem.title,
        content: activeItem.content,
        updatedAt: activeItem.updatedAt,
      });
      setIsPreviewLoading(false);
      return;
    }

    const pageId = activeItem.id;
    if (!pageId) return;

    let isMounted = true;
    setIsPreviewLoading(true);

    pagesAPI
      .getById(pageId)
      .then((res) => {
        if (isMounted) {
          const page = res.data?.page || res.data;
          setPreviewContent(page);
        }
      })
      .catch(() => {
        if (isMounted) setPreviewContent(null);
      })
      .finally(() => {
        if (isMounted) setIsPreviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeItem]);

  // Reset & focus on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setActiveFilter('workspace');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);

      if (!workspaceTree || workspaceTree.length === 0) {
        loadWorkspaceData?.().catch(() => {});
      }

      chatAPI
        .getSessions()
        .then((res) => {
          setChatSessions(res.data?.sessions || []);
        })
        .catch(() => {});
    }
  }, [isOpen, workspaceTree, loadWorkspaceData]);

  // Keyboard Navigation: Up, Down, Enter, Esc
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose();
        return;
      }

      if (results.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeItem) {
            handleSelectItem(activeItem);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, activeItem, onClose, handleSelectItem]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const getItemIcon = (type) => {
    switch (type) {
      case 'workspace':
        return <HugeiconsIcon icon={LibrariesIcon} size={16} className="text-neutral-500 shrink-0 select-none" />;
      case 'folder':
        return <span className="material-symbols-outlined text-[17px] leading-none select-none text-neutral-500 shrink-0">folder</span>;
      case 'chat':
        return <HugeiconsIcon icon={BubbleChatNotificationIcon} size={16} className="text-neutral-500 shrink-0 select-none" />;
      case 'page':
      default:
        return <HugeiconsIcon icon={File02Icon} size={16} className="text-neutral-500 shrink-0 select-none" />;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm pointer-events-auto cursor-pointer"
      />

      {/* 2-Column Notion-style Dialog Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: -4 }}
        transition={springConfig}
        className="relative w-full max-w-[934px] h-[630px] max-h-[88vh] -translate-y-[15px] rounded-[19px] bg-white dark:bg-[rgb(24,24,24)] text-[#181817] dark:text-[#f7f6f4] border border-black/[0.08] dark:border-white/[0.09] shadow-[0_24px_70px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden pointer-events-auto select-none font-sans"
      >
        {/* TOP SEARCH HEADER */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-2 shrink-0">
          <HugeiconsIcon icon={Search01Icon} size={18} strokeWidth={2} className="text-[#8E8B86] dark:text-[#7d7a75] shrink-0 select-none" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search or ask a question in workspace..."
            className="flex-1 bg-transparent border-0 outline-none text-[15px] text-[#181817] dark:text-[#f7f6f4] placeholder-[#8E8B86] dark:placeholder-[#7d7a75] font-normal tracking-[-0.01em]"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                inputRef.current?.focus();
              }}
              className="w-6 h-6 flex items-center justify-center rounded-full text-[#8E8B86] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Clear query"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[5px] border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-[11px] font-mono text-[#8E8B86] dark:text-[#7d7a75] leading-none select-none hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            title="Close (Esc)"
          >
            Esc
          </button>
        </div>

        {/* FILTER PILLS BAR */}
        <div className="flex items-center gap-1.5 px-5 pt-1 pb-3 shrink-0 overflow-x-auto custom-scrollbar">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={`h-[29px] flex items-center justify-center text-[13.5px] font-medium leading-none cursor-pointer shrink-0 transition-[background-color,color,box-shadow] duration-200 ease-out ${
                  isActive
                    ? 'px-3.5 rounded-full bg-black/[0.07] dark:bg-white/[0.12] text-[#181817] dark:text-[#f7f6f4] shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                    : 'px-2.5 rounded-full text-[#605d57] hover:text-[#181817] dark:text-[#a09d96] dark:hover:text-[#f7f6f4] bg-transparent'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2-COLUMN SPLIT BODY */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT COLUMN: Results List */}
          <div
            ref={listRef}
            className="w-[50%] max-w-[460px] min-w-[280px] flex flex-col overflow-y-auto custom-scrollbar p-2"
          >
            {results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#8E8B86] dark:text-[#7d7a75]">
                <HugeiconsIcon icon={Search01Icon} size={28} strokeWidth={1.5} className="mb-2 opacity-40 select-none" />
                <p className="text-[13.5px]">No results found{searchQuery ? ` for "${searchQuery}"` : ''}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {results.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id || idx}
                      data-index={idx}
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`group flex items-center justify-between gap-2.5 px-3 py-2 rounded-[9px] cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-black/[0.06] dark:bg-white/[0.08] text-[#181817] dark:text-[#f7f6f4]'
                          : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04] text-[#2c2c2b] dark:text-[#e0deda]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          {getItemIcon(item.type)}
                        </div>

                        <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                          <span className="text-[13.5px] font-medium truncate leading-tight tracking-[-0.01em]">
                            {item.title}
                          </span>
                          {item.breadcrumb && (
                            <span className="text-[12px] text-[#8E8B86] dark:text-[#7d7a75] truncate font-normal leading-tight">
                              {item.breadcrumb}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.updatedAt && (
                        <span className="text-[11px] text-[#8E8B86] dark:text-[#7d7a75] shrink-0 font-normal">
                          {formatRelativeTime(item.updatedAt)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Live Inset Preview Panel */}
          <div className="flex-1 px-4 py-3 flex flex-col justify-center overflow-hidden min-w-0 bg-transparent">
            {activeItem ? (
              <div className="relative w-full h-[510px] max-h-full my-auto flex flex-col rounded-[10px] border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.015] dark:bg-[rgb(30,30,30)]/40 p-4.5 overflow-hidden">
                {/* Top-Right Quick Action Group */}
                <div className="absolute top-3 right-3 flex items-center bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.08] rounded-[6px] p-0.5 z-10">
                  {activeItem.type !== 'new_page' && (
                    <button
                      type="button"
                      onClick={() => handleCopyLink(activeItem)}
                      className="w-6 h-6 flex items-center justify-center rounded-[4px] text-[#8E8B86] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      title="Copy link"
                      aria-label="Copy link"
                    >
                      <HugeiconsIcon icon={Copy01Icon} size={13} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSelectItem(activeItem)}
                    className="w-6 h-6 flex items-center justify-center rounded-[4px] text-[#8E8B86] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                    title="Open"
                    aria-label="Open"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                  </button>
                </div>

                {/* Inset Preview Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col">
                  {isPreviewLoading ? (
                    <div className="flex flex-col gap-2.5 animate-pulse pt-1">
                      <div className="h-5 bg-black/[0.05] dark:bg-white/[0.08] rounded w-1/2" />
                      <div className="h-3.5 bg-black/[0.04] dark:bg-white/[0.05] rounded w-full mt-3" />
                      <div className="h-3.5 bg-black/[0.04] dark:bg-white/[0.05] rounded w-4/5" />
                      <div className="h-3.5 bg-black/[0.04] dark:bg-white/[0.05] rounded w-2/3" />
                    </div>
                  ) : activeItem.type === 'new_page' ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[16px] font-semibold text-[#181817] dark:text-[#f7f6f4] tracking-[-0.015em] leading-snug pr-16 truncate">
                        New page
                      </h3>
                      <div className="text-[11.5px] text-[#8E8B86] dark:text-[#7d7a75] font-normal truncate">
                        Create a new blank note in workspace
                      </div>
                      <div className="h-px w-full bg-black/[0.06] dark:bg-white/[0.08] my-1 opacity-60" />
                      <div className="text-[12.5px] leading-relaxed text-[#555] dark:text-[#a09d96] pt-1">
                        Press <kbd className="px-1.5 py-0.5 rounded-[4px] border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.06] text-[11px] font-mono">↵ Enter</kbd> or click open to start writing on a fresh blank page.
                      </div>
                    </div>
                  ) : activeItem.type === 'page' ? (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[16px] font-semibold text-[#181817] dark:text-[#f7f6f4] tracking-[-0.015em] leading-snug pr-16 truncate">
                        {previewContent?.title || activeItem.title || 'Untitled'}
                      </h3>

                      {activeItem.breadcrumb && (
                        <div className="text-[11.5px] text-[#8E8B86] dark:text-[#7d7a75] font-normal truncate">
                          {activeItem.breadcrumb.replace(/^[—\s]+/, '')}
                        </div>
                      )}

                      <div className="h-px w-full bg-black/[0.06] dark:bg-white/[0.08] my-1 opacity-60" />

                      {previewContent?.content ? (
                        <div className="text-[12.5px] leading-relaxed text-[#403e3b] dark:text-[#c4c2bc] overflow-hidden">
                          <MarkdownRenderer content={previewContent.content.slice(0, 1500)} />
                        </div>
                      ) : (
                        <p className="text-[12px] text-[#8E8B86] dark:text-[#7d7a75] italic mt-1">
                          (Empty note)
                        </p>
                      )}
                    </div>
                  ) : activeItem.type === 'chat' ? (
                    <div className="flex flex-col gap-2.5 py-6 items-center justify-center text-center my-auto">
                      <div className="w-10 h-10 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-[#8E8B86] dark:text-[#a09d96]">
                        <HugeiconsIcon icon={BubbleChatNotificationIcon} size={20} />
                      </div>
                      <h4 className="text-[14.5px] font-medium text-[#181817] dark:text-[#f7f6f4] px-4 truncate max-w-full">
                        {activeItem.title}
                      </h4>
                      <p className="text-[11.5px] text-[#8E8B86] dark:text-[#7d7a75]">
                        AI chat conversation
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSelectItem(activeItem)}
                        className="mt-1 px-3 py-1.5 rounded-[7px] bg-black dark:bg-white text-white dark:text-black text-[12px] font-medium hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <span>Open chat</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                      </button>
                    </div>
                  ) : activeItem.type === 'workspace' ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[8px] bg-black/[0.04] dark:bg-white/[0.08] flex items-center justify-center text-[#8E8B86] dark:text-[#a09d96] shrink-0">
                          <HugeiconsIcon icon={LibrariesIcon} size={18} />
                        </div>
                        <div className="min-w-0 pr-14">
                          <h3 className="text-[16px] font-semibold text-[#181817] dark:text-[#f7f6f4] tracking-[-0.015em] leading-snug truncate">
                            {activeItem.title}
                          </h3>
                          <div className="text-[11.5px] text-[#8E8B86] dark:text-[#7d7a75] font-normal truncate">
                            Workspace · {activeItem.children?.length || 0} {activeItem.children?.length === 1 ? 'item' : 'items'}
                          </div>
                        </div>
                      </div>

                      <div className="h-px w-full bg-black/[0.06] dark:bg-white/[0.08] my-1 opacity-60" />

                      {activeItem.children && activeItem.children.length > 0 ? (
                        <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[350px]">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-[#8E8B86] dark:text-[#7d7a75] mb-1">
                            Pages & Folders
                          </span>
                          {activeItem.children.map((child, cIdx) => (
                            <div
                              key={child.id || cIdx}
                              onClick={() => handleSelectItem(child)}
                              className="flex items-center gap-2 py-1.5 px-2 rounded-[6px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer transition-colors text-[12.5px] text-[#2c2c2b] dark:text-[#d4d2cc]"
                            >
                              {getItemIcon(child.type)}
                              <span className="truncate">{child.name || child.title}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[#8E8B86] dark:text-[#7d7a75] italic mt-1">
                          (Empty workspace)
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5 py-6 items-center justify-center text-center my-auto">
                      <div className="w-10 h-10 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center text-[#8E8B86] dark:text-[#a09d96]">
                        <HugeiconsIcon icon={LibrariesIcon} size={20} />
                      </div>
                      <h4 className="text-[14.5px] font-medium text-[#181817] dark:text-[#f7f6f4] px-4 truncate max-w-full">
                        {activeItem.title}
                      </h4>
                      <button
                        type="button"
                        onClick={() => handleSelectItem(activeItem)}
                        className="mt-1 px-3 py-1.5 rounded-[7px] bg-black dark:bg-white text-white dark:text-black text-[12px] font-medium hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <span>Open</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#8E8B86] dark:text-[#7d7a75]">
                <p className="text-[12.5px]">Select an item to preview</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default React.memo(SearchPalette);
