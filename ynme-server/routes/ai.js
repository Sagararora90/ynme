const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { analyzeMedia } = require('../services/aiService');

router.post('/analyze', auth, async (req, res) => {
  try {
    const { transcript, mode } = req.body;
    if (!transcript) return res.status(400).json({ message: 'Transcript required' });
    
    const analysis = await analyzeMedia(transcript, mode);
    res.json({ analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'AI Analysis failed' });
  }
});

const { searchMedia } = require('../services/searchService');

router.post('/generate', auth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ message: 'Prompt required' });

    // 1. Generate Query List using Groq
    const groq = require('groq-sdk');
    const groqClient = new groq({ apiKey: process.env.GROQ_API_KEY });
    
    const aiRes = await groqClient.chat.completions.create({
      messages: [{ 
        role: 'user', 
        content: `Generate a list of 5 media search queries for the following theme: "${prompt}". Return ONLY a JSON array of strings. Example: ["Believer", "Starboy"]`
      }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: "json_object" }
    });

    const queries = JSON.parse(aiRes.choices[0].message.content).queries || [];
    
    // 2. Search for each query
    const playlistItems = [];
    for (const q of queries) {
      const results = await searchMedia(q);
      if (results.length > 0) playlistItems.push(results[0]);
    }

    res.json({ items: playlistItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'AI Playlist generation failed' });
  }
});

module.exports = router;
