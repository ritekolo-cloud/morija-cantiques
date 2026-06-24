/// <reference types="vite/client" />
import axios, { AxiosInstance } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

// ─── Create Axios Instance ─────────────────────────────────────
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Response Interceptor ───────────────
apiClient.interceptors.response.use(
  (response) => {
    // Unwrap ApiResponse envelope
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return { ...response, data: response.data };
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// ─── Helper: unwrap data from ApiResponse ──────────────────────
export function unwrap<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

export default apiClient;
