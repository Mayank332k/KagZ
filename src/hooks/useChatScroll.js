import { useState, useRef, useLayoutEffect, useCallback } from 'react';

/**
 * Custom hook to manage chat scroll behavior with high discipline:
 * - Smooth scroll on new message turn.
 * - Instant, non-conflicting auto-follow during token streaming when pinned to bottom.
 * - Respects user scrolling up (disables auto-follow so user can read freely).
 * - Re-attaches auto-scroll when user scrolls back to bottom or clicks floating button.
 * - Restores scroll position when loading previous messages.
 */
export function useChatScroll({
  chatScrollRef,
  messages,
  isStreaming,
  isRightPanel,
  isLoadingMore,
  hasMore,
  fetchMoreMessages,
}) {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const prevScrollHeightRef = useRef(0);
  const wasLoadingMoreRef = useRef(false);
  const prevMessagesCountRef = useRef(messages.length);
  const isPinnedToBottomRef = useRef(true);
  const isTransitioningRef = useRef(false);
  const transitionTimeoutRef = useRef(null);
  const scrollRafIdRef = useRef(null);

  const handleScroll = useCallback(
    (e) => {
      if (isTransitioningRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      // Show scroll button if scrolled up more than 150px
      if (distanceFromBottom > 150) {
        setShowScrollButton(true);
      } else {
        setShowScrollButton(false);
      }

      if (distanceFromBottom < 80) {
        isPinnedToBottomRef.current = true;
      } else if (distanceFromBottom > 120) {
        isPinnedToBottomRef.current = false;
      }

      // Infinite scroll upwards for history
      if (scrollTop === 0 && !isLoadingMore && hasMore && fetchMoreMessages) {
        prevScrollHeightRef.current = scrollHeight;
        wasLoadingMoreRef.current = true;
        fetchMoreMessages();
      }
    },
    [isLoadingMore, hasMore, fetchMoreMessages]
  );

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    isPinnedToBottomRef.current = true;
    setShowScrollButton(false);
    isTransitioningRef.current = true;
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => {
      isTransitioningRef.current = false;
    }, 600);

    const container = chatScrollRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    }
  }, [chatScrollRef]);

  const scrollToNewTurn = useCallback(() => {
    const container = chatScrollRef.current;
    if (!container) return;

    // Set transition lock so streaming auto-scroll does not fight new turn scroll
    isTransitioningRef.current = true;
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => {
      isTransitioningRef.current = false;
    }, 550);

    const turnNodes = container.querySelectorAll('[data-role="user"], [data-choice-resolved="true"]');
    if (turnNodes.length <= 1) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const targetEl = turnNodes[turnNodes.length - 1];
    if (targetEl) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const relativeTop = targetRect.top - containerRect.top + container.scrollTop;

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const topOffset = isRightPanel ? 18 : (isMobile ? 18 : 28);
      const targetScroll = Math.max(0, Math.round(relativeTop - topOffset));

      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth',
      });
    }
  }, [chatScrollRef, isRightPanel]);

  useLayoutEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;

    if (wasLoadingMoreRef.current) {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      wasLoadingMoreRef.current = false;
    } else {
      const isNewMessage = messages.length > prevMessagesCountRef.current;

      if (isNewMessage) {
        isPinnedToBottomRef.current = true;
        scrollToNewTurn();
      } else if (isStreaming && isPinnedToBottomRef.current && !isTransitioningRef.current) {
        // Fast, throttled auto-scroll without fighting browser smooth animations
        if (scrollRafIdRef.current) {
          cancelAnimationFrame(scrollRafIdRef.current);
        }

        scrollRafIdRef.current = requestAnimationFrame(() => {
          scrollRafIdRef.current = null;
          if (!container || !isPinnedToBottomRef.current || isTransitioningRef.current) return;

          const assistantNodes = container.querySelectorAll('[data-role="assistant"]');
          const latestAssistant = assistantNodes.length > 0 ? assistantNodes[assistantNodes.length - 1] : null;
          if (!latestAssistant) return;

          // Target actual text content rather than outer min-height spacer box
          const contentEl = latestAssistant.querySelector('.markdown-content') ||
                            latestAssistant.querySelector('.message-bubble-assistant') ||
                            latestAssistant.firstElementChild ||
                            latestAssistant;

          const containerRect = container.getBoundingClientRect();
          const contentRect = contentEl.getBoundingClientRect();
          const bottomPadding = isRightPanel ? 40 : 80;

          // Only follow if content is actually overflowing the visible container area
          const overflow = contentRect.bottom - (containerRect.bottom - bottomPadding);
          if (overflow > 0) {
            container.scrollTop += Math.min(overflow, 35);
          }
        });
      }
    }

    prevMessagesCountRef.current = messages.length;

    return () => {
      if (scrollRafIdRef.current) {
        cancelAnimationFrame(scrollRafIdRef.current);
      }
    };
  }, [messages, isStreaming, isRightPanel, scrollToNewTurn, chatScrollRef]);

  return {
    showScrollButton,
    handleScroll,
    scrollToBottom,
    scrollToNewTurn,
  };
}
