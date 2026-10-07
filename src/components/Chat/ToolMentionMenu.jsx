import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Telescope02Icon,
  Globe02Icon,
  Brain03Icon,
  Blockchain04Icon,
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
    iconColor: '#FFFFFF',
  },
  {
    id: 'workspace',
    tag: '@workspace',
    label: 'Workspace notes',
    description: 'Browse and search your notes & files',
    icon: Blockchain04Icon,
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
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-full left-0 right-0 mb-2.5 w-full bg-[#212121] dark:bg-[#1a1a1c] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.7)] z-[9999] overflow-hidden rounded-[20px] p-2 select-none"
    >
      {/* Section Header */}
      <div className="px-3 pt-1.5 pb-1 text-[12px] font-medium text-neutral-400">
        Plugins
      </div>

      {/* Items List */}
      <div className="flex flex-col gap-0.5">
        {filteredTools.map((tool, idx) => {
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={tool.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(tool);
              }}
              className={`flex items-center gap-3 px-3 py-2 rounded-[12px] text-left transition-colors cursor-pointer w-full group ${
                isSelected
                  ? 'bg-white/[0.1] text-white'
                  : 'hover:bg-white/[0.06] text-neutral-300'
              }`}
            >
              {/* Minimalist icon without any background wrapper */}
              <span
                className="shrink-0 flex items-center justify-center select-none"
                style={{ color: tool.iconColor }}
              >
                <HugeiconsIcon icon={tool.icon} size={18} strokeWidth={1.8} />
              </span>

              {/* Title & Subtitle inline */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-[13.5px] font-medium text-white shrink-0">
                  {tool.label}
                </span>
                <span className="text-[12.5px] text-neutral-400 truncate">
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
