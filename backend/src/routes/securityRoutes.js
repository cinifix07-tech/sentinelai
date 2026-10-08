const router = require('express').Router();
const { createSession } = require('../controllers/securityController');

router.post('/session', createSession);

module.exports = router;
