import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from "react";
import { useParams, useNavigate, useLocation, useBlocker } from "react-router-dom";
import { MoreHorizontal, ArrowLeft, Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, Code, Underline as UnderlineIcon, RemoveFormatting, Link as LinkIcon } from "lucide-react";
import {
  Edit02Icon,
  Bookmark02Icon,
  FavouriteIcon,
  Delete01Icon,
  CodeFolderIcon,
  TextIcon,
  
  Loading03Icon,
  QuillWrite02Icon,
  Minimize02Icon,
  BlushBrush02Icon,
  FeatherIcon,
} from "hugeicons-react";
import { pagesAPI, chatAPI } from "../../services/api";
import ActionModal from "../UI/ActionModal";
import LocationDropdown from "../UI/LocationDropdown";
import { useToast } from "../../context/ToastContext";
import { validateAiInput, handleApiSizeError, validatePageContent } from "../../utils/aiValidation";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { Mark, mergeAttributes } from '@tiptap/core';
import { marked } from 'marked';
import 'prosemirror-view/style/prosemirror.css';

import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import ScrollReveal from '../lightswind/scroll-reveal';

const createStreamId = () => `stream-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const AIStreamNodeComponent = (props) => {
  return (
    <NodeViewWrapper className="ai-stream-wrapper my-1 outline-none ring-0 border-none select-none pointer-events-none user-select-none">
      <ScrollReveal
        size="sm"
        enableBlur={true}
        baseOpacity={0}
        baseRotation={0}
        blurStrength={4}
        staggerDelay={0.02}
        duration={0.4}
        autoAnimate={true}
        textClassName="whitespace-pre-wrap font-normal text-gray-700 dark:text-[rgb(174,172,167)] m-0 p-0 outline-none select-none"
      >
        {props.node.attrs.text}
      </ScrollReveal>
    </NodeViewWrapper>
  );
};

const AIStreamExtension = Node.create({
  name: 'aiStream',
  group: 'block',
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      text: {
        default: '',
      },
      id: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-ai-stream]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-ai-stream': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AIStreamNodeComponent);
  },
});

const AIEffectMark = Mark.create({
  name: 'aiEffect',
  addOptions() {
    return { HTMLAttributes: {} };
  },
  addAttributes() {
    return {
      class: {
        default: null,
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-ai-effect]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-ai-effect': '' }), 0];
  },
});

import { EditorContext } from "../../context/EditorContext";

const NoteEditor = () => {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const {
    setIsPageOpen,
    registerAppendContent,
    unregisterAppendContent,
    workspaceTree,
    selectedLocation,
    setSelectedLocation,
    selectedPath,
    setSelectedPath,
    triggerSidebarRefresh,
  } = useContext(EditorContext);
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [pageType, setPageType] = useState("document"); // 'document' or 'code'
  const [fontSize, setFontSize] = useState(() => {
    const savedSize = Number(localStorage.getItem("noema-font-size"));
    return Number.isFinite(savedSize) ? Math.min(32, Math.max(12, savedSize)) : 20;
  }); // px
  const [pageLocationIds, setPageLocationIds] = useState({
    workspaceId: null,
    folderId: null,
  });
  const [locationLocked, setLocationLocked] = useState(false);
  const [isNewPage, setIsNewPage] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle"); // 'idle' | 'saving' | 'saved' | 'error'
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [globalSpellCheck, setGlobalSpellCheck] = useState(
    () => localStorage.getItem("noema-spellcheck") === "true",
  );

  useEffect(() => {
    const handleFontSizeChange = () => {
      const savedSize = Number(localStorage.getItem("noema-font-size"));
      if (Number.isFinite(savedSize)) {
        setFontSize(Math.min(32, Math.max(12, savedSize)));
      }
    };
    window.addEventListener("noema-font-size-changed", handleFontSizeChange);
    return () => window.removeEventListener("noema-font-size-changed", handleFontSizeChange);
  }, []);

  useEffect(() => {
    localStorage.setItem("noema-font-size", String(fontSize));
    window.dispatchEvent(new Event("noema-font-size-changed"));
  }, [fontSize]);
  const [titleError, setTitleError] = useState(false);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [originalData, setOriginalData] = useState({ title: "", content: "" });
  const isSavingRef = useRef(false);
  const fetchRequestIdRef = useRef(0);

  
  const [slashMenu, setSlashMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    search: "",
    index: 0,
    selectionStart: 0,
  });
      const [showPromptInput, setShowPromptInput] = useState(null); // { textBefore, textAfter, insertIndex }
  const [promptInputVal, setPromptInputVal] = useState("");

  const slashMenuState = useRef(slashMenu);
  const containerRef = useRef(null);

  const isDirty = title !== originalData.title || content !== originalData.content;

  useEffect(() => {
    const draftKey = `noema_draft_${pageId || 'new'}`;
    if (isDirty) {
      localStorage.setItem(draftKey, JSON.stringify({ title, content }));
    } else {
      localStorage.removeItem(draftKey);
    }
  }, [title, content, isDirty, pageId]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && !isSavingRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !isSavingRef.current && currentLocation.pathname !== nextLocation.pathname
  );
  
  useEffect(() => {
     slashMenuState.current = slashMenu;
  }, [slashMenu]);

  const slashMenuItemsRef = useRef([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      AIEffectMark,
      AIStreamExtension,
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      setContent(markdown);
      
      const currentSlashMenu = slashMenuState.current;
      if (currentSlashMenu.isOpen) {
          const { from } = editor.state.selection;
          if (from < currentSlashMenu.selectionStart) {
             setSlashMenu(prev => ({ ...prev, isOpen: false }));
          } else {
             const typed = editor.state.doc.textBetween(currentSlashMenu.selectionStart, from, '\n');
             if (typed.includes(' ')) {
                setSlashMenu(prev => ({ ...prev, isOpen: false }));
             } else {
                setSlashMenu(prev => ({ ...prev, search: typed }));
             }
          }
      } else {
          const { from, to } = editor.state.selection;
          if (from === to) {
             const textBefore = editor.state.doc.textBetween(Math.max(0, from - 2), from, '\n');
             if (textBefore.endsWith('/')) {
                 const isStart = from === 1 || textBefore.length === 1 || !!textBefore.match(/[\s\n]\/$/);
                 if (isStart || textBefore === '/') {
                     const coords = editor.view.coordsAtPos(from);
                     let containerRect = { top: 0, left: 0 };
                     if (containerRef.current) {
                        containerRect = containerRef.current.getBoundingClientRect();
                     }
                     setSlashMenu({
                       isOpen: true,
                       x: coords.left - containerRect.left,
                       y: coords.bottom - containerRect.top + 5,
                       search: '',
                       index: 0,
                       selectionStart: from
                     });
                 }
             }
          }
      }
    },
    onSelectionUpdate: ({ editor }) => {
       const { from, to } = editor.state.selection;
       if (from !== to) {
          setTimeout(() => {
             const selection = window.getSelection();
             if (!selection.rangeCount) return;
             
             const range = selection.getRangeAt(0);
             const rect = range.getBoundingClientRect();
             
             let containerRect = { top: 0, left: 0 };
             if (containerRef.current) {
                 containerRect = containerRef.current.getBoundingClientRect();
             }
             
             // Calculate center X of the selection
             const centerX = (rect.left + rect.width / 2) - containerRect.left;
             
             // Estimate menu height
             const estimatedMenuHeight = 250; 
             
             // Check if we have space ABOVE the selection in the viewport
             const spaceAbove = rect.top; // space from top of screen to top of selection
             const spaceBelow = window.innerHeight - rect.bottom;
             
             let finalY;
             let transformY;
             
             if (spaceAbove > estimatedMenuHeight + 30) {
                 // Place ABOVE
                 finalY = rect.top - containerRect.top - 30;
                 transformY = 'calc(-100%)';
             } else if (spaceBelow > estimatedMenuHeight + 30) {
                 // Place BELOW
                 finalY = rect.bottom - containerRect.top + 10;
                 transformY = '0';
             } else {
                 // Fallback to whichever has MORE space
                 if (spaceAbove >= spaceBelow) {
                     finalY = rect.top - containerRect.top - 30;
                     transformY = 'calc(-100%)';
                 } else {
                     finalY = rect.bottom - containerRect.top + 10;
                     transformY = '0';
                 }
             }

             setSelectionToolbar({
                isOpen: true,
                x: centerX,
                y: finalY,
                transformY: transformY,
                showUrlInput: false,
                start: from,
                end: to
             });
          }, 50);
       } else {
          setSelectionToolbar(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
       }
    },
    editorProps: {
      handleKeyDown: (view, event) => {
        const currentSlashMenu = slashMenuState.current;
        if (currentSlashMenu.isOpen) {
          if (event.key === "ArrowDown") {
             event.preventDefault();
             setSlashMenu((prev) => ({ ...prev, index: (prev.index + 1) % slashMenuItemsRef.current.length }));
             return true;
          }
          if (event.key === "ArrowUp") {
             event.preventDefault();
             setSlashMenu((prev) => ({ ...prev, index: (prev.index - 1 + slashMenuItemsRef.current.length) % slashMenuItemsRef.current.length }));
             return true;
          }
          if (event.key === "Enter") {
             event.preventDefault();
             const item = slashMenuItemsRef.current[currentSlashMenu.index];
             if (item) {
                 handleSelectSlashItem(item);
             }
             return true;
          }
          if (event.key === "Escape") {
             event.preventDefault();
             setSlashMenu(prev => ({ ...prev, isOpen: false }));
             return true;
          }
        }
        return false;
      }
    }
  });

  const initialContentLoadedRef = useRef(false);
  useEffect(() => {
     if (editor && initialContentLoadedRef.current) {
         try {
           const freshState = editor.state.constructor.create({
             schema: editor.state.schema,
             plugins: editor.state.plugins,
           });
           editor.view.updateState(freshState);
           editor.commands.setContent(content);
         } catch (e) {
           console.warn('Editor state reset failed, falling back:', e);
           try { editor.commands.setContent(content); } catch { /* ignore */ }
         }
         initialContentLoadedRef.current = false;
     }
  }, [editor, content]);

  const actionMenuRef = useRef(null);
    const slashMenuRef = useRef(null);
  const promptInputRef = useRef(null);

  const [selectionToolbar, setSelectionToolbar] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    start: 0,
    end: 0,
  });

  
  
  // Listen to global spellcheck changes
  useEffect(() => {
    const handleSpellCheckChange = () => {
      setGlobalSpellCheck(localStorage.getItem("noema-spellcheck") === "true");
    };
    window.addEventListener("noema-spellcheck-changed", handleSpellCheckChange);
    return () =>
      window.removeEventListener(
        "noema-spellcheck-changed",
        handleSpellCheckChange,
      );
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setShowActionMenu(false);
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setSlashMenu((prev) => ({ ...prev, isOpen: false }));
      }
      // Keep selection toolbar open unless clicked outside of textarea/toolbar (handled by selection logic)
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActionMenu, slashMenu.isOpen]);

  // Focus prompt input when shown
  useEffect(() => {
    if (showPromptInput && promptInputRef.current) {
      promptInputRef.current.focus();
    }
  }, [showPromptInput]);

  // Register with EditorContext
  useEffect(() => {
    setIsPageOpen(true);
    registerAppendContent((text) => {
      setContent((prev) => {
         const newContent = prev ? prev + "\n\n" + text : text;
         if (editor && !editor.isDestroyed) {
             editor.commands.setContent(newContent);
         }
         return newContent;
      });
    });
    return () => {
      setIsPageOpen(false);
      unregisterAppendContent();
    };
  }, [pageId, setIsPageOpen, registerAppendContent, unregisterAppendContent]);

  const getId = useCallback((value) => {
    if (!value) return null;
    if (typeof value === "string") return value;
    return value._id || value.id || null;
  }, []);

  const findLocationInTree = useCallback(
    (workspaceId, folderId) => {
      const workspace = workspaceTree.find((node) => node.id === workspaceId);

      // If no workspace matches, return null path
      if (!workspace) return { node: null, path: [] };

      // If there is a workspace but no folder, the page is at the workspace root
      if (!folderId) return { node: workspace, path: [workspace.name] };

      const findFolder = (nodes = [], path = []) => {
        for (const node of nodes) {
          const nextPath = [...path, node.name];
          if (node.id === folderId && node.type === "folder") {
            return { node, path: nextPath };
          }
          const found = findFolder(node.children, nextPath);
          if (found.node) return found;
        }
        return { node: null, path: [] };
      };

      const result = findFolder(workspace.children, [workspace.name]);
      if (result.node) return result;

      // Fallback if folder was not found but workspace exists
      return { node: workspace, path: [workspace.name] };
    },
    [workspaceTree],
  );

  // Fetch page on load
  const prevPageIdRef = useRef(pageId);
  useEffect(() => {
    if (!pageId) return;

    // Skip loading state if we just auto-saved a new page and the URL changed from "new" to an ID.
    // This prevents the editor from unmounting and destroying the user's cursor/focus while they type.
    const isSavingNewPage = prevPageIdRef.current === "new" && pageId !== "new";
    if (!isSavingNewPage) {
      setLoading(true);
    }
    prevPageIdRef.current = pageId;

    if (pageId === "new") {
      setTitle("");
      setContent("");
      setSelectedLocation(null);
      setSelectedPath([]);
      setIsFavorite(false);
      setPageType("document");
      setPageLocationIds({ workspaceId: null, folderId: null });
      setLocationLocked(false);
      setIsNewPage(true);
      initialContentLoadedRef.current = true;
      setLoading(false);
      return;
    }

    const requestId = Date.now() + Math.random();
    fetchRequestIdRef.current = requestId;

    // Reset location state when switching pages
    setSelectedLocation(null);
    setSelectedPath([]);
    setIsNewPage(Boolean(routeLocation.state?.showLocationPicker));

    pagesAPI
      .getById(pageId)
      .then((res) => {
        if (fetchRequestIdRef.current !== requestId) return;

        const page = res.data.page;
        const fetchedTitle = page.title || "";
        const fetchedContent = page.content || "";
        
        let initialTitle = fetchedTitle;
        let initialContent = fetchedContent;

        const draftStr = localStorage.getItem(`noema_draft_${pageId}`);
        if (draftStr) {
            try {
                const draft = JSON.parse(draftStr);
                if (draft.title !== fetchedTitle || draft.content !== fetchedContent) {
                    initialTitle = draft.title;
                    initialContent = draft.content;
                } else {
                    localStorage.removeItem(`noema_draft_${pageId}`);
                }
            } catch (e) {
                console.error("Failed to parse draft", e);
            }
        }

        setTitle(initialTitle);
        setContent(initialContent);
        setOriginalData({ title: fetchedTitle, content: fetchedContent });
        setIsFavorite(page.isFavorite || false);
        setPageType(page.type || "document");
        setPageLocationIds({
          workspaceId: getId(page.workspaceId),
          folderId: getId(page.folderId),
        });
        setLocationLocked(
          Boolean(
            getId(page.folderId) || !routeLocation.state?.showLocationPicker,
          ),
        );
        initialContentLoadedRef.current = true;
      })
      .catch((err) => {
        if (fetchRequestIdRef.current !== requestId) return;
        console.error("Failed to load page:", err);
        localStorage.removeItem("noema-last-route");
        navigate("/dashboard", { replace: true });
      })
      .finally(() => {
        if (fetchRequestIdRef.current === requestId) {
          setLoading(false);
        }
      });
  }, [pageId, navigate, getId, routeLocation.state]);

  useEffect(() => {
    const { workspaceId, folderId } = pageLocationIds;
    if (!workspaceId || selectedLocation || !locationLocked) return;

    const location = findLocationInTree(workspaceId, folderId);
    if (location.node) {
      setSelectedLocation(location.node);
      setSelectedPath(location.path);
    }
  }, [
    pageLocationIds,
    selectedLocation,
    locationLocked,
    findLocationInTree,
    setSelectedLocation,
    setSelectedPath,
  ]);

  // Save to API
  const savePage = useCallback(
    async (updates) => {
      if (!pageId && !isNewPage) return;
      isSavingRef.current = true;

      const hasNewPageLocation =
        pageId === "new" || isNewPage
          ? Boolean(updates.workspaceId || selectedLocation?.type === "workspace" || selectedLocation?.type === "folder")
          : true;
      if (!hasNewPageLocation) {
        showToast("Choose a workspace or folder before saving the page.", "error");
        setSaveStatus("error");
        isSavingRef.current = false;
        return false;
      }

      const currentTitle = updates.title !== undefined ? updates.title : title;
      const trimmedTitle = currentTitle ? currentTitle.trim() : "";
      if (!trimmedTitle || trimmedTitle.toLowerCase() === "untitled") {
        setTitleError(true);
        showToast("Title is required to save the page.", "error");
        setTimeout(() => setTitleError(false), 500);
        setSaveStatus("error");
        isSavingRef.current = false;
        return false;
      }

      const currentContent = updates.content !== undefined ? updates.content : content;
      const contentValidation = validatePageContent(currentContent);
      if (!contentValidation.valid) {
        showToast(contentValidation.message, "error");
        setSaveStatus("error");
        isSavingRef.current = false;
        return false;
      }

      setSaveStatus("saving");
      try {
        if (pageId === "new" || isNewPage) {
          const payload = {
            title,
            content,
            isFavorite,
            type: pageType,
            ...updates,
          };
          if (payload.workspaceId === undefined) payload.workspaceId = null;
          if (payload.folderId === undefined) payload.folderId = null;

          const res = await pagesAPI.create(payload);
          const newPageId = res.data.page._id;
          setOriginalData({ title: payload.title || res.data.page.title, content: payload.content || "" });
          setIsNewPage(false);

          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);

          const newNode = {
            id: newPageId,
            type: "page",
            name: res.data.page.title,
            path: `/dashboard/page/${newPageId}`,
            isFavorite: res.data.page.isFavorite,
            updatedAt: res.data.page.updatedAt,
            isGlobal: !res.data.page.workspaceId,
            workspaceId: res.data.page.workspaceId,
            folderId: res.data.page.folderId,
          };
          window.dispatchEvent(
            new CustomEvent("optimistic-add-page", { detail: newNode }),
          );

          navigate(`/dashboard/page/${newPageId}`, { replace: true });
          return true;
        } else {
          await pagesAPI.update(pageId, updates);
          setSaveStatus("saved");
          setOriginalData({ title: updates.title ?? title, content: updates.content ?? content });
          localStorage.removeItem(`noema_draft_${pageId}`);
          setTimeout(() => setSaveStatus("idle"), 2000);
          triggerSidebarRefresh();
          return true;
        }
      } catch (err) {
        console.error("Save failed:", err);
        setSaveStatus("error");
        showToast("Failed to save the page.", "error");
        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [
      pageId,
      isNewPage,
      title,
      content,
      isFavorite,
      pageType,
      navigate,
      setTitleError,
      showToast,
      selectedLocation,
    ],
  );

  const getLocationPayload = useCallback(
    (locationNode) => {
      if (!locationNode) return {};

      if (locationNode.type === "global") {
        return pageLocationIds.workspaceId
          ? { workspaceId: pageLocationIds.workspaceId, folderId: null }
          : {};
      }

      if (locationNode.type === "workspace") {
        return { workspaceId: locationNode.id, folderId: null };
      }

      if (locationNode.type === "folder") {
        const workspace = workspaceTree.find((node) => {
          const hasLocation = (children = []) =>
            children.some(
              (child) =>
                child.id === locationNode.id || hasLocation(child.children),
            );

          return node.id === locationNode.id || hasLocation(node.children);
        });

        return workspace
          ? { workspaceId: workspace.id, folderId: locationNode.id }
          : {};
      }

      return {};
    },
    [workspaceTree, pageLocationIds.workspaceId],
  );

  const getSelectedLocationPayload = useCallback(
    () => getLocationPayload(selectedLocation),
    [getLocationPayload, selectedLocation],
  );

  // Manual save
  const handleManualSave = async () => {
    if (!isDirty || saveStatus === "saving") return;
    const locationPayload = getSelectedLocationPayload();
    const fallbackLocation = locationPayload.workspaceId
      ? locationPayload
      : pageLocationIds.workspaceId
        ? { workspaceId: pageLocationIds.workspaceId, folderId: null }
        : { workspaceId: null, folderId: null };
    if ((pageId === "new" || isNewPage) && !locationPayload.workspaceId) {
      showToast("Choose a workspace or folder before saving the page.", "error");
      return;
    }
    const saved = await savePage({
      title,
      content,
      isFavorite,
      type: pageType,
      ...fallbackLocation,
    });
    if (saved) {
      if (fallbackLocation.workspaceId) {
        setPageLocationIds({
          workspaceId: fallbackLocation.workspaceId,
          folderId: fallbackLocation.folderId,
        });
        setLocationLocked(true);
      }
      setIsNewPage(false);
    }
  };

  const handleLocationSelect = async (node, path) => {
    setSelectedLocation(node);
    setSelectedPath(path);

    if (isNewPage) return;

    const locationPayload = getLocationPayload(node);
    if (!locationPayload.workspaceId) return;

    const saved = await savePage(locationPayload);
    if (saved) {
      setPageLocationIds({
        workspaceId: locationPayload.workspaceId,
        folderId: locationPayload.folderId,
      });
      setLocationLocked(true);
    }
  };

  // State handlers (NO autosave)
  const handleTitleChange = (e) => setTitle(e.target.value);
  
  
  const handleSelectionToolbarAction = async (promptType) => {
    if (!editor) return;
    const selStart = selectionToolbar.start;
    const selEnd = selectionToolbar.end;
    setSelectionToolbar((prev) => ({ ...prev, isOpen: false }));
    const selectedText = editor.state.doc.textBetween(selStart, selEnd, ' ');
    if (!selectedText.trim()) return;
    editor.commands.setTextSelection(selStart);
    await runInlineAIStream({
      promptType,
      text: selectedText,
      fromPos: selStart,
      toPos: selEnd
    });
  };

  
  
  const toggleFavorite = async () => {
    const newFav = !isFavorite;
    setIsFavorite(newFav);
    if (!isNewPage) {
      const saved = await savePage({ isFavorite: newFav });
      if (!saved) {
        setIsFavorite(!newFav);
      }
    }
  };

  // Delete page — triggered by custom modal confirm
  const handleDeleteConfirmed = async () => {
    try {
      await pagesAPI.delete(pageId);
      window.dispatchEvent(
        new CustomEvent("optimistic-delete-page", { detail: pageId }),
      );
      setShowDeleteModal(false);
      navigate("/dashboard");
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Delete failed. Please try again.", "error");
    }
  };

  // --- Slash Menu & Inline AI Helpers ---
  const slashMenuItems = [
    { id: "write", label: "Ask AI to write...", icon: <QuillWrite02Icon className="w-[18px] h-[18px]" /> },
    { id: "summarize", label: "Summarize Selection", icon: <Minimize02Icon className="w-[18px] h-[18px]" /> },
    { id: "grammar", label: "Fix Grammar", icon: <BlushBrush02Icon className="w-[18px] h-[18px]" /> },
  ].filter((item) =>
    item.label.toLowerCase().includes(slashMenu.search.toLowerCase())
  );

  useEffect(() => {
    slashMenuItemsRef.current = slashMenuItems;
  }, [slashMenuItems]);

  
  
  const handleSelectSlashItem = async (item) => {
    if (!editor) return;
    const currentSlashMenu = slashMenuState.current;
    const { to } = editor.state.selection;
    const slashStart = currentSlashMenu.selectionStart - 1;
    try {
      editor.chain().deleteRange({ from: slashStart, to }).run();
    } catch (e) { console.error("Slash deleteRange error", e); }
    setSlashMenu((prev) => ({ ...prev, isOpen: false }));

    if (item.id === "write") {
      setShowPromptInput({
        insertPos: slashStart,
      });
      return;
    }

    const $pos = editor.state.doc.resolve(slashStart);
    let targetText = $pos.parent.textContent.trim();
    let fromPos = $pos.start();
    let toPos = $pos.end();

    if (!targetText) {
      const prevNode = editor.state.doc.resolve(Math.max(0, fromPos - 1));
      if (prevNode && prevNode.parent) {
         targetText = prevNode.parent.textContent.trim();
         fromPos = prevNode.start();
         toPos = prevNode.end();
      }
    }

    if (!targetText) {
      showToast("No text found to process. Type some text first!", "warning");
      return;
    }

    // Validate input before proceeding
    const validation = validateAiInput(item.id, targetText);
    if (!validation.valid) {
      showToast(validation.message, "warning");
      return;
    }

    await runInlineAIStream({
      promptType: item.id,
      text: targetText,
      fromPos,
      toPos,
    });
  };

  const runInlineAIStream = async ({ promptType, text, instruction, insertPos, fromPos, toPos }) => {
    // Validate input before proceeding
    const validation = validateAiInput(promptType, text, instruction);
    if (!validation.valid) {
      showToast(validation.message, "warning");
      return;
    }

    const isSelectionAction = fromPos !== undefined && toPos !== undefined && fromPos !== toPos;
    let streamingResult = "";
    let animationInterval;
    let loadingMarkFrom, loadingMarkTo;
    
    if (isSelectionAction) {
      editor.chain().setTextSelection({ from: fromPos, to: toPos }).setMark('aiEffect', { class: 'apple-ai-processing' }).run();
    } else {
      let actionText = "Writing";
      if (promptType === "summarize") actionText = "Summarizing";
      else if (promptType === "grammar") actionText = "Fixing grammar";
      
      const frames = ['❄', '❅', '❆', '✻', '✼', '❉', '❇', '❈', '❊', '❋', '✧', '✦', '✥', '❂', '✴', '✵', '✶', '✷', '✸', '✹'];
      let frameIdx = 0;
      
      const loadingText = ` ❄ ${actionText}... `;
      editor.chain().insertContentAt(insertPos, loadingText).run();
      loadingMarkFrom = insertPos;
      loadingMarkTo = insertPos + loadingText.length;
      
      animationInterval = setInterval(() => {
        frameIdx = (frameIdx + 1) % frames.length;
        try {
          editor.chain().deleteRange({ from: loadingMarkFrom, to: loadingMarkTo }).insertContentAt(loadingMarkFrom, ` ${frames[frameIdx]} ${actionText}... `).run();
        } catch {
          clearInterval(animationInterval);
        }
      }, 150);
    }

    const findAIStreamNode = (doc, targetId) => {
      let pos = -1;
      doc.descendants((node, nodePos) => {
        if (node.type.name === 'aiStream' && node.attrs.id === targetId) {
          pos = nodePos;
          return false;
        }
      });
      return pos;
    };

    const streamId = createStreamId();

    try {
      setIsAiStreaming(true);
      const abortController = new AbortController();
      const stream = chatAPI.askInline(promptType, text, instruction, abortController.signal);
      
      for await (const chunk of stream) {
        if (chunk?.type === "done" || chunk?.data === "[DONE]") {
           break;
        }
        
        let delta = chunk?.choices?.[0]?.delta?.content 
                 ?? chunk?.choices?.[0]?.message?.content 
                 ?? chunk?.delta?.content
                 ?? chunk?.content
                 ?? chunk?.text 
                 ?? chunk?.response
                 ?? chunk?.data;
                 
        if (delta === undefined || delta === null) {
           delta = typeof chunk === 'object' ? JSON.stringify(chunk) : String(chunk);
        }
                   
        streamingResult += delta;
      }
      
      // Stream is fully downloaded now!
      const finalText = streamingResult || text || " ";
      
      if (isSelectionAction) {
         editor.chain().setTextSelection({ from: fromPos, to: toPos }).unsetMark('aiEffect').run();
         editor.chain()
           .deleteRange({ from: fromPos, to: toPos })
           .insertContentAt(fromPos, { type: 'aiStream', attrs: { id: streamId, text: finalText } })
           .run();
      } else {
         clearInterval(animationInterval);
         try {
           editor.chain()
             .deleteRange({ from: loadingMarkFrom, to: loadingMarkTo })
             .insertContentAt(insertPos, { type: 'aiStream', attrs: { id: streamId, text: finalText } })
             .run();
         } catch (e) { console.error("Draft parse error", e); }
      }
      
      editor.commands.scrollIntoView();
      
      // Wait for ScrollReveal to finish before converting to Markdown
      const wordCount = finalText.split(/\s+/).length;
      const animationDurationMs = (0.4 + wordCount * 0.02) * 1000 + 400; // 400ms buffer
      
      setTimeout(() => {
          if (editor.isDestroyed) return;
          const parsedHtml = marked.parse(finalText);
          try {
             const streamNodePos = findAIStreamNode(editor.state.doc, streamId);
             if (streamNodePos !== -1) {
               const node = editor.state.doc.nodeAt(streamNodePos);
               const nodeSize = node ? node.nodeSize : 1;
               
               editor.chain()
                 .deleteRange({ from: streamNodePos, to: streamNodePos + nodeSize })
                 .insertContentAt(streamNodePos, parsedHtml)
                 .run();
             }
          } catch (e) {
             console.error("Final replace error", e);
             const streamNodePos = findAIStreamNode(editor.state.doc, streamId);
             if (streamNodePos !== -1) {
               editor.chain()
                 .insertContentAt(streamNodePos, finalText)
                 .run();
             }
          }
      }, animationDurationMs);
      
      setIsAiStreaming(false);
    } catch (err) {
      setIsAiStreaming(false);
      if (!isSelectionAction) {
          clearInterval(animationInterval);
          try {
            editor.chain().deleteRange({ from: loadingMarkFrom, to: loadingMarkTo }).run();
          } catch (e) { console.error("Draft parse error", e); }
      }
      console.error("Inline AI Stream Error:", err);

      // Handle API 413 or "too large" errors with user-friendly message
      const errorMessage = handleApiSizeError(err, promptType);
      showToast(errorMessage, "error");

      if (isSelectionAction) {
         editor.chain().setTextSelection({ from: fromPos, to: toPos }).unsetMark('aiEffect').run();
      }
    }
  };

  const handlePromptSubmit = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!promptInputVal.trim()) return;
      const { insertPos } = showPromptInput;
      const instruction = promptInputVal;

      // Validate instruction for "write" action with empty text
      const validation = validateAiInput("write", "", instruction);
      if (!validation.valid) {
        showToast(validation.message, "warning");
        setPromptInputVal("");
        setShowPromptInput(null);
        return;
      }

      setPromptInputVal("");
      setShowPromptInput(null);
      await runInlineAIStream({
        promptType: "write",
        text: "",
        instruction,
        insertPos,
      });
    } else if (e.key === "Escape") {
      setShowPromptInput(null);
      setPromptInputVal("");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[var(--color-noema-bg)] dark:bg-[var(--color-dark-bg)] text-gray-400 dark:text-gray-500 transition-colors">
        <Loading03Icon className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-full bg-[var(--color-noema-bg)] dark:bg-[var(--color-dark-bg)] transition-colors"
      
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .ProseMirror { outline: none; min-height: 100%; }
        .apple-ai-processing {
          color: transparent !important;
          background-clip: text;
          -webkit-background-clip: text;
          will-change: background-position;
          background-image: linear-gradient(
            to bottom,
            #9ca3af 0%,
            #9ca3af calc(50% - 80px),
            #a3a8b0 calc(50% - 55px),
            #b8bcc3 calc(50% - 35px),
            #d4d7dc calc(50% - 18px),
            #111827 50%,
            #d4d7dc calc(50% + 18px),
            #b8bcc3 calc(50% + 35px),
            #a3a8b0 calc(50% + 55px),
            #9ca3af calc(50% + 80px),
            #9ca3af 100%
          );
          background-attachment: fixed;
          background-size: 100vw 300vh;
          animation: viewport-shimmer 5s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }

        .dark .apple-ai-processing, .dark * .apple-ai-processing {
          background-image: linear-gradient(
            to bottom,
            #4b5563 0%,
            #4b5563 calc(50% - 80px),
            #555b65 calc(50% - 55px),
            #6b7280 calc(50% - 35px),
            #b0b5be calc(50% - 18px),
            #f9fafb 50%,
            #b0b5be calc(50% + 18px),
            #6b7280 calc(50% + 35px),
            #555b65 calc(50% + 55px),
            #4b5563 calc(50% + 80px),
            #4b5563 100%
          );
        }

        @keyframes viewport-shimmer {
          0% { background-position: 0 300vh; }
          100% { background-position: 0 -300vh; }
        }

        .apple-ai-landing {
          color: transparent !important;
          background-clip: text;
          -webkit-background-clip: text;
          will-change: background-position;
          background-image: linear-gradient(
            to bottom,
            #111827 0%,
            #111827 calc(50% - 10px),
            #9ca3af calc(50% + 20px),
            #9ca3af 100%
          );
          background-attachment: fixed;
          background-size: 100vw 300vh;
          animation: viewport-land 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .dark .apple-ai-landing {
          background-image: linear-gradient(
            to bottom,
            #f9fafb 0%,
            #f9fafb calc(50% - 10px),
            #4b5563 calc(50% + 20px),
            #4b5563 100%
          );
        }

        @keyframes viewport-land {
          0% { background-position: 0 -300vh; }
          100% { background-position: 0 300vh; }
        }
      `}} />
      {/* Top Bar */}
      <div className="flex items-center justify-between px-12 py-6 shrink-0 relative">
        {/* Left: location selector — only for new/unplaced pages */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center shrink-0 w-8 h-8 rounded-full text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors mr-2"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2]" />
          </button>
          <LocationDropdown
            variant="header"
            treeData={workspaceTree}
            selectedLocation={selectedLocation}
            selectedPath={
              selectedPath.length > 0
                ? [...selectedPath, title || "Untitled"]
                : []
            }
            onSelectLocation={handleLocationSelect}
            selectableTypes={["workspace", "folder"]}
            locked={locationLocked}
          />
        </div>

        <div className="flex items-center gap-4">
          {/* Save Status Indicator */}
          <div className="flex items-center justify-end">
            {saveStatus === "saving" && (
              <Loading03Icon className="w-4 h-4 text-gray-400 animate-spin" />
            )}
            {saveStatus === "saved" && (
              <Bookmark02Icon className="w-4 h-4 text-green-500" />
            )}
          </div>

          {/* Plain text Save button */}
          <button
            onClick={handleManualSave}
            disabled={!isDirty || saveStatus === "saving"}
            className={`text-sm font-semibold transition-all mr-4 ${!isDirty ? (pageId !== "new" && !isNewPage ? 'text-green-500 dark:text-green-400 cursor-default' : 'text-gray-400 dark:text-gray-600 cursor-not-allowed') : 'text-black dark:text-white hover:opacity-70 active:scale-95'}`}
          >
            {!isDirty && pageId !== "new" && !isNewPage ? 'Saved' : 'Save'}
          </button>

          {/* Action Menu Trigger — border-radius 10px */}
          <div className="relative" ref={actionMenuRef}>
            <button
              onClick={() => setShowActionMenu(!showActionMenu)}
              className={`w-[32px] h-[32px] flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors ${showActionMenu ? "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}
              style={{ borderRadius: "10px" }}
              title="More Actions"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {/* Action Dropdown Card */}
            {showActionMenu && (
              <div className="absolute right-0 top-[40px] bg-[#ffffff] dark:bg-[var(--color-dark-surface)] rounded-[15px] shadow-xl border border-gray-200 dark:border-[var(--color-dark-border)] py-1.5 z-[100] text-sm font-sans w-[14rem]">
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Actions
                </div>

                
                {/* Type Selection */}
                <button
                  onClick={() => {
                    setPageType("document");
                    setShowActionMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white justify-between transition-colors"
                >
                  <div className="flex items-center">
                    <TextIcon className="w-4 h-4 mr-2" /> Document
                  </div>
                  {pageType === "document" && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setPageType("code");
                    setShowActionMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white justify-between transition-colors"
                >
                  <div className="flex items-center">
                    <CodeFolderIcon className="w-4 h-4 mr-2" /> Code
                  </div>
                  {pageType === "code" && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </button>

                <div className="w-full h-px bg-gray-100 dark:bg-[var(--color-dark-border)] my-1.5" />

                {/* Font Size */}
                <div className="flex items-center justify-between px-4 py-2 text-[#8a817c] dark:text-white">
                  <span className="flex items-center">
                    <Edit02Icon className="w-4 h-4 mr-2" /> Text Size
                  </span>
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-[10px] p-0.5">
                    <button
                      onClick={() =>
                        setFontSize((prev) => Math.max(12, prev - 2))
                      }
                      className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-[8px] hover:shadow-sm transition-colors"
                    >
                      -
                    </button>
                    <span className="text-[13px] font-medium text-gray-600 dark:text-white min-w-[3ch] text-center">
                      {fontSize}
                    </span>
                    <button
                      onClick={() =>
                        setFontSize((prev) => Math.min(32, prev + 2))
                      }
                      className="w-6 h-6 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-white rounded-[8px] hover:shadow-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="w-full h-px bg-gray-100 dark:bg-[var(--color-dark-border)] my-1.5" />

                {/* Favorite */}
                <button
                  onClick={() => {
                    toggleFavorite();
                    setShowActionMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center text-[#8a817c] dark:text-white transition-colors"
                >
                  <FavouriteIcon
                    className={`w-4 h-4 mr-2 ${isFavorite ? "text-yellow-500" : ""}`}
                    variant={isFavorite ? "solid" : "stroke"}
                  />
                  {isFavorite ? "Remove Favorite" : "Add to Favorites"}
                </button>

                {/* Delete */}
                <button
                  onClick={() => {
                    setShowActionMenu(false);
                    setShowDeleteModal(true);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 flex items-center text-red-500 transition-colors"
                >
                  <Delete01Icon className="w-4 h-4 mr-2" /> Delete Page
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div
        className="flex-1 overflow-y-auto px-12 py-16 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        
      >
        <div className="max-w-4xl mx-auto h-full flex flex-col relative" ref={containerRef}>
          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus();
              }
            }}
            placeholder="New page"
            spellCheck={globalSpellCheck}
            className={`w-full text-[42px] leading-tight font-bold outline-none mb-6 transition-all duration-200 ${titleError ? "animate-shake text-red-500 placeholder-red-400 bg-transparent" : "text-gray-800 dark:text-[var(--color-dark-title)] bg-transparent placeholder-gray-300 dark:placeholder-gray-600"}`}
          />
          <EditorContent
            editor={editor}
            className={`flex-1 w-full prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none leading-relaxed ${pageType === "code" ? "font-mono" : ""} text-gray-700 dark:text-[rgb(174,172,167)]`}
            style={{ fontSize: `${fontSize}px` }}
          />

          {/* AI Streaming Indicator Pill */}
          {isAiStreaming && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-[#1f1f1f] rounded-full shadow-2xl border border-gray-200/50 dark:border-white/5 text-[13.5px] font-medium relative overflow-hidden backdrop-blur-md">
                {/* Background Shimmer (Clipped properly by overflow-hidden) */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-gray-100/40 dark:via-white/[0.03] to-transparent animate-shimmer-move" />
                
                <FeatherIcon className="w-4 h-4 text-blue-500/90 dark:text-blue-400 relative z-10" />
                
                {/* Premium Text Shimmer */}
                <span className="relative z-10 bg-gradient-to-r from-gray-600 via-blue-500 to-gray-600 dark:from-gray-400 dark:via-blue-400 dark:to-gray-400 bg-[length:200%_auto] animate-shimmer-text bg-clip-text text-transparent">
                  Writing...
                </span>
              </div>
            </div>
          )}

          {/* Floating Slash Command Menu */}
          {slashMenu.isOpen && slashMenuItems.length > 0 && (
            <div
              ref={slashMenuRef}
              style={{
                position: "absolute",
                top: `${slashMenu.y}px`,
                left: `${slashMenu.x}px`,
              }}
              className="w-64 bg-white dark:bg-[#202020] border border-gray-100 dark:border-[#333333] shadow-lg rounded-[12px] p-1.5 z-[1000] text-sm flex flex-col font-sans"
            >
              <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 tracking-wider select-none uppercase">
                AI Actions
              </div>
              {slashMenuItems.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectSlashItem(item)}
                  onMouseEnter={() =>
                    setSlashMenu((prev) => ({ ...prev, index: idx }))
                  }
                  className={`w-full text-left px-2 py-1.5 flex items-center gap-2.5 transition-colors rounded-[6px] ${
                    slashMenu.index === idx
                      ? "bg-gray-100 dark:bg-[#2f2f2f] text-gray-900 dark:text-gray-100"
                      : "text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
                  }`}
                >
                  <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
                    {item.icon}
                  </div>
                  <span className="font-medium text-[14px]">{item.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Floating Prompt Input (Ask AI to write...) */}
          {showPromptInput && (
            <div
              style={{
                position: "absolute",
                top: `${slashMenu.y}px`,
                left: `${slashMenu.x}px`,
              }}
              className="w-72 bg-white dark:bg-[#202020] border border-gray-100 dark:border-[#333333] shadow-lg rounded-[12px] p-3 z-[1000] flex flex-col gap-2 font-sans"
            >
              <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 tracking-wider select-none px-1 uppercase">
                Ask AI to write...
              </div>
              <input
                ref={promptInputRef}
                type="text"
                value={promptInputVal}
                onChange={(e) => setPromptInputVal(e.target.value)}
                onKeyDown={handlePromptSubmit}
                placeholder="Write a poem about productivity..."
                className="w-full text-[14px] bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#444444] rounded-[6px] px-3 py-2 outline-none text-gray-900 dark:text-gray-100 focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
              />
              <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500 px-1 mt-1 font-medium">
                <span><kbd className="font-sans px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#333333] border border-gray-200 dark:border-[#444444]">Enter</kbd> to Generate</span>
                <span><kbd className="font-sans px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#333333] border border-gray-200 dark:border-[#444444]">Esc</kbd> to Cancel</span>
              </div>
            </div>
          )}

          {/* Floating Selection AI Toolbar */}
          {selectionToolbar.isOpen && (
            <div
              style={{
                position: "absolute",
                top: `${selectionToolbar.y}px`,
                left: `${selectionToolbar.x}px`,
                transform: `translateX(-50%) translateY(${selectionToolbar.transformY})`,
              }}
              className="w-[192px] h-auto bg-white dark:bg-[#252525] p-2 border border-gray-200 dark:border-[#333] shadow-2xl rounded-[12px] z-[1000] flex flex-col font-sans animate-in fade-in zoom-in-95 duration-100 text-gray-700 dark:text-white"
            >
              {selectionToolbar.showUrlInput ? (
                <div className="relative">
                  <input 
                    autoFocus
                    type="url" 
                    placeholder="Paste link..." 
                    className="w-[176px] h-[34px] pt-[6px] pr-[24px] pb-[6px] pl-[8px] bg-gray-50 dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-[12px] rounded-[6px] border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-500 dark:focus:border-[#3b82f6] placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const url = e.target.value.trim();
                        if (url) {
                          editor.chain().focus().setLink({ href: url }).run();
                        }
                        setSelectionToolbar(prev => ({ ...prev, showUrlInput: false, isOpen: false }));
                      } else if (e.key === 'Escape') {
                        setSelectionToolbar(prev => ({ ...prev, showUrlInput: false }));
                      }
                    }}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-500 font-medium pointer-events-none">↵</div>
                </div>
              ) : (
                <>
                  {/* Functional Formatting (Row 1) */}
                  <div className="flex items-center justify-between">
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('heading', { level: 1 }) ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}> <Heading1 className="w-[16px] h-[16px]" /> </button>
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('heading', { level: 2 }) ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}> <Heading2 className="w-[16px] h-[16px]" /> </button>
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('heading', { level: 3 }) ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}> <Heading3 className="w-[16px] h-[16px]" /> </button>
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('bold') ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()}> <Bold className="w-[16px] h-[16px]" /> </button>
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('italic') ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()}> <Italic className="w-[16px] h-[16px]" /> </button>
                  </div>
                  
                  {/* Functional Formatting (Row 2) */}
                  <div className="flex items-center justify-between mt-1">
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('underline') ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()}> <UnderlineIcon className="w-[16px] h-[16px]" /> </button>
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('strike') ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleStrike().run()}> <Strikethrough className="w-[16px] h-[16px]" /> </button>
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('link') ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => {
                       setSelectionToolbar(prev => ({ ...prev, showUrlInput: true }));
                     }}> <LinkIcon className="w-[16px] h-[16px]" /> </button>
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] transition-colors ${editor.isActive('code') ? 'text-blue-600 bg-blue-50 dark:text-[#3b82f6] dark:bg-[#333]' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleCode().run()}> <Code className="w-[16px] h-[16px]" /> </button>
                     <button className={`p-1.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-[6px] text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors`} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetAllMarks().run()}> <RemoveFormatting className="w-[16px] h-[16px]" /> </button>
                  </div>

                  <div className="w-[160px] h-[1px] bg-gray-200 dark:bg-white/10 my-[4px] mx-[8px]" />

                  {/* Skills */}
                  <div className="px-1 py-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      AI Actions
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5 mt-1 flex-1">
                    <button onClick={() => handleSelectionToolbarAction('improve_writing')} className="text-left px-2 py-1 text-[13px] font-medium text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-[#333] hover:text-blue-600 dark:hover:text-[#3b82f6] rounded-[6px] transition-colors">Improve writing</button>
                    <button onClick={() => handleSelectionToolbarAction('grammar')} className="text-left px-2 py-1 text-[13px] font-medium text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-[#333] hover:text-blue-600 dark:hover:text-[#3b82f6] rounded-[6px] transition-colors">Proofread</button>
                    <button onClick={() => handleSelectionToolbarAction('explain')} className="text-left px-2 py-1 text-[13px] font-medium text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-[#333] hover:text-blue-600 dark:hover:text-[#3b82f6] rounded-[6px] transition-colors">Explain</button>
                    <button onClick={() => handleSelectionToolbarAction('summarize')} className="text-left px-2 py-1 text-[13px] font-medium text-gray-600 dark:text-white hover:bg-gray-100 dark:hover:bg-[#333] hover:text-blue-600 dark:hover:text-[#3b82f6] rounded-[6px] transition-colors">Summarize</button>
                  </div>
                  
                  <div className="w-[160px] h-[1px] bg-gray-200 dark:bg-white/10 my-[4px] mx-[8px]" />

                  {/* Edit with AI Input */}
                  <div className="relative">
                    <input 
                       type="text" 
                       placeholder="Edit with AI" 
                       className="w-[176px] h-[34px] pt-[6px] pr-[24px] pb-[6px] pl-[8px] bg-gray-50 dark:bg-[#1a1a1a] text-gray-900 dark:text-white text-[12px] rounded-[6px] border border-gray-200 dark:border-white/10 focus:outline-none focus:border-blue-500 dark:focus:border-[#3b82f6] placeholder-gray-400 dark:placeholder-gray-500 transition-colors"
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && e.target.value.trim()) {
                           e.preventDefault();
                           const val = e.target.value.trim();
                           const selStart = selectionToolbar.start;
                           const selEnd = selectionToolbar.end;
                           const selectedText = editor.state.doc.textBetween(selStart, selEnd, ' ');

                           // Validate input before proceeding
                           const validation = validateAiInput("write", selectedText, val);
                           if (!validation.valid) {
                             showToast(validation.message, "warning");
                             e.target.value = ''; // Clear input
                             return;
                           }

                           setSelectionToolbar((prev) => ({ ...prev, isOpen: false }));
                           editor.commands.setTextSelection(selStart);
                           runInlineAIStream({
                             promptType: "write",
                             text: selectedText,
                             instruction: val,
                             fromPos: selStart,
                             toPos: selEnd
                           });
                         }
                       }}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-gray-500 font-medium pointer-events-none">⌘E</div>
                  </div>
                </>
              )}
            </div>

          )}
        </div>
      </div>

      {/* Blocker Modal */}
      {blocker.state === "blocked" && (
        <ActionModal
          isOpen={true}
          title="Unsaved Changes"
          description="You have unsaved changes. Do you want to save them before leaving?"
          type="confirm"
          confirmText="Save changes"
          cancelText="Discard"
          onConfirm={async () => {
            const success = await savePage({ title, content });
            if (success !== false) {
              blocker.proceed();
            }
          }}
          onClose={() => {
            const draftKey = `noema_draft_${pageId || 'new'}`;
            localStorage.removeItem(draftKey);
            setOriginalData({ title, content }); // Reset dirty state
            blocker.proceed();
          }}
          isDanger={false}
        />
      )}

      {/* Custom Delete Confirmation Modal */}
      <ActionModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Page"
        type="confirm"
        description={`Are you sure you want to delete "${title || "this page"}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirmed}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  );
};

export default NoteEditor;
