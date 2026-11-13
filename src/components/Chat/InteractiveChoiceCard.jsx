import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { marked } from 'marked';

/**
 * InteractiveChoiceCard
 *
 * Matching the reference UI (media_1794554782821_0a64b5a2.png):
 * - Exact textarea width matching the composer
 * - Quiet header with question text on left, 'close' (X) on right
 * - Numbered option rows (1, 2, 3...) with title and subtitle
 * - Selection / hover shows background highlight and '→' arrow on the right
 * - Footer with inline 'Something else' custom input and 'Skip' button on the right
 */

// Parse inline markdown (bold, italic, code) without block elements
export const parseInlineMarkdown = (text) => {
  if (!text || typeof text !== 'string') return text;
  return marked.parseInline(text);
};

const normalizeOption = (opt) => {
  if (opt === null || opt === undefined) return null;
  if (typeof opt === 'string') {
    return { title: opt, description: '' };
  }
  const title = opt.title || opt.text || opt.label || '';
  if (!title) return null;
  return {
    title,
    description: opt.description || opt.desc || opt.subtitle || '',
  };
};

const InteractiveChoiceCard = ({
  question,
  options = [],
  selectedIndex: controlledIndex,
  onSelectedIndexChange,
  onSelect,
  onSkip,
  onDismiss,
  className = '',
}) => {
  const normalizedOptions = useMemo(
    () => (Array.isArray(options) ? options.map(normalizeOption).filter(Boolean) : []),
    [options]
  );

  const [internalSelectedIndex, setInternalSelectedIndex] = useState(-1);
  const selectedIndex = controlledIndex !== undefined ? controlledIndex : internalSelectedIndex;
  const setSelectedIndex = onSelectedIndexChange || setInternalSelectedIndex;
  const activeIndex = selectedIndex >= 0 && normalizedOptions.length > 0
    ? Math.min(selectedIndex, normalizedOptions.length - 1)
    : -1;

  const [customText, setCustomText] = useState('');
  const inputRef = useRef(null);

  // Clear the highlighted option whenever the question changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [question, setSelectedIndex]);

  const handleChoose = useCallback((opt) => {
    if (!opt) return;
    const answer = opt.title || opt.text || String(opt);
    if (onSelect) onSelect(answer);
  }, [onSelect]);

  const handleCustomSubmit = (e) => {
    if (e) e.preventDefault();
    if (!customText.trim()) return;
    if (onSelect) onSelect(customText.trim());
  };

  // Keyboard navigation: 1-9, ArrowUp/ArrowDown, Enter, Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        if (e.key === 'Escape') {
          if (customText) {
            setCustomText('');
            e.stopPropagation();
          } else if (onDismiss) {
            onDismiss();
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        if (onDismiss) onDismiss();
      } else if (normalizedOptions.length === 0) {
        return;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < 0 ? 0 : (prev + 1) % normalizedOptions.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev <= 0 ? normalizedOptions.length - 1 : prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const targetIndex = activeIndex >= 0 ? activeIndex : 0;
        if (normalizedOptions[targetIndex]) {
          handleChoose(normalizedOptions[targetIndex]);
        }
      } else {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= normalizedOptions.length) {
          e.preventDefault();
          handleChoose(normalizedOptions[num - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, normalizedOptions, handleChoose, customText, onDismiss, setSelectedIndex]);

  if (!question && normalizedOptions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.995 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`claude-composer-box w-full mx-auto flex flex-col overflow-hidden rounded-[14.5px] border font-sans text-[var(--c-text-primary)] transition-colors duration-200 select-none ${className}`}
    >
      {/* 1. HEADER (Question on left, Close button on right) */}
      <div className="flex items-center justify-between gap-3 px-4.5 pb-3 pt-3.5 sm:px-5">
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-normal leading-snug tracking-[-0.01em] text-[var(--c-text-primary)] sm:text-[14.5px]">
          <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(question) }} />
        </h3>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--c-text-secondary)] transition-colors hover:bg-[var(--ca-hover)] hover:text-[var(--c-text-primary)] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px] leading-none select-none">
              close
            </span>
          </button>
        )}
      </div>

      <div className="h-px w-full bg-black/[0.06] dark:bg-white/[0.08]" />

      {/* 2. NUMBERED OPTIONS */}
      <div className="flex flex-col">
        {normalizedOptions.map((opt, idx) => {
          const isSelected = activeIndex === idx;

          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedIndex(idx);
                handleChoose(opt);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`group relative flex min-h-[56px] cursor-pointer items-center gap-3.5 px-4.5 py-2.5 transition-colors duration-150 sm:px-5 ${
                isSelected
                  ? 'bg-[var(--ca-selected)]'
                  : 'bg-transparent hover:bg-[var(--ca-hover)]'
              }`}
            >
              {/* Rounded square number badge */}
              <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--ca-selected)] text-[13px] font-medium leading-none text-[var(--c-text-secondary)] transition-colors duration-150 group-hover:bg-[var(--ca-pressed)]">
                {idx + 1}
              </div>

              {/* Title & Description */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium leading-tight tracking-[-0.01em] text-[var(--c-text-primary)] sm:text-[14.5px]">
                  <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(opt.title) }} />
                </div>
                {opt.description && (
                  <p className="mt-1 truncate text-[12.5px] font-normal leading-tight text-[var(--c-text-secondary)]">
                    <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(opt.description) }} />
                  </p>
                )}
              </div>

              {/* Arrow on right for selected / hovered item */}
              <span
                className={`text-[var(--c-text-secondary)] text-[16px] leading-none font-normal shrink-0 transition-opacity duration-150 ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                →
              </span>

              {/* Inset hairline divider between options */}
              {idx < normalizedOptions.length - 1 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-4 right-4 h-px bg-black/[0.06] dark:bg-white/[0.08] sm:left-5 sm:right-5"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 3. FOOTER ("Something else" input on left, "Skip" on right) */}
      <div className="relative flex items-center justify-between gap-3 px-4.5 py-2.5 sm:px-5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 right-4 top-0 h-px bg-black/[0.06] dark:bg-white/[0.08] sm:left-5 sm:right-5"
        />

        {/* Custom text input */}
        <form onSubmit={handleCustomSubmit} className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--ca-selected)] transition-colors duration-150 text-[var(--c-text-secondary)]">
            <span className="material-symbols-outlined text-[15px] leading-none select-none">
              edit
            </span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCustomSubmit();
              }
            }}
            placeholder="Something else"
            className="w-full bg-transparent text-[14px] font-normal text-[var(--c-text-primary)] placeholder-[var(--c-text-tertiary)] outline-none border-0 p-0 m-0 custom-scrollbar"
          />
        </form>

        {/* Skip button */}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 rounded-[9px] bg-[var(--ca-selected)] hover:bg-[var(--ca-pressed)] px-3.5 py-1.5 text-[13px] font-medium text-[var(--c-text-primary)] transition-colors cursor-pointer select-none"
          >
            Skip
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(InteractiveChoiceCard);
