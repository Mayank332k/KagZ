import { useState, useRef, useCallback } from 'react';

// Global in-memory cache surviving across re-renders and route navigation
const globalSectionCache = new Map();
const inFlightRequests = new Map();

/**
 * useSectionLoader
 *
 * Provides conditional, event-based loading for header-based sections.
 * - Triggers API call only when the user opens or clicks the section header
 * - Maintains independent loading, success, empty, and error states per section
 * - Caches successfully fetched data and reuses it on subsequent opens
 * - Avoids duplicate in-flight requests on rapid clicks
 * - Allows explicit invalidation or cache updates
 */
export const useSectionLoader = () => {
  const [sectionStates, setSectionStates] = useState({});
  const sectionStatesRef = useRef(sectionStates);
  sectionStatesRef.current = sectionStates;

  /**
   * Load a section on-demand when user clicks its header.
   *
   * @param {string} sectionKey - Unique identifier for the section (e.g. 'recent-section')
   * @param {Function} fetcherFn - Async function returning the section data
   * @param {Object} options - { force?: boolean, onSuccess?: (data) => void, onError?: (err) => void }
   */
  const loadSection = useCallback(async (sectionKey, fetcherFn, options = {}) => {
    const { force = false, onSuccess, onError } = options;

    // 1. Check if already cached and not forced
    if (!force && globalSectionCache.has(sectionKey)) {
      const cachedData = globalSectionCache.get(sectionKey);
      setSectionStates((prev) => ({
        ...prev,
        [sectionKey]: {
          status: 'success',
          data: cachedData,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
        },
      }));
      if (onSuccess) onSuccess(cachedData);
      return cachedData;
    }

    // 2. Prevent duplicate in-flight requests if already loading
    if (inFlightRequests.has(sectionKey)) {
      return inFlightRequests.get(sectionKey);
    }

    // 3. Mark section as loading
    setSectionStates((prev) => ({
      ...prev,
      [sectionKey]: {
        status: 'loading',
        data: prev[sectionKey]?.data ?? null,
        error: null,
        isLoading: true,
        isSuccess: false,
        isError: false,
      },
    }));

    // 4. Execute fetcher
    const requestPromise = (async () => {
      try {
        const result = await fetcherFn();
        globalSectionCache.set(sectionKey, result);
        setSectionStates((prev) => ({
          ...prev,
          [sectionKey]: {
            status: 'success',
            data: result,
            error: null,
            isLoading: false,
            isSuccess: true,
            isError: false,
          },
        }));
        if (onSuccess) onSuccess(result);
        return result;
      } catch (err) {
        setSectionStates((prev) => ({
          ...prev,
          [sectionKey]: {
            status: 'error',
            data: prev[sectionKey]?.data ?? null,
            error: err,
            isLoading: false,
            isSuccess: false,
            isError: true,
          },
        }));
        if (onError) onError(err);
        throw err;
      } finally {
        inFlightRequests.delete(sectionKey);
      }
    })();

    inFlightRequests.set(sectionKey, requestPromise);
    return requestPromise;
  }, []);

  /**
   * Explicitly invalidate a section so next open refetches.
   */
  const invalidateSection = useCallback((sectionKey) => {
    globalSectionCache.delete(sectionKey);
    inFlightRequests.delete(sectionKey);
    setSectionStates((prev) => ({
      ...prev,
      [sectionKey]: {
        status: 'idle',
        data: null,
        error: null,
        isLoading: false,
        isSuccess: false,
        isError: false,
      },
    }));
  }, []);

  /**
   * Optimistically update cached data for a section without a full refetch.
   */
  const updateSectionData = useCallback((sectionKey, updater) => {
    const current = globalSectionCache.get(sectionKey);
    const updated = typeof updater === 'function' ? updater(current) : updater;
    globalSectionCache.set(sectionKey, updated);
    setSectionStates((prev) => ({
      ...prev,
      [sectionKey]: {
        status: 'success',
        data: updated,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      },
    }));
  }, []);

  /**
   * Helper to inspect the current state of any section.
   */
  const getSectionState = useCallback((sectionKey) => {
    if (sectionStatesRef.current[sectionKey]) {
      return sectionStatesRef.current[sectionKey];
    }
    if (globalSectionCache.has(sectionKey)) {
      return {
        status: 'success',
        data: globalSectionCache.get(sectionKey),
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      };
    }
    return {
      status: 'idle',
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    };
  }, []);

  return {
    sectionStates,
    loadSection,
    invalidateSection,
    updateSectionData,
    getSectionState,
    isCached: (key) => globalSectionCache.has(key),
  };
};

export default useSectionLoader;
