const router = require('express').Router();
const { authenticate, requireAdmin, authenticateAdminOrDevice } = require('../middleware/auth');
const { ingest, latest, activity, mode, updateMode, clientControl, testMotion } = require('../controllers/iotController');

router.post('/ingest', ingest);
router.get('/latest', authenticate, requireAdmin, latest);
router.get('/activity', authenticate, requireAdmin, activity);
router.get('/mode', authenticateAdminOrDevice, mode);
router.post('/mode', authenticate, requireAdmin, updateMode);
router.get('/client-mode', authenticate, mode);
router.post('/client-control', authenticate, clientControl);
router.post('/test-motion', authenticate, requireAdmin, testMotion);

module.exports = router;
