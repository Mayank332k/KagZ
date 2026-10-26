import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * ActionListbox — Measured Unified 265px Action Menu / Listbox component (§7.1, §7.2, §7.3)
 * Exactly 265px fixed width, 6px border radius, 160ms ease-out transition,
 * 28px search input ("Search actions…"), 20x20 icon slot, 14px 400 label, 12px shortcut.
 */
const ActionListbox = ({
  isOpen = true,
  onClose,
  title,
  sections = [],
  placeholder = "Search actions…",
  className = "",
  footer,
  style = {},
}) => {
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Flatten searchable items
  const filteredSections = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sections;

    return sections
      .map((section) => ({
        ...section,
        items: section.items?.filter((item) =>
          item.label?.toLowerCase().includes(query) ||
          item.keywords?.some((k) => k.toLowerCase().includes(query))
        ),
      }))
      .filter((section) => section.items && section.items.length > 0);
  }, [sections, search]);

  const flatItems = useMemo(() => {
    const items = [];
    filteredSections.forEach((section) => {
      section.items?.forEach((item) => {
        if (!item.disabled && !item.isCustom) {
          items.push(item);
        }
      });
    });
    return items;
  }, [filteredSections]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        flatItems.length ? (prev + 1) % flatItems.length : 0
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        flatItems.length ? (prev - 1 + flatItems.length) % flatItems.length : 0
      );
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const current = flatItems[highlightedIndex];
      if (current && current.onClick) {
        current.onClick();
        onClose?.();
      }
    }
  };

  if (!isOpen) return null;

  let currentFlatCounter = -1;

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label={title || "Actions"}
      style={{
        width: "265px",
        minWidth: "180px",
        maxWidth: "calc(100vw - 24px)",
        ...style,
      }}
      className={`bg-white dark:bg-[#202020] border border-[#f0efed] dark:border-[#2c2c2b] rounded-[6px] shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] overflow-hidden transition-all duration-160 ease-out z-[9999] text-[#2c2c2b] dark:text-[#f0efed] select-none ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* 28px Search Input at top */}
      <div className="p-1.5 pb-0 border-b border-[#f0efed] dark:border-[#2c2c2b]">
        <div className="flex items-center h-7 px-2 rounded-[4px] bg-[#f4f3f3] dark:bg-[#262626] border border-[#e6e5e3] dark:border-[#383836]">
          <span className="material-symbols-outlined text-[16px] text-[#8e8b86] dark:text-[#ada9a3] mr-1.5 shrink-0 select-none">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlightedIndex(0);
            }}
            placeholder={placeholder}
            className="w-full h-full bg-transparent border-0 outline-none text-[14px] leading-[16.8px] text-[#2c2c2b] dark:text-[#f0efed] placeholder-[#a19e99] dark:placeholder-[#7d7a75]"
          />
        </div>
      </div>

      {/* Listbox Scroller (max 70vh) */}
      <div className="max-h-[70vh] overflow-y-auto pt-2 pb-1.5 px-1 [scrollbar-width:thin]">
        {filteredSections.length === 0 ? (
          <div className="py-4 text-center text-[12px] leading-[16px] text-[#a19e99] dark:text-[#7d7a75]">
            No matching actions
          </div>
        ) : (
          filteredSections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="mb-1 last:mb-0">
              {section.title && (
                <div className="px-2 py-1 text-[12px] leading-[16px] font-medium text-[#a19e99] dark:text-[#7d7a75]">
                  {section.title}
                </div>
              )}

              {section.items?.map((item, iIdx) => {
                if (item.isCustom) {
                  return (
                    <div key={item.id || iIdx} className="px-2 py-1.5">
                      {item.content}
                    </div>
                  );
                }

                currentFlatCounter++;
                const isHighlighted = currentFlatCounter === highlightedIndex;

                return (
                  <button
                    key={item.id || item.label || iIdx}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={isHighlighted}
                    disabled={item.disabled}
                    onClick={() => {
                      if (!item.disabled && item.onClick) {
                        item.onClick();
                        onClose?.();
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(currentFlatCounter)}
                    className={`w-full flex items-center justify-between min-h-[30px] px-2 py-1 rounded-[4px] transition-colors duration-160 text-left text-[14px] leading-[16.8px] font-normal cursor-pointer ${
                      item.disabled
                        ? "opacity-40 cursor-not-allowed"
                        : item.isDanger
                        ? "text-[#eb5757] hover:bg-black/[0.031] dark:hover:bg-white/[0.055]"
                        : isHighlighted
                        ? "bg-black/[0.055] dark:bg-white/[0.055] text-[#2c2c2b] dark:text-[#f0efed]"
                        : "text-[#2c2c2b] dark:text-[#f0efed] hover:bg-black/[0.031] dark:hover:bg-white/[0.055]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      {item.icon && (
                        <div className="w-5 h-5 flex items-center justify-center shrink-0 text-[#383836] dark:text-[#e6e5e3]">
                          {typeof item.icon === "string" ? (
                            <span className="material-symbols-outlined text-[18px] leading-none select-none">
                              {item.icon}
                            </span>
                          ) : (
                            item.icon
                          )}
                        </div>
                      )}
                      <span className="truncate">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2383e2] dark:bg-[#4fa7ff]" />
                      )}
                      {item.shortcut && (
                        <span className="text-[12px] leading-[16px] text-[#a19e99] dark:text-[#7d7a75] font-mono">
                          {item.shortcut}
                        </span>
                      )}
                      {item.hasSubmenu && (
                        <span className="material-symbols-outlined text-[16px] text-[#8e8b86] dark:text-[#ada9a3]">
                          chevron_right
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {sIdx < filteredSections.length - 1 && (
                <div
                  role="separator"
                  className="h-px bg-[#f0efed] dark:bg-[#2c2c2b] my-2"
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Optional Footer (e.g., Share dialog metadata) */}
      {footer && (
        <div className="border-t border-[#f0efed] dark:border-[#2c2c2b] px-3 py-2 text-[12px] leading-[16px] text-[#a19e99] dark:text-[#7d7a75] bg-[#f9f8f7] dark:bg-[#191919]">
          {footer}
        </div>
      )}
    </div>
  );
};

export default ActionListbox;
