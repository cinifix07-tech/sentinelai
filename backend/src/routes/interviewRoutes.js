const router = require('express').Router();
const { listQuestions, createQuestion, createResponse } = require('../controllers/interviewController');

router.get('/questions', listQuestions);
router.post('/questions', createQuestion);
router.post('/response', createResponse);

module.exports = router;
