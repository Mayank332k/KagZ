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

  // 1. Web search
  if (hasWebSearch) {
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

  if (isPhaseLive) {
    const runningStep = phase.tools.find((s) => s?.isLive || s?.status === 'running');
    const active = runningStep || phase.tools[phase.tools.length - 1];

    if (active) {
      const rawText = typeof active === 'string' ? active : (active.text || '');
      const lower = rawText.toLowerCase();

      // 1. Reconnecting
      if (active.stateType === 'reconnecting' || lower.includes('reconnect') || lower.includes('trying to reconnect')) {
        return {
          key: 'reconnecting',
          label: 'Trying to reconnect...',
          icon: <HugeiconsIcon icon={WifiDisconnected01Icon} size={14.5} strokeWidth={1.8} />,
        };
      }

      // 2. Reading specific web domain or URL (e.g. "Reading linkedin.com")
      if (active.domain || (lower.startsWith('read ') && !lower.includes('notes') && !lower.includes('memory'))) {
        const domain = active.domain || extractDomain(rawText);
        return {
          key: `reading-${domain || 'page'}`,
          label: domain ? `Reading ${domain}` : 'Reading a page',
          icon: domain ? <FaviconIcon domain={domain} /> : <HugeiconsIcon icon={BookOpen02Icon} size={14.5} strokeWidth={1.8} />,
        };
      }

      // 3. Workspace notes
      if (isWorkspaceNote(active, rawText) || lower.includes('notes')) {
        const query = active.query || (/Searching notes for "(.*?)"/i.exec(rawText)?.[1]);
        return {
          key: `notes-${query || 'workspace'}`,
          label: query ? `Searching notes for "${query}"` : 'Reading notes',
          icon: <HugeiconsIcon icon={BookOpen02Icon} size={14.5} strokeWidth={1.8} />,
        };
      }

      // 4. Memory update
      if (active.stateType === 'memory' || lower.includes('saving memory') || lower.includes('saved to memory') || lower.includes('updating memory')) {
        return {
          key: 'memory-update',
          label: 'Updating memory',
          icon: <HugeiconsIcon icon={QuillWrite02Icon} size={14.5} strokeWidth={1.8} />,
        };
      }

      // 5. Memory recall
      if (active.stateType === 'remembering' || lower.includes('recalled memory') || lower.includes('memory') || lower.includes('remember') || lower.includes('yaad')) {
        return {
          key: 'memory-recall',
          label: 'Reading memory',
          icon: <HugeiconsIcon icon={BookOpen01Icon} size={14.5} strokeWidth={1.8} />,
        };
      }

      // 6. Tasks
      if (active.stateType === 'task_management' || lower.includes('task') || lower.includes('kanban')) {
        return {
          key: 'tasks',
          label: 'Updating tasks',
          icon: <HugeiconsIcon icon={Quiz04Icon} size={14.5} strokeWidth={1.8} />,
        };
      }

      // 7. Web Search query (e.g. "Searching for \"recent jobs\"")
      const webQueryMatch = active.query || (/Searching web for "(.*?)"/i.exec(rawText)?.[1]) || (/Search web for "(.*?)"/i.exec(rawText)?.[1]);
      if (webQueryMatch) {
        return {
          key: `searching-${webQueryMatch}`,
          label: `Searching for "${webQueryMatch}"`,
          icon: <HugeiconsIcon icon={Search01Icon} size={14.5} strokeWidth={1.8} />,
        };
      }

      // 8. General search
      return {
        key: `searching-${rawText}`,
        label: rawText.replace(/>\s*$/, '').trim() || 'Searching the web',
        icon: <HugeiconsIcon icon={Search01Icon} size={14.5} strokeWidth={1.8} />,
      };
    }
  }

  // Completed phase: show natural compound summary
  const summary = getPhaseToolSummary(phase.tools, false);
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

  const displaySeconds = duration || elapsed;

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

  // Group steps and thoughts into chronological narrative phases
  const narrativePhases = useMemo(() => {
    const phases = [];
    let currentPhase = null;

    const startPhase = (thoughtText = null) => {
      if (currentPhase && (currentPhase.thought || currentPhase.tools.length > 0)) {
        phases.push(currentPhase);
      }
      currentPhase = {
        id: `phase-${phases.length}`,
        thought: thoughtText,
        tools: [],
      };
    };

    visibleSteps.forEach((step) => {
      if (step?.type === 'thought' || step?.isThought) {
        const text = typeof step.text === 'string' ? step.text.trim() : '';
        if (!text) return;

        // Check if this step is actually a tool completion event
        const isToolCompletion =
          step?.type === 'tool_completion' ||
          step?.completionEvent ||
          /^Reviewed\s+\d+\s+live\s+web\s+source/i.test(text) ||
          /^Reviewed\s+relevant\s+workspace\s+notes/i.test(text) ||
          /^Context\s+updated\s+in\s+memory/i.test(text) ||
          /^Updated\s+tasks\s+&\s+Kanban\s+board/i.test(text) ||
          /^Deep\s+research\s+synthesis\s+ready/i.test(text) ||
          /^Web\s+search\s+complete/i.test(text);

        if (isToolCompletion) {
          if (!currentPhase) {
            currentPhase = { id: `phase-0`, thought: null, tools: [] };
          }
          currentPhase.tools.push({
            ...step,
            type: 'tool_completion',
            completionEvent: step.completionEvent || text,
          });
          return;
        }

        // If current phase already executed tools, start a new phase with this thought
        if (currentPhase && currentPhase.tools.length > 0) {
          startPhase(text);
        } else {
          // If current phase has no tools, update or initialize with this thought
          if (!currentPhase) {
            currentPhase = { id: `phase-0`, thought: text, tools: [] };
          } else {
            currentPhase.thought = text;
          }
        }
      } else {
        // Concrete execution step
        if (!currentPhase) {
          currentPhase = { id: `phase-0`, thought: null, tools: [] };
        }
        currentPhase.tools.push(step);
      }
    });

    if (currentPhase && (currentPhase.thought || currentPhase.tools.length > 0)) {
      phases.push(currentPhase);
    }

    // Merge thoughts from <think> tag if visibleSteps had no explicit thought steps
    if (Array.isArray(thoughts) && thoughts.length > 0) {
      const cleanThoughts = thoughts
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter((t) => t && !t.startsWith('```'));

      if (cleanThoughts.length > 0) {
        if (phases.length === 0) {
          cleanThoughts.forEach((th, i) => {
            phases.push({ id: `phase-th-${i}`, thought: th, tools: [] });
          });
        } else if (!phases[0].thought) {
          phases[0].thought = cleanThoughts[0];
          for (let i = 1; i < cleanThoughts.length; i++) {
            if (phases[i]) {
              if (!phases[i].thought) phases[i].thought = cleanThoughts[i];
            } else {
              phases.push({ id: `phase-th-${i}`, thought: cleanThoughts[i], tools: [] });
            }
          }
        }
      }
    }

    // Fallback: If no phases were formed, but status exists
    if (phases.length === 0 && status && !/^thinking(\.{1,3})?$/i.test(status.trim())) {
      phases.push({
        id: 'phase-status',
        thought: null,
        tools: [{ text: status, stateType: stateType || 'action', isLive: isStreaming }],
      });
    }

    return phases;
  }, [visibleSteps, thoughts, status, stateType, isStreaming]);

  // Response has arrived when text content exists or streaming has finished
  const hasResponseArrived = Boolean(
    hasVisibleContent ||
    (finalContent && finalContent.trim().length > 0) ||
    (!isStreaming && visibleSteps.length > 0)
  );

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

  const togglePhase = (phaseId) => {
    setOpenPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  // If there are no phases to display, do not render
  if (narrativePhases.length === 0) return null;

  // Renders the narrative phases list
  const renderNarrativePhases = (isLiveContext = false) => {
    return narrativePhases.map((phase, pIdx) => {
      const isPhaseLive = isLiveContext && isStreaming && pIdx === narrativePhases.length - 1 && hasActiveRunningStep;
      const toolMeta = getPhaseActiveToolMeta(phase, isPhaseLive);
      const isOpen = Boolean(openPhases[phase.id]);
      const concreteSteps = phase.tools.filter((step) => step?.type !== 'tool_completion');
      const hasTools = concreteSteps.length > 0;

      return (
        <motion.div
          key={phase.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          {/* 1. Thought in Serif font (Lora / Georgia), upright regular weight */}
          {phase.thought && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="mb-2 select-text"
            >
              <span
                style={{ fontFamily: 'var(--font-quote)' }}
                className="inline-block text-neutral-800 dark:text-[#e4e2dd] text-[15px] sm:text-[15.5px] leading-relaxed select-text"
              >
                {phase.thought}
              </span>
            </motion.div>
          )}

          {/* 2. Tool State: Sleek single-line with smooth instant cross-fade */}
          {toolMeta && (
            <div className="my-1 select-none flex items-center max-w-full">
              <button
                type="button"
                onClick={hasTools ? () => togglePhase(phase.id) : undefined}
                className="group/toggle inline-flex items-center text-left text-[14.5px] sm:text-[15px] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 outline-none max-w-full min-w-0"
                title={hasTools ? (isOpen ? 'Click to collapse steps' : 'Click to expand steps') : (toolMeta.label || undefined)}
              >
                {/* Left Tool Icon (Only present during live tools; null on completed summary) */}
                {toolMeta.icon && (
                  <span className="shrink-0 mr-2 flex items-center justify-center text-[#8e8e93] dark:text-[#98989f]">
                    {toolMeta.icon}
                  </span>
                )}

                {/* Text with active-tool-shimmer during streaming, muted grey when completed */}
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={toolMeta.key}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -3 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className={`truncate max-w-[calc(100vw-130px)] sm:max-w-[560px] md:max-w-[660px] font-normal tracking-[-0.01em] ${
                      isPhaseLive
                        ? 'active-tool-shimmer'
                        : 'text-[#8e8e93] dark:text-[#8e8e93] group-hover/toggle:text-[#636366] dark:group-hover/toggle:text-[#aeaeb2]'
                    }`}
                    title={toolMeta.label}
                  >
                    {toolMeta.label}
                  </motion.span>
                </AnimatePresence>

                {/* Dynamic '>' arrow (visible on hover or when expanded) */}
                {hasTools && (
                  <ChevronRight
                    size={14}
                    className={`ml-1.5 shrink-0 text-[#8e8e93] group-hover/toggle:text-[#5a5a5e] dark:text-[#8e8e93] dark:group-hover/toggle:text-[#d1d1d6] transition-all duration-150 ease-out ${
                      isOpen
                        ? 'opacity-100 rotate-90'
                        : 'opacity-0 group-hover/toggle:opacity-100'
                    }`}
                  />
                )}
              </button>
            </div>
          )}

          {/* 3. Expanded step breakdown for this phase */}
          <AnimatePresence initial={false}>
            {isOpen && hasTools && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden mt-2 mb-2"
              >
                <div className="border-l border-black/[0.06] dark:border-white/[0.08] ml-1 pl-3 py-1 flex flex-col gap-2 max-h-[220px] overflow-y-auto overscroll-contain pr-2 custom-scrollbar text-[13px]">
                  {concreteSteps.map((step, sIdx) => {
                    const text = typeof step === 'string' ? step : step?.text || '';
                    const action = getStepAction(step);
                    const isClickable = Boolean(action);
                    const isStepLive = isPhaseLive && sIdx === concreteSteps.length - 1 && step?.isLive !== false;
                    return (
                      <div
                        key={step?.id ? `${step.id}-${sIdx}` : `${step?.url || step?.query || step?.text || 'step'}-${sIdx}`}
                        onClick={isClickable ? (e) => handleStepClick(e, action) : undefined}
                        className={`flex items-center gap-2 text-neutral-600 dark:text-neutral-400 ${
                          isClickable ? 'cursor-pointer hover:text-black dark:hover:text-white group' : ''
                        }`}
                        title={action?.tooltip}
                      >
                        <div className="shrink-0">
                          <StepIcon step={step} isLive={isStepLive} />
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
        </motion.div>
      );
    });
  };

  return (
    <div className="w-full my-1.5 select-none font-sans text-left">
      <AnimatePresence mode="wait">
        {hasResponseArrived ? (
          /* Response arrived: Smoothly collapsed into "Worked for {N}s >" */
          <motion.div
            key="collapsed-worked-container"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="w-full"
          >
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="group/toggle inline-flex items-center text-left text-[14.5px] sm:text-[15px] font-normal transition-colors cursor-pointer bg-transparent border-0 p-0 m-0 outline-none text-[#8e8e93] dark:text-[#8e8e93] hover:text-[#5a5a5e] dark:hover:text-[#d1d1d6]"
              title={isExpanded ? 'Click to collapse steps' : 'Click to expand steps'}
            >
              <span className="font-normal tracking-[-0.01em]">
                {stoppedByUser
                  ? "You stopped KagZ's response"
                  : `Worked for ${formatDuration(displaySeconds)}`}
              </span>
              <ChevronRight
                size={13.5}
                className={`ml-1.5 shrink-0 text-[#8e8e93] group-hover/toggle:text-[#5a5a5e] dark:text-[#8e8e93] dark:group-hover/toggle:text-[#d1d1d6] transition-all duration-150 ease-out ${
                  isExpanded
                    ? 'opacity-100 rotate-90'
                    : 'opacity-0 group-hover/toggle:opacity-100'
                }`}
              />
            </button>

            {/* Expanded narrative flow when user clicks "Worked for {N}s >" */}
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden mt-2.5 mb-1.5"
                >
                  <div className="space-y-3.5 pl-0.5 border-l border-black/[0.06] dark:border-white/[0.08] ml-1 pl-3.5 py-1">
                    {renderNarrativePhases(false)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          /* Live Mode: Active research narrative while working before response arrives */
          <motion.div
            key="live-narrative-container"
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="w-full space-y-3.5"
          >
            {renderNarrativePhases(true)}

            {/* Active Thinking below the last completed event until next event or response arrives */}
            <AnimatePresence>
              {isStreaming && !hasResponseArrived && !hasActiveRunningStep && (
                <motion.div
                  key="live-inter-thinking"
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="inline-flex items-center text-[14.5px] sm:text-[15px] font-normal text-[#8e8e93] dark:text-[#98989f] select-none my-1"
                >
                  <span className="active-tool-shimmer font-normal tracking-[-0.01em]">
                    Thinking...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(WorkingProcessAccordion);
