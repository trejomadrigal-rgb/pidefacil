import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
});

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

export function parseJwtPayload(token: string): { sub: string; businessId: string; role: string } {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        return api(originalRequest);
      });
    }
    originalRequest._retry = true;
    isRefreshing = true;
    try {
      const refreshToken = getCookie('rf_token');
      if (!refreshToken) throw new Error('No refresh token');
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/auth/refresh`,
        { refresh_token: refreshToken },
      );
      const payload = parseJwtPayload(data.access_token);
      useAuthStore.getState().setAuth({
        accessToken: data.access_token,
        businessId: payload.businessId,
        businessSlug: useAuthStore.getState().businessSlug ?? '',
        userName: useAuthStore.getState().userName ?? '',
      });
      processQueue(null, data.access_token);
      originalRequest.headers['Authorization'] = `Bearer ${data.access_token}`;
      return api(originalRequest);
    } catch (err) {
      processQueue(err, null);
      document.cookie = 'rf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);
