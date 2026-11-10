// Chat model catalog shared by the composer and the chat context.
// `value` is sent to the backend, which routes it to the right provider.

export const CHAT_MODELS = [
  {
    value: 'nvidia/nemotron-3.5-bolt-e4b',
    label: 'kagZ lite',
    subtitle: 'Fastest everyday',
    description: 'Fast answers for everyday questions and tasks',
    iconColor: '#38bdf8',
    speed: 5,
    intelligence: 3,
  },
  {
    value: 'sarvam-105b-conversations',
    label: 'kagZ pro',
    subtitle: 'Advanced reasoning',
    description: 'Advanced reasoning and deep problem solving',
    iconColor: '#a855f7',
    speed: 4,
    intelligence: 4,
  },
  {
    value: 'gemini-3.5-flash-lite',
    label: 'kagZ pro flash',
    subtitle: 'Blazing speed & context',
    badge: 'New',
    description: 'Ultra-fast processing with massive 1M context window',
    iconColor: '#10b981',
    speed: 5,
    intelligence: 4,
  },
  {
    value: 'nvidia/nemotron-3-ultra-550b-a55b',
    label: 'kagZ max',
    subtitle: 'Most capable',
    description: 'Maximum capability for your most complex tasks',
    iconColor: '#f97316',
    speed: 2,
    intelligence: 5,
  },
];

const DEFAULT_CHAT_MODEL = 'gemini-3.5-flash-lite';

// Older clients may still have one of these IDs cached in localStorage.
const LEGACY_MODEL_ALIASES = {
  'meta/llama-3.2-11b-vision-instruct': 'nvidia/nemotron-3.5-bolt-e4b',
  'nvidia/nemotron-3-super-120b-a12b': 'sarvam-105b-conversations',
  'sarvam-105b': 'sarvam-105b-conversations',
  'gemini-3.5-flash': 'gemini-3.5-flash-lite',
  'gemini-flash': 'gemini-3.5-flash-lite',
  'kagz-flash': 'gemini-3.5-flash-lite',
  'kagz-pro-flash': 'gemini-3.5-flash-lite',
  'kag-lite': 'nvidia/nemotron-3.5-bolt-e4b',
  'kag-pro': 'sarvam-105b-conversations',
  'kag-pro-flash': 'gemini-3.5-flash-lite',
  'kag-max': 'nvidia/nemotron-3-ultra-550b-a55b',
  max: 'nvidia/nemotron-3-ultra-550b-a55b',
  'kagz-max': 'nvidia/nemotron-3-ultra-550b-a55b',
};

export function normalizeChatModel(value) {
  const migrated = LEGACY_MODEL_ALIASES[value] || value;
  const isKnown = CHAT_MODELS.some((model) => model.value === migrated);
  return isKnown ? migrated : DEFAULT_CHAT_MODEL;
}
