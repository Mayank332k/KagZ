import React from 'react';
import { Loading03Icon } from 'hugeicons-react';
import useAsyncAction from '../../hooks/useAsyncAction';

/**
 * AsyncButton
 * Renders a button that manages the strict Idle → Loading → Success / Retry → Failed lifecycle.
 * - Shows an inline spinner immediately upon click
 * - Locks the button while request is processing
 * - Automatically retries up to 3 times on failure
 */
const AsyncButton = ({
  onClick,
  children,
  className = '',
  loadingText,
  disabled = false,
  type = 'button',
  isDanger = false,
  maxRetries = 3,
  retryDelay = 500,
  onSuccess,
  onError,
  successMessage,
  errorMessage,
  ...props
}) => {
  const { execute, isLoading, retryCount, status } = useAsyncAction(onClick, {
    maxRetries,
    retryDelay,
    onSuccess,
    onError,
    successMessage,
    errorMessage,
  });

  const handleClick = (e) => {
    if (isLoading || disabled) return;
    execute(e);
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`relative inline-flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loading03Icon className="w-4 h-4 animate-spin shrink-0" />
          <span>{retryCount > 0 ? `Retrying (${retryCount}/${maxRetries})...` : (loadingText || children)}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};

export default AsyncButton;
