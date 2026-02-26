import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Youtube, Music, Play, Send, Sparkles, ExternalLink, Radio, Plus, Clock, X } from 'lucide-react';

const HISTORY_KEY = 'ynme_search_history';
const getHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } };
const saveToHistory = (item) => {
  const h = getHistory().filter(x => x.id !== item.id);
  h.unshift(item);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20)));
};

const SearchInterface = ({ socket, userId, onPlay, onAddToPlaylist }) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('smart');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState(getHistory());
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setError('');
    }
  }, [query]);

  useEffect(() => {
    if (history.length > 0) {
      setLoadingRecs(true);
      const last = history[0];
      axios.get(`http://127.0.0.1:5001/api/search/related?title=${encodeURIComponent(last.title)}&id=${last.id || ''}&platform=${last.platform || ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(({ data }) => setRecommendations(Array.isArray(data) ? data : []))
      .catch(err => console.error(err))
      .finally(() => setLoadingRecs(false));
    } else {
      setRecommendations([]);
    }
  }, [history[0]?.id, history[0]?.title, token]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const { data } = await axios.get(
        `http://127.0.0.1:5001/api/search?q=${encodeURIComponent(query.trim())}&mode=${mode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResults(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0) setError('No results found');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Search failed';
      setError(`Search error: ${msg}`);
    }
    finally { setLoading(false); }
  };

  const playLocal = (media, index, isHistory) => {
    saveToHistory(media);
    setHistory(getHistory());
    if (onPlay) {
      const list = isHistory ? getHistory() : results;
      onPlay(media, { list, startIndex: index });
    }
  };

  const playOnDevice = (e, media) => {
    e.stopPropagation();
    saveToHistory(media);
    setHistory(getHistory());
    if (socket) {
      socket.emit('play_media', { userId, media });
    }
  };

  const fetchPlaylists = async () => {
    try {
      const { data } = await axios.get('http://127.0.0.1:5001/api/playlists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaylists(data);
    } catch {}
  };

  const addToPlaylist = async (playlistId, media) => {
    if (socket) {
      socket.emit('add_media', {
        playlistId,
        media: { title: media.title, url: media.playUrl || `https://youtube.com/watch?v=${media.id}`, platform: media.platform },
        userId
      });
    }
    setShowPlaylistPicker(null);
  };

  const openPlaylistPicker = (e, itemId) => {
    e.stopPropagation();
    setShowPlaylistPicker(showPlaylistPicker === itemId ? null : itemId);
    if (showPlaylistPicker !== itemId) fetchPlaylists();
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const showHistory = !query && !loading && results.length === 0 && !error;

  const renderItem = (item, i, isHistory = false, isRec = false) => {
    const key = isRec ? `rec-${i}` : isHistory ? `h-${i}` : `r-${i}`;
    return (
    <div key={key} onClick={() => playLocal(item, i, isHistory)}
      className="group flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-all cursor-pointer relative"
    >
      {/* Thumbnail */}
      <div className="w-11 h-11 md:w-12 md:h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.03] relative">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {item.platform === 'youtube' ? <Youtube size={14} className="text-white/10" /> : <Music size={14} className="text-white/10" />}
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
          <Play size={14} fill="white" className="text-white" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-white/60 truncate group-hover:text-white/80 transition-all">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.platform === 'youtube'
            ? <Youtube size={9} className="text-red-500/50 flex-shrink-0" />
            : <Music size={9} className="text-green-500/50 flex-shrink-0" />
          }
          <span className="text-[9px] text-white/20">{item.platform === 'youtube' ? 'YouTube' : 'Spotify'}</span>
          <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${
            item.type === 'video' ? 'bg-red-500/10 text-red-400/50' : 'bg-green-500/10 text-green-400/50'
          }`}>{item.type === 'video' ? 'VIDEO' : 'AUDIO'}</span>
          {item.duration && <span className="text-[9px] text-white/12 font-mono">{item.duration}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
        <button onClick={(e) => openPlaylistPicker(e, key)}
          className="p-1.5 rounded-lg text-white/25 hover:text-emerald-400/70 hover:bg-white/[0.04] transition-all" title="Add to playlist"
        ><Plus size={13} /></button>
        <button onClick={(e) => playOnDevice(e, item)}
          className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.04] transition-all" title="Send to device"
        ><Send size={13} /></button>
        {item.platform === 'youtube' && (
          <a href={`https://youtube.com/watch?v=${item.id}`} target="_blank" rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.04] transition-all" title="Open on YouTube"
          ><ExternalLink size={13} /></a>
        )}
      </div>

      {/* Playlist picker dropdown */}
      {showPlaylistPicker === key && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-[#151515] border border-white/[0.06] rounded-lg p-1.5 shadow-2xl z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[8px] font-semibold text-white/15 uppercase tracking-[0.15em] px-2 py-1">Add to playlist</p>
          {playlists.length > 0 ? playlists.map(p => (
            <button key={p._id} onClick={() => addToPlaylist(p._id, item)}
              className="w-full text-left px-2.5 py-1.5 text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] rounded transition-all"
            >{p.name}</button>
          )) : <p className="text-[10px] text-white/15 px-2.5 py-1.5">No playlists</p>}
        </div>
      )}
    </div>
  )};

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <form onChange={handleSearch} className="relative max-w-xl mx-auto">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) {
              setResults([]);
              setError('');
            }
          }}
          placeholder="Search songs, videos, artists..."
          className="w-full bg-[#111] border border-white/[0.06] rounded-xl pl-10 pr-20 py-2.5 text-[13px] font-medium text-white/80 placeholder-white/15 outline-none focus:border-white/15 transition-all"
        />
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/[0.07] hover:bg-white/[0.12] text-white/50 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all">
          Search
        </button>
      </form>

      {/* Mode Tabs */}
      <div className="flex justify-center gap-1">
        {[
          { id: 'smart', label: 'All', icon: <Sparkles size={12} /> },
          { id: 'video', label: 'YouTube', icon: <Youtube size={12} /> },
          { id: 'audio', label: 'Spotify', icon: <Music size={12} /> },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
              mode === m.id ? 'bg-white/[0.07] text-white/70' : 'text-white/20 hover:text-white/40 hover:bg-white/[0.03]'
            }`}
          >{m.icon} {m.label}</button>
        ))}
      </div>

      {/* Recent History */}
      {showHistory && history.length > 0 && (
        <div className="space-y-6">
          {/* Recommendations Block */}
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-white/[0.04] pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-purple-400" />
                <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Recommended For You</span>
              </div>
            </div>
            
            {loadingRecs ? (
              <div className="flex justify-center py-6">
                <div className="w-4 h-4 border-2 border-white/10 border-t-purple-400/50 rounded-full animate-spin" />
              </div>
            ) : recommendations.length > 0 ? (
              <div className="space-y-0.5">
                {recommendations.slice(0, 5).map((item, i) => renderItem(item, i, false, true))}
              </div>
            ) : (
              <p className="text-[10px] text-white/20 px-2">Play some music to get recommendations!</p>
            )}
          </div>

          {/* History Block */}
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-white/[0.04] pb-2">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-white/20" />
                <span className="text-[11px] font-semibold text-white/30 uppercase tracking-wider">Recently Played</span>
              </div>
              <button onClick={clearHistory} className="text-[10px] font-medium text-white/20 hover:text-white/50 transition-all">Clear all</button>
            </div>
            <div className="space-y-0.5">
              {history.map((item, i) => renderItem(item, i, true))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-14">
          <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-0.5">
          {results.map((item, i) => renderItem(item, i, false))}
        </div>
      ) : error ? (
        <div className="py-10 text-center">
          <Radio size={20} className="mx-auto text-red-500/20 mb-2" />
          <p className="text-[11px] text-white/25">{error}</p>
        </div>
      ) : null}
    </div>
  );
};

export default SearchInterface;
