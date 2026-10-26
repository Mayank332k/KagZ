// Chat model catalog shared by the composer and the chat context.
// `value` is sent to the backend, which routes it to the right provider.

export const CHAT_MODELS = [
  {
    value: 'nvidia/nemotron-3.5-bolt-e4b',
    label: 'kagZ lite',
    subtitle: 'Fastest answers',
  },
  {
    value: 'sarvam-105b-conversations',
    label: 'kagZ pro',
    subtitle: 'Advanced reasoning',
    badge: 'New',
  },
];

export const DEFAULT_CHAT_MODEL = CHAT_MODELS[0].value;

// Older clients may still have one of these IDs cached in localStorage.
const LEGACY_MODEL_ALIASES = {
  'meta/llama-3.2-11b-vision-instruct': 'nvidia/nemotron-3.5-bolt-e4b',
  'nvidia/nemotron-3-super-120b-a12b': 'sarvam-105b-conversations',
  'sarvam-105b': 'sarvam-105b-conversations',
};

export function normalizeChatModel(value) {
  const migrated = LEGACY_MODEL_ALIASES[value] || value;
  const isKnown = CHAT_MODELS.some((model) => model.value === migrated);
  return isKnown ? migrated : DEFAULT_CHAT_MODEL;
}
