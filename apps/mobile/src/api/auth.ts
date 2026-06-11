import axios from 'axios';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://2.24.201.108:3000';

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: { id: string; name: string; email: string; role: string };
  business: { id: string; name: string; slug: string };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${BASE_URL}/auth/login`, { email, password });
  return data;
}

export async function refreshAuth(refreshToken: string): Promise<AuthResponse> {
  const { data } = await axios.post<AuthResponse>(`${BASE_URL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  return data;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await axios.post(`${BASE_URL}/auth/logout`, { refresh_token: refreshToken });
}
