const socket = require('../socket');

const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || 'https://elated-eel-973.convex.site';

async function convexTelemetry(path) {
  const token = process.env.IOT_DEVICE_API_KEY;
  if (!token) {
    const error = new Error('IOT_DEVICE_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${CONVEX_SITE_URL}${path}`, {
    headers: { 'x-device-key': token },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Convex telemetry request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function convexSetMode(mode, lockdownActive, muted) {
  const controlToken = process.env.CONVEX_CONTROL_TOKEN;
  if (!controlToken) return null;
  const response = await fetch(`${CONVEX_SITE_URL}/iot/mode`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-backend-control-token': controlToken },
    body: JSON.stringify({ mode, lockdown_active: lockdownActive, muted }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || `Convex mode update failed (${response.status})`), { status: response.status });
  return body.state;
}

const DEFAULT_DEVICE = {
  code: 'esp32-porch-01',
  name: 'ESP32 Porch Node',
  location: 'Front entrance',
  type: 'ESP32 PIR',
};

let securityStateReady;

async function ensureSecurityState() {
  if (!securityStateReady) {
    securityStateReady = query(`
      CREATE TABLE IF NOT EXISTS iot_security_state (
        state_id SMALLINT PRIMARY KEY DEFAULT 1,
        mode VARCHAR(16) NOT NULL DEFAULT 'away',
        lockdown_active BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT iot_security_state_singleton CHECK (state_id = 1),
        CONSTRAINT iot_security_state_mode CHECK (mode IN ('away', 'home', 'disarm'))
      )
    `).then(() => query(`
      INSERT INTO iot_security_state (state_id)
      VALUES (1)
      ON CONFLICT (state_id) DO NOTHING
    `));
  }
  await securityStateReady;
  const result = await query('SELECT mode, lockdown_active, updated_at FROM iot_security_state WHERE state_id = 1');
  return result.rows[0] || { mode: 'away', lockdown_active: false };
}

async function recordMotion(device, body = {}, state) {
  const readingResult = await query(`
    INSERT INTO sensor_readings (device_id, motion_detected, audio_detected, audio_level)
    VALUES ($1, $2, $3, $4)
    RETURNING *, recorded_at AS created_at
  `, [
    device.device_id,
    Boolean(body.motion_detected),
    Boolean(body.audio_detected),
    Number.isFinite(Number(body.audio_level)) ? Number(body.audio_level) : 0,
  ]);
  const reading = readingResult.rows[0];
  let event = null;
  if (Boolean(body.motion_detected)) {
    const status = state.mode === 'disarm' ? 'passive' : 'info';
    const eventResult = await query(`
      INSERT INTO security_events (device_id, event_type, event_status, description, confidence)
      VALUES ($1, 'MOTION_DETECTED', $2, $3, $4)
      RETURNING *
    `, [
      device.device_id,
      status,
      `${device.device_name || device.device_code} detected motion (${state.mode})`,
      0.98,
    ]);
    event = eventResult.rows[0];
    socket.emit('motion:detected', reading);
    socket.emit('security:event', event);
  }
  socket.emit('sensor:reading', reading);
  return { reading, event };
}

function requireDeviceKey(req) {
  const expected = process.env.IOT_DEVICE_API_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev-device-key');
  if (!expected || expected === 'replace_me') {
    const error = new Error('IOT_DEVICE_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }
  const provided = req.get('x-device-key') || req.body?.api_key;
  if (provided !== expected) {
    const error = new Error('Invalid device API key.');
    error.status = 401;
    throw error;
  }
}

async function ensureDevice(body = {}) {
  const deviceCode = String(body.device_code || DEFAULT_DEVICE.code).trim();
  const deviceName = String(body.device_name || DEFAULT_DEVICE.name).trim();
  const location = String(body.location || DEFAULT_DEVICE.location).trim();
  const deviceType = String(body.device_type || DEFAULT_DEVICE.type).trim();

  const existing = await query('SELECT * FROM devices WHERE device_code = $1 LIMIT 1', [deviceCode]);
  if (existing.rows[0]) {
    const updated = await query(`
      UPDATE devices
      SET device_name = $1, location = $2, device_type = $3, is_online = true, last_seen = CURRENT_TIMESTAMP
      WHERE device_id = $4
      RETURNING *
    `, [deviceName, location, deviceType, existing.rows[0].device_id]);
    return updated.rows[0];
  }

  const result = await query(`
    INSERT INTO devices (device_code, device_name, location, device_type, is_online, last_seen)
    VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
    RETURNING *
  `, [deviceCode, deviceName, location, deviceType]);

  return result.rows[0];
}

async function ingest(req, res, next) {
  try {
    requireDeviceKey(req);

    const device = await ensureDevice(req.body);
    const state = await ensureSecurityState();
    const { reading, event } = await recordMotion(device, req.body, state);

    socket.emit('device:heartbeat', device);

    res.status(201).json({ ok: true, device, reading, event, state });
  } catch (error) {
    next(error);
  }
}

async function latest(req, res, next) {
  try {
    const response = await convexTelemetry(`/iot/latest?device_code=${encodeURIComponent(req.query.device_code || DEFAULT_DEVICE.code)}`);
    const row = response.device;
    const reading = response.reading;
    if (!row) return res.json({ ok: true, device: null, reading: null, state: response.state });
    res.json({
      ok: true,
      device: {
        device_id: row._id,
        device_code: row.deviceCode,
        device_name: row.deviceName,
        location: row.location,
        device_type: row.deviceType,
        is_online: row.isOnline,
        last_seen: new Date(row.lastSeen).toISOString(),
      },
      reading: reading ? {
        device_id: row._id,
        motion_detected: reading.motionDetected,
        audio_detected: reading.audioDetected,
        audio_level: reading.audioLevel,
        created_at: new Date(reading.recordedAt).toISOString(),
      } : null,
      state: response.state,
    });
  } catch (error) {
    next(error);
  }
}

async function activity(req, res, next) {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 5000)
      : 1000;
    const response = await convexTelemetry(`/iot/activity?limit=${limit}`);
    res.json({ ok: true, events: response.events || [] });
  } catch (error) {
    next(error);
  }
}

async function mode(req, res, next) {
  try {
    res.json({ ok: true, state: await ensureSecurityState() });
  } catch (error) {
    next(error);
  }
}

async function updateMode(req, res, next) {
  try {
    const nextMode = String(req.body?.mode || '').toLowerCase();
    const validModes = new Set(['away', 'home', 'disarm']);
    if (!validModes.has(nextMode)) return res.status(400).json({ error: 'mode must be away, home, or disarm' });
    const lockdownActive = typeof req.body?.lockdown_active === 'boolean' ? req.body.lockdown_active : undefined;
    const result = await query(`
      INSERT INTO iot_security_state (state_id, mode, lockdown_active, updated_at)
      VALUES (1, $1, COALESCE($2, false), CURRENT_TIMESTAMP)
      ON CONFLICT (state_id) DO UPDATE SET
        mode = EXCLUDED.mode,
        lockdown_active = COALESCE($2, iot_security_state.lockdown_active),
        updated_at = CURRENT_TIMESTAMP
      RETURNING mode, lockdown_active, updated_at
    `, [nextMode, lockdownActive ?? null]);
    const state = result.rows[0];
    await convexSetMode(state.mode, state.lockdown_active);
    socket.emit('iot:mode', state);
    res.json({ ok: true, state });
  } catch (error) {
    next(error);
  }
}

async function testMotion(req, res, next) {
  try {
    const state = await ensureSecurityState();
    const device = await ensureDevice({
      device_code: req.body?.device_code,
      device_name: req.body?.device_name,
      location: req.body?.location,
    });
    const result = await recordMotion(device, { ...req.body, motion_detected: true }, state);
    res.status(201).json({ ok: true, ...result, state });
  } catch (error) {
    next(error);
  }
}

async function convexIngest(req, res, next) {
  try {
    requireDeviceKey(req);
    const response = await fetch(`${CONVEX_SITE_URL}/iot/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-device-key': req.get('x-device-key') || req.body?.api_key || '' },
      body: JSON.stringify(req.body || {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(response.status).json(body);
    socket.emit('sensor:reading', body.reading);
    if (body.event) socket.emit('security:event', body.event);
    res.status(201).json(body);
  } catch (error) { next(error); }
}

async function convexMode(req, res, next) {
  try {
    const body = await convexTelemetry('/iot/mode');
    res.json({ ok: true, state: { mode: body.state?.mode || 'away', lockdown_active: Boolean(body.state?.lockdownActive ?? body.state?.lockdown_active), muted: Boolean(body.state?.soundMuted ?? body.state?.muted), updated_at: body.state?.updatedAt } });
  } catch (error) { next(error); }
}

async function convexUpdateMode(req, res, next) {
  try {
    const result = await convexSetMode(String(req.body?.mode || '').toLowerCase(), req.body?.lockdown_active, req.body?.muted);
    const state = { mode: result?.mode || 'away', lockdown_active: Boolean(result?.lockdownActive ?? result?.lockdown_active), muted: Boolean(result?.soundMuted ?? result?.muted), updated_at: result?.updatedAt };
    socket.emit('iot:mode', state);
    res.json({ ok: true, state });
  } catch (error) { next(error); }
}

async function clientControl(req, res, next) {
  try {
    const hasAwayRequest = req.body?.mode !== undefined;
    const hasMuteRequest = typeof req.body?.muted === 'boolean';
    if (!hasAwayRequest && !hasMuteRequest) return res.status(400).json({ error: 'Provide mode or muted.' });
    if (hasAwayRequest && !['away', 'disarm'].includes(String(req.body.mode).toLowerCase())) return res.status(403).json({ error: 'Client controls support Armed away or passive mode.' });

    const currentResponse = await convexTelemetry('/iot/mode');
    const current = currentResponse.state || {};
    const result = await convexSetMode(
      hasAwayRequest ? 'away' : (current.mode || 'away'),
      Boolean(current.lockdownActive ?? current.lockdown_active),
      hasMuteRequest ? req.body.muted : Boolean(current.soundMuted ?? current.muted),
    );
    const state = { mode: result?.mode || 'away', lockdown_active: Boolean(result?.lockdownActive ?? result?.lockdown_active), muted: Boolean(result?.soundMuted ?? result?.muted), updated_at: result?.updatedAt };
    res.json({ ok: true, state });
  } catch (error) { next(error); }
}

async function convexTestMotion(req, res, next) {
  req.body = { ...(req.body || {}), motion_detected: true };
  return convexIngest(req, res, next);
}

module.exports = { ingest: convexIngest, latest, activity, mode: convexMode, updateMode: convexUpdateMode, clientControl, testMotion: convexTestMotion };
