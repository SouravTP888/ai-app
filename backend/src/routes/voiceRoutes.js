const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  voiceChat,
  getVoiceHistory,
  getVoiceRecommendations
} = require('../controllers/voiceController');

router.use(protect);

router.post('/chat', voiceChat);
router.get('/history', getVoiceHistory);
router.post('/recommend', getVoiceRecommendations);

module.exports = router;
