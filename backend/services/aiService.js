const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

exports.generateAIResponse = async (message, systemPrompt) => {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: systemPrompt || `
You are EduFlick AI Mentor.

Return ONLY valid JSON:
{
  "reply": "short helpful response",
  "recommendedCourseIds": []
}
`,
        },
        {
          role: "user",
          content: message || "",
        },
      ],
      temperature: 0.7,
    });

    const content = response?.choices?.[0]?.message?.content;

    if (!content) {
      return {
        reply: "No response from AI.",
        recommendedCourseIds: [],
      };
    }

    try {
      return JSON.parse(content);
    } catch (err) {
      return {
        reply: content,
        recommendedCourseIds: [],
      };
    }

  } catch (error) {
    console.error("Groq API Error:", error.message);

    return {
      reply: "AI service temporarily unavailable.",
      recommendedCourseIds: [],
    };
  }
};