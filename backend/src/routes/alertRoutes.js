const router = require('express').Router();
const { list, create, markRead } = require('../controllers/alertController');

router.post('/', create);
router.get('/', list);
router.put('/:id/read', markRead);

module.exports = router;
