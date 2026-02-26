const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deviceName: { type: String, required: true },
  deviceType: { type: String, default: 'browser' },
  socketId: { type: String },
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', deviceSchema);
