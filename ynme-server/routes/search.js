const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { searchMedia } = require('../services/searchService');

router.get('/', auth, async (req, res) => {
  try {
    const { q, mode } = req.query;
    if (!q) return res.status(400).json({ message: 'Query required' });
    const results = await searchMedia(q, mode);
    res.json(results);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ message: 'Search failed' });
  }
});

router.get('/related', auth, async (req, res) => {
  try {
    const { title, id, platform } = req.query;
    if (!title) return res.status(400).json({ message: 'Seed title required' });
    
    const { getRelatedMedia } = require('../services/searchService');
    const results = await getRelatedMedia(title, id, platform);
    res.json(results);
  } catch (err) {
    console.error('Related search error:', err.message);
    res.status(500).json({ message: 'Related search failed' });
  }
});

module.exports = router;
