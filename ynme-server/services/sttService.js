const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const os = require('os');
const path = require('path');

const transcribeAudio = async (audioBuffer) => {
  const apiKey = process.env.WHISPER_API_KEY;
  if (!apiKey || apiKey === 'your_whisper_api_key_here') {
    throw new Error('Whisper API key not configured');
  }

  // Create temporary file from buffer to send to OpenAI
  const tempPath = path.join(os.tmpdir(), `whisper_chunk_${Date.now()}.webm`);
  fs.writeFileSync(tempPath, audioBuffer);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(tempPath));
  formData.append('model', 'whisper-1');

  try {
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${apiKey}`
      }
    });

    // Cleanup temp file
    fs.unlinkSync(tempPath);
    
    return response.data.text;
  } catch (err) {
    console.error('Whisper API Error:', err.response?.data || err.message);
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw new Error('Speech-to-text failed');
  }
};

module.exports = { transcribeAudio };
