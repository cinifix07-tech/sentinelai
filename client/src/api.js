const API_URL = import.meta.env.VITE_API_URL || '/api';
const FALLBACK_API_URL = API_URL.includes('localhost')
  ? API_URL.replace('localhost', '127.0.0.1')
  : '';
const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || '';
const CLIENT_URL = import.meta.env.VITE_CLIENT_URL || '';
const SESSION_KEY = 'sentinel-session';

export function getSession() {
  const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { return null; }
}

export function saveSession(session, remember) {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

export async function loginToBackend(email, password) {
  const request = async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to sign in.');
    return data;
  };

  try {
    return await request(API_URL);
  } catch (error) {
    if (error instanceof TypeError && FALLBACK_API_URL) {
      try {
        return await request(FALLBACK_API_URL);
      } catch (fallbackError) {
        if (!(fallbackError instanceof TypeError)) throw fallbackError;
      }
    }
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach backend API through ${API_URL}. Restart the Vite dev server and backend server.`);
    }
    throw error;
  }
}

export async function apiGet(path) {
  const session = getSession();
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session?.token || ''}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export async function apiPost(path, body = {}) {
  const session = getSession();
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.token || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export async function apiPut(path, body = {}) {
  const session = getSession();
  const response = await fetch(`${API_URL}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${session?.token || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export function roleHome(role) {
  if (role === 'ADMIN') return ADMIN_URL;
  if (role === 'USER') return CLIENT_URL;
  return '';
}
