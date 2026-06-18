const mongoose = require('mongoose');

const ConversationHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userMessage: {
    type: String,
    required: true
  },
  aiResponse: {
    type: String,
    required: true
  },
  recommendedCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ConversationHistory', ConversationHistorySchema);
