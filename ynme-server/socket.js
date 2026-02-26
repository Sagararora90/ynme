const Device = require('./models/Device');
const { transcribeAudio } = require('./services/sttService');
const { analyzeMedia } = require('./services/aiService');
const Playlist = require('./models/Playlist');
const Room = require('./models/Room');
const { translateText } = require('./services/translationService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('[Socket] New connection attempt:', socket.id);

    socket.onAny((eventName, ...args) => {
      console.log(`[Socket Test] Event: ${eventName}`, args);
    });

    socket.on('error', (err) => {
      console.error('[Socket] Socket error:', err);
    });

    // Register device (Phase 2 legacy)
    socket.on('register_device', async ({ userId, deviceName, deviceType }) => {
      socket.join(`user_${userId}`);
      await Device.findOneAndUpdate(
        { userId, deviceName },
        { deviceType, socketId: socket.id, lastSeen: new Date() },
        { upsert: true, new: true }
      );
      console.log(`Device registered: ${deviceName} for user: ${userId}`);
      io.to(`user_${userId}`).emit('device_list_update');
    });

    // Collaborative Playlists
    socket.on('join_playlist', (playlistId) => {
      socket.join(`playlist_${playlistId}`);
      console.log(`Socket ${socket.id} joined playlist_${playlistId}`);
    });

    socket.on('add_to_playlist', async ({ userId, playlistId, media }) => {
      try {
        const playlist = await Playlist.findById(playlistId);
        if (playlist) {
          playlist.mediaItems.push({ ...media, addedBy: userId });
          await playlist.save();
          io.to(`playlist_${playlistId}`).emit('playlist_updated', playlist);
          // Also notify the user specifically
          socket.emit('playlist_item_added', { success: true, playlistName: playlist.name });
        }
      } catch (err) {
        socket.emit('playlist_item_added', { success: false, error: err.message });
      }
    });

    socket.on('add_media', async ({ playlistId, media, userId }) => {
      const playlist = await Playlist.findById(playlistId);
      if (playlist) {
        playlist.mediaItems.push({ ...media, addedBy: userId });
        await playlist.save();
        io.to(`playlist_${playlistId}`).emit('playlist_updated', playlist);
      }
    });

    // Group Listening Rooms
    socket.on('start_room', async ({ playlistId, userId }) => {
      const room = await Room.findOneAndUpdate(
        { playlistId },
        { host: userId, participants: [userId], isPlaying: false, playbackTime: 0 },
        { upsert: true, new: true }
      );
      socket.join(`room_${room._id}`);
      io.to(`playlist_${playlistId}`).emit('room_state', room);
    });

    socket.on('join_room', ({ roomId }) => {
      socket.join(`room_${roomId}`);
    });

    socket.on('playback_update', ({ roomId, status }) => {
      // status: { currentTime, paused, ... }
      socket.to(`room_${roomId}`).emit('sync_playback', status);
    });

    // Phase 4 Play Anywhere
    socket.on('play_media', ({ userId, deviceId, media }) => {
      if (deviceId) {
        io.to(deviceId).emit('execute_play', media);
      } else {
        io.to(`user_${userId}`).emit('execute_play', media);
      }
    });

    // Phase 4 AI Pipeline
    socket.on('request_stt', ({ userId, duration, mode }) => {
      console.log(`[Socket] request_stt received for user ${userId}, duration ${duration}, mode ${mode}`);
      // Forward to extension
      io.to(`user_${userId}`).emit('start_audio_capture', { duration: duration || 10000, mode });
    });

// Store accumulated chat transcripts in memory
const userChats = {};

    socket.on('stt_chunk', async ({ userId, audioData, mode }) => {
      console.log(`[Socket] Received audio chunk from user ${userId}. Processing... mode=${mode}`);
      if (mode !== 'chat') io.to(`user_${userId}`).emit('ai_processing_start');
      
      try {
        const base64Content = audioData.split(';base64,').pop();
        const buffer = Buffer.from(base64Content, 'base64');

        const transcript = await transcribeAudio(buffer);
        console.log(`[STT] Transcript: ${transcript}`);

        if (mode === 'chat') {
          // Accumulate for chat
          if (!userChats[userId]) userChats[userId] = [];
          if (transcript.trim().length > 5 && !transcript.toLowerCase().includes('subtitles by')) {
            userChats[userId].push({ text: transcript, time: new Date() });
            io.to(`user_${userId}`).emit('chat_transcript_update', { 
              text: transcript,
              history: userChats[userId]
            });
          }
        } else {
          // Standard Analysis (summary, notes, explain)
          const hindiText = await translateText(transcript, 'Hindi');
          const analysis = await analyzeMedia(transcript, mode || 'summary');
          const translatedAnalysis = await translateText(analysis, 'Hindi');
          
          io.to(`user_${userId}`).emit('ai_analysis_complete', { 
            analysis: translatedAnalysis,
            originalAnalysis: analysis,
            transcript: hindiText,
            originalTranscript: transcript
          });
          io.to(`user_${userId}`).emit('subtitle_update', { text: hindiText });
        }
      } catch (err) {
        console.error('[AI Pipeline Error]', err.message);
        io.to(`user_${userId}`).emit('ai_analysis_error', { message: err.message });
      }
    });

    socket.on('ask_ai', async ({ userId, question }) => {
      try {
        const history = userChats[userId] || [];
        const fullTranscript = history.map(h => h.text).join(' ');
        
        if (!fullTranscript) {
          io.to(`user_${userId}`).emit('ai_chat_response', { answer: "I haven't captured enough audio yet to answer questions about this video." });
          return;
        }

        const prompt = `You are a helpful AI assistant. The user is currently watching a video. Here is the transcript of what happened in the video so far:\n\n${fullTranscript}\n\nUser Question: ${question}\n\nAnswer the user's question concisely based ONLY on the transcript provided above.`;
        
        const answer = await analyzeMedia(fullTranscript, 'chat_custom', prompt);
        io.to(`user_${userId}`).emit('ai_chat_response', { answer });
      } catch (err) {
        io.to(`user_${userId}`).emit('ai_chat_response', { answer: "Sorry, I couldn't process your question right now." });
      }
    });

    // Chat
    socket.on('chat_message', ({ roomId, userId, message, email }) => {
      io.to(`room_${roomId}`).emit('new_message', { userId, message, email, timestamp: new Date() });
    });

    // Phase 2 legacy forwarding
    socket.on('media_command', ({ userId, command, value }) => {
      io.to(`user_${userId}`).emit('execute_command', { command, value });
    });

    socket.on('media_status', ({ userId, status }) => {
      io.to(`user_${userId}`).emit('update_status', status);
    });

    socket.on('disconnect', async (reason) => {
      await Device.findOneAndUpdate({ socketId: socket.id }, { socketId: null });
      console.log(`[Socket] Device disconnected: ${socket.id} | Reason: ${reason}`);
    });
  });
};
