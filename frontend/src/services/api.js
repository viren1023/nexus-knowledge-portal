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
  sendMessage: (projectId, data) => api.post(`/projects/${projectId}/chat/message`, data),
  getHistory: (projectId, sessionId, limit = 10) => api.get(`/projects/${projectId}/chat/session/${sessionId}/history?limit=${limit}`),
};

export default api;
