const axios = require('axios');
const dbService = require('../utils/dbService');

// Helper to get course database and construct simple summary
const getCatalogCourses = async () => {
  const courses = await dbService.findCourses({});
  return courses.map(c => ({
    id: (c._id || c.id).toString(),
    title: c.title,
    description: c.description,
    category: c.category,
    difficulty: c.difficulty,
    duration: c.duration
  }));
};

// Local offline fallback response generation
const generateOfflineVoiceResponse = (message, user, courses) => {
  const msg = message.toLowerCase();
  let reply = '';
  let recommendedCourseIds = [];

  // Match: AI Engineer
  if (msg.includes('artificial intelligence') || msg.includes('ai engineer') || msg.includes('machine learning') || msg.includes('deep learning') || msg.includes('learn artificial')) {
    const aiCourses = courses.filter(c => c.category === 'AI Engineer');
    // Sort beginner to advanced
    const order = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
    aiCourses.sort((a, b) => order[a.difficulty] - order[b.difficulty]);

    reply = `To become an AI Engineer, I recommend a structured path starting with Python, followed by Machine Learning and Deep Learning. At EduFlick, you should study: 1) Python Fundamentals for AI, 2) Machine Learning Essentials, 3) Deep Learning & Neural Networks, and 4) AI Projects & System Deployment. This roadmap will give you both the theoretical core and hands-on deployment skills!`;
    recommendedCourseIds = aiCourses.map(c => c.id);
  }
  // Match: Beginner programmer
  else if (msg.includes('beginner') || msg.includes('start programming') || msg.includes('learn programming') || msg.includes('first language')) {
    const beginnerCourses = courses.filter(c => c.difficulty === 'Beginner');
    reply = `Welcome to programming! For a beginner, I highly recommend starting with 'Python Fundamentals for AI' if you are interested in AI and data science, or 'HTML, CSS & JavaScript Fundamentals' if web development is your goal. Both courses are designed with zero prerequisites and will build your confidence quickly!`;
    // Suggest top 2 beginner courses
    recommendedCourseIds = beginnerCourses.slice(0, 2).map(c => c.id);
  }
  // Match: Full Stack Developer
  else if (msg.includes('full stack') || msg.includes('web developer') || msg.includes('frontend') || msg.includes('backend') || msg.includes('react')) {
    const fsCourses = courses.filter(c => c.category === 'Full Stack Developer');
    const order = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
    fsCourses.sort((a, b) => order[a.difficulty] - order[b.difficulty]);

    reply = `To become a Full Stack Developer, you need to master both client-side and server-side web technologies. Your recommended path at EduFlick is: 1) HTML, CSS & JavaScript Fundamentals, 2) React & Frontend Architecture, 3) Node.js & Express API Development, and 4) Scalable Full Stack System Design. This covers interactive frontend UIs up to scaling backend databases!`;
    recommendedCourseIds = fsCourses.map(c => c.id);
  }
  // Match: Data Science
  else if (msg.includes('data science') || msg.includes('data scientist') || msg.includes('statistics') || msg.includes('pandas')) {
    const dsCourses = courses.filter(c => c.category === 'Data Scientist' || c.title.includes('Data Science'));
    reply = `For a career in Data Science, you must be comfortable with data wrangling, cleaning, statistics, and visualization. Start with 'Python Fundamentals for AI' to learn coding basics, then move to 'Introduction to Data Science with Python' for Pandas and NumPy, followed by 'Statistical Data Analysis & Visualization' to extract and present insights!`;
    recommendedCourseIds = dsCourses.map(c => c.id);
  }
  // Match: Cyber Security
  else if (msg.includes('cyber security') || msg.includes('security') || msg.includes('ethical hacking') || msg.includes('hacking') || msg.includes('network')) {
    const csCourses = courses.filter(c => c.category === 'Cyber Security Specialist' || c.title.includes('Security'));
    reply = `To break into Cyber Security, networking foundations and understanding attacker methodologies are essential. I recommend starting with 'Introduction to Cyber Security & Networking' to master firewalls and TCP/IP, and then taking 'Ethical Hacking & Penetration Testing' to learn vulnerability assessments using Kali Linux tools.`;
    recommendedCourseIds = csCourses.map(c => c.id);
  }
  // Default reply
  else {
    reply = `Hello! I am your EduFlick AI Mentor. I am here to help you choose courses, understand tech concepts, create personalized learning paths, and boost your skills. You are currently registered on the ${user.selectedTrack || 'general tech'} track as a ${user.skillLevel || 'Beginner'} learner. Let me know if you would like a learning path for AI, Full Stack, Data Science, or Cyber Security!`;
    
    // Recommend based on user's selected track
    if (user.selectedTrack) {
      const trackCourses = courses.filter(c => c.category === user.selectedTrack);
      recommendedCourseIds = trackCourses.slice(0, 2).map(c => c.id);
    }
  }

  return {
    reply,
    recommendedCourseIds
  };
};

// @desc    Process student query and get AI Voice Mentor response
// @route   POST /api/voice/chat
// @access  Private
exports.voiceChat = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id || req.user._id;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const user = await dbService.findUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Load user progress
    const progressList = await dbService.findProgressByUser(userId);
    const completedCourseIds = progressList
      .filter(p => p.status === 'Completed' || p.completionPercentage >= 100)
      .map(p => (p.courseId._id || p.courseId.id || p.courseId).toString());

    const availableCourses = await getCatalogCourses();
    const completedCourseTitles = availableCourses
      .filter(c => completedCourseIds.includes(c.id))
      .map(c => c.title);

    // Retrieve or create learning profile
    const learningProfile = await dbService.getOrCreateLearningProfile(userId, {
      skillLevel: user.skillLevel || 'Beginner',
      interests: user.interests || [],
      completedCourses: completedCourseIds
    });

    const apiKey = process.env.OPENAI_API_KEY;

    let aiResponseText = '';
    let recommendedCourseIds = [];

    if (apiKey) {
      try {
        console.log('Voice AI: Calling OpenAI Chat Completions...');
        const systemPrompt = `You are EduFlick AI Mentor, a specialized AI voice learning assistant for EduFlick LMS.
Your goal is to help students choose courses, understand concepts, create learning paths, and improve their technical skills.
You are talking to user: ${user.name}.
User's current track/goal: ${user.selectedTrack || 'General Tech studies'}.
User's current skill level: ${learningProfile.skillLevel || user.skillLevel || 'Beginner'}.
User's interests: ${learningProfile.interests.join(', ') || user.interests.join(', ') || 'None specified'}.
User's completed courses: ${completedCourseTitles.join(', ') || 'None completed yet'}.

Available courses in our catalog:
${JSON.stringify(availableCourses, null, 2)}

When recommending paths or courses, recommend ONLY from the available courses in our catalog matching their interests and track.
Specifically, if the student asks for a roadmap or courses, suggest a sequence of course titles from the catalog.

You must respond in a valid JSON object format containing the following fields:
{
  "reply": "Your friendly, supportive conversational text response (about 2-4 sentences, suitable for voice synthesis)",
  "recommendedCourseIds": ["Array of course IDs (strings) from the available courses that you recommend in this turn. If none, leave empty."]
}`;

        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            }
          }
        );

        const resultJson = JSON.parse(response.data.choices[0].message.content.trim());
        aiResponseText = resultJson.reply;
        recommendedCourseIds = resultJson.recommendedCourseIds || [];
      } catch (err) {
        console.error('OpenAI voice chat API call failed:', err.message);
        // Fallback to offline matcher
        const fallback = generateOfflineVoiceResponse(message, user, availableCourses);
        aiResponseText = fallback.reply;
        recommendedCourseIds = fallback.recommendedCourseIds;
      }
    } else {
      console.log('Voice AI: No OpenAI key found. Running offline matching fallback...');
      const fallback = generateOfflineVoiceResponse(message, user, availableCourses);
      aiResponseText = fallback.reply;
      recommendedCourseIds = fallback.recommendedCourseIds;
    }

    // Save conversation to database
    const savedConv = await dbService.saveConversation(
      userId,
      message,
      aiResponseText,
      recommendedCourseIds
    );

    // Sync student learning profile with their goals/interests if they spoken them
    const updatedProfileUpdates = {};
    const lowerMessage = message.toLowerCase();
    
    // Simple profile extraction
    if (lowerMessage.includes('want to learn') || lowerMessage.includes('interested in') || lowerMessage.includes('become a')) {
      updatedProfileUpdates.learningGoals = message;
      // Extrapolate skill level if mentioned
      if (lowerMessage.includes('beginner') || lowerMessage.includes('starter') || lowerMessage.includes('newbie')) {
        updatedProfileUpdates.skillLevel = 'Beginner';
      } else if (lowerMessage.includes('intermediate') || lowerMessage.includes('experience')) {
        updatedProfileUpdates.skillLevel = 'Intermediate';
      } else if (lowerMessage.includes('advanced') || lowerMessage.includes('senior')) {
        updatedProfileUpdates.skillLevel = 'Advanced';
      }
      
      // Update profile
      await dbService.updateLearningProfile(userId, updatedProfileUpdates);
    }

    res.json({
      success: true,
      userMessage: message,
      aiResponse: aiResponseText,
      recommendedCourses: savedConv.recommendedCourses || [],
      timestamp: savedConv.timestamp || new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Retrieve student's conversation history
// @route   GET /api/voice/history
// @access  Private
exports.getVoiceHistory = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const history = await dbService.getConversationsByUser(userId);

    res.json({
      success: true,
      history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Generate personalized course recommendations
// @route   POST /api/voice/recommend
// @access  Private
exports.getVoiceRecommendations = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await dbService.findUserById(userId);
    const availableCourses = await getCatalogCourses();

    const { goal, interests, skillLevel } = req.body;

    // Fetch progress completed
    const progressList = await dbService.findProgressByUser(userId);
    const completedCourseIds = progressList
      .filter(p => p.status === 'Completed' || p.completionPercentage >= 100)
      .map(p => (p.courseId._id || p.courseId.id || p.courseId).toString());

    // Fallback profile details if body is empty
    const profile = await dbService.getOrCreateLearningProfile(userId, {
      skillLevel: skillLevel || user.skillLevel || 'Beginner',
      interests: interests || user.interests || [],
      completedCourses: completedCourseIds,
      learningGoals: goal || user.selectedTrack || ''
    });

    const targetGoal = goal || profile.learningGoals || user.selectedTrack || '';
    const targetInterests = interests || profile.interests || user.interests || [];
    const targetSkillLevel = skillLevel || profile.skillLevel || user.skillLevel || 'Beginner';

    const apiKey = process.env.OPENAI_API_KEY;
    let recommendations = [];
    let reasoning = '';

    if (apiKey) {
      try {
        console.log('Voice AI Recommendation: Calling OpenAI completions...');
        const prompt = `Based on a student's profile:
Goal: ${targetGoal}
Interests: ${targetInterests.join(', ')}
Skill Level: ${targetSkillLevel}
Completed Courses: ${progressList.filter(p => p.status === 'Completed').map(p => p.courseId.title).join(', ')}

Suggest the best matching courses from the catalog below.
Catalog:
${JSON.stringify(availableCourses, null, 2)}

Return a valid JSON object format:
{
  "recommendations": ["Array of course IDs (strings)"],
  "reasoning": "A paragraph explaining why this path/courses fit the student's requirements."
}`;

        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.5
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            }
          }
        );

        const resultJson = JSON.parse(response.data.choices[0].message.content.trim());
        const recIds = resultJson.recommendations || [];
        reasoning = resultJson.reasoning || '';
        
        // Populate recommendations objects
        const dbCourses = await dbService.findCourses({});
        recommendations = dbCourses.filter(c => recIds.includes((c._id || c.id || '').toString()));
      } catch (err) {
        console.error('OpenAI recommendation failed, falling back to local recommendation logic...', err.message);
      }
    }

    // Local recommendation fallback (if OpenAI failed or was not configured)
    if (recommendations.length === 0) {
      console.log('Voice AI Recommendation: Running offline recommendation...');
      // Filter out completed courses
      const nonCompleted = availableCourses.filter(c => !completedCourseIds.includes(c.id));
      
      // Filter by category or track
      let matched = nonCompleted.filter(c => 
        c.category.toLowerCase().includes(targetGoal.toLowerCase()) || 
        targetGoal.toLowerCase().includes(c.category.toLowerCase())
      );

      // If no category match, match by interests or keywords
      if (matched.length === 0) {
        matched = nonCompleted.filter(c => 
          targetInterests.some(interest => c.title.toLowerCase().includes(interest.toLowerCase()) || c.description.toLowerCase().includes(interest.toLowerCase()))
        );
      }

      // If still empty, fall back to matching skill level
      if (matched.length === 0) {
        matched = nonCompleted.filter(c => c.difficulty.toLowerCase() === targetSkillLevel.toLowerCase());
      }

      // If still empty, just grab first 2 courses
      if (matched.length === 0) {
        matched = nonCompleted.slice(0, 2);
      }

      const recIds = matched.map(c => c.id);
      const dbCourses = await dbService.findCourses({});
      recommendations = dbCourses.filter(c => recIds.includes((c._id || c.id || '').toString()));
      
      reasoning = `Based on your goal to study "${targetGoal}" as a ${targetSkillLevel} learner, we recommend completing these courses sequentially. They are designed to align with your interests and fill your skill gaps.`;
    }

    res.json({
      success: true,
      recommendations,
      reasoning
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
