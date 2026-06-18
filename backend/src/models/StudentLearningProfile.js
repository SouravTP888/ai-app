const mongoose = require('mongoose');

const StudentLearningProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  learningGoals: {
    type: String,
    default: ''
  },
  interests: {
    type: [String],
    default: []
  },
  completedCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  skillLevel: {
    type: String,
    default: ''
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('StudentLearningProfile', StudentLearningProfileSchema);
