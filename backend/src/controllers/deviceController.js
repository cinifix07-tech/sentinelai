const socket = require('../socket');

const CONVEX_SITE_URL = String(process.env.CONVEX_SITE_URL || '').replace(/\/$/, '');

function mapDevice(row = {}) {
  return { device_id: row._id || row.device_id, device_code: row.deviceCode || row.device_code, device_name: row.deviceName || row.device_name, location: row.location, device_type: row.deviceType || row.device_type, is_online: Boolean(row.isOnline ?? row.is_online), last_seen: row.lastSeen ? new Date(row.lastSeen).toISOString() : null };
}

async function convexDeviceRequest(path, method = 'GET', payload) {
  const controlToken = process.env.CONVEX_CONTROL_TOKEN;
  if (!CONVEX_SITE_URL || !controlToken) throw Object.assign(new Error('Convex device control is not configured.'), { status: 503 });
  const response = await fetch(`${CONVEX_SITE_URL}${path}`, { method, headers: { 'content-type': 'application/json', 'x-backend-control-token': controlToken }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || `Convex device request failed (${response.status})`), { status: response.status });
  return body;
}

async function list(req, res, next) {
  try { const body = await convexDeviceRequest('/iot/devices'); res.json((body.devices || []).map(mapDevice)); } catch (error) { next(error); }
}

async function create(req, res, next) {
  try { const body = await convexDeviceRequest('/iot/devices', 'POST', { device_code: String(req.body?.device_code || '').trim(), device_name: String(req.body?.device_name || '').trim(), location: String(req.body?.location || 'Main residence').trim(), device_type: String(req.body?.device_type || 'ESP32 PIR').trim(), is_online: Boolean(req.body?.is_online) }); socket.emit('device:created', body); res.status(201).json(body); } catch (error) { next(error); }
}

async function update(req, res, next) {
  try { const body = await convexDeviceRequest(`/iot/devices/${encodeURIComponent(String(req.params.id))}`, 'PATCH', { id: req.params.id, ...req.body }); const device = body.device ? mapDevice(body.device) : body; socket.emit('device:updated', device); res.json(device); } catch (error) { next(error); }
}

async function remove(req, res, next) {
  try { const body = await convexDeviceRequest(`/iot/devices/${encodeURIComponent(String(req.params.id))}`, 'DELETE'); socket.emit('device:deleted', body); res.json(body); } catch (error) { next(error); }
}

async function heartbeat(req, res, next) {
  try {
    if (!CONVEX_SITE_URL || !process.env.IOT_DEVICE_API_KEY) {
      throw Object.assign(new Error('Convex telemetry is not configured.'), { status: 503 });
    }
    const response = await fetch(`${CONVEX_SITE_URL}/iot/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-device-key': process.env.IOT_DEVICE_API_KEY,
      },
      body: JSON.stringify({
        device_code: String(req.params.device_code || '').trim(),
        device_name: req.body?.device_name || req.params.device_code,
        location: req.body?.location || 'Main residence',
        device_type: req.body?.device_type || 'ESP32 PIR',
        motion_detected: false,
        audio_detected: false,
        audio_level: 0,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || `Convex heartbeat failed (${response.status})`), { status: response.status });
    res.json(body.device ? mapDevice(body.device) : body);
  } catch (error) { next(error); }
}

module.exports = { list, create, update, remove, heartbeat };
