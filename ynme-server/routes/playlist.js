const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const auth = require('../middleware/authMiddleware');
const Playlist = require('../models/Playlist');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${nanoid(8)}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });


// Create playlist
router.post('/', auth, async (req, res) => {
  try {
    const { name, isPublic } = req.body;
    const playlist = new Playlist({
      name,
      owner: req.user.id,
      isPublic,
      members: [{ userId: req.user.id, role: 'admin' }],
      inviteCode: nanoid(10)
    });
    await playlist.save();
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user playlists
router.get('/', auth, async (req, res) => {
  try {
    const playlists = await Playlist.find({
      $or: [
        { owner: req.user.id },
        { 'members.userId': req.user.id }
      ]
    }).populate('owner', 'email');
    res.json(playlists);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get playlist by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id).populate('members.userId', 'email');
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Join via invite code
router.post('/join/:inviteCode', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findOne({ inviteCode: req.params.inviteCode });
    if (!playlist) return res.status(404).json({ message: 'Invalid invite code' });

    const isMember = playlist.members.some(m => m.userId.toString() === req.user.id);
    if (!isMember) {
      playlist.members.push({ userId: req.user.id, role: 'editor' });
      await playlist.save();
    }
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove media from playlist
router.delete('/:id/media/:mediaId', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });
    
    // Check permissions
    const isOwner = playlist.owner.toString() === req.user.id;
    const isMember = playlist.members.some(m => m.userId.toString() === req.user.id && ['admin', 'editor'].includes(m.role));
    if (!isOwner && !isMember) return res.status(403).json({ message: 'Permission denied' });

    playlist.mediaItems.pull({ _id: req.params.mediaId });
    await playlist.save();
    res.json(playlist);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload local media
router.post('/:id/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    // Assuming we use standard HTTP server port 5001 for relative paths in dev, or proxy host in prod
    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    const newMedia = {
      title: req.file.originalname.replace(/\.[^/.]+$/, ""), // remove extension
      url: fileUrl,
      platform: 'local',
      type: req.file.mimetype.startsWith('video') ? 'video' : 'audio',
      addedBy: req.user.id
    };

    playlist.mediaItems.push(newMedia);
    await playlist.save();

    res.json(playlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Upload error' });
  }
});

module.exports = router;
