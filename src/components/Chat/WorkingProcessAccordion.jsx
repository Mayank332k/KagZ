import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Globe, FileText, CheckSquare, Search } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen01Icon, QuillWrite01Icon, QuillWrite02Icon } from '@hugeicons/core-free-icons';
import ThinkingOrb from './ThinkingOrb';
import { resolveStateType } from '../../utils/thoughtParser';

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

  return null;
}

/**
 * Domain Favicon with fallback to Globe icon
 */
const FaviconIcon = ({ domain }) => {
  const [hasError, setHasError] = useState(false);

  if (!domain || hasError) {
    return (
      <div className="shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]">
        <Globe size={15.5} />
      </div>
    );
  }

  return (
    <div className="shrink-0 w-4 h-4 flex items-center justify-center">
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`}
        alt=""
        className="w-4 h-4 rounded-[2px] shrink-0 object-contain"
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
 * - Completed workspace note: FileText document icon
 * - Completed web URL: Real site Favicon
 * - Completed search: Globe icon
 * - Completed task: CheckSquare icon
 */
const StepIcon = ({ step, isLive }) => {
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
      <div className={`shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <HugeiconsIcon icon={QuillWrite02Icon} size={15.5} strokeWidth={1.8} />
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
      <div className={`shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <HugeiconsIcon icon={BookOpen01Icon} size={15.5} strokeWidth={1.8} />
      </div>
    );
  }

  // Completed workspace note
  if (isWorkspaceNote(step, text)) {
    return (
      <div className={`shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <FileText size={15.5} />
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
      <div className={`shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <CheckSquare size={15.5} />
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
      <div className={`shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
        <Search size={15.5} />
      </div>
    );
  }

  // Default web search query
  return (
    <div className={`shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]${pulseClass}`}>
      <Globe size={15.5} />
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
}) => {
  const [isOpen, setIsOpen] = useState(isStreaming && !hasVisibleContent);
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

    // Fallback: If steps are empty (e.g. loaded from session/DB) but sources exist, generate source steps
    if (list.length === 0 && Array.isArray(sources) && sources.length > 0) {
      list = sources.map((s) => {
        const domain = s.domain || (s.url ? (() => { try { return new URL(s.url).hostname; } catch { return ''; } })() : '');
        const title = s.title || (s.url ? s.url.replace(/^https?:\/\/[^/]+\/?/, '') : '') || domain || 'Source';
        return {
          type: 'execution',
          text: domain ? `Read ${domain}` : `Read ${title}`,
          domain,
          url: s.url,
          stateType: s.type === 'workspace' ? 'workspace_search' : 'web_search',
          isLive: false,
        };
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

  // Keep accordion open while steps/tools are actively running
  useEffect(() => {
    if (isStreaming && hasActiveRunningStep && !userInteractedRef.current) {
      setIsOpen(true);
    }
  }, [isStreaming, hasActiveRunningStep]);

  // As soon as all tools finish and visible content streams, auto-collapse so user focuses on the answer
  useEffect(() => {
    if (!prevWritingRef.current && isWriting) {
      if (!userInteractedRef.current) {
        setIsOpen(false);
      }
    }
    prevWritingRef.current = isWriting;
  }, [isWriting]);

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

  // Dynamic active stateType for the header ThinkingOrb
  const activeStateType = useMemo(() => {
    const lastStep = visibleSteps[visibleSteps.length - 1];
    const lastText = typeof lastStep === 'string' ? lastStep : lastStep?.text;
    const lastType = typeof lastStep === 'object' ? lastStep?.stateType : null;
    return resolveStateType(lastType || stateType, lastText || status);
  }, [visibleSteps, stateType, status]);

  const scrollContainerRef = useRef(null);

  // Group visible steps into hierarchical Thought Groups with stable keys
  const thoughtGroups = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    for (let i = 0; i < visibleSteps.length; i++) {
      const step = visibleSteps[i];
      const isThought = typeof step === 'object' && (step?.type === 'thought' || step?.isThought);

      if (isThought) {
        const thoughtKey = (step.text || '').replace(/\s+/g, '-').slice(0, 36);
        // If an unparented group with tools was created just before this thought, attach to this thought!
        if (currentGroup && !currentGroup.thought && currentGroup.tools.length > 0) {
          currentGroup.thought = step;
          currentGroup.id = `tg-${groups.length - 1}-${thoughtKey}`;
        } else {
          currentGroup = {
            id: `tg-${groups.length}-${thoughtKey}`,
            thought: step,
            tools: [],
          };
          groups.push(currentGroup);
        }
      } else {
        // Tool execution step
        if (!currentGroup) {
          currentGroup = {
            id: `tg-default-${groups.length}`,
            thought: null,
            tools: [step],
          };
          groups.push(currentGroup);
        } else {
          currentGroup.tools.push(step);
        }
      }
    }

    return groups;
  }, [visibleSteps]);

  // Tracks user manual toggle state: { [groupId]: boolean }
  const [manualExpanded, setManualExpanded] = useState({});
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
    }
  };

  const toggleGroup = (groupId) => {
    setManualExpanded((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
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

  // If there are no steps to show, do not render
  if (visibleSteps.length === 0) return null;

  const handleToggle = () => {
    userInteractedRef.current = true;
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="w-full my-1.5 select-none font-sans text-left">
      {/* Sleek Accordion Header with dynamic state: Quill when writing, ThinkingOrb when working */}
      <button
        type="button"
        onClick={handleToggle}
        className="group/work inline-flex items-center gap-2 text-[15px] font-normal text-neutral-500 dark:text-[#8e8b86] hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors focus:outline-none cursor-pointer py-1"
        title={isOpen ? 'Collapse working process' : 'Expand working process'}
      >
        {isWriting ? (
          <motion.div
            animate={{
              rotate: [-4, 6, -4],
              y: [0, -1.2, 0],
              x: [0, 0.8, 0],
            }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="w-5 h-5 shrink-0 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86]"
          >
            <HugeiconsIcon icon={QuillWrite01Icon} size={16.5} strokeWidth={1.8} />
          </motion.div>
        ) : isStreaming ? (
          <div className="w-5 h-5 shrink-0 flex items-center justify-center">
            <ThinkingOrb size={19} stateType={activeStateType} />
          </div>
        ) : null}

        <span>
          {isWriting
            ? 'Writing...'
            : isStreaming
            ? `Working for ${displaySeconds}s`
            : `Worked for ${displaySeconds}s`}
        </span>

        {isOpen ? (
          <ChevronDown
            size={15}
            className="shrink-0 text-neutral-400 dark:text-[#8e8b86] group-hover/work:text-neutral-600 dark:group-hover/work:text-neutral-200 transition-colors"
          />
        ) : (
          <ChevronRight
            size={15}
            className="shrink-0 text-neutral-400 dark:text-[#8e8b86] group-hover/work:text-neutral-600 dark:group-hover/work:text-neutral-200 transition-colors"
          />
        )}
      </button>

      {/* Collapsible Body with Guideline */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div
              ref={scrollContainerRef}
              className="border-l-2 border-neutral-300 dark:border-white/15 ml-2 pl-3 py-1.5 my-1 flex flex-col gap-2 max-h-[260px] overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(150,150,150,0.3)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 hover:[&::-webkit-scrollbar-thumb]:bg-black/20 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/20"
            >
              {thoughtGroups.map((group, gIdx) => {
                const isLatestGroup = gIdx === thoughtGroups.length - 1;
                const hasTools = group.tools.length > 0;
                // Live thought active while streaming and tools are executing
                const isThoughtActive = isStreaming && isLatestGroup && (!hasVisibleContent || group.tools.some((t) => t.isLive || t.status === 'running'));
                // Closed by default until user explicitly clicks to expand
                const isExpanded = Boolean(manualExpanded[group.id]);
                const thoughtText = typeof group.thought === 'string' ? group.thought : group.thought?.text || '';

                return (
                  <motion.div
                    key={group.id}
                    initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col w-full min-w-0"
                  >
                    {/* Thought Header Row */}
                    {group.thought ? (
                      <div
                        onClick={() => hasTools && toggleGroup(group.id)}
                        className={`flex items-start gap-2.5 text-[15px] leading-relaxed break-words py-0.5 rounded transition-colors w-full min-w-0 ${
                          hasTools ? 'cursor-pointer hover:text-neutral-900 dark:hover:text-[#f7f6f4] group/thought' : ''
                        }`}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {isThoughtActive ? (
                            <motion.div
                              key="quill"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{
                                opacity: 1,
                                scale: 1,
                                rotate: [-4, 6, -4],
                                y: [0, -1.2, 0],
                                x: [0, 0.8, 0],
                              }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              transition={{
                                opacity: { duration: 0.2 },
                                scale: { duration: 0.2 },
                                rotate: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
                                y: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
                                x: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' },
                              }}
                              className="shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86] mt-[4px]"
                            >
                              <HugeiconsIcon icon={QuillWrite01Icon} size={15.5} strokeWidth={1.8} />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="cloud"
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.85 }}
                              transition={{ duration: 0.22, ease: 'easeOut' }}
                              className="shrink-0 w-4 h-4 flex items-center justify-center text-neutral-400 dark:text-[#8e8b86] mt-[4px]"
                            >
                              <HugeiconsIcon icon={ThoughtBubbleIcon} size={15.5} strokeWidth={1.8} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <span
                          className={`flex-1 min-w-0 font-normal break-words [overflow-wrap:anywhere] ${
                            isThoughtActive
                              ? 'shimmer-sentence text-neutral-800 dark:text-neutral-200'
                              : 'text-neutral-500 dark:text-[#8e8b86]'
                          }`}
                        >
                          {thoughtText}
                        </span>

                        {/* Subtle chevron (no numbers) */}
                        {hasTools && (
                          <div className="shrink-0 flex items-center text-neutral-400 dark:text-[#787672] select-none pr-0.5 mt-[4px]">
                            <ChevronRight
                              size={13}
                              className={`transition-transform duration-200 text-neutral-400 dark:text-[#787672] ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Tool Execution Steps (flat along the same vertical line, no tree branches or extra indent) */}
                    {hasTools && (
                      <AnimatePresence initial={false}>
                        {(isExpanded || !group.thought) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden w-full min-w-0"
                          >
                            <div className="pt-1 pb-1 flex flex-col gap-1.5 w-full min-w-0">
                              {group.tools.map((step, tIdx) => {
                                const text = typeof step === 'string' ? step : step?.text || '';
                                const isLastTool = isStreaming && isLatestGroup && tIdx === group.tools.length - 1;
                                const isLive = isStreaming && isLastTool && step?.isLive !== false;
                                const endsWithChevron = text.trim().endsWith('>');
                                const cleanText = endsWithChevron ? text.trim().slice(0, -1).trim() : text;
                                const action = !isLive ? getStepAction(step) : null;
                                const isClickable = Boolean(action);

                                return (
                                  <motion.div
                                    key={step.url || step.query || step.text || tIdx}
                                    initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, y: -2 }}
                                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                    onClick={isClickable ? (e) => handleStepClick(e, action) : undefined}
                                    className={`flex items-start gap-2.5 text-[14.5px] leading-relaxed break-words w-full min-w-0 rounded transition-colors ${
                                      isClickable
                                        ? 'cursor-pointer hover:text-neutral-900 dark:hover:text-[#f7f6f4] group/step'
                                        : ''
                                    }`}
                                    title={action?.tooltip}
                                  >
                                    <div className="shrink-0 mt-[4px]">
                                      <StepIcon step={step} isLive={isLive} />
                                    </div>
                                    <span
                                      className={`flex-1 min-w-0 break-words [overflow-wrap:anywhere] ${
                                        isLive
                                          ? 'shimmer-sentence font-medium text-neutral-800 dark:text-neutral-200'
                                          : isClickable
                                          ? 'text-neutral-500 dark:text-[#8e8b86] font-normal group-hover/step:text-neutral-800 dark:group-hover/step:text-neutral-200 group-hover/step:underline underline-offset-2 decoration-neutral-300 dark:decoration-neutral-600'
                                          : 'text-neutral-500 dark:text-[#8e8b86] font-normal'
                                      }`}
                                    >
                                      {cleanText}
                                      {isClickable && (
                                        <span className="inline-block ml-1 opacity-0 group-hover/step:opacity-75 transition-opacity text-[11px] select-none text-neutral-400 dark:text-neutral-500 font-mono">
                                          ↗
                                        </span>
                                      )}
                                      {endsWithChevron && (
                                        <span className="inline-block ml-1 text-neutral-400 dark:text-neutral-500 text-[13px] select-none font-mono">
                                          &gt;
                                        </span>
                                      )}
                                    </span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </motion.div>
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
