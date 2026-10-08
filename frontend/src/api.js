import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smart_security_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setSession(session) {
  localStorage.setItem('smart_security_token', session.token);
  localStorage.setItem('smart_security_user', JSON.stringify(session));
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('smart_security_user')); }
  catch { return null; }
}

export function clearSession() {
  localStorage.removeItem('smart_security_token');
  localStorage.removeItem('smart_security_user');
}
