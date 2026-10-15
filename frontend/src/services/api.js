import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.data.accessToken);
          if (data.data.refreshToken) localStorage.setItem('refreshToken', data.data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(originalRequest);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const logout = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');

// Dashboard
export const getDashboardSummary = (params) => api.get('/dashboard/summary', { params });
export const getLogVolume = (params) => api.get('/dashboard/log-volume', { params });
export const getAnomalyDistribution = (params) => api.get('/dashboard/anomaly-distribution', { params });
export const getAnomalyTypes = (params) => api.get('/dashboard/anomaly-types', { params });
export const getServerHealthSummary = () => api.get('/dashboard/server-health');
export const getLatencyMetrics = () => api.get('/dashboard/latency');

// Logs
export const getLogs = (params) => api.get('/logs', { params });
export const getLog = (id) => api.get(`/logs/${id}`);
export const ingestLog = (data) => api.post('/logs/ingest', data);
export const getLogSources = (params) => api.get('/logs/log-sources', { params });

// Anomalies
export const getAnomalies = (params) => api.get('/anomalies', { params });
export const getAnomaly = (id) => api.get(`/anomalies/${id}`);
export const updateAnomalyStatus = (id, data) => api.patch(`/anomalies/${id}/status`, data);
export const assignAnomaly = (id, userId) => api.post(`/anomalies/${id}/assign`, { userId });
export const addAnomalyNote = (id, content) => api.post(`/anomalies/${id}/notes`, { content });
export const analyzeAnomaly = (id) => api.post(`/anomalies/${id}/analyze`);
export const getRelatedLogs = (id) => api.get(`/anomalies/${id}/related-logs`);

// Servers
export const getServers = (params) => api.get('/servers', { params });
export const getServer = (id) => api.get(`/servers/${id}`);
export const getServerMetrics = (id, params) => api.get(`/servers/${id}/metrics`, { params });

// Analytics
export const getAnalyticsOverview = (params) => api.get('/analytics/overview', { params });
export const getAnalyticsTrends = (params) => api.get('/analytics/trends', { params });

// Reports
export const generateReport = (data) => api.post('/reports/generate', data);
export const getReports = () => api.get('/reports');

// Models
export const getModels = () => api.get('/models');
export const getActiveModel = () => api.get('/models/active');
export const getModel = (id) => api.get(`/models/${id}`);
export const getModelEvaluations = (id) => api.get(`/models/${id}/evaluations`);
export const trainModel = (config) => api.post('/models/train', { config });
export const evaluateModel = (modelId) => api.post('/models/evaluate', { modelId });
export const promoteModel = (id) => api.post(`/models/${id}/promote`);
export const rollbackModel = (id) => api.post(`/models/${id}/rollback`);

// Alerts
export const getAlertRules = () => api.get('/alerts/rules');
export const createAlertRule = (data) => api.post('/alerts/rules', data);
export const updateAlertRule = (id, data) => api.patch(`/alerts/rules/${id}`, data);
export const deleteAlertRule = (id) => api.delete(`/alerts/rules/${id}`);
export const testAlertRule = (id) => api.post(`/alerts/rules/${id}/test`);
export const getAlertEvents = (params) => api.get('/alerts/events', { params });

// Incidents
export const getIncidents = (params) => api.get('/incidents', { params });
export const createIncident = (data) => api.post('/incidents', data);
export const getIncident = (id) => api.get(`/incidents/${id}`);
export const updateIncident = (id, data) => api.patch(`/incidents/${id}`, data);
export const addIncidentNote = (id, content, requestAISummary) => api.post(`/incidents/${id}/notes`, { content, requestAISummary });

// Users
export const getUsers = () => api.get('/users');
export const createUser = (data) => api.post('/users', data);
export const updateUser = (id, data) => api.patch(`/users/${id}`, data);

// Audit
export const getAuditLogs = (params) => api.get('/audit-logs', { params });

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (updates) => api.patch('/settings', { updates });
export const updateProfile = (data) => api.patch('/settings/profile', data);

// Notifications
export const getNotifications = (params) => api.get('/notifications', { params });
export const markAllRead = () => api.patch('/notifications/read-all');
export const markRead = (id) => api.patch(`/notifications/${id}/read`);

export default api;
