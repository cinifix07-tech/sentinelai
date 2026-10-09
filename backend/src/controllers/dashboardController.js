const { listRecords } = require('../services/convexData');
const { listActivities } = require('../services/activityLog');

async function clientTelemetry() {
  const token = process.env.IOT_DEVICE_API_KEY;
  const site = process.env.CONVEX_SITE_URL || 'https://elated-eel-973.convex.site';
  if (!token) return null;
  const headers = { 'x-device-key': token };
  const [latestResponse, activityResponse] = await Promise.all([
    fetch(`${site}/iot/latest?device_code=esp32-porch-01`, { headers }),
    fetch(`${site}/iot/activity?limit=5000`, { headers }),
  ]);
  if (!latestResponse.ok) return null;
  const body = await latestResponse.json();
  const activityBody = activityResponse.ok ? await activityResponse.json() : { events: [] };
  if (!body.device) return { devices: [], readings: [], sensorEvents: activityBody.events || [] };
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
    sensorEvents: activityBody.events || [],
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
        sensorEvents: telemetry?.sensorEvents || [],
        sessions: [],
        voiceInteractions: [],
        alerts: [],
        activities,
      });
    }

    const [devices, readings, sessions, interactions, alerts, activities] = await Promise.all([
      listRecords('devices', { order: 'last_seen', limit: 20 }),
      listRecords('sensor_readings', { order: 'recorded_at', limit: 100 }),
      listRecords('security_sessions', { order: 'started_at', limit: 20 }),
      listRecords('voice_interactions', { order: 'processed_time', limit: 20 }),
      listRecords('alerts', { order: 'created_at', limit: 20 }),
      listActivities({ userId: req.user?.user_id, userEmail: req.user?.email }),
    ]);
    res.json({
      devices,
      latestReadings: readings,
      sessions,
      voiceInteractions: interactions,
      alerts,
      activities,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { dashboard };
