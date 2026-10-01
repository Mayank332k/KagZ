import React, { createContext, useState, useCallback, useRef } from 'react';
import { workspacesAPI, foldersAPI, pagesAPI } from '../services/api';

export const EditorContext = createContext();

export const EditorProvider = ({ children }) => {
  const [isPageOpen, setIsPageOpen] = useState(false);
  const [activePage, setActivePage] = useState(null); // { id, title, content }
  const appendContentRef = useRef(null);

  // Workspace tree (set by background fetch or Sidebar)
  const [workspaceTree, setWorkspaceTree] = useState([]);
  const [isWorkspacesLoading, setIsWorkspacesLoading] = useState(false);
  const [recentPages, setRecentPages] = useState([]);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const inFlightWorkspacePromiseRef = useRef(null);

  // Currently selected save location
  const [selectedLocation, setSelectedLocation] = useState(null);
  // Full path to selected location e.g. ["DSA", "Trees", "Binary Tree"]
  const [selectedPath, setSelectedPath] = useState([]);
  
  // Trigger to refresh sidebar data
  const [refreshSidebarTrigger, setRefreshSidebarTrigger] = useState(0);
  const triggerSidebarRefresh = useCallback(() => {
    setRefreshSidebarTrigger(prev => prev + 1);
  }, []);

  // Background workspace loader - populates Workspace, Favorites, Recent, and Location Selector
  const loadWorkspaceData = useCallback(async (force = false) => {
    if (!force && workspaceTree.length > 0) {
      return { workspaceTree, recentPages, favoriteItems };
    }
    if (inFlightWorkspacePromiseRef.current) {
      return inFlightWorkspacePromiseRef.current;
    }

    setIsWorkspacesLoading(true);

    const promise = (async () => {
      try {
        const wsRes = await workspacesAPI.getAll();
        const workspaces = wsRes.data.workspaces || [];

        const treeNodes = await Promise.all(
          workspaces.map(async (ws) => {
            const folderRes = await foldersAPI.getByWorkspace(ws._id, null);
            const folders = folderRes.data.folders || [];
            const pageRes = await pagesAPI.getByWorkspace(ws._id, null);
            const rootPages = pageRes.data.pages || [];

            const folderNodes = await Promise.all(
              folders.map(async (folder) => {
                const fpRes = await pagesAPI.getByWorkspace(ws._id, folder._id);
                const folderPages = fpRes.data.pages || [];
                return {
                  id: folder._id,
                  type: "folder",
                  name: folder.name,
                  isFavorite: folder.isFavorite,
                  workspaceId: ws._id,
                  children: folderPages.map((p) => ({
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
                };
              }),
            );

            const allFolderPageIds = new Set();
            folderNodes.forEach((folder) => {
              folder.children.forEach((page) => allFolderPageIds.add(page.id));
            });
            const filteredRootPages = rootPages.filter(
              (p) => !allFolderPageIds.has(p._id),
            );

            const pageNodes = filteredRootPages.map((p) => ({
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

        // Derive Recent Pages and Favorites from Workspace tree without separate API calls
        const allPages = [];
        const favs = [];
        const traverse = (nodes) => {
          nodes.forEach((node) => {
            if (node.type === "page") {
              allPages.push(node);
            }
            if (node.isFavorite) {
              if (node.type === "workspace") {
                favs.push({ ...node, path: `/dashboard/workspace/${node.id}` });
              } else if (node.type === "folder") {
                favs.push({ ...node, path: `/dashboard/workspace/${node.workspaceId}` });
              } else {
                favs.push(node);
              }
            }
            if (node.children) traverse(node.children);
          });
        };
        traverse(treeNodes);

        allPages.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        const recents = allPages.slice(0, 6);

        setWorkspaceTree(treeNodes);
        setRecentPages(recents);
        setFavoriteItems(favs);
        return { workspaceTree: treeNodes, recentPages: recents, favoriteItems: favs };
      } catch (err) {
        console.error("Background workspace fetch failed:", err);
        throw err;
      } finally {
        setIsWorkspacesLoading(false);
        inFlightWorkspacePromiseRef.current = null;
      }
    })();

    inFlightWorkspacePromiseRef.current = promise;
    return promise;
  }, [workspaceTree, recentPages, favoriteItems]);

  // Register a callback from the NoteEditor so chat can push content
  const registerAppendContent = useCallback((fn) => {
    appendContentRef.current = fn;
  }, []);

  const unregisterAppendContent = useCallback(() => {
    appendContentRef.current = null;
  }, []);

  const appendContent = useCallback((text) => {
    if (appendContentRef.current) {
      appendContentRef.current(text);
    }
  }, []);

  return (
    <EditorContext.Provider
      value={{
        isPageOpen,
        setIsPageOpen,
        activePage,
        setActivePage,
        appendContent,
        registerAppendContent,
        unregisterAppendContent,
        workspaceTree,
        setWorkspaceTree,
        isWorkspacesLoading,
        recentPages,
        favoriteItems,
        loadWorkspaceData,
        selectedLocation,
        setSelectedLocation,
        selectedPath,
        setSelectedPath,
        refreshSidebarTrigger,
        triggerSidebarRefresh,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};
