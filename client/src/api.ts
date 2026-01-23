import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
});

// Automatically add token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.accessToken = token;
  }
  return config;
});

export default api;