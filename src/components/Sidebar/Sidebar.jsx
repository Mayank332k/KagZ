import { useState, useEffect, useRef, useContext, useCallback } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChatContext } from "../../context/ChatContextDefinition";
import { EditorContext } from "../../context/EditorContext";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "next-themes";
import { SquarePen } from "lucide-react";
import { SlidersHorizontalIcon, Loading03Icon } from "hugeicons-react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  Home01Icon,
  ListTodo as ListTodoIcon,
  BubbleChatNotificationIcon,
  Edit03Icon,
  StarIcon,
  TextIcon,
  LibrariesIcon,
  LayoutAlignLeftIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons";

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

const SETTINGS_TAB_TITLES = {
  preferences: "Account & Preferences",
  typography: "Typography & Editor",
  privacy: "Privacy & Data",
  ai: "KagZ AI",
};

const MOBILE_SETTINGS_ITEMS = [
  { label: "Account & Preferences", keywords: "account profile sign in member", tab: "preferences" },
  { label: "Theme", keywords: "appearance dark light system", tab: "preferences" },
  { label: "High contrast", keywords: "contrast visibility borders", tab: "preferences" },
  { label: "On startup & reload", keywords: "resume last chat fresh", tab: "preferences" },
  { label: "Reasoning process", keywords: "thinking orb", tab: "preferences" },
  { label: "Typography & Editor", keywords: "font typeface text size", tab: "typography" },
  { label: "Font family", keywords: "inter serif mono typeface", tab: "typography" },
  { label: "Font size", keywords: "text size interface", tab: "typography" },
  { label: "Spell check", keywords: "writing assistance browser", tab: "typography" },
  { label: "Privacy & Data", keywords: "cookies storage cache clear", tab: "privacy" },
  { label: "Cookie preferences", keywords: "analytics marketing tracking", tab: "privacy" },
  { label: "Local storage cache", keywords: "storage quota clear local data", tab: "privacy" },
  { label: "KagZ AI", keywords: "personality tone instructions memory limits", tab: "ai" },
  { label: "Personality & Tone", keywords: "professional playful concise mentor creative", tab: "ai" },
  { label: "Custom instructions", keywords: "prompt behaviour format code", tab: "ai" },
  { label: "Session Continuity", keywords: "resume last start fresh reload", tab: "ai" },
  { label: "Memory", keywords: "usage remaining words limit", tab: "ai" },
];

const SidebarSkeletonItem = () => (
  <div className="flex items-center w-full py-1.5 px-3 mb-0.5 animate-pulse">
    <div className="w-[18px] h-[18px] rounded bg-gray-200/60 dark:bg-white/10 mr-2.5 shrink-0" />
    <div className="h-[14px] bg-gray-200/60 dark:bg-white/10 rounded w-3/5" />
  </div>
);

const Sidebar = () => {
  const {
    user,
    logout,
    updatePreferences,
    memory: memoryStatus,
    refreshMemory,
  } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
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
    workspaceTree,
    setWorkspaceTree,
    recentPages,
    favoriteItems,
    loadWorkspaceData,
    refreshSidebarTrigger,
    triggerSidebarRefresh,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  } = useContext(EditorContext);
  const isCollapsed = isSidebarCollapsed;
  const setIsCollapsed = setIsSidebarCollapsed;

  // Auto-close mobile drawer on route changes
  useEffect(() => {
    if (setIsMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
  }, [location.pathname, setIsMobileSidebarOpen]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [expandedFolders, setExpandedFolders] = useState({
    "favorites-section": false,
    "workspaces-section": true,
    "recent-section": true,
    "chat-history-section": false,
  });
  const [expandedFavoriteFolders, setExpandedFavoriteFolders] = useState({});
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);

  const { sectionStates, loadSection, updateSectionData } =
    useSectionLoader();

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
      if (
        e.altKey &&
        (e.code === "KeyS" ||
          e.key === "s" ||
          e.key === "S" ||
          e.keyCode === 83)
      ) {
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
  const debouncedSearchQuery = "";

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem("noema-sidebar-width"));
    return Number.isFinite(savedWidth)
      ? Math.min(600, Math.max(200, savedWidth))
      : 270;
  });
  const isResizing = useRef(false);
  const resizeCleanupRef = useRef(null);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const [showNewWorkspaceModal, setShowNewWorkspaceModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspacePos, setNewWorkspacePos] = useState({ top: 0, left: 0 });
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const isCreatingWorkspaceRef = useRef(false);
  const isModalSubmittingRef = useRef(false);

  const [showSettingsCard, setShowSettingsCard] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [settingsTab, setSettingsTab] = useState("preferences");
  const [settingsMobileView, setSettingsMobileView] = useState("menu");
  const [isSettingsMobile, setIsSettingsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsSettingsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (showSettingsCard && isSettingsMobile) {
      setSettingsMobileView("menu");
    }
  }, [showSettingsCard, isSettingsMobile]);

  useEffect(() => {
    if (showSettingsCard && settingsTab === "ai") {
      refreshMemory(true).catch(() => {});
    }
  }, [showSettingsCard, settingsTab, refreshMemory]);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState("");
  const [extraContrast, setExtraContrast] = useState(
    () => localStorage.getItem("noema-high-contrast") === "true",
  );
  const [fontSize, setFontSize] = useState(() =>
    parseInt(localStorage.getItem("noema-font-size") || "16", 10),
  );
  const [cookiePrefs, setCookiePrefs] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("noema-cookie-prefs") ||
          '{"essential":true,"analytics":false,"marketing":false}',
      );
    } catch {
      return { essential: true, analytics: false, marketing: false };
    }
  });
  const [showCookiePanel, setShowCookiePanel] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showStartupDropdown, setShowStartupDropdown] = useState(false);
  const [showPersonaDropdown, setShowPersonaDropdown] = useState(false);
  const [fontFamily, setFontFamily] = useState(
    () => localStorage.getItem("noema-font-family") || "sans",
  );
  const [spellCheck, setSpellCheck] = useState(
    () => localStorage.getItem("noema-spellcheck") === "true",
  );
  const [storageUsage, setStorageUsage] = useState("0 B");
  const [aiPersona, setAiPersona] = useState(
    () => user?.preferences?.aiPersona || "professional",
  );
  const [aiCustomInstructions, setAiCustomInstructions] = useState(
    () => user?.preferences?.customInstructions || "",
  );
  const [isSavingAiPrefs, setIsSavingAiPrefs] = useState(false);

  useEffect(() => {
    if (user?.preferences) {
      if (user.preferences.aiPersona) setAiPersona(user.preferences.aiPersona);
      if (user.preferences.customInstructions !== undefined)
        setAiCustomInstructions(user.preferences.customInstructions);
    }
  }, [user?.preferences]);

  const countWords = (text) => {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).length;
  };

  const savedAiPersona = user?.preferences?.aiPersona || "professional";
  const savedAiInstructions = user?.preferences?.customInstructions || "";
  const hasAiPrefsChanged =
    aiPersona !== savedAiPersona ||
    aiCustomInstructions !== savedAiInstructions;

  const handleSaveAiPrefs = async () => {
    if (
      isSavingAiPrefs ||
      !hasAiPrefsChanged ||
      countWords(aiCustomInstructions) > 100
    )
      return;
    setIsSavingAiPrefs(true);
    try {
      await updatePreferences({
        aiPersona,
        customInstructions: aiCustomInstructions,
      });
      showToast("AI preferences saved successfully!", "success");
    } catch (err) {
      showToast(
        err.response?.data?.message || "Failed to save AI preferences",
        "error",
      );
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
    document.documentElement.style.setProperty(
      "--noema-font-size",
      `${fontSize}px`,
    );
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
    if (fontFamily === "serif") {
      document.documentElement.style.setProperty(
        "--font-sans",
        '"Source Serif 4", "Lyon Text", Georgia, serif',
      );
      document.documentElement.style.setProperty(
        "--ui-font",
        '"Source Serif 4", "Lyon Text", Georgia, serif',
      );
    } else if (fontFamily === "mono") {
      document.documentElement.style.setProperty(
        "--font-sans",
        '"JetBrains Mono", "SF Mono", Menlo, monospace',
      );
      document.documentElement.style.setProperty(
        "--ui-font",
        '"JetBrains Mono", "SF Mono", Menlo, monospace',
      );
    } else if (fontFamily === "system") {
      document.documentElement.style.setProperty(
        "--font-sans",
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      );
      document.documentElement.style.setProperty(
        "--ui-font",
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      );
    } else {
      document.documentElement.style.setProperty(
        "--font-sans",
        '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      );
      document.documentElement.style.setProperty(
        "--ui-font",
        '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      );
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

  const topNavItems = [
    {
      id: "home",
      label: "Home",
      path: "/dashboard/page/new",
      icon: () => (
        <HugeiconsIcon
          icon={Home01Icon}
          size={17}
          strokeWidth={1.8}
          className="leading-none select-none"
        />
      ),
    },
    {
      id: "chat",
      label: "Chat",
      path: "/dashboard/chat",
      icon: () => (
        <HugeiconsIcon
          icon={BubbleChatNotificationIcon}
          size={17}
          strokeWidth={1.8}
          className="leading-none select-none"
        />
      ),
    },
    {
      id: "tasks",
      label: "Tasks",
      path: "/dashboard/tasks",
      icon: () => (
        <HugeiconsIcon
          icon={ListTodoIcon}
          size={17}
          strokeWidth={1.8}
          className="leading-none select-none"
        />
      ),
    },
  ];

  const isHomeActive = () => {
    return location.pathname === "/dashboard/page/new";
  };

  // Real API-backed tree state
  const [mockTree, setMockTree] = useState([]);
  const [mockRecent, setMockRecent] = useState([]);
  const [mockFavorites, setMockFavorites] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);

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
  const loadWorkspacesSection = useCallback(
    async (force = false) => {
      return loadSection(
        "workspaces-section",
        async () => {
          const data = await loadWorkspaceData(force);
          return data.workspaceTree;
        },
        { force },
      );
    },
    [loadSection, loadWorkspaceData],
  );

  const loadRecentSection = useCallback(
    async (force = false) => {
      return loadSection(
        "recent-section",
        async () => {
          if (!force && recentPages && recentPages.length > 0) {
            setMockRecent(recentPages);
            return recentPages;
          }
          const data = await loadWorkspaceData(force);
          return data.recentPages;
        },
        { force },
      );
    },
    [loadSection, recentPages, loadWorkspaceData],
  );

  const loadFavoritesSection = useCallback(
    async (force = false) => {
      return loadSection(
        "favorites-section",
        async () => {
          if (!force && favoriteItems && favoriteItems.length > 0) {
            setMockFavorites(favoriteItems);
            return favoriteItems;
          }
          const data = await loadWorkspaceData(force);
          return data.favoriteItems;
        },
        { force },
      );
    },
    [loadSection, favoriteItems, loadWorkspaceData],
  );

  const loadChatHistorySection = useCallback(
    async (force = false) => {
      return loadSection(
        "chat-history-section",
        async () => {
          const res = await chatAPI.getSessions();
          const sessions = res.data.sessions || [];
          setChatSessions(sessions);
          return sessions;
        },
        { force },
      );
    },
    [loadSection],
  );

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

  // Load recent & workspaces sections on initial load since they are open by default
  useEffect(() => {
    loadRecentSection();
    loadWorkspacesSection();
  }, [loadRecentSection, loadWorkspacesSection]);

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

  const handleCreateWorkspace = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isCreatingWorkspaceRef.current || isCreatingWorkspace) return;
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;

    isCreatingWorkspaceRef.current = true;
    setIsCreatingWorkspace(true);

    try {
      const res = await workspacesAPI.create(trimmed);
      if (res.data?.success) {
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
        showToast(`Workspace "${ws.name}" created`, "success");
        setNewWorkspaceName("");
        setShowNewWorkspaceModal(false);
      } else {
        showToast("Failed to create workspace", "error");
      }
    } catch (err) {
      console.error("Create workspace failed:", err);
      showToast(
        err?.response?.data?.message || "Failed to create workspace",
        "error",
      );
    } finally {
      isCreatingWorkspaceRef.current = false;
      setIsCreatingWorkspace(false);
    }
  };

  const handleModalConfirm = async (inputValue, selectedPageType) => {
    if (isModalSubmittingRef.current) return false;
    isModalSubmittingRef.current = true;
    const { action, nodeId } = modalState;
    const targetNodeId =
      nodeId || (action === "ADD_PAGE" ? createPageLocation?.id : null);
    if (!targetNodeId) {
      isModalSubmittingRef.current = false;
      return false;
    }

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
          showToast("Chat cleared", "success");
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
        showToast("Deleted successfully", "success");
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
        showToast("Renamed successfully", "success");
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
          showToast(`Folder "${folder.name}" created`, "success");
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
          showToast(`Page "${page.title}" created`, "success");
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
      showToast(
        err?.response?.data?.message ||
          "The sidebar action failed. Please try again.",
        "error",
      );
      return false;
    } finally {
      isModalSubmittingRef.current = false;
    }
    return false;
  };

  if (isCollapsed && !isMobileSidebarOpen) {
    return (
      <SearchPalette
        isOpen={isSearchActive}
        onClose={() => setIsSearchActive(false)}
        recentPages={mockRecent}
      />
    );
  }

  const renderMenuDropdown = () => {
    if (!activeMenu) return null;
    const node = findNode(activeMenu);
    if (!node) return null;

    if (node.type === "chat") {
      return (
        <div
          role="listbox"
          className="fixed bg-white dark:bg-[#202020] rounded-[6px] border border-[#f0efed] dark:border-[#2c2c2b] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] p-1 z-[100] w-[220px] select-none transition-all duration-160 ease-out"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="option"
            className="w-full h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] text-[#d93838] dark:text-[#ff6b61] flex items-center text-[15px] leading-[18px] font-normal transition-colors cursor-pointer"
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
            <div className="w-5 h-5 flex items-center justify-center mr-2 text-current shrink-0">
              <HugeiconsIcon
                icon={Delete02Icon}
                size={16}
                className="select-none"
              />
            </div>
            <span>Delete Chat</span>
          </button>
        </div>
      );
    }

    return (
      <div
        role="listbox"
        className="fixed bg-white dark:bg-[#202020] rounded-[6px] border border-[#f0efed] dark:border-[#2c2c2b] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] p-1 z-[100] w-[220px] select-none transition-all duration-160 ease-out"
        style={{ top: menuPos.top, left: menuPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="option"
          className="w-full h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] flex items-center text-[#181817] dark:text-[#f7f6f4] text-[15px] leading-[18px] font-normal transition-colors cursor-pointer"
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
          <div className="w-5 h-5 flex items-center justify-center mr-2 text-current shrink-0">
            <HugeiconsIcon
              icon={StarIcon}
              size={16}
              className={`select-none ${node.isFavorite ? "text-yellow-400 fill-yellow-400" : "text-[#7d7a75] dark:text-[#a19e99]"}`}
            />
          </div>
          <span className="truncate">
            {node.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
          </span>
        </button>

        <div
          className="h-px bg-[#f0efed] dark:bg-[#2c2c2b] my-1"
          role="separator"
        />

        {(node.type === "workspace" || node.type === "folder") && (
          <>
            <button
              type="button"
              role="option"
              className="w-full h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] flex items-center text-[#181817] dark:text-[#f7f6f4] text-[15px] leading-[18px] font-normal transition-colors cursor-pointer"
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
              <div className="w-5 h-5 flex items-center justify-center mr-2 text-[#7d7a75] dark:text-[#a19e99] shrink-0">
                <span className="material-symbols-outlined text-[16px] leading-none select-none">
                  note_add
                </span>
              </div>
              <span>New Page</span>
            </button>
            <button
              type="button"
              role="option"
              className="w-full h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] flex items-center text-[#181817] dark:text-[#f7f6f4] text-[15px] leading-[18px] font-normal transition-colors cursor-pointer"
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
              <div className="w-5 h-5 flex items-center justify-center mr-2 text-[#7d7a75] dark:text-[#a19e99] shrink-0">
                <span className="material-symbols-outlined text-[16px] leading-none select-none">
                  folder
                </span>
              </div>
              <span>New Folder</span>
            </button>
            <div
              className="h-px bg-[#f0efed] dark:bg-[#2c2c2b] my-1"
              role="separator"
            />
          </>
        )}

        <button
          type="button"
          role="option"
          className="w-full h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] flex items-center text-[#181817] dark:text-[#f7f6f4] text-[15px] leading-[18px] font-normal transition-colors cursor-pointer"
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
          <div className="w-5 h-5 flex items-center justify-center mr-2 text-[#7d7a75] dark:text-[#a19e99] shrink-0">
            <HugeiconsIcon
              icon={Edit03Icon}
              size={16}
              className="select-none"
            />
          </div>
          <span>Rename</span>
        </button>

        <button
          type="button"
          role="option"
          className="w-full h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] text-[#d93838] dark:text-[#ff6b61] flex items-center text-[15px] leading-[18px] font-normal transition-colors cursor-pointer"
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
          <div className="w-5 h-5 flex items-center justify-center mr-2 text-current shrink-0">
            <HugeiconsIcon
              icon={Delete02Icon}
              size={16}
              className="select-none"
            />
          </div>
          <span>Delete</span>
        </button>
      </div>
    );
  };

  const renderAddMenuDropdown = () => {
    if (!activeAddMenu) return null;

    return (
      <div
        role="listbox"
        className="fixed bg-white dark:bg-[#202020] rounded-[6px] border border-[#f0efed] dark:border-[#2c2c2b] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] p-1 z-[100] w-[180px] select-none transition-all duration-160 ease-out"
        style={{ top: addMenuPos.top, left: addMenuPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="option"
          className="w-full h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] flex items-center text-[#181817] dark:text-[#f7f6f4] text-[15px] leading-[18px] font-normal transition-colors cursor-pointer"
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
          <div className="w-5 h-5 flex items-center justify-center mr-2 text-[#7d7a75] dark:text-[#a19e99] shrink-0">
            <span className="material-symbols-outlined text-[16px] leading-none select-none">
              note_add
            </span>
          </div>
          <span>New Page</span>
        </button>
        <button
          type="button"
          role="option"
          className="w-full h-[30px] px-2 rounded-[4px] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] flex items-center text-[#181817] dark:text-[#f7f6f4] text-[15px] leading-[18px] font-normal transition-colors cursor-pointer"
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
          <div className="w-5 h-5 flex items-center justify-center mr-2 text-[#7d7a75] dark:text-[#a19e99] shrink-0">
            <span className="material-symbols-outlined text-[16px] leading-none select-none">
              folder
            </span>
          </div>
          <span>New Folder</span>
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
      return (
        text.toLowerCase().includes(query) || desc.toLowerCase().includes(query)
      );
    };

    const openSettingsTab = (tab) => {
      setSettingsTab(tab);
      setSettingsSearchQuery("");
      setSettingsMobileView("content");
    };

    const handleMobileBack = () => {
      setSettingsSearchQuery("");
      setSettingsMobileView("menu");
    };

    const activeSettingsTitle = settingsSearchQuery
      ? "Search Results"
      : SETTINGS_TAB_TITLES[settingsTab] || "Settings";
    const mobileSearchResults = MOBILE_SETTINGS_ITEMS.filter((item) =>
      matchesQuery(item.label, item.keywords),
    );
    const showMobileMenu = isSettingsMobile && settingsMobileView === "menu";

    return createPortal(
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-[4px]"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowSettingsCard(false);
        }}
      >
        <div
          className="bg-[var(--c-surface)] text-[var(--c-text-primary)] shadow-[0_14px_28px_-6px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.5)] flex w-full h-[100dvh] max-w-none max-h-none rounded-none border-0 md:w-[92vw] md:max-w-[1040px] md:h-[86vh] md:max-h-[760px] md:rounded-[16px] md:border md:border-[var(--c-border)] overflow-hidden text-sm relative"
          style={{
            fontFamily:
              "var(--ui-font, ui-sans-serif, -apple-system, system-ui, sans-serif)",
          }}
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
            type="button"
            onClick={() => setShowSettingsCard(false)}
            className="hidden md:flex absolute top-3.5 right-3.5 w-7 h-7 items-center justify-center hover:bg-[var(--ca-hover)] rounded-[6px] transition-colors duration-100 text-[var(--c-icon-secondary)] hover:text-[var(--c-text-primary)] z-20 cursor-pointer"
            aria-label="Close settings"
          >
            <span className="material-symbols-outlined text-[18px] leading-none select-none">
              close
            </span>
          </button>

          {/* Mobile Settings Menu */}
          {showMobileMenu && (
            <div className="md:hidden flex-1 min-h-0 flex flex-col bg-[var(--c-surface)] overflow-y-auto custom-scrollbar">
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-center justify-between h-11">
                  <h1 className="text-[28px] font-semibold tracking-tight text-[var(--c-text-primary)]">
                    Settings
                  </h1>
                  <button
                    type="button"
                    onClick={() => setShowSettingsCard(false)}
                    aria-label="Close settings"
                    className="w-9 h-9 -mr-1.5 flex items-center justify-center rounded-full text-[var(--c-text-secondary)] hover:bg-[var(--ca-hover)] active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[22px] leading-none select-none">
                      close
                    </span>
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2.5 h-11 px-3 rounded-[20px] bg-[var(--c-surface-well)] dark:bg-[var(--c-surface-elevated)] border border-[var(--c-border-hairline)] focus-within:border-[var(--c-border-strong)] transition-colors duration-100">
                  <span className="material-symbols-outlined text-[20px] text-[var(--c-icon-secondary)] leading-none select-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={settingsSearchQuery}
                    onChange={(e) => setSettingsSearchQuery(e.target.value)}
                    placeholder="Search settings"
                    className="flex-1 min-w-0 bg-transparent text-[16px] text-[var(--c-text-primary)] placeholder:text-[var(--c-text-tertiary)] outline-none"
                  />
                  {settingsSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSettingsSearchQuery("")}
                      aria-label="Clear search"
                      className="w-6 h-6 flex items-center justify-center rounded-full text-[var(--c-icon-secondary)] hover:bg-[var(--ca-hover)] cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] leading-none select-none">
                        cancel
                      </span>
                    </button>
                  ) : (
                    <span className="text-[12px] font-medium text-[var(--c-text-tertiary)] select-none">
                      ⌘K
                    </span>
                  )}
                </div>
              </div>

              {settingsSearchQuery ? (
                <div className="px-4 pb-10 mt-2">
                  {mobileSearchResults.length > 0 ? (
                    <div className="rounded-[30px] bg-[var(--c-surface-well)] dark:bg-[var(--c-surface-elevated)] divide-y divide-[var(--c-border)] dark:divide-[var(--c-border-hairline)] overflow-hidden">
                      {mobileSearchResults.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => openSettingsTab(item.tab)}
                          className="w-full flex items-center justify-between gap-3 px-4 h-12 text-left text-[14.5px] text-[var(--c-text-primary)] hover:bg-[var(--ca-hover)] transition-colors duration-100 cursor-pointer"
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="material-symbols-outlined text-[18px] text-[var(--c-icon-secondary)] shrink-0 select-none">
                            chevron_right
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-1 pt-6 text-[13px] text-[var(--c-text-secondary)]">
                      No settings found for “{settingsSearchQuery}”.
                    </p>
                  )}
                </div>
              ) : (
                <div className="px-4 pb-8 flex-1 flex flex-col">
                  <button
                    type="button"
                    onClick={() => openSettingsTab("preferences")}
                    className="relative w-full flex items-center gap-3.5 rounded-[24px] bg-[var(--c-surface-well)] dark:bg-[var(--c-surface-elevated)] px-4 py-3.5 mt-1 mb-6 text-left overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] active:scale-[0.995] transition-transform duration-100 cursor-pointer"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-400/15 via-indigo-400/5 to-violet-400/15 dark:from-sky-500/15 dark:via-indigo-500/10 dark:to-violet-500/15"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/20"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -left-14 -bottom-20 h-40 w-40 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/15"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-white/10 dark:from-white/[0.03] dark:to-transparent"
                    />
                    {avatar ? (
                      <img
                        src={avatar}
                        alt="Avatar"
                        className="relative w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-[var(--c-brand)]/20"
                      />
                    ) : (
                      <div className="relative w-12 h-12 rounded-full bg-[var(--c-brand-subtle)] text-[var(--c-brand)] ring-1 ring-[var(--c-brand)]/25 flex items-center justify-center font-semibold text-[18px] shrink-0 select-none">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="relative flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-[var(--c-text-primary)] text-[15.5px] leading-tight truncate">
                        {displayName}
                      </span>
                      <span className="text-[12.5px] text-[var(--c-text-secondary)] mt-0.5 truncate">
                        {user?.email || "Personal account"}
                      </span>
                    </div>
                    <span className="relative material-symbols-outlined text-[18px] text-[var(--c-icon-secondary)] leading-none select-none shrink-0">
                      chevron_right
                    </span>
                  </button>

                  <div className="text-[14px] font-medium text-[var(--c-text-secondary)] px-1 mt-0 mb-2">
                    General
                  </div>
                  <div className="rounded-[30px] bg-[var(--c-surface-well)] dark:bg-[var(--c-surface-elevated)] divide-y divide-[var(--c-border)] dark:divide-[var(--c-border-hairline)] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => openSettingsTab("preferences")}
                      className="w-full flex items-center gap-3 px-4 h-[54px] text-left hover:bg-[var(--ca-hover)] transition-colors duration-100 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        person
                      </span>
                      <span className="flex-1 truncate text-[15px] font-medium text-[var(--c-text-primary)]">
                        Account & Preferences
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-[var(--c-icon-secondary)] leading-none select-none">
                        chevron_right
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openSettingsTab("typography")}
                      className="w-full flex items-center gap-3 px-4 h-[54px] text-left hover:bg-[var(--ca-hover)] transition-colors duration-100 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        text_fields
                      </span>
                      <span className="flex-1 truncate text-[15px] font-medium text-[var(--c-text-primary)]">
                        Typography & Editor
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-[var(--c-icon-secondary)] leading-none select-none">
                        chevron_right
                      </span>
                    </button>
                  </div>

                  <div className="text-[14px] font-medium text-[var(--c-text-secondary)] px-1 mt-7 mb-2">
                    Workspace
                  </div>
                  <div className="rounded-[30px] bg-[var(--c-surface-well)] dark:bg-[var(--c-surface-elevated)] divide-y divide-[var(--c-border)] dark:divide-[var(--c-border-hairline)] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => openSettingsTab("privacy")}
                      className="w-full flex items-center gap-3 px-4 h-[54px] text-left hover:bg-[var(--ca-hover)] transition-colors duration-100 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        shield
                      </span>
                      <span className="flex-1 truncate text-[15px] font-medium text-[var(--c-text-primary)]">
                        Privacy & Data
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-[var(--c-icon-secondary)] leading-none select-none">
                        chevron_right
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openSettingsTab("ai")}
                      className="w-full flex items-center gap-3 px-4 h-[54px] text-left hover:bg-[var(--ca-hover)] transition-colors duration-100 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        auto_awesome
                      </span>
                      <span className="flex-1 truncate text-[15px] font-medium text-[var(--c-text-primary)]">
                        KagZ AI
                      </span>
                      <span className="material-symbols-outlined text-[18px] text-[var(--c-icon-secondary)] leading-none select-none">
                        chevron_right
                      </span>
                    </button>
                  </div>

                  <div className="mt-auto pt-10">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(true)}
                      className="w-full flex items-center gap-3 px-4 h-[54px] rounded-[16px] text-left text-[var(--c-text-primary)] hover:bg-[var(--ca-hover)] active:bg-[var(--ca-selected)] transition-colors duration-100 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px] leading-none select-none">
                        logout
                      </span>
                      <span className="text-[15px] font-medium">Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Left Sidebar Nav */}
          <div className="hidden md:flex w-[240px] bg-[var(--c-surface-elevated)] border-r border-[var(--c-border-hairline)] flex-col py-3.5 px-2.5 shrink-0 select-none">
            {/* Search settings */}
            <div className="mb-2 px-0.5">
              <div className="flex items-center gap-2 h-8 px-2.5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[8px] text-[var(--c-icon-secondary)] focus-within:border-[var(--c-border-strong)] transition-colors duration-100">
                <span className="material-symbols-outlined text-[16px] select-none text-[var(--c-icon-secondary)] shrink-0">
                  search
                </span>
                <input
                  type="text"
                  value={settingsSearchQuery}
                  onChange={(e) => setSettingsSearchQuery(e.target.value)}
                  placeholder="Search settings"
                  className="bg-transparent text-[13px] text-[var(--c-text-primary)] placeholder:text-[var(--c-text-tertiary)] outline-none w-full"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-0.5">
              {/* Account & Preferences Group */}
              <div className="flex flex-col gap-0.5">
                <div className="px-2 pt-1.5 pb-0.5">
                  <span className="text-[11.5px] font-medium leading-none text-[var(--c-text-tertiary)]">
                    General
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsTab("preferences")}
                  aria-current={
                    settingsTab === "preferences" ? "page" : undefined
                  }
                  className={`flex items-center gap-2.5 w-full px-2 h-8 rounded-[6px] text-[13.5px] transition-colors duration-100 text-left cursor-pointer ${
                    settingsTab === "preferences"
                      ? "bg-[var(--ca-selected)] text-[var(--c-text-primary)] font-medium"
                      : "text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-[var(--ca-hover)]"
                  }`}
                >
                  <SlidersHorizontalIcon
                    size={15}
                    strokeWidth={1.8}
                    className="shrink-0"
                  />
                  <span className="truncate">Account & Preferences</span>
                </button>
              </div>

              {/* Workspace Group */}
              <div className="flex flex-col gap-0.5">
                <div className="px-2 pt-1.5 pb-0.5">
                  <span className="text-[11.5px] font-medium leading-none text-[var(--c-text-tertiary)]">
                    Workspace
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsTab("typography")}
                  aria-current={
                    settingsTab === "typography" ? "page" : undefined
                  }
                  className={`flex items-center gap-2.5 w-full px-2 h-8 rounded-[6px] text-[13.5px] transition-colors duration-100 text-left cursor-pointer ${
                    settingsTab === "typography"
                      ? "bg-[var(--ca-selected)] text-[var(--c-text-primary)] font-medium"
                      : "text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-[var(--ca-hover)]"
                  }`}
                >
                  <HugeiconsIcon
                    icon={TextIcon}
                    size={15}
                    className="shrink-0"
                  />
                  <span className="truncate">Typography & Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("privacy")}
                  aria-current={settingsTab === "privacy" ? "page" : undefined}
                  className={`flex items-center gap-2.5 w-full px-2 h-8 rounded-[6px] text-[13.5px] transition-colors duration-100 text-left cursor-pointer ${
                    settingsTab === "privacy"
                      ? "bg-[var(--ca-selected)] text-[var(--c-text-primary)] font-medium"
                      : "text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-[var(--ca-hover)]"
                  }`}
                >
                  <HugeiconsIcon
                    icon={Shield01Icon}
                    size={15}
                    strokeWidth={1.8}
                    className="shrink-0"
                  />
                  <span className="truncate">Privacy & Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab("ai")}
                  aria-current={settingsTab === "ai" ? "page" : undefined}
                  className={`flex items-center gap-2.5 w-full px-2 h-8 rounded-[6px] text-[13.5px] transition-colors duration-100 text-left cursor-pointer ${
                    settingsTab === "ai"
                      ? "bg-[var(--ca-selected)] text-[var(--c-text-primary)] font-medium"
                      : "text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)] hover:bg-[var(--ca-hover)]"
                  }`}
                >
                  <img
                    src="/kagz.png"
                    alt="KagZ AI"
                    className="w-5 h-5 object-contain shrink-0 rounded-[4px] select-none"
                  />
                  <span className="truncate">KagZ AI</span>
                </button>
              </div>
            </div>

            {/* Bottom Logout */}
            <div className="mt-auto pt-2 border-t border-[var(--c-border-hairline)] px-0.5">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full flex items-center gap-2 px-2 h-8 text-[13px] font-medium rounded-[6px] transition-colors duration-100 text-[var(--c-text-secondary)] hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] leading-none select-none">
                  logout
                </span>{" "}
                Log out
              </button>
            </div>
          </div>

          {/* Right Content */}
          <div
            className={`${showMobileMenu ? "hidden md:flex" : "flex"} flex-1 min-h-0 flex-col overflow-y-auto custom-scrollbar px-0 py-0 md:px-12 md:py-8 relative bg-[var(--c-surface)]`}
          >
            {/* Mobile subpage top bar */}
            <div className="md:hidden sticky top-0 z-30 flex items-center h-14 px-2 bg-[var(--c-surface)]/95 backdrop-blur-md border-b border-[var(--c-border-hairline)] shrink-0">
              <button
                type="button"
                onClick={handleMobileBack}
                aria-label="Back to settings"
                className="w-10 h-10 flex items-center justify-center rounded-full text-[var(--c-text-primary)] hover:bg-[var(--ca-hover)] active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[22px] leading-none select-none">
                  arrow_back
                </span>
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 text-[16px] font-semibold text-[var(--c-text-primary)] max-w-[55%] truncate">
                {activeSettingsTitle}
              </span>
              {settingsTab === "ai" && !settingsSearchQuery ? (
                <button
                  type="button"
                  onClick={handleSaveAiPrefs}
                  disabled={
                    isSavingAiPrefs ||
                    !hasAiPrefsChanged ||
                    countWords(aiCustomInstructions) > 100
                  }
                  className="ml-auto mr-2 h-9 px-2 text-[14px] font-semibold text-[var(--c-brand)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity cursor-pointer"
                >
                  {isSavingAiPrefs ? "Saving..." : "Save"}
                </button>
              ) : (
                <span className="w-10 ml-auto" />
              )}
            </div>

            <div className="px-4 pb-10 pt-4 md:px-0 md:pb-0 md:pt-0 md:flex md:flex-col md:flex-1">
            {/* Account & Preferences Tab */}
            {settingsTab === "preferences" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[680px] w-full mx-auto">
                <h2 className="hidden md:block text-[19px] font-semibold text-[var(--c-text-primary)] tracking-tight">
                  Account & Preferences
                </h2>
                <p className="hidden md:block text-[13px] text-[var(--c-text-secondary)] mt-0.5 mb-7">
                  Manage your personal profile, credentials, and app preferences
                </p>

                <div className="flex flex-col gap-7">
                  {/* Account Section */}
                  <div>
                    <h3 className="text-[12px] font-medium text-[var(--c-text-tertiary)] uppercase tracking-[0.04em] mb-2.5 max-md:normal-case max-md:tracking-normal max-md:px-1 max-md:text-[14px] max-md:text-[var(--c-text-secondary)]">
                      Account
                    </h3>

                    <div className="rounded-[10px] max-md:rounded-[22px] bg-[var(--c-surface-elevated)] max-md:bg-[var(--c-surface-well)] dark:max-md:bg-[var(--c-surface-elevated)] border border-[var(--c-border-hairline)] max-md:border-0 divide-y divide-[var(--c-border-hairline)] max-md:divide-[var(--c-border)] dark:max-md:divide-[var(--c-border-hairline)] overflow-hidden">
                      {/* Identity Row */}
                      <div className="relative flex items-center gap-3.5 p-3.5 max-md:p-4 overflow-hidden">
                        <div className="md:hidden pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-[var(--c-brand)]/10 blur-2xl" />
                        {avatar ? (
                          <img
                            src={avatar}
                            alt="Avatar"
                            className="relative w-11 h-11 rounded-full object-cover shrink-0 border border-[var(--c-border-hairline)] max-md:border-0 max-md:w-12 max-md:h-12 max-md:ring-2 max-md:ring-[var(--c-brand)]/20"
                          />
                        ) : (
                          <div className="relative w-11 h-11 rounded-full bg-[var(--c-brand-subtle)] text-[var(--c-brand)] border border-[var(--c-brand)]/20 flex items-center justify-center font-medium text-base shrink-0 select-none max-md:border-0 max-md:ring-1 max-md:ring-[var(--c-brand)]/25 max-md:font-semibold max-md:text-[18px]">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="relative flex flex-col min-w-0">
                          <span className="font-medium text-[var(--c-text-primary)] text-[14px] leading-tight truncate max-md:font-semibold max-md:text-[15px]">
                            {displayName}
                          </span>
                          <span className="text-[12.5px] text-[var(--c-text-secondary)] mt-0.5 truncate max-md:text-[13px]">
                            {user?.email || "No email"}
                          </span>
                        </div>
                      </div>

                      {/* Metadata Rows */}
                      <div className="px-3.5 py-2.5 flex items-center justify-between text-[12.5px]">
                        <span className="text-[var(--c-text-secondary)]">
                          Sign-in method
                        </span>
                        <span className="text-[var(--c-text-primary)] font-medium capitalize">
                          {user?.authProvider === "google" ? (
                            <div className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                <path
                                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                  fill="#4285F4"
                                />
                                <path
                                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                  fill="#34A853"
                                />
                                <path
                                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                  fill="#FBBC05"
                                />
                                <path
                                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                  fill="#EA4335"
                                />
                              </svg>
                              Google
                            </div>
                          ) : (
                            user?.authProvider || "Local"
                          )}
                        </span>
                      </div>
                      <div className="px-3.5 py-2.5 flex items-center justify-between text-[12.5px]">
                        <span className="text-[var(--c-text-secondary)]">
                          Member since
                        </span>
                        <span className="text-[var(--c-text-primary)] font-medium">
                          {joinedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Appearance Section */}
                  <div>
                    <h3 className="text-[12px] font-medium text-[var(--c-text-tertiary)] uppercase tracking-[0.04em] mb-2.5 max-md:normal-case max-md:tracking-normal max-md:px-1 max-md:text-[14px] max-md:text-[var(--c-text-secondary)]">
                      Appearance
                    </h3>

                    <div className="flex flex-col divide-y divide-[var(--c-border-hairline)] max-md:rounded-[14px] max-md:border max-md:border-[var(--c-border-hairline)] max-md:bg-[var(--c-surface-elevated)] max-md:px-4 md:border-y md:border-[var(--c-border-hairline)]">
                      {/* Theme Dropdown */}
                      <div className="flex items-center justify-between gap-3 py-3 max-md:flex-wrap max-md:gap-y-0">
                        <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                          dark_mode
                        </span>
                        <div className="flex flex-col pr-4 max-md:flex-1 max-md:pr-0">
                          <span className="text-[13px] max-md:text-[15px] font-medium text-[var(--c-text-primary)] leading-snug">
                            Theme
                          </span>
                          <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5 max-md:hidden">
                            Choose your interface theme for this device
                          </span>
                        </div>

                        <div className="relative shrink-0 max-md:w-full max-md:mt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowThemeDropdown(!showThemeDropdown);
                              setShowStartupDropdown(false);
                              setShowFontDropdown(false);
                              setShowPersonaDropdown(false);
                            }}
                            className="flex items-center justify-between gap-2 min-w-[150px] h-8 px-2.5 text-[12.5px] font-medium rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] hover:bg-[var(--ca-hover)] text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-brand)] max-md:w-full max-md:h-11 max-md:min-w-0 max-md:rounded-[14px] max-md:border-0 max-md:bg-[var(--c-surface-input)] max-md:px-3.5 max-md:text-[14px]"
                          >
                            <span>
                              {theme === "system"
                                ? "System default"
                                : theme === "light"
                                  ? "Light"
                                  : "Dark"}
                            </span>
                            <span
                              className={`material-symbols-outlined text-[15px] max-md:text-[19px] text-[var(--c-icon-secondary)] select-none transition-transform duration-100 ${showThemeDropdown ? "rotate-180" : ""}`}
                            >
                              expand_more
                            </span>
                          </button>
                          {showThemeDropdown && (
                            <div
                              className="absolute right-0 top-full mt-1 w-48 py-1 bg-[var(--c-surface-elevated)] border border-[var(--c-border)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] z-50 text-[12.5px] max-md:left-0 max-md:right-0 max-md:mt-1.5 max-md:w-auto max-md:rounded-[16px] max-md:border-[var(--c-border-hairline)] max-md:p-1.5 max-md:text-[14px] max-md:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)] dark:max-md:shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {[
                                { id: "system", label: "System default" },
                                { id: "light", label: "Light" },
                                { id: "dark", label: "Dark" },
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setTheme(opt.id);
                                    setShowThemeDropdown(false);
                                  }}
                                  className="w-full flex items-center justify-between px-3 py-1.5 text-[var(--c-text-secondary)] hover:bg-[var(--ca-hover)] hover:text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer text-left max-md:h-11 max-md:rounded-[10px] max-md:px-3"
                                >
                                  <span>{opt.label}</span>
                                  {theme === opt.id && (
                                    <span className="material-symbols-outlined text-[15px] max-md:text-[18px] text-[var(--c-brand)] select-none">
                                      check
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* High Contrast */}
                      <div className="flex items-center justify-between gap-3 py-3">
                        <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                          light_mode
                        </span>
                        <div className="flex flex-1 flex-col pr-4 max-md:pr-0">
                          <span className="text-[13px] max-md:text-[15px] font-medium text-[var(--c-text-primary)] leading-snug">
                            High contrast
                          </span>
                          <span className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                            Increase interface contrast and borders for improved
                            visibility
                          </span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={extraContrast}
                          onClick={() => setExtraContrast(!extraContrast)}
                          className={`w-9 h-5 max-md:w-11 max-md:h-[26px] max-md:p-[3px] rounded-full p-0.5 relative transition-colors duration-200 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-brand)] ${
                            extraContrast
                              ? "bg-[var(--c-brand)]"
                              : "bg-black/15 dark:bg-white/15"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 max-md:w-5 max-md:h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${extraContrast ? "translate-x-4 max-md:translate-x-[18px]" : "translate-x-0"}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Input options Section */}
                  <div>
                    <h3 className="text-[12px] font-medium text-[var(--c-text-tertiary)] uppercase tracking-[0.04em] mb-2.5 max-md:normal-case max-md:tracking-normal max-md:px-1 max-md:text-[14px] max-md:text-[var(--c-text-secondary)]">
                      Input & Interaction
                    </h3>

                    <div className="flex flex-col divide-y divide-[var(--c-border-hairline)] max-md:rounded-[14px] max-md:border max-md:border-[var(--c-border-hairline)] max-md:bg-[var(--c-surface-elevated)] max-md:px-4 md:border-y md:border-[var(--c-border-hairline)]">
                      {/* On Startup & Reload Dropdown */}
                      <div className="flex items-center justify-between gap-3 py-3 max-md:flex-col max-md:items-stretch max-md:gap-0">
                        <div className="flex items-start gap-3">
                          <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none mt-0.5">
                            history
                          </span>
                          <div className="flex flex-1 flex-col pr-4 max-md:pr-0">
                            <span className="text-[13px] max-md:text-[15px] font-medium text-[var(--c-text-primary)] leading-snug">
                              On startup & reload
                            </span>
                            <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5 max-w-[420px] max-md:hidden">
                              {chatStartupMode === "resume"
                                ? "Resumes previous chat session on reload"
                                : "Opens fresh on a clean new chat"}
                            </span>
                          </div>
                        </div>
                        <div className="relative shrink-0 max-md:mt-3 max-md:ml-0 max-md:w-full">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowStartupDropdown(!showStartupDropdown);
                              setShowThemeDropdown(false);
                              setShowFontDropdown(false);
                              setShowPersonaDropdown(false);
                            }}
                            className="flex items-center justify-between gap-2 min-w-[150px] h-8 px-2.5 text-[12.5px] font-medium rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] hover:bg-[var(--ca-hover)] text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-brand)] max-md:w-full max-md:h-11 max-md:min-w-0 max-md:rounded-[14px] max-md:border-0 max-md:bg-[var(--c-surface-input)] max-md:px-3.5 max-md:text-[14px]"
                          >
                            <span>
                              {chatStartupMode === "resume"
                                ? "Resume last chat"
                                : "Fresh new chat"}
                            </span>
                            <span
                              className={`material-symbols-outlined text-[15px] max-md:text-[19px] text-[var(--c-icon-secondary)] select-none transition-transform duration-100 ${showStartupDropdown ? "rotate-180" : ""}`}
                            >
                              expand_more
                            </span>
                          </button>
                          {showStartupDropdown && (
                            <div
                              className="absolute right-0 top-full mt-1 w-48 py-1 bg-[var(--c-surface-elevated)] border border-[var(--c-border)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] z-50 text-[12.5px] max-md:left-0 max-md:right-0 max-md:mt-1.5 max-md:w-auto max-md:rounded-[16px] max-md:border-[var(--c-border-hairline)] max-md:p-1.5 max-md:text-[14px] max-md:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)] dark:max-md:shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {[
                                { id: "resume", label: "Resume last chat" },
                                { id: "fresh", label: "Fresh new chat" },
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setChatStartupMode(opt.id);
                                    setShowStartupDropdown(false);
                                  }}
                                  className="w-full flex items-center justify-between px-3 py-1.5 text-[var(--c-text-secondary)] hover:bg-[var(--ca-hover)] hover:text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer text-left max-md:h-11 max-md:rounded-[10px] max-md:px-3"
                                >
                                  <span>{opt.label}</span>
                                  {chatStartupMode === opt.id && (
                                    <span className="material-symbols-outlined text-[15px] max-md:text-[18px] text-[var(--c-brand)] select-none">
                                      check
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reasoning Process Toggle */}
                      <div className="flex items-center justify-between gap-3 py-3">
                        <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                          hub
                        </span>
                        <div className="flex flex-1 flex-col pr-4 max-md:pr-0">
                          <span className="text-[13px] max-md:text-[15px] font-medium text-[var(--c-text-primary)] leading-snug">
                            Reasoning process
                          </span>
                          <span className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                            Show step-by-step thinking orb animation when
                            responding
                          </span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isThinking}
                          onClick={() => setIsThinking(!isThinking)}
                          className={`w-9 h-5 max-md:w-11 max-md:h-[26px] max-md:p-[3px] rounded-full p-0.5 relative transition-colors duration-200 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-brand)] ${
                            isThinking
                              ? "bg-[var(--c-brand)]"
                              : "bg-black/15 dark:bg-white/15"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 max-md:w-5 max-md:h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${isThinking ? "translate-x-4 max-md:translate-x-[18px]" : "translate-x-0"}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Tab: Typography & Editor */}
            {settingsTab === "typography" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[680px] w-full mx-auto">
                <h2 className="hidden md:block text-[24px] font-semibold text-[var(--c-text-primary)] tracking-tight leading-[1.3]">
                  Typography & Editor
                </h2>
                <p className="hidden md:block text-[13px] text-[var(--c-text-secondary)] mt-1 mb-6">
                  Customize your reading and writing experience across notes and
                  documents
                </p>

                <div className="flex flex-col gap-6">
                  {/* Editor typography */}
                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--c-text-primary)] mb-1 max-md:px-1 max-md:text-[14px] max-md:font-medium max-md:text-[var(--c-text-secondary)]">
                      Editor typography
                    </h3>

                    {/* Font Family */}
                    <div className="flex items-center justify-between gap-3 py-2.5 max-md:py-3 max-md:flex-wrap max-md:gap-y-0 border-b border-[var(--c-border-hairline)]">
                      <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        text_fields
                      </span>
                      <div className="flex flex-1 flex-col pr-4 max-md:pr-0">
                        <span className="text-[13.5px] max-md:text-[15px] font-medium text-[var(--c-text-primary)]">
                          Font family
                        </span>
                        <span className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                          Choose the default typeface
                        </span>
                      </div>
                      <div className="relative shrink-0 max-md:w-full max-md:mt-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFontDropdown(!showFontDropdown);
                            setShowThemeDropdown(false);
                            setShowStartupDropdown(false);
                            setShowPersonaDropdown(false);
                          }}
                          className="flex items-center justify-between gap-1.5 min-w-[150px] h-8 px-2.5 text-[13px] rounded-[6px] border border-[var(--c-border)] bg-transparent hover:bg-[var(--ca-hover)] text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer select-none font-normal max-md:w-full max-md:h-11 max-md:min-w-0 max-md:rounded-[14px] max-md:border-0 max-md:bg-[var(--c-surface-input)] max-md:px-3.5 max-md:text-[14px] max-md:font-medium"
                        >
                          <span className="capitalize">
                            {fontFamily === "sans"
                              ? "Inter (Default)"
                              : fontFamily === "serif"
                                ? "Source Serif 4 (Serif)"
                                : fontFamily === "system"
                                  ? "System Default"
                                  : "JetBrains Mono (Monospace)"}
                          </span>
                          <span
                            className={`material-symbols-outlined text-[15px] max-md:text-[19px] text-[var(--c-icon-secondary)] select-none transition-transform duration-100 ${showFontDropdown ? "rotate-180" : ""}`}
                          >
                            expand_more
                          </span>
                        </button>

                        {showFontDropdown && (
                          <div
                            className="absolute right-0 top-full mt-1 w-48 py-1 bg-[var(--c-surface-elevated)] border border-[var(--c-border)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] z-50 text-[12.5px] max-md:left-0 max-md:right-0 max-md:mt-1.5 max-md:w-auto max-md:rounded-[16px] max-md:border-[var(--c-border-hairline)] max-md:p-1.5 max-md:text-[14px] max-md:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)] dark:max-md:shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { id: "sans", label: "Inter (Default)" },
                              { id: "serif", label: "Source Serif 4 (Serif)" },
                              { id: "mono", label: "JetBrains Mono (Monospace)" },
                              { id: "system", label: "System Default" },
                            ].map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => {
                                  setFontFamily(f.id);
                                  setShowFontDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-[var(--c-text-secondary)] hover:bg-[var(--ca-hover)] hover:text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer text-left max-md:h-11 max-md:rounded-[10px] max-md:px-3"
                              >
                                <span>{f.label}</span>
                                {fontFamily === f.id && (
                                  <span className="material-symbols-outlined text-[15px] max-md:text-[18px] text-[var(--c-brand)] select-none">
                                    check
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Font Size */}
                    <div className="flex items-center justify-between gap-3 py-2.5 max-md:py-3">
                      <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        format_size
                      </span>
                      <div className="flex flex-1 flex-col pr-4 max-md:pr-0">
                        <span className="text-[13.5px] max-md:text-[15px] font-medium text-[var(--c-text-primary)]">
                          Font size
                        </span>
                        <span className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                          Adjust interface and editor text size ({fontSize}px)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[var(--c-text-secondary)] bg-transparent rounded-[6px] border border-[var(--c-border)] px-1 h-8 shrink-0 max-md:h-11 max-md:gap-1.5 max-md:rounded-full max-md:border-0 max-md:bg-[var(--c-surface-input)] max-md:px-1.5">
                        <button
                          type="button"
                          onClick={() => handleFontSizeChange(-1)}
                          disabled={fontSize <= 12}
                          className="w-6 h-6 flex items-center justify-center hover:bg-[var(--ca-hover)] rounded-[4px] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm transition-colors duration-100 max-md:w-9 max-md:h-9 max-md:rounded-full max-md:text-[18px]"
                        >
                          -
                        </button>
                        <span className="text-[12px] w-7 text-center font-mono font-medium text-[var(--c-text-primary)] max-md:text-[14px] max-md:w-9">
                          {fontSize}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleFontSizeChange(1)}
                          disabled={fontSize >= 24}
                          className="w-6 h-6 flex items-center justify-center hover:bg-[var(--ca-hover)] rounded-[4px] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-sm transition-colors duration-100 max-md:w-9 max-md:h-9 max-md:rounded-full max-md:text-[18px]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--c-border-hairline)] my-1 max-md:hidden" />

                  {/* Writing assistance */}
                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--c-text-primary)] mb-1 max-md:px-1 max-md:text-[14px] max-md:font-medium max-md:text-[var(--c-text-secondary)]">
                      Writing assistance
                    </h3>
                    <div className="flex items-center justify-between gap-3 py-2.5 max-md:py-3">
                      <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        spellcheck
                      </span>
                      <div className="flex flex-1 flex-col pr-4 max-md:pr-0">
                        <span className="text-[13.5px] max-md:text-[15px] font-medium text-[var(--c-text-primary)]">
                          Spell check
                        </span>
                        <span className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                          Enable browser spell checker in notes
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={spellCheck}
                        onClick={() => setSpellCheck(!spellCheck)}
                        className={`w-8 h-[18px] max-md:w-11 max-md:h-[26px] rounded-full relative transition-colors duration-200 shrink-0 cursor-pointer ${spellCheck ? "bg-[var(--c-brand)]" : "bg-black/15 dark:bg-white/15"}`}
                      >
                        <div
                          className={`absolute top-[2px] left-[2px] max-md:top-[3px] max-md:left-[3px] w-3.5 h-3.5 max-md:w-5 max-md:h-5 rounded-full bg-white transition-transform duration-200 ${spellCheck ? "translate-x-3.5 max-md:translate-x-[18px]" : ""}`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Tab: Privacy & Data */}
            {settingsTab === "privacy" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[680px] w-full mx-auto">
                <h2 className="hidden md:block text-[24px] font-semibold text-[var(--c-text-primary)] tracking-tight leading-[1.3]">
                  Privacy & Data
                </h2>
                <p className="hidden md:block text-[13px] text-[var(--c-text-secondary)] mt-1 mb-6">
                  Manage cookies, storage quotas, and local data persistence
                </p>

                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--c-text-primary)] mb-1 max-md:px-1 max-md:text-[14px] max-md:font-medium max-md:text-[var(--c-text-secondary)]">
                      Cookies & Storage
                    </h3>
                    <div>
                    <div className="py-2.5 max-md:py-3 border-b border-[var(--c-border-hairline)]">
                      <div
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setShowCookiePanel(!showCookiePanel)}
                      >
                        <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                          cookie
                        </span>
                        <div className="flex flex-1 flex-col pr-4 max-md:pr-0">
                          <span className="text-[13.5px] max-md:text-[15px] font-medium text-[var(--c-text-primary)]">
                            Cookie preferences
                          </span>
                          <span className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                            Manage optional analytics and tracking cookies
                          </span>
                        </div>
                        <span
                          className={`material-symbols-outlined text-[17px] select-none text-[var(--c-icon-secondary)] shrink-0 transition-transform duration-100 ${showCookiePanel ? "rotate-90" : ""}`}
                        >
                          chevron_right
                        </span>
                      </div>

                      {showCookiePanel && (
                        <div className="mt-3 flex flex-col gap-2.5 bg-[var(--c-surface-input)] p-3.5 rounded-[6px] border border-[var(--c-border-hairline)]">
                          {[
                            {
                              key: "essential",
                              label: "Essential Cookies",
                              desc: "Required for the app to function. Cannot be disabled.",
                              locked: true,
                            },
                            {
                              key: "analytics",
                              label: "Analytics Cookies",
                              desc: "Help us understand how you use KagZ.",
                              locked: false,
                            },
                            {
                              key: "marketing",
                              label: "Marketing Cookies",
                              desc: "Used to personalize suggestions.",
                              locked: false,
                            },
                          ].map((cookie) => (
                            <div
                              key={cookie.key}
                              className="flex items-center justify-between py-1"
                            >
                              <div className="flex flex-col mr-4">
                                <span className="text-[12.5px] font-medium text-[var(--c-text-primary)]">
                                  {cookie.label}
                                </span>
                                <span className="text-[11px] text-[var(--c-text-secondary)]">
                                  {cookie.desc}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCookieToggle(cookie.key)}
                                disabled={cookie.locked}
                                className={`w-8 h-[18px] max-md:w-11 max-md:h-[26px] rounded-full relative transition-colors duration-200 shrink-0 cursor-pointer ${cookie.locked ? "opacity-60 cursor-not-allowed" : ""} ${cookiePrefs[cookie.key] ? "bg-[var(--c-brand)]" : "bg-black/15 dark:bg-white/15"}`}
                              >
                                <div
                                  className={`absolute top-[2px] left-[2px] max-md:top-[3px] max-md:left-[3px] w-3.5 h-3.5 max-md:w-5 max-md:h-5 rounded-full bg-white transition-transform duration-200 ${cookiePrefs[cookie.key] ? "translate-x-3.5 max-md:translate-x-[18px]" : ""}`}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 py-2.5 max-md:py-3">
                      <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        database
                      </span>
                      <div className="flex flex-1 flex-col pr-4 max-md:pr-0">
                        <span className="text-[13.5px] max-md:text-[15px] font-medium text-[var(--c-text-primary)]">
                          Local storage cache
                        </span>
                        <span className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                          {storageUsage} used of local device quota
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowClearDataModal(true)}
                        className="text-[12px] text-red-500 hover:text-red-600 font-medium px-3 py-1 rounded-[6px] border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-100 shrink-0 cursor-pointer"
                      >
                        Clear local data
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Dedicated Tab: KagZ AI */}
            {settingsTab === "ai" && !settingsSearchQuery && (
              <div className="flex flex-col max-w-[680px] w-full mx-auto select-none">
                {/* 1. KagZ AI Brand Header */}
                <div className="hidden md:flex items-center justify-between pb-5 border-b border-[var(--c-border-hairline)]">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-[16px] bg-black/[0.03] dark:bg-white/[0.05] p-2 flex items-center justify-center shrink-0">
                      <img
                        src="/kagz.png"
                        alt="KagZ AI"
                        className="w-full h-full object-contain select-none"
                      />
                    </div>
                    <div>
                      <h2 className="text-[20px] font-semibold text-[var(--c-text-primary)] tracking-tight">
                        KagZ AI
                      </h2>
                      <p className="text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                        Persona tuning, custom instructions, and memory limits
                      </p>
                    </div>
                  </div>

                  {/* Top Right: Save Preferences Button */}
                  <button
                    type="button"
                    onClick={handleSaveAiPrefs}
                    disabled={
                      isSavingAiPrefs ||
                      !hasAiPrefsChanged ||
                      countWords(aiCustomInstructions) > 100
                    }
                    className="flex items-center justify-center gap-1.5 px-3.5 h-8 text-[12.5px] font-medium text-white bg-[var(--c-brand)] hover:bg-[var(--c-brand-hover)] disabled:opacity-35 disabled:cursor-not-allowed rounded-[6px] transition-colors duration-100 cursor-pointer shadow-sm shrink-0"
                  >
                    {isSavingAiPrefs ? (
                      <>
                        <span className="material-symbols-outlined text-[14px] animate-spin">
                          progress_activity
                        </span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[14px]">
                          check
                        </span>
                        <span>Save preferences</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 2. Personality & Tone */}
                <div className="flex items-center justify-between py-4 max-md:flex-col max-md:items-stretch md:border-b md:border-[var(--c-border-hairline)]">
                  <div className="flex items-start gap-3">
                    <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none mt-0.5">
                      person
                    </span>
                    <div>
                      <h3 className="text-[13.5px] max-md:text-[16px] font-medium text-[var(--c-text-primary)]">
                        Personality & Tone
                      </h3>
                      <p className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                        {AI_PERSONA_OPTIONS.find((opt) => opt.id === aiPersona)
                          ?.desc ||
                          "Set how conversational or direct the AI responds"}
                      </p>
                    </div>
                  </div>

                  <div className="relative shrink-0 max-md:mt-3 max-md:ml-0 max-md:w-full">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPersonaDropdown(!showPersonaDropdown);
                        setShowThemeDropdown(false);
                        setShowStartupDropdown(false);
                        setShowFontDropdown(false);
                      }}
                      className="flex items-center justify-between gap-2 min-w-[150px] h-8 px-2.5 text-[12.5px] rounded-[6px] border border-[var(--c-border)] bg-transparent hover:bg-[var(--ca-hover)] text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer select-none font-medium max-md:w-full max-md:h-11 max-md:min-w-0 max-md:rounded-[14px] max-md:border-0 max-md:bg-[var(--c-surface-input)] max-md:px-3.5 max-md:text-[14px]"
                    >
                      <span className="truncate">
                        {AI_PERSONA_OPTIONS.find((opt) => opt.id === aiPersona)
                          ?.label || "Professional"}
                      </span>
                      <span
                        className={`material-symbols-outlined text-[15px] max-md:text-[19px] text-[var(--c-icon-secondary)] select-none transition-transform duration-100 ${showPersonaDropdown ? "rotate-180" : ""}`}
                      >
                        expand_more
                      </span>
                    </button>

                    {showPersonaDropdown && (
                      <div
                        className="absolute right-0 top-full mt-1.5 w-64 py-1 bg-[var(--c-surface-elevated)] border border-[var(--c-border)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] z-50 text-[12.5px] max-md:left-0 max-md:right-0 max-md:mt-1.5 max-md:w-auto max-md:rounded-[16px] max-md:border-[var(--c-border-hairline)] max-md:p-1.5 max-md:text-[14px] max-md:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)] dark:max-md:shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {AI_PERSONA_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setAiPersona(opt.id);
                              setShowPersonaDropdown(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-[var(--c-text-secondary)] hover:bg-[var(--ca-hover)] hover:text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer text-left max-md:rounded-[10px] max-md:px-3 max-md:py-3"
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-[var(--c-text-primary)]">
                                  {opt.label}
                                </span>
                                <span className="text-[10px] text-[var(--c-text-tertiary)] bg-[var(--ca-hover)] px-1 py-0.2 rounded-[3px] max-md:rounded-[5px] max-md:px-1.5 max-md:py-0.5 max-md:text-[11px]">
                                  {opt.badge}
                                </span>
                              </div>
                              <span className="text-[11px] text-[var(--c-text-tertiary)] mt-0.5 leading-snug max-md:mt-1 max-md:text-[12px]">
                                {opt.desc}
                              </span>
                            </div>
                            {aiPersona === opt.id && (
                              <span className="material-symbols-outlined text-[15px] max-md:text-[18px] text-[var(--c-brand)] select-none shrink-0 ml-2">
                                check
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Custom Instructions */}
                <div className="py-4 flex flex-col md:border-b md:border-[var(--c-border-hairline)]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none">
                        description
                      </span>
                      <h3 className="text-[13.5px] max-md:text-[16px] font-medium text-[var(--c-text-primary)]">
                        Custom instructions
                      </h3>
                    </div>
                    <span
                      className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-[3px] max-md:bg-transparent max-md:px-0 max-md:text-[12.5px] max-md:font-sans max-md:text-[var(--c-text-secondary)] ${
                        countWords(aiCustomInstructions) > 100
                          ? "bg-red-500/10 text-red-500 font-semibold"
                          : countWords(aiCustomInstructions) > 85
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-[var(--ca-hover)] text-[var(--c-text-tertiary)]"
                      }`}
                    >
                      {countWords(aiCustomInstructions)} / 100<span className="max-md:hidden"> words</span>
                    </span>
                  </div>
                  <p className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mb-3 max-md:pl-8">
                    Tell KagZ AI how you want it to behave, format code, or
                    structure answers.
                  </p>

                  <div className="rounded-[8px] max-md:rounded-[12px] bg-[var(--c-surface-input)] border border-[var(--c-border)] p-3 max-md:p-3.5 flex flex-col focus-within:border-[var(--c-border-strong)] transition-colors duration-100 max-md:ml-8 max-md:border-[var(--c-border-hairline)]">
                    <textarea
                      value={aiCustomInstructions}
                      onChange={(e) => setAiCustomInstructions(e.target.value)}
                      placeholder="e.g. Always format summaries with bullet points. Call me Dave. Never use conversational filler."
                      rows={3}
                      className="w-full bg-transparent border-0 outline-none text-[13px] max-md:text-[16px] text-[var(--c-text-primary)] placeholder:text-[var(--c-text-tertiary)] leading-normal resize-none custom-scrollbar min-h-[62px]"
                    />
                    {countWords(aiCustomInstructions) > 100 && (
                      <p className="text-[11.5px] text-red-500 flex items-center gap-1 mt-2 shrink-0">
                        <span className="material-symbols-outlined text-[14px]">
                          warning
                        </span>
                        Instructions exceed 100 words limit. Excess words will
                        be trimmed.
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Session Continuity (Resume last vs Fresh start) */}
                <div className="flex items-center justify-between py-4 max-md:flex-col max-md:items-stretch md:border-b md:border-[var(--c-border-hairline)]">
                  <div className="flex items-start gap-3">
                    <span className="flex md:hidden material-symbols-outlined text-[20px] text-[var(--c-text-primary)] leading-none select-none mt-0.5">
                      sync
                    </span>
                    <div>
                      <h3 className="text-[13.5px] max-md:text-[16px] font-medium text-[var(--c-text-primary)]">
                        Session Continuity
                      </h3>
                      <p className="text-[12px] max-md:text-[12.5px] text-[var(--c-text-secondary)] mt-0.5">
                        {chatStartupMode === "resume"
                          ? "Resumes your previous conversation state on reload"
                          : "Starts with a clean empty chat on reload"}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex p-0.5 max-md:p-1 rounded-[6px] max-md:rounded-[14px] bg-[var(--c-surface-input)] border border-[var(--c-border-hairline)] shrink-0 max-md:mt-3 max-md:w-full max-md:border-0 max-md:bg-[var(--c-surface-well)] dark:max-md:bg-[var(--c-surface-elevated)]">
                    <button
                      type="button"
                      onClick={() => setChatStartupMode("resume")}
                      className={`px-3 py-1 rounded-[4px] max-md:rounded-[10px] text-[12px] max-md:text-[13.5px] font-medium transition-colors duration-100 cursor-pointer max-md:flex-1 max-md:h-9 ${
                        chatStartupMode === "resume"
                          ? "bg-[var(--c-surface)] text-[var(--c-text-primary)] shadow-sm max-md:bg-white dark:max-md:bg-[var(--c-surface-well)]"
                          : "text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)]"
                      }`}
                    >
                      Resume last
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatStartupMode("fresh")}
                      className={`px-3 py-1 rounded-[4px] max-md:rounded-[10px] text-[12px] max-md:text-[13.5px] font-medium transition-colors duration-100 cursor-pointer max-md:flex-1 max-md:h-9 ${
                        chatStartupMode === "fresh"
                          ? "bg-[var(--c-surface)] text-[var(--c-text-primary)] shadow-sm max-md:bg-white dark:max-md:bg-[var(--c-surface-well)]"
                          : "text-[var(--c-text-secondary)] hover:text-[var(--c-text-primary)]"
                      }`}
                    >
                      Start fresh
                    </button>
                  </div>
                </div>

                {/* 5. AI Memory Card */}
                {memoryStatus &&
                  (() => {
                    const usedWords = Number(memoryStatus.usedWords);
                    const maxWords = Number(memoryStatus.maxWords);
                    const hasWordData =
                      Number.isFinite(usedWords) &&
                      Number.isFinite(maxWords) &&
                      maxWords > 0;

                    const usagePercent =
                      memoryStatus.usagePercent != null
                        ? Number(memoryStatus.usagePercent)
                        : hasWordData
                          ? Math.round((usedWords / maxWords) * 100)
                          : memoryStatus.remainingPercent != null
                            ? 100 - Number(memoryStatus.remainingPercent)
                            : null;

                    if (!Number.isFinite(usagePercent)) return null;

                    const clampedUsage = Math.max(
                      0,
                      Math.min(100, usagePercent)
                    );
                    const barWidth = clampedUsage;
                    const isLow = clampedUsage >= 80;
                    const isCritical =
                      Boolean(memoryStatus.isFull) || clampedUsage >= 92;

                    const resetSubtitle = memoryStatus.resetDate
                      ? `Resets ${new Date(memoryStatus.resetDate).getDate()} ${new Date(memoryStatus.resetDate).toLocaleString("en-US", { month: "long" })}`
                      : null;

                    const factCount = Number(memoryStatus.factCount);

                    return (
                      <div className="mt-5 max-md:mt-6 mb-2 select-none">
                        {/* Mobile: memory summary card */}
                        <div className="md:hidden rounded-[20px] bg-[var(--c-surface-well)] dark:bg-[var(--c-surface-elevated)] px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex items-center justify-center w-9 h-9 rounded-[12px] bg-[var(--c-brand)]/10 text-[var(--c-brand)] shrink-0">
                                <span className="material-symbols-outlined text-[19px] leading-none select-none">
                                  layers
                                </span>
                              </span>
                              <div className="min-w-0">
                                <h3 className="text-[15.5px] font-medium text-[var(--c-text-primary)] leading-tight">
                                  Memory
                                </h3>
                                <p className="text-[12px] text-[var(--c-text-secondary)] mt-0.5 truncate">
                                  What KagZ remembers about you
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={`text-[18px] font-semibold leading-none tabular-nums ${
                                  isCritical
                                    ? "text-rose-500 dark:text-rose-400"
                                    : isLow
                                      ? "text-amber-500 dark:text-amber-400"
                                      : "text-[var(--c-text-primary)]"
                                }`}
                              >
                                {clampedUsage}%
                              </div>
                              <div className="text-[11px] text-[var(--c-text-tertiary)] mt-1">
                                used
                              </div>
                            </div>
                          </div>

                          <div
                            role="progressbar"
                            aria-label="Memory usage"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow={clampedUsage}
                            className="relative w-full h-2 mt-4 rounded-full bg-black/[0.08] dark:bg-white/[0.08] overflow-hidden"
                          >
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCritical
                                  ? "bg-gradient-to-r from-rose-500 to-rose-400"
                                  : isLow
                                    ? "bg-gradient-to-r from-amber-500 to-amber-400"
                                    : "bg-gradient-to-r from-[#6f8ff5] to-[#a5b4fc]"
                              }`}
                              style={{
                                width:
                                  clampedUsage > 0
                                    ? `${Math.max(clampedUsage, 2)}%`
                                    : "0%",
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between gap-3 mt-2.5 text-[12px]">
                            <span className="text-[var(--c-text-secondary)] tabular-nums">
                              {hasWordData
                                ? `${usedWords.toLocaleString()} / ${maxWords.toLocaleString()} words`
                                : `${clampedUsage}% used`}
                            </span>
                            <span className="text-[var(--c-text-tertiary)]">
                              {Number.isFinite(factCount) && factCount > 0
                                ? `${factCount} ${factCount === 1 ? "fact" : "facts"}`
                                : resetSubtitle || ""}
                            </span>
                          </div>

                          {resetSubtitle && factCount > 0 && (
                            <div className="mt-1 text-[11.5px] text-[var(--c-text-tertiary)]">
                              {resetSubtitle}
                            </div>
                          )}

                          {memoryStatus.isFull && (
                            <div className="mt-2 text-[12px] text-rose-500 dark:text-rose-400">
                              Memory is full — older details may be trimmed.
                            </div>
                          )}
                        </div>

                        {/* Desktop: pill with header + bar */}
                        <div className="hidden md:block rounded-[22px] bg-[#2f2f32] dark:bg-[#2f2f32] px-4 py-3.5">
                          <div className="flex items-baseline justify-between">
                            <h3 className="text-[14px] font-medium text-white">
                              Memory
                            </h3>
                            <span className="text-[12.5px] text-[#b4b4ba]">
                              {clampedUsage}% used
                            </span>
                          </div>

                          <div className="relative w-full h-[4px] mt-3 rounded-full bg-[#48484d] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#7c9cf8] transition-all duration-300"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>

                        {/* Reset subtitle, outside the pill (desktop) */}
                        {resetSubtitle && (
                          <div className="hidden md:block mt-1.5 px-1 text-[12px] text-[var(--c-text-secondary)]">
                            {resetSubtitle}
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* Real-time Search Results View */}
            {settingsSearchQuery && (
              <div className="flex flex-col max-w-[680px] w-full mx-auto">
                <h2 className="hidden md:block text-[24px] font-semibold text-[var(--c-text-primary)] tracking-tight leading-[1.3]">
                  Search Results
                </h2>
                <p className="hidden md:block text-[13px] text-[var(--c-text-secondary)] mt-1 mb-6">
                  Settings matching &ldquo;{settingsSearchQuery}&rdquo;
                </p>

                <div className="flex flex-col">
                  {matchesQuery("Theme", "theme") && (
                    <div className="flex items-center justify-between py-3 border-b border-[var(--c-border-hairline)]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] font-medium text-[var(--c-text-primary)]">
                          Theme
                        </span>
                        <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5">
                          System, Light, or Dark theme
                        </span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowThemeDropdown(!showThemeDropdown);
                          }}
                          className="flex items-center justify-between gap-1.5 min-w-[150px] h-8 px-2.5 text-[13px] rounded-[6px] border border-[var(--c-border)] bg-transparent hover:bg-[var(--ca-hover)] text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer max-md:h-10 max-md:rounded-[12px] max-md:border-0 max-md:bg-[var(--c-surface-input)] max-md:px-3 max-md:text-[13.5px]"
                        >
                          <span>
                            {theme === "system"
                              ? "Use system setting"
                              : theme === "light"
                                ? "Light"
                                : "Dark"}
                          </span>
                          <span className="material-symbols-outlined text-[15px] text-[var(--c-icon-secondary)] select-none">
                            expand_more
                          </span>
                        </button>
                        {showThemeDropdown && (
                          <div
                            className="absolute right-0 top-full mt-1 w-48 py-1 bg-[var(--c-surface-elevated)] border border-[var(--c-border)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] z-50 text-[12.5px] max-md:mt-1.5 max-md:rounded-[14px] max-md:border-[var(--c-border-hairline)] max-md:p-1.5 max-md:text-[13.5px] max-md:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { id: "system", label: "Use system setting" },
                              { id: "light", label: "Light" },
                              { id: "dark", label: "Dark" },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setTheme(opt.id);
                                  setShowThemeDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-[var(--c-text-secondary)] hover:bg-[var(--ca-hover)] hover:text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer text-left max-md:h-10 max-md:rounded-[8px] max-md:px-3"
                              >
                                <span>{opt.label}</span>
                                {theme === opt.id && (
                                  <span className="material-symbols-outlined text-[15px] text-[var(--c-brand)] select-none">
                                    check
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {matchesQuery("High contrast", "contrast") && (
                    <div className="flex items-center justify-between py-3 border-b border-[var(--c-border-hairline)]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13px] font-medium text-[var(--c-text-primary)] leading-snug">
                          High contrast
                        </span>
                        <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5">
                          Increase interface contrast and borders for improved
                          visibility
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={extraContrast}
                        onClick={() => setExtraContrast(!extraContrast)}
                        className={`w-9 h-5 max-md:w-11 max-md:h-[26px] max-md:p-[3px] rounded-full p-0.5 relative transition-colors duration-200 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-brand)] ${
                          extraContrast
                            ? "bg-[var(--c-brand)]"
                            : "bg-black/15 dark:bg-white/15"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 max-md:w-5 max-md:h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${extraContrast ? "translate-x-4 max-md:translate-x-[18px]" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  )}

                  {matchesQuery("Startup", "Resume last chat reload") && (
                    <div className="flex items-center justify-between py-3 border-b border-[var(--c-border-hairline)]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] font-medium text-[var(--c-text-primary)]">
                          On startup & reload
                        </span>
                        <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5">
                          Resume last chat or start fresh on reload
                        </span>
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStartupDropdown(!showStartupDropdown);
                          }}
                          className="flex items-center justify-between gap-1.5 min-w-[150px] h-8 px-2.5 text-[13px] rounded-[6px] border border-[var(--c-border)] bg-transparent hover:bg-[var(--ca-hover)] text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer max-md:h-10 max-md:rounded-[12px] max-md:border-0 max-md:bg-[var(--c-surface-input)] max-md:px-3 max-md:text-[13.5px]"
                        >
                          <span>
                            {chatStartupMode === "resume"
                              ? "Resume last chat"
                              : "Fresh new chat"}
                          </span>
                          <span className="material-symbols-outlined text-[15px] text-[var(--c-icon-secondary)] select-none">
                            expand_more
                          </span>
                        </button>
                        {showStartupDropdown && (
                          <div
                            className="absolute right-0 top-full mt-1 w-48 py-1 bg-[var(--c-surface-elevated)] border border-[var(--c-border)] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] z-50 text-[12.5px] max-md:mt-1.5 max-md:rounded-[14px] max-md:border-[var(--c-border-hairline)] max-md:p-1.5 max-md:text-[13.5px] max-md:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {[
                              { id: "resume", label: "Resume last chat" },
                              { id: "fresh", label: "Fresh new chat" },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  setChatStartupMode(opt.id);
                                  setShowStartupDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-1.5 text-[var(--c-text-secondary)] hover:bg-[var(--ca-hover)] hover:text-[var(--c-text-primary)] transition-colors duration-100 cursor-pointer text-left max-md:h-10 max-md:rounded-[8px] max-md:px-3"
                              >
                                <span>{opt.label}</span>
                                {chatStartupMode === opt.id && (
                                  <span className="material-symbols-outlined text-[15px] text-[var(--c-brand)] select-none">
                                    check
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {matchesQuery("Reasoning", "Thinking mode") && (
                    <div className="flex items-center justify-between py-3 border-b border-[var(--c-border-hairline)]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] font-medium text-[var(--c-text-primary)]">
                          Reasoning process
                        </span>
                        <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5">
                          Thinking orb animation
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isThinking}
                        onClick={() => setIsThinking(!isThinking)}
                        className={`w-8 h-[18px] rounded-full relative transition-colors duration-200 shrink-0 cursor-pointer ${isThinking ? "bg-[var(--c-brand)]" : "bg-black/15 dark:bg-white/15"}`}
                      >
                        <div
                          className={`absolute top-[2px] left-[2px] w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${isThinking ? "translate-x-3.5" : ""}`}
                        />
                      </button>
                    </div>
                  )}

                  {matchesQuery("Font", "Typography text size") && (
                    <div className="flex items-center justify-between py-3 border-b border-[var(--c-border-hairline)]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] font-medium text-[var(--c-text-primary)]">
                          Font size
                        </span>
                        <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5">
                          Interface text size ({fontSize}px)
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[var(--c-text-secondary)] bg-transparent rounded-[6px] border border-[var(--c-border)] px-1 h-8 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleFontSizeChange(-1)}
                          disabled={fontSize <= 12}
                          className="w-6 h-6 flex items-center justify-center hover:bg-[var(--ca-hover)] rounded-[4px] cursor-pointer text-sm transition-colors duration-100"
                        >
                          -
                        </button>
                        <span className="text-[12px] w-7 text-center font-mono font-medium text-[var(--c-text-primary)]">
                          {fontSize}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleFontSizeChange(1)}
                          disabled={fontSize >= 24}
                          className="w-6 h-6 flex items-center justify-center hover:bg-[var(--ca-hover)] rounded-[4px] cursor-pointer text-sm transition-colors duration-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  {matchesQuery("Spell", "Spell check") && (
                    <div className="flex items-center justify-between py-3 border-b border-[var(--c-border-hairline)]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] font-medium text-[var(--c-text-primary)]">
                          Spell check
                        </span>
                        <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5">
                          Browser spell checker
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={spellCheck}
                        onClick={() => setSpellCheck(!spellCheck)}
                        className={`w-8 h-[18px] max-md:w-11 max-md:h-[26px] rounded-full relative transition-colors duration-200 shrink-0 cursor-pointer ${spellCheck ? "bg-[var(--c-brand)]" : "bg-black/15 dark:bg-white/15"}`}
                      >
                        <div
                          className={`absolute top-[2px] left-[2px] max-md:top-[3px] max-md:left-[3px] w-3.5 h-3.5 max-md:w-5 max-md:h-5 rounded-full bg-white transition-transform duration-200 ${spellCheck ? "translate-x-3.5 max-md:translate-x-[18px]" : ""}`}
                        />
                      </button>
                    </div>
                  )}

                  {matchesQuery("Storage", "Local data clear") && (
                    <div className="flex items-center justify-between py-3 border-b border-[var(--c-border-hairline)]">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] font-medium text-[var(--c-text-primary)]">
                          Local storage
                        </span>
                        <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5">
                          {storageUsage} used
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowClearDataModal(true)}
                        className="text-[12px] text-red-500 hover:text-red-600 font-medium px-3 py-1 rounded-[6px] border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors duration-100 shrink-0 cursor-pointer"
                      >
                        Clear local data
                      </button>
                    </div>
                  )}

                  {matchesQuery(
                    "KagZ AI",
                    "personality tone instructions friend prompt memory",
                  ) && (
                    <div className="flex items-center justify-between py-3">
                      <div className="flex flex-col pr-4">
                        <span className="text-[13.5px] font-medium text-[var(--c-text-primary)]">
                          KagZ AI Settings
                        </span>
                        <span className="text-[12px] text-[var(--c-text-secondary)] mt-0.5">
                          Customize AI personality (
                          {aiPersona.replace("_", " ")}), instructions, and
                          memory limits
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsSearchQuery("");
                          setSettingsTab("ai");
                        }}
                        className="px-3 h-7 flex items-center text-[12px] font-medium text-[var(--c-brand)] bg-[var(--c-brand-subtle)] hover:bg-[var(--c-brand)]/20 rounded-[6px] transition-colors duration-100 cursor-pointer"
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
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <ActionModal
            isOpen={showLogoutConfirm}
            onClose={() => setShowLogoutConfirm(false)}
            title="Log out?"
            type="confirm"
            description="You'll need to sign in again to access your workspaces, pages, and chats."
            onConfirm={logout}
            confirmText="Log out"
            cancelText="Cancel"
            isDanger
          />
        </div>
      </div>,
      document.body,
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
          disabled={isCreatingWorkspace}
          onChange={(e) => setNewWorkspaceName(e.target.value)}
          className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-[#2A2A2A] transition-colors mb-4 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              handleCreateWorkspace(e);
            }
          }}
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowNewWorkspaceModal(false)}
            disabled={isCreatingWorkspace}
            className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateWorkspace}
            disabled={!newWorkspaceName.trim() || isCreatingWorkspace}
            className="px-3 py-1.5 text-sm bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 min-w-[75px] cursor-pointer"
          >
            {isCreatingWorkspace ? (
              <>
                <Loading03Icon className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Creating...</span>
              </>
            ) : (
              "Create"
            )}
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

  const renderTree = (
    nodes,
    level = 0,
    expansionState = expandedFolders,
    onToggle = toggleFolder,
  ) => {
    return nodes.map((node) => {
      // Clear visual indentation hierarchy per level
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
                `group/row relative flex items-center w-full h-[30px] pr-8 text-[15px] leading-[18px] rounded-[6px] mb-[1px] transition-all duration-150 ${
                  isActive
                    ? "bg-black/[0.031] dark:bg-white/[0.055] text-[#181817] dark:text-[#f7f6f4] font-medium"
                    : "text-[#383734] dark:text-[#c7c5c0] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/[0.031] dark:hover:bg-white/[0.055]"
                }`
              }
              style={{ paddingLeft }}
            >
              <div className="flex items-center gap-2 overflow-hidden w-full">
                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-500 dark:text-[#9e9b95]">
                  <span className="material-symbols-outlined text-[15px] leading-none select-none">
                    assignment
                  </span>
                </div>
                <span className="truncate leading-[18px]">{node.name}</span>
              </div>
            </NavLink>
            <button
              onClick={(e) => handleMenuClick(e, node.id)}
              className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 ${activeMenu === node.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
              aria-label={`More options for ${node.name}`}
            >
              <span className="material-symbols-outlined text-[14px] leading-none select-none">
                more_horiz
              </span>
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
                className="group flex items-center justify-between w-full h-[30px] pr-1.5 text-[15px] leading-[18px] font-medium text-[#383734] dark:text-[#c7c5c0] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] rounded-[6px] mb-[1px] transition-all duration-150 cursor-pointer"
                style={{ paddingLeft }}
                onClick={() => onToggle(node.id)}
              >
                <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                  <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-500 dark:text-[#9e9b95]">
                    {node.type === "workspace" ? (
                      <HugeiconsIcon
                        icon={LibrariesIcon}
                        size={15}
                        className="shrink-0 text-current select-none"
                      />
                    ) : isExpanded ? (
                      <span className="material-symbols-outlined text-[15px] leading-none text-gray-600 dark:text-gray-300 select-none">
                        folder_open
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-[15px] leading-none text-gray-500 dark:text-gray-400 select-none">
                        folder
                      </span>
                    )}
                  </div>
                  <span className="truncate select-none font-normal text-gray-900 dark:text-[#e4e2dd] leading-[18px]">
                    {node.name}
                  </span>
                  <span
                    className={`material-symbols-outlined text-[13px] leading-none select-none transition-transform duration-200 text-gray-500 opacity-0 group-hover:opacity-70 ${isExpanded ? "rotate-90 !opacity-70" : ""} shrink-0`}
                  >
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
                    <span className="material-symbols-outlined text-[14px] leading-none select-none">
                      add_2
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleMenuClick(e, node.id)}
                    className={`w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 ${activeMenu === node.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                    title="More Options"
                  >
                    <span className="material-symbols-outlined text-[14px] leading-none select-none">
                      more_horiz
                    </span>
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
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-[99] md:hidden transition-opacity duration-200"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div
        className={`h-screen flex flex-col border-r border-black/[0.06] dark:border-white/[0.07] font-sans shrink-0 transition-colors bg-[#f9f8f7] dark:bg-[#202020] ${
          isMobileSidebarOpen
            ? "fixed inset-y-0 left-0 z-[100] w-[84vw] max-w-[310px] shadow-2xl md:relative md:inset-auto md:z-40 md:shadow-none"
            : "hidden md:flex relative z-40"
        }`}
        style={{ width: isMobileSidebarOpen && (typeof window !== 'undefined' && window.innerWidth < 768) ? undefined : sidebarWidth }}
      >
        {/* Resizer Handle (Desktop only) */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-[-4px] w-[8px] h-full cursor-col-resize z-50 hover:bg-gray-300/50 transition-colors hidden md:block"
        />
        {/* Top Header, Search Bar & Quick Actions */}
        <div className="px-3 pt-3 flex flex-col gap-2.5 shrink-0">
          {/* Top Controls Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (isMobileSidebarOpen) {
                  setIsMobileSidebarOpen(false);
                } else {
                  setIsCollapsed(true);
                }
              }}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <HugeiconsIcon icon={LayoutAlignLeftIcon} size={18} strokeWidth={1.8} className="shrink-0 select-none" />
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[14.5px] font-medium text-gray-950 dark:text-gray-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-[14.5px] font-medium text-gray-950 dark:text-gray-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer text-left"
                >
                  <HugeiconsIcon
                    icon={BubbleChatNotificationIcon}
                    size={17}
                    strokeWidth={1.8}
                    className="text-gray-500 dark:text-gray-400 shrink-0 select-none"
                  />
                  <span>Chat</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search or Ask Bar */}
        <button
          onClick={() => setIsSearchActive(true)}
          className="w-full h-8 flex items-center justify-between rounded-[8px] border border-[var(--c-border)] bg-transparent hover:bg-[var(--ca-hover)] transition-[background,border] duration-20 ease-in text-left group cursor-pointer"
          style={{ paddingLeft: "8px", paddingRight: "6px" }}
        >
          <span className="text-[15px] leading-[18px] text-[#555450] dark:text-[#aba8a2] group-hover:text-[#181817] dark:group-hover:text-[#f7f6f4] font-normal select-none">
            Search or ask
          </span>
          <kbd className="text-[12px] font-sans font-medium text-[#555450] dark:text-[#aba8a2] bg-transparent border border-[var(--c-border)] rounded px-1.5 py-0.5 leading-none select-none">
            ⌘K
          </kbd>
        </button>

        {/* Animated Quick Actions Bar (3 pills: Home, Chat, Tasks) */}
        <div className="flex items-center justify-start gap-1.5 pb-1">
          {topNavItems.map((item) => {
            if (item.id === "chat") {
              const isChatActive =
                isRightChatOpen || location.pathname === "/dashboard/chat";
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
                    if (isMobileScreen) {
                      if (setIsMobileSidebarOpen) setIsMobileSidebarOpen(false);
                      navigate('/dashboard/chat');
                    } else {
                      if (!isRightChatOpen && chatStartupMode === "fresh") {
                        clearChat();
                      }
                      setIsRightChatOpen((prev) => !prev);
                    }
                  }}
                  className="block cursor-pointer outline-none"
                >
                  <div
                    className={`flex items-center h-[29px] rounded-full overflow-hidden transition-[background-color,color,box-shadow] duration-200 ease-out ${
                      isChatActive
                        ? "bg-black/[0.07] dark:bg-white/[0.12] text-[#181817] dark:text-[#f7f6f4] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                        : "bg-black/[0.03] dark:bg-white/[0.04] text-[#605d57] hover:text-[#181817] dark:text-[#a09d96] dark:hover:text-[#f7f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className="w-[29px] h-[29px] shrink-0 flex items-center justify-center">
                      <item.icon />
                    </div>
                    <span
                      className={`text-[13.5px] font-medium whitespace-nowrap overflow-hidden leading-none select-none transition-all duration-200 ease-out ${
                        isChatActive
                          ? "max-w-[74px] opacity-100 pr-2.5 pl-0.5"
                          : "max-w-0 opacity-0 pr-0 pl-0 pointer-events-none"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            }

            return (
              <NavLink
                key={item.id}
                to={item.path}
                className="block outline-none"
              >
                {({ isActive: routerIsActive }) => {
                  const isActive =
                    item.id === "home" ? isHomeActive() : routerIsActive;
                  const active = isActive && !isSearchActive;
                  return (
                    <div
                      className={`flex items-center h-[29px] rounded-full overflow-hidden transition-[background-color,color,box-shadow] duration-200 ease-out ${
                        active
                          ? "bg-black/[0.07] dark:bg-white/[0.12] text-[#181817] dark:text-[#f7f6f4] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                          : "bg-black/[0.03] dark:bg-white/[0.04] text-[#605d57] hover:text-[#181817] dark:text-[#a09d96] dark:hover:text-[#f7f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.07]"
                      }`}
                    >
                      <div className="w-[29px] h-[29px] shrink-0 flex items-center justify-center">
                        <item.icon />
                      </div>
                      <span
                        className={`text-[13.5px] font-medium whitespace-nowrap overflow-hidden leading-none select-none transition-all duration-200 ease-out ${
                          active
                            ? "max-w-[74px] opacity-100 pr-2.5 pl-0.5"
                            : "max-w-0 opacity-0 pr-0 pl-0 pointer-events-none"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  );
                }}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Tree Navigation */}
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-2 py-2 min-h-0">
        {/* Recent Section */}
        <div className="flex flex-col mb-2 shrink-0">
          <div className="group flex items-center justify-between w-full pt-1.5 px-1.5 pb-0.5 shrink-0">
            <div
              onClick={() => toggleFolder("recent-section")}
              className="flex items-center gap-1 select-none cursor-pointer px-1 py-0.5 rounded text-[#787672] dark:text-[#888580] hover:text-[#181817] dark:hover:text-[#f7f6f4] transition-colors"
            >
              <span className="text-[12px] leading-[16px] font-normal select-none">
                Recents
              </span>
              <span
                className={`material-symbols-outlined text-[11px] leading-none select-none shrink-0 transition-transform duration-200 text-gray-400 opacity-0 group-hover:opacity-60 ${debouncedSearchQuery || expandedFolders["recent-section"] ? "rotate-90" : ""}`}
              >
                chevron_right
              </span>
            </div>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${debouncedSearchQuery || expandedFolders["recent-section"] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          >
            <div className="overflow-hidden w-full flex flex-col pt-0.5 pb-0.5">
              <button
                onClick={handleCreateRootPage}
                className="group flex items-center gap-2 w-full h-[30px] px-2 mb-[1px] text-[15px] leading-[18px] font-normal text-[#383734] dark:text-[#c7c5c0] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] rounded-[6px] transition-all duration-150 bg-transparent border-none outline-none cursor-pointer shrink-0"
              >
                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-[15px] leading-none select-none">
                    add_2
                  </span>
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
                        `group/row relative flex items-center w-full h-[30px] px-2 pr-8 text-[15px] leading-[18px] rounded-[6px] mb-[1px] transition-all duration-150 ${
                          isActive
                            ? "bg-black/[0.031] dark:bg-white/[0.055] text-[#181817] dark:text-[#f7f6f4] font-medium"
                            : "text-[#383734] dark:text-[#c7c5c0] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/[0.031] dark:hover:bg-white/[0.055]"
                        }`
                      }
                    >
                      <div className="flex items-center gap-2 overflow-hidden w-full">
                        <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-500 dark:text-[#9e9b95]">
                          <span className="material-symbols-outlined text-[15px] leading-none text-current select-none">
                            assignment
                          </span>
                        </div>
                        <span className="truncate leading-[18px]">
                          {recent.name}
                        </span>
                      </div>
                    </NavLink>
                    <button
                      onClick={(e) => handleMenuClick(e, recent.id)}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 ${activeMenu === recent.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                      aria-label={`More options for ${recent.name}`}
                    >
                      <span className="material-symbols-outlined text-[14px] leading-none select-none">
                        more_horiz
                      </span>
                    </button>
                  </div>
                ))
              )}
              {sectionStates["recent-section"]?.isSuccess &&
                mockRecent.length === 0 && (
                  <div className="px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400">
                    No recent pages
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="flex flex-col mb-2 shrink-0">
          <div className="group flex items-center justify-between w-full pt-1.5 px-1.5 pb-0.5 shrink-0">
            <div
              className="flex items-center gap-1 select-none cursor-pointer px-1 py-0.5 rounded text-[#787672] dark:text-[#888580] hover:text-[#181817] dark:hover:text-[#f7f6f4] transition-colors"
              onClick={() => toggleFolder("workspaces-section")}
            >
              <span className="text-[12px] leading-[16px] font-normal select-none">
                Workspaces
              </span>
              <span
                className={`material-symbols-outlined text-[11px] leading-none select-none shrink-0 transition-transform duration-200 text-gray-400 opacity-0 group-hover:opacity-60 ${debouncedSearchQuery || expandedFolders["workspaces-section"] ? "rotate-90" : ""}`}
              >
                chevron_right
              </span>
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
              <span className="material-symbols-outlined text-[14px] leading-none select-none">
                add_2
              </span>
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
              {sectionStates["workspaces-section"]?.isSuccess &&
                mockTree.length === 0 && (
                  <div className="px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400">
                    No workspaces yet
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Favorites Section */}
        <div className="flex flex-col mb-2 shrink-0">
          <div className="group flex items-center justify-between w-full pt-1.5 px-1.5 pb-0.5 shrink-0">
            <div
              onClick={() => toggleFolder("favorites-section")}
              className="flex items-center gap-1 select-none cursor-pointer px-1 py-0.5 rounded text-[#787672] dark:text-[#888580] hover:text-[#181817] dark:hover:text-[#f7f6f4] transition-colors"
            >
              <span className="text-[12px] leading-[16px] font-normal select-none">
                Favorites
              </span>
              <span
                className={`material-symbols-outlined text-[11px] leading-none select-none shrink-0 transition-transform duration-200 text-gray-400 opacity-0 group-hover:opacity-60 ${debouncedSearchQuery || expandedFolders["favorites-section"] ? "rotate-90" : ""}`}
              >
                chevron_right
              </span>
            </div>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${debouncedSearchQuery || expandedFolders["favorites-section"] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          >
            <div className="overflow-hidden w-full flex flex-col pt-0.5 pb-0.5">
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
              {sectionStates["favorites-section"]?.isSuccess &&
                mockFavorites.length === 0 && (
                  <div className="px-3 py-2 text-[13px] text-gray-500 dark:text-gray-400">
                    No favorites yet
                  </div>
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
          <div className="group flex items-center justify-between w-full pt-1.5 px-1.5 pb-0.5 shrink-0">
            <div
              onClick={() => toggleFolder("chat-history-section")}
              className="flex items-center gap-1 select-none cursor-pointer px-1 py-0.5 rounded text-[#787672] dark:text-[#888580] hover:text-[#181817] dark:hover:text-[#f7f6f4] transition-colors"
            >
              <span className="text-[12px] leading-[16px] font-normal select-none">
                Chat History
              </span>
              <span
                className={`material-symbols-outlined text-[11px] leading-none select-none shrink-0 transition-transform duration-200 text-gray-400 opacity-0 group-hover:opacity-60 ${debouncedSearchQuery || expandedFolders["chat-history-section"] ? "rotate-90" : ""}`}
              >
                chevron_right
              </span>
            </div>
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100"
              title="New Chat"
              onClick={(e) => {
                e.stopPropagation();
                handleStartNewChat();
              }}
            >
              <HugeiconsIcon
                icon={BubbleChatNotificationIcon}
                size={14}
                className="select-none leading-none"
              />
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
                className="group flex items-center gap-2 w-full h-[30px] px-2 mb-[1px] text-[15px] leading-[18px] font-normal text-[#383734] dark:text-[#c7c5c0] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/[0.031] dark:hover:bg-white/[0.055] rounded-[6px] transition-all duration-150 bg-transparent border-none outline-none cursor-pointer shrink-0"
              >
                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                  <HugeiconsIcon
                    icon={BubbleChatNotificationIcon}
                    size={15}
                    className="select-none leading-none"
                  />
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
                              className={`relative flex items-center w-full h-[30px] px-2 pr-8 text-[15px] leading-[18px] rounded-[6px] mb-[1px] transition-all duration-150 cursor-pointer ${
                                isChatActive
                                  ? "bg-black/[0.031] dark:bg-white/[0.055] text-[#181817] dark:text-[#f7f6f4] font-medium"
                                  : "text-[#383734] dark:text-[#c7c5c0] hover:text-[#181817] dark:hover:text-[#f7f6f4] hover:bg-black/[0.031] dark:hover:bg-white/[0.055]"
                              }`}
                              onClick={() => {
                                loadSession(session.sessionId);
                                navigate("/dashboard/chat");
                              }}
                            >
                              <div className="flex items-center gap-2 overflow-hidden w-full">
                                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0 text-gray-500 dark:text-[#9e9b95]">
                                  <HugeiconsIcon
                                    icon={BubbleChatNotificationIcon}
                                    size={15}
                                    strokeWidth={1.8}
                                    className="leading-none text-current select-none"
                                  />
                                </div>
                                <span className="truncate leading-[18px]">
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
                              <span className="material-symbols-outlined text-[14px] leading-none select-none">
                                more_horiz
                              </span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  ))
                )}
                {chatSessions.length === 0 && (
                  <div className="px-8 py-2 text-[13px] text-gray-500 dark:text-gray-400">
                    No recent chats
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="h-11 px-2.5 flex items-center border-t border-black/[0.06] dark:border-white/[0.07] justify-between shrink-0">
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowSettingsCard(true);
          }}
          className="flex items-center gap-2 overflow-hidden cursor-pointer hover:bg-black/[0.031] dark:hover:bg-white/[0.055] py-1 px-1.5 rounded-[6px] transition-colors min-w-0"
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
          <span className="text-[14.5px] font-medium text-gray-950 dark:text-[#e8e6e1] truncate max-w-[140px]">
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
            <span className="material-symbols-outlined text-[18px] leading-none select-none">
              chevron_left
            </span>
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
    </>
  );
};

export default Sidebar;
