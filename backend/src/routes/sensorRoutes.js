const router = require('express').Router();
const { createReading, latest, listReadings } = require('../controllers/sensorController');

router.post('/data', createReading);
router.get('/readings', listReadings);
router.get('/latest/:device_id', latest);

module.exports = router;
