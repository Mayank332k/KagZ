import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";




const NodeIcon = ({ type, className = "" }) => {
  if (type === "workspace") return (
    <span className={`material-symbols-outlined text-[15px] leading-none select-none text-gray-500 dark:text-neutral-400 shrink-0 ${className}`}>
      space_dashboard
    </span>
  );
  if (type === "folder") return (
    <span className={`material-symbols-outlined text-[15px] leading-none select-none text-amber-500/90 dark:text-amber-400/90 shrink-0 ${className}`}>
      folder
    </span>
  );
  return (
    <span className={`material-symbols-outlined text-[15px] leading-none select-none text-gray-400 dark:text-neutral-500 shrink-0 ${className}`}>
      description
    </span>
  );
};

const PanelHeader = ({ title }) => (
  <div className="px-2 pt-1 pb-1.5 border-b border-black/[0.05] dark:border-white/[0.06] mb-1">
    <span className="text-[10px] font-medium tracking-wider uppercase text-gray-400 dark:text-neutral-500 select-none">
      {title}
    </span>
  </div>
);

// Nested panel — spawns to the right of a hovered row
const NestedPanel = ({ node, anchorEl, onSelect, onClose, selectableTypes }) => {
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredAnchor, setHoveredAnchor] = useState(null);
  const hoverTimerRef = useRef(null);

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const panelWidth = 200;
    const left = rect.right + 4 + panelWidth > window.innerWidth
      ? rect.left - panelWidth - 4
      : rect.right + 4;
    const top = Math.max(8, Math.min(rect.top - 4, window.innerHeight - 300));
    setPos({ top, left });
  }, [anchorEl]);

  const handleHover = (e, child) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const el = e.currentTarget;
    if (child.children && child.children.length > 0) {
      hoverTimerRef.current = setTimeout(() => {
        setHoveredId(child.id);
        setHoveredNode(child);
        setHoveredAnchor(el);
      }, 100);
    } else {
      setHoveredId(null);
      setHoveredNode(null);
      setHoveredAnchor(null);
    }
  };

  const children = (node.children || []).filter(
    (child) => !selectableTypes || selectableTypes.includes(child.type)
  );

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className="nested-location-panel fixed bg-white/95 dark:bg-[#181818]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] rounded-[10px] p-1"
      style={{ top: pos.top, left: pos.left, zIndex: 99999, minWidth: 190, maxWidth: 240 }}
    >
      <PanelHeader title={node.name} />

      {children.length === 0 ? (
        <div className="py-2 px-2 text-[11.5px] text-gray-400 dark:text-neutral-500 text-center select-none">
          Empty folder
        </div>
      ) : (
        children.map((child) => {
          const hasKids = child.children && child.children.length > 0;
          const isHov = hoveredId === child.id;
          const canSelect = !selectableTypes || selectableTypes.includes(child.type);
          const canSave = canSelect && (child.type === "workspace" || child.type === "folder");

          return (
            <div
              key={child.id}
              className={`group relative flex items-center gap-2 rounded-[6px] px-2 py-1.5 cursor-pointer transition-colors text-[12px] ${
                isHov
                  ? "bg-black/[0.05] dark:bg-white/[0.08] text-gray-900 dark:text-white"
                  : "text-gray-700 dark:text-neutral-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              }`}
              onMouseEnter={(e) => handleHover(e, child)}
              onMouseLeave={() => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }}
              onClick={() => { if (canSelect) { onSelect(child, [node.name, child.name]); onClose(); } }}
            >
              <NodeIcon type={child.type} />
              <span className="flex-1 truncate font-normal leading-tight">
                {child.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {canSave && (
                  <button
                    type="button"
                    className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onSelect(child, [node.name, child.name]); onClose(); }}
                    title="Select this location"
                  >
                    <span className="material-symbols-outlined text-[13px] leading-none select-none">add</span>
                  </button>
                )}
                {hasKids && (
                  <span className="material-symbols-outlined text-[13px] leading-none select-none text-gray-400 dark:text-neutral-500">
                    chevron_right
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}

      {hoveredId && hoveredNode && hoveredAnchor && (
        <NestedPanel
          node={hoveredNode}
          anchorEl={hoveredAnchor}
          onSelect={onSelect}
          onClose={onClose}
          selectableTypes={selectableTypes}
        />
      )}
    </div>,
    document.body
  );
};

// Root panel — opens below the trigger
const RootPanel = ({ treeData, anchorEl, onSelect, onClose, selectableTypes }) => {
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredAnchor, setHoveredAnchor] = useState(null);
  const hoverTimerRef = useRef(null);

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const top = rect.bottom + 4;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 220));
    setPos({ top, left });
  }, [anchorEl]);

  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        !anchorEl?.contains(e.target) &&
        !e.target.closest('.nested-location-panel')
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorEl, onClose]);

  const handleHover = (e, node) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const el = e.currentTarget;
    if (node.children && node.children.length > 0) {
      hoverTimerRef.current = setTimeout(() => {
        setHoveredId(node.id);
        setHoveredNode(node);
        setHoveredAnchor(el);
      }, 100);
    } else {
      setHoveredId(null);
      setHoveredNode(null);
      setHoveredAnchor(null);
    }
  };

  const filteredTree = treeData.filter((node) => !selectableTypes || selectableTypes.includes(node.type));

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className="fixed bg-white/95 dark:bg-[#181818]/95 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] rounded-[10px] p-1"
      style={{ top: pos.top, left: pos.left, zIndex: 99999, minWidth: 200, maxWidth: 250, maxHeight: "60vh", overflowY: "auto" }}
    >
      <PanelHeader title="Workspaces" />

      {filteredTree.length === 0 ? (
        <div className="py-3 px-2 text-[11.5px] text-gray-400 dark:text-neutral-500 text-center select-none">
          No workspaces found
        </div>
      ) : (
        filteredTree.map((node) => {
          const hasKids = node.children && node.children.length > 0;
          const isHov = hoveredId === node.id;
          const canSelect = !selectableTypes || selectableTypes.includes(node.type);
          const canSave = canSelect && (node.type === "workspace" || node.type === "folder");

          return (
            <div
              key={node.id}
              className={`group relative flex items-center gap-2 rounded-[6px] px-2 py-1.5 cursor-pointer transition-colors text-[12px] ${
                isHov
                  ? "bg-black/[0.05] dark:bg-white/[0.08] text-gray-900 dark:text-white"
                  : "text-gray-700 dark:text-neutral-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              }`}
              onMouseEnter={(e) => handleHover(e, node)}
              onMouseLeave={() => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }}
              onClick={() => { if (canSelect) { onSelect(node, [node.name]); onClose(); } }}
            >
              <NodeIcon type={node.type} />
              <span className="flex-1 truncate font-normal leading-tight">
                {node.name}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {canSave && (
                  <button
                    type="button"
                    className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onSelect(node, [node.name]); onClose(); }}
                    title="Select this workspace"
                  >
                    <span className="material-symbols-outlined text-[13px] leading-none select-none">add</span>
                  </button>
                )}
                {hasKids && (
                  <span className="material-symbols-outlined text-[13px] leading-none select-none text-gray-400 dark:text-neutral-500">
                    chevron_right
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}

      {hoveredId && hoveredNode && hoveredAnchor && (
        <NestedPanel
          node={hoveredNode}
          anchorEl={hoveredAnchor}
          onSelect={onSelect}
          onClose={onClose}
          selectableTypes={selectableTypes}
        />
      )}
    </div>,
    document.body
  );
};

// ── Main export ──────────────────────────────────────────────────────────────
const LocationDropdown = ({
  treeData = [],
  onSelectLocation,
  selectedLocation = null,   // the selected node object
  selectedPath = [],         // ["DSA", "Trees", "Binary Tree"]
  variant = "sidebar",
  selectableTypes = null,
  locked = false,
  isLoading = false,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  const hasSelection = selectedLocation !== null && selectedPath.length > 0;

  const handleSelect = useCallback((node, path) => {
    onSelectLocation?.(node, path);
    setOpen(false);
  }, [onSelectLocation]);

  const handleClose = useCallback(() => setOpen(false), []);

  const isSidebar = variant === "sidebar";

  const isHeader = variant === "header";

  if (isLoading && isHeader) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gray-100/70 dark:bg-white/5 animate-pulse text-[13px] text-gray-400 dark:text-gray-500 select-none">
        <div className="w-3.5 h-3.5 rounded bg-gray-200 dark:bg-white/10 shrink-0" />
        <span className="truncate">Select location...</span>
      </div>
    );
  }

  const selectedContent = hasSelection ? (
    <div className={`flex items-center flex-wrap ${isHeader ? "gap-1.5 text-[15px]" : ""}`}>
      {selectedPath.map((crumb, i) => {
        let type = "page";
        if (isHeader) {
          let currentNodes = treeData;
          for (let j = 0; j <= i; j++) {
            const node = currentNodes?.find((n) => n.name === selectedPath[j]);
            if (node) {
              type = node.type;
              currentNodes = node.children;
            } else {
              type = (j === selectedPath.length - 1) ? "page" : "folder";
              break;
            }
          }
        }

        return (
          <React.Fragment key={i}>
            {i > 0 && (
              isHeader ? (
                <span className="text-gray-300 dark:text-white/20 mx-1">/</span>
              ) : (
                <span className="material-symbols-outlined text-[12px] leading-none select-none shrink-0 text-gray-400 dark:text-gray-600">chevron_right</span>
              )
            )}
            <span className={`flex items-center ${isHeader ? "gap-1.5" : ""} ${
              locked
                ? (i === selectedPath.length - 1
                  ? "text-gray-800 dark:text-gray-200 font-medium"
                  : "text-gray-500 dark:text-gray-400")
                : "text-black dark:text-white"
            }`}>
              {isHeader && (
                <NodeIcon type={type} />
              )}
              {crumb}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  ) : (
    <>
      <span className="truncate max-w-[200px]">Select location</span>
    </>
  );

  const chevron = <span aria-hidden="true" className={`material-symbols-outlined text-[14px] leading-none select-none shrink-0 ${locked ? "text-gray-400 dark:text-gray-500" : "text-gray-500 dark:text-white"}`}>keyboard_arrow_down</span>;

  // ── STATE 2: location selected; existing pages may lock this breadcrumb ──
  if (hasSelection) {
    return (
      <>
        <button
          ref={triggerRef}
          className={
            isSidebar
              ? `flex items-center gap-1 pl-2 pr-2 py-1 mt-3 mb-1 text-[13px] font-medium tracking-wide select-none ${locked ? "cursor-default" : "cursor-pointer"} bg-transparent border-none outline-none`
              : `flex items-center gap-1.5 text-[13px] font-medium select-none ${locked ? "cursor-default" : "cursor-pointer"} bg-transparent border-none outline-none`
          }
          onClick={() => { if (!locked) setOpen((p) => !p); }}
          aria-disabled={locked}
          title={locked ? "Location" : "Change location"}
        >
          {selectedContent}
          {chevron}
        </button>

        {!locked && open && triggerRef.current && (
          <RootPanel
            treeData={treeData}
            anchorEl={triggerRef.current}
            onSelect={handleSelect}
            onClose={handleClose}
            selectableTypes={selectableTypes}
          />
        )}
      </>
    );
  }

  // ── STATE 1: no selection → interactive trigger ──
  const triggerCls = isSidebar
    ? `group flex items-center gap-1 pl-2 pr-2 py-1 mt-3 mb-1 text-[13px] font-medium tracking-wide cursor-pointer ${locked ? "text-[#8a817c] dark:text-[#aeaca7] hover:text-gray-900 dark:hover:text-gray-200" : "text-black hover:text-gray-700 dark:text-white dark:hover:text-gray-200"} transition-colors bg-transparent border-none outline-none w-full`
    : `group flex items-center gap-1.5 cursor-pointer text-[13px] font-medium ${locked ? "text-gray-500 dark:text-[#aeaca7] hover:text-gray-800 dark:hover:text-gray-200" : "text-black hover:text-gray-700 dark:text-white dark:hover:text-gray-200"} transition-colors bg-transparent border-none outline-none`;

  return (
    <>
      <button
        ref={triggerRef}
        className={triggerCls}
        onClick={() => setOpen((p) => !p)}
      >
        {selectedContent}
        {chevron}
      </button>

      {open && triggerRef.current && (
        <RootPanel
          treeData={treeData}
          anchorEl={triggerRef.current}
          onSelect={handleSelect}
          onClose={handleClose}
          selectableTypes={selectableTypes}
        />
      )}
    </>
  );
};

export default LocationDropdown;
