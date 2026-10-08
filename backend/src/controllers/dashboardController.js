const { query } = require('../config/database');
const { listActivities } = require('../services/activityLog');

async function clientTelemetry() {
  const token = process.env.IOT_DEVICE_API_KEY;
  const site = process.env.CONVEX_SITE_URL || 'https://elated-eel-973.convex.site';
  if (!token) return null;
  const response = await fetch(`${site}/iot/latest?device_code=esp32-porch-01`, { headers: { 'x-device-key': token } });
  if (!response.ok) return null;
  const body = await response.json();
  if (!body.device) return { devices: [], readings: [] };
  return {
    devices: [{
      device_id: body.device._id,
      device_code: body.device.deviceCode,
      device_name: body.device.deviceName,
      location: body.device.location,
      device_type: body.device.deviceType,
      is_online: body.device.isOnline,
      last_seen: new Date(body.device.lastSeen).toISOString(),
    }],
    readings: body.reading ? [{
      device_id: body.device._id,
      motion_detected: body.reading.motionDetected,
      audio_detected: body.reading.audioDetected,
      audio_level: body.reading.audioLevel,
      created_at: new Date(body.reading.recordedAt).toISOString(),
    }] : [],
  };
}

async function dashboard(req, res, next) {
  try {
    if (req.user?.role !== 'ADMIN') {
      const telemetry = await clientTelemetry();
      const activities = await listActivities({ userId: req.user?.user_id, userEmail: req.user?.email });
      return res.json({
        devices: telemetry?.devices || [],
        latestReadings: telemetry?.readings || [],
        sessions: [],
        voiceInteractions: [],
        alerts: [],
        activities,
      });
    }

    const [devices, readings, sessions, interactions, alerts, activities] = await Promise.all([
      query('SELECT * FROM devices ORDER BY last_seen DESC NULLS LAST LIMIT 20'),
      query('SELECT DISTINCT ON (device_id) *, recorded_at AS created_at FROM sensor_readings ORDER BY device_id, recorded_at DESC NULLS LAST'),
      query('SELECT *, session_status AS status, final_result AS authorization_result, started_at AS created_at FROM security_sessions ORDER BY started_at DESC NULLS LAST LIMIT 20'),
      query('SELECT *, processed_time AS created_at FROM voice_interactions ORDER BY processed_time DESC NULLS LAST LIMIT 20'),
      query('SELECT *, alert_level AS severity FROM alerts ORDER BY created_at DESC NULLS LAST LIMIT 20'),
      listActivities({ userId: req.user?.user_id, userEmail: req.user?.email }),
    ]);
    res.json({
      devices: devices.rows,
      latestReadings: readings.rows,
      sessions: sessions.rows,
      voiceInteractions: interactions.rows,
      alerts: alerts.rows,
      activities,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { dashboard };
