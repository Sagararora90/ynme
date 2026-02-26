import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Users, ArrowRight, Hash, List, Copy, Check, Sparkles, Music } from 'lucide-react';

const PlaylistList = ({ onSelect }) => {
  const [playlists, setPlaylists] = useState([]);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => { fetchPlaylists(); }, []);

  const fetchPlaylists = async () => {
    try {
      const { data } = await axios.get((import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001') + '/api/playlists', { headers: { Authorization: `Bearer ${token}` } });
      setPlaylists(data);
    } catch (e) { console.error(e); }
  };

  const generateAiPlaylist = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await axios.post((import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001') + '/api/ai/generate', { prompt: name }, { headers: { Authorization: `Bearer ${token}` } });
      const res = await axios.post((import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001') + '/api/playlists', { name: `AI: ${name}`, mediaItems: data.items }, { headers: { Authorization: `Bearer ${token}` } });
      setPlaylists([...playlists, res.data]);
      setName(''); setShowCreate(false);
    } catch (e) { console.error(e); alert('AI generation failed'); }
    finally { setLoading(false); }
  };

  const createPlaylist = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await axios.post((import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001') + '/api/playlists', { name, isPublic: false }, { headers: { Authorization: `Bearer ${token}` } });
      setName(''); setShowCreate(false); fetchPlaylists();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const joinPlaylist = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001'}/api/playlists/join/${joinCode}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setJoinCode(''); setShowJoin(false); fetchPlaylists();
    } catch (e) { alert('Invalid invite code'); }
    finally { setLoading(false); }
  };

  const copy = (e, code) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-medium transition-all ${
            showCreate ? 'bg-white/10 text-white/80' : 'bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.07]'
          }`}
        ><Plus size={14} /> New Playlist</button>
        <button onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-medium transition-all ${
            showJoin ? 'bg-white/10 text-white/80' : 'bg-white/[0.04] text-white/30 hover:text-white/60 hover:bg-white/[0.07]'
          }`}
        ><Users size={14} /> Join Shared</button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="rounded-xl bg-[#111] border border-white/[0.06] p-4">
          <form onSubmit={createPlaylist} className="flex gap-2">
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name..."
              className="flex-1 bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 text-[12px] text-white/70 placeholder-white/15 outline-none focus:border-white/15 transition-all"
              autoFocus
            />
            <button disabled={loading || !name.trim()} type="submit"
              className="px-4 bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white/80 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30"
            >Create</button>
            <button type="button" onClick={generateAiPlaylist} disabled={loading || !name.trim()}
              className="px-3 bg-white/[0.03] hover:bg-white/[0.06] text-white/20 hover:text-white/50 border border-white/[0.05] rounded-lg transition-all disabled:opacity-20" title="AI Generate"
            ><Sparkles size={14} /></button>
          </form>
        </div>
      )}

      {/* Join Form */}
      {showJoin && (
        <div className="rounded-xl bg-[#111] border border-white/[0.06] p-4">
          <form onSubmit={joinPlaylist} className="flex gap-2">
            <div className="relative flex-1">
              <Hash size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15" />
              <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="INVITE-CODE"
                className="w-full bg-white/[0.03] border border-white/[0.05] rounded-lg pl-8 pr-3 py-2 text-[12px] text-white/70 placeholder-white/15 outline-none focus:border-white/15 transition-all font-mono"
                autoFocus
              />
            </div>
            <button disabled={loading || !joinCode.trim()} type="submit"
              className="px-4 bg-white/[0.06] hover:bg-white/[0.1] text-white/50 hover:text-white/80 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30"
            >Join</button>
          </form>
        </div>
      )}

      {/* Playlist List */}
      {playlists.length === 0 ? (
        <div className="py-16 text-center">
          <Music size={28} className="mx-auto text-white/[0.06] mb-3" />
          <p className="text-[13px] text-white/25 font-medium">Your library is empty</p>
          <p className="text-[11px] text-white/12 mt-1">Create a playlist or join with an invite code</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {playlists.map(p => (
            <div key={p._id} onClick={() => onSelect(p._id)}
              className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-all"
            >
              {/* Art */}
              <div className="w-11 h-11 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 group-hover:bg-white/[0.06] transition-all">
                <List size={16} className="text-white/12 group-hover:text-white/25 transition-all" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white/60 group-hover:text-white/85 transition-all truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-white/15">{p.mediaItems?.length || 0} tracks</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/10 font-mono">#{p.inviteCode}</span>
                    <button onClick={(e) => copy(e, p.inviteCode)} className="p-0.5 text-white/10 hover:text-white/30 transition-all">
                      {copiedCode === p.inviteCode ? <Check size={9} className="text-emerald-500" /> : <Copy size={9} />}
                    </button>
                  </div>
                </div>
              </div>

              <ArrowRight size={13} className="text-white/0 group-hover:text-white/20 transition-all flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistList;
