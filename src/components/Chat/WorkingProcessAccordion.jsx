import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
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
 * PerCharShimmer: Smooth continuous shimmer sweep with zero glare and clean rest period.
 * Does not unmount characters, ensuring seamless continuity across text changes.
 */
export const PerCharShimmer = ({ text, className = '' }) => {
  if (!text) return null;
  return (
    <span
      className={`text-shimmer-continuous select-none whitespace-nowrap overflow-hidden truncate ${className}`}
    >
      {text}
    </span>
  );
};

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

  // Web search / Deep Research / Search queries (Magnifying glass icon)
  if (
    stateType === 'web_search' ||
    step?.tool === 'web_search' ||
    stateType === 'deep_research' ||
    stateType === 'research' ||
    lower.startsWith('searching') ||
    lower.includes('search for') ||
    lower.includes('searching for') ||
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
 * Natural phase tool summary helper:
 * - Live: "Searching the web, reading memory"
 * - Completed: "Searched the web, read memory"
 * - Live: "Searching the web, reading a page"
 * - Completed: "Searched the web, read a page"
 */
export function getPhaseToolSummary(tools = [], isLive = false) {
  if (!tools || tools.length === 0) return null;

  // Completed phase: prioritize tool-end completion events (e.g. "Reviewed 5 live web sources")
  if (!isLive) {
    const completionSummaries = [];
    tools.forEach((t) => {
      const summary = t?.completionEvent || (t?.type === 'tool_completion' ? t.text : null);
      if (summary && typeof summary === 'string') {
        const clean = summary.trim();
        if (clean && !completionSummaries.includes(clean)) {
          completionSummaries.push(clean);
        }
      }
    });

    if (completionSummaries.length > 0) {
      return completionSummaries.join(', ');
    }
  }

  let hasWebSearch = false;
  let hasDeepResearch = false;
  let hasMemory = false;
  let hasNotes = false;
  let hasPage = false;
  let hasTasks = false;
  let hasReconnect = false;

  let pageCount = 0;
  let singleDomain = '';

  tools.forEach((t) => {
    const text = typeof t === 'string' ? t : (t.text || '');
    const lower = text.toLowerCase();
    const st = t.stateType || '';
    const tool = t.tool || '';

    if (st === 'reconnecting' || lower.includes('reconnect') || lower.includes('trying to reconnect')) {
      hasReconnect = true;
    } else if (
      st === 'deep_research' ||
      tool === 'deep_research' ||
      lower.includes('deep research') ||
      lower.includes('researching') ||
      lower.includes('synthesizing')
    ) {
      hasDeepResearch = true;
    } else if (
      st === 'memory' ||
      st === 'remembering' ||
      tool === 'user_memory' ||
      lower.includes('memory') ||
      lower.includes('remember') ||
      lower.includes('yaad')
    ) {
      hasMemory = true;
    } else if (
      isWorkspaceNote(t, text) ||
      tool === 'search_workspace' ||
      st === 'workspace_search'
    ) {
      hasNotes = true;
    } else if (
      st === 'task_management' ||
      tool === 'manage_tasks' ||
      lower.includes('task') ||
      lower.includes('kanban')
    ) {
      hasTasks = true;
    } else if (
      t.domain ||
      t.url ||
      (lower.startsWith('read ') && !lower.includes('notes') && !lower.includes('memory'))
    ) {
      hasPage = true;
      pageCount++;
      if (!singleDomain && t.domain) singleDomain = t.domain;
    } else if (
      st === 'web_search' ||
      tool === 'web_search' ||
      lower.includes('search') ||
      lower.includes('web') ||
      lower.includes('google')
    ) {
      hasWebSearch = true;
    }
  });

  if (hasReconnect) {
    return isLive ? 'Trying to reconnect...' : 'Reconnected';
  }

  const actions = [];

  // 1. Deep Research
  if (hasDeepResearch) {
    if (hasPage && pageCount > 0) {
      actions.push(isLive ? `Conducting deep research across ${pageCount} sources` : `Researched deeply across ${pageCount} sources`);
    } else {
      actions.push(isLive ? 'Conducting deep research' : 'Researched deeply');
    }
  } else if (hasWebSearch) {
    actions.push(isLive ? 'Searching the web' : 'Searched the web');
  }

  // 2. Memory
  if (hasMemory) {
    const verb = actions.length > 0 ? (isLive ? 'reading' : 'read') : (isLive ? 'Reading' : 'Read');
    actions.push(`${verb} memory`);
  }

  // 3. Workspace notes
  if (hasNotes) {
    const verb = actions.length > 0 ? (isLive ? 'reading' : 'read') : (isLive ? 'Reading' : 'Read');
    actions.push(`${verb} notes`);
  }

  // 4. Web page
  if (hasPage) {
    const verb = actions.length > 0 ? (isLive ? 'reading' : 'read') : (isLive ? 'Reading' : 'Read');
    if (pageCount > 1) {
      actions.push(`${verb} ${pageCount} pages`);
    } else {
      actions.push(`${verb} a page`);
    }
  }

  // 5. Tasks
  if (hasTasks) {
    const verb = actions.length > 0 ? (isLive ? 'updating' : 'updated') : (isLive ? 'Updating' : 'Updated');
    actions.push(`${verb} tasks`);
  }

  if (actions.length === 0) {
    const firstText = typeof tools[0] === 'string' ? tools[0] : (tools[0]?.text || '');
    if (firstText) {
      return firstText.replace(/>\s*$/, '').trim();
    }
    return isLive ? 'Working' : 'Completed';
  }

  return actions.join(', ');
}

/**
 * Resolves the real-time active action metadata (key, label, icon) while running,
 * or the completed compound summary when finished.
 */
export function getPhaseActiveToolMeta(phase, isPhaseLive = false) {
  if (!phase || !phase.tools || phase.tools.length === 0) return null;

  const active = phase.tools[0];
  const isLive = isPhaseLive || Boolean(active?.isLive || active?.status === 'running');

  if (isLive) {
    const rawText = active?.runningLabel || active?.text || '';
    return {
      key: `live-${phase.id}-${rawText}`,
      label: rawText.replace(/>\s*$/, '').trim() || 'Working...',
      icon: null,
    };
  }

  // Completed phase: show natural compound summary or completion event
  const completedLabel = active?.resolvedLabel || active?.completionEvent;
  const summary = completedLabel || getPhaseToolSummary(phase.tools, false);
  if (!summary) return null;

  return {
    key: `completed-${phase.id}-${summary}`,
    label: summary,
    icon: null,
  };
}

/**
 * WorkingProcessAccordion:
 * Clean, interleaved narrative flow matching the reference design:
 * - Thought paragraphs rendered in serif font (Lora / Georgia), upright regular weight
 * - Natural past-tense summary line (e.g. "Searched the web, read memory >") in muted #8e8e93
 * - Active streaming tool summary uses .active-tool-shimmer with present continuous phrasing
 * - Thoughts and tool summary lines remain permanently visible above the answer
 * - Clicking '>' expands that phase's detailed step breakdown
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
  stoppedByUser = false,
}) => {
  const [openPhases, setOpenPhases] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  // Live timer for working duration
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

  // Aggregate visible steps
  const visibleSteps = useMemo(() => {
    let list = Array.isArray(steps) ? [...steps] : [];

    // Filter out raw planning fragments, numberings, or leaked monologues
    list = list.filter((s) => {
      if (!s) return false;
      // Completely reject any thought items - user explicitly wants NO internal thinking
      if (s.type === 'thought' || s.isThought) return false;

      const text = typeof s === 'string' ? s : (s.event || s.text || s.runningLabel || '');
      // Strip leaked monologue prefixes or numbering lines
      if (/^\s*(?:the\s+user|user\s+(?:wants|asked|needs)|things\s+in\s+one\s+turn|list\s+all\s+pending|this\s+down|profile\s+info|\b\d+[\.\)]|\.\s+|,\s*then\s+list|\bfor\s+(?:memory|listing|"launch|launch)|stack\s+and\s+project|them\s+in\s+parallel|list['"]?\s+i\s+need|and\s+my\s+main|with\s+status\s+todo|launch\s+checklist['"]?\s*\d)/i.test(text.trim())) {
        return false;
      }

      // Must be a valid tool call or research step
      const isToolStep = s.type === 'tool_call' || Boolean(s.tool) || s.stateType === 'deep_research' || (Array.isArray(s.subSteps) && s.subSteps.length > 0);
      return isToolStep;
    });

    // Fallback: If steps are empty (e.g. loaded from session/DB) but researchData exists
    if (list.length === 0 && researchData) {
      if (Array.isArray(researchData.steps) && researchData.steps.length > 0) {
        researchData.steps.forEach((st) => {
          list.push({
            id: st.id,
            type: 'tool_call',
            tool: 'deep_research',
            event: st.title,
            text: st.title,
            stateType: 'deep_research',
            isLive: st.status === 'in_progress',
            status: st.status === 'completed' ? 'success' : st.status,
          });
        });
      } else if (researchData.currentAction) {
        list.push({
          type: 'tool_call',
          tool: 'deep_research',
          event: researchData.currentAction,
          text: researchData.currentAction,
          stateType: 'deep_research',
          isLive: isStreaming,
        });
      }
    }

    return list;
  }, [steps, researchData, isStreaming]);

  const hasActiveRunningStep = useMemo(() => {
    return visibleSteps.some((s) => s?.isLive || s?.status === 'running');
  }, [visibleSteps]);

  // Response has arrived when text content exists or streaming has finished
  const hasResponseArrived = Boolean(
    hasVisibleContent ||
    (finalContent && finalContent.trim().length > 0) ||
    (!isStreaming && visibleSteps.length > 0)
  );

  const frozenElapsedRef = useRef(null);

  useEffect(() => {
    if (hasResponseArrived && frozenElapsedRef.current === null) {
      frozenElapsedRef.current = elapsed;
    }
  }, [hasResponseArrived, elapsed]);

  const displaySeconds = duration || frozenElapsedRef.current || elapsed;

  const isResearch = useMemo(() => {
    if (stateType === 'deep_research' || stateType === 'research') return true;
    if (Boolean(researchData)) return true;
    return visibleSteps.some(
      (s) =>
        s?.stateType === 'deep_research' ||
        s?.stateType === 'research' ||
        s?.domain === 'deep_research' ||
        (typeof s?.text === 'string' && /deep\s+research/i.test(s.text))
    );
  }, [stateType, researchData, visibleSteps]);

  // Each tool call creates its own distinct row:
  // - Shimmers while live with PerCharShimmer
  // - Resolves on completion to its summary with chevron >
  const narrativePhases = useMemo(() => {
    const phases = [];

    visibleSteps.forEach((step, idx) => {
      if (!step) return;
      const text = typeof step === 'string' ? step : (step.text || step.runningLabel || '');
      // Strip any raw monologue / planning fragments
      if (/^\s*(?:the\s+user|user\s+wants|i\s+need\s+to|let\s+me|things\s+in\s+one\s+turn)\b/i.test(text.trim())) {
        return;
      }

      phases.push({
        id: step.id || `phase-${idx}`,
        thought: null,
        tools: [step],
      });
    });

    // Fallback: If no phases were formed, but status exists
    if (phases.length === 0 && status && !/^thinking(\.{1,3})?$/i.test(status.trim())) {
      phases.push({
        id: 'phase-status',
        thought: null,
        tools: [{ text: status, stateType: stateType || 'action', isLive: isStreaming }],
      });
    }

    return phases;
  }, [visibleSteps, status, stateType, isStreaming]);

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

  const togglePhase = (stepId) => {
    setOpenPhases((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Active running event during live streaming
  const runningStep = useMemo(() => {
    return visibleSteps.find((s) => s?.isLive || s?.status === 'running') || visibleSteps[visibleSteps.length - 1];
  }, [visibleSteps]);

  const activeLiveEvent = useMemo(() => {
    const raw = runningStep?.event || runningStep?.runningLabel || runningStep?.text || (status && !/^thinking(\.{1,3})?$/i.test(status.trim()) && !/^reasoning(\.{1,3})?$/i.test(status.trim()) ? status : null);
    if (!raw) return 'Working';
    const isMonologue = /^\s*(?:the\s+user|user\s+wants|i\s+need\s+to|let\s+me|things\s+in\s+one\s+turn)\b/i.test(raw.trim());
    return isMonologue ? 'Working' : raw.replace(/>\s*$/, '').trim();
  }, [runningStep, status]);

  // Action text for running tool line when expanded during live execution (Image match!)
  const runningToolActionText = useMemo(() => {
    if (!runningStep) return null;
    if (runningStep.execMessage && runningStep.execMessage !== activeLiveEvent) {
      return runningStep.execMessage;
    }
    if (runningStep.query) {
      return runningStep.tool === 'web_search'
        ? `Searching for "${runningStep.query}"`
        : `Searching notes for "${runningStep.query}"`;
    }
    if (runningStep.runningLabel && runningStep.runningLabel !== activeLiveEvent) {
      return runningStep.runningLabel;
    }
    if (runningStep.tool) {
      return `Running ${runningStep.tool}...`;
    }
    return null;
  }, [runningStep, activeLiveEvent]);

  return (
    <div className="w-full my-1.5 select-none font-sans text-left" style={{ fontFamily: '"Kag_Z Sans", sans-serif', fontWeight: 300 }}>
      {hasResponseArrived ? (
        <div className="w-full">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="group/toggle inline-flex items-center text-left text-[14.5px] sm:text-[15px] font-light transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 outline-none text-[#8e8e93] hover:text-[#5a5a5e] dark:text-[#8e8e93] dark:hover:text-[#d1d1d6]"
            title={isExpanded ? 'Click to collapse' : 'Click to expand'}
          >
            <span className="font-light tracking-[-0.01em]" style={{ fontFamily: '"Kag_Z Sans", sans-serif', fontWeight: 300 }}>
              {stoppedByUser
                ? "You stopped KagZ's response"
                : isResearch
                ? `Researched for ${formatDuration(displaySeconds)}`
                : `Worked for ${formatDuration(displaySeconds)}`}
            </span>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={14}
              strokeWidth={1.8}
              className={`ml-1.5 shrink-0 text-[#8e8e93] group-hover/toggle:text-[#5a5a5e] dark:text-[#8e8e93] dark:group-hover/toggle:text-[#d1d1d6] transition-transform duration-150 ease-out ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden mt-3 space-y-4"
              >
                {visibleSteps.map((step, idx) => {
                  const eventText = step.event || step.runningLabel || step.text;
                  const completionSummary = step.resolvedLabel || step.completionEvent || step.execMessage || step.tool;
                  const isDetailOpen = Boolean(openPhases[step.id || idx]);
                  const action = getStepAction(step);
                  
                  // Concrete sub-steps for this tool (e.g. searching query, read files/sources)
                  let subItems = Array.isArray(step.subSteps) ? [...step.subSteps] : [];
                  if (subItems.length === 0) {
                    if (step.execMessage && step.execMessage !== eventText && step.execMessage !== completionSummary) {
                      subItems.push({ text: step.execMessage, stateType: step.stateType });
                    }
                    if (Array.isArray(sources) && (step.tool === 'search_workspace' || step.tool === 'web_search')) {
                      sources.forEach((s) => {
                        subItems.push({
                          text: s.domain ? `Read ${s.domain}` : `Read ${s.title || s.url}`,
                          url: s.url,
                          domain: s.domain,
                          title: s.title,
                          stateType: step.stateType,
                        });
                      });
                    }
                  }

                  const hasSubItems = subItems.length > 0;

                  return (
                    <div key={step.id || idx} className="flex flex-col gap-1.5 text-left select-text">
                      {/* 1. Human Event Narration (Serif, upright regular, off-white #ededed) */}
                      <div
                        style={{ fontFamily: 'var(--font-quote)' }}
                        className="text-[15px] sm:text-[15.5px] leading-relaxed text-[#ededed] dark:text-[#edece8] select-text"
                      >
                        {eventText}
                      </div>

                      {/* 2. Tool Completion Summary with chevron (Muted #8e8e93, sans-serif) */}
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={hasSubItems ? () => togglePhase(step.id || idx) : (action ? (e) => handleStepClick(e, action) : undefined)}
                          className="group/toggle inline-flex items-center text-left text-[14px] sm:text-[14.5px] font-light transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 outline-none text-[#8e8e93] hover:text-[#5a5a5e] dark:text-[#8e8e93] dark:hover:text-[#d1d1d6] select-none"
                          title={hasSubItems ? (isDetailOpen ? 'Click to collapse steps' : 'Click to expand steps') : undefined}
                        >
                          <span className="font-light tracking-[-0.01em]">
                            {completionSummary}
                          </span>
                          {hasSubItems && (
                            <HugeiconsIcon
                              icon={ArrowRight01Icon}
                              size={13}
                              strokeWidth={1.8}
                              className={`ml-1 text-[#8e8e93] group-hover/toggle:text-[#d1d1d6] transition-transform duration-150 ease-out ${
                                isDetailOpen ? 'rotate-90' : ''
                              }`}
                            />
                          )}
                        </button>
                      </div>

                      {/* 3. Expanded concrete sub-steps breakdown with icons (Image 2) */}
                      <AnimatePresence initial={false}>
                        {isDetailOpen && hasSubItems && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden mt-1 mb-2"
                          >
                            <div className="border-l border-white/[0.08] ml-1 pl-3.5 py-1 flex flex-col gap-2 max-h-[240px] overflow-y-auto overscroll-contain pr-2 custom-scrollbar text-[13px]">
                              {subItems.map((sub, sIdx) => {
                                const subText = typeof sub === 'string' ? sub : sub?.text || '';
                                const subAction = getStepAction(sub);
                                const isClickable = Boolean(subAction);
                                return (
                                  <div
                                    key={sIdx}
                                    onClick={isClickable ? (e) => handleStepClick(e, subAction) : undefined}
                                    className={`flex items-center gap-2 text-neutral-600 dark:text-[#9c9a95] ${
                                      isClickable ? 'cursor-pointer hover:text-black dark:hover:text-white group' : ''
                                    }`}
                                    title={subAction?.tooltip}
                                  >
                                    <div className="shrink-0">
                                      <StepIcon step={sub} isLive={false} />
                                    </div>
                                    <span className={`truncate ${isClickable ? 'group-hover:underline underline-offset-2' : ''}`}>
                                      {subText}
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
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        /* Live execution: Collapsed shows single line with smooth fade + chevron gliding on length changes; Expanded opens with shimmer shifted to tool line (Image match!) */
        <div className="w-full my-1.5 select-none text-left">
          {!isExpanded ? (
            <div className="w-full flex items-center max-w-full">
              <LayoutGroup id="live-process-accordion">
                <motion.button
                  layout="position"
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                  className="group/live inline-flex items-center text-left text-[14px] sm:text-[14.5px] font-light transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 outline-none text-[#8e8e93] hover:text-[#d1d1d6] select-none max-w-full min-w-0"
                  title="Click to expand"
                >
                  <motion.span
                    layout="position"
                    transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                    className="inline-flex items-center truncate whitespace-nowrap min-w-0 max-w-[calc(100vw-130px)] sm:max-w-[560px] md:max-w-[660px]"
                  >
                    <PerCharShimmer
                      text={activeLiveEvent}
                      className="font-light tracking-[-0.01em]"
                    />
                  </motion.span>
                  <motion.span
                    layout="position"
                    transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                    className="inline-flex items-center ml-1.5 shrink-0 text-[#8e8e93] group-hover/live:text-[#d1d1d6]"
                  >
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={14}
                      strokeWidth={1.8}
                      className="transition-transform duration-150 ease-out"
                    />
                  </motion.span>
                </motion.button>
              </LayoutGroup>
            </div>
          ) : (
            <div className="w-full">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="group/toggle inline-flex items-center text-left text-[14.5px] sm:text-[15px] font-light transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 outline-none text-[#8e8e93] hover:text-[#5a5a5e] dark:text-[#8e8e93] dark:hover:text-[#d1d1d6]"
                title="Click to collapse"
              >
                <span className="font-light tracking-[-0.01em]" style={{ fontFamily: '"Kag_Z Sans", sans-serif', fontWeight: 300 }}>
                  {isResearch ? `Researched for ${formatDuration(elapsed)}` : `Worked for ${formatDuration(elapsed)}`}
                </span>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  size={14}
                  strokeWidth={1.8}
                  className="ml-1.5 shrink-0 text-[#8e8e93] group-hover/toggle:text-[#d1d1d6] rotate-90 transition-transform duration-150 ease-out"
                />
              </button>

              <div className="overflow-hidden mt-3 space-y-4">
                {/* Any completed steps before the current running step */}
                {visibleSteps.filter(s => !s.isLive && s.status !== 'running').map((step, idx) => {
                  const eventText = step.event || step.runningLabel || step.text;
                  const completionSummary = step.resolvedLabel || step.completionEvent || step.execMessage || step.tool;
                  const isDetailOpen = Boolean(openPhases[step.id || idx]);
                  const action = getStepAction(step);
                  const subItems = Array.isArray(step.subSteps) ? step.subSteps : [];
                  const hasSubItems = subItems.length > 0;

                  return (
                    <div key={step.id || idx} className="flex flex-col gap-1.5 text-left select-text">
                      <div
                        style={{ fontFamily: 'var(--font-quote)' }}
                        className="text-[15px] sm:text-[15.5px] leading-relaxed text-[#ededed] dark:text-[#edece8] select-text"
                      >
                        {eventText}
                      </div>
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={hasSubItems ? () => togglePhase(step.id || idx) : (action ? (e) => handleStepClick(e, action) : undefined)}
                          className="group/toggle inline-flex items-center text-left text-[14px] sm:text-[14.5px] font-light transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 outline-none text-[#8e8e93] hover:text-[#5a5a5e] dark:text-[#8e8e93] dark:hover:text-[#d1d1d6] select-none"
                        >
                          <span className="font-light tracking-[-0.01em]">{completionSummary}</span>
                          {hasSubItems && (
                            <HugeiconsIcon
                              icon={ArrowRight01Icon}
                              size={13}
                              strokeWidth={1.8}
                              className={`ml-1 text-[#8e8e93] group-hover/toggle:text-[#d1d1d6] transition-transform duration-150 ease-out ${
                                isDetailOpen ? 'rotate-90' : ''
                              }`}
                            />
                          )}
                        </button>
                      </div>

                      {/* Expanded concrete sub-steps breakdown with icons (matching Image 2) */}
                      <AnimatePresence initial={false}>
                        {isDetailOpen && hasSubItems && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden mt-1 mb-2"
                          >
                            <div className="border-l border-white/[0.08] ml-1 pl-3.5 py-1 flex flex-col gap-2 max-h-[240px] overflow-y-auto overscroll-contain pr-2 custom-scrollbar text-[13px]">
                              {subItems.map((sub, sIdx) => {
                                const subText = typeof sub === 'string' ? sub : sub?.text || '';
                                const subAction = getStepAction(sub);
                                const isClickable = Boolean(subAction);
                                return (
                                  <div
                                    key={sIdx}
                                    onClick={isClickable ? (e) => handleStepClick(e, subAction) : undefined}
                                    className={`flex items-center gap-2 text-neutral-600 dark:text-[#9c9a95] ${
                                      isClickable ? 'cursor-pointer hover:text-black dark:hover:text-white group' : ''
                                    }`}
                                    title={subAction?.tooltip}
                                  >
                                    <div className="shrink-0">
                                      <StepIcon step={sub} isLive={false} />
                                    </div>
                                    <span className={`truncate ${isClickable ? 'group-hover:underline underline-offset-2' : ''}`}>
                                      {subText}
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
                })}

                {/* Active Running Step: Event on Line 1, Shimmer shifted on Tool on Line 2 (Exact match to uploaded image) */}
                <div className="flex flex-col gap-1.5 text-left select-text">
                  {/* Line 1: Human Event Narration (Serif, upright regular, #ededed) */}
                  <div
                    style={{ fontFamily: 'var(--font-quote)' }}
                    className="text-[15px] sm:text-[15.5px] leading-relaxed text-[#ededed] dark:text-[#edece8] select-text"
                  >
                    {activeLiveEvent}
                  </div>

                  {/* Line 2: Tool with Shimmer Effect (Shimmer shifted on tool!) */}
                  {runningToolActionText && runningToolActionText !== activeLiveEvent && (
                    <div className="flex items-center gap-2 text-[14px] sm:text-[14.5px] text-neutral-400 dark:text-[#9c9a95]">
                      <div className="shrink-0">
                        <StepIcon step={runningStep || { tool: 'web_search' }} isLive={true} />
                      </div>
                      <PerCharShimmer
                        text={runningToolActionText}
                        className="font-light tracking-[-0.01em]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(WorkingProcessAccordion);
