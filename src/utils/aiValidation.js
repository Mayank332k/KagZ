/**
 * AI Input Validation Utility
 *
 * Prevents oversized text from being sent to the backend for AI features.
 * This prevents model context overload and server-side errors.
 *
 * Limits:
 * - AI prompt input (selected text + instruction): <= 12,000 chars
 * - Page content save: <= 200,000 chars
 */

// Frontend validation limits
const AI_LIMITS = {
  PROMPT_INPUT: 12000,      // Max chars for AI prompt (text + instruction)
  PAGE_CONTENT: 200000,     // Max chars for page content save
};

/**
 * Action-specific error messages for oversized input
 */
const OVERSIZED_MESSAGES = {
  summarize: 'This text is too large for summarization. Please select a smaller chunk or split it into smaller sections and try again.',
  grammar: 'This text is too large for grammar correction. Please select a smaller chunk and try again.',
  improve_writing: 'This text is too large for writing improvement. Please select a smaller chunk and try again.',
  explain: 'This text is too large for explanation. Please select a smaller chunk or split it into smaller sections and try again.',
  write: 'This text is too large for this action. Please select a smaller chunk and try again.',
  chat: 'This message is too large. Please shorten your message and try again.',
  fallback: 'This content is too large. Please split it into smaller chunks and try again.',
};



/**
 * Get action-specific oversized error message
 * @param {string} actionType - The AI action type
 * @returns {string} - User-friendly error message
 */
function getOversizedAiMessage(actionType) {
  return OVERSIZED_MESSAGES[actionType] || OVERSIZED_MESSAGES.fallback;
}

/**
 * Validate AI input before sending to backend
 * Checks both the selected text and the instruction/prompt
 * @param {string} actionType - The AI action type (summarize, grammar, improve_writing, explain, write, chat)
 * @param {string} text - The selected text or main input
 * @param {string} [instruction] - Optional instruction/prompt
 * @returns {{ valid: boolean, message: string|null }} - Validation result
 */
export function validateAiInput(actionType, text, instruction = '') {
  const textLen = text?.length || 0;
  const instructionLen = instruction?.length || 0;
  const totalLen = textLen + instructionLen;

  // Check total combined length
  if (totalLen > AI_LIMITS.PROMPT_INPUT) {
    const message = getOversizedAiMessage(actionType);
    return {
      valid: false,
      message,
      details: {
        textLength: textLen,
        instructionLength: instructionLen,
        totalLength: totalLen,
        limit: AI_LIMITS.PROMPT_INPUT,
      }
    };
  }

  // Check instruction alone (in case text is empty but instruction is huge)
  if (instructionLen > AI_LIMITS.PROMPT_INPUT) {
    const message = getOversizedAiMessage(actionType);
    return {
      valid: false,
      message,
      details: {
        textLength: textLen,
        instructionLength: instructionLen,
        totalLength: totalLen,
        limit: AI_LIMITS.PROMPT_INPUT,
      }
    };
  }

  // Check for empty text when it's required (for selection-based actions)
  if (!text?.trim() && actionType !== 'write' && actionType !== 'chat') {
    return {
      valid: false,
      message: 'No text selected. Please select some text first.',
      details: { textLength: 0 }
    };
  }

  return { valid: true, message: null };
}

/**
 * Handle API 413 (Payload Too Large) or "too large" error responses
 * @param {Error|Response} error - The error from fetch/axios
 * @param {string} actionType - The AI action type for message context
 * @returns {string} - User-friendly error message
 */
export function handleApiSizeError(error, actionType) {
  // Check for 413 status
  if (error?.response?.status === 413 || error?.status === 413) {
    return getOversizedAiMessage(actionType);
  }

  // Check error message for "too large" indicators
  const errorMessage = error?.response?.data?.message
    || error?.message
    || error?.data
    || String(error);

  if (typeof errorMessage === 'string' &&
      (errorMessage.toLowerCase().includes('too large')
        || errorMessage.toLowerCase().includes('payload too large')
        || errorMessage.toLowerCase().includes('exceeds')
        || errorMessage.toLowerCase().includes('context length')
        || errorMessage.toLowerCase().includes('max tokens'))) {
    return getOversizedAiMessage(actionType);
  }

  // Default generic error
  return 'Something went wrong. Please try again.';
}

/**
 * Validate page content size before saving
 * @param {string} content - Page content
 * @returns {{ valid: boolean, message: string|null }}
 */
export function validatePageContent(content) {
  const len = content?.length || 0;
  if (len > AI_LIMITS.PAGE_CONTENT) {
    return {
      valid: false,
      message: `Page content exceeds ${(AI_LIMITS.PAGE_CONTENT / 1000).toFixed(0)}KB limit. Please reduce the content size.`,
      details: { length: len, limit: AI_LIMITS.PAGE_CONTENT }
    };
  }
  return { valid: true, message: null };
}
