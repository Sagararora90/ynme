import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { 
  Play, Pause, SkipForward, SkipBack, 
  Volume2, Smartphone, Monitor,
  List, Search, Heart, Home, LogOut, Youtube,
  ChevronDown, Music, Wifi, Radio
} from 'lucide-react';
import PlaylistList from './PlaylistList';
import PlaylistDetail from './PlaylistDetail';
import ListeningRoom from './ListeningRoom';
import SearchInterface from './SearchInterface';
import AnalysisPanel from './AnalysisPanel';
import MediaBridge from './MediaBridge';

// Load YouTube IFrame API once
if (!window.YT) {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

const Dashboard = () => {
  const [user] = useState(JSON.parse(localStorage.getItem('user')));
  const [token] = useState(localStorage.getItem('token'));
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [socket, setSocket] = useState(null);
  const [view, setView] = useState('devices');
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [mobilePlayer, setMobilePlayer] = useState(false);
  const [localPlay, setLocalPlay] = useState(null);
  
  // Auto-play Queue State
  const [playQueue, setPlayQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const ytPlayerRef = useRef(null);

  // Drag state for mini-player
  const miniRef = useRef(null);
  const dragState = useRef({ dragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const [miniPos, setMiniPos] = useState({ x: null, y: null });

  const onDragStart = useCallback((clientX, clientY) => {
    if (!miniRef.current) return;
    const rect = miniRef.current.getBoundingClientRect();
    dragState.current = { dragging: true, startX: clientX - rect.left, startY: clientY - rect.top, offsetX: 0, offsetY: 0 };
  }, []);

  const onDragMove = useCallback((clientX, clientY) => {
    if (!dragState.current.dragging) return;
    const x = clientX - dragState.current.startX;
    const y = clientY - dragState.current.startY;
    setMiniPos({ x, y });
  }, []);

  const onDragEnd = useCallback(() => { dragState.current.dragging = false; }, []);

  useEffect(() => {
    const mm = (e) => onDragMove(e.clientX, e.clientY);
    const tm = (e) => { if (e.touches[0]) onDragMove(e.touches[0].clientX, e.touches[0].clientY); };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', onDragEnd);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', onDragEnd); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', onDragEnd); };
  }, [onDragMove, onDragEnd]);

  const handlePlay = useCallback((media, context = null) => {
    setLocalPlay(media);
    setMobilePlayer(true);
    if (context && context.list) {
      setPlayQueue(context.list);
      setQueueIndex(context.startIndex ?? 0);
    } else {
      setPlayQueue([]);
      setQueueIndex(-1);
    }
  }, []);

  const playNext = useCallback(() => {
    if (queueIndex >= 0 && queueIndex + 1 < playQueue.length) {
      const nextIndex = queueIndex + 1;
      const item = playQueue[nextIndex];
      let id = null;
      if (item.url?.includes('youtube.com/watch')) {
        const u = new URL(item.url);
        id = u.searchParams.get('v');
      } else if (item.url?.includes('youtu.be/')) {
        id = item.url.split('youtu.be/')[1]?.split('?')[0];
      } else if (item.url?.includes('spotify.com/track/')) {
        id = item.url.split('track/')[1]?.split('?')[0];
      } else if (!item.url && item.id) { // from search results
        id = item.id;
      }
      
      const media = {
        title: item.title,
        id: id,
        platform: item.platform || (item.url?.includes('youtube') ? 'youtube' : item.url?.includes('spotify') ? 'spotify' : 'youtube'),
        type: item.type || (item.url?.includes('youtube') ? 'video' : 'audio'),
        playUrl: item.url || item.playUrl,
        thumbnail: item.thumbnail || null
      };

      setQueueIndex(nextIndex);
      setLocalPlay(media);
    } else if (localPlay) {
      // Infinity Play: Queue ended, fetch related tracks
      axios.get(`${import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`}/api/search/related?title=${encodeURIComponent(localPlay.title)}&id=${localPlay.id || ''}&platform=${localPlay.platform || ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(({ data }) => {
        if (data && data.length > 0) {
          const newQueue = [...playQueue, ...data];
          setPlayQueue(newQueue);
          
          const nextIndex = playQueue.length; // The index of the first new track
          const item = data[0];
          
          let id = item.id;
          if (item.playUrl?.includes('youtube.com/watch')) id = new URL(item.playUrl).searchParams.get('v');
          else if (item.playUrl?.includes('youtu.be/')) id = item.playUrl.split('youtu.be/')[1]?.split('?')[0];

          const media = {
            title: item.title,
            id: id,
            platform: item.platform || 'spotify',
            type: item.type || 'audio',
            playUrl: item.playUrl,
            thumbnail: item.thumbnail || null
          };

          setQueueIndex(nextIndex);
          setLocalPlay(media);
        }
      }).catch(err => console.error('Infinity Play Error:', err));
    }
  }, [playQueue, queueIndex, localPlay, token]);

  const playPrev = useCallback(() => {
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1;
      const item = playQueue[prevIndex];
      let id = null;
      if (item.url?.includes('youtube.com/watch')) {
        const u = new URL(item.url);
        id = u.searchParams.get('v');
      } else if (item.url?.includes('youtu.be/')) {
        id = item.url.split('youtu.be/')[1]?.split('?')[0];
      } else if (item.url?.includes('spotify.com/track/')) {
        id = item.url.split('track/')[1]?.split('?')[0];
      } else if (!item.url && item.id) {
        id = item.id;
      }
      
      const media = {
        title: item.title,
        id: id,
        platform: item.platform || (item.url?.includes('youtube') ? 'youtube' : item.url?.includes('spotify') ? 'spotify' : 'youtube'),
        type: item.type || (item.url?.includes('youtube') ? 'video' : 'audio'),
        playUrl: item.url || item.playUrl,
        thumbnail: item.thumbnail || null
      };

      setQueueIndex(prevIndex);
      setLocalPlay(media);
    }
  }, [playQueue, queueIndex]);

  useEffect(() => {
    if (localPlay?.type === 'video' && localPlay?.platform === 'youtube' && localPlay?.id) {
      const init = () => {
        if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); } catch (e) {} }
        ytPlayerRef.current = new window.YT.Player('dashboard-yt-player', {
          videoId: localPlay.id,
          playerVars: { autoplay: 1, origin: window.location.origin },
          events: {
            onStateChange: (e) => {
              if (e.data === window.YT.PlayerState.ENDED) playNext();
            }
          }
        });
      };
      if (window.YT?.Player) init();
      else window.onYouTubeIframeAPIReady = init;
    } else {
      if (ytPlayerRef.current) { try { ytPlayerRef.current.destroy(); ytPlayerRef.current = null; } catch (e) {} }
    }
  }, [localPlay, playNext]);

  // Merge: local search play takes priority for display, deviceStatus for remote control
  const nowPlaying = localPlay || (deviceStatus ? {
    title: deviceStatus.title,
    platform: deviceStatus.url?.includes('youtube') ? 'youtube' : deviceStatus.url?.includes('spotify') ? 'spotify' : 'browser',
    type: deviceStatus.url?.includes('youtube') ? 'video' : 'audio',
    id: null,
    isDevice: true
  } : null);

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`, { auth: { token } });
    setSocket(s);
    s.on('connect', () => {
      s.emit('register_device', { userId: user.id, device: 'web-dashboard' });
      fetchPlaylists();
    });
    s.on('update_status', (st) => setDeviceStatus(st));
    s.on('playlist_item_added', (res) => {
      if (res.success) alert(`✓ Added to ${res.playlistName}`);
      else alert('Failed: ' + res.error);
    });
    return () => s.disconnect();
  }, [token]);

  const fetchPlaylists = async () => {
    try {
      const { data } = await axios.get((import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`) + '/api/playlists', { headers: { Authorization: `Bearer ${token}` } });
      setPlaylists(data);
    } catch (e) { if (e.code !== 'ERR_CANCELED' && e.message !== 'Request aborted') console.error(e); }
  };

  const cmd = (c, v = null) => socket?.emit('media_command', { userId: user.id, command: c, value: v });

  const addToPlaylist = (pid) => {
    if (!deviceStatus) return;
    socket.emit('add_to_playlist', {
      userId: user.id, playlistId: pid,
      media: { title: deviceStatus.title, url: deviceStatus.url, platform: deviceStatus.url?.includes('spotify') ? 'spotify' : 'youtube', duration: deviceStatus.duration }
    });
    setShowPlaylistPicker(false);
  };

  const startListeningSession = (pid) => {
    socket.emit('start_room', { playlistId: pid, userId: user.id });
    socket.once('room_state', (room) => { setActiveRoomId(room._id); setView('room'); });
  };

  const fmt = (s) => s ? `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}` : '0:00';
  const pct = deviceStatus?.duration ? (deviceStatus.currentTime / deviceStatus.duration) * 100 : 0;

  const tabs = [
    { id: 'devices', icon: <Home size={18} />, label: 'Home' },
    { id: 'search', icon: <Search size={18} />, label: 'Search' },
    { id: 'playlists', icon: <List size={18} />, label: 'Library' },
  ];

  const renderView = () => {
    switch (view) {
      case 'playlists': return <PlaylistList onSelect={(id) => { setSelectedPlaylistId(id); setView('playlist-detail'); }} />;
      case 'playlist-detail': return <PlaylistDetail playlistId={selectedPlaylistId} userId={user.id} onStartRoom={startListeningSession} onBack={() => setView('playlists')} onPlay={handlePlay} />;
      case 'room': return <ListeningRoom roomId={activeRoomId} userId={user.id} email={user.email} />;
      case 'search': return <SearchInterface socket={socket} userId={user.id} onPlay={handlePlay} />;
      default: return renderHome();
    }
  };

  const renderHome = () => (
    <div className="space-y-5">
      {/* Status Card */}
      <div className="rounded-xl bg-[#111] border border-white/[0.06] overflow-hidden">
        {deviceStatus ? (
          <div className="p-5 md:p-6">
            {/* Status */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em]">Connected</span>
              <span className="text-[10px] text-white/15 font-medium ml-auto">{deviceStatus.url?.includes('youtube') ? 'YouTube' : 'Browser'}</span>
            </div>

            {/* Title */}
            <h2 className="text-lg md:text-xl font-semibold text-white/90 leading-snug mb-5">{deviceStatus.title || 'Untitled'}</h2>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-white/50 rounded-full transition-all duration-700 ease-linear" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-white/20 font-mono tracking-wide">
                <span>{fmt(deviceStatus.currentTime)}</span>
                <span>{fmt(deviceStatus.duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              {/* Speed */}
              <div className="flex items-center gap-0.5">
                {[1, 1.5, 2].map(s => (
                  <button key={s} onClick={() => cmd('SET_SPEED', s)}
                    className="text-[10px] font-medium text-white/20 hover:text-white/60 px-2 py-1 rounded transition-all hover:bg-white/[0.03]"
                  >{s}x</button>
                ))}
              </div>

              {/* Playback */}
              <div className="flex items-center gap-2">
                <button onClick={() => cmd('SEEK_BACKWARD')} className="p-1.5 text-white/30 hover:text-white/70 transition-all"><SkipBack size={18} /></button>
                <button onClick={() => cmd(deviceStatus.paused ? 'PLAY' : 'PAUSE')}
                  className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-[#111] hover:scale-105 active:scale-95 transition-all"
                >
                  {deviceStatus.paused ? <Play size={14} fill="currentColor" className="ml-0.5" /> : <Pause size={14} fill="currentColor" />}
                </button>
                <button onClick={() => cmd('SEEK_FORWARD')} className="p-1.5 text-white/30 hover:text-white/70 transition-all"><SkipForward size={18} /></button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-1.5">
                <Volume2 size={13} className="text-white/15" />
                <input type="range" min="0" max="1" step="0.05" value={deviceStatus.volume || 0.5}
                  onChange={(e) => cmd('SET_VOLUME', parseFloat(e.target.value))}
                  className="w-16 accent-white h-[2px] cursor-pointer opacity-30 hover:opacity-80 transition-opacity"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Monitor size={28} className="mx-auto text-white/[0.06] mb-3" />
            <p className="text-[13px] font-medium text-white/30">No device connected</p>
            <p className="text-[11px] text-white/15 mt-1">Open YouTube or Spotify with the ynme extension</p>
          </div>
        )}
      </div>

      {/* Grid: Bridge + AI */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3"><MediaBridge deviceStatus={deviceStatus} socket={socket} /></div>
        <div className="lg:col-span-2"><AnalysisPanel deviceStatus={deviceStatus} socket={socket} userId={user.id} /></div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#080808] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      
      {/* ── TOP BAR ── */}
      <header className="h-12 flex items-center justify-between px-4 md:px-5 border-b border-white/[0.04] flex-shrink-0 z-20 bg-[#080808]">
        <div className="flex items-center gap-5">
          <span className="text-[13px] font-bold tracking-tight text-white/80">ynme<span className="text-blue-500">.</span></span>
          <nav className="hidden md:flex items-center">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setView(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-[12px] font-medium rounded-md transition-all mr-0.5 ${
                  (view === t.id || (t.id === 'playlists' && view === 'playlist-detail'))
                    ? 'bg-white/[0.07] text-white/80' : 'text-white/25 hover:text-white/50 hover:bg-white/[0.03]'
                }`}
              >{t.icon} {t.label}</button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-semibold text-white/40">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <button onClick={() => { localStorage.removeItem('token'); window.location.reload(); }}
            className="p-1.5 text-white/15 hover:text-white/40 transition-all"><LogOut size={14} /></button>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 pb-32 md:pb-6">
          {renderView()}
        </div>
      </main>

      {/* ── PERSISTENT PLAYER (always mounted when localPlay is set) ── */}
      {localPlay && (
        <div ref={miniRef} className={`fixed z-50 transition-all ${mobilePlayer ? 'duration-300' : 'duration-0'} ${
          mobilePlayer
            ? 'inset-0 bg-[#080808]'
            : 'w-[280px] md:w-[320px] rounded-xl overflow-hidden shadow-2xl border border-white/[0.06] bg-[#111]'
        }`} style={!mobilePlayer && miniPos.x !== null ? { left: miniPos.x, top: miniPos.y, bottom: 'auto', right: 'auto' } : !mobilePlayer ? { bottom: 80, right: 12 } : undefined}>
          {/* Full-screen overlay */}
          {mobilePlayer && (
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent h-[40%] pointer-events-none" />
          )}

          <div className={`relative flex flex-col h-full ${mobilePlayer ? 'px-7 pt-6 pb-6' : ''}`}>
            {/* Header / Close */}
            {mobilePlayer ? (
              <button onClick={() => setMobilePlayer(false)} className="self-center mb-4 z-10">
                <ChevronDown size={24} className="text-white/20" />
              </button>
            ) : (
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/[0.04] cursor-grab active:cursor-grabbing select-none"
                onMouseDown={(e) => onDragStart(e.clientX, e.clientY)}
                onTouchStart={(e) => { if (e.touches[0]) onDragStart(e.touches[0].clientX, e.touches[0].clientY); }}
              >
                <p className="text-[10px] text-white/30 truncate flex-1">{localPlay.title?.substring(0, 30)}</p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setMobilePlayer(true); setMiniPos({ x: null, y: null }); }} className="p-1 text-white/15 hover:text-white/40 transition-all text-[10px]">↗</button>
                  <button onClick={() => setLocalPlay(null)} className="p-1 text-white/15 hover:text-white/40 transition-all text-[10px]">✕</button>
                </div>
              </div>
            )}

            {/* Video / Audio Embed */}
            <div className={`${mobilePlayer ? 'flex-1 flex items-center justify-center' : ''}`}>
              {localPlay.type === 'video' && localPlay.platform === 'youtube' ? (
                <div className={`${mobilePlayer ? 'w-full max-w-lg aspect-video' : 'aspect-video'} bg-black overflow-hidden ${mobilePlayer ? 'rounded-xl shadow-2xl' : ''}`}>
                  <div id="dashboard-yt-player" className="w-full h-full border-0 pointer-events-auto" />
                </div>
              ) : localPlay.platform === 'spotify' ? (
                <div className={`${mobilePlayer ? 'w-full max-w-sm' : 'p-2'}`}>
                  <iframe
                    src={`https://open.spotify.com/embed/track/${localPlay.id}?theme=0`}
                    className={`w-full border-0 ${mobilePlayer ? 'rounded-xl' : 'rounded-lg'}`}
                    style={{ height: mobilePlayer ? '352px' : '80px' }}
                    allow="autoplay; encrypted-media"
                  />
                </div>
              ) : (
                <div className={`${mobilePlayer ? 'w-64 h-64' : 'w-full h-24'} rounded-xl bg-[#111] border border-white/[0.06] flex items-center justify-center`}>
                  <Music size={mobilePlayer ? 32 : 20} className="text-white/[0.08]" />
                </div>
              )}
            </div>

            {/* Full-screen controls */}
            {mobilePlayer && (
              <>
                <div className="flex items-center justify-between mt-6 mb-1">
                  <div className="min-w-0 flex-1 mr-3">
                    <h2 className="text-[15px] font-semibold truncate text-white/90">{localPlay.title}</h2>
                    <p className="text-[12px] text-white/25 mt-0.5">
                      {localPlay.platform === 'youtube' ? 'YouTube' : 'Spotify'}
                      {localPlay.type === 'video' ? ' • Video' : ' • Audio'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setLocalPlay(null)} className="text-[10px] text-white/20 hover:text-white/40 transition-all">✕</button>
                    <button onClick={() => { setShowPlaylistPicker(!showPlaylistPicker); if (!showPlaylistPicker) fetchPlaylists(); }}
                      className={`p-1.5 transition-all ${showPlaylistPicker ? 'text-emerald-400' : 'text-white/20'}`}
                    ><Heart size={18} fill={showPlaylistPicker ? 'currentColor' : 'none'} /></button>
                  </div>
                </div>

                {showPlaylistPicker && (
                  <div className="my-2 bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                    <p className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.15em] mb-2">Add to playlist</p>
                    {playlists.length > 0 ? playlists.map(p => (
                      <button key={p._id} onClick={() => addToPlaylist(p._id)}
                        className="w-full text-left px-3 py-2 text-[12px] text-white/50 hover:text-white/80 hover:bg-white/[0.03] rounded transition-all"
                      >{p.name}</button>
                    )) : <p className="text-[11px] text-white/15 px-3">No playlists yet</p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FULL PLAYER (device-synced only, no localPlay) ── */}
      {!localPlay && deviceStatus && mobilePlayer && (
        <div className="fixed inset-0 z-50 bg-[#080808] flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent h-[40%]" />
          <div className="relative flex-1 flex flex-col px-7 pt-6 pb-6 z-10">
            <button onClick={() => setMobilePlayer(false)} className="self-center mb-4"><ChevronDown size={24} className="text-white/20" /></button>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-64 h-64 rounded-xl bg-[#111] border border-white/[0.06] flex items-center justify-center shadow-2xl">
                {deviceStatus.url?.includes('youtube') ? <Youtube size={32} className="text-white/[0.08]" /> : <Music size={32} className="text-white/[0.08]" />}
              </div>
            </div>
            <div className="flex items-center justify-between mt-6 mb-1">
              <div className="min-w-0 flex-1 mr-3">
                <h2 className="text-[15px] font-semibold truncate text-white/90">{deviceStatus.title}</h2>
                <p className="text-[12px] text-white/25 mt-0.5">{deviceStatus.url?.includes('youtube') ? 'YouTube' : 'Browser'}</p>
              </div>
              <button onClick={() => { setShowPlaylistPicker(!showPlaylistPicker); if (!showPlaylistPicker) fetchPlaylists(); }}
                className={`p-1.5 transition-all ${showPlaylistPicker ? 'text-emerald-400' : 'text-white/20'}`}
              ><Heart size={18} fill={showPlaylistPicker ? 'currentColor' : 'none'} /></button>
            </div>
            {showPlaylistPicker && (
              <div className="my-2 bg-white/[0.03] rounded-lg p-3 border border-white/[0.05]">
                <p className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.15em] mb-2">Add to playlist</p>
                {playlists.length > 0 ? playlists.map(p => (
                  <button key={p._id} onClick={() => addToPlaylist(p._id)}
                    className="w-full text-left px-3 py-2 text-[12px] text-white/50 hover:text-white/80 hover:bg-white/[0.03] rounded transition-all"
                  >{p.name}</button>
                )) : <p className="text-[11px] text-white/15 px-3">No playlists yet</p>}
              </div>
            )}
            <div className="mt-3">
              <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-white/20 font-mono">
                <span>{fmt(deviceStatus.currentTime)}</span>
                <span>-{fmt((deviceStatus.duration || 0) - (deviceStatus.currentTime || 0))}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-10 mt-3">
              <button 
                onClick={(e) => { e.stopPropagation(); if (localPlay) playPrev(); else cmd('SEEK_BACKWARD'); }} 
                className={`text-white/60 ${localPlay && queueIndex <= 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                disabled={localPlay && queueIndex <= 0}
              >
                <SkipBack size={26} fill="currentColor" />
              </button>
              
              {deviceStatus && nowPlaying.isDevice ? (
                <button onClick={(e) => { e.stopPropagation(); cmd(deviceStatus.paused ? 'PLAY' : 'PAUSE'); }}
                  className="w-14 h-14 bg-white text-[#080808] rounded-full flex items-center justify-center active:scale-95 transition-all"
                >
                  {deviceStatus.paused ? <Play size={22} fill="currentColor" className="ml-0.5" /> : <Pause size={22} fill="currentColor" />}
                </button>
              ) : (
                <div className="w-14 h-14 bg-white/10 text-white/50 rounded-full flex items-center justify-center cursor-not-allowed">
                  <Play size={22} fill="currentColor" className="ml-0.5" />
                </div>
              )}
              
              <button 
                onClick={(e) => { e.stopPropagation(); if (localPlay) playNext(); else cmd('SEEK_FORWARD'); }} 
                className={`text-white/60 ${localPlay && queueIndex >= playQueue.length - 1 && !localPlay ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <SkipForward size={26} fill="currentColor" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-5 px-6">
              <Volume2 size={12} className="text-white/15" />
              <input type="range" min="0" max="1" step="0.05" value={deviceStatus.volume || 0.5}
                onChange={(e) => cmd('SET_VOLUME', parseFloat(e.target.value))}
                className="flex-1 accent-white h-[2px] cursor-pointer" />
              <Volume2 size={12} className="text-white/35" />
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM BAR ── */}
      {nowPlaying && (
        <footer className="border-t border-white/[0.04] bg-[#0c0c0c] flex-shrink-0 z-30 relative">
          {deviceStatus && <div className="h-[2px] bg-white/[0.03]"><div className="h-full bg-white/40 transition-all duration-1000" style={{ width: `${pct}%` }} /></div>}

          {/* Mobile */}
          <div className="md:hidden flex items-center h-13 px-3 gap-2.5 cursor-pointer" onClick={() => setMobilePlayer(true)}>
            <div className="w-8 h-8 rounded bg-white/[0.04] flex items-center justify-center flex-shrink-0">
              {nowPlaying.platform === 'youtube' ? <Youtube size={12} className="text-red-500/40" /> : nowPlaying.platform === 'spotify' ? <Music size={12} className="text-green-500/40" /> : <Music size={12} className="text-white/15" />}
            </div>
            <p className="flex-1 text-[12px] font-medium text-white/60 truncate">{nowPlaying.title}</p>
            {localPlay && <button onClick={(e) => { e.stopPropagation(); setLocalPlay(null); }} className="p-1 text-white/15 hover:text-white/40">✕</button>}
            {deviceStatus && nowPlaying.isDevice && (
              <button onClick={(e) => { e.stopPropagation(); cmd(deviceStatus.paused ? 'PLAY' : 'PAUSE'); }} className="p-1.5 text-white/60">
                {deviceStatus.paused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); setShowPlaylistPicker(!showPlaylistPicker); if (!showPlaylistPicker) fetchPlaylists(); }}
              className={`p-1.5 ${showPlaylistPicker ? 'text-emerald-400' : 'text-white/20'}`}
            ><Heart size={14} fill={showPlaylistPicker ? 'currentColor' : 'none'} /></button>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex items-center h-16 px-5">
            <div className="flex items-center gap-3 w-[28%] min-w-0">
              <div className="w-10 h-10 rounded bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                {nowPlaying.platform === 'youtube' ? <Youtube size={15} className="text-red-500/30" /> : nowPlaying.platform === 'spotify' ? <Music size={15} className="text-green-500/30" /> : <Smartphone size={15} className="text-white/15" />}
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-white/70 truncate">{nowPlaying.title}</p>
                <p className="text-[10px] text-white/20">
                  {nowPlaying.platform === 'youtube' ? 'YouTube' : nowPlaying.platform === 'spotify' ? 'Spotify' : 'Browser'}
                  {nowPlaying.type === 'video' ? ' • Video' : ' • Audio'}
                </p>
              </div>
              {localPlay && <button onClick={() => setLocalPlay(null)} className="text-[10px] text-white/15 hover:text-white/30 ml-1">✕</button>}
              <button onClick={() => { setShowPlaylistPicker(!showPlaylistPicker); if (!showPlaylistPicker) fetchPlaylists(); }}
                className={`ml-1 p-1 rounded transition-all ${showPlaylistPicker ? 'text-emerald-400' : 'text-white/15 hover:text-white/40'}`}
              ><Heart size={14} fill={showPlaylistPicker ? 'currentColor' : 'none'} /></button>
            </div>

            {deviceStatus && nowPlaying.isDevice ? (
              <div className="flex-1 flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-4">
                  <button onClick={() => cmd('SEEK_BACKWARD')} className="text-white/25 hover:text-white/60 transition-all"><SkipBack size={16} /></button>
                  <button onClick={() => cmd(deviceStatus.paused ? 'PLAY' : 'PAUSE')}
                    className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[#0c0c0c] hover:scale-105 active:scale-95 transition-all"
                  >{deviceStatus.paused ? <Play size={12} fill="currentColor" className="ml-px" /> : <Pause size={12} fill="currentColor" />}</button>
                  <button onClick={() => cmd('SEEK_FORWARD')} className="text-white/25 hover:text-white/60 transition-all"><SkipForward size={16} /></button>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-white/20 font-mono w-full max-w-sm">
                  <span className="w-8 text-right">{fmt(deviceStatus.currentTime)}</span>
                  <div className="flex-1 h-[2px] bg-white/[0.06] rounded-full overflow-hidden cursor-pointer group">
                    <div className="h-full bg-white/40 group-hover:bg-white/70 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8">{fmt(deviceStatus.duration)}</span>
                </div>
              </div>
            ) : localPlay ? (
              <div className="flex-1 flex items-center justify-center gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); playPrev(); }} 
                  className={`text-white/40 hover:text-white/80 transition-all ${queueIndex <= 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                  disabled={queueIndex <= 0}
                >
                  <SkipBack size={18} fill="currentColor" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); playNext(); }} 
                  className="text-white/40 hover:text-white/80 transition-all"
                >
                  <SkipForward size={18} fill="currentColor" />
                </button>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-[10px] text-white/15">Playing from search</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 w-[18%] justify-end">
              {deviceStatus && nowPlaying.isDevice && (
                <>
                  <Volume2 size={13} className="text-white/15" />
                  <input type="range" min="0" max="1" step="0.05" value={deviceStatus.volume || 0.5}
                    onChange={(e) => cmd('SET_VOLUME', parseFloat(e.target.value))}
                    className="w-20 accent-white h-[2px] cursor-pointer opacity-30 hover:opacity-80 transition-opacity"
                  />
                </>
              )}
            </div>
          </div>

          {/* Playlist popup */}
          {showPlaylistPicker && (
            <div className="hidden md:block absolute bottom-[66px] left-5 w-56 bg-[#151515] border border-white/[0.06] rounded-lg p-2 shadow-2xl z-50">
              <p className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.15em] mb-1.5 px-2">Add to playlist</p>
              {playlists.length > 0 ? playlists.map(p => (
                <button key={p._id} onClick={() => addToPlaylist(p._id)}
                  className="w-full text-left px-2.5 py-1.5 text-[12px] text-white/50 hover:text-white/80 hover:bg-white/[0.04] rounded transition-all"
                >{p.name}</button>
              )) : <p className="text-[11px] text-white/15 px-2.5 py-1.5">No playlists yet</p>}
            </div>
          )}
        </footer>
      )}

      {/* ── MOBILE NAV ── */}
      <nav className="md:hidden flex items-center justify-around h-11 bg-[#080808] border-t border-white/[0.04] flex-shrink-0 z-20">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            className={`flex flex-col items-center gap-0.5 text-[9px] font-medium transition-all py-1 ${
              (view === t.id || (t.id === 'playlists' && view === 'playlist-detail')) ? 'text-white/70' : 'text-white/20'
            }`}
          >{t.icon}{t.label}</button>
        ))}
      </nav>
    </div>
  );
};

export default Dashboard;
