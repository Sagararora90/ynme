const axios = require('axios');

const translateText = async (text, targetLanguage = 'Hindi') => {
  const apiKey = process.env.WHISPER_API_KEY; // Reusing OpenAI key
  if (!apiKey) return text;

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional media translator. Translate the following transcript into ${targetLanguage}. 
          Keep it concise and synchronized for subtitle display. Only return the translated text, no extra commentary.`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('[Translation Error]', err.message);
    return text; // Fallback to original
  }
};

module.exports = { translateText };
