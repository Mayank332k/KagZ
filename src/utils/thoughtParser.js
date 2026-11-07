/**
 * Resolves the semantic stateType from type and descriptive text
 */
export function resolveStateType(type, text) {
  if (
    type === 'web_search' ||
    type === 'workspace_search' ||
    type === 'search_workspace' ||
    type === 'deep_research' ||
    type === 'reconnecting' ||
    type === 'task_management' ||
    type === 'manage_tasks' ||
    type === 'remembering' ||
    type === 'user_memory' ||
    type === 'memory'
  ) {
    if (type === 'manage_tasks') return 'task_management';
    if (type === 'search_workspace') return 'workspace_search';
    if (type === 'user_memory') return 'remembering';
    return type;
  }
  if (!text) return 'thinking';
  const lower = text.toLowerCase();
  if (lower.includes('remember') || lower.includes('memory') || lower.includes('yaad')) {
    return 'remembering';
  }
  if (lower.includes('reconnect') || lower.includes('trying to reconnect') || lower.includes('wifi')) {
    return 'reconnecting';
  }
  if (
    lower.includes('task') ||
    lower.includes('fetching your task') ||
    lower.includes('creating task') ||
    lower.includes('updating task') ||
    lower.includes('deleting task') ||
    lower.includes('managing task') ||
    lower.includes('kanban')
  ) {
    return 'task_management';
  }
  if (
    lower.includes('file') ||
    lower.includes('workspace') ||
    lower.includes('note') ||
    lower.includes('document')
  ) {
    return 'workspace_search';
  }
  if (
    lower.includes('web') ||
    lower.includes('google') ||
    lower.includes('internet') ||
    lower.includes('search')
  ) {
    return 'web_search';
  }
  return 'thinking';
}

/**
 * Parses <think>...</think> or <thought>...</thought> tags from content.
 * Gracefully handles unclosed tags during active streaming.
 */
export function parseThoughtAndContent(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { thoughts: [], finalContent: '', isThinkingTagActive: false };
  }

  const thoughts = [];
  let content = rawContent;
  let isThinkingTagActive = false;

  // 1. Match closed <think>...</think> or <thought>...</thought>
  const closedRegex = /<(?:think|thought)>([\s\S]*?)<\/(?:think|thought)>/gi;
  let match;
  while ((match = closedRegex.exec(content)) !== null) {
    if (match[1] && match[1].trim()) {
      thoughts.push(match[1].trim());
    }
  }
  content = content.replace(closedRegex, '');

  // 2. Check for unclosed opening tag at the tail (during streaming)
  const openRegex = /<(?:think|thought)>([\s\S]*)$/i;
  const openMatch = openRegex.exec(content);
  if (openMatch) {
    isThinkingTagActive = true;
    if (openMatch[1] && openMatch[1].trim()) {
      thoughts.push(openMatch[1].trim());
    }
    content = content.replace(openRegex, '');
  }

  return {
    thoughts,
    finalContent: content.trimStart(),
    isThinkingTagActive,
  };
}
