import React, { useEffect, useRef, useState, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import { EditorContext } from '../../context/EditorContext';
import { ChatContext } from '../../context/ChatContextDefinition';
import { chatAPI } from '../../services/api';

// Spring config for Apple-like subtle, restrained liquid bounce
const springConfig = {
  type: "spring",
  stiffness: 350,
  damping: 32,
  mass: 1,
  bounce: 0.1
};

const circlesData = [
  { 
    id: 'workspace', 
    icon: ({ className }) => (
      <span className={`material-symbols-outlined leading-none select-none ${className || 'text-[16px]'}`}>
        dashboard_2_add
      </span>
    ), 
    label: 'Workspace' 
  },
  { 
    id: 'folder', 
    icon: ({ className }) => (
      <span className={`material-symbols-outlined leading-none select-none ${className || 'text-[16px]'}`}>
        folder
      </span>
    ), 
    label: 'Folder' 
  },
  { 
    id: 'page', 
    icon: ({ className }) => (
      <span className={`material-symbols-outlined leading-none select-none ${className || 'text-[16px]'}`}>
        assignment
      </span>
    ), 
    label: 'Page' 
  },
  { 
    id: 'chat', 
    icon: ({ className }) => (
      <span className={`material-symbols-outlined leading-none select-none ${className || 'text-[16px]'}`}>
        chat
      </span>
    ), 
    label: 'Chat' 
  }
];

const SearchPalette = ({ isOpen, onClose, recentPages = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { workspaceTree, loadWorkspaceData } = useContext(EditorContext);
  const { loadSession } = useContext(ChatContext) || {};
  const [chatSessions, setChatSessions] = useState([]);
  const navigate = useNavigate();

  const hasQuery = searchQuery && searchQuery.trim().length > 0;

  const { groupedResults, flatSelectable } = useMemo(() => {
    if (!searchQuery.trim()) return { groupedResults: [], flatSelectable: [] };
    
    const searchLower = searchQuery.toLowerCase();
    
    const groups = []; 
    const selectable = [];

    if (workspaceTree && workspaceTree.length > 0) {
      for (const ws of workspaceTree) {
        if (ws.type !== 'workspace') continue;
        
        const wsMatch = ws.name && ws.name.toLowerCase().includes(searchLower);
        const wsPassesFilter = !selectedCircle || selectedCircle === 'workspace';
        const isWorkspaceMatch = wsMatch && wsPassesFilter;
        
        const matchedItems = [];
        
        const traverseInside = (nodes) => {
          for (const child of nodes) {
            const childMatch = child.name && child.name.toLowerCase().includes(searchLower);
            const childPassesFilter = !selectedCircle || child.type === selectedCircle;
            
            const shouldIncludeFromParentMatch = isWorkspaceMatch && childPassesFilter;
            
            if ((childMatch && childPassesFilter) || shouldIncludeFromParentMatch) {
               matchedItems.push(child);
            }
            
            if (child.children) {
               traverseInside(child.children);
            }
          }
        };
        
        if (ws.children) {
           traverseInside(ws.children);
        }
        
        if (isWorkspaceMatch || matchedItems.length > 0) {
           // Deduplicate items just in case
           const uniqueItems = Array.from(new Set(matchedItems));
           groups.push({
             workspace: ws,
             isWorkspaceMatch: isWorkspaceMatch,
             items: uniqueItems
           });
           
           if (isWorkspaceMatch) selectable.push(ws);
           selectable.push(...uniqueItems);
        }
      }
    }
    
    // Add Recent Pages that are not already included in the workspace matches
    if (recentPages && recentPages.length > 0) {
      const recentMatches = recentPages.filter(p => {
         const match = p.name && p.name.toLowerCase().includes(searchLower);
         const passesFilter = !selectedCircle || selectedCircle === 'page' || p.type === selectedCircle;
         return match && passesFilter;
      });
      
      if (recentMatches.length > 0) {
         const newRecents = recentMatches.filter(r => !selectable.find(s => s.id === r.id));
         if (newRecents.length > 0) {
            groups.unshift({
               workspace: { id: 'recent_pages', name: 'Recent Pages', type: 'section' },
               isWorkspaceMatch: false,
               items: newRecents
            });
            selectable.unshift(...newRecents);
         }
      }
    }

    // Add Chat History matches
    if (chatSessions && chatSessions.length > 0) {
      const chatMatches = chatSessions.filter(s => {
        const title = s.title || "Untitled Chat";
        const match = title.toLowerCase().includes(searchLower);
        const passesFilter = !selectedCircle || selectedCircle === 'chat';
        return match && passesFilter;
      });

      if (chatMatches.length > 0) {
        const chatItems = chatMatches.map(s => ({
          id: s.sessionId,
          type: 'chat',
          name: s.title || 'Untitled Chat',
          path: '/dashboard/chat',
          sessionId: s.sessionId
        }));

        groups.push({
          workspace: { id: 'chat_history', name: 'Chat History', type: 'section' },
          isWorkspaceMatch: false,
          items: chatItems
        });
        selectable.push(...chatItems);
      }
    }
    
    return { groupedResults: groups, flatSelectable: selectable };
  }, [searchQuery, workspaceTree, selectedCircle, recentPages, chatSessions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatSelectable]);

  const getPlaceholder = () => {
    if (selectedCircle === 'workspace') return "Search workspace...";
    if (selectedCircle === 'folder') return "Search folder...";
    if (selectedCircle === 'page') return "Search page...";
    if (selectedCircle === 'chat') return "Search chats...";
    return "Search KagZ...";
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setIsExpanded(false); // Reset on open
      setSelectedCircle(null);

      // Quiet background fetch for workspace if not loaded
      if (!workspaceTree || workspaceTree.length === 0) {
        loadWorkspaceData?.().catch(() => {});
      }

      // Quiet background fetch for chat sessions
      chatAPI.getSessions().then((res) => {
        const sessions = res.data?.sessions || [];
        setChatSessions(sessions);
      }).catch(() => {});
    }
  }, [isOpen, workspaceTree, loadWorkspaceData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyK' || e.key?.toLowerCase() === 'k')) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Escape') {
        if (isExpanded && !hasQuery) {
          setIsExpanded(false);
        } else {
          onClose();
        }
        return;
      }
      
      if (e.key === 'Tab') {
        e.preventDefault();
        setIsExpanded(prev => !prev);
        return;
      }

      if (hasQuery && flatSelectable.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev < flatSelectable.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const result = flatSelectable[selectedIndex];
          if (result && result.path) {
            if (result.type === 'chat' && result.sessionId && loadSession) {
              loadSession(result.sessionId);
            }
            onClose();
            navigate(result.path);
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isExpanded, hasQuery, flatSelectable, selectedIndex, onClose, navigate]);

  if (!isOpen) return null;

  // Variants for the circles container to orchestrate staggering
  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.05
      }
    }
  };

  // Variants for individual circles
  const circleVariants = {
    hidden: { 
      opacity: 0, 
      x: -40, 
      scale: 0.8,
      transition: { ...springConfig, duration: 0.2 } 
    },
    show: { 
      opacity: 1, 
      x: 0, 
      scale: 1,
      transition: springConfig
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-[12vh] pointer-events-none">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/20 pointer-events-auto"
      />

      {/* Main Container that holds Pill + Circles */}
      <motion.div
        layout
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ 
          opacity: 1, 
          y: 0, 
          scale: 1
        }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={springConfig}
        className="relative flex items-start justify-start pointer-events-auto"
      >
        {/* The Pill / Box */}
        <motion.div
          layout
          initial={false}
          animate={{
            width: isExpanded && !hasQuery ? 320 : 720,
            borderRadius: hasQuery ? 24 : 30
          }}
          transition={springConfig}
          className="relative bg-white/40 dark:bg-black/70 backdrop-blur-[24px] border border-gray-200/50 dark:border-gray-600/50 shadow-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-none flex flex-col overflow-hidden shrink-0"
        >
          {/* Input Area */}
          <div className="flex items-center w-full px-6 py-4 h-[60px]">
            <AnimatePresence mode="popLayout">
              {!selectedCircle ? (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <i className="hgi hgi-stroke hgi-rounded hgi-search-01 text-[22px] leading-none text-gray-500 dark:text-gray-300 shrink-0 select-none"></i>
                </motion.div>
              ) : (
                <motion.div
                  key="filter"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setSelectedCircle(null)}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  title="Clear filter"
                >
                  {selectedCircle === 'workspace' && <span className="material-symbols-outlined text-[20px] leading-none text-blue-500 shrink-0 select-none">dashboard_2_add</span>}
                  {selectedCircle === 'folder' && <span className="material-symbols-outlined text-[20px] leading-none select-none text-blue-500 shrink-0">folder</span>}
                  {selectedCircle === 'page' && <span className="material-symbols-outlined text-[20px] leading-none text-blue-500 shrink-0 select-none">assignment</span>}
                  {selectedCircle === 'chat' && <span className="material-symbols-outlined text-[20px] leading-none text-blue-500 shrink-0 select-none">chat</span>}
                </motion.div>
              )}
            </AnimatePresence>

            <input 
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsExpanded(true)} // Toggles expansion when user interacts
              placeholder={getPlaceholder()}
              className="w-full bg-transparent border-none outline-none text-xl font-medium text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 ml-4"
            />
          </div>

          {/* Search Results Area */}
          <AnimatePresence>
            {hasQuery && (
              <motion.div
                layout
                initial="hidden"
                animate="show"
                exit="exit"
                variants={{
                  hidden: { height: 0, opacity: 0 },
                  show: {
                    height: "auto",
                    opacity: 1,
                    transition: {
                      height: springConfig,
                      opacity: { duration: 0.2 },
                      staggerChildren: 0.04,
                      delayChildren: 0.05
                    }
                  },
                  exit: {
                    height: 0,
                    opacity: 0,
                    transition: {
                      height: springConfig,
                      opacity: { duration: 0.2 },
                      staggerChildren: 0.03,
                      staggerDirection: -1
                    }
                  }
                }}
                className="w-full border-t border-gray-600/30"
              >
                <div className="p-4 flex flex-col gap-1 max-h-[350px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {/* Category Filter Pills */}
                  <motion.div 
                    variants={{
                      hidden: { opacity: 0, y: -10 },
                      show: { opacity: 1, y: 0 },
                      exit: { opacity: 0, y: -10 }
                    }}
                    className="flex items-center flex-wrap gap-2 px-2 pb-3 mb-2 border-b border-gray-200 dark:border-gray-600/30"
                  >
                    {circlesData.map((item) => {
                      const isActive = selectedCircle === item.id;
                      const Icon = item.icon;
                      return (
                        <button 
                          key={item.id} 
                          type="button"
                          onClick={() => setSelectedCircle(isActive ? null : item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 leading-normal rounded-[8px] border-[0.1px] text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                            isActive 
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400' 
                              : 'bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 border-gray-300 dark:border-gray-400/20 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <Icon className="text-[14px] shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </motion.div>

                  <motion.div 
                    variants={{
                      hidden: { opacity: 0 },
                      show: { opacity: 1 },
                      exit: { opacity: 0 }
                    }}
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2 py-2 mb-1"
                  >
                    {groupedResults.length > 0 ? "Results" : "No results found"}
                  </motion.div>
                  
                  {groupedResults.map((group) => {
                    const ws = group.workspace;
                    // Find index of workspace in flatSelectable if it matched
                    const wsIndex = group.isWorkspaceMatch ? flatSelectable.findIndex(n => n.id === ws.id) : -1;
                    const isWsSelected = wsIndex === selectedIndex;
                    
                    return (
                      <div key={ws.id} className="mb-4 last:mb-0 flex flex-col gap-1">
                        {/* Workspace Header */}
                        {group.isWorkspaceMatch ? (
                          <motion.div 
                            onMouseEnter={() => setSelectedIndex(wsIndex)}
                            onClick={() => {
                              if (ws.path) { onClose(); navigate(ws.path); }
                            }}
                            variants={{
                              hidden: { opacity: 0, y: -5 },
                              show: { opacity: 1, y: 0, transition: springConfig },
                              exit: { opacity: 0 }
                            }}
                            className={`relative z-10 flex items-center px-4 py-3 rounded-[12px] cursor-pointer transition-colors text-gray-800 dark:text-gray-200 ${
                              isWsSelected ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-100' : 'hover:bg-gray-100 dark:hover:bg-white/10'
                            }`}
                          >
                            <div className={`mr-3 w-[20px] h-[20px] flex items-center justify-center shrink-0 ${isWsSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                              <span className="material-symbols-outlined text-[18px] leading-none select-none">dashboard_2_add</span>
                            </div>
                            <div className="flex flex-col">
                              <span className={`truncate text-[15px] font-medium ${isWsSelected ? 'text-blue-900 dark:text-blue-50' : 'text-black dark:text-white'}`}>{ws.name}</span>
                              <span className={`text-[12px] capitalize ${isWsSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>Workspace</span>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div 
                            variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                            className="relative z-10 flex items-center px-4 py-2 text-gray-500 dark:text-gray-400 bg-white/40 dark:bg-black/40 rounded-lg"
                          >
                            <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 mr-2 opacity-70">
                              {ws.id === 'recent_pages' ? (
                                <span className="material-symbols-outlined text-[14px] leading-none select-none">assignment</span>
                              ) : ws.id === 'chat_history' ? (
                                <span className="material-symbols-outlined text-[14px] leading-none select-none">chat</span>
                              ) : (
                                <span className="material-symbols-outlined text-[14px] leading-none select-none">dashboard_2_add</span>
                              )}
                            </div>
                            <span className="text-[13px] font-medium tracking-wide">{ws.name}</span>
                            <span className="ml-2 text-[11px] uppercase tracking-wider opacity-50">Context</span>
                          </motion.div>
                        )}

                        {/* Children / Folders */}
                        {group.items.length > 0 && (
                          <motion.div 
                            className="relative z-0 ml-6 mt-1 border-l-2 border-gray-100 dark:border-gray-800/60 pl-3 flex flex-col gap-1"
                            variants={{
                              hidden: {},
                              show: { transition: { staggerChildren: 0.06, delayChildren: 0.02 } }
                            }}
                          >
                            {group.items.map((item) => {
                              const itemIdx = flatSelectable.findIndex(n => n.id === item.id);
                              const isSelected = itemIdx === selectedIndex;
                              return (
                                <motion.div 
                                  key={item.id}
                                  onMouseEnter={() => setSelectedIndex(itemIdx)}
                                  onClick={() => {
                                    if (item.type === 'chat' && item.sessionId && loadSession) {
                                      loadSession(item.sessionId);
                                    }
                                    if (item.path) { onClose(); navigate(item.path); }
                                  }}
                                  variants={{
                                    hidden: { opacity: 0, y: -20, scale: 0.96 },
                                    show: { opacity: 1, y: 0, scale: 1, transition: springConfig },
                                    exit: { opacity: 0, y: -10, scale: 0.96, transition: { duration: 0.1 } }
                                  }}
                                  className={`flex items-center px-4 py-2.5 rounded-[12px] cursor-pointer transition-colors text-gray-800 dark:text-gray-200 ${
                                    isSelected ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-900 dark:text-blue-100' : 'hover:bg-gray-100 dark:hover:bg-white/10'
                                  }`}
                                >
                                  <div className={`mr-3 w-[18px] h-[18px] flex items-center justify-center shrink-0 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {item.type === 'workspace' && <span className="material-symbols-outlined text-[15px] leading-none select-none">dashboard_2_add</span>}
                                    {item.type === 'folder' && <span className="material-symbols-outlined text-[16px] leading-none select-none">folder</span>}
                                    {(item.type === 'page' || item.type === 'document') && <span className="material-symbols-outlined text-[15px] leading-none select-none">assignment</span>}
                                    {item.type === 'chat' && <span className="material-symbols-outlined text-[15px] leading-none select-none">chat</span>}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={`truncate text-[14px] font-medium ${isSelected ? 'text-blue-900 dark:text-blue-50' : 'text-black dark:text-white'}`}>{item.name}</span>
                                    <span className={`text-[11.5px] capitalize ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>{item.type}</span>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* The Emerging Circles */}
        <AnimatePresence>
          {isExpanded && !hasQuery && (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="absolute left-[336px] top-0 flex items-center gap-3 h-[60px]"
            >
              {circlesData.map((item) => {
                const isSelected = selectedCircle === item.id;
                return (
                  <motion.button
                    key={item.id}
                    variants={circleVariants}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }} // 94% compression as requested
                    onClick={() => {
                      setSelectedCircle(isSelected ? null : item.id);
                      if (!isSelected) {
                        // Keep it expanded if we select a filter, but we could close it if needed
                        inputRef.current?.focus();
                      }
                    }}
                    className={`w-[60px] h-[60px] rounded-full flex items-center justify-center border shadow-lg transition-colors duration-200 ${
                      isSelected 
                        ? 'bg-black border-black text-white dark:bg-white dark:border-white dark:text-black' 
                        : 'bg-white/40 dark:bg-black/70 backdrop-blur-[24px] border-gray-200/50 dark:border-gray-400/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-none text-gray-600 dark:text-gray-300 hover:bg-white/60 dark:hover:bg-gray-800/80'
                    }`}
                    title={item.label}
                  >
                    <item.icon className="text-[22px]" />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
};

export default SearchPalette;
