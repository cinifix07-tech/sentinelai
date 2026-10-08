const table = require('../models/table');
const socket = require('../socket');

async function listQuestions(req, res, next) {
  try {
    res.json(await table.list('interview_questions', 'question_order'));
  } catch (error) { next(error); }
}

async function createQuestion(req, res, next) {
  try {
    const row = await table.insert('interview_questions', req.body, [
      'session_id', 'question_text', 'question_order'
    ]);
    socket.emit('interview:question', row);
    res.status(201).json(row);
  } catch (error) { next(error); }
}

async function createResponse(req, res, next) {
  try {
    const body = {
      ...req.body,
      audio_file: req.body.audio_file ?? req.body.audio_url,
    };
    const row = await table.insert('voice_interactions', body, [
      'session_id', 'question_id', 'recognized_text', 'confidence', 'evaluation_result', 'audio_file'
    ]);
    socket.emit('interview:response', row);
    res.status(201).json(row);
  } catch (error) { next(error); }
}

module.exports = { listQuestions, createQuestion, createResponse };
