const { query } = require('../config/database');
const crud = require('./crudController');
const socket = require('../socket');

async function heartbeat(req, res, next) {
  try {
    const result = await query(
      'UPDATE devices SET is_online = true, last_seen = CURRENT_TIMESTAMP WHERE device_code = $1 RETURNING *',
      [req.params.device_code]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Device not found' });
    socket.emit('device:heartbeat', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list: crud.list('devices', 'last_seen'),
  create: crud.create('devices', 'device:created'),
  update: crud.patch('devices', 'device:updated'),
  heartbeat,
};
