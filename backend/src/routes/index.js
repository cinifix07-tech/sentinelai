const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/health', (req, res) => res.json({ ok: true, service: 'smart-home-security-api' }));

router.use('/auth', require('./authRoutes'));
router.use('/iot', require('./iotRoutes'));
// The signed-in account may update its own profile and password. The user
// router applies requireAdmin only to list, create, and other account-admin
// operations so client accounts are not blocked from self-service settings.
router.use('/users', authenticate, require('./userRoutes'));
router.use('/devices', authenticate, requireAdmin, require('./deviceRoutes'));
router.use('/security', authenticate, requireAdmin, require('./securityRoutes'));
router.use('/interview', authenticate, requireAdmin, require('./interviewRoutes'));
router.use('/access', authenticate, requireAdmin, require('./accessRoutes'));
router.use('/sensors', authenticate, requireAdmin, require('./sensorRoutes'));
router.use('/events', authenticate, requireAdmin, require('./eventRoutes'));
router.use('/alerts', authenticate, requireAdmin, require('./alertRoutes'));
router.use('/dashboard', authenticate, require('./dashboardRoutes'));
const communicationController = require('../controllers/communicationController');
router.post('/communicate/visitor-intake', communicationController.visitorIntake);
router.get('/communicate/visitor-messages/:visitorId', communicationController.listVisitorMessages);
router.post('/communicate/visitor-messages', communicationController.sendVisitorMessage);
router.use('/communicate', authenticate, require('./communicationRoutes'));
router.use('/ai', authenticate, require('./aiRoutes'));

module.exports = router;
