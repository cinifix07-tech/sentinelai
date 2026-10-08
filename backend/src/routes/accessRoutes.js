const router = require('express').Router();
const { listAttempts, createAttempt, createActivity } = require('../controllers/accessController');

router.get('/attempts', listAttempts);
router.post('/attempt', createAttempt);
router.post('/activity', createActivity);

module.exports = router;
