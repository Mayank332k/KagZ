import { useState, useRef, useCallback } from 'react';
import { useToast } from '../context/ToastContext';

/**
 * useAsyncAction
 *
 * Strict request lifecycle: Idle → Loading → Success / Retry → Failed
 * - Immediately locks action/button on click
 * - Prevents duplicate requests
 * - Automatically retries up to 3 times on failure
 * - Displays error toast on complete failure
 */
const useAsyncAction = (actionFn, options = {}) => {
  const { maxRetries = 3, retryDelay = 500, onSuccess, onError, successMessage, errorMessage } = options;
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'retry' | 'success' | 'failed'
  const [retryCount, setRetryCount] = useState(0);
  const isExecutingRef = useRef(false);
  const { showToast } = useToast();

  const execute = useCallback(async (...args) => {
    // Prevent duplicate requests & lock action while active
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    setStatus('loading');
    setRetryCount(0);

    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const result = await actionFn(...args);
        setStatus('success');
        isExecutingRef.current = false;
        if (successMessage) showToast(successMessage, 'success');
        if (onSuccess) onSuccess(result);
        return result;
      } catch (err) {
        attempt++;
        if (attempt <= maxRetries) {
          setStatus('retry');
          setRetryCount(attempt);
          await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
        } else {
          setStatus('failed');
          isExecutingRef.current = false;
          const msg = errorMessage || err?.response?.data?.message || err?.message || 'Operation failed. Please try again.';
          showToast(msg, 'error');
          if (onError) onError(err);
          throw err;
        }
      }
    }
  }, [actionFn, maxRetries, retryDelay, onSuccess, onError, successMessage, errorMessage, showToast]);

  return {
    execute,
    isLoading: status === 'loading' || status === 'retry',
    retryCount,
  };
};

export default useAsyncAction;
