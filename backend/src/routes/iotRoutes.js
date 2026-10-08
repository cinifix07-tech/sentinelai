const router = require('express').Router();
const { authenticate, requireAdmin, authenticateAdminOrDevice } = require('../middleware/auth');
const { ingest, latest, activity, mode, updateMode, testMotion } = require('../controllers/iotController');

router.post('/ingest', ingest);
router.get('/latest', authenticate, requireAdmin, latest);
router.get('/activity', authenticate, requireAdmin, activity);
router.get('/mode', authenticateAdminOrDevice, mode);
router.post('/mode', authenticate, requireAdmin, updateMode);
router.post('/test-motion', authenticate, requireAdmin, testMotion);

module.exports = router;
