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

const API_BASE_URL = import.meta.env.Config_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5001/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to automatically attach stored access token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('noema-token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
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

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Intercept 401 Unauthorized errors to attempt silent token refresh
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const url = originalRequest.url || '';
      const isAuthEndpoint =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/refresh') ||
        url.includes('/auth/google');

      if (isAuthEndpoint) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (newToken) {
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = typeof window !== 'undefined' ? localStorage.getItem('noema-refresh-token') : null;
        const refreshRes = await api.post('/auth/refresh', { refreshToken: storedRefreshToken || undefined });
        const newToken = refreshRes.data?.token;
        if (newToken && typeof window !== 'undefined') {
          localStorage.setItem('noema-token', newToken);
          if (refreshRes.data?.refreshToken) {
            localStorage.setItem('noema-refresh-token', refreshRes.data.refreshToken);
          }
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('noema-token');
          localStorage.removeItem('noema-refresh-token');
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const message = error.response?.data?.message || error.message;
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

// ── Cache Layer ───────────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();
const inFlight = new Map();

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
  if (inFlight.has(key)) {
    return inFlight.get(key);
  }
  const promise = fetcher()
    .then((res) => {
      cache.set(key, { data: res, timestamp: Date.now() });
      return res;
    })
    .finally(() => {
      inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
};

/**
 * Invalidate cache entries whose keys start with the given prefix.
 * @param {string} prefix - Key prefix to match (e.g. 'workspaces', 'pages')
 */
export const invalidateCache = (...prefixes) => {
  for (const [key] of cache) {
    if (prefixes.some((p) => key.startsWith(p))) {
      cache.delete(key);
    }
  }
  for (const [key] of inFlight) {
    if (prefixes.some((p) => key.startsWith(p))) {
      inFlight.delete(key);
    }
  }
};

/** Flush the entire cache */
const invalidateAll = () => {
  cache.clear();
  inFlight.clear();
};

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (username, password) => {
    invalidateAll();
    return api.post('/auth/register', { username, password }).then((res) => {
      invalidateAll();
      return res;
    });
  },
  login: (username, password) => {
    invalidateAll();
    return api.post('/auth/login', { username, password }).then((res) => {
      invalidateAll();
      return res;
    });
  },
  googleLogin: (token) => {
    invalidateAll();
    return api.post('/auth/google', { token }).then((res) => {
      invalidateAll();
      return res;
    });
  },
  me: (force = false) => {
    if (force) {
      invalidateCache('auth:me');
    }
    return cachedGet('auth:me', () => api.get('/auth/me'));
  },
  updatePreferences: (preferences) =>
    api.put('/auth/preferences', preferences).then((res) => {
      invalidateCache('auth:me');
      return res;
    }),
  logout: () => {
    invalidateAll(); // clear everything on logout
    return api.post('/auth/logout').finally(() => invalidateAll());
  },
};

// ── Memory ────────────────────────────────────────────────────────────────────
export const memoryAPI = {
  getStats: (force = false) => {
    if (force) invalidateCache('memory:stats');
    return cachedGet('memory:stats', () => api.get('/memory'));
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

const fetchWithRefresh = async (url, options = {}) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('noema-token') : null;
  const initialHeaders = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response = await fetch(url, { ...options, headers: initialHeaders });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const storedRefreshToken = typeof window !== 'undefined' ? localStorage.getItem('noema-refresh-token') : null;
        const refreshRes = await api.post('/auth/refresh', { refreshToken: storedRefreshToken || undefined });
        const newToken = refreshRes.data?.token;
        if (newToken && typeof window !== 'undefined') {
          localStorage.setItem('noema-token', newToken);
          if (refreshRes.data?.refreshToken) {
            localStorage.setItem('noema-refresh-token', refreshRes.data.refreshToken);
          }
        }
        processQueue(null, newToken);
        const retryToken = newToken || (typeof window !== 'undefined' ? localStorage.getItem('noema-token') : null);
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
          },
        });
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('noema-token');
          localStorage.removeItem('noema-refresh-token');
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    } else {
      const newToken = await new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });
      const retryToken = newToken || (typeof window !== 'undefined' ? localStorage.getItem('noema-token') : null);
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
        },
      });
    }
  }
  return response;
};

/**
 * Spec-compliant SSE reader for streaming chat endpoints.
 *
 * Handles frames split across network chunks, multi-line `data:` fields,
 * CRLF/CR line endings, comment/heartbeat lines, the final decoder flush, and
 * `[DONE]`. Yields `{ event, data }` and cancels the underlying reader when
 * the consumer stops early so aborted generations do not leave a socket open.
 */
async function* readSSEStream(response) {
  if (!response.body) {
    throw new Error('Streaming response has no body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  let dataLines = [];

  const dispatch = () => {
    if (dataLines.length === 0) {
      eventName = '';
      return null;
    }
    const frame = {
      event: eventName || 'message',
      data: dataLines.join('\n'),
    };
    eventName = '';
    dataLines = [];
    return frame;
  };

  const processLine = (line) => {
    if (line === '') return dispatch();
    if (line.startsWith(':')) return null;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'data') dataLines.push(value);
    else if (field === 'event') eventName = value;
    // `id` / `retry` are ignored: reconnect/backoff is handled by the caller.
    return null;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);

        const frame = processLine(line);
        if (!frame) continue;
        if (frame.data === '[DONE]') return;
        yield frame;
      }
    }

    buffer += decoder.decode().replace(/\r\n/g, '\n');

    if (buffer.length > 0) {
      for (const rawLine of buffer.split('\n')) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        const frame = processLine(line);
        if (!frame) continue;
        if (frame.data === '[DONE]') return;
        yield frame;
      }
      buffer = '';
    }

    const frame = dispatch();
    if (frame && frame.data !== '[DONE]') {
      yield frame;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // The stream may already be closed or aborted.
    }
    try {
      reader.releaseLock();
    } catch {
      // Ignore release errors after cancellation.
    }
  }
}

export const chatAPI = {
  /**
   * Streams an inline editor AI response via SSE.
   * Returns an async generator.
   */
  askInline: async function* (promptType, text, instruction, signal) {
    const response = await fetchWithRefresh(`${BASE_URL}/chat/inline`, {
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

    for await (const frame of readSSEStream(response)) {
      const dataStr = frame.data.trim();
      if (!dataStr || dataStr === '[DONE]') continue;

      try {
        yield JSON.parse(dataStr);
      } catch {
        // If it fails to parse as JSON, yield it as a raw string chunk
        // This ensures we don't drop raw text streams.
        yield { content: dataStr };
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
  ask: async function* (query, chatHistory, model, sessionId, thinking, signal) {
    const response = await fetchWithRefresh(`${BASE_URL}/chat/ask`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, chatHistory, model, sessionId, thinking }),
      signal, // <-- Add AbortSignal support
    });

    if (!response.ok) {
      // Handle 413 Payload Too Large with user-friendly message
      if (response.status === 413) {
        throw new Error(handleApiSizeError({ status: 413 }, 'chat'));
      }
      throw new Error(`Chat API error: ${response.status}`);
    }

    try {
      for await (const frame of readSSEStream(response)) {
        const payload = frame.data.trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          yield JSON.parse(payload);
        } catch {
          // Ignore malformed frames (keepalive text, partial JSON, etc.).
        }
      }
    } finally {
      // Invalidate even when the consumer stops early on `done`/`error`;
      // the session title and stored history may still have changed.
      invalidateCache('chat:sessions');
      invalidateCache(`chat:history:${sessionId}`);
    }
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
  renameBoard: (id, name) => taskBoardsAPI.updateBoard(id, { name }),
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
