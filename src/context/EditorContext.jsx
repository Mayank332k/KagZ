import React, { createContext, useState, useCallback, useRef } from 'react';

export const EditorContext = createContext();

export const EditorProvider = ({ children }) => {
  const [isPageOpen, setIsPageOpen] = useState(false);
  const appendContentRef = useRef(null);

  // Workspace tree (set by Sidebar after fetch)
  const [workspaceTree, setWorkspaceTree] = useState([]);
  // Currently selected save location
  const [selectedLocation, setSelectedLocation] = useState(null);
  // Full path to selected location e.g. ["DSA", "Trees", "Binary Tree"]
  const [selectedPath, setSelectedPath] = useState([]);
  
  // Trigger to refresh sidebar data
  const [refreshSidebarTrigger, setRefreshSidebarTrigger] = useState(0);
  const triggerSidebarRefresh = useCallback(() => {
    setRefreshSidebarTrigger(prev => prev + 1);
  }, []);

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
        appendContent,
        registerAppendContent,
        unregisterAppendContent,
        workspaceTree,
        setWorkspaceTree,
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
