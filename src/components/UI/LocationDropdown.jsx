import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { ChevronRight, Plus } from "lucide-react";
import { DeskIcon, Folder01Icon, BookOpen01Icon, ArrowDown01Icon } from "hugeicons-react";



const NodeIcon = ({ type, className = "w-3.5 h-3.5 shrink-0 text-gray-500" }) => {
  if (type === "workspace") return <DeskIcon className={className} />;
  if (type === "folder") return <Folder01Icon className={className} />;
  return <BookOpen01Icon className={className} />;
};

const PanelHeader = ({ breadcrumb }) => (
  <div className="px-2 pt-1.5 pb-2 border-b border-gray-100 dark:border-white/[0.12] mb-1">
    <div className="flex items-center gap-1 flex-wrap">
      {breadcrumb.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="w-2.5 h-2.5 shrink-0 text-gray-400 dark:text-white/50" />}
          <span className={`text-[10px] font-semibold tracking-wider uppercase ${i === breadcrumb.length - 1 ? "text-gray-700 dark:text-[rgba(174,172,167,0.9)]" : "text-gray-400 dark:text-white/40"}`}>
            {crumb}
          </span>
        </React.Fragment>
      ))}
    </div>
  </div>
);

// Nested panel — spawns to the right of a hovered row
const NestedPanel = ({ node, anchorEl, onSelect, onClose, breadcrumb, selectableTypes }) => {
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredAnchor, setHoveredAnchor] = useState(null);
  const hoverTimerRef = useRef(null);

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const panelWidth = 210;
    const left = rect.right + 6 + panelWidth > window.innerWidth
      ? rect.left - panelWidth - 6
      : rect.right + 6;
    setPos({ top: rect.top, left });
  }, [anchorEl]);

  const handleHover = (e, child) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    const el = e.currentTarget;
    if (child.children && child.children.length > 0) {
      hoverTimerRef.current = setTimeout(() => {
        setHoveredId(child.id);
        setHoveredNode(child);
        setHoveredAnchor(el);
      }, 130);
    } else {
      setHoveredId(null);
      setHoveredNode(null);
      setHoveredAnchor(null);
    }
  };

  const thisBreadcrumb = [...breadcrumb, node.name];

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className="fixed bg-white dark:bg-[#232323] border border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[8px]"
      style={{ top: pos.top, left: pos.left, zIndex: 99999 + breadcrumb.length, minWidth: 210, padding: "4px" }}
    >
      <PanelHeader breadcrumb={thisBreadcrumb} />

      {(node.children || []).map((child) => {
        const hasKids = child.children && child.children.length > 0;
        const isHov = hoveredId === child.id;
        const canSelect = !selectableTypes || selectableTypes.includes(child.type);
        const canSave = canSelect && (child.type === "workspace" || child.type === "folder");
        const childPath = [...thisBreadcrumb, child.name];

        return (
          <div
            key={child.id}
            className={`group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${isHov ? "bg-gray-100 dark:bg-white/[0.06]" : "hover:bg-gray-50 dark:hover:bg-white/[0.04]"}`}
            onMouseEnter={(e) => handleHover(e, child)}
            onMouseLeave={() => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }}
            onClick={() => { if (!hasKids && canSelect) { onSelect(child, childPath); onClose(); } }}
          >
            <NodeIcon type={child.type} />
            <span className="flex-1 truncate text-[13px] text-gray-600 dark:text-[rgb(174,172,167)] group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              {child.name}
            </span>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {canSave && (
                <button
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white"
                  onClick={(e) => { e.stopPropagation(); onSelect(child, childPath); onClose(); }}
                  title="Save here"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              {hasKids && <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-600" />}
            </div>
          </div>
        );
      })}

      {hoveredId && hoveredNode && hoveredAnchor && (
        <NestedPanel
          node={hoveredNode}
          anchorEl={hoveredAnchor}
          onSelect={onSelect}
          onClose={onClose}
          breadcrumb={thisBreadcrumb}
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
    setPos({ top: rect.bottom + 6, left: rect.left });
  }, [anchorEl]);

  useEffect(() => {
    const handler = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        !anchorEl?.contains(e.target)
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
      }, 130);
    } else {
      setHoveredId(null);
      setHoveredNode(null);
      setHoveredAnchor(null);
    }
  };

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className="fixed bg-white dark:bg-[#232323] border border-gray-200 dark:border-white/10 shadow-lg dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-[8px]"
      style={{ top: pos.top, left: pos.left, zIndex: 99999, minWidth: 220, maxWidth: 300, maxHeight: "60vh", overflowY: "auto", padding: "4px" }}
    >
      <PanelHeader breadcrumb={["Save Location", "Workspaces"]} />

      {treeData.length === 0 && (
        <div style={{ fontSize: 12, color: "#666", textAlign: "center", padding: "12px 8px" }}>
          No workspaces found
        </div>
      )}

      {treeData.map((node) => {
        const hasKids = node.children && node.children.length > 0;
        const isHov = hoveredId === node.id;
        const canSelect = !selectableTypes || selectableTypes.includes(node.type);
        const canSave = canSelect && (node.type === "workspace" || node.type === "folder");
        const nodePath = [node.name];

        return (
          <div
            key={node.id}
            className={`group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${isHov ? "bg-gray-100 dark:bg-white/[0.06]" : "hover:bg-gray-50 dark:hover:bg-white/[0.04]"}`}
            onMouseEnter={(e) => handleHover(e, node)}
            onMouseLeave={() => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }}
            onClick={() => { if (!hasKids && canSelect) { onSelect(node, nodePath); onClose(); } }}
          >
            <NodeIcon type={node.type} />
            <span className="flex-1 truncate text-[13px] text-gray-600 dark:text-[rgb(174,172,167)] group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
              {node.name}
            </span>
            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {canSave && (
                <button
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white"
                  onClick={(e) => { e.stopPropagation(); onSelect(node, nodePath); onClose(); }}
                  title="Save here"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              {hasKids && <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-600" />}
            </div>
          </div>
        );
      })}

      {hoveredId && hoveredNode && hoveredAnchor && (
        <NestedPanel
          node={hoveredNode}
          anchorEl={hoveredAnchor}
          onSelect={onSelect}
          onClose={onClose}
          breadcrumb={["Save Location"]}
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
                <ChevronRight className="w-3 h-3 shrink-0 text-gray-400 dark:text-gray-600" />
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
                <div className={`flex items-center justify-center ${i === selectedPath.length - 1 ? "text-blue-500 bg-blue-50 dark:bg-blue-500/20 dark:text-blue-400 w-6 h-6 rounded" : "text-gray-500 dark:text-gray-400"}`}>
                   <NodeIcon type={type} className={i === selectedPath.length - 1 ? "w-3.5 h-3.5 shrink-0" : "w-4 h-4 shrink-0"} />
                </div>
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

  const chevron = <ArrowDown01Icon aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 ${locked ? "text-gray-400 dark:text-gray-500" : "text-gray-500 dark:text-white"}`} />;

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
