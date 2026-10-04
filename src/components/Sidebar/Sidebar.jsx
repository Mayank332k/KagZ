import { useState, useEffect, useRef, useContext, useCallback } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChatContext } from "../../context/ChatContextDefinition";
import { EditorContext } from "../../context/EditorContext";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "next-themes";
import { PanelLeft, SquarePen, Sparkles } from "lucide-react";
import { CursorTextIcon, SlidersHorizontalIcon } from "hugeicons-react";

import ActionModal from "../UI/ActionModal";
import LocationDropdown from "../UI/LocationDropdown";
import SearchPalette from "../UI/SearchPalette";
import {
  workspacesAPI,
  foldersAPI,
  pagesAPI,
  chatAPI,
} from "../../services/api";
import { useToast } from "../../context/ToastContext";
import useSectionLoader from "../../hooks/useSectionLoader";
import SectionErrorState from "../UI/SectionErrorState";

const AI_PERSONA_OPTIONS = [
  {
    id: "professional",
    label: "Professional",
    badge: "Default",
    desc: "Direct, structured, concise, and professional. Zero filler words or conversational pleasantries.",
    icon: "work",
  },
  {
    id: "playful_friend",
    label: "Playful Friend",
    badge: "Warm & Witty",
    desc: "Warm, witty, and conversational like an insightful close friend. Natural phrasing and fitting humor.",
    icon: "sentiment_very_satisfied",
  },
  {
    id: "concise",
    label: "Concise",
    badge: "Dense & Crisp",
    desc: "Extremely dense, bullet-point focused, 1-2 sentence answers. Straight to the point.",
    icon: "bolt",
  },
  {
    id: "socratic_mentor",
    label: "Socratic Mentor",
    badge: "Pedagogical",
    desc: "Encouraging teacher. Guides step-by-step using mental models, analogies, and intuitive questions.",
    icon: "school",
  },
  {
    id: "creative",
    label: "Creative Partner",
    badge: "Exploratory",
    desc: "Imaginative and enthusiastic. Offers novel angles, vivid phrasing, and creative brainstorming.",
    icon: "lightbulb",
  },
];

const SidebarSkeletonItem = () => (
  <div className="flex items-center w-full py-1.5 px-3 mb-0.5 animate-pulse">
    <div className="w-[18px] h-[18px] rounded bg-gray-200/60 dark:bg-white/10 mr-2.5 shrink-0" />
    <div className="h-[14px] bg-gray-200/60 dark:bg-white/10 rounded w-3/5" />
  </div>
);

const Sidebar = () => {
  const { user, logout, updatePreferences } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const {
    isRightChatOpen,
    setIsRightChatOpen,
    loadSession,
    sessionId,
    clearChat,
    chatStartupMode,
    setChatStartupMode,
    isThinking,
    setIsThinking,
  } = useContext(ChatContext);
  const {
    isPageOpen,
    workspaceTree,
    setWorkspaceTree,
    recentPages,
    favoriteItems,
    loadWorkspaceData,
    selectedLocation,
    setSelectedLocation,
    selectedPath,
    setSelectedPath,
    refreshSidebarTrigger,
    triggerSidebarRefresh,
  } = useContext(EditorContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [expandedFolders, setExpandedFolders] = useState({
    "favorites-section": false,
    "workspaces-section": false,
    "recent-section": true,
    "chat-history-section": false,
  });
  const [expandedFavoriteFolders, setExpandedFavoriteFolders] = useState({});
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  const {
    sectionStates,
    loadSection,
    invalidateSection,
    updateSectionData,
  } = useSectionLoader();

  const searchInputRef = useRef(null);
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    let lastTriggerTime = 0;
    const handleGlobalKeyDown = (e) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const isKeyK =
        e.code === "KeyK" ||
        e.key === "k" ||
        e.key === "K" ||
        e.keyCode === 75 ||
        e.which === 75;

      // Cmd/Ctrl + K or Option + S to toggle search
      if (isCmdOrCtrl && isKeyK) {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTriggerTime > 150) {
          lastTriggerTime = now;
          setIsSearchActive((prev) => !prev);
        }
        return;
      }
      if (e.altKey && (e.code === "KeyS" || e.key === "s" || e.key === "S" || e.keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTriggerTime > 150) {
          lastTriggerTime = now;
          setIsSearchActive((prev) => !prev);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    document.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
      document.removeEventListener("keydown", handleGlobalKeyDown, true);
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem("noema-sidebar-width"));
    return Number.isFinite(savedWidth) ? Math.min(600, Math.max(200, savedWidth)) : 288;
  });
  const isResizing = useRef(false);
  const resizeCleanupRef = useRef(null);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspacePos, setNewWorkspacePos] = useState({ top: 0, left: 0 });

  const [showSettingsCard, setShowSettingsCard] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState("preferences");
  const [settingsSearchQuery, setSettingsSearchQuery] = useState("");
  const [extraContrast, setExtraContrast] = useState(() => localStorage.getItem("noema-high-contrast") === "true");
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem("noema-font-size") || "16", 10));
  const [cookiePrefs, setCookiePrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("noema-cookie-prefs") || '{"essential":true,"analytics":false,"marketing":false}'); }
    catch { return { essential: true, analytics: false, marketing: false }; }
  });
  const [showCookiePanel, setShowCookiePanel] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showStartupDropdown, setShowStartupDropdown] = useState(false);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem("noema-font-family") || "sans");
  const [spellCheck, setSpellCheck] = useState(() => localStorage.getItem("noema-spellcheck") === "true");
  const [storageUsage, setStorageUsage] = useState("0 B");
  const [aiPersona, setAiPersona] = useState(() => user?.preferences?.aiPersona || "professional");
  const [aiCustomInstructions, setAiCustomInstructions] = useState(() => user?.preferences?.customInstructions || "");
  const [isSavingAiPrefs, setIsSavingAiPrefs] = useState(false);

  useEffect(() => {
    if (user?.preferences) {
      if (user.preferences.aiPersona) setAiPersona(user.preferences.aiPersona);
      if (user.preferences.customInstructions !== undefined) setAiCustomInstructions(user.preferences.customInstructions);
    }
  }, [user?.preferences]);

  const countWords = (text) => {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  };

  const handleSaveAiPrefs = async () => {
    if (isSavingAiPrefs) return;
    setIsSavingAiPrefs(true);
    try {
      await updatePreferences({
        aiPersona,
        customInstructions: aiCustomInstructions,
      });
      showToast("AI preferences saved successfully!", "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to save AI preferences", "error");
    } finally {
      setIsSavingAiPrefs(false);
    }
  };

  // Calculate real localStorage usage
  const calcStorageUsage = () => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      total += (key.length + (localStorage.getItem(key) || "").length) * 2; // UTF-16
    }
    if (total < 1024) return `${total} B`;
    if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
    return `${(total / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Apply font size to document
  useEffect(() => {
    document.documentElement.style.setProperty("--noema-font-size", `${fontSize}px`);
    const currentStored = Number(localStorage.getItem("noema-font-size"));
    if (currentStored !== fontSize) {
      localStorage.setItem("noema-font-size", String(fontSize));
      window.dispatchEvent(new Event("noema-font-size-changed"));
    }
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("noema-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

  // Apply font family to document
  useEffect(() => {
    localStorage.setItem("noema-font-family", fontFamily);
    if (fontFamily === 'serif') {
      document.documentElement.style.setProperty('--font-sans', 'ui-serif, Georgia, serif');
    } else if (fontFamily === 'mono') {
      document.documentElement.style.setProperty('--font-sans', 'ui-monospace, SFMono-Regular, monospace');
    } else if (fontFamily === 'system') {
      document.documentElement.style.setProperty('--font-sans', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');
    } else {
      document.documentElement.style.setProperty('--font-sans', 'system-ui, "Inter", "Segoe UI", Roboto, sans-serif');
    }
  }, [fontFamily]);

  // Handle spellcheck global change
  useEffect(() => {
    localStorage.setItem("noema-spellcheck", String(spellCheck));
    window.dispatchEvent(new Event("noema-spellcheck-changed"));
  }, [spellCheck]);

  // Apply high contrast to document
  useEffect(() => {
    if (extraContrast) {
      document.documentElement.classList.add("noema-high-contrast");
    } else {
      document.documentElement.classList.remove("noema-high-contrast");
    }
    localStorage.setItem("noema-high-contrast", String(extraContrast));
  }, [extraContrast]);

  // Update storage usage when settings modal opens
  useEffect(() => {
    if (showSettingsCard) setStorageUsage(calcStorageUsage());
  }, [showSettingsCard, settingsTab]);

  const handleFontSizeChange = (delta) => {
    setFontSize((prev) => Math.min(24, Math.max(12, prev + delta)));
  };

  const handleCookieToggle = (key) => {
    if (key === "essential") return; // essential cookies can't be disabled
    setCookiePrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem("noema-cookie-prefs", JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearStorage = () => {
    const preserveKeys = [
      "theme",
      "noema-font-size",
      "noema-high-contrast",
      "noema-cookie-prefs",
      "noema-font-family",
      "noema-spellcheck",
      "noema-chat-model",
      "noema-chat-thinking",
      "noema-chat-startup-mode",
      "noema-last-route",
      "noema-sidebar-width",
    ];
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!preserveKeys.includes(key)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
    setStorageUsage(calcStorageUsage());
    setShowClearDataModal(false);
  };

  const [modalState, setModalState] = useState({
    isOpen: false,
    action: null, // 'ADD_PAGE', 'ADD_FOLDER', 'RENAME', 'DELETE'
    nodeId: null,
    initialValue: "",
  });
  const [createPageLocation, setCreatePageLocation] = useState(null);
  const [createPagePath, setCreatePagePath] = useState([]);

  const [activeAddMenu, setActiveAddMenu] = useState(null);
  const [addMenuPos, setAddMenuPos] = useState({ top: 0, left: 0 });



  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenu(null);
      setActiveAddMenu(null);
      setShowNewWorkspaceModal(false);
      setShowSettingsCard(false);
      setShowFontDropdown(false);
      setIsNewMenuOpen(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchActive]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const topNavItems = [
    {
      id: "home",
      label: "Home",
      path: "/dashboard/home",
      icon: () => (
        <span className="material-symbols-outlined text-[19px] leading-none select-none">
          home
        </span>
      ),
    },
    {
      id: "chat",
      label: "Chat",
      path: "/dashboard/chat",
      icon: () => (
        <span className="material-symbols-outlined text-[19px] leading-none select-none">
          chat
        </span>
      ),
    },
    {
      id: "tasks",
      label: "Tasks",
      path: "/dashboard/tasks",
      icon: () => (
        <span className="material-symbols-outlined text-[19px] leading-none select-none">
          checklist
        </span>
      ),
    },
  ];

  const isHomeActive = () => {
    return location.pathname === "/dashboard/home" || location.pathname === "/dashboard/home/";
  };

  // Real API-backed tree state
  const [mockTree, setMockTree] = useState([]);
  const [mockRecent, setMockRecent] = useState([]);
  const [mockFavorites, setMockFavorites] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(true);

  // Sync background-loaded workspace, recent, and favorites from EditorContext
  useEffect(() => {
    if (workspaceTree && workspaceTree.length > 0) {
      setMockTree(workspaceTree);
      updateSectionData("workspaces-section", workspaceTree);
    }
  }, [workspaceTree, updateSectionData]);

  useEffect(() => {
    if (recentPages && recentPages.length > 0) {
      setMockRecent(recentPages);
      updateSectionData("recent-section", recentPages);
    }
  }, [recentPages, updateSectionData]);

  useEffect(() => {
    if (favoriteItems && favoriteItems.length > 0) {
      setMockFavorites(favoriteItems);
      setExpandedFavoriteFolders(
        favoriteItems.reduce((expanded, node) => {
          if (node.type === "workspace" || node.type === "folder") {
            expanded[node.id] = true;
          }
          return expanded;
        }, {}),
      );
      updateSectionData("favorites-section", favoriteItems);
    }
  }, [favoriteItems, updateSectionData]);

  // Modular event-based section loaders reusing background workspace response
  const loadWorkspacesSection = useCallback(async (force = false) => {
    return loadSection("workspaces-section", async () => {
      const data = await loadWorkspaceData(force);
      return data.workspaceTree;
    }, { force });
  }, [loadSection, loadWorkspaceData]);

  const loadRecentSection = useCallback(async (force = false) => {
    return loadSection("recent-section", async () => {
      if (!force && recentPages && recentPages.length > 0) {
        setMockRecent(recentPages);
        return recentPages;
      }
      const data = await loadWorkspaceData(force);
      return data.recentPages;
    }, { force });
  }, [loadSection, recentPages, loadWorkspaceData]);

  const loadFavoritesSection = useCallback(async (force = false) => {
    return loadSection("favorites-section", async () => {
      if (!force && favoriteItems && favoriteItems.length > 0) {
        setMockFavorites(favoriteItems);
        return favoriteItems;
      }
      const data = await loadWorkspaceData(force);
      return data.favoriteItems;
    }, { force });
  }, [loadSection, favoriteItems, loadWorkspaceData]);

  const loadChatHistorySection = useCallback(async (force = false) => {
    return loadSection("chat-history-section", async () => {
      const res = await chatAPI.getSessions();
      const sessions = res.data.sessions || [];
      setChatSessions(sessions);
      return sessions;
    }, { force });
  }, [loadSection]);

  // Refetch only active/open sections when refreshSidebarTrigger occurs
  useEffect(() => {
    if (!refreshSidebarTrigger) return;
    if (expandedFolders["recent-section"]) loadRecentSection(true);
    if (expandedFolders["workspaces-section"]) loadWorkspacesSection(true);
    if (expandedFolders["favorites-section"]) loadFavoritesSection(true);
    if (expandedFolders["chat-history-section"]) loadChatHistorySection(true);
  }, [refreshSidebarTrigger]);

  // Load sections if user types in search so results are populated
  useEffect(() => {
    if (debouncedSearchQuery) {
      loadRecentSection();
      loadWorkspacesSection();
      loadFavoritesSection();
      loadChatHistorySection();
    }
  }, [debouncedSearchQuery]);

  // Load recent section on initial load since it is open by default
  useEffect(() => {
    loadRecentSection();
  }, [loadRecentSection]);

  useEffect(() => {
    const handleOptimisticDelete = (e) => {
      const pageId = e.detail;
      setMockTree((prev) => {
        const removeNode = (nodes) => {
          return nodes
            .map((node) => {
              if (node.children) {
                return {
                  ...node,
                  children: removeNode(node.children).filter(
                    (c) => c.id !== pageId,
                  ),
                };
              }
              return node;
            })
            .filter((node) => node.id !== pageId);
        };
        const next = removeNode(prev);
        setWorkspaceTree(next);
        return next;
      });
      setMockRecent((prev) => prev.filter((p) => p.id !== pageId));
      setMockFavorites((prev) => prev.filter((p) => p.id !== pageId));
    };

    const handleOptimisticAdd = (e) => {
      const newPage = e.detail;
      setMockRecent((prev) => [newPage, ...prev].slice(0, 6));
      setMockTree((prev) => {
        const workspaceId = newPage.workspaceId;
        if (!workspaceId) {
          setWorkspaceTree(prev);
          return prev;
        }

        const hasWorkspace = prev.some((ws) => ws.id === workspaceId);
        if (!hasWorkspace) {
          setWorkspaceTree(prev);
          return prev;
        }

        const next = prev.map((ws) => {
          if (ws.id !== workspaceId) return ws;

          if (newPage.folderId) {
            return {
              ...ws,
              children: ws.children.map((child) => {
                if (child.id === newPage.folderId && child.type === "folder") {
                  return {
                    ...child,
                    children: [...(child.children || []), newPage],
                  };
                }
                return child;
              }),
            };
          } else {
            return { ...ws, children: [...(ws.children || []), newPage] };
          }
        });
        setWorkspaceTree(next);
        return next;
      });
    };

    window.addEventListener("optimistic-delete-page", handleOptimisticDelete);
    window.addEventListener("optimistic-add-page", handleOptimisticAdd);
    return () => {
      window.removeEventListener(
        "optimistic-delete-page",
        handleOptimisticDelete,
      );
      window.removeEventListener("optimistic-add-page", handleOptimisticAdd);
    };
  }, [setWorkspaceTree]);

  const findNode = (id) => {
    const search = (nodes) => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };

    const foundInRecent = search(mockRecent);
    if (foundInRecent) return foundInRecent;

    const foundInFavs = search(mockFavorites);
    if (foundInFavs) return foundInFavs;

    const foundInChat = chatSessions.find((s) => s.sessionId === id);
    if (foundInChat)
      return {
        id: foundInChat.sessionId,
        type: "chat",
        name: foundInChat.title,
      };

    return search(mockTree);
  };

  const findWorkspaceIdForNode = (id) => {
    for (const workspace of mockTree) {
      if (workspace.id === id) return workspace.id;

      const searchChildren = (nodes = []) => {
        for (const node of nodes) {
          if (node.id === id) return workspace.id;
          const found = searchChildren(node.children);
          if (found) return found;
        }
        return null;
      };

      const found = searchChildren(workspace.children);
      if (found) return found;
    }
    return null;
  };

  const toggleFolder = (id) => {
    const willOpen = !expandedFolders[id];
    setExpandedFolders((prev) => ({ ...prev, [id]: willOpen }));

    if (willOpen) {
      if (id === "recent-section") {
        loadRecentSection();
      } else if (id === "workspaces-section") {
        loadWorkspacesSection();
      } else if (id === "favorites-section") {
        loadFavoritesSection();
      } else if (id === "chat-history-section") {
        loadChatHistorySection();
      }
    }
  };

  const toggleFavoriteFolder = (id) => {
    setExpandedFavoriteFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleMenuClick = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    if (activeMenu === id) {
      setActiveMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPos({ top: rect.top, left: rect.right + 8 });
      setActiveMenu(id);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    try {
      const res = await workspacesAPI.create(newWorkspaceName.trim());
      if (res.data.success) {
        const ws = res.data.workspace;
        const newNode = {
          id: ws._id,
          type: "workspace",
          name: ws.name,
          children: [],
        };
        setMockTree((prev) => {
          const next = [...prev, newNode];
          setWorkspaceTree(next);
          return next;
        });
        setExpandedFolders((prev) => ({
          ...prev,
          [ws._id]: true,
          "workspaces-section": true,
        }));
      }
    } catch (err) {
      console.error("Create workspace failed:", err);
    }
    setNewWorkspaceName("");
    setShowNewWorkspaceModal(false);
  };

  const handleModalConfirm = async (inputValue, selectedPageType) => {
    const { action, nodeId } = modalState;
    const targetNodeId =
      nodeId || (action === "ADD_PAGE" ? createPageLocation?.id : null);
    if (!targetNodeId) return false;

    try {
      if (action === "DELETE") {
        // Determine type by finding the node
        const node = findNode(targetNodeId);
        if (node?.type === "workspace")
          await workspacesAPI.delete(targetNodeId);
        else if (node?.type === "folder") await foldersAPI.delete(targetNodeId);
        else if (node?.type === "page") await pagesAPI.delete(targetNodeId);
        else if (node?.type === "chat") {
          const res = await chatAPI.clearHistory(targetNodeId);
          if (res.data.success) {
            setChatSessions((prev) =>
              prev.filter((s) => s.sessionId !== targetNodeId),
            );
            if (sessionId === targetNodeId) clearChat();
          }
          return true;
        }

        const deleteRecursive = (nodes) =>
          nodes
            .filter((n) => n.id !== targetNodeId)
            .map((n) => ({
              ...n,
              children: n.children ? deleteRecursive(n.children) : undefined,
            }));
        setMockTree((prev) => {
          const next = deleteRecursive(prev);
          setWorkspaceTree(next);
          return next;
        });
        setMockRecent((prev) => prev.filter((n) => n.id !== targetNodeId));
        setMockFavorites((prev) => prev.filter((n) => n.id !== targetNodeId));
        return true;
      } else if (action === "RENAME") {
        if (!inputValue) return false;
        const node = findNode(targetNodeId);
        if (node?.type === "workspace")
          await workspacesAPI.update(targetNodeId, { name: inputValue });
        else if (node?.type === "folder")
          await foldersAPI.update(targetNodeId, { name: inputValue });
        else if (node?.type === "page")
          await pagesAPI.update(targetNodeId, { title: inputValue });

        const renameRecursive = (nodes) =>
          nodes.map((n) => {
            if (n.id === targetNodeId) return { ...n, name: inputValue };
            if (n.children)
              return { ...n, children: renameRecursive(n.children) };
            return n;
          });
        setMockTree((prev) => {
          const next = renameRecursive(prev);
          setWorkspaceTree(next);
          return next;
        });
        setMockRecent((prev) =>
          prev.map((n) =>
            n.id === targetNodeId ? { ...n, name: inputValue } : n,
          ),
        );
        setMockFavorites((prev) =>
          prev.map((n) =>
            n.id === targetNodeId ? { ...n, name: inputValue } : n,
          ),
        );
        return true;
      } else if (action === "ADD_FOLDER" || action === "ADD_PAGE") {
        if (!inputValue) return false;
        const parentNode = findNode(targetNodeId);
        const workspaceId =
          parentNode?.type === "workspace"
            ? targetNodeId
            : parentNode?.workspaceId || findWorkspaceIdForNode(targetNodeId);

        if (!workspaceId) return false;

        if (action === "ADD_FOLDER") {
          const parentId = parentNode?.type === "folder" ? targetNodeId : null;
          const res = await foldersAPI.create(
            inputValue,
            workspaceId,
            parentId,
          );
          const folder = res.data.folder;
          const newNode = {
            id: folder._id,
            type: "folder",
            name: folder.name,
            children: [],
          };
          const addRecursive = (nodes) =>
            nodes.map((n) => {
              if (n.id === targetNodeId)
                return { ...n, children: [...(n.children || []), newNode] };
              if (n.children)
                return { ...n, children: addRecursive(n.children) };
              return n;
            });
          setMockTree((prev) => {
            const next = addRecursive(prev);
            setWorkspaceTree(next);
            return next;
          });
        } else {
          const folderId = parentNode?.type === "folder" ? targetNodeId : null;
          const res = await pagesAPI.create({
            title: inputValue,
            workspaceId,
            folderId,
            type: selectedPageType || "document",
          });
          const page = res.data.page;
          const newNode = {
            id: page._id,
            type: "page",
            name: page.title,
            path: `/dashboard/page/${page._id}`,
            isFavorite: page.isFavorite,
            updatedAt: page.updatedAt,
            isGlobal: folderId === null,
          };
          const addRecursive = (nodes) =>
            nodes.map((n) => {
              if (n.id === targetNodeId)
                return { ...n, children: [...(n.children || []), newNode] };
              if (n.children)
                return { ...n, children: addRecursive(n.children) };
              return n;
            });
          setMockTree((prev) => {
            const next = addRecursive(prev);
            setWorkspaceTree(next);
            return next;
          });
          setMockRecent((prev) =>
            [newNode, ...prev.filter((node) => node.id !== newNode.id)]
              .sort(
                (a, b) =>
                  new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
              )
              .slice(0, 6),
          );
          navigate(newNode.path);
        }
        setExpandedFolders((prev) => ({
          ...prev,
          [targetNodeId]: true,
          [workspaceId]: true,
          "workspaces-section": true,
        }));
        setCreatePageLocation(null);
        setCreatePagePath([]);
        return true;
      }
    } catch (err) {
      console.error("Modal action failed:", err);
      showToast("The sidebar action failed. Please try again.", "error");
      return false;
    }
    return false;
  };

  if (isCollapsed) {
    return (
      <>
        <div className="h-screen w-12 bg-[#f7f6f3] dark:bg-[var(--color-dark-sidebar)] flex flex-col items-center py-3 border-r border-[#e8e7e4] dark:border-[var(--color-dark-border)] transition-colors duration-300 relative z-50">
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-8 h-8 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded-md text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <PanelLeft className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
        <SearchPalette 
          isOpen={isSearchActive}
          onClose={() => setIsSearchActive(false)}
          recentPages={mockRecent}
        />
      </>
    );
  }

  const renderMenuDropdown = () => {
    if (!activeMenu) return null;
    const node = findNode(activeMenu);
    if (!node) return null;

    if (node.type === "chat") {
      return (
        <div
          className="fixed bg-[#ffffff] dark:bg-[var(--color-dark-sidebar)] rounded-lg shadow-xl border border-gray-200 dark:border-[var(--color-dark-border)] py-1.5 z-[100] text-[15px] font-sans"
          style={{ top: menuPos.top, left: menuPos.left, width: "14rem" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 flex items-center transition-colors"
            onClick={() => {
              setActiveMenu(null);
              setModalState({
                isOpen: true,
                action: "DELETE",
                nodeId: node.id,
                initialValue: "",
              });
            }}
          >
            <span className="material-symbols-outlined text-[16px] leading-none select-none mr-2">delete</span> Delete Chat
          </button>
        </div>
      );
    }

    return (
      <div
        className="fixed bg-[#ffffff] dark:bg-[var(--color-dark-sidebar)] rounded-lg shadow-xl border border-gray-200 dark:border-[var(--color-dark-border)] py-1.5 z-[100] text-[15px] font-sans"
        style={{ top: menuPos.top, left: menuPos.left, width: "14rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white transition-colors"
          onClick={async () => {
            setActiveMenu(null);
            try {
              const newFavStatus = !node.isFavorite;
              if (node.type === "workspace") {
                await workspacesAPI.update(node.id, {
                  isFavorite: newFavStatus,
                });
              } else if (node.type === "folder") {
                await foldersAPI.update(node.id, { isFavorite: newFavStatus });
              } else if (node.type === "page") {
                await pagesAPI.update(node.id, { isFavorite: newFavStatus });
              }
              triggerSidebarRefresh();
            } catch (error) {
              console.error("Failed to toggle favorite:", error);
            }
          }}
        >
          <span className={`material-symbols-outlined text-[18px] leading-none select-none mr-2 ${node.isFavorite ? "text-yellow-400 fill-yellow-400" : "text-gray-400"}`}>star</span>
          {node.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        </button>
        <div className="h-px bg-gray-200 dark:bg-[var(--color-dark-border)] my-1"></div>
        {(node.type === "workspace" || node.type === "folder") && (
          <>
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white transition-colors"
              onClick={() => {
                setActiveMenu(null);
                setModalState({
                  isOpen: true,
                  action: "ADD_PAGE",
                  nodeId: node.id,
                  initialValue: "",
                });
              }}
            >
              <span className="material-symbols-outlined text-[16px] leading-none select-none mr-2">note_add</span> New Page
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white transition-colors"
              onClick={() => {
                setActiveMenu(null);
                setModalState({
                  isOpen: true,
                  action: "ADD_FOLDER",
                  nodeId: node.id,
                  initialValue: "",
                });
              }}
            >
              <span className="material-symbols-outlined text-[18px] leading-none select-none mr-2">folder</span> New Folder
            </button>
            <div className="h-px bg-gray-200 dark:bg-[var(--color-dark-border)] my-1"></div>
          </>
        )}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white transition-colors"
          onClick={() => {
            setActiveMenu(null);
            setModalState({
              isOpen: true,
              action: "RENAME",
              nodeId: node.id,
              initialValue: node.name,
            });
          }}
        >
          <span className="material-symbols-outlined text-[18px] leading-none select-none mr-2">edit</span> Rename
        </button>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600 dark:text-red-400 flex items-center transition-colors"
          onClick={() => {
            setActiveMenu(null);
            setModalState({
              isOpen: true,
              action: "DELETE",
              nodeId: node.id,
              initialValue: "",
            });
          }}
        >
          <span className="material-symbols-outlined text-[16px] leading-none select-none mr-2">delete</span> Delete
        </button>
      </div>
    );
  };

  const renderAddMenuDropdown = () => {
    if (!activeAddMenu) return null;

    return (
      <div
        className="fixed bg-[#ffffff] dark:bg-[var(--color-dark-sidebar)] rounded-lg shadow-xl border border-gray-200 dark:border-[var(--color-dark-border)] py-1.5 z-[100] text-[15px] font-sans"
        style={{ top: addMenuPos.top, left: addMenuPos.left, width: "12rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white transition-colors"
          onClick={() => {
            setActiveAddMenu(null);
            setModalState({
              isOpen: true,
              action: "ADD_PAGE",
              nodeId: activeAddMenu,
              initialValue: "",
            });
          }}
        >
          <span className="material-symbols-outlined text-[16px] leading-none select-none mr-2">note_add</span> New Page
        </button>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white transition-colors"
          onClick={() => {
            setActiveAddMenu(null);
            setModalState({
              isOpen: true,
              action: "ADD_FOLDER",
              nodeId: activeAddMenu,
              initialValue: "",
            });
          }}
        >
          <span className="material-symbols-outlined text-[18px] leading-none select-none mr-2">folder</span> New Folder
        </button>
      </div>
    );
  };

  const renderSettingsCard = () => {
    if (!showSettingsCard) return null;

    const joinedDate = user?.createdAt
      ? new Date(user.createdAt).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      : "Unknown";
    const avatar = user?.avatar || user?.profilePicture || null;
    const displayName = user?.username || user?.name || "User";

    const query = settingsSearchQuery.toLowerCase().trim();
    const matchesQuery = (text, desc = "") => {
      if (!query) return true;
      return text.toLowerCase().includes(query) || desc.toLowerCase().includes(query);
    };

    return createPortal(
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-[4px]"
        onClick={() => setShowSettingsCard(false)}
      >
        <div
          className="bg-[#191919] text-[#F0EFED] rounded-[12px] shadow-2xl border border-white/[0.06] flex w-[94vw] max-w-[1180px] h-[90vh] max-h-[820px] overflow-hidden text-sm relative"
          style={{ fontFamily: 'ui-sans-serif, -apple-system, system-ui, "Segoe UI Variable Display", "Segoe UI", Helvetica, Arial, sans-serif' }}
          onClick={(e) => {
            e.stopPropagation();
            setShowThemeDropdown(false);
            setShowStartupDropdown(false);
            setShowFontDropdown(false);
            setShowPersonaDropdown(false);
          }}
        >
          {/* Close button */}
          <button 
            onClick={() => setShowSettingsCard(false)} 
            className="absolute top-4 right-4 p-1 hover:bg-white/[0.08] rounded-[5px] transition-colors text-[#7D7A75] hover:text-[#F0EFED] z-20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px] leading-none select-none">close</span>
          </button>

          {/* Left Sidebar */}
          <div className="w-[270px] bg-[#202020] border-r border-white/[0.06] flex flex-col py-3.5 px-3 shrink-0 select-none">
            {/* Search settings (Beta) */}
            <div className="mb-2.5 px-0.5">
              <div className="flex items-center gap-2 h-[32px] px-[8px] bg-white/[0.03] border border-white/[0.08] rounded-[6px] text-[#7D7A75] focus-within:border-white/20 transition-colors">
                <span className="material-symbols-outlined text-[16px] select-none text-[#7D7A75] shrink-0">search</span>
                <input
                  type="text"
                  value={settingsSearchQuery}
                  onChange={(e) => setSettingsSearchQuery(e.target.value)}
                  placeholder="Search settings"
                  className="bg-transparent text-[13.5px] text-[#F0EFED] placeholder:text-[#7D7A75] outline-none w-full"
                />
                <span className="text-[10px] font-[500] text-[#7D7A75] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] select-none shrink-0">Beta</span>
              </div>
            </div>

            {/* Categories */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 pr-0.5">
              {/* Account Group */}
              <div className="flex flex-col gap-[2px]">
                <div className="px-[8px] pt-1.5 pb-1">
                  <span className="text-[12.5px] font-[500] leading-[18px] text-[#7D7A75]">Account</span>
                </div>
                <button
                  onClick={() => setSettingsTab("account")}
                  aria-current={settingsTab === "account" ? "page" : undefined}
                  className={`flex items-center gap-2.5 w-full px-[8px] py-[5px] h-[32px] rounded-[6px] text-[14.5px] font-[500] leading-[18px] transition-colors text-left cursor-pointer ${
                    settingsTab === "account"
                      ? "bg-white/[0.055] text-[#F0EFED]"
                      : "text-[#BCBAB6] hover:bg-white/[0.035] hover:text-[#F0EFED]"
                  }`}
                >
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-[20px] h-[20px] rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-[20px] h-[20px] rounded-full bg-[#303030] text-[#F0EFED] border border-white/10 flex items-center justify-center font-medium text-[11px] shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate">{displayName}</span>
                </button>
                <button
                  onClick={() => setSettingsTab("preferences")}
                  aria-current={settingsTab === "preferences" ? "page" : undefined}
                  className={`flex items-center gap-2.5 w-full px-[8px] py-[5px] h-[32px] rounded-[6px] text-[14.5px] font-[500] leading-[18px] transition-colors text-left cursor-pointer ${
                    settingsTab === "preferences"
                      ? "bg-white/[0.055] text-[#F0EFED]"
                      : "text-[#BCBAB6] hover:bg-white/[0.035] hover:text-[#F0EFED]"
                  }`}
                >
                  <SlidersHorizontalIcon size={16} strokeWidth={1.8} className={`shrink-0 ${settingsTab === "preferences" ? "text-[#F0EFED]" : "text-[#7D7A75]"}`} />
                  <span className="truncate">Preferences</span>
                </button>
              </div>

              {/* Workspace Group */}
              <div className="flex flex-col gap-[2px]">
                <div className="px-[8px] pt-1.5 pb-1">
                  <span className="text-[12.5px] font-[500] leading-[18px] text-[#7D7A75]">Workspace</span>
                </div>
                <button
                  onClick={() => setSettingsTab("typography")}
                  aria-current={settingsTab === "typography" ? "page" : undefined}
                  className={`flex items-center gap-2.5 w-full px-[8px] py-[5px] h-[32px] rounded-[6px] text-[14.5px] font-[500] leading-[18px] transition-colors text-left cursor-pointer ${
                    settingsTab === "typography"
                      ? "bg-white/[0.055] text-[#F0EFED]"
                      : "text-[#BCBAB6] hover:bg-white/[0.035] hover:text-[#F0EFED]"
                  }`}
                >
                  <CursorTextIcon size={16} strokeWidth={1.8} className={`shrink-0 ${settingsTab === "typography" ? "text-[#F0EFED]" : "text-[#7D7A75]"}`} />
                  <span className="truncate">Typography & Editor</span>
                </button>
                <button
                  onClick={() => setSettingsTab("privacy")}
                  aria-current={settingsTab === "privacy" ? "page" : undefined}
                  className={`flex items-center gap-2.5 w-full px-[8px] py-[5px] h-[32px] rounded-[6px] text-[14.5px] font-[500] leading-[18px] transition-colors text-left cursor-pointer ${
                    settingsTab === "privacy"
                      ? "bg-white/[0.055] text-[#F0EFED]"
                      : "text-[#BCBAB6] hover:bg-white/[0.035] hover:text-[#F0EFED]"
                  }`}
                >
                  <span className={`material-symbols-outlined text-[17px] leading-none select-none shrink-0 ${settingsTab === "privacy" ? "text-[#F0EFED]" : "text-[#7D7A75]"}`}>security</span>
                  <span className="truncate">Privacy & Data</span>
                </button>
                <button
                  onClick={() => setSettingsTab("ai")}
                  aria-current={settingsTab === "ai" ? "page" : undefined}
                  className={`flex items-center gap-2.5 w-full px-[8px] py-[5px] h-[32px] rounded-[6px] text-[14.5px] font-[500] leading-[18px] transition-colors text-left cursor-pointer ${
                    settingsTab === "ai"
                      ? "bg-white/[0.055] text-[#F0EFED]"
                      : "text-[#BCBAB6] hover:bg-white/[0.035] hover:text-[#F0EFED]"
                  }`}
                >
                  <Sparkles size={16} strokeWidth={1.8} className={`shrink-0 ${settingsTab === "ai" ? "text-[#F0EFED]" : "text-[#7D7A75]"}`} />
                  <span className="truncate">KagZ AI</span>
                </button>
              </div>
            </div>

            {/* Bottom Logout */}
            <div className="mt-auto pt-2 border-t border-white/[0.06] px-0.5">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2.5 px-[8px] py-[5px] h-[32px] text-[13.5px] font-[500] rounded-[6px] transition-colors text-[#7D7A75] hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] leading-none select-none">logout</span> Log out
              </button>
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-[57px] pt-[36px] pb-[40px] relative bg-[#191919]">
            {/* Account Tab */}
            {settingsTab === "account" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[760px] w-full mx-auto">
                <h2 className="text-[26px] font-[600] leading-[32px] text-[#F0EFED] tracking-tight mb-1">My Account</h2>
                <p className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mb-8 pb-4 border-b border-white/[0.06]">
                  Manage your account credentials and personal profile
                </p>
                
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-5 p-4 rounded-[10px] bg-white/[0.02] border border-white/[0.06]">
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="w-14 h-14 rounded-full object-cover shrink-0 ring-1 ring-white/10" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xl shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-[600] text-[#F0EFED] text-[16px]">{displayName}</span>
                      <span className="text-[13px] text-[#BCBAB6] mt-0.5">{user?.email || "No email"}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col divide-y divide-white/[0.04]">
                    <div className="flex justify-between items-center py-3.5">
                      <span className="text-[14px] font-[500] leading-[20px] text-[#F0EFED]">Authentication Provider</span>
                      <span className="text-[13px] text-[#BCBAB6] capitalize">
                        {user?.authProvider === 'google' ? (
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            Google
                          </div>
                        ) : (
                          user?.authProvider || "Local"
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3.5">
                      <span className="text-[14px] font-[500] leading-[20px] text-[#F0EFED]">Joined Date</span>
                      <span className="text-[13px] text-[#BCBAB6]">{joinedDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Preferences Tab (Appearance & Input/Startup options) */}
            {settingsTab === "preferences" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[760px] w-full mx-auto">
                <h2 className="text-[26px] font-[600] leading-[32px] text-[#F0EFED] tracking-tight">Preferences</h2>
                <p className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mt-1 mb-8">
                  Choose how you want KagZ to look and behave
                </p>

                <div className="flex flex-col gap-6">
                  {/* Appearance Section */}
                  <div>
                    <h3 className="text-[17px] font-[600] leading-[22px] text-[#F0EFED] mb-1">Appearance</h3>
                    
                    {/* Theme Dropdown */}
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col pr-4">
                        <span className="text-[14px] font-[500] leading-[20px] text-[#F0EFED]">Theme</span>
                        <span className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mt-0.5">
                          Choose a theme for KagZ on this device
                        </span>
                      </div>
                      
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowThemeDropdown(!showThemeDropdown);
                            setShowStartupDropdown(false);
                            setShowFontDropdown(false);
                            setShowPersonaDropdown(false);
                          }}
                          className="flex items-center justify-between gap-1.5 min-w-[155px] px-2.5 py-1 text-[13px] rounded-[6px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[#F0EFED] transition-colors cursor-pointer select-none"
                        >
                          <span>{theme === 'system' ? 'Use system setting' : theme === 'light' ? 'Light' : 'Dark'}</span>
                          <span className={`material-symbols-outlined text-[15px] text-[#7D7A75] select-none transition-transform ${showThemeDropdown ? "rotate-180" : ""}`}>expand_more</span>
                        </button>
                        {showThemeDropdown && (
                          <div 
                            className="absolute right-0 top-full mt-1 w-48 py-1 bg-[#202020] border border-white/[0.08] rounded-[6px] shadow-2xl z-50 text-[12.5px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { id: 'system', label: 'Use system setting' },
                              { id: 'light', label: 'Light' },
                              { id: 'dark', label: 'Dark' }
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setTheme(opt.id);
                                  setShowThemeDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-[#BCBAB6] hover:bg-white/[0.05] hover:text-white transition-colors cursor-pointer text-left"
                              >
                                <span>{opt.label}</span>
                                {theme === opt.id && (
                                  <span className="material-symbols-outlined text-[15px] text-blue-500 select-none">check</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* High Contrast */}
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-[500] leading-[20px] text-[#F0EFED]">High contrast</span>
                          <span className="text-[9.5px] font-[500] text-[#7D7A75] bg-white/[0.06] px-1.5 py-0.5 rounded select-none">Beta</span>
                        </div>
                        <span className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mt-0.5">Increase contrast for improved interface visibility</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={extraContrast}
                        onClick={() => setExtraContrast(!extraContrast)}
                        className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 cursor-pointer ${extraContrast ? "bg-blue-600" : "bg-white/20"}`}
                      >
                        <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform ${extraContrast ? "translate-x-3.5" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Section Hairline Divider */}
                  <div className="border-t border-white/[0.06] my-2" />

                  {/* Input options Section */}
                  <div>
                    <h3 className="text-[17px] font-[600] leading-[22px] text-[#F0EFED] mb-1">Input options</h3>
                    
                    {/* On Startup & Reload Dropdown */}
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col pr-4">
                        <span className="text-[14px] font-[500] leading-[20px] text-[#F0EFED]">On startup & reload</span>
                        <span className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mt-0.5 max-w-[420px]">
                          {chatStartupMode === 'resume'
                            ? "Remembers last state and resumes previous chat on reload"
                            : "Opens fresh on a new page with a clean new chat"}
                        </span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStartupDropdown(!showStartupDropdown);
                            setShowThemeDropdown(false);
                            setShowFontDropdown(false);
                            setShowPersonaDropdown(false);
                          }}
                          className="flex items-center justify-between gap-1.5 min-w-[155px] px-2.5 py-1 text-[13px] rounded-[6px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[#F0EFED] transition-colors cursor-pointer select-none"
                        >
                          <span>{chatStartupMode === 'resume' ? 'Resume last chat' : 'Fresh new chat'}</span>
                          <span className={`material-symbols-outlined text-[15px] text-[#7D7A75] select-none transition-transform ${showStartupDropdown ? "rotate-180" : ""}`}>expand_more</span>
                        </button>
                        {showStartupDropdown && (
                          <div 
                            className="absolute right-0 top-full mt-1 w-48 py-1 bg-[#202020] border border-white/[0.08] rounded-[6px] shadow-2xl z-50 text-[12.5px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { id: 'resume', label: 'Resume last chat' },
                              { id: 'fresh', label: 'Fresh new chat' }
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setChatStartupMode(opt.id);
                                  setShowStartupDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-[#BCBAB6] hover:bg-white/[0.05] hover:text-white transition-colors cursor-pointer text-left"
                              >
                                <span>{opt.label}</span>
                                {chatStartupMode === opt.id && (
                                  <span className="material-symbols-outlined text-[15px] text-blue-500 select-none">check</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reasoning Process Toggle */}
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col pr-4">
                        <span className="text-[14px] font-[500] leading-[20px] text-[#F0EFED]">Reasoning process</span>
                        <span className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mt-0.5">Show step-by-step thinking orb animation when responding</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isThinking}
                        onClick={() => setIsThinking(!isThinking)}
                        className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 cursor-pointer ${isThinking ? "bg-blue-600" : "bg-white/20"}`}
                      >
                        <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform ${isThinking ? "translate-x-3.5" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Tab: Typography & Editor */}
            {settingsTab === "typography" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[760px] w-full mx-auto">
                <h2 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">Typography & Editor</h2>
                <p className="text-[13px] text-gray-500 dark:text-[#8f8e8b] mt-1 mb-8">
                  Customize your reading and writing experience across notes and documents
                </p>

                <div className="flex flex-col gap-6">
                  {/* Editor typography */}
                  <div>
                    <h3 className="text-[13.5px] font-semibold text-gray-900 dark:text-[#e6e5e3] mb-1.5">Editor typography</h3>

                    {/* Font Family */}
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Font family</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Choose the default typeface</span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFontDropdown(!showFontDropdown);
                            setShowThemeDropdown(false);
                            setShowStartupDropdown(false);
                          }}
                          className="flex items-center justify-between gap-1.5 min-w-[145px] px-2.5 py-1 text-[12.5px] rounded-[6px] border border-black/10 dark:border-white/10 bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-gray-800 dark:text-[#d4d3cf] transition-colors cursor-pointer select-none"
                        >
                          <span className="capitalize">{fontFamily === 'sans' ? 'Sans-serif' : fontFamily === 'serif' ? 'Serif' : fontFamily === 'system' ? 'System Default' : 'Monospace'}</span>
                          <span className={`material-symbols-outlined text-[15px] text-gray-400 select-none transition-transform ${showFontDropdown ? "rotate-180" : ""}`}>expand_more</span>
                        </button>
                        
                        {showFontDropdown && (
                          <div 
                            className="absolute right-0 top-full mt-1 w-44 py-1 bg-white dark:bg-[#202020] border border-black/10 dark:border-[#303030] rounded-[6px] shadow-xl z-50 text-[12.5px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { id: "sans", label: "Sans-serif" },
                              { id: "serif", label: "Serif" },
                              { id: "mono", label: "Monospace" },
                              { id: "system", label: "System Default" }
                            ].map((f) => (
                              <button
                                key={f.id}
                                onClick={() => {
                                  setFontFamily(f.id);
                                  setShowFontDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-gray-700 dark:text-[#d4d3cf] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer text-left"
                              >
                                <span>{f.label}</span>
                                {fontFamily === f.id && <span className="material-symbols-outlined text-[15px] text-blue-500 select-none">check</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Font Size */}
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Font size</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Adjust interface and editor text size ({fontSize}px)</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 dark:text-[#d4d3cf] bg-transparent rounded-[6px] border border-black/10 dark:border-white/10 px-1 py-0.5 shrink-0">
                        <button 
                          onClick={() => handleFontSizeChange(-1)}
                          disabled={fontSize <= 12}
                          className="w-6 h-6 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm"
                        >-</button>
                        <span className="text-[12px] w-7 text-center font-medium">{fontSize}</span>
                        <button 
                          onClick={() => handleFontSizeChange(1)}
                          disabled={fontSize >= 24}
                          className="w-6 h-6 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm"
                        >+</button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-black/[0.06] dark:border-[#262626] my-2" />

                  {/* Writing assistance */}
                  <div>
                    <h3 className="text-[13.5px] font-semibold text-gray-900 dark:text-[#e6e5e3] mb-1.5">Writing assistance</h3>
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Spell check</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Enable browser spell checker in notes</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={spellCheck}
                        onClick={() => setSpellCheck(!spellCheck)}
                        className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 cursor-pointer ${spellCheck ? "bg-blue-600 dark:bg-blue-500" : "bg-black/20 dark:bg-[#404040]"}`}
                      >
                        <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform ${spellCheck ? "translate-x-3.5" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Tab: Privacy & Data */}
            {settingsTab === "privacy" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[760px] w-full mx-auto">
                <h2 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">Privacy & Data</h2>
                <p className="text-[13px] text-gray-500 dark:text-[#8f8e8b] mt-1 mb-8">
                  Manage cookies, storage quotas, and local data persistence
                </p>

                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="text-[13.5px] font-semibold text-gray-900 dark:text-[#e6e5e3] mb-1.5">Cookies & Storage</h3>
                    <div className="py-2.5">
                      <div 
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setShowCookiePanel(!showCookiePanel)}
                      >
                        <div className="flex flex-col pr-4">
                          <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium group-hover:text-black dark:group-hover:text-white transition-colors">Cookie preferences</span>
                          <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Manage optional analytics and tracking cookies</span>
                        </div>
                        <span className={`material-symbols-outlined text-[17px] select-none text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 shrink-0 transition-transform ${showCookiePanel ? "rotate-90" : ""}`}>chevron_right</span>
                      </div>
                      
                      {showCookiePanel && (
                        <div className="mt-3 flex flex-col gap-2.5 bg-black/[0.02] dark:bg-[#202020] p-3.5 rounded-[6px] border border-black/10 dark:border-white/10">
                          {[
                            { key: "essential", label: "Essential Cookies", desc: "Required for the app to function. Cannot be disabled.", locked: true },
                            { key: "analytics", label: "Analytics Cookies", desc: "Help us understand how you use KagZ.", locked: false },
                            { key: "marketing", label: "Marketing Cookies", desc: "Used to personalize suggestions.", locked: false },
                          ].map((cookie) => (
                            <div key={cookie.key} className="flex items-center justify-between py-1">
                              <div className="flex flex-col mr-4">
                                <span className="text-[12.5px] text-gray-800 dark:text-gray-200 font-medium">{cookie.label}</span>
                                <span className="text-[11px] text-gray-500 dark:text-[#84827e]">{cookie.desc}</span>
                              </div>
                              <button
                                onClick={() => handleCookieToggle(cookie.key)}
                                disabled={cookie.locked}
                                className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 cursor-pointer ${cookie.locked ? "opacity-60 cursor-not-allowed" : ""} ${cookiePrefs[cookie.key] ? "bg-blue-600 dark:bg-blue-500" : "bg-black/20 dark:bg-[#404040]"}`}
                              >
                                <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform ${cookiePrefs[cookie.key] ? "translate-x-3.5" : ""}`} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between py-2.5 mt-1">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Local storage cache</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">{storageUsage} used of local device quota</span>
                      </div>
                      <button 
                        onClick={() => setShowClearDataModal(true)}
                        className="text-[12px] text-red-500 hover:text-red-600 font-medium px-3 py-1 rounded-[6px] border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                      >
                        Clear local data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Tab: KagZ AI */}
            {settingsTab === "ai" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[760px] w-full mx-auto">
                <h2 className="text-[26px] font-[600] leading-[32px] text-[#F0EFED] tracking-tight mb-1">KagZ AI</h2>
                <p className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mb-8">
                  Customize AI personality, tone, and behavioral instructions
                </p>

                <div className="flex flex-col gap-6">
                  {/* 1. Personality & Tone */}
                  <div>
                    <h3 className="text-[17px] font-[600] leading-[22px] text-[#F0EFED] mb-1">Personality & Tone</h3>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col pr-6">
                        <span className="text-[14px] font-[500] leading-[20px] text-[#F0EFED]">
                          Active persona ({AI_PERSONA_OPTIONS.find((opt) => opt.id === aiPersona)?.label || "Professional"})
                        </span>
                        <span className="text-[13px] text-[#BCBAB6] mt-0.5">
                          {AI_PERSONA_OPTIONS.find((opt) => opt.id === aiPersona)?.desc}
                        </span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPersonaDropdown(!showPersonaDropdown);
                            setShowThemeDropdown(false);
                            setShowStartupDropdown(false);
                            setShowFontDropdown(false);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-[6px] border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-[#F0EFED] transition-colors cursor-pointer select-none font-medium"
                        >
                          <span>{AI_PERSONA_OPTIONS.find((opt) => opt.id === aiPersona)?.label || "Professional"}</span>
                          <span className={`material-symbols-outlined text-[15px] text-[#7D7A75] select-none transition-transform ${showPersonaDropdown ? "rotate-180" : ""}`}>expand_more</span>
                        </button>
                        {showPersonaDropdown && (
                          <div 
                            className="absolute right-0 top-full mt-1 w-64 py-1.5 bg-[#202020] border border-white/[0.08] rounded-[6px] shadow-2xl z-50 text-[12.5px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {AI_PERSONA_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={async () => {
                                  setAiPersona(opt.id);
                                  setShowPersonaDropdown(false);
                                  try {
                                    await updatePreferences({
                                      aiPersona: opt.id,
                                      customInstructions: aiCustomInstructions,
                                    });
                                    showToast(`AI persona set to ${opt.label}`, "success");
                                  } catch (err) {
                                    showToast(err.response?.data?.message || "Failed to update persona", "error");
                                  }
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-[#BCBAB6] hover:bg-white/[0.05] hover:text-white transition-colors cursor-pointer text-left"
                              >
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-[#F0EFED]">{opt.label}</span>
                                    <span className="text-[10px] text-[#7D7A75] bg-white/[0.06] px-1 py-0.2 rounded">{opt.badge}</span>
                                  </div>
                                  <span className="text-[11px] text-[#7D7A75] mt-0.5 leading-snug">{opt.desc}</span>
                                </div>
                                {aiPersona === opt.id && (
                                  <span className="material-symbols-outlined text-[15px] text-blue-500 select-none shrink-0 ml-2">check</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] my-1" />

                  {/* 2. Custom Instructions (Max 100 words) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h3 className="text-[17px] font-[600] leading-[22px] text-[#F0EFED]">Custom instructions</h3>
                        <p className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mt-0.5">
                          Provide specific instructions on how KagZ AI should behave, write, or format responses
                        </p>
                      </div>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        countWords(aiCustomInstructions) > 100
                          ? "bg-red-500/10 text-red-500 font-semibold"
                          : countWords(aiCustomInstructions) > 85
                          ? "bg-amber-500/10 text-amber-400"
                          : "text-[#7D7A75]"
                      }`}>
                        {countWords(aiCustomInstructions)} / 100 words
                      </span>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      <textarea
                        value={aiCustomInstructions}
                        onChange={(e) => setAiCustomInstructions(e.target.value)}
                        placeholder="e.g. Always format summaries with bullet points. Call me Dave. Never use conversational filler."
                        rows={3}
                        className="w-full p-2.5 text-[13px] text-[#F0EFED] bg-white/[0.02] border border-white/[0.08] rounded-[6px] focus:outline-none focus:border-white/20 transition-colors resize-none placeholder:text-[#7D7A75]"
                      />
                      {countWords(aiCustomInstructions) > 100 && (
                        <p className="text-[11.5px] text-red-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          Instructions exceed 100 words limit. Excess words will be trimmed.
                        </p>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11.5px] text-[#7D7A75]">
                          Saved globally across all KagZ chats for your account.
                        </span>
                        <button
                          type="button"
                          onClick={handleSaveAiPrefs}
                          disabled={isSavingAiPrefs}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 rounded-[5px] transition-colors cursor-pointer shadow-sm"
                        >
                          {isSavingAiPrefs ? (
                            <>
                              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              <span>Save preferences</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/[0.06] my-1" />

                  {/* 3. Reasoning & Thinking Process */}
                  <div>
                    <h3 className="text-[17px] font-[600] leading-[22px] text-[#F0EFED] mb-1">Reasoning process</h3>
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col pr-6">
                        <span className="text-[14px] font-[500] leading-[20px] text-[#F0EFED]">Thinking orb visualization</span>
                        <span className="text-[14px] font-normal leading-[20px] text-[#BCBAB6] mt-0.5">
                          Show the step-by-step thinking orb animation while the AI generates responses
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isThinking}
                        onClick={() => setIsThinking(!isThinking)}
                        className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 cursor-pointer ${isThinking ? "bg-blue-600" : "bg-white/20"}`}
                      >
                        <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform ${isThinking ? "translate-x-3.5" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Search Results View */}
            {settingsSearchQuery && (
              <div className="flex flex-col max-w-[760px] w-full mx-auto">
                <h2 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">Search Results</h2>
                <p className="text-[13px] text-gray-500 dark:text-[#8f8e8b] mt-1 mb-8">
                  Settings matching &ldquo;{settingsSearchQuery}&rdquo;
                </p>

                <div className="flex flex-col gap-4">
                  {matchesQuery("Theme", "theme") && (
                    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.06] dark:border-[#262626]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Theme</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">System, Light, or Dark theme</span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowThemeDropdown(!showThemeDropdown);
                          }}
                          className="flex items-center justify-between gap-1.5 min-w-[145px] px-2.5 py-1 text-[12.5px] rounded-[6px] border border-black/10 dark:border-white/10 bg-transparent text-gray-800 dark:text-[#d4d3cf] cursor-pointer"
                        >
                          <span>{theme === 'system' ? 'Use system setting' : theme === 'light' ? 'Light' : 'Dark'}</span>
                          <span className="material-symbols-outlined text-[15px] text-gray-400 select-none">expand_more</span>
                        </button>
                        {showThemeDropdown && (
                          <div 
                            className="absolute right-0 top-full mt-1 w-44 py-1 bg-white dark:bg-[#202020] border border-black/10 dark:border-[#303030] rounded-[6px] shadow-xl z-50 text-[12.5px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { id: 'system', label: 'Use system setting' },
                              { id: 'light', label: 'Light' },
                              { id: 'dark', label: 'Dark' }
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setTheme(opt.id);
                                  setShowThemeDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-gray-700 dark:text-[#d4d3cf] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-left"
                              >
                                <span>{opt.label}</span>
                                {theme === opt.id && <span className="material-symbols-outlined text-[15px] text-blue-500 select-none">check</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {matchesQuery("High contrast", "contrast") && (
                    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.06] dark:border-[#262626]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">High contrast</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Increase contrast for improved visibility</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={extraContrast}
                        onClick={() => setExtraContrast(!extraContrast)}
                        className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 cursor-pointer ${extraContrast ? "bg-blue-600 dark:bg-blue-500" : "bg-black/20 dark:bg-[#404040]"}`}
                      >
                        <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform ${extraContrast ? "translate-x-3.5" : ""}`} />
                      </button>
                    </div>
                  )}

                  {matchesQuery("Startup", "Resume last chat reload") && (
                    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.06] dark:border-[#262626]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">On startup & reload</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Resume last chat or start fresh on reload</span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStartupDropdown(!showStartupDropdown);
                          }}
                          className="flex items-center justify-between gap-1.5 min-w-[145px] px-2.5 py-1 text-[12.5px] rounded-[6px] border border-black/10 dark:border-white/10 bg-transparent text-gray-800 dark:text-[#d4d3cf] cursor-pointer"
                        >
                          <span>{chatStartupMode === 'resume' ? 'Resume last chat' : 'Fresh new chat'}</span>
                          <span className="material-symbols-outlined text-[15px] text-gray-400 select-none">expand_more</span>
                        </button>
                        {showStartupDropdown && (
                          <div 
                            className="absolute right-0 top-full mt-1 w-44 py-1 bg-white dark:bg-[#202020] border border-black/10 dark:border-[#303030] rounded-[6px] shadow-xl z-50 text-[12.5px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { id: 'resume', label: 'Resume last chat' },
                              { id: 'fresh', label: 'Fresh new chat' }
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setChatStartupMode(opt.id);
                                  setShowStartupDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-gray-700 dark:text-[#d4d3cf] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer text-left"
                              >
                                <span>{opt.label}</span>
                                {chatStartupMode === opt.id && <span className="material-symbols-outlined text-[15px] text-blue-500 select-none">check</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {matchesQuery("Reasoning", "Thinking mode") && (
                    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.06] dark:border-[#262626]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Reasoning process</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Thinking orb animation</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isThinking}
                        onClick={() => setIsThinking(!isThinking)}
                        className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 cursor-pointer ${isThinking ? "bg-blue-600 dark:bg-blue-500" : "bg-black/20 dark:bg-[#404040]"}`}
                      >
                        <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform ${isThinking ? "translate-x-3.5" : ""}`} />
                      </button>
                    </div>
                  )}

                  {matchesQuery("Font", "Typography text size") && (
                    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.06] dark:border-[#262626]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Font size</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Interface text size ({fontSize}px)</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 dark:text-[#d4d3cf] bg-transparent rounded-[6px] border border-black/10 dark:border-white/10 px-1 py-0.5 shrink-0">
                        <button 
                          onClick={() => handleFontSizeChange(-1)}
                          disabled={fontSize <= 12}
                          className="w-6 h-6 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded cursor-pointer text-sm"
                        >-</button>
                        <span className="text-[12px] w-7 text-center font-medium">{fontSize}</span>
                        <button 
                          onClick={() => handleFontSizeChange(1)}
                          disabled={fontSize >= 24}
                          className="w-6 h-6 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 rounded cursor-pointer text-sm"
                        >+</button>
                      </div>
                    </div>
                  )}

                  {matchesQuery("Spell", "Spell check") && (
                    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.06] dark:border-[#262626]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Spell check</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Browser spell checker</span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={spellCheck}
                        onClick={() => setSpellCheck(!spellCheck)}
                        className={`w-8 h-[18px] rounded-full relative transition-colors shrink-0 cursor-pointer ${spellCheck ? "bg-blue-600 dark:bg-blue-500" : "bg-black/20 dark:bg-[#404040]"}`}
                      >
                        <div className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform ${spellCheck ? "translate-x-3.5" : ""}`} />
                      </button>
                    </div>
                  )}

                  {matchesQuery("Storage", "Local data clear") && (
                    <div className="flex items-center justify-between py-2.5">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">Local storage</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">{storageUsage} used</span>
                      </div>
                      <button 
                        onClick={() => setShowClearDataModal(true)}
                        className="text-[12px] text-red-500 hover:text-red-600 font-medium px-3 py-1 rounded-[6px] border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                      >
                        Clear local data
                      </button>
                    </div>
                  )}

                  {matchesQuery("KagZ AI", "personality tone instructions friend prompt") && (
                    <div className="flex items-center justify-between py-2.5 border-b border-black/[0.06] dark:border-[#262626]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] text-gray-800 dark:text-[#d4d3cf] font-medium">KagZ AI Settings</span>
                        <span className="text-[12px] text-gray-500 dark:text-[#84827e] mt-0.5">Customize AI personality ({aiPersona.replace('_', ' ')}) and custom instructions</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsSearchQuery("");
                          setSettingsTab("ai");
                        }}
                        className="px-3 py-1 text-[12px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-[5px] transition-colors cursor-pointer"
                      >
                        Configure
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderNewWorkspacePopover = () => {
    if (!showNewWorkspaceModal) return null;

    return (
      <div
        className="fixed bg-[#ffffff] dark:bg-[var(--color-dark-sidebar)] rounded-lg shadow-xl border border-gray-200 dark:border-[var(--color-dark-border)] p-4 z-[100] font-sans"
        style={{
          top: newWorkspacePos.top,
          left: newWorkspacePos.left,
          width: "18rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            New Workspace
          </label>
        </div>
        <input
          type="text"
          placeholder="Workspace Name"
          value={newWorkspaceName}
          onChange={(e) => setNewWorkspaceName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-[#2A2A2A] transition-colors mb-4 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreateWorkspace();
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowNewWorkspaceModal(false)}
            className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateWorkspace}
            disabled={!newWorkspaceName.trim()}
            className="px-3 py-1.5 text-sm bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    );
  };

  const filterTree = (nodes, query) => {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();

    return nodes
      .map((node) => {
        let matchedChildren = [];
        if (node.children) {
          matchedChildren = filterTree(node.children, query);
        }

        const isMatch = node.name.toLowerCase().includes(lowerQuery);

        if (isMatch || matchedChildren.length > 0) {
          return {
            ...node,
            children:
              matchedChildren.length > 0
                ? matchedChildren
                : isMatch
                  ? node.children
                  : [],
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  const renderTree = (nodes, level = 0, expansionState = expandedFolders, onToggle = toggleFolder) => {
    return nodes.map((node) => {
      // Clear visual indentation hierarchy per level matching Notion / Linear
      const paddingLeft = `${10 + level * 14}px`;
      const isExpanded = debouncedSearchQuery ? true : expansionState[node.id];

      if (node.type === "page") {
        return (
          <div
            key={node.id}
            className={`group w-full relative ${activeMenu === node.id ? "z-50" : "z-auto"}`}
          >
            <NavLink
              to={node.path}
              className={({ isActive }) =>
                `group/row relative flex items-center w-full py-1.5 pr-8 text-[13px] rounded-[6px] mb-0.5 transition-all duration-150 ${
                  isActive
                    ? "bg-black/[0.06] dark:bg-white/[0.08] text-black dark:text-white font-medium before:absolute before:left-0.5 before:top-1.5 before:bottom-1.5 before:w-[2.5px] before:rounded-full before:bg-blue-500/80 dark:before:bg-blue-400"
                    : "text-gray-600 dark:text-[#a8a6a1] hover:text-black dark:hover:text-white hover:bg-black/[0.035] dark:hover:bg-white/[0.05]"
                }`
              }
              style={{ paddingLeft }}
            >
              <div className="flex items-center gap-2 overflow-hidden w-full">
                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-400 dark:text-[#8a8883]">
                  <span className="material-symbols-outlined text-[15px] leading-none select-none">
                    assignment
                  </span>
                </div>
                <span className="truncate">{node.name}</span>
              </div>
            </NavLink>
            <button
              onClick={(e) => handleMenuClick(e, node.id)}
              className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 ${activeMenu === node.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
              aria-label={`More options for ${node.name}`}
            >
              <span className="material-symbols-outlined text-[14px] leading-none select-none">more_horiz</span>
            </button>
          </div>
        );
      }

      return (
        <div
          key={node.id}
          className={`w-full relative ${activeMenu === node.id ? "z-50" : "z-auto"}`}
        >
          {(() => {
            return (
              <div
                className="group flex items-center justify-between w-full py-1.5 pr-1.5 text-[13px] font-medium text-gray-800 dark:text-[#e3e2e0] hover:text-black dark:hover:text-white hover:bg-black/[0.035] dark:hover:bg-white/[0.05] rounded-[6px] mb-0.5 transition-all duration-150 cursor-pointer"
                style={{ paddingLeft }}
                onClick={() => onToggle(node.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                  <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-400 dark:text-[#8a8883]">
                    {node.type === "workspace" ? (
                      <span className="material-symbols-outlined text-[15px] leading-none text-current select-none">
                        dashboard_2_add
                      </span>
                    ) : isExpanded ? (
                      <span className="material-symbols-outlined text-[15px] leading-none text-gray-500 dark:text-gray-400 select-none">
                        folder_open
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-[15px] leading-none text-gray-400 dark:text-gray-500 select-none">
                        folder
                      </span>
                    )}
                  </div>
                  <span className="truncate select-none font-normal text-gray-700 dark:text-[#d4d2cd]">
                    {node.name}
                  </span>
                  <span className={`material-symbols-outlined text-[13px] leading-none select-none transition-transform duration-200 text-gray-400 opacity-0 group-hover:opacity-70 ${isExpanded ? "rotate-90 !opacity-70" : ""} shrink-0`}>
                    chevron_right
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setAddMenuPos({
                        top: rect.bottom + 5,
                        left: rect.left - 50,
                      });
                      setActiveAddMenu(
                        activeAddMenu === node.id ? null : node.id,
                      );
                      setActiveMenu(null);
                    }}
                    className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 ${activeAddMenu === node.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                    title="Add..."
                  >
                    <span className="material-symbols-outlined text-[14px] leading-none select-none">add_2</span>
                  </button>
                  <button
                    onClick={(e) => handleMenuClick(e, node.id)}
                    className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 ${activeMenu === node.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                    title="More Options"
                  >
                    <span className="material-symbols-outlined text-[14px] leading-none select-none">more_horiz</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {node.children && (
            <div
              className={`grid transition-all duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="overflow-hidden w-full flex flex-col">
                {renderTree(node.children, level + 1, expansionState, onToggle)}
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.classList.add("cursor-col-resize", "select-none");
    resizeCleanupRef.current = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("cursor-col-resize", "select-none");
      resizeCleanupRef.current = null;
    };
  };

  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    const newWidth = e.clientX;
    if (newWidth > 200 && newWidth < 600) {
      setSidebarWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    resizeCleanupRef.current?.();
  };

  const handleCreateRootPage = () => {
    navigate("/dashboard/page/new");
  };

  const handleStartNewChat = () => {
    clearChat();
    navigate("/dashboard/chat");
  };

  return (
    <div
      className="relative z-40 h-screen bg-[var(--color-sidebar-bg)] dark:bg-[var(--color-dark-sidebar)] flex flex-col border-r border-gray-200 dark:border-[var(--color-dark-border)] font-sans shrink-0 transition-colors"
      style={{ width: sidebarWidth }}
    >
      {/* Resizer Handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 right-[-4px] w-[8px] h-full cursor-col-resize z-50 hover:bg-gray-300/50 transition-colors"
      />
      {/* Top Header & Search Bar (Notion Style) */}
      <div className="px-3 pt-3 pb-1 flex flex-col gap-2 shrink-0">
        {/* Top Controls Row */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <PanelLeft className="w-4 h-4" strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-0.5 relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsNewMenuOpen((prev) => !prev);
              }}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
                isNewMenuOpen
                  ? "bg-black/10 dark:bg-white/15 text-black dark:text-white"
                  : "hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white"
              }`}
              title="New"
              aria-label="New"
            >
              <SquarePen className="w-4 h-4" strokeWidth={1.8} />
            </button>

            {isNewMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#1e1e1e] border border-black/[0.08] dark:border-[#333333] shadow-xl rounded-[12px] p-1.5 z-50 flex flex-col font-sans animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    handleCreateRootPage();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[13.5px] font-medium text-gray-800 dark:text-gray-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                >
                  <span className="material-symbols-outlined text-[17px] leading-none select-none text-gray-500 dark:text-gray-400 shrink-0">
                    assignment
                  </span>
                  <span>Page</span>
                </button>
                <button
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    handleStartNewChat();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[13.5px] font-medium text-gray-800 dark:text-gray-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                >
                  <span className="material-symbols-outlined text-[17px] leading-none select-none text-gray-500 dark:text-gray-400 shrink-0">
                    chat
                  </span>
                  <span>Chat</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search or Ask Bar */}
        <button
          onClick={() => setIsSearchActive(true)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-transparent hover:border-black/25 dark:hover:border-white/25 transition-colors text-left group cursor-pointer"
        >
          <span className="text-[13px] text-gray-400 dark:text-[#7d7a75] group-hover:text-gray-600 dark:group-hover:text-[#a8a6a1] select-none">
            Search or ask
          </span>
          <kbd className="text-[11px] font-sans font-medium text-gray-400 dark:text-[#6e6b66] bg-transparent border border-black/[0.08] dark:border-white/[0.1] rounded px-1.5 py-0.5 leading-none select-none">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Animated Quick Actions Bar (3 pills: Home, Chat, Tasks) */}
      <div className="px-3 pt-2 pb-2 flex items-center justify-start gap-1.5">
        {topNavItems.map((item) => {

          if (item.id === "chat") {
            const isChatActive =
              isRightChatOpen || location.pathname === "/dashboard/chat";
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isRightChatOpen && chatStartupMode === "fresh") {
                    clearChat();
                  }
                  setIsRightChatOpen((prev) => !prev);
                }}
                className="block cursor-pointer"
              >
                <motion.div
                  layout
                  className={`flex items-center h-8 rounded-[8px] overflow-hidden ${
                    isChatActive
                      ? "bg-[#ecebe9] dark:bg-white/[0.1] text-black dark:text-white px-3 font-medium"
                      : "bg-transparent text-[#8a817c] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] w-8 justify-center"
                  }`}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <motion.div
                    layout="position"
                    className="shrink-0 flex items-center justify-center"
                  >
                    <item.icon />
                  </motion.div>
                  <AnimatePresence initial={false}>
                    {isChatActive && (
                      <motion.span
                        initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                        animate={{ opacity: 1, width: "auto", marginLeft: 7 }}
                        exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-[15px] font-medium whitespace-nowrap overflow-hidden leading-none"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </button>
            );
          }

          return (
            <NavLink key={item.id} to={item.path} className="block">
              {({ isActive: routerIsActive }) => {
                const isActive =
                  item.id === "home" ? isHomeActive() : routerIsActive;
                const active = isActive && !isSearchActive;
                return (
                  <motion.div
                    layout
                    className={`flex items-center h-8 rounded-[8px] overflow-hidden ${
                      active
                        ? "bg-[#ecebe9] dark:bg-white/[0.1] text-black dark:text-white px-3 font-medium"
                        : "bg-transparent text-[#8a817c] hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.06] w-8 justify-center"
                    }`}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  >
                    <motion.div
                      layout="position"
                      className="shrink-0 flex items-center justify-center"
                    >
                      <item.icon />
                    </motion.div>
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.span
                          initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                          animate={{ opacity: 1, width: "auto", marginLeft: 7 }}
                          exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-[15px] font-medium whitespace-nowrap overflow-hidden leading-none"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              }}
            </NavLink>
          );
        })}
      </div>

      {/* Tree Navigation */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-2 py-2 min-h-0">
        {/* Recent Section */}
        <div className="flex flex-col mb-3 shrink-0">
          <div className="group flex items-center justify-between w-full pt-2.5 px-1.5 pb-1 shrink-0">
            <div
              onClick={() => toggleFolder("recent-section")}
              className="flex items-center gap-1.5 select-none cursor-pointer px-1 py-0.5 rounded text-gray-400 dark:text-[#888680] hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px] leading-none shrink-0 opacity-70 select-none">tab_recent</span>
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Recents</span>
              <span className={`material-symbols-outlined text-[13px] leading-none select-none shrink-0 transition-transform duration-200 text-gray-400 opacity-60 group-hover:opacity-100 ${debouncedSearchQuery || expandedFolders["recent-section"] ? "rotate-90" : ""}`}>chevron_right</span>
            </div>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${debouncedSearchQuery || expandedFolders["recent-section"] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          >
            <div className="overflow-hidden w-full flex flex-col pt-0.5 pb-1">
              <button
                onClick={handleCreateRootPage}
                className="group flex items-center gap-2 w-full py-1.5 px-2.5 mb-0.5 text-[13px] font-normal text-gray-500 dark:text-[#8a8883] hover:text-black dark:hover:text-white hover:bg-black/[0.035] dark:hover:bg-white/[0.05] rounded-[6px] transition-all duration-150 bg-transparent border-none outline-none cursor-pointer shrink-0"
              >
                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[15px] leading-none select-none">add_2</span>
                </div>
                <span>New Page</span>
              </button>

              {sectionStates["recent-section"]?.isLoading ? (
                <>
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                </>
              ) : sectionStates["recent-section"]?.isError ? (
                <SectionErrorState
                  message="Failed to load recents"
                  onRetry={() => loadRecentSection(true)}
                />
              ) : (
                filterTree(mockRecent, debouncedSearchQuery).map((recent) => (
                  <div
                    key={recent.id}
                    className={`group w-full relative ${activeMenu === recent.id ? "z-50" : "z-auto"}`}
                  >
                    <NavLink
                      to={recent.path}
                      className={({ isActive }) =>
                        `group/row relative flex items-center w-full py-1.5 px-2.5 pr-8 text-[13px] rounded-[6px] mb-0.5 transition-all duration-150 ${
                          isActive
                            ? "bg-black/[0.06] dark:bg-white/[0.08] text-black dark:text-white font-medium before:absolute before:left-0.5 before:top-1.5 before:bottom-1.5 before:w-[2.5px] before:rounded-full before:bg-blue-500/80 dark:before:bg-blue-400"
                            : "text-gray-600 dark:text-[#a8a6a1] hover:text-black dark:hover:text-white hover:bg-black/[0.035] dark:hover:bg-white/[0.05]"
                        }`
                      }
                    >
                      <div className="flex items-center gap-2 overflow-hidden w-full">
                        <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-400 dark:text-[#8a8883]">
                          <span className="material-symbols-outlined text-[15px] leading-none text-current select-none">
                            assignment
                          </span>
                        </div>
                        <span className="truncate">{recent.name}</span>
                      </div>
                    </NavLink>
                    <button
                      onClick={(e) => handleMenuClick(e, recent.id)}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 ${activeMenu === recent.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                      aria-label={`More options for ${recent.name}`}
                    >
                      <span className="material-symbols-outlined text-[14px] leading-none select-none">more_horiz</span>
                    </button>
                  </div>
                ))
              )}
              {sectionStates["recent-section"]?.isSuccess && mockRecent.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-gray-400">No recent pages</div>
              )}
            </div>
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="flex flex-col mb-3 shrink-0">
          <div className="group flex items-center justify-between w-full pt-2.5 px-1.5 pb-1 shrink-0">
            <div
              className="flex items-center gap-1.5 select-none cursor-pointer px-1 py-0.5 rounded text-gray-400 dark:text-[#888680] hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              onClick={() => toggleFolder("workspaces-section")}
            >
              <span className="material-symbols-outlined text-[13.5px] leading-none shrink-0 opacity-70 select-none">dashboard_2_add</span>
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Workspaces</span>
              <span className={`material-symbols-outlined text-[13px] leading-none select-none shrink-0 transition-transform duration-200 text-gray-400 opacity-60 group-hover:opacity-100 ${debouncedSearchQuery || expandedFolders["workspaces-section"] ? "rotate-90" : ""}`}>chevron_right</span>
            </div>
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100"
              title="Create new workspace"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setNewWorkspacePos({ top: rect.bottom + 8, left: rect.left });
                setShowNewWorkspaceModal(true);
              }}
            >
              <span className="material-symbols-outlined text-[14px] leading-none select-none">add_2</span>
            </button>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              debouncedSearchQuery || expandedFolders["workspaces-section"]
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden w-full flex flex-col pt-0.5 pb-1">
              {sectionStates["workspaces-section"]?.isLoading ? (
                <>
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                </>
              ) : sectionStates["workspaces-section"]?.isError ? (
                <SectionErrorState
                  message="Failed to load workspaces"
                  onRetry={() => loadWorkspacesSection(true)}
                />
              ) : (
                renderTree(filterTree(mockTree, debouncedSearchQuery))
              )}
              {sectionStates["workspaces-section"]?.isSuccess && mockTree.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-gray-400">No workspaces yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Favorites Section */}
        <div className="flex flex-col mb-3 shrink-0">
          <div className="group flex items-center justify-between w-full pt-2.5 px-1.5 pb-1 shrink-0">
            <div
              onClick={() => toggleFolder("favorites-section")}
              className="flex items-center gap-1.5 select-none cursor-pointer px-1 py-0.5 rounded text-gray-400 dark:text-[#888680] hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[13.5px] leading-none shrink-0 opacity-70 select-none">star</span>
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Favorites</span>
              <span className={`material-symbols-outlined text-[13px] leading-none select-none shrink-0 transition-transform duration-200 text-gray-400 opacity-60 group-hover:opacity-100 ${debouncedSearchQuery || expandedFolders["favorites-section"] ? "rotate-90" : ""}`}>chevron_right</span>
            </div>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${debouncedSearchQuery || expandedFolders["favorites-section"] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          >
            <div className="overflow-hidden w-full flex flex-col pt-0.5 pb-1">
              {sectionStates["favorites-section"]?.isLoading ? (
                <>
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                </>
              ) : sectionStates["favorites-section"]?.isError ? (
                <SectionErrorState
                  message="Failed to load favorites"
                  onRetry={() => loadFavoritesSection(true)}
                />
              ) : (
                renderTree(
                  filterTree(mockFavorites, debouncedSearchQuery),
                  0,
                  expandedFavoriteFolders,
                  toggleFavoriteFolder,
                )
              )}
              {sectionStates["favorites-section"]?.isSuccess && mockFavorites.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-gray-400">No favorites yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Chat History Section */}
        <div
          className={`flex flex-col mb-2 transition-all ${
            debouncedSearchQuery || expandedFolders["chat-history-section"]
              ? "flex-1 min-h-[120px]"
              : "shrink-0"
          }`}
        >
          <div className="group flex items-center justify-between w-full pt-2.5 px-1.5 pb-1 shrink-0">
            <div
              onClick={() => toggleFolder("chat-history-section")}
              className="flex items-center gap-1.5 select-none cursor-pointer px-1 py-0.5 rounded text-gray-400 dark:text-[#888680] hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[13.5px] leading-none shrink-0 opacity-70 select-none">chat</span>
              <span className="text-[11px] font-medium tracking-[0.06em] uppercase">Chat History</span>
              <span className={`material-symbols-outlined text-[13px] leading-none select-none shrink-0 transition-transform duration-200 text-gray-400 opacity-60 group-hover:opacity-100 ${debouncedSearchQuery || expandedFolders["chat-history-section"] ? "rotate-90" : ""}`}>chevron_right</span>
            </div>
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100"
              title="New Chat"
              onClick={(e) => {
                e.stopPropagation();
                handleStartNewChat();
              }}
            >
              <span className="material-symbols-outlined text-[14px] leading-none select-none">
                add_2
              </span>
            </button>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              debouncedSearchQuery || expandedFolders["chat-history-section"]
                ? "grid-rows-[1fr] opacity-100 flex-1 min-h-0"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden w-full h-full flex flex-col pt-0.5 pb-1 min-h-0">
              <button
                onClick={handleStartNewChat}
                className="group flex items-center gap-2 w-full py-1.5 px-2.5 mb-0.5 text-[13px] font-normal text-gray-500 dark:text-[#8a8883] hover:text-black dark:hover:text-white hover:bg-black/[0.035] dark:hover:bg-white/[0.05] rounded-[6px] transition-all duration-150 bg-transparent border-none outline-none cursor-pointer shrink-0"
              >
                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[15px] leading-none select-none">
                    add_2
                  </span>
                </div>
                <span>New Chat</span>
              </button>

              <div className="w-full flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain">
                {sectionStates["chat-history-section"]?.isLoading ? (
                  <>
                    <SidebarSkeletonItem />
                    <SidebarSkeletonItem />
                    <SidebarSkeletonItem />
                  </>
                ) : sectionStates["chat-history-section"]?.isError ? (
                  <SectionErrorState
                    message="Failed to load chat history"
                    onRetry={() => loadChatHistorySection(true)}
                  />
                ) : (
                  chatSessions.map((session) => (
                    <div
                      key={session.sessionId}
                      className={`group w-full relative ${activeMenu === session.sessionId ? "z-50" : "z-auto"}`}
                    >
                      {(() => {
                        const isChatActive = sessionId === session.sessionId;
                        return (
                          <>
                            <div
                              className={`relative flex items-center w-full py-1.5 px-2.5 pr-8 text-[13px] rounded-[6px] mb-0.5 transition-all duration-150 cursor-pointer ${
                                isChatActive
                                  ? "bg-black/[0.06] dark:bg-white/[0.08] text-black dark:text-white font-medium before:absolute before:left-0.5 before:top-1.5 before:bottom-1.5 before:w-[2.5px] before:rounded-full before:bg-blue-500/80 dark:before:bg-blue-400"
                                  : "text-gray-600 dark:text-[#a8a6a1] hover:text-black dark:hover:text-white hover:bg-black/[0.035] dark:hover:bg-white/[0.05]"
                              }`}
                              onClick={() => {
                                loadSession(session.sessionId);
                                navigate("/dashboard/chat");
                              }}
                            >
                              <div className="flex items-center gap-2 overflow-hidden w-full">
                                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-400 dark:text-[#7d7b76]">
                                  <span className="material-symbols-outlined text-[15px] leading-none text-current select-none">
                                    chat
                                  </span>
                                </div>
                                <span className="truncate">
                                  {session.title || "Untitled Chat"}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) =>
                                handleMenuClick(e, session.sessionId)
                              }
                              className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 ${activeMenu === session.sessionId ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                              aria-label={`More options for ${session.title || "chat"}`}
                            >
                              <span className="material-symbols-outlined text-[14px] leading-none select-none">more_horiz</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  ))
                )}
                {chatSessions.length === 0 && (
                  <div className="px-8 py-2 text-sm text-gray-400">
                    No recent chats
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="h-11 px-2.5 flex items-center border-t border-gray-200/80 dark:border-[var(--color-dark-border)] justify-between shrink-0">
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowSettingsCard(true);
          }}
          className="flex items-center gap-2 overflow-hidden cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06] py-1 px-1.5 rounded-[6px] transition-colors min-w-0"
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt="User"
              className="w-[22px] h-[22px] rounded-[5px] object-cover shrink-0"
            />
          ) : (
            <div className="w-[22px] h-[22px] rounded-[5px] bg-[#2e2e2e] dark:bg-[#2b2b2b] flex items-center justify-center text-gray-200 dark:text-gray-100 font-semibold text-[12px] shrink-0 select-none">
              {(user?.username || user?.name || "M").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[13.5px] font-medium text-gray-800 dark:text-[#d4d2cd] truncate max-w-[140px]">
            {user?.username || user?.name || "User"}
          </span>
          <span className="material-symbols-outlined text-[15px] leading-none text-gray-400 dark:text-[#888580] shrink-0 select-none">
            expand_more
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:text-[#7d7a75] dark:hover:text-gray-200 transition-colors shrink-0"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <span className="material-symbols-outlined text-[18px] leading-none select-none">chevron_left</span>
          </button>
        </div>
      </div>

      {/* Global floating menu */}
      {renderMenuDropdown()}

      {/* New Workspace Popover */}
      {renderNewWorkspacePopover()}

      {/* Add Page/Folder Dropdown */}
      {renderAddMenuDropdown()}

      {/* Settings Card Modal */}
      {renderSettingsCard()}

      {/* Action Modal (Rename, Delete, Add Folder/Page) */}
      <ActionModal
        isOpen={modalState.isOpen}
        onClose={() => {
          setModalState({ ...modalState, isOpen: false });
          setCreatePageLocation(null);
          setCreatePagePath([]);
        }}
        title={
          modalState.action === "DELETE"
            ? "Delete Item"
            : modalState.action === "RENAME"
              ? "Rename Item"
              : modalState.action === "ADD_FOLDER"
                ? "New Folder"
                : "New Page"
        }
        type={modalState.action === "DELETE" ? "confirm" : "input"}
        initialValue={modalState.initialValue}
        onConfirm={handleModalConfirm}
        confirmText={
          modalState.action === "DELETE"
            ? "Delete"
            : modalState.action === "RENAME"
              ? "Rename"
              : "Create"
        }
        cancelText="Cancel"
        isDanger={modalState.action === "DELETE"}
        showPageTypeSelector={modalState.action === "ADD_PAGE"}
        locationSelector={
          modalState.action === "ADD_PAGE" && !modalState.nodeId ? (
            <LocationDropdown
              treeData={mockTree}
              selectedLocation={createPageLocation}
              selectedPath={createPagePath}
              onSelectLocation={(node, path) => {
                setCreatePageLocation(node);
                setCreatePagePath(path);
              }}
              selectableTypes={["workspace", "folder"]}
            />
          ) : null
        }
        confirmDisabled={
          modalState.action === "ADD_PAGE" &&
          !modalState.nodeId &&
          !createPageLocation
        }
        placeholder={
          modalState.action === "ADD_FOLDER"
            ? "Folder Name"
            : modalState.action === "ADD_PAGE"
              ? "Page Name"
              : "Name"
        }
        description={
          modalState.action === "DELETE"
            ? "Are you sure you want to delete this item? This action cannot be undone."
            : ""
        }
      />
      <ActionModal
        isOpen={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        title="Clear local data?"
        type="confirm"
        description="Unsaved note drafts and temporary browser data will be deleted. Saved pages, chats, workspaces, and your preferences will not be affected."
        onConfirm={handleClearStorage}
        confirmText="Clear local data"
        cancelText="Keep my data"
        isDanger
      />
      <SearchPalette 
        isOpen={isSearchActive}
        onClose={() => {
          setIsSearchActive(false);
        }}
        recentPages={mockRecent}
      />
    </div>
  );
};

export default Sidebar;
