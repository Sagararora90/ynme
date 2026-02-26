const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  playlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Playlist', required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  currentMediaIndex: { type: Number, default: 0 },
  playbackTime: { type: Number, default: 0 },
  isPlaying: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', RoomSchema);
