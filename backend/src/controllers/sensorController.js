const table = require('../models/table');
const { listRecords } = require('../services/convexData');
const socket = require('../socket');

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
    const rows = await listRecords('sensor_readings', { order: 'recorded_at', limit: 1000 });
    const row = rows.find((item) => String(item.device_id) === String(req.params.device_id) || String(item.device_code) === String(req.params.device_id));
    if (!row) return res.status(404).json({ error: 'No readings found for device' });
    res.json({ ...row, created_at: row.recorded_at || row.created_at });
  } catch (error) { next(error); }
}

async function listReadings(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = 5;
    const deviceId = String(req.query.device_id || '').trim();
    let rows = await listRecords('sensor_readings', { order: 'recorded_at', limit: 1000 });
    if (deviceId) rows = rows.filter((row) => String(row.device_id) === deviceId || String(row.device_code) === deviceId);
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const pageRows = rows.slice(offset, offset + pageSize).map((row) => ({
      ...row,
      created_at: row.recorded_at || row.created_at,
    }));

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
