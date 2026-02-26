require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const playlistRoutes = require('./routes/playlist');
const searchRoutes = require('./routes/search');
const aiRoutes = require('./routes/ai');
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static('uploads'));
// Routes
app.get('/ping', (req, res) => res.send('pong'));
app.use('/api/auth', authRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);

// Socket initialization
socketHandler(io);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27014/ynme';

mongoose.connect(MONGO_URI)
  .then(() => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Server running on http://127.0.0.1:${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
