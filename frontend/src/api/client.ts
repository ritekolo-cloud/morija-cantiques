import axios from 'axios';

const BASE_URL =
  import.meta.env.VITE_API_URL ?? '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ❌ REMOVE the broken interceptor completely
// It is causing inconsistent response shapes

export default apiClient;
