const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const cookieHeader = req.headers.cookie || '';
  const cookieToken = cookieHeader
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === 'sentinel_session')?.[1];
  const token = header.startsWith('Bearer ') ? header.slice(7) : cookieToken;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Admin role required' });
  return next();
}

function authenticateAdminOrDevice(req, res, next) {
  const deviceKey = req.headers['x-device-key'] || req.body?.api_key;
  const expected = process.env.IOT_DEVICE_API_KEY;
  if (expected && deviceKey && deviceKey === expected) {
    req.deviceClient = true;
    return next();
  }
  authenticate(req, res, () => requireAdmin(req, res, next));
}

module.exports = { authenticate, requireAdmin, authenticateAdminOrDevice };
