const router = require('express').Router();
const controller = require('../controllers/deviceController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', controller.list);
router.post('/', requireAdmin, controller.create);
router.put('/:id', requireAdmin, controller.update);
router.delete('/:id', requireAdmin, controller.remove);
router.post('/:device_code/heartbeat', controller.heartbeat);

module.exports = router;
