const router = require('express').Router();
const controller = require('../controllers/communicationController');

router.get('/people', controller.listPeople);
router.post('/heartbeat', controller.heartbeat);
router.get('/notifications', controller.listNotifications);
router.post('/groups', controller.createGroup);
router.get('/groups', controller.listGroups);
router.delete('/groups/:groupId', controller.deleteGroup);
router.get('/groups/:groupId/messages', controller.listGroupMessages);
router.post('/groups/messages', controller.sendGroupMessage);
router.get('/messages/:userId', controller.listMessages);
router.put('/messages/:userId/read', controller.markMessagesRead);
router.post('/messages', controller.sendMessage);

module.exports = router;
