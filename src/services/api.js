/**
 * NOEMA Centralized API Service
 * Base URL: http://localhost:5001/api
 * Auth: httpOnly cookies (withCredentials: true)
 *
 * Features:
 * - Client-side cache with 5-minute TTL for GET requests
 * - Automatic cache invalidation on create/update/delete mutations
 */
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { handleApiSizeError } from '../utils/aiValidation';

const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'http://localhost:5001/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Configure Exponential Backoff for GET requests
axiosRetry(api, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry only on GET requests and when the error is a network error or a 5xx server error
    return error.config?.method === 'get' && (!error.response || error.response.status >= 500);
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message;
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

// ── Cache Layer ───────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

/**
 * Get a cached response or fetch fresh data.
 * @param {string} key   - Unique cache key (typically the URL + params)
 * @param {Function} fetcher - A function that returns a Promise (the API call)
 * @returns {Promise}
 */
const cachedGet = (key, fetcher) => {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return Promise.resolve(entry.data);
  }
  return fetcher().then((res) => {
    cache.set(key, { data: res, timestamp: Date.now() });
    return res;
  });
};

/**
 * Invalidate cache entries whose keys start with the given prefix.
 * @param {string} prefix - Key prefix to match (e.g. 'workspaces', 'pages')
 */
const invalidateCache = (...prefixes) => {
  for (const [key] of cache) {
    if (prefixes.some((p) => key.startsWith(p))) {
      cache.delete(key);
    }
  }
};

/** Flush the entire cache */
const invalidateAll = () => cache.clear();

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (username, password) => api.post('/auth/register', { username, password }),
  login: (username, password) => api.post('/auth/login', { username, password }),
  googleLogin: (token) => api.post('/auth/google', { token }),
  me: () => api.get('/auth/me'),  // Auth check — never cached
  logout: () => {
    invalidateAll(); // clear everything on logout
    return api.post('/auth/logout');
  },
};

// ── Workspaces ────────────────────────────────────────────────────────────────
export const workspacesAPI = {
  getAll: () =>
    cachedGet('workspaces:all', () => api.get('/workspaces')),
  create: (name) =>
    api.post('/workspaces', { name }).then((res) => {
      invalidateCache('workspaces', 'sidebar');
      return res;
    }),
  update: (id, data) =>
    api.put(`/workspaces/${id}`, data).then((res) => {
      invalidateCache('workspaces', 'sidebar');
      return res;
    }),
  delete: (id) =>
    api.delete(`/workspaces/${id}`).then((res) => {
      invalidateCache('workspaces', 'folders', 'pages', 'sidebar');
      return res;
    }),
};

// ── Folders ───────────────────────────────────────────────────────────────────
export const foldersAPI = {
  getByWorkspace: (workspaceId, parentId = null) =>
    cachedGet(`folders:ws:${workspaceId}:${parentId}`, () =>
      api.get(`/folders/workspace/${workspaceId}`, { params: { parentId } })
    ),
  create: (name, workspaceId, parentId = null) =>
    api.post('/folders', { name, workspaceId, parentId }).then((res) => {
      invalidateCache('folders', 'sidebar');
      return res;
    }),
  update: (id, data) =>
    api.put(`/folders/${id}`, data).then((res) => {
      invalidateCache('folders', 'sidebar');
      return res;
    }),
  delete: (id) =>
    api.delete(`/folders/${id}`).then((res) => {
      invalidateCache('folders', 'pages', 'sidebar');
      return res;
    }),
};

// ── Pages ─────────────────────────────────────────────────────────────────────
export const pagesAPI = {
  getAll: () =>
    cachedGet(`pages:all`, () => api.get('/pages')),
  getByWorkspace: (workspaceId, folderId = null) =>
    cachedGet(`pages:ws:${workspaceId}:${folderId}`, () =>
      api.get(`/pages/workspace/${workspaceId}`, {
        // The backend treats the literal "null" value as the workspace root.
        // Axios omits JavaScript null query parameters, so send it explicitly.
        params: { folderId: folderId ?? 'null' },
      })
    ),
  getById: (id) =>
    cachedGet(`pages:id:${id}`, () => api.get(`/pages/${id}`)),
  search: (q, workspaceId) =>
    cachedGet(`pages:search:${q}:${workspaceId}`, () =>
      api.get('/pages/search', { params: { q, workspaceId } })
    ),
  create: (data) =>
    api.post('/pages', {
      title: data.title,
      content: data.content || '',
      type: data.type || 'document',
      workspaceId: data.workspaceId,
      folderId: data.folderId || null,
    }).then((res) => {
      invalidateCache('pages', 'sidebar');
      return res;
    }),
  update: (id, data) =>
    api.put(`/pages/${id}`, data).then((res) => {
      invalidateCache('pages', 'sidebar');
      return res;
    }),
  delete: (id) =>
    api.delete(`/pages/${id}`).then((res) => {
      invalidateCache('pages', 'sidebar');
      return res;
    }),
};

// ── Chat (SSE — must use native fetch, NOT axios) ────────────────────────────
const BASE_URL = API_BASE_URL;

export const chatAPI = {
  /**
   * Streams an inline editor AI response via SSE.
   * Returns an async generator.
   */
  askInline: async function* (promptType, text, instruction, signal) {
    const response = await fetch(`${BASE_URL}/chat/inline`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptType, text, instruction }),
      signal,
    });

    if (!response.ok) {
      // Handle 413 Payload Too Large with user-friendly message
      if (response.status === 413) {
        throw new Error(handleApiSizeError({ status: 413 }, promptType));
      }
      throw new Error(`Chat API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        let dataStr = line.trim();
        if (!dataStr) continue;

        if (dataStr.startsWith('data:')) {
          dataStr = dataStr.slice(5).trim();
        }

        if (dataStr === '[DONE]') {
          console.log("askInline: Received [DONE]");
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);
          yield parsed;
        } catch {
          // If it fails to parse as JSON, yield it as a raw string chunk
          // This ensures we don't drop raw text streams.
          yield { content: dataStr };
        }
      }
    }
    
    // Flush remaining buffer
    let dataStr = buffer.trim();
    if (dataStr) {
      if (dataStr.startsWith('data:')) {
        dataStr = dataStr.slice(5).trim();
      }
      if (dataStr && dataStr !== '[DONE]') {
        try {
          yield JSON.parse(dataStr);
        } catch {
          yield { content: dataStr };
        }
      }
    }
  },

  /**
   * Streams an AI answer via SSE.
   * Returns an async generator that yields parsed SSE events.
   *
   * Usage:
   *   for await (const event of chatAPI.ask(query, sessionId)) {
   *     if (event.type === 'sources') ...
   *     if (event.type === 'content') ...
   *     if (event.type === 'done')    ...
   *   }
   */
  ask: async function* (query, chatHistory, model, sessionId, isThinking, signal) {
    const response = await fetch(`${BASE_URL}/chat/ask`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, chatHistory, model, sessionId, isThinking }),
      signal, // <-- Add AbortSignal support
    });

    if (!response.ok) {
      // Handle 413 Payload Too Large with user-friendly message
      if (response.status === 413) {
        throw new Error(handleApiSizeError({ status: 413 }, 'chat'));
      }
      throw new Error(`Chat API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          yield parsed;
        } catch {
          // ignore malformed lines
        }
      }
    }

    // Invalidate sessions cache after a new message (title may have changed)
    invalidateCache('chat:sessions');
  },

  getSessions: () =>
    cachedGet('chat:sessions', () => api.get('/chat/sessions')),
  getHistory: (sessionId, cursor) =>
    cachedGet(`chat:history:${sessionId}:${cursor || 'latest'}`, () =>
      api.get(`/chat/history/${sessionId}${cursor ? `?cursor=${cursor}` : ''}`)
    ),
  clearHistory: (sessionId) =>
    api.delete(`/chat/history/${sessionId}`).then((res) => {
      invalidateCache('chat');
      return res;
    }),
};

// ── Task Boards API ────────────────────────────────────────────────────────
export const taskBoardsAPI = {
  getBoards: (workspaceId) =>
    cachedGet(`tasks:boards:${workspaceId || 'global'}`, () =>
      api.get(`/tasks/boards${workspaceId ? `?workspaceId=${workspaceId}` : ''}`)
    ),
  createBoard: (data) =>
    api.post('/tasks/boards', data).then((res) => {
      invalidateCache('tasks:boards');
      return res;
    }),
  updateBoard: (id, data) =>
    api.put(`/tasks/boards/${id}`, data).then((res) => {
      invalidateCache('tasks:boards');
      return res;
    }),
  deleteBoard: (id) =>
    api.delete(`/tasks/boards/${id}`).then((res) => {
      invalidateCache('tasks:boards');
      // Also invalidate tasks since deleting a board deletes its tasks
      invalidateCache('tasks:items');
      return res;
    }),
};

// ── Tasks API ──────────────────────────────────────────────────────────────
export const tasksAPI = {
  getTasks: (workspaceId) =>
    cachedGet(`tasks:items:${workspaceId || 'global'}`, () =>
      api.get(`/tasks${workspaceId ? `?workspaceId=${workspaceId}` : ''}`)
    ),
  createTask: (data) => {
    invalidateCache('tasks:items');
    return api.post('/tasks', data).then((res) => {
      invalidateCache('tasks:items');
      return res;
    });
  },
  updateTask: (id, data) => {
    invalidateCache('tasks:items');
    return api.put(`/tasks/${id}`, data).then((res) => {
      invalidateCache('tasks:items');
      return res;
    });
  },
  deleteTask: (id) => {
    invalidateCache('tasks:items');
    return api.delete(`/tasks/${id}`).then((res) => {
      invalidateCache('tasks:items');
      return res;
    });
  },
};
