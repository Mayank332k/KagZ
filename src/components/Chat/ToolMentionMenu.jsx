import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Telescope02Icon,
  Globe02Icon,
  Brain03Icon,
  LibrariesIcon,
} from '@hugeicons/core-free-icons';

export const AVAILABLE_TOOLS = [
  {
    id: 'research',
    tag: '@research',
    label: 'Deep research',
    description: 'Get a detailed report',
    icon: Telescope02Icon,
    emoji: '🔭',
    iconColor: '#007AFF', // Apple Blue
  },
  {
    id: 'web',
    tag: '@web',
    label: 'Web search',
    description: 'Find real-time news and info',
    icon: Globe02Icon,
    emoji: '🌐',
    iconColor: '#0EA5E9',
  },
  {
    id: 'thinking',
    tag: '@thinking',
    label: 'Thinking',
    description: 'For detailed answers',
    icon: Brain03Icon,
    emoji: '🧠',
    iconColor: '#8E8B86',
  },
  {
    id: 'workspace',
    tag: '@workspace',
    label: 'Workspace notes',
    description: 'Browse and search your notes & files',
    icon: LibrariesIcon,
    emoji: '📁',
    iconColor: '#9CA3AF',
  },
];

/**
 * Minimalist ToolMentionMenu matching ChatGPT / Perplexity dropdown:
 * - Minimal existing Hugeicons directly next to title & description
 * - Single-line layout: [Icon] Title Subtitle
 * - Clean section header ("Plugins")
 * - Rounded full-width hover highlight
 */
const ToolMentionMenu = ({
  isOpen = true,
  onSelect,
  onClose,
  selectedIndex = 0,
  filterText = '',
}) => {
  const menuRef = useRef(null);

  // Filter tools based on query after @
  const cleanFilter = (filterText || '').toLowerCase().replace(/^@/, '').trim();
  const filteredTools = AVAILABLE_TOOLS.filter((tool) => {
    if (!cleanFilter) return true;
    return (
      tool.id.toLowerCase().includes(cleanFilter) ||
      tool.label.toLowerCase().includes(cleanFilter) ||
      tool.tag.toLowerCase().includes(cleanFilter)
    );
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !e.target.closest?.('textarea')
      ) {
        if (onClose) onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!isOpen || filteredTools.length === 0) return null;

  return (
    <motion.div
      ref={menuRef}
      role="listbox"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      className="claude-composer-box absolute bottom-full left-0 right-0 mb-1.5 w-full border z-[9999] overflow-hidden rounded-[14.5px] p-2 select-none"
    >
      {/* Section Header */}
      <div className="px-3 pt-1.5 pb-1 text-[12px] leading-[16px] font-medium text-[var(--c-text-secondary)]">
        Plugins & Tools
      </div>

      {/* Items List */}
      <div className="flex flex-col gap-0.5">
        {filteredTools.map((tool, idx) => {
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={tool.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(tool);
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-[12px] text-left transition-colors cursor-pointer w-full group ${
                isSelected
                  ? 'bg-[var(--ca-selected)] text-[var(--c-text-primary)]'
                  : 'hover:bg-[var(--ca-hover)] text-[var(--c-text-primary)]'
              }`}
            >
              {/* Minimalist icon without any background wrapper */}
              <span
                className="shrink-0 w-5 h-5 flex items-center justify-center select-none"
                style={{ color: tool.iconColor }}
              >
                <HugeiconsIcon icon={tool.icon} size={18} strokeWidth={1.8} />
              </span>

              {/* Title & Subtitle inline */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-[14px] leading-[16.8px] font-medium text-[var(--c-text-primary)] shrink-0">
                  {tool.label}
                </span>
                <span className="text-[12px] leading-[15px] text-[var(--c-text-secondary)] truncate">
                  {tool.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default ToolMentionMenu;
