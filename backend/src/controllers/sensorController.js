const { query } = require('../config/database');
const table = require('../models/table');
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
    const result = await query(
      'SELECT *, recorded_at AS created_at FROM sensor_readings WHERE device_id = $1 ORDER BY recorded_at DESC NULLS LAST LIMIT 1',
      [req.params.device_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No readings found for device' });
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

async function listReadings(req, res, next) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = 5;
    const deviceId = String(req.query.device_id || '').trim();
    const params = [];
    const filters = [];

    if (deviceId) {
      params.push(deviceId);
      filters.push(`(d.device_code = $${params.length} OR sr.device_id::text = $${params.length})`);
    }

    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const countResult = await query(`
      SELECT COUNT(*)::int AS total
        FROM sensor_readings sr
        LEFT JOIN devices d ON d.device_id = sr.device_id
        ${whereSql}
    `, params);
    const total = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const result = await query(`
      SELECT sr.*, sr.recorded_at AS created_at, d.device_code, d.device_name, d.location
        FROM sensor_readings sr
        LEFT JOIN devices d ON d.device_id = sr.device_id
        ${whereSql}
       ORDER BY sr.recorded_at DESC NULLS LAST
       LIMIT ${pageSize} OFFSET $${params.length + 1}
    `, [...params, offset]);

    return res.json({
      readings: result.rows,
      page: currentPage,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    });
  } catch (error) { next(error); }
}

module.exports = { createReading, latest, listReadings };
