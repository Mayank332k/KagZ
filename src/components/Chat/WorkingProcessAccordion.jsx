import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  BookOpen01Icon,
  BookOpen02Icon,
  QuillWrite02Icon,
  Quiz04Icon,
  Search01Icon,
  Globe02Icon,
  WifiDisconnected01Icon,
} from '@hugeicons/core-free-icons';

/**
 * Formats seconds into human-readable duration:
 * - < 60s: "{N}s"
 * - >= 60s: "{M}m" or "{M}m {S}s"
 */
export function formatDuration(totalSeconds) {
  const sec = Math.max(1, Math.round(Number(totalSeconds) || 0));
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remainingSecs = sec % 60;
  return remainingSecs === 0 ? `${mins}m` : `${mins}m ${remainingSecs}s`;
}

/**
 * Authentic stroke-rounded Thought Bubble Icon in Hugeicons tuple format.
 * Features a cloud-like contour with trailing thought bubbles.
 */
export const ThoughtBubbleIcon = [
  [
    'path',
    {
      d: 'M8.5 15.5 C6 15.5 4 13.8 4 11.5 C4 9.5 5.5 7.8 7.5 7.4 C7.4 7.1 7.3 6.8 7.3 6.5 C7.3 4.2 9.5 2.5 12 2.5 C14.3 2.5 16.3 3.9 17 5.6 C17.6 5.2 18.3 5 19 5 C20.9 5 22.5 6.6 22.5 8.5 C22.5 9.1 22.3 9.7 22 10.2 C22.6 11 23 12 23 13 C23 14.9 21.4 16.5 19.5 16.5 C19 16.5 18.5 16.4 18 16.2 C17 17.3 15.5 18 14 18 C12.8 18 11.7 17.5 10.8 16.7 C10.1 17 9.3 17.2 8.5 17.2',
      stroke: 'currentColor',
      strokeWidth: '1.5',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      key: '0',
    },
  ],
  [
    'circle',
    {
      cx: '7',
      cy: '19.5',
      r: '1.3',
      stroke: 'currentColor',
      strokeWidth: '1.5',
      key: '1',
    },
  ],
  [
    'circle',
    {
      cx: '4',
      cy: '21.5',
      r: '0.8',
      stroke: 'currentColor',
      strokeWidth: '1.5',
      key: '2',
    },
  ],
];

/**
 * Checks whether text or domain is an actual web URL/domain vs workspace note
 */
function isWebUrlOrDomain(text = '', domain = '') {
  if (domain && domain !== 'workspace') return true;
  return /https?:\/\/|[a-zA-Z0-9-]+\.(com|org|net|io|in|co|gov|edu|ai|app|dev|xyz|me|info|biz)\b/i.test(text);
}

/**
 * Checks if step refers to notes / workspace document
 */
function isWorkspaceNote(step, text = '') {
  if (step?.stateType === 'workspace_search' || step?.isWorkspace) return true;
  const lower = text.toLowerCase();
  if (lower.includes('in your notes') || lower.includes('in notes') || lower.includes('workspace')) return true;
  if (text.startsWith('Read ') && !isWebUrlOrDomain(text, step?.domain)) return true;
  return false;
}

/**
 * Extracts hostname/domain from text or URL
 */
function extractDomain(text = '') {
  if (!text) return '';
  const match = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i.exec(text);
  return match ? match[1] : '';
}

/**
 * Resolves the action metadata for an execution step:
 * - url / web domain -> open website in new tab
 * - search query -> open Google / web search in new tab
 * - workspace note -> navigate to /dashboard/page/:pageId
 * - task management -> navigate to /dashboard/tasks
 */
function getStepAction(step) {
  if (!step) return null;
  const text = typeof step === 'string' ? step : step?.text || '';
  const lower = text.toLowerCase();

  // 1. Direct URL on step object
  if (step?.url) {
    const fullUrl = step.url.startsWith('http://') || step.url.startsWith('https://')
      ? step.url
      : `https://${step.url}`;
    return {
      type: 'url',
      target: fullUrl,
      tooltip: `Open ${step.domain || step.title || 'link'} in new tab`,
    };
  }

  // 2. Direct domain on step object
  if (step?.domain && step.domain !== 'workspace') {
    return {
      type: 'url',
      target: `https://${step.domain}`,
      tooltip: `Visit ${step.domain} in new tab`,
    };
  }

  // 3. Workspace note ID
  const pageId = step?.pageId || step?._id || step?.id;
  if (pageId) {
    return {
      type: 'note',
      target: `/dashboard/page/${pageId}`,
      tooltip: 'Open note in editor',
    };
  }

  // 4. Extracted URL / domain from "Read domain.com..."
  const extracted = extractDomain(text);
  if (extracted && (lower.startsWith('read ') || lower.startsWith('reading '))) {
    return {
      type: 'url',
      target: `https://${extracted}`,
      tooltip: `Visit ${extracted} in new tab`,
    };
  }

  // 5. Web Search query: Searching web for "..."
  const webQueryMatch = step?.query || (/Searching web for "(.*?)"/i.exec(text)?.[1]) || (/Search web for "(.*?)"/i.exec(text)?.[1]);
  if (webQueryMatch) {
    return {
      type: 'search',
      target: `https://www.google.com/search?q=${encodeURIComponent(webQueryMatch)}`,
      tooltip: `Search Google for "${webQueryMatch}"`,
    };
  }

  // 6. Notes search query: Searching notes for "..."
  const noteQueryMatch = (/Searching notes for "(.*?)"/i.exec(text)?.[1]) || (/Search notes for "(.*?)"/i.exec(text)?.[1]);
  if (noteQueryMatch) {
    return {
      type: 'workspace_search',
      query: noteQueryMatch,
      tooltip: `Search workspace notes for "${noteQueryMatch}"`,
    };
  }

  // 7. Tasks / Kanban
  if (
    step?.stateType === 'task_management' ||
    lower.includes('tasks and kanban board') ||
    lower.includes('kanban board') ||
    lower.includes('updating task') ||
    lower.includes('creating task')
  ) {
    return {
      type: 'tasks',
      target: '/dashboard/tasks',
      tooltip: 'Open Tasks board',
    };
  }

  // 8. Memory recall / update
  if (
    step?.stateType === 'memory' ||
    step?.stateType === 'remembering' ||
    lower.includes('memory') ||
    lower.includes('remember') ||
    lower.includes('yaad')
  ) {
    return {
      type: 'memory',
      tooltip: 'View AI Memory in settings',
    };
  }

  return null;
}

/**
 * Domain Favicon with fallback to Globe icon
 */
const FaviconIcon = ({ domain }) => {
  const [hasError, setHasError] = useState(false);

  if (!domain || hasError) {
    return (
      <div className="shrink-0 w-[18px] h-[18px] flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]">
        <HugeiconsIcon icon={Globe02Icon} size={16.5} strokeWidth={1.8} />
      </div>
    );
  }

  return (
    <div className="shrink-0 w-[18px] h-[18px] flex items-center justify-center">
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
        alt=""
        className="w-[18px] h-[18px] rounded-[2px] shrink-0 object-contain"
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
};

/**
 * Step Icon for chronological steps:
 * - Memory update / saved: QuillWrite02Icon
 * - Memory recalled / use: BookOpen01Icon
 * - Completed workspace note / read: BookOpen02Icon
 * - Completed web URL: Real site Favicon (fallback Globe02Icon)
 * - Completed search / research: Search01Icon
 * - Completed task: Quiz04Icon
 */
const StepIcon = ({ step, isLive, size = 15 }) => {
  const text = typeof step === 'string' ? step : step?.text || '';
  const stateType = typeof step === 'object' ? step?.stateType : null;
  const lower = text.toLowerCase();
  const pulseClass = isLive ? ' animate-pulse' : '';

  // Memory save / update icon
  if (
    stateType === 'memory' ||
    lower.includes('updated memory') ||
    lower.includes('saved to memory') ||
    lower.includes('saving memory')
  ) {
    return (
      <div className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <HugeiconsIcon icon={QuillWrite02Icon} size={size} strokeWidth={1.8} />
      </div>
    );
  }

  // Memory use / recall icon
  if (
    stateType === 'remembering' ||
    lower.includes('recalled memory') ||
    lower.includes('memory') ||
    lower.includes('remember') ||
    lower.includes('yaad')
  ) {
    return (
      <div className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <HugeiconsIcon icon={BookOpen01Icon} size={size} strokeWidth={1.8} />
      </div>
    );
  }

  // Completed workspace note / Reading item
  if (isWorkspaceNote(step, text)) {
    return (
      <div className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <HugeiconsIcon icon={BookOpen02Icon} size={size} strokeWidth={1.8} />
      </div>
    );
  }

  // Completed web link with domain favicon
  if (isWebUrlOrDomain(text, step?.domain) && (step?.domain || lower.includes('read ') || lower.includes('reading '))) {
    const domain = step?.domain || extractDomain(text);
    return <FaviconIcon domain={domain} />;
  }

  // Completed task management
  if (stateType === 'task_management' || lower.includes('task') || lower.includes('kanban')) {
    return (
      <div className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <HugeiconsIcon icon={Quiz04Icon} size={size} strokeWidth={1.8} />
      </div>
    );
  }

  // Reconnecting step
  if (
    stateType === 'reconnecting' ||
    lower.includes('reconnect') ||
    lower.includes('trying to reconnect')
  ) {
    return (
      <div className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center text-amber-500${pulseClass}`}>
        <HugeiconsIcon icon={WifiDisconnected01Icon} size={size} strokeWidth={1.8} />
      </div>
    );
  }

  // Deep Research / Research step
  if (
    stateType === 'deep_research' ||
    stateType === 'research' ||
    lower.includes('research') ||
    lower.includes('analyzing') ||
    lower.includes('synthesizing')
  ) {
    return (
      <div className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <HugeiconsIcon icon={Search01Icon} size={size} strokeWidth={1.8} />
      </div>
    );
  }

  // Default web search query
  return (
    <div className={`shrink-0 w-[18px] h-[18px] flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
      <HugeiconsIcon icon={Globe02Icon} size={size} strokeWidth={1.8} />
    </div>
  );
};

/**
 * WorkingProcessAccordion:
 * Clean, perfectly aligned working process:
 * - Header Phase 1 (Working/Searching): Live custom ThinkingOrb (size 18px), expanded
 * - Header Phase 2 (Writing reply): Auto-collapses, animated QuillWrite01Icon with handwriting sway
 * - Header Phase 3 (Finished): Settles into "Worked for {N}s >" (clickable to re-expand)
 * - Memory Recall uses BookOpen01Icon; Memory Update uses QuillWrite02Icon
 * - Sequential step entry (190ms pacing) with smooth slide-and-fade animation
 * - Active step highlighted with luminous .shimmer-sentence
 */
const WorkingProcessAccordion = ({
  steps = [],
  sources = [],
  researchData = null,
  status = null,
  stateType = null,
  isStreaming = false,
  duration = null,
  startedAt = null,
  hasVisibleContent = false,
  thoughts = [],
  finalContent = '',
  onOpenSources = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const userInteractedRef = useRef(false);
  const prevStreamingRef = useRef(isStreaming);

  // Aggregate visible steps
  const visibleSteps = useMemo(() => {
    let list = Array.isArray(steps) ? [...steps] : [];

    // Fallback: If steps are empty (e.g. loaded from session/DB) but researchData exists
    if (list.length === 0 && researchData) {
      if (Array.isArray(researchData.steps) && researchData.steps.length > 0) {
        if (researchData.topic) {
          list.push({
            type: 'thought',
            text: `Researching: ${researchData.topic}`,
          });
        }
        researchData.steps.forEach((st) => {
          list.push({
            type: 'execution',
            text: st.title,
            stateType: 'deep_research',
            isLive: st.status === 'in_progress',
            status: st.status === 'completed' ? 'success' : st.status,
          });
        });
      } else if (researchData.currentAction) {
        list.push({
          type: 'execution',
          text: researchData.currentAction,
          stateType: 'deep_research',
          isLive: isStreaming,
        });
      }
    }

    // Merge sources if present: ensure all verified URLs exist in the step breakdown alongside memory & task steps
    if (Array.isArray(sources) && sources.length > 0) {
      sources.forEach((s) => {
        const url = s.url || '';
        const domain = s.domain || (url ? (() => { try { return new URL(url).hostname; } catch { return ''; } })() : '');
        const alreadyInList = list.some((st) => st.url === url || (domain && st.domain === domain));
        if (!alreadyInList) {
          const title = s.title || (url ? url.replace(/^https?:\/\/[^/]+\/?/, '') : '') || domain || 'Source';
          list.push({
            type: 'execution',
            text: domain ? `Read ${domain}` : `Read ${title}`,
            domain,
            url,
            stateType: s.type === 'workspace' ? 'workspace_search' : 'web_search',
            isLive: false,
          });
        }
      });
    }

    // Only include status if it is a specific action status (not generic thinking)
    if (
      list.length === 0 &&
      status &&
      !/^thinking(\.{1,3})?$/i.test(status.trim()) &&
      !/^reasoning(\.{1,3})?$/i.test(status.trim())
    ) {
      list.push({ text: status, stateType: stateType || 'action', isLive: isStreaming });
    }

    return list;
  }, [steps, sources, researchData, status, stateType, isStreaming]);

  const hasActiveRunningStep = useMemo(() => {
    return visibleSteps.some((s) => s?.isLive || s?.status === 'running');
  }, [visibleSteps]);

  const isWriting = isStreaming && hasVisibleContent && !hasActiveRunningStep;
  const prevWritingRef = useRef(false);

  // Auto-collapse when streaming finishes
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming) {
      if (!userInteractedRef.current) {
        setIsOpen(false);
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  // Live timer for active streaming
  const [elapsed, setElapsed] = useState(() => {
    if (duration) return duration;
    if (!startedAt) return 1;
    return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  });

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const start = startedAt || now;
      setElapsed(Math.max(1, Math.round((now - start) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming, startedAt]);

  const displaySeconds = duration || elapsed;

  const scrollContainerRef = useRef(null);
  const navigate = useNavigate();

  const handleStepClick = (e, action) => {
    if (!action) return;
    e.stopPropagation();

    if (action.type === 'url' || action.type === 'search') {
      window.open(action.target, '_blank', 'noopener,noreferrer');
    } else if (action.type === 'note' && action.target) {
      navigate(action.target);
    } else if (action.type === 'tasks' && action.target) {
      navigate(action.target);
    } else if (action.type === 'workspace_search') {
      navigate('/dashboard');
    } else if (action.type === 'memory') {
      window.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'ai' } }));
    }
  };

  // Auto-scroll inside accordion only during live streaming when new steps arrive and user is already at the bottom
  useEffect(() => {
    if (!isStreaming || !isOpen || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [visibleSteps.length, isOpen, isStreaming]);

  // Response streaming is only true when tools are finished/idle and actual reply text is streaming
  const isResponseStreaming = Boolean(
    (!isStreaming || !hasActiveRunningStep) &&
    (hasVisibleContent || (finalContent && finalContent.trim().length > 0))
  );

  const latestThoughtRef = useRef('');

  const conversationalThought = useMemo(() => {
    // If response tokens already started arriving and tools are done, thought should cleanly exit
    if (isResponseStreaming) return null;

    // 1. Explicit thought step from backend event.event or workingSteps
    const thoughtStep = visibleSteps.slice().reverse().find((s) => s?.type === 'thought' || s?.isThought);
    if (thoughtStep?.text && typeof thoughtStep.text === 'string' && thoughtStep.text.trim()) {
      latestThoughtRef.current = thoughtStep.text.trim();
      return latestThoughtRef.current;
    }
    // 2. Initial or continuous thought from <think> tag (no character limit cutoff)
    if (Array.isArray(thoughts) && thoughts.length > 0) {
      const activeThought = thoughts[thoughts.length - 1];
      if (typeof activeThought === 'string' && activeThought.trim() && !activeThought.trim().startsWith('```')) {
        latestThoughtRef.current = activeThought.trim();
        return latestThoughtRef.current;
      }
    }
    // 3. Fallback to cached thought during active streaming so intermediate tool transitions don't blink it out
    if (isStreaming && latestThoughtRef.current) {
      return latestThoughtRef.current;
    }
    return null;
  }, [isResponseStreaming, visibleSteps, thoughts, isStreaming]);

  // Preserved thought: Stays accessible inside expanded accordion even after final response starts streaming
  const persistedThought = useMemo(() => {
    const thoughtStep = visibleSteps.slice().reverse().find((s) => s?.type === 'thought' || s?.isThought);
    if (thoughtStep?.text && typeof thoughtStep.text === 'string' && thoughtStep.text.trim()) {
      return thoughtStep.text.trim();
    }
    if (Array.isArray(thoughts) && thoughts.length > 0) {
      const activeThought = thoughts[thoughts.length - 1];
      if (typeof activeThought === 'string' && activeThought.trim() && !activeThought.trim().startsWith('```')) {
        return activeThought.trim();
      }
    }
    if (latestThoughtRef.current) {
      return latestThoughtRef.current;
    }
    return null;
  }, [visibleSteps, thoughts]);

  const toolSteps = useMemo(() => {
    return visibleSteps.filter((s) => s?.type !== 'thought' && !s?.isThought);
  }, [visibleSteps]);

  const activeStep = useMemo(() => {
    const running = toolSteps.find((s) => s?.isLive || s?.status === 'running');
    if (running) return running;
    return toolSteps[toolSteps.length - 1] || null;
  }, [toolSteps]);

  const activeStepText = useMemo(() => {
    if (!activeStep) return status || 'Searching web...';
    const text = typeof activeStep === 'string' ? activeStep : (activeStep.text || status || 'Searching web...');
    return text.replace(/>\s*$/, '').trim();
  }, [activeStep, status]);

  const activeToolMeta = useMemo(() => {
    // Phase: Completed or response tokens started arriving -> "Worked for {N}s >" (NO ICON)
    if (!isStreaming || isResponseStreaming) {
      if (toolSteps.length === 0 && (!sources || sources.length === 0) && !researchData) {
        return null;
      }
      return {
        key: 'worked',
        label: `Worked for ${formatDuration(displaySeconds)}`,
        icon: null,
      };
    }

    // Pure thinking chat without tools should not show a tool action button
    if (toolSteps.length === 0 && (!status || /^thinking(\.{1,3})?$/i.test(status.trim()))) {
      return null;
    }

    // Active tool running: Compact into active phrasing
    const stepText = typeof activeStep === 'string' ? activeStep : (activeStep?.text || status || '');
    const lower = stepText.toLowerCase();
    const state = activeStep?.stateType || stateType;

    // 1. Updating memory
    if (
      state === 'memory' ||
      lower.includes('saving memory') ||
      lower.includes('saved to memory') ||
      lower.includes('updated memory') ||
      lower.includes('updating memory')
    ) {
      return {
        key: 'updating',
        label: 'Updating memory',
        icon: <HugeiconsIcon icon={QuillWrite02Icon} size={14.5} strokeWidth={1.8} />,
      };
    }

    // 2. Recalling memory
    if (
      state === 'remembering' ||
      lower.includes('recalled memory') ||
      lower.includes('remember') ||
      lower.includes('yaad') ||
      lower.includes('memory')
    ) {
      return {
        key: 'recalling',
        label: 'Recalling memory',
        icon: <HugeiconsIcon icon={BookOpen01Icon} size={14.5} strokeWidth={1.8} />,
      };
    }

    // 3. Notes / Workspace
    if (isWorkspaceNote(activeStep, stepText)) {
      return {
        key: 'notes',
        label: 'Reading notes',
        icon: <HugeiconsIcon icon={BookOpen02Icon} size={14.5} strokeWidth={1.8} />,
      };
    }

    // 4. Reading page / note / URL
    if (
      lower.startsWith('reading') ||
      lower.startsWith('read ') ||
      isWebUrlOrDomain(stepText, activeStep?.domain)
    ) {
      const domain = activeStep?.domain || extractDomain(stepText);
      return {
        key: `reading-${domain || 'page'}`,
        label: domain ? `Reading ${domain}` : 'Reading notes',
        icon: domain ? <FaviconIcon domain={domain} /> : <HugeiconsIcon icon={BookOpen02Icon} size={14.5} strokeWidth={1.8} />,
      };
    }

    // 5. Updating tasks
    if (state === 'task_management' || lower.includes('task') || lower.includes('kanban')) {
      return {
        key: 'tasks',
        label: 'Updating tasks',
        icon: <HugeiconsIcon icon={Quiz04Icon} size={14.5} strokeWidth={1.8} />,
      };
    }

    // 6. Reconnecting
    if (
      state === 'reconnecting' ||
      lower.includes('reconnect') ||
      lower.includes('trying to reconnect') ||
      lower.includes('connection error')
    ) {
      return {
        key: 'reconnecting',
        label: stepText || 'Reconnecting...',
        icon: <HugeiconsIcon icon={WifiDisconnected01Icon} size={14.5} strokeWidth={1.8} />,
      };
    }

    // 7. Searching the web
    return {
      key: 'searching',
      label: 'Searching the web',
      icon: <HugeiconsIcon icon={Search01Icon} size={14.5} strokeWidth={1.8} />,
    };
  }, [isStreaming, isResponseStreaming, displaySeconds, activeStep, status, stateType]);

  const handleToggle = () => {
    userInteractedRef.current = true;
    setIsOpen((prev) => !prev);
  };

  // If there are no steps or status or thought to show, do not render
  if (visibleSteps.length === 0 && !status && !isStreaming && !conversationalThought) return null;

  return (
    <div className="w-full my-1.5 select-none font-sans text-left">
      {/* 1. Conversational Acknowledgement: Disappears as soon as response tokens start arriving */}
      <AnimatePresence>
        {!isResponseStreaming && conversationalThought && (
          <motion.div
            key="conversational-thought-container"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mb-2 select-text overflow-hidden"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={conversationalThought}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                style={{ fontFamily: 'var(--font-quote)' }}
                className="inline-block trailing-dark-shade italic text-[15px] sm:text-[15.5px] leading-relaxed select-text"
              >
                {conversationalThought}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Research / Tool State: Inline with Left Icon, Shaded Text & Dynamic '>' Arrow */}
      {activeToolMeta && (
        <div className="my-1 select-none flex items-center flex-wrap">
          <AnimatePresence mode="wait" initial={false}>
            <motion.button
              key={activeToolMeta.key}
              type="button"
              onClick={handleToggle}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="group/toggle inline-flex items-center text-left text-[14.5px] sm:text-[15px] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 outline-none"
              title={isOpen ? 'Click to collapse steps' : 'Click to expand steps'}
            >
              {/* Left Tool Icon (Only present for active tools; null on 'worked') */}
              {activeToolMeta.icon && (
                <span className="shrink-0 mr-2 flex items-center justify-center text-[#8e8e93] dark:text-[#98989f]">
                  {activeToolMeta.icon}
                </span>
              )}

              {/* Text with active-tool-shimmer during streaming, trailing-dark-shade on completed 'worked' */}
              <span
                className={`inline-block font-normal tracking-[-0.01em] ${
                  isStreaming && !isResponseStreaming
                    ? 'active-tool-shimmer'
                    : 'trailing-dark-shade group-hover/toggle:opacity-90'
                }`}
              >
                {activeToolMeta.label}
              </span>

              {/* Dynamic '>' arrow placed exact after the last word */}
              <ChevronRight
                size={14}
                className={`ml-2 shrink-0 text-[#8e8e93] group-hover/toggle:text-[#5a5a5e] dark:text-[#8e8e93] dark:group-hover/toggle:text-[#d1d1d6] transition-transform duration-200 ease-out ${
                  isOpen ? 'rotate-90' : ''
                }`}
              />
            </motion.button>
          </AnimatePresence>
        </div>
      )}

      {/* 3. Detailed Step Breakdown (Shown when expanded) */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden mt-1.5 mb-2"
          >
            <div
              ref={scrollContainerRef}
              className="border-l-2 border-black/[0.08] dark:border-white/10 ml-1.5 pl-3 py-1.5 flex flex-col gap-2 max-h-[220px] overflow-y-auto overscroll-contain pr-2 custom-scrollbar text-[13px]"
            >
              {/* Preserved thought at top with Thought Icon on left */}
              {persistedThought && (
                <div className="flex items-start gap-2 text-neutral-600 dark:text-neutral-400 pb-0.5 mb-1">
                  <div className="shrink-0 w-[18px] h-[18px] flex items-center justify-center text-neutral-400 dark:text-[#8e8b86] mt-0.5">
                    <HugeiconsIcon icon={ThoughtBubbleIcon} size={15} strokeWidth={1.8} />
                  </div>
                  <span
                    style={{ fontFamily: 'var(--font-quote)' }}
                    className="italic text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-300 select-text"
                  >
                    {persistedThought}
                  </span>
                </div>
              )}

              {toolSteps.map((step, sIdx) => {
                const text = typeof step === 'string' ? step : step?.text || '';
                const action = getStepAction(step);
                const isClickable = Boolean(action);
                const isLive = isStreaming && sIdx === toolSteps.length - 1 && step?.isLive !== false;
                return (
                  <div
                    key={step.url || step.query || step.text || sIdx}
                    onClick={isClickable ? (e) => handleStepClick(e, action) : undefined}
                    className={`flex items-center gap-2 text-neutral-600 dark:text-neutral-400 ${
                      isClickable ? 'cursor-pointer hover:text-black dark:hover:text-white group' : ''
                    }`}
                    title={action?.tooltip}
                  >
                    <div className="shrink-0">
                      <StepIcon step={step} isLive={isLive} />
                    </div>
                    <span className={`truncate ${isClickable ? 'group-hover:underline underline-offset-2' : ''}`}>
                      {text}
                    </span>
                    {isClickable && (
                      <span className="text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(WorkingProcessAccordion);
