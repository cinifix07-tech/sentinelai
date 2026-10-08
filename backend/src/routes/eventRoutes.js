const router = require('express').Router();
const { createEvent, listEvents } = require('../controllers/eventController');

router.post('/', createEvent);
router.get('/', listEvents);

module.exports = router;
