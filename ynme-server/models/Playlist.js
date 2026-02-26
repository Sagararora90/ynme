const mongoose = require('mongoose');

const MediaItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true },
  platform: { type: String, enum: ['youtube', 'spotify', 'other'], default: 'other' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  order: { type: Number, default: 0 }
});

const PlaylistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: { type: String, enum: ['admin', 'editor', 'viewer'], default: 'editor' }
    }
  ],
  mediaItems: [MediaItemSchema],
  isPublic: { type: Boolean, default: false },
  inviteCode: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Playlist', PlaylistSchema);
