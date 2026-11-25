import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Bearer token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('clipper_admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle unauthorized responses automatically
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('clipper_admin_token');
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export const AdminAPI = {
  // Auth
  login: async (password) => {
    const res = await api.post('/api/admin/login', { password });
    return res.data;
  },
  changePassword: async (currentPassword, newPassword) => {
    const res = await api.post('/api/admin/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return res.data;
  },
  verifyMe: async () => {
    const res = await api.get('/api/admin/me');
    return res.data;
  },

  // Stats
  getStats: async () => {
    const res = await api.get('/api/admin/stats');
    return res.data;
  },

  // Users CRUD
  getUsers: async () => {
    const res = await api.get('/api/admin/users');
    return res.data;
  },
  updateUser: async (chatId, data) => {
    const res = await api.put(`/api/admin/users/${chatId}`, data);
    return res.data;
  },
  deleteUser: async (chatId) => {
    const res = await api.delete(`/api/admin/users/${chatId}`);
    return res.data;
  },

  // Social Accounts CRUD
  addSocial: async (chatId, data) => {
    const res = await api.post(`/api/admin/users/${chatId}/socials`, data);
    return res.data;
  },
  updateSocial: async (accountId, data) => {
    const res = await api.put(`/api/admin/socials/${accountId}`, data);
    return res.data;
  },
  reviewSocial: async (accountId, data) => {
    const res = await api.post(`/api/admin/socials/${accountId}/review`, data);
    return res.data;
  },
  deleteSocial: async (accountId) => {
    const res = await api.delete(`/api/admin/socials/${accountId}`);
    return res.data;
  },

  // Submissions CRUD
  getSubmissions: async () => {
    const res = await api.get('/api/admin/submissions');
    return res.data;
  },
  updateSubmission: async (id, data) => {
    const res = await api.put(`/api/admin/submissions/${id}`, data);
    return res.data;
  },
  deleteSubmission: async (id) => {
    const res = await api.delete(`/api/admin/submissions/${id}`);
    return res.data;
  },

  // Telegram Messaging & Broadcast
  sendMessage: async (data) => {
    const res = await api.post('/api/admin/send-message', data);
    return res.data;
  },

  // Platform Payout Rates
  getRates: async () => {
    const res = await api.get('/api/admin/rates');
    return res.data;
  },
  updateRates: async (rates) => {
    const res = await api.put('/api/admin/rates', { rates });
    return res.data;
  },

  // Reset Clipper Stats
  resetStats: async (data = {}) => {
    const res = await api.post('/api/admin/reset-stats', data);
    return res.data;
  },
};
