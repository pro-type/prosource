import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('prosource_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (expired token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('prosource_token');
      localStorage.removeItem('prosource_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth API ──
export const authAPI = {
  checkSetup: () => api.get('/auth/check-setup'),
  setup: (data: { email: string; password: string; name: string }) =>
    api.post('/auth/setup', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/password', data),
};

// ── Leads API ──
export const leadsAPI = {
  getAll: (params?: { page?: number; limit?: number; search?: string; status?: string; archived?: boolean }) =>
    api.get('/leads', { params }),
  getStats: () => api.get('/leads/stats'),
  getOne: (id: string) => api.get(`/leads/${id}`),
  create: (data: any) => api.post('/leads', data),
  bulkImport: (leads: any[]) => api.post('/leads/bulk', { leads }),
  update: (id: string, data: any) => api.put(`/leads/${id}`, data),
  delete: (id: string, hard?: boolean) => api.delete(`/leads/${id}`, { params: { hard } }),
};

// ── Campaigns API ──
export const campaignsAPI = {
  start: (leadId: string, templateId?: string) => api.post(`/campaigns/start/${leadId}`, { templateId }),
  sendNext: (leadId: string) => api.post(`/campaigns/send-next/${leadId}`),
  syncReplies: (leadId: string) => api.post(`/campaigns/sync-replies/${leadId}`),
  markConverted: (leadId: string) => api.post(`/campaigns/mark-converted/${leadId}`),
  bulkStart: (leadIds: string[], templateId?: string) => api.post('/campaigns/bulk-start', { leadIds, templateId }),
  getStatus: (leadId: string) => api.get(`/campaigns/status/${leadId}`),
  triggerScheduler: () => api.post('/campaigns/trigger-scheduler'),
};

// ── Templates API ──
export const templatesAPI = {
  getAll: () => api.get('/templates'),
  getOne: (id: string) => api.get(`/templates/${id}`),
  create: (data: any) => api.post('/templates', data),
  update: (id: string, data: any) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
};

// ── Signatures API ──
export const signaturesAPI = {
  getAll: () => api.get('/signatures'),
  create: (data: any) => api.post('/signatures', data),
  update: (id: string, data: any) => api.put(`/signatures/${id}`, data),
  delete: (id: string) => api.delete(`/signatures/${id}`),
};

// ── Gmail API ──
export const gmailAPI = {
  getAuthUrl: () => api.get('/gmail/auth-url'),
  getStatus: () => api.get('/gmail/status'),
};

export default api;
