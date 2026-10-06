import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Blockchain04Icon,
  Folder01Icon,
  File02Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";

const NodeIcon = ({ type, className = "", size = 15 }) => {
  if (type === "workspace") {
    return (
      <HugeiconsIcon
        icon={Blockchain04Icon}
        size={size}
        className={`text-gray-500 dark:text-neutral-400 shrink-0 ${className}`}
      />
    );
  }
  if (type === "folder") {
    return (
      <HugeiconsIcon
        icon={Folder01Icon}
        size={size}
        className={`text-amber-500/90 dark:text-amber-400/90 shrink-0 ${className}`}
      />
    );
  }
  return (
    <HugeiconsIcon
      icon={File02Icon}
      size={size}
      className={`text-gray-400 dark:text-neutral-400 shrink-0 ${className}`}
    />
  );
};

// ── Cascading Multi-Column Popover ───────────────────────────────────────────
const CascadingMenu = ({
  treeData = [],
  anchorEl,
  onSelect,
  onClose,
  selectedLocation,
  selectableTypes,
  variant,
}) => {
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Filter workspaces
  const workspaces = useMemo(() => {
    return treeData.filter(
      (node) => !selectableTypes || selectableTypes.includes(node.type) || node.type === "workspace"
    );
  }, [treeData, selectableTypes]);

  // Initial state: starts with only workspaces; folders appear on hover!
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);

  // Active workspace object and its contents
  const activeWorkspace = useMemo(() => {
    if (!activeWorkspaceId) return null;
    return workspaces.find((w) => (w._id || w.id) === activeWorkspaceId) || null;
  }, [workspaces, activeWorkspaceId]);

  const activeFolders = useMemo(() => {
    if (!activeWorkspace?.children) return [];
    return activeWorkspace.children.filter((child) => child.type === "folder");
  }, [activeWorkspace]);

  const activeRootPages = useMemo(() => {
    if (!activeWorkspace?.children) return [];
    return activeWorkspace.children.filter((child) => child.type === "page");
  }, [activeWorkspace]);

  // Active folder object and its contents
  const activeFolder = useMemo(() => {
    if (!activeFolders.length || !activeFolderId) return null;
    return activeFolders.find((f) => (f._id || f.id) === activeFolderId) || null;
  }, [activeFolders, activeFolderId]);

  const activeSubfolders = useMemo(() => {
    if (!activeFolder?.children) return [];
    return activeFolder.children.filter((child) => child.type === "folder");
  }, [activeFolder]);

  const activePages = useMemo(() => {
    if (!activeFolder?.children) return [];
    return activeFolder.children.filter((child) => child.type === "page");
  }, [activeFolder]);

  // Calculate number of visible columns
  const columnCount = 1 + (activeWorkspace ? 1 : 0) + (activeFolder ? 1 : 0);

  // Position calculations
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const colWidth = 215;
    const totalWidth = colWidth * columnCount;

    let left = rect.left;
    if (left + totalWidth > window.innerWidth - 16) {
      left = Math.max(16, window.innerWidth - totalWidth - 16);
    }

    let top = rect.bottom + 6;
    if (top + 330 > window.innerHeight - 16) {
      top = Math.max(16, rect.top - 330 - 6);
    }

    setPos({ top, left });
  }, [anchorEl, columnCount]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  // Close handlers (outside click, escape key)
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        !anchorEl?.contains(e.target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorEl, onClose]);

  const isNodeSelected = (node) => {
    if (!selectedLocation) return false;
    return (selectedLocation._id || selectedLocation.id) === (node._id || node.id);
  };

  const handlePageClick = (page, path) => {
    if (selectableTypes?.includes("page")) {
      onSelect(page, path);
      onClose();
      return;
    }
    const pageTargetId = page.id || page._id;
    if (pageTargetId) {
      if (selectedLocation && (selectedLocation.id || selectedLocation._id) === pageTargetId) {
        onClose();
        return;
      }
      navigate(page.path || `/dashboard/page/${pageTargetId}`);
      onClose();
    }
  };

  return ReactDOM.createPortal(
    <div
      ref={containerRef}
      className="fixed flex flex-row items-stretch bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.1] shadow-[0_20px_50px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.65)] rounded-[14px] overflow-hidden z-[99999] animate-in fade-in zoom-in-95 duration-150 origin-top-left"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* ── Column 1: Workspaces ── */}
      <div className="w-[215px] min-w-[215px] max-w-[230px] flex flex-col p-1.5 max-h-[320px]">
        <div className="px-2.5 py-1.5 border-b border-black/[0.05] dark:border-white/[0.06] mb-1 flex items-center justify-between">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-400 select-none">
            Workspaces
          </span>
          <span className="text-[10px] text-gray-400 dark:text-neutral-500 font-mono">
            {workspaces.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
          {workspaces.length === 0 ? (
            <div className="py-6 px-2 text-[12px] text-gray-400 dark:text-neutral-500 text-center select-none">
              No workspaces found
            </div>
          ) : (
            workspaces.map((ws) => {
              const wsId = ws._id || ws.id;
              const isHov = activeWorkspaceId === wsId;
              const isSelected = isNodeSelected(ws);
              const folders = (ws.children || []).filter((c) => c.type === "folder");
              const pages = (ws.children || []).filter((c) => c.type === "page");
              const hasContent = folders.length > 0 || pages.length > 0;

              return (
                <div
                  key={wsId}
                  className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-pointer text-[12.5px] select-none transition-colors ${
                    isHov
                      ? "bg-black/[0.06] dark:bg-white/[0.1] text-gray-900 dark:text-white font-medium"
                      : "text-gray-700 dark:text-neutral-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                  }`}
                  onMouseEnter={() => {
                    setActiveWorkspaceId(wsId);
                    setActiveFolderId(null);
                  }}
                  onClick={() => {
                    onSelect(ws, [ws.name]);
                    onClose();
                  }}
                >
                  <NodeIcon type="workspace" />
                  <span className="flex-1 truncate leading-tight">{ws.name}</span>

                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && (
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        size={14}
                        className="text-blue-500"
                      />
                    )}
                    {hasContent && (
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        size={13}
                        className={`transition-colors ${
                          isHov
                            ? "text-gray-700 dark:text-white"
                            : "text-gray-400 dark:text-neutral-500"
                        }`}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Column 2: Folders of Active Workspace (Appears on Workspace Hover) ── */}
      {activeWorkspace && (
        <div className="w-[215px] min-w-[215px] max-w-[230px] flex flex-col p-1.5 max-h-[320px] border-l border-black/[0.06] dark:border-white/[0.08] bg-black/[0.015] dark:bg-white/[0.01] animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="px-2.5 py-1.5 border-b border-black/[0.05] dark:border-white/[0.06] mb-1 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-400 select-none truncate pr-2">
              {activeWorkspace?.name || "Folders"}
            </span>
            <button
              type="button"
              onClick={() => {
                onSelect(activeWorkspace, [activeWorkspace.name]);
                onClose();
              }}
              className="text-[10.5px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
              title={`Select ${activeWorkspace?.name} root`}
            >
              Select
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
            {activeFolders.length === 0 && activeRootPages.length === 0 ? (
              <div className="py-6 px-2 text-[12px] text-gray-400 dark:text-neutral-500 text-center select-none">
                No folders in workspace
              </div>
            ) : (
              <>
                {/* Folders List */}
                {activeFolders.map((folder) => {
                  const folderId = folder._id || folder.id;
                  const isHov = activeFolderId === folderId;
                  const isSelected = isNodeSelected(folder);
                  const pages = (folder.children || []).filter((c) => c.type === "page");
                  const subfolders = (folder.children || []).filter((c) => c.type === "folder");
                  const hasPages = pages.length > 0 || subfolders.length > 0;

                  return (
                    <div
                      key={folderId}
                      className={`group relative flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-pointer text-[12.5px] select-none transition-colors ${
                        isHov
                          ? "bg-black/[0.06] dark:bg-white/[0.1] text-gray-900 dark:text-white font-medium"
                          : "text-gray-700 dark:text-neutral-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                      }`}
                      onMouseEnter={() => setActiveFolderId(folderId)}
                      onClick={() => {
                        onSelect(folder, [activeWorkspace.name, folder.name]);
                        onClose();
                      }}
                    >
                      <NodeIcon type="folder" />
                      <span className="flex-1 truncate leading-tight">{folder.name}</span>

                      <div className="flex items-center gap-1 shrink-0">
                        {isSelected && (
                          <HugeiconsIcon
                            icon={CheckmarkCircle01Icon}
                            size={14}
                            className="text-blue-500"
                          />
                        )}
                        {hasPages && (
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            size={13}
                            className={`transition-colors ${
                              isHov
                                ? "text-gray-700 dark:text-white"
                                : "text-gray-400 dark:text-neutral-500"
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Workspace Root Pages (if any) */}
                {activeRootPages.length > 0 && (
                  <div className="pt-2">
                    <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">
                      Pages
                    </div>
                    {activeRootPages.map((page) => {
                      const pageId = page._id || page.id;
                      const isSelected = isNodeSelected(page);

                      return (
                        <div
                          key={pageId}
                          className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-pointer text-[12.5px] select-none transition-colors text-gray-700 dark:text-neutral-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-white"
                          onMouseEnter={() => setActiveFolderId(null)}
                          onClick={() =>
                            handlePageClick(page, [
                              activeWorkspace.name,
                              page.name || "Untitled",
                            ])
                          }
                        >
                          <NodeIcon type="page" />
                          <span className="flex-1 truncate leading-tight">
                            {page.name || "Untitled"}
                          </span>
                          {isSelected && (
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              size={14}
                              className="text-blue-500 shrink-0"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Column 3: Pages of Active Folder (Appears on Folder Hover) ── */}
      {activeFolder && (
        <div className="w-[215px] min-w-[215px] max-w-[230px] flex flex-col p-1.5 max-h-[320px] border-l border-black/[0.06] dark:border-white/[0.08] bg-black/[0.025] dark:bg-white/[0.02] animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="px-2.5 py-1.5 border-b border-black/[0.05] dark:border-white/[0.06] mb-1 flex items-center justify-between">
            <span className="text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-400 select-none truncate pr-2">
              {activeFolder?.name || "Pages"}
            </span>
            <button
              type="button"
              onClick={() => {
                onSelect(activeFolder, [activeWorkspace.name, activeFolder.name]);
                onClose();
              }}
              className="text-[10.5px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
              title={`Select ${activeFolder?.name} folder`}
            >
              Select
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-0.5 pr-0.5">
            {/* Subfolders if any */}
            {activeSubfolders.map((sub) => {
              const subId = sub._id || sub.id;
              const isSelected = isNodeSelected(sub);

              return (
                <div
                  key={subId}
                  className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-pointer text-[12.5px] select-none transition-colors text-gray-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white"
                  onClick={() => {
                    onSelect(sub, [
                      activeWorkspace.name,
                      activeFolder.name,
                      sub.name,
                    ]);
                    onClose();
                  }}
                >
                  <NodeIcon type="folder" />
                  <span className="flex-1 truncate leading-tight">{sub.name}</span>
                  {isSelected && (
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={14}
                      className="text-blue-500 shrink-0"
                    />
                  )}
                </div>
              );
            })}

            {/* Pages inside this folder */}
            {activePages.map((page) => {
              const pageId = page._id || page.id;
              const isSelected = isNodeSelected(page);

              return (
                <div
                  key={pageId}
                  className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] cursor-pointer text-[12.5px] select-none transition-colors text-gray-700 dark:text-neutral-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-gray-900 dark:hover:text-white"
                  onClick={() =>
                    handlePageClick(page, [
                      activeWorkspace.name,
                      activeFolder.name,
                      page.name || "Untitled",
                    ])
                  }
                >
                  <NodeIcon type="page" />
                  <span className="flex-1 truncate leading-tight">
                    {page.name || "Untitled"}
                  </span>
                  {isSelected && (
                    <HugeiconsIcon
                      icon={CheckmarkCircle01Icon}
                      size={14}
                      className="text-blue-500 shrink-0"
                    />
                  )}
                </div>
              );
            })}

            {activeSubfolders.length === 0 && activePages.length === 0 && (
              <div className="py-6 px-2 text-[12px] text-gray-400 dark:text-neutral-500 text-center select-none">
                No pages in this folder
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

// ── Main LocationDropdown Component ──────────────────────────────────────────
const LocationDropdown = ({
  treeData = [],
  onSelectLocation,
  selectedLocation = null,
  selectedPath = [],
  variant = "sidebar",
  selectableTypes = null,
  locked = false,
  isLoading = false,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  const hasSelection = selectedLocation !== null && selectedPath.length > 0;
  const isHeader = variant === "header";

  const handleSelect = useCallback(
    (node, path) => {
      onSelectLocation?.(node, path);
      setOpen(false);
    },
    [onSelectLocation]
  );

  const handleClose = useCallback(() => setOpen(false), []);

  // Loading state in Note header
  if (isLoading && isHeader) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-gray-400 dark:text-neutral-500 animate-pulse select-none font-normal">
        <div className="w-3.5 h-3.5 rounded bg-gray-200 dark:bg-white/10 shrink-0" />
        <span className="truncate">Loading locations...</span>
      </div>
    );
  }

  // ── Header Breadcrumbs Trigger (Borderless & Backgroundless) ──
  if (isHeader) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (!locked) setOpen((prev) => !prev);
          }}
          disabled={locked}
          title={locked ? "Page Location" : "Change location"}
          className={`group flex items-center gap-1 text-[12.5px] select-none transition-colors outline-none bg-transparent border-0 p-1 -ml-1 rounded-[6px] ${
            locked
              ? "cursor-default opacity-85"
              : "cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          }`}
        >
          {hasSelection ? (
            <div className="flex items-center gap-1 flex-wrap">
              {selectedPath.map((crumb, idx) => {
                const isLast = idx === selectedPath.length - 1;
                return (
                  <React.Fragment key={idx}>
                    {idx > 0 && (
                      <span className="text-gray-300 dark:text-neutral-600 text-[11px] select-none mx-0.5">
                        /
                      </span>
                    )}
                    <span
                      className={`flex items-center gap-1 ${
                        isLast
                          ? "font-medium text-gray-800 dark:text-gray-200"
                          : "font-normal text-gray-500 dark:text-neutral-400"
                      }`}
                    >
                      {crumb}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <span className="text-gray-400 dark:text-neutral-500 font-normal hover:text-gray-700 dark:hover:text-neutral-300 transition-colors">
              Select location
            </span>
          )}

          {!locked && (
            <span className="material-symbols-outlined text-[15px] leading-none text-gray-400 dark:text-neutral-500 group-hover:text-gray-600 dark:group-hover:text-gray-300 ml-0.5 transition-colors shrink-0">
              keyboard_arrow_down
            </span>
          )}
        </button>

        {!locked && open && triggerRef.current && (
          <CascadingMenu
            treeData={treeData}
            anchorEl={triggerRef.current}
            onSelect={handleSelect}
            onClose={handleClose}
            selectedLocation={selectedLocation}
            selectableTypes={selectableTypes}
            variant={variant}
          />
        )}
      </>
    );
  }

  // ── Modal / Sidebar Trigger ──
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 text-[13px] rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] hover:bg-gray-100/60 dark:hover:bg-white/[0.05] transition-colors cursor-pointer outline-none select-none text-left"
      >
        <span
          className={`truncate ${
            hasSelection
              ? "text-gray-800 dark:text-gray-100 font-medium"
              : "text-gray-400 dark:text-neutral-500"
          }`}
        >
          {hasSelection ? selectedPath.join(" / ") : "Select location..."}
        </span>
        <span className="material-symbols-outlined text-[16px] text-gray-400 leading-none shrink-0 ml-2">
          keyboard_arrow_down
        </span>
      </button>

      {open && triggerRef.current && (
        <CascadingMenu
          treeData={treeData}
          anchorEl={triggerRef.current}
          onSelect={handleSelect}
          onClose={handleClose}
          selectedLocation={selectedLocation}
          selectableTypes={selectableTypes}
          variant={variant}
        />
      )}
    </>
  );
};

export default LocationDropdown;
