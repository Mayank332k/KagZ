import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * InteractiveChoiceCard
 *
 * Ultra-compact, sleek dark-mode choice card:
 * - Reduced height by 40%+ to eliminate wasted vertical space and preserve chat visibility
 * - Monochromatic grayscale palette (--bg: #111111, --modal: #181818, --selected: #242424, --control: #303030, --border: #3A3A3A, --divider: #383838)
 * - Compact number squircle (28x28px), tight typography and padding
 * - Scrollable options (max-h: 160px) for multiple choices
 *
 * @param {Object} props
 * @param {string} props.question - Primary prompt/question (#E8E8E8)
 * @param {Array<{ title: string, description?: string }>} props.options - Choices
 * @param {Function} props.onSelect - Callback with chosen text
 * @param {Function} [props.onSkip] - Callback when user skips
 * @param {Function} [props.onDismiss] - Callback when user closes (X)
 */
const InteractiveChoiceCard = ({
  question,
  options = [],
  selectedIndex: controlledIndex,
  onSelectedIndexChange,
  onSelect,
  onSkip,
  onDismiss,
}) => {
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);
  const selectedIndex = controlledIndex !== undefined ? controlledIndex : internalSelectedIndex;
  const setSelectedIndex = onSelectedIndexChange || setInternalSelectedIndex;
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (showCustomInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCustomInput]);

  // Keyboard navigation: 1-9, ArrowUp/ArrowDown, Enter, Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          if (showCustomInput) {
            setShowCustomInput(false);
            e.stopPropagation();
          } else if (onDismiss) {
            onDismiss();
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        if (onDismiss) onDismiss();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (options[selectedIndex]) {
          handleChoose(options[selectedIndex]);
        }
      } else {
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 1 && num <= options.length) {
          e.preventDefault();
          handleChoose(options[num - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options, selectedIndex, showCustomInput, onDismiss]);

  const handleChoose = (opt) => {
    if (!opt) return;
    const answer = opt.title || opt.text || String(opt);
    if (onSelect) onSelect(answer);
  };

  const handleCustomSubmit = (e) => {
    if (e) e.preventDefault();
    if (!customText.trim()) return;
    if (onSelect) onSelect(customText.trim());
  };

  if (!question && (!options || options.length === 0)) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[770px] mx-auto mb-1 rounded-[16px] bg-[#1E1E1E] border border-[#2C2C2C] shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-[#E8E8E8] select-none flex flex-col font-sans transition-colors duration-200 overflow-hidden"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 gap-2">
        <h3 className="text-[14px] font-normal leading-snug tracking-tight text-[#D4D4D4] truncate flex-1">
          {question}
        </h3>
        <span className="text-[11px] font-mono text-gray-400 dark:text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded-[4px] shrink-0 select-none hidden sm:inline-block">
          Press 1-{Math.min(options.length, 9)} or ↵
        </span>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="p-1 -mr-1 text-[#777777] hover:text-[#999999] transition-colors duration-180 cursor-pointer rounded-md flex items-center justify-center shrink-0"
          >
            <span className="material-symbols-outlined text-[18px] leading-none select-none">
              close
            </span>
          </button>
        )}
      </div>

      {/* OPTIONS STACK */}
      <div className="flex flex-col">
        {options.slice(0, 4).map((opt, idx) => {
          const isSelected = selectedIndex === idx;
          const title = opt.title || opt.text || String(opt);
          const description = opt.description || opt.desc || '';

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
              className={`
                group relative flex items-start sm:items-center gap-3 px-4 py-2 cursor-pointer transition-colors duration-150 ${idx > 0 ? 'border-t border-[#2C2C2C]' : ''}
                ${isSelected
                  ? 'bg-[#2A2A2A]'
                  : 'bg-transparent hover:bg-[#252525]'
                }
              `}
            >
              {/* Number box */}
              <div
                className={`
                  w-[28px] h-[28px] rounded-[6px] flex items-center justify-center shrink-0 transition-colors duration-150 text-[13px] font-medium
                  ${isSelected
                    ? 'bg-[#3A3A3A] text-[#EEEEEE]'
                    : 'bg-[#2E2E2E] text-[#999999] group-hover:bg-[#333333] group-hover:text-[#BBBBBB]'
                  }
                `}
              >
                {idx + 1}
              </div>

              {/* Title & Description */}
              <div className="flex flex-col min-w-0 flex-1 justify-center mt-0.5 sm:mt-0">
                <span className="text-[13.5px] font-normal text-[#EAEAEA] leading-tight tracking-tight truncate">
                  {title}
                </span>
                {description && (
                  <p className="text-[12px] font-normal text-[#888888] leading-none mt-0.5 truncate">
                    {description}
                  </p>
                )}
              </div>

              {/* Return arrow ↵ on selected */}
              <div
                className={`
                  shrink-0 transition-opacity duration-150 self-center
                  ${isSelected ? 'opacity-100' : 'opacity-0'}
                `}
              >
                <span className="text-[11.5px] font-mono text-gray-400 dark:text-neutral-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-[5px] select-none inline-flex items-center gap-1">
                  <span>Enter</span>
                  <span className="text-[12px] leading-none">↵</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* BOTTOM ACTION */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-[#2C2C2C]">
        <AnimatePresence mode="wait">
          {!showCustomInput ? (
            <div
              key="custom-trigger"
              role="button"
              tabIndex={0}
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-3 group cursor-pointer"
            >
              <div className="w-[28px] h-[28px] rounded-[6px] bg-[#2E2E2E] group-hover:bg-[#333333] flex items-center justify-center shrink-0 transition-colors duration-150">
                <span className="material-symbols-outlined text-[15px] text-[#999999] group-hover:text-[#BBBBBB] transition-colors leading-none select-none">
                  edit
                </span>
              </div>
              <span className="text-[13.5px] font-normal text-[#A3A3A3] group-hover:text-[#D4D4D4] transition-colors duration-150">
                Something else
              </span>
            </div>
          ) : (
            <motion.form
              key="custom-form"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '100%' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleCustomSubmit}
              className="flex items-center gap-3 flex-1 mr-4"
            >
              <input
                ref={inputRef}
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type custom response..."
                className="w-full bg-[#111111] border border-[#3A3A3A] rounded-[8px] px-3 py-1.5 text-[13px] text-[#E8E8E8] placeholder-[#777777] focus:outline-none focus:border-[#555555] transition-colors"
              />
              <button
                type="submit"
                disabled={!customText.trim()}
                className="px-3 py-1.5 rounded-[6px] bg-[#3A3A3A] hover:bg-[#444444] text-[#E5E5E5] text-[13px] font-normal disabled:opacity-30 transition-colors duration-150 cursor-pointer shrink-0"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomText('');
                }}
                className="p-1 text-[#777777] hover:text-[#999999] transition-colors duration-150 cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[17px] leading-none select-none">
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
            className="px-3.5 py-1.5 rounded-[6px] bg-white/10 hover:bg-white/15 text-[#D4D4D4] text-[13px] font-medium transition-colors duration-150 cursor-pointer shrink-0 ml-auto"
          >
            Skip
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default React.memo(InteractiveChoiceCard);
