import { useState, useEffect, useRef, useContext } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChatContext } from "../../context/ChatContextDefinition";
import { EditorContext } from "../../context/EditorContext";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "next-themes";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Menu,
  Check,
  MoreHorizontal,
  Edit2,
  Star,
  X
} from "lucide-react";
import {
  FolderFavouriteIcon,
  FolderClockIcon,
  ArtboardToolIcon,
  Folder01Icon,
  Folder02Icon,
  NotebookIcon,
  Delete01Icon,
  ChatFeedback01Icon,
  Search01Icon,
  Quiz04Icon,
  Home01Icon,
  Add01Icon,
  ArrowRight01Icon,
  File02Icon,
  TextIcon,
  AccountSetting03Icon,
  Logout01Icon,
  OptionIcon
} from "hugeicons-react";
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

const SidebarSkeletonItem = () => (
  <div className="flex items-center w-full py-1.5 px-3 mb-0.5">
    <div className="w-[18px] h-[18px] rounded bg-gray-200/60 animate-pulse mr-2 shrink-0" />
    <div className="h-[14px] bg-gray-200/60 rounded animate-pulse w-3/5" />
  </div>
);

const Sidebar = () => {
  const { user, logout } = useAuth();
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
  } = useContext(ChatContext);
  const {
    isPageOpen,
    workspaceTree,
    setWorkspaceTree,
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
    "favorites-section": true,
    "workspaces-section": true,
    "recent-section": true,
    "chat-history-section": false,
  });
  const [expandedFavoriteFolders, setExpandedFavoriteFolders] = useState({});

  const searchInputRef = useRef(null);
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Option + S (macOS) or Alt + S (Windows) to toggle search
      if (e.altKey && e.code === 'KeyS') {
        e.preventDefault();
        setIsSearchActive(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
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
  const [settingsTab, setSettingsTab] = useState("account");
  const [extraContrast, setExtraContrast] = useState(() => localStorage.getItem("noema-high-contrast") === "true");
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem("noema-font-size") || "16", 10));
  const [cookiePrefs, setCookiePrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("noema-cookie-prefs") || '{"essential":true,"analytics":false,"marketing":false}'); }
    catch { return { essential: true, analytics: false, marketing: false }; }
  });
  const [showCookiePanel, setShowCookiePanel] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem("noema-font-family") || "sans");
  const [spellCheck, setSpellCheck] = useState(() => localStorage.getItem("noema-spellcheck") === "true");
  const [storageUsage, setStorageUsage] = useState("0 B");

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
    localStorage.setItem("noema-font-size", String(fontSize));
    window.dispatchEvent(new Event("noema-font-size-changed"));
  }, [fontSize]);

  useEffect(() => {
    const handleFontSizeChange = () => {
      const savedSize = Number(localStorage.getItem("noema-font-size"));
      if (Number.isFinite(savedSize)) setFontSize(Math.min(24, Math.max(12, savedSize)));
    };
    window.addEventListener("noema-font-size-changed", handleFontSizeChange);
    return () => window.removeEventListener("noema-font-size-changed", handleFontSizeChange);
  }, []);

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
      setShowThemeDropdown(false);
      setShowFontDropdown(false);
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
    { id: "home", label: "Home", path: "/dashboard", icon: Home01Icon },
    {
      id: "chat",
      label: "Chat",
      path: "/dashboard/chat",
      icon: ChatFeedback01Icon,
    },
    {
      id: "tasks",
      label: "Tasks",
      path: "/dashboard/tasks",
      icon: Quiz04Icon,
    },
    {
      id: "search",
      label: "Search",
      path: "/dashboard/search",
      icon: Search01Icon,
    },
  ];

  const isHomeActive = () => {
    const path = location.pathname;
    return (
      path === "/dashboard" ||
      (!path.startsWith("/dashboard/chat") &&
        !path.startsWith("/dashboard/tasks") &&
        !path.startsWith("/dashboard/search") &&
        path !== "/dashboard/settings")
    );
  };

  // Real API-backed tree state
  const [mockTree, setMockTree] = useState([]);
  const [mockRecent, setMockRecent] = useState([]);
  const [mockFavorites, setMockFavorites] = useState([]);
  const [chatSessions, setChatSessions] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(true);

  // Build the sidebar tree from backend
  useEffect(() => {
    const loadChatSessions = async () => {
      try {
        const res = await chatAPI.getSessions();
        if (res.data.success) {
          setChatSessions(res.data.sessions || []);
        }
      } catch (err) {
        console.error("Failed to fetch chat sessions:", err);
      } finally {
        setChatLoading(false);
      }
    };

    const loadTree = async () => {
      try {
        const wsRes = await workspacesAPI.getAll();
        const workspaces = wsRes.data.workspaces || [];

        const treeNodes = await Promise.all(
          workspaces.map(async (ws) => {
            const loadFolder = async (folder) => {
              const [childFolderRes, pageRes] = await Promise.all([
                foldersAPI.getByWorkspace(ws._id, folder._id),
                pagesAPI.getByWorkspace(ws._id, folder._id),
              ]);
              const childFolders = await Promise.all(
                (childFolderRes.data.folders || []).map(loadFolder),
              );
              return {
                id: folder._id,
                type: "folder",
                name: folder.name,
                isFavorite: folder.isFavorite,
                workspaceId: ws._id,
                children: [
                  ...childFolders,
                  ...(pageRes.data.pages || []).map((p) => ({
                    id: p._id,
                    type: "page",
                    name: p.title,
                    path: `/dashboard/page/${p._id}`,
                    isFavorite: p.isFavorite,
                    updatedAt: p.updatedAt,
                    isGlobal: false,
                    workspaceId: ws._id,
                    folderId: folder._id,
                  })),
                ],
              };
            };

            const folderRes = await foldersAPI.getByWorkspace(ws._id, null);
            const folders = folderRes.data.folders || [];

            // Fetch root pages (not inside any folder)
            const pageRes = await pagesAPI.getByWorkspace(ws._id, null);
            const rootPages = pageRes.data.pages || [];

            const folderNodes = await Promise.all(folders.map(loadFolder));
            const pageNodes = rootPages.map((p) => ({
              id: p._id,
              type: "page",
              name: p.title,
              path: `/dashboard/page/${p._id}`,
              isFavorite: p.isFavorite,
              updatedAt: p.updatedAt,
              isGlobal: true,
              workspaceId: ws._id,
              folderId: null,
            }));

            return {
              id: ws._id,
              type: "workspace",
              name: ws.name,
              isFavorite: ws.isFavorite,
              path: `/dashboard/workspace/${ws._id}`,
              children: [...folderNodes, ...pageNodes],
            };
          }),
        );

        setMockTree(treeNodes);
        setWorkspaceTree(treeNodes); // Sync into EditorContext

        // Fetch ALL pages for the user to reliably populate Recent and Favorites (including orphans)
        const allPagesRes = await pagesAPI.getAll();
        const globalAllPages = allPagesRes.data.pages || [];

        // Collect favorites (workspaces + folders + pages marked isFavorite)
        const favs = [];
        const collectFavs = (nodes) => {
          nodes.forEach((node) => {
            if (node.isFavorite) {
              if (node.type === "workspace") {
                favs.push({ ...node, path: `/dashboard/workspace/${node.id}` });
                return;
              } else if (node.type === "folder") {
                favs.push({ ...node, path: `/dashboard/workspace/${node.workspaceId}` });
                return;
              } else {
                favs.push(node);
              }
            }
            if (node.children) {
              collectFavs(node.children);
            }
          });
        };
        collectFavs(treeNodes);
        
        setMockFavorites(favs);
        setExpandedFavoriteFolders(
          favs.reduce((expanded, node) => {
            if (node.type === "workspace" || node.type === "folder") {
              expanded[node.id] = true;
            }
            return expanded;
          }, {}),
        );

        // Recent = all pages sorted by updatedAt descending (newest first)
        const formattedAllPages = globalAllPages.map(p => ({
          id: p._id,
          type: "page",
          name: p.title,
          path: `/dashboard/page/${p._id}`,
          isFavorite: p.isFavorite,
          updatedAt: p.updatedAt,
          isGlobal: !p.folderId
        }));
        
        formattedAllPages.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        setMockRecent(formattedAllPages.slice(0, 6));

        // Only expand the main sections by default, keep individual workspaces/folders collapsed
        const expanded = {
          "favorites-section": true,
          "workspaces-section": true,
          "recent-section": true,
        };
        setExpandedFolders(expanded);
      } catch (err) {
        console.error("Sidebar tree load failed:", err);
      } finally {
        setTreeLoading(false);
      }
    };
    loadChatSessions();
    loadTree();
  }, [refreshSidebarTrigger]); // Re-run when refreshSidebarTrigger changes

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
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
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
      <div className="h-screen w-16 bg-[#f7f6f3] dark:bg-[var(--color-dark-sidebar)] flex flex-col items-center py-4 border-r border-[#e8e7e4] dark:border-[var(--color-dark-border)] transition-colors duration-300 relative z-50">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
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
            <Delete01Icon className="w-[18px] h-[18px] mr-2" /> Delete Chat
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
          <Star
            className={`w-[18px] h-[18px] mr-2 ${node.isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
          />
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
              <NotebookIcon className="w-[18px] h-[18px] mr-2" /> New Page
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
              <Folder01Icon className="w-[18px] h-[18px] mr-2" /> New Folder
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
          <Edit2 className="w-[18px] h-[18px] mr-2" /> Rename
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
          <Delete01Icon className="w-[18px] h-[18px] mr-2" /> Delete
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
          <NotebookIcon className="w-[18px] h-[18px] mr-2" /> New Page
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
          <Folder01Icon className="w-[18px] h-[18px] mr-2" /> New Folder
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

    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={() => setShowSettingsCard(false)}
      >
        <div
          className="bg-[#ffffff] dark:bg-[var(--color-dark-sidebar)] rounded-xl shadow-2xl border border-gray-200 dark:border-[var(--color-dark-border)] flex w-full max-w-[900px] h-[76vh] max-h-[640px] overflow-hidden text-sm font-sans relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button 
            onClick={() => setShowSettingsCard(false)} 
            className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500 z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left Sidebar */}
          <div className="w-[240px] bg-gray-50 dark:bg-black/10 border-r border-gray-200 dark:border-[var(--color-dark-border)] flex flex-col py-6 px-2 shrink-0">
            <div className="px-3 mb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Account</span>
            </div>
            
            <button
              onClick={() => setSettingsTab("account")}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors text-left ${settingsTab === "account" ? "bg-gray-200 dark:bg-[#333333] text-black dark:text-white font-medium" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            >
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-5 h-5 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="truncate text-[13px]">{displayName}</span>
            </button>
            
            <button
              onClick={() => setSettingsTab("preferences")}
              className={`flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-lg transition-colors text-left ${settingsTab === "preferences" ? "bg-gray-200 dark:bg-[#333333] text-black dark:text-white font-medium" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            >
              <AccountSetting03Icon className="w-4 h-4 text-gray-500" />
              <span className="text-[13px]">Preferences</span>
            </button>
            
            <button
              onClick={() => setSettingsTab("typography")}
              className={`flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-lg transition-colors text-left ${settingsTab === "typography" ? "bg-gray-200 dark:bg-[#333333] text-black dark:text-white font-medium" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
            >
              <TextIcon className="w-4 h-4 text-gray-500" />
              <span className="text-[13px]">Typography</span>
            </button>
            
            <div className="mt-auto px-1 pb-2">
              <button
                onClick={logout}
                className="w-full flex items-center px-2 py-1.5 text-sm rounded-md transition-colors text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20"
              >
                <Logout01Icon className="w-[18px] h-[18px] mr-2" /> Log out
              </button>
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar p-10 pt-12 relative bg-white dark:bg-[var(--color-dark-sidebar)]">
            {settingsTab === "account" && (
              <div className="flex flex-col max-w-2xl w-full mx-auto">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">My Account</h2>
                <p className="text-[13px] text-gray-500 mb-8 border-b border-gray-200 dark:border-[var(--color-dark-border)] pb-4">Manage your account information and settings</p>
                
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-5">
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="w-16 h-16 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-2xl shrink-0">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-900 dark:text-white text-base">{displayName}</span>
                      <span className="text-sm text-gray-500">{user?.email || "No email"}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-4 mt-4">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
                      <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium">Provider</span>
                      <span className="text-[14px] text-gray-500 capitalize">
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
                    <div className="flex justify-between items-center py-3 border-b border-gray-100 dark:border-white/5">
                      <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium">Joined Date</span>
                      <span className="text-[14px] text-gray-500">{joinedDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {settingsTab === "preferences" && (
              <div className="flex flex-col max-w-2xl w-full mx-auto">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Preferences</h2>
                <p className="text-[13px] text-gray-500 mb-8 border-b border-gray-200 dark:border-[var(--color-dark-border)] pb-4">Choose how you want the app to look and behave</p>

                <div className="flex flex-col gap-10">
                  {/* Appearance */}
                  <div className="flex flex-col gap-5">
                    <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Appearance</h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col mr-4">
                        <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium">Theme</span>
                        <span className="text-[13px] text-gray-500">Choose a theme for the app on this device</span>
                      </div>
                      <div className="relative w-[180px] shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowThemeDropdown(!showThemeDropdown);
                          }}
                          className="flex items-center justify-between w-full bg-[#f7f6f3] dark:bg-[#1a1a1a] border-[0.5px] border-gray-400/50 dark:border-[#8a817c]/50 rounded-[10px] px-3 py-2 text-[13px] font-medium text-gray-700 dark:text-gray-200 outline-none transition-colors hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
                        >
                          <span className="capitalize">{theme === 'system' ? 'Use system setting' : theme}</span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showThemeDropdown ? "rotate-180" : ""}`} />
                        </button>
                        
                        {showThemeDropdown && (
                          <div className="absolute top-full right-0 mt-1.5 w-full bg-white dark:bg-[#1a1a1a] border-[0.5px] border-gray-400/50 dark:border-[#8a817c]/50 rounded-[10px] shadow-xl overflow-hidden z-50 py-1">
                            {[
                              { id: "system", label: "Use system setting" },
                              { id: "light", label: "Light" },
                              { id: "dark", label: "Dark" }
                            ].map((t) => (
                              <button
                                key={t.id}
                                onClick={() => {
                                  setTheme(t.id);
                                  setShowThemeDropdown(false);
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
                              >
                                <span>{t.label}</span>
                                {theme === t.id && <Check className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col mr-4">
                        <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium">High Contrast</span>
                        <span className="text-[13px] text-gray-500">Increase contrast for improved visibility</span>
                      </div>
                      <button
                        onClick={() => setExtraContrast(!extraContrast)}
                        className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${extraContrast ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${extraContrast ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Privacy & Data */}
                  <div className="flex flex-col gap-5">
                    <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Privacy & Data</h3>
                    
                    <div>
                      <div 
                        className="flex items-center justify-between cursor-pointer group"
                        onClick={() => setShowCookiePanel(!showCookiePanel)}
                      >
                        <div className="flex flex-col mr-4">
                          <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">Cookie Settings</span>
                          <span className="text-[13px] text-gray-500">Manage your cookie preferences</span>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 shrink-0 transition-transform ${showCookiePanel ? "rotate-90" : ""}`} />
                      </div>
                      
                      {showCookiePanel && (
                        <div className="mt-3 ml-1 flex flex-col gap-3 bg-[#f7f6f3] dark:bg-black/10 p-4 rounded-lg border border-gray-100 dark:border-white/5">
                          {[
                            { key: "essential", label: "Essential Cookies", desc: "Required for the app to function. Cannot be disabled.", locked: true },
                            { key: "analytics", label: "Analytics Cookies", desc: "Help us understand how you use the app.", locked: false },
                            { key: "marketing", label: "Marketing Cookies", desc: "Used to personalize content and ads.", locked: false },
                          ].map((cookie) => (
                            <div key={cookie.key} className="flex items-center justify-between">
                              <div className="flex flex-col mr-4">
                                <span className="text-[13px] text-gray-700 dark:text-gray-300 font-medium">{cookie.label}</span>
                                <span className="text-[12px] text-gray-500">{cookie.desc}</span>
                              </div>
                              <button
                                onClick={() => handleCookieToggle(cookie.key)}
                                disabled={cookie.locked}
                                className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${cookie.locked ? "opacity-60 cursor-not-allowed" : ""} ${cookiePrefs[cookie.key] ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`}
                              >
                                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${cookiePrefs[cookie.key] ? "translate-x-4" : ""}`} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col mr-4">
                        <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium">Local Storage</span>
                        <span className="text-[13px] text-gray-500">{storageUsage} used. Unsaved drafts are included.</span>
                      </div>
                      <button 
                        onClick={() => setShowClearDataModal(true)}
                        className="text-[13px] text-red-500 hover:text-red-600 font-medium px-4 py-1.5 rounded border border-gray-200 dark:border-gray-700 hover:border-red-100 hover:bg-red-50 dark:hover:border-red-900/30 dark:hover:bg-red-500/10 transition-colors shrink-0"
                      >
                        Clear Local Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {settingsTab === "typography" && (
              <div className="flex flex-col max-w-2xl w-full mx-auto">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Typography & Editor</h2>
                <p className="text-[13px] text-gray-500 mb-8 border-b border-gray-200 dark:border-[var(--color-dark-border)] pb-4">Customize your reading and writing experience</p>

                <div className="flex flex-col gap-10">
                  {/* Typography */}
                  <div className="flex flex-col gap-5">
                    <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Typography</h3>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col mr-4">
                        <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium">Font Size</span>
                        <span className="text-[13px] text-gray-500">Adjust the interface text size ({fontSize}px)</span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-500 bg-[#f7f6f3] dark:bg-black/20 rounded-md border border-gray-100 dark:border-white/5 p-1 w-24 justify-between shrink-0">
                        <button 
                          onClick={() => handleFontSizeChange(-1)}
                          disabled={fontSize <= 12}
                          className="w-7 h-7 flex items-center justify-center hover:bg-white dark:hover:bg-[#333333] rounded hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >-</button>
                        <span className="text-[13px] w-8 text-center font-medium">{fontSize}</span>
                        <button 
                          onClick={() => handleFontSizeChange(1)}
                          disabled={fontSize >= 24}
                          className="w-7 h-7 flex items-center justify-center hover:bg-white dark:hover:bg-[#333333] rounded hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >+</button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex flex-col mr-4">
                        <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium">Font Style</span>
                        <span className="text-[13px] text-gray-500">Choose the default typeface</span>
                      </div>
                      <div className="relative w-[180px] shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFontDropdown(!showFontDropdown);
                          }}
                          className="flex items-center justify-between w-full bg-[#f7f6f3] dark:bg-[#1a1a1a] border-[0.5px] border-gray-400/50 dark:border-[#8a817c]/50 rounded-[10px] px-3 py-2 text-[13px] font-medium text-gray-700 dark:text-gray-200 outline-none transition-colors hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
                        >
                          <span className="capitalize">{fontFamily === 'sans' ? 'Sans-serif' : fontFamily === 'serif' ? 'Serif' : fontFamily === 'system' ? 'System Default' : 'Monospace'}</span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFontDropdown ? "rotate-180" : ""}`} />
                        </button>
                        
                        {showFontDropdown && (
                          <div className="absolute top-full right-0 mt-1.5 w-full bg-white dark:bg-[#1a1a1a] border-[0.5px] border-gray-400/50 dark:border-[#8a817c]/50 rounded-[10px] shadow-xl overflow-hidden z-50 py-1">
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
                                className="w-full flex items-center justify-between px-3 py-2 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
                              >
                                <span>{f.label}</span>
                                {fontFamily === f.id && <Check className="w-4 h-4" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Editor */}
                  <div className="flex flex-col gap-5">
                    <h3 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Editor</h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col mr-4">
                        <span className="text-[14px] text-gray-700 dark:text-gray-300 font-medium">Spell Check</span>
                        <span className="text-[13px] text-gray-500">Enable browser spell checker in notes</span>
                      </div>
                      <button
                        onClick={() => setSpellCheck(!spellCheck)}
                        className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${spellCheck ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-gray-700"}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${spellCheck ? "translate-x-5" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
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
      // Minimal distance from left corner, tight 10px indent per level
      const paddingLeft = `${4 + level * 10}px`;
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
                `flex items-center w-full py-1 pr-10 text-[13.5px] font-medium rounded-[6px] mb-0.5 transition-colors ${
                  isActive
                    ? "bg-[#ecebe9] dark:bg-white/[0.12] text-black dark:text-white"
                    : "text-gray-700 dark:text-[#d1cfca] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                }`
              }
              style={{ paddingLeft }}
            >
              <div className="flex items-center overflow-hidden">
                <NotebookIcon
                  className="w-[18px] h-[18px] mr-2 text-current shrink-0"
                  strokeWidth={2}
                />
                <span className="truncate">{node.name}</span>
              </div>
            </NavLink>
            <button
              onClick={(e) => handleMenuClick(e, node.id)}
              className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 ${activeMenu === node.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
              aria-label={`More options for ${node.name}`}
            >
              <MoreHorizontal className="w-4 h-4" />
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
                className="group flex items-center justify-between w-full py-1 pr-2 text-[13.5px] font-medium text-gray-700 dark:text-[#d1cfca] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] rounded-[6px] mb-0.5 transition-colors cursor-pointer"
                style={{ paddingLeft }}
                onClick={() => onToggle(node.id)}
              >
                <div className="flex items-center overflow-hidden min-w-0">
                  {node.type === "workspace" ? (
                    <ArtboardToolIcon
                      className="w-[18px] h-[18px] mr-2 shrink-0 text-current"
                      strokeWidth={2}
                    />
                  ) : isExpanded ? (
                    <Folder02Icon
                      className="w-[18px] h-[18px] mr-2 shrink-0 text-current"
                      strokeWidth={2}
                    />
                  ) : (
                    <Folder01Icon
                      className="w-[18px] h-[18px] mr-2 shrink-0 text-current"
                      strokeWidth={2}
                    />
                  )}
                  <span className="truncate select-none mr-1.5">
                    {node.name}
                  </span>
                  <ChevronRight
                    className={`w-3 h-3 shrink-0 transition-all duration-300 opacity-0 group-hover:opacity-100 ${isExpanded ? "rotate-90 opacity-70" : ""}`}
                  />
                </div>
                <div className="flex items-center">
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
                    className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 ${activeAddMenu === node.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity mr-0.5`}
                    title="Add..."
                  >
                    <Add01Icon className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    onClick={(e) => handleMenuClick(e, node.id)}
                    className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 ${activeMenu === node.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                    title="More Options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
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
      {/* Animated Quick Actions Bar */}
      <div className="px-3 pt-5 pb-3 flex items-center justify-start gap-1">
        {topNavItems.map((item) => {
          if (item.id === "search") {
            return (
              <button
                key={item.id}
                onClick={() => setIsSearchActive(true)}
                className="block cursor-pointer"
              >
                <motion.div
                  layout
                  className={`flex items-center h-8 rounded-full overflow-hidden ${
                    isSearchActive
                      ? "bg-[#ecebe9] dark:bg-[#333333] text-black dark:text-white px-3"
                      : "bg-transparent text-[#8a817c] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 w-8 justify-center"
                  }`}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <motion.div
                    layout="position"
                    className="shrink-0 flex items-center justify-center"
                  >
                    <item.icon className="w-[19px] h-[19px]" />
                  </motion.div>
                  <AnimatePresence initial={false}>
                    {isSearchActive && (
                      <motion.div
                        initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                        animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                        exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-2 overflow-hidden whitespace-nowrap"
                      >
                        <div className="flex items-center text-gray-500 dark:text-gray-400">
                          <OptionIcon className="w-[14px] h-[14px]" />
                          <span className="text-[13px] font-medium font-sans ml-0.5">S</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </button>
            );
          }

          if (item.id === "chat") {
            const isChatActive =
              isRightChatOpen || location.pathname === "/dashboard/chat";
            return (
              <button
                key={item.id}
                onClick={() => setIsRightChatOpen((prev) => !prev)}
                className="block cursor-pointer"
              >
                <motion.div
                  layout
                  className={`flex items-center h-8 rounded-full overflow-hidden ${
                    isChatActive
                      ? "bg-[#ecebe9] dark:bg-[#333333] text-black dark:text-white px-3"
                      : "bg-transparent text-[#8a817c] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 w-8 justify-center"
                  }`}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <motion.div
                    layout="position"
                    className="shrink-0 flex items-center justify-center"
                  >
                    <item.icon className="w-[19px] h-[19px]" />
                  </motion.div>
                  <AnimatePresence initial={false}>
                    {isChatActive && (
                      <motion.span
                        initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                        animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                        exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-[15px] font-semibold whitespace-nowrap overflow-hidden"
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
                    className={`flex items-center h-8 rounded-full overflow-hidden ${
                      active
                        ? "bg-[#ecebe9] dark:bg-[#333333] text-black dark:text-white px-3"
                        : "bg-transparent text-[#8a817c] hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 w-8 justify-center"
                    }`}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  >
                    <motion.div
                      layout="position"
                      className="shrink-0 flex items-center justify-center"
                    >
                      <item.icon className="w-[19px] h-[19px]" />
                    </motion.div>
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.span
                          initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                          animate={{ opacity: 1, width: "auto", marginLeft: 8 }}
                          exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                          transition={{ duration: 0.2 }}
                          className="text-[15px] font-semibold whitespace-nowrap overflow-hidden"
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
        <div className="flex flex-col mb-3.5 shrink-0">
          <div className="group flex items-center justify-between w-full pt-2 px-2 pb-2 shrink-0">
            <div
              onClick={() => toggleFolder("recent-section")}
              className="flex items-center gap-1.5 select-none cursor-pointer px-2.5 py-1 rounded-lg bg-purple-500/5 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
              <span className="text-[11.5px] font-semibold tracking-wide">Recents</span>
              <ChevronRight
                className={`w-3 h-3 shrink-0 transition-transform duration-300 ${debouncedSearchQuery || expandedFolders["recent-section"] ? "rotate-90" : ""}`}
              />
            </div>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${debouncedSearchQuery || expandedFolders["recent-section"] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          >
            <div className="overflow-hidden w-full flex flex-col px-0.5 pt-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
              <button
                onClick={handleCreateRootPage}
                className="group flex items-center gap-3 w-full py-1 px-2.5 mb-0.5 text-[13.5px] font-medium text-gray-700 dark:text-[#d1cfca] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] rounded-[6px] transition-colors bg-transparent border-none outline-none cursor-pointer shrink-0"
              >
                <File02Icon className="w-[18px] h-[18px] shrink-0 text-current" strokeWidth={2} />
                New Page
              </button>

              {treeLoading ? (
                <>
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                </>
              ) : (
                filterTree(mockRecent, debouncedSearchQuery).map((recent) => (
                  <div
                    key={recent.id}
                    className={`group w-full relative ${activeMenu === recent.id ? "z-50" : "z-auto"}`}
                  >
                    <NavLink
                      to={recent.path}
                      className={({ isActive }) =>
                        `flex items-center w-full py-1 px-2.5 pr-10 text-[13.5px] font-medium rounded-[6px] mb-0.5 transition-colors ${
                          isActive
                            ? "bg-[#ecebe9] dark:bg-white/[0.12] text-black dark:text-white"
                            : "text-gray-700 dark:text-[#d1cfca] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                        }`
                      }
                    >
                      <div className="flex items-center overflow-hidden gap-3">
                        <NotebookIcon
                          className="w-[18px] h-[18px] text-current shrink-0"
                          strokeWidth={2}
                        />
                        <span className="truncate">{recent.name}</span>
                      </div>
                    </NavLink>
                    <button
                      onClick={(e) => handleMenuClick(e, recent.id)}
                      className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 ${activeMenu === recent.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                      aria-label={`More options for ${recent.name}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="flex flex-col mb-3.5 shrink-0">
          <div className="group flex items-center justify-between w-full pt-2 px-2 pb-2 shrink-0">
            <div
              className="flex items-center gap-1.5 select-none cursor-pointer px-2.5 py-1 rounded-lg bg-amber-500/5 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 transition-colors"
              onClick={() => toggleFolder("workspaces-section")}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-[11.5px] font-semibold tracking-wide">Workspaces</span>
              <ChevronRight
                className={`w-3 h-3 shrink-0 transition-transform duration-300 ${expandedFolders["workspaces-section"] ? "rotate-90" : ""}`}
              />
            </div>
            <button
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              title="Create new workspace"
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setNewWorkspacePos({ top: rect.bottom + 8, left: rect.left });
                setShowNewWorkspaceModal(true);
              }}
            >
              <Add01Icon className="w-4 h-4" />
            </button>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              debouncedSearchQuery || expandedFolders["workspaces-section"]
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden w-full flex flex-col px-1 pt-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pb-1">
              {treeLoading ? (
                <>
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                </>
              ) : (
                renderTree(filterTree(mockTree, debouncedSearchQuery))
              )}
            </div>
          </div>
        </div>

        {/* Favorites Section */}
        <div className="flex flex-col mb-3.5 shrink-0">
          <div className="group flex items-center justify-between w-full pt-2 px-1 pb-2 shrink-0">
            <div
              onClick={() => toggleFolder("favorites-section")}
              className="flex items-center gap-1.5 select-none cursor-pointer px-2.5 py-1 rounded-lg bg-blue-500/5 text-blue-700 dark:text-blue-300 hover:bg-blue-500/10 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-[11.5px] font-semibold tracking-wide">Favorites</span>
              <ChevronRight
                className={`w-3 h-3 shrink-0 transition-transform duration-300 ${debouncedSearchQuery || expandedFolders["favorites-section"] ? "rotate-90" : ""}`}
              />
            </div>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${debouncedSearchQuery || expandedFolders["favorites-section"] ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
          >
            <div className="overflow-hidden w-full flex flex-col px-0.5 pt-1.5 max-h-[380px] overflow-y-auto custom-scrollbar">
              {treeLoading ? (
                <>
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                </>
              ) : (
                renderTree(
                  filterTree(mockFavorites, debouncedSearchQuery),
                  0,
                  expandedFavoriteFolders,
                  toggleFavoriteFolder,
                )
              )}
            </div>
          </div>
        </div>

        {/* Chat History Section */}
        <div className="flex flex-col mb-3.5 shrink-0">
          <div className="group flex items-center justify-between w-full pt-2 px-2 pb-2 shrink-0">
            <div
              onClick={() => toggleFolder("chat-history-section")}
              className="flex items-center gap-1.5 select-none cursor-pointer px-2.5 py-1 rounded-lg bg-green-500/5 text-green-700 dark:text-green-300 hover:bg-green-500/10 transition-colors"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-[11.5px] font-semibold tracking-wide">Chat History</span>
              <ChevronRight
                className={`w-3 h-3 shrink-0 transition-transform duration-300 ${debouncedSearchQuery || expandedFolders["chat-history-section"] ? "rotate-90" : ""}`}
              />
            </div>
          </div>
          <div
            className={`grid transition-all duration-300 ease-in-out ${
              debouncedSearchQuery || expandedFolders["chat-history-section"]
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden w-full flex flex-col px-0.5 pt-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pb-2">
              {chatLoading ? (
                <>
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                  <SidebarSkeletonItem />
                </>
              ) : (
                chatSessions.map((session) => (
                  <div
                    key={session.sessionId}
                    className={`w-full relative ${activeMenu === session.sessionId ? "z-50" : "z-auto"}`}
                  >
                    {(() => {
                      const isChatActive = sessionId === session.sessionId;
                      return (
                        <div
                          className={`group flex items-center justify-between w-full py-1 px-2.5 text-[13.5px] font-medium rounded-[6px] mb-0.5 transition-colors cursor-pointer ${
                            isChatActive
                              ? "bg-[#ecebe9] dark:bg-white/[0.12] text-black dark:text-white"
                              : "text-gray-700 dark:text-[#d1cfca] hover:text-black dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
                          }`}
                          onClick={() => {
                            loadSession(session.sessionId);
                            navigate("/dashboard/chat");
                          }}
                        >
                          <div className="flex items-center overflow-hidden gap-3">
                            <ChatFeedback01Icon
                              className="w-[18px] h-[18px] text-current shrink-0"
                              strokeWidth={2}
                            />
                            <span className="truncate">
                              {session.title || "Untitled Chat"}
                            </span>
                          </div>
                          <button
                            onClick={(e) =>
                              handleMenuClick(e, session.sessionId)
                            }
                            className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 shrink-0 ${activeMenu === session.sessionId ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
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

      {/* Footer */}
      <div className="h-16 px-3 flex items-center border-t border-gray-200 dark:border-[var(--color-dark-border)] justify-between shrink-0">
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowSettingsCard(true);
          }}
          className="flex items-center gap-3 overflow-hidden cursor-pointer hover:bg-gray-200/50 p-1.5 rounded-lg transition-colors flex-1 mr-2"
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt="User"
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#ecebe9] dark:bg-gray-800 flex items-center justify-center text-black dark:text-gray-200 font-semibold shrink-0">
              {(user?.username || user?.name || "U").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[14px] font-medium text-gray-800 dark:text-gray-200 truncate">
            {user?.username || user?.name || "User"}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">

          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
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
