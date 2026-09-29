import React from 'react';
import { AlertCircleIcon, RefreshIcon } from 'hugeicons-react';

/**
 * SectionErrorState
 * Compact, modern error state component rendered inside a section when its API call fails.
 * Provides a retry action button without blocking unrelated sections.
 */
const SectionErrorState = ({
  message = 'Failed to load section data',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-3 my-1.5 rounded-lg bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 text-center ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
        <AlertCircleIcon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[12px] font-medium">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 active:scale-95 rounded transition-all cursor-pointer"
        >
          <RefreshIcon className="w-3 h-3" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};

export default SectionErrorState;
