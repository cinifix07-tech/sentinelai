const router = require('express').Router();
const crud = require('../controllers/crudController');
const { requireAdmin } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.get('/', crud.list('users', 'user_id'));
router.get('/:id', crud.get('users'));
router.post('/', requireAdmin, userController.create);
router.put('/me', userController.updateSelf);
router.put('/me/password', userController.changeSelfPassword);
router.put('/:id/password', requireAdmin, userController.changePassword);
router.put('/:id', requireAdmin, crud.patch('users'));
router.delete('/:id', requireAdmin, crud.remove('users'));

module.exports = router;
