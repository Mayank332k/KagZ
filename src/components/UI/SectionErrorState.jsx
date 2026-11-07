import { WifiOff } from 'lucide-react';

/**
 * SectionErrorState
 * Minimal, non-intrusive disconnected state rendered when a section encounters a connection issue.
 * Displays only a clean disconnected icon with click-to-retry and tooltip.
 */
const SectionErrorState = ({
  message = 'Disconnected',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-center py-2 px-2 text-neutral-400 dark:text-[#787672] ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry?.();
        }}
        title={`${message} • Click to retry`}
        aria-label={`${message} • Click to retry`}
        className="group inline-flex items-center justify-center w-7 h-7 rounded-md text-neutral-400 dark:text-[#787672] hover:text-neutral-700 dark:hover:text-[#f7f6f4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-all cursor-pointer border-0 bg-transparent outline-none"
      >
        <WifiOff
          size={14}
          strokeWidth={1.8}
          className="select-none transition-transform group-hover:scale-110"
        />
      </button>
    </div>
  );
};

export default SectionErrorState;
