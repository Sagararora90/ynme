import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { ArrowLeft, Plus, Play, ExternalLink, Users, Music, Youtube, Search, Trash2, Upload } from 'lucide-react';

const PlaylistDetail = ({ playlistId, userId, onStartRoom, onBack, onPlay }) => {
  const [playlist, setPlaylist] = useState(null);
  const [socket, setSocket] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`, { auth: { token } });
    setSocket(s);
    s.emit('join_playlist', playlistId);
    s.on('playlist_updated', (data) => setPlaylist(data));
    fetchPlaylist();
    return () => s.disconnect();
  }, [playlistId]);

  const fetchPlaylist = async () => {
    const { data } = await axios.get(`${import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`}/api/playlists/${playlistId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPlaylist(data);
  };

  const addMedia = (e) => {
    e.preventDefault();
    if (!mediaUrl || !mediaTitle) return;
    socket.emit('add_media', {
      playlistId,
      media: { title: mediaTitle, url: mediaUrl, platform: mediaUrl.includes('youtube') ? 'youtube' : 'other' },
      userId
    });
    setMediaUrl(''); setMediaTitle(''); setShowAdd(false);
  };

  const searchAndAdd = async (e) => {
    e.preventDefault();
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`}/api/search?q=${encodeURIComponent(searchQ.trim())}&mode=smart`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {}
    setSearching(false);
  };

  const deleteTrack = async (e, mediaId) => {
    e.stopPropagation();
    try {
      const { data } = await axios.delete(`${import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`}/api/playlists/${playlistId}/media/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaylist(data);
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`}/api/playlists/${playlistId}/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setPlaylist(data);
      setShowAdd(false);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const addFromSearch = (item) => {
    if (socket) {
      socket.emit('add_media', {
        playlistId,
        media: { title: item.title, url: item.playUrl || `https://youtube.com/watch?v=${item.id}`, platform: item.platform },
        userId
      });
    }
    setSearchResults(prev => prev.filter(x => x.id !== item.id));
  };

  const playTrack = (item, index) => {
    if (onPlay) {
      let id = null;
      if (item.url?.includes('youtube.com/watch')) {
        const u = new URL(item.url);
        id = u.searchParams.get('v');
      } else if (item.url?.includes('youtu.be/')) {
        id = item.url.split('youtu.be/')[1]?.split('?')[0];
      } else if (item.url?.includes('spotify.com/track/')) {
        id = item.url.split('track/')[1]?.split('?')[0];
      }
      onPlay({
        title: item.title,
        id: id,
        platform: item.platform || (item.url?.includes('youtube') ? 'youtube' : item.url?.includes('spotify') ? 'spotify' : 'other'),
        type: item.url?.includes('youtube') ? 'video' : 'audio',
        playUrl: item.url,
        thumbnail: null
      }, { list: playlist.mediaItems, startIndex: index });
    }
  };

  if (!playlist) return (
    <div className="flex justify-center py-20">
      <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl bg-[#111] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all">
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
            <h2 className="text-lg font-semibold text-white/90">{playlist.name}</h2>
            <p className="text-[11px] text-white/20 mt-0.5">{playlist.mediaItems?.length || 0} tracks • #{playlist.inviteCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setShowSearch(!showSearch); setShowAdd(false); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                showSearch ? 'bg-white/[0.08] text-white/60' : 'bg-white/[0.04] text-white/25 hover:text-white/50'
              }`}
            ><Search size={12} /> Search</button>
            <button onClick={() => { setShowAdd(!showAdd); setShowSearch(false); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                showAdd ? 'bg-white/[0.08] text-white/60' : 'bg-white/[0.04] text-white/25 hover:text-white/50'
              }`}
            ><Plus size={12} /> URL</button>
            <button onClick={() => onStartRoom(playlist._id)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.06] text-white/40 hover:text-white/80 transition-all"
            ><Users size={12} /> Group</button>
          </div>
        </div>

        {/* URL / File Add Form */}
        {showAdd && (
          <div className="pt-3 border-t border-white/[0.04] space-y-3">
            <form onSubmit={addMedia} className="flex gap-2">
              <input type="text" value={mediaTitle} onChange={(e) => setMediaTitle(e.target.value)} placeholder="Title"
                className="flex-1 bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 text-[11px] text-white/70 placeholder-white/15 outline-none focus:border-white/15 transition-all" />
              <input type="text" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="URL"
                className="flex-1 bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 text-[11px] text-white/70 placeholder-white/15 outline-none focus:border-white/15 transition-all font-mono" />
              <button type="submit" className="px-3 bg-white/[0.06] hover:bg-white/[0.1] text-white/50 rounded-lg text-[10px] font-medium transition-all">Add</button>
            </form>
            
            <div className="flex items-center gap-3">
              <div className="h-px bg-white/[0.04] flex-1" />
              <span className="text-[9px] font-semibold text-white/20 uppercase tracking-widest">OR</span>
              <div className="h-px bg-white/[0.04] flex-1" />
            </div>

            <div>
              <input type="file" id="local-upload" onChange={uploadFile} accept="audio/*,video/*" className="hidden" />
              <label htmlFor="local-upload" className="flex items-center justify-center gap-2 w-full py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] border-dashed rounded-lg cursor-pointer transition-all">
                {uploading ? (
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  <Upload size={12} className="text-white/40" />
                )}
                <span className="text-[11px] font-medium text-white/50">{uploading ? 'Uploading...' : 'Upload Local File'}</span>
              </label>
            </div>
          </div>
        )}

        {/* Search & Add */}
        {showSearch && (
          <div className="pt-3 border-t border-white/[0.04] space-y-2">
            <form onSubmit={searchAndAdd} className="flex gap-2">
              <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search to add..."
                className="flex-1 bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-2 text-[11px] text-white/70 placeholder-white/15 outline-none focus:border-white/15 transition-all" />
              <button type="submit" className="px-3 bg-white/[0.06] hover:bg-white/[0.1] text-white/50 rounded-lg text-[10px] font-medium transition-all">
                {searching ? '...' : 'Find'}
              </button>
            </form>
            {searchResults.length > 0 && (
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {searchResults.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03] transition-all">
                    <div className="w-8 h-8 rounded bg-white/[0.03] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" /> :
                        item.platform === 'youtube' ? <Youtube size={10} className="text-white/10" /> : <Music size={10} className="text-white/10" />}
                    </div>
                    <p className="flex-1 text-[10px] text-white/50 truncate">{item.title}</p>
                    <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${
                      item.type === 'video' ? 'bg-red-500/10 text-red-400/50' : 'bg-green-500/10 text-green-400/50'
                    }`}>{item.type === 'video' ? 'VID' : 'AUD'}</span>
                    <button onClick={() => addFromSearch(item)}
                      className="p-1 text-emerald-400/50 hover:text-emerald-400 hover:bg-white/[0.04] rounded transition-all"
                    ><Plus size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Track List */}
      {playlist.mediaItems?.length === 0 ? (
        <div className="py-12 text-center rounded-xl bg-[#111] border border-white/[0.06]">
          <Music size={24} className="mx-auto text-white/[0.06] mb-2" />
          <p className="text-[12px] text-white/20">No tracks yet — add one above</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {playlist.mediaItems.map((item, i) => (
            <div key={i} onClick={() => playTrack(item)}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-all cursor-pointer"
            >
              {/* Number / Play */}
              <span className="w-5 text-right text-[11px] text-white/15 font-mono flex-shrink-0 group-hover:hidden">{i + 1}</span>
              <Play size={12} fill="currentColor" className="text-white/50 flex-shrink-0 hidden group-hover:block w-5" />

              {/* Icon */}
              <div className="w-9 h-9 rounded bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                {item.url?.includes('youtube') || item.platform === 'youtube'
                  ? <Youtube size={14} className="text-white/12" />
                  : <Music size={14} className="text-white/12" />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-white/60 group-hover:text-white/80 truncate transition-all">{item.title}</p>
                <p className="text-[10px] text-white/15 truncate">{item.platform === 'youtube' ? 'YouTube' : item.platform || 'Link'}</p>
              </div>

              {/* Open link */}
              <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                className="p-1.5 text-white/10 hover:text-white/40 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              ><ExternalLink size={13} /></a>

              {/* Delete Button */}
              <button onClick={(e) => deleteTrack(e, item._id)}
                className="p-1.5 text-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                title="Remove from playlist"
              ><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PlaylistDetail;
