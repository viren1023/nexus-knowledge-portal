import axios from 'axios';

// const API_BASE_URL = 'http://localhost:8000/api';
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT auth headers
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const authService = {
  login: (email) => api.post('/auth/login', { email }),
  getUsers: () => api.get('/auth/users'),
};

export const documentService = {
  upload: (projectId, formData) => api.post(`/projects/${projectId}/documents/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadRepo: (projectId, data) => api.post(`/projects/${projectId}/repos/upload`, data),
  getStatus: (projectId, jobId) => api.get(`/projects/${projectId}/documents/${jobId}/status`),
  getAssets: (projectId) => api.get(`/projects/${projectId}/assets`),
  getAssetTree: (projectId, assetId) => api.get(`/projects/${projectId}/assets/${assetId}/tree`),
  getAssetContent: (projectId, assetId, filePath = null) => {
    let url = `/projects/${projectId}/assets/${assetId}/content`;
    if (filePath) {
      url += `?file_path=${encodeURIComponent(filePath)}`;
    }
    return api.get(url, { responseType: 'text' });
  },
  getChunkContext: (projectId, chunkId) => api.get(`/projects/${projectId}/documents/chunks/${chunkId}`),
  deleteAsset: (projectId, documentId) => api.delete(`/projects/${projectId}/documents/${documentId}`),
  deleteRepo: (projectId, repoId) => api.delete(`/projects/${projectId}/repos/${repoId}`),
};

export const getAssetContentUrl = (projectId, assetId) => {
  const token = localStorage.getItem('token');
  return `/api/projects/${projectId}/assets/${assetId}/content?token=${token}`;
};

export const getAssetDownloadUrl = (projectId, assetId) => {
  const token = localStorage.getItem('token');
  return `/api/projects/${projectId}/assets/${assetId}/content?download=true&token=${token}`;
};

export const taskService = {
  create: (projectId, data) => api.post(`/projects/${projectId}/tasks`, data),
  update: (projectId, taskId, data) => api.patch(`/projects/${projectId}/tasks/${taskId}`, data),
  getAll: (projectId) => api.get(`/projects/${projectId}/tasks`),
};

export const projectService = {
  create: (data) => api.post('/projects', data),
  update: (projectId, data) => api.patch(`/projects/${projectId}`, data),
  getAll: () => api.get('/projects'),
  getPersonalDashboard: () => api.get('/projects/personal-dashboard'),
  getOne: (projectId) => api.get(`/projects/${projectId}`),
  getMembers: (projectId) => api.get(`/projects/${projectId}/members`),
  addMember: (projectId, data) => api.post(`/projects/${projectId}/members`, data),
  removeMember: (projectId, devId) => api.delete(`/projects/${projectId}/members/${devId}`),
};

export const searchService = {
  search: (projectId, data) => api.post(`/projects/${projectId}/search`, data),
};

export const chatService = {
  checkContent: (projectId) => api.get(`/projects/${projectId}/chat/check-content`),
  startSession: (projectId) => api.post(`/projects/${projectId}/chat/session/start`),
  listSessions: (projectId, limit = 50) => api.get(`/projects/${projectId}/chat/sessions/list?limit=${limit}`),
  sendMessage: (projectId, data) => api.post(`/projects/${projectId}/chat/message`, data),
  streamMessage: async (projectId, data, { onMetadata, onChunk, onDone, onError, signal } = {}) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(data),
        signal
      });

      if (!response.ok) {
        let errMessage = `HTTP error! status: ${response.status}`;
        try {
          const errData = await response.json();
          errMessage = errData.detail || errData.error || errMessage;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === 'metadata' && onMetadata) onMetadata(parsed);
            else if (parsed.type === 'chunk' && onChunk) onChunk(parsed.text);
            else if (parsed.type === 'done' && onDone) onDone(parsed);
            else if (parsed.type === 'error') {
              const streamErr = new Error(parsed.error);
              if (onError) onError(streamErr);
              throw streamErr;
            }
          } catch (jsonErr) {
            console.warn('Failed to parse SSE payload', jsonErr, jsonStr);
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      if (onError) onError(err);
      throw err;
    }
  },
  getHistory: (projectId, sessionId, limit = 50) => api.get(`/projects/${projectId}/chat/session/${sessionId}/history?limit=${limit}`),
  touchSession: (projectId, sessionId) => api.patch(`/projects/${projectId}/chat/session/${sessionId}/touch`),
  deleteSession: (projectId, sessionId) => api.delete(`/projects/${projectId}/chat/session/${sessionId}`),
  pinSession: (projectId, sessionId) => api.patch(`/projects/${projectId}/chat/session/${sessionId}/pin`),
};

export default api;
