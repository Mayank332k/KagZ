import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen01Icon, BookOpen02Icon } from '@hugeicons/core-free-icons';

// Open book with a clean, visible checkmark on the right page
export const BookOpenCheckIcon = [
  ...BookOpen02Icon,
  [
    'path',
    {
      d: 'M14 11.5L16 13.5L20.5 8.5',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.75',
      key: 'memory_check',
    },
  ],
];

const ICONS = [BookOpen01Icon, BookOpen02Icon, BookOpenCheckIcon];

/**
 * MemoryUpdateIcon:
 * Minimalist sequential memory indicator (no bulky pill or border):
 * 1. BookOpen01Icon (initial / closed) -> "Updating memory..."
 * 2. BookOpen02Icon (open book state) -> "Updating memory..."
 * 3. BookOpenCheckIcon (saved / check state) -> "Memory updated"
 */
const MemoryUpdateIcon = React.memo(({
  isUpdating = false,
  isCompleted = true,
  animate = false,
  showText = true,
  tooltip = '',
  size = 18,
  className = '',
}) => {
  const shouldAnimate = animate || isUpdating;
  const [step, setStep] = useState(shouldAnimate ? 0 : (isCompleted ? 2 : 0));

  useEffect(() => {
    if (shouldAnimate) {
      setStep(0);
      const timer1 = setTimeout(() => setStep(1), 400);
      const timer2 = setTimeout(() => setStep(2), 900);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else if (isCompleted) {
      setStep(2);
    }
  }, [shouldAnimate, isCompleted]);

  const CurrentIcon = ICONS[step] || BookOpenCheckIcon;
  const isFinished = step === 2;
  const labelText = isFinished ? 'Memory updated' : 'Updating memory...';

  const containerClasses = showText
    ? `inline-flex items-center gap-2 h-[30px] px-3 rounded-full bg-black/[0.04] dark:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.08] text-gray-700 dark:text-neutral-300 select-none shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:bg-black/[0.06] dark:hover:bg-white/[0.09] transition-all cursor-default ${className}`
    : `inline-flex items-center justify-center text-gray-500 dark:text-neutral-400 select-none ${className}`;

  return (
    <div
      className={containerClasses}
      title={tooltip || labelText}
      aria-label={tooltip || labelText}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={step}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className={`flex items-center justify-center shrink-0 ${showText ? 'text-blue-600 dark:text-blue-400' : 'text-current'}`}
        >
          <HugeiconsIcon
            icon={CurrentIcon}
            size={size}
            strokeWidth={1.8}
            className="shrink-0 text-current"
          />
        </motion.span>
      </AnimatePresence>

      {showText && (
        <span className="text-[13px] font-medium leading-none text-gray-700 dark:text-neutral-200 tracking-tight">
          {labelText}
        </span>
      )}
    </div>
  );
});

export default MemoryUpdateIcon;
