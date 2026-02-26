import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const ListeningRoom = ({ roomId, userId, email, playlist }) => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isHost, setIsHost] = useState(false);
  const chatEndRef = useRef(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001', { auth: { token } });
    setSocket(s);

    s.emit('join_room', { roomId });
    
    s.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    s.on('sync_playback', (status) => {
      // Logic for extension to handle this will be in background.js
      console.log('Syncing playback:', status);
    });

    return () => s.disconnect();
  }, [roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('chat_message', { roomId, userId, message: chatInput, email });
    setChatInput('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[80vh]">
      <div className="lg:col-span-2 bg-gray-900 rounded-3xl p-8 border border-gray-800 shadow-2xl flex flex-col items-center justify-center text-center space-y-6">
        <div className="w-24 h-24 bg-gradient-to-tr from-purple-600 to-pink-500 rounded-full animate-pulse shadow-2xl shadow-purple-500/50 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-12 h-12 text-white fill-current"><path d="M8 5v14l11-7z"/></svg>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-white">Live Session Active</h2>
          <p className="text-gray-400 mt-2 italic">Invite others using the playlist code</p>
        </div>
        <div className="bg-gray-800/50 p-6 rounded-2xl border border-gray-700 w-full max-w-md">
            <p className="text-sm text-gray-500 uppercase tracking-widest font-bold mb-2">Currently Playing</p>
            <p className="text-xl text-blue-400 font-semibold">{playlist?.mediaItems[0]?.title || 'No media'}</p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-3xl border border-gray-800 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-bold text-lg">Room Chat</h3>
        </div>
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.userId === userId ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] text-gray-500 mb-1">{m.email}</span>
              <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${m.userId === userId ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'}`}>
                {m.message}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendChat} className="p-4 bg-gray-800/30">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Say something..."
            className="w-full bg-gray-800 text-white rounded-full px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </form>
      </div>
    </div>
  );
};

export default ListeningRoom;
