import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { marked } from 'marked';

/**
 * InteractiveChoiceCard
 *
 * Compact, sleek question card:
 * - Rounded surface with a quiet header (question + dismiss)
 * - Numbered option rows with title/description and inset hairline dividers
 * - Footer with "Something else" custom input and a Skip pill
 * - Theme-aware: light surfaces by default, original dark palette under `.dark`
 *
 * @param {Object} props
 * @param {string} props.question - Primary prompt/question (supports inline markdown: **bold**, *italic*, `code`)
 * @param {Array<{ title: string, description?: string }>} props.options - Choices
 * @param {Function} props.onSelect - Callback with chosen text
 * @param {Function} [props.onSkip] - Callback when user skips
 * @param {Function} [props.onDismiss] - Callback when user closes (X)
 */

// Parse inline markdown (bold, italic, code) without block elements
const parseInlineMarkdown = (text) => {
  if (!text || typeof text !== 'string') return text;
  // Configure marked for inline-only parsing
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

  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustomInput]);

  // Clear the highlighted option whenever the question changes.
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

  const resetCustomInput = () => {
    setShowCustomInput(false);
    setCustomText('');
  };

  // Keyboard navigation: 1-9, ArrowUp/ArrowDown, Enter, Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        if (e.key === 'Escape') {
          if (showCustomInput) {
            resetCustomInput();
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
  }, [activeIndex, normalizedOptions, handleChoose, showCustomInput, onDismiss, setSelectedIndex]);

  if (!question && normalizedOptions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.995 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[770px] mx-auto mb-1 flex flex-col overflow-hidden rounded-[20px] border border-[#E6E5E3] bg-white font-sans text-[#2C2C2B] shadow-[0_18px_50px_-12px_rgba(0,0,0,0.14)] transition-colors duration-200 select-none dark:border-[#333333] dark:bg-[#1E1E1E] dark:text-[#E8E8E8] dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-3.5 sm:px-5">
        <h3 className="min-w-0 flex-1 truncate text-[14px] font-normal leading-snug tracking-[-0.01em] text-[#2C2C2B] dark:text-[#E8E8E8] sm:text-[14.5px]">
          <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(question) }} />
        </h3>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#8E8B86] transition-colors hover:bg-black/[0.04] hover:text-[#5F5E59] dark:text-[#8A8A8A] dark:hover:bg-white/[0.06] dark:hover:text-[#D4D4D4]"
          >
            <span className="material-symbols-outlined text-[18px] leading-none select-none">
              close
            </span>
          </button>
        )}
      </div>

      <div className="h-px w-full bg-[#EDECEA] dark:bg-[#2A2A2A]" />

      {/* OPTIONS */}
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
              className={`group relative flex min-h-[54px] cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors duration-150 sm:px-5 ${
                isSelected
                  ? 'bg-black/[0.025] dark:bg-white/[0.035]'
                  : 'bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex h-[26px] w-[28px] shrink-0 items-center justify-center rounded-[7px] bg-[#F0EFED] text-[12.5px] font-medium leading-none text-[#8E8B86] transition-colors duration-150 group-hover:bg-[#E6E5E3] dark:bg-[#2A2A2A] dark:text-[#B3B3B3] dark:group-hover:bg-[#333333]">
                {idx + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-normal leading-tight tracking-[-0.01em] text-[#2C2C2B] dark:text-[#E8E8E8] sm:text-[14px]">
                  <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(opt.title) }} />
                </div>
                {opt.description && (
                  <p className="mt-0.5 truncate text-[12px] font-normal leading-tight text-[#8E8B86] dark:text-[#8A8A8A] sm:text-[12.5px]">
                    <span dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(opt.description) }} />
                  </p>
                )}
              </div>

              {idx < normalizedOptions.length - 1 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-4 right-4 h-px bg-[#EDECEA] dark:bg-[#2A2A2A] sm:left-5 sm:right-5"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* FOOTER */}
      <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 right-4 top-0 h-px bg-[#EDECEA] dark:bg-[#2A2A2A] sm:left-5 sm:right-5"
        />

        <AnimatePresence mode="wait" initial={false}>
          {!showCustomInput ? (
            <div
              key="custom-trigger"
              role="button"
              tabIndex={0}
              onClick={() => setShowCustomInput(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowCustomInput(true);
                }
              }}
              className="group flex min-w-0 flex-1 cursor-pointer items-center gap-3"
            >
              <div className="flex h-[26px] w-[28px] shrink-0 items-center justify-center rounded-[7px] bg-[#F0EFED] transition-colors duration-150 group-hover:bg-[#E6E5E3] dark:bg-[#2A2A2A] dark:group-hover:bg-[#333333]">
                <span className="material-symbols-outlined text-[15px] leading-none text-[#8E8B86] select-none dark:text-[#B3B3B3]">
                  edit
                </span>
              </div>
              <span className="truncate text-[13.5px] font-normal text-[#8E8B86] transition-colors duration-150 group-hover:text-[#2C2C2B] dark:text-[#8A8A8A] dark:group-hover:text-[#E0E0E0] sm:text-[14px]">
                Something else
              </span>
            </div>
          ) : (
            <motion.form
              key="custom-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleCustomSubmit}
              className="flex min-w-0 flex-1 items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type custom response..."
                className="h-8 w-full min-w-0 rounded-[9px] border border-[#D4D3CF] bg-[#F4F3F3] px-3 text-[12.5px] text-[#2C2C2B] outline-none transition-colors placeholder-[#A19E99] focus:border-[#A19E99] dark:border-[#3A3A3A] dark:bg-[#151515] dark:text-[#E8E8E8] dark:placeholder-[#777777] dark:focus:border-[#555555]"
              />
              <button
                type="submit"
                disabled={!customText.trim()}
                className="h-8 shrink-0 rounded-[9px] bg-[#2C2C2B] px-3 text-[12.5px] font-medium text-white transition-colors duration-150 hover:bg-black disabled:opacity-30 dark:bg-[#EDEDED] dark:text-[#1E1E1E] dark:hover:bg-white"
              >
                Send
              </button>
              <button
                type="button"
                onClick={resetCustomInput}
                aria-label="Cancel custom response"
                className="flex h-8 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#8E8B86] transition-colors duration-150 hover:bg-black/[0.04] hover:text-[#5F5E59] dark:text-[#8A8A8A] dark:hover:bg-white/[0.06] dark:hover:text-[#D4D4D4]"
              >
                <span className="material-symbols-outlined text-[16px] leading-none select-none">
                  close
                </span>
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {onSkip && !showCustomInput && (
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 rounded-[8px] bg-[#ECEBE9] px-3.5 py-1.5 text-[12.5px] font-medium text-[#2C2C2B] transition-colors duration-150 hover:bg-[#E2E1DE] dark:bg-[#474747] dark:text-[#F0F0F0] dark:hover:bg-[#545454]"
          >
            Skip
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(InteractiveChoiceCard);
