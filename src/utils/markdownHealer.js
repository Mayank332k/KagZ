/**
 * Markdown Healer for Active Streaming
 * 
 * Auto-closes incomplete markdown blocks (code fences, math equations, bold tags)
 * while a stream is actively typing. Prevents visual jumps, parser errors,
 * or layout breaks when a token splits in the middle of a markdown structure.
 */

export function healStreamingMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  let inCodeBlock = false;
  let codeFenceType = '';
  const lines = text.split('\n');

  // Track code blocks line-by-line
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeFenceType = trimmed.slice(3).trim();
      } else {
        inCodeBlock = false;
        codeFenceType = '';
      }
    }
  }

  // Case 1: Unclosed code block
  if (inCodeBlock) {
    return text + '\n```';
  }

  let healed = text;

  // Case 2: Unclosed display math ($$)
  const mathBlockMatches = healed.match(/\$\$/g);
  if (mathBlockMatches && mathBlockMatches.length % 2 !== 0) {
    healed += '\n$$';
    return healed;
  }

  // Case 3: Unclosed inline code (single ` outside of code blocks)
  const singleBackticks = healed.match(/(?<!`)`(?!`)/g);
  if (singleBackticks && singleBackticks.length % 2 !== 0) {
    healed += '`';
  }

  // Case 4: Unclosed bold (**)
  const boldMatches = healed.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    healed += '**';
  }

  return healed;
}

/**
 * Wraps the trailing words in a subtle fade-in animation container.
 * Only applied to plain prose outside code blocks and math structures.
 */
export function wrapStreamingTail(text) {
  if (!text || typeof text !== 'string') return text;

  // Don't wrap if inside code blocks
  const lines = text.split('\n');
  let inCodeBlock = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
  }
  if (inCodeBlock) return text;

  // Don't wrap if inside display math
  const mathMatches = text.match(/\$\$/g);
  if (mathMatches && mathMatches.length % 2 !== 0) return text;

  // Find the last 1 to 3 words
  const tailRegex = /((?:\s+[^\s]+){1,3}\s*)$/;
  const match = text.match(tailRegex);
  if (!match) return text;

  const tail = match[1];
  // Do not wrap if tail has markdown formatting characters to avoid broken syntax
  if (/[*`$#<>[\]()]/.test(tail)) return text;

  const head = text.slice(0, text.length - tail.length);
  return `${head}<span class="stream-word-fade">${tail}</span>`;
}
