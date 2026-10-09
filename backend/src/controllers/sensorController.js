const table = require('../models/table');
const socket = require('../socket');

const convexReadings = async (deviceCode, limit = 100) => {
  const baseUrl = String(process.env.CONVEX_SITE_URL || '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('CONVEX_SITE_URL is not configured');
  const url = new URL(`${baseUrl}/iot/readings`);
  if (deviceCode) url.searchParams.set('device_code', deviceCode);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url, { headers: { 'x-device-key': process.env.IOT_DEVICE_API_KEY || '' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Convex readings request failed (${response.status})`);
  return Array.isArray(body.readings) ? body.readings : [];
};

async function createReading(req, res, next) {
  try {
    const row = await table.insert('sensor_readings', req.body, [
      'device_id', 'motion_detected', 'audio_detected', 'audio_level', 'temperature', 'humidity'
    ]);
    socket.emit('sensor:reading', row);
    if (row.motion_detected) socket.emit('motion:detected', row);
    res.status(201).json(row);
  } catch (error) { next(error); }
}

async function latest(req, res, next) {
  try {
    const rows = await convexReadings(req.params.device_id, 1);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'No readings found for device' });
    res.json(row);
  } catch (error) { next(error); }
}

async function listReadings(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = 5;
    const deviceId = String(req.query.device_id || '').trim();
    const rows = await convexReadings(deviceId || undefined, 5000);
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const pageRows = rows.slice(offset, offset + pageSize);

    return res.json({
      readings: pageRows,
      page: currentPage,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    });
  } catch (error) { next(error); }
}

module.exports = { createReading, latest, listReadings };
