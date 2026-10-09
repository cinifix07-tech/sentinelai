const CONVEX_SITE_URL = String(process.env.CONVEX_SITE_URL || '').replace(/\/$/, '');

function assertConfigured() {
  if (!CONVEX_SITE_URL) {
    throw Object.assign(new Error('CONVEX_SITE_URL is required for the Convex data service.'), { status: 503 });
  }
  if (!process.env.CONVEX_CONTROL_TOKEN) {
    throw Object.assign(new Error('CONVEX_CONTROL_TOKEN is required for the Convex data service.'), { status: 503 });
  }
}

async function convexRequest(path, options = {}) {
  assertConfigured();
  const response = await fetch(`${CONVEX_SITE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-backend-control-token': process.env.CONVEX_CONTROL_TOKEN,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(body.error || body.message || `Convex request failed (${response.status})`), { status: response.status });
  }
  return body;
}

async function getUserByEmail(email) {
  return convexRequest(`/app/users/by-email?email=${encodeURIComponent(email)}`);
}

async function updateUserPassword(email, passwordHash) {
  return convexRequest('/app/users/password', {
    method: 'POST',
    body: JSON.stringify({ email, password_hash: passwordHash }),
  });
}

async function updateUserProfile(currentEmail, patch) {
  const result = await convexRequest('/app/users/profile', {
    method: 'POST',
    body: JSON.stringify({ current_email: currentEmail, patch }),
  });
  return result.user;
}

async function syncUserAccount(payload) {
  const result = await convexRequest('/app/users/sync', { method: 'POST', body: JSON.stringify({ payload }) });
  return result.account;
}

async function listRecords(table, { order = 'created_at', limit = 100 } = {}) {
  const result = await convexRequest(`/app/records?table=${encodeURIComponent(table)}&order=${encodeURIComponent(order)}&limit=${encodeURIComponent(limit)}`);
  return result.records || [];
}

async function findRecord(table, id, idField = 'id') {
  const result = await convexRequest(`/app/records/find?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}&id_field=${encodeURIComponent(idField)}`);
  return result.record || null;
}

async function insertRecord(table, id, payload) {
  const result = await convexRequest('/app/records', { method: 'POST', body: JSON.stringify({ table, id, payload }) });
  return result.record;
}

async function updateRecord(table, id, patch, idField = 'id') {
  const result = await convexRequest('/app/records', { method: 'PATCH', body: JSON.stringify({ table, id, id_field: idField, patch }) });
  return result.record || null;
}

async function deleteRecord(table, id, idField = 'id') {
  const result = await convexRequest(`/app/records?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}&id_field=${encodeURIComponent(idField)}`, { method: 'DELETE' });
  return result.record || null;
}

module.exports = { convexRequest, getUserByEmail, updateUserPassword, updateUserProfile, syncUserAccount, listRecords, findRecord, insertRecord, updateRecord, deleteRecord };
