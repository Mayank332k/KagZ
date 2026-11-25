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
 * Parses <think>...</think>, <thought>...</thought>, <thinking>...</thinking>,
 * <reasoning>...</reasoning>, <plan>...</plan> tags from content.
 * Gracefully handles unclosed tags during active streaming and strips
 * leading meta-planning monologues if any leaked through.
 */
export function parseThoughtAndContent(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { thoughts: [], finalContent: '', isThinkingTagActive: false };
  }

  const thoughts = [];
  let content = rawContent;
  let isThinkingTagActive = false;

  // 1. Match closed thought tags with optional attributes: <think>, <thought>, <thinking>, <reasoning>, <plan>
  const closedRegex = /<(?:think|thought|thinking|reasoning|plan)(?:\s+[^>]*)?>([\s\S]*?)<\/(?:think|thought|thinking|reasoning|plan)>/gi;
  let match;
  while ((match = closedRegex.exec(content)) !== null) {
    if (match[1] && match[1].trim()) {
      thoughts.push(match[1].trim());
    }
  }
  content = content.replace(closedRegex, '');

  // 2. Check for unclosed opening tag at the tail (during streaming)
  const openRegex = /<(?:think|thought|thinking|reasoning|plan)(?:\s+[^>]*)?>([\s\S]*)$/i;
  const openMatch = openRegex.exec(content);
  if (openMatch) {
    isThinkingTagActive = true;
    if (openMatch[1] && openMatch[1].trim()) {
      thoughts.push(openMatch[1].trim());
    }
    content = content.replace(openRegex, '');
  }

  // 3. Fallback: If content still has leading meta-planning monologue ("The user wants me to do multiple things..."),
  // strip it completely from visible response content so internal thinking is never rendered
  const monologuePrefix = /^\s*(?:the\s+user\s+(?:wants|is\s+asking|asked|needs)|user\s+(?:wants|asked|is\s+asking|needs)|things\s+in\s+one\s+turn|i\s+(?:need|must|should|will|am\s+going|have\s+to)|let\s+me|first,\s*(?:let\s+me|i)|alright|okay|to\s+answer|in\s+order\s+to|\d+[\.\)]|\-|\*)\b/i;

  if (monologuePrefix.test(content.trim())) {
    const parts = content.trim().split(/\n+/);
    const answerParts = [];
    let foundAnswer = false;

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].trim();
      if (foundAnswer) {
        answerParts.push(parts[i]);
        continue;
      }
      const isStep = /^(?:\d+[\.\)]|\-|\*|\.|\b(?:first|second|third|fourth|then|next|finally|remember|search|add|tell|check)\b)/i.test(p);
      const isMonologue = i === 0 || isStep || monologuePrefix.test(p);

      if (!isMonologue) {
        foundAnswer = true;
        answerParts.push(parts[i]);
      }
    }

    content = answerParts.join('\n').trim();
  }

  return {
    thoughts,
    finalContent: content.trimStart(),
    isThinkingTagActive,
  };
}
