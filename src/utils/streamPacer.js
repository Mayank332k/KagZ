/**
 * Stream Pacer with Word Chunking & Smooth Cadence
 * 
 * Solves streaming lag by batching updates by words rather than single characters,
 * reducing React re-render churn from 60fps down to ~20-22fps while keeping text
 * flowing continuously and naturally.
 */

function sliceWords(str, count) {
  if (!str) return '';

  // If str has a newline within the first 60 chars, prioritize breaking at the newline
  const newlineIdx = str.indexOf('\n');
  if (newlineIdx !== -1 && newlineIdx <= 60) {
    return str.slice(0, newlineIdx + 1);
  }

  let wordsFound = 0;
  let inWhitespace = false;
  let i = 0;

  for (; i < str.length; i++) {
    const char = str[i];
    const isSpace = /\s/.test(char);

    if (isSpace) {
      if (!inWhitespace) {
        wordsFound++;
        inWhitespace = true;
        if (wordsFound >= count) {
          while (i + 1 < str.length && /\s/.test(str[i + 1])) {
            i++;
          }
          return str.slice(0, i + 1);
        }
      }
    } else {
      inWhitespace = false;
    }
  }

  return str;
}

export function createStreamPacer({ onFlush, onComplete }) {
  let queue = '';
  let rafId = null;
  let lastFlushTime = 0;
  let isDone = false;
  let isAborted = false;
  let resolveDrain = null;

  // 45ms target interval between flushes (~22 flushes/sec) for smooth, lag-free UI
  const FLUSH_INTERVAL_MS = 45;

  const tick = (now) => {
    rafId = null;
    if (isAborted) return;

    if (!lastFlushTime) lastFlushTime = now;
    const elapsed = now - lastFlushTime;

    if (queue.length > 0) {
      const targetInterval = isDone ? 25 : FLUSH_INTERVAL_MS;

      if (elapsed >= targetInterval) {
        lastFlushTime = now;

        // Adaptive word count based on buffer depth:
        // - Small buffer: 1-2 words (steady gentle pace)
        // - Medium buffer: 2-3 words
        // - Large buffer (> 80 chars): 4-6 words (catch up smoothly)
        // - Draining after done: 6-8 words
        let wordCount = 1;
        if (isDone) {
          wordCount = 7;
        } else if (queue.length > 120) {
          wordCount = 5;
        } else if (queue.length > 60) {
          wordCount = 3;
        } else if (queue.length > 25) {
          wordCount = 2;
        } else {
          wordCount = 1;
        }

        // Avoid splitting half-words if queue is still small and server is active
        const hasWhitespace = /\s/.test(queue);
        if (!hasWhitespace && !isDone && queue.length < 18 && elapsed < 120) {
          rafId = requestAnimationFrame(tick);
          return;
        }

        const chunk = sliceWords(queue, wordCount);
        if (chunk && chunk.length > 0) {
          queue = queue.slice(chunk.length);
          onFlush?.(chunk);
        }
      }
    }

    if (queue.length === 0) {
      if (isDone) {
        if (resolveDrain) {
          resolveDrain();
          resolveDrain = null;
        }
        onComplete?.();
        return;
      }
      lastFlushTime = 0;
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  const startLoop = () => {
    if (!rafId && !isAborted) {
      lastFlushTime = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  };

  return {
    push(text) {
      if (isAborted || !text) return;
      queue += text;
      startLoop();
    },

    markDone() {
      isDone = true;
      if (queue.length === 0) {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        onComplete?.();
      } else {
        startLoop();
      }
    },

    drain() {
      if (queue.length === 0 || isAborted) {
        return Promise.resolve();
      }
      isDone = true;
      return new Promise((resolve) => {
        resolveDrain = resolve;
        startLoop();
      });
    },

    flushImmediately() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (queue.length > 0 && !isAborted) {
        const remaining = queue;
        queue = '';
        onFlush?.(remaining);
      }
      if (resolveDrain) {
        resolveDrain();
        resolveDrain = null;
      }
      if (isDone) {
        onComplete?.();
      }
    },

    abort() {
      isAborted = true;
      queue = '';
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (resolveDrain) {
        resolveDrain();
        resolveDrain = null;
      }
    },

    getQueueLength() {
      return queue.length;
    }
  };
}
