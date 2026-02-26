const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const analyzeMedia = async (transcript, mode) => {
  let prompt = "";
  switch (mode) {
    case 'summary':
      prompt = `Summarize the following transcript in 3 concise bullet points:\n\n${transcript}`;
      break;
    case 'explain':
      prompt = `Provide a deep analysis of the meaning and themes of this content based on the transcript:\n\n${transcript}`;
      break;
    case 'notes':
      prompt = `Generate structured lecture notes from this transcript with headers and sub-bullets:\n\n${transcript}`;
      break;
    default:
      prompt = `Analyze the following transcript:\n\n${transcript}`;
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
    });
    return chatCompletion.choices[0].message.content;
  } catch (err) {
    console.error('Groq API Error:', err.message);
    throw new Error('AI Analysis failed');
  }
};

module.exports = { analyzeMedia };
