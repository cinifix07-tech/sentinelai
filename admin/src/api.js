const API_URL = import.meta.env.VITE_API_URL || '/api';
const FALLBACK_API_URL = API_URL.startsWith('/')
  ? 'http://localhost:4000/api'
  : API_URL.includes('localhost')
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

export async function logoutFromBackend() {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch {
    // Local session cleanup still happens when the API is offline.
  }
}

export async function loginToBackend(email, password) {
  const request = async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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

export async function sendResetOtp(email) {
  const request = async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth/send-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to authenticate Gmail account.');
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

export async function verifyResetOtp(email, code) {
  const request = async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, code }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to verify OTP.');
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

export async function resetPassword(email, password) {
  const request = async (baseUrl) => {
    const response = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to update password.');
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
  const response = await requestApi(path, { headers: { Authorization: `Bearer ${session?.token || ''}` } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export async function apiPost(path, body = {}) {
  const session = getSession();
  const response = await requestApi(path, {
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

export async function streamApiPost(path, body = {}, onEvent = () => {}) {
  const session = getSession();
  const response = await requestApi(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session?.token || ''}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'AI request failed.');
  }
  if (!response.body) throw new Error('AI stream is unavailable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() || '';
    for (const rawEvent of events) {
      const eventName = rawEvent.split('\n').find((line) => line.startsWith('event: '))?.slice(7) || 'message';
      const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
      if (!dataLine) continue;
      onEvent(eventName, JSON.parse(dataLine.slice(6)));
    }
    if (done) break;
  }
}

export async function apiPut(path, body = {}) {
  const session = getSession();
  const response = await requestApi(path, {
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

export async function apiDelete(path) {
  const session = getSession();
  const response = await requestApi(path, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session?.token || ''}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Delete request failed.');
  return data;
}

async function requestApi(path, options = {}) {
  const urls = [...new Set([`${API_URL}${path}`, FALLBACK_API_URL ? `${FALLBACK_API_URL}${path}` : ''].filter(Boolean))];
  let lastError;
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    try {
      const response = await fetch(url, { credentials: 'include', ...options });
      // A stale LAN proxy can still serve the previous API routes. Retry the local backend.
      if (response.status === 404 && index < urls.length - 1) continue;
      return response;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Cannot reach backend API. Make sure the backend is running on http://localhost:4000. ${lastError?.message || ''}`.trim());
}

export function roleHome(role) {
  if (role === 'ADMIN') return ADMIN_URL;
  if (role === 'USER') return CLIENT_URL;
  return '';
}
