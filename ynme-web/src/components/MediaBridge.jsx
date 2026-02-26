import React, { useState, useEffect, useRef } from 'react';
import { Youtube, ExternalLink, RefreshCw, List, ChevronUp, ChevronDown, Radio } from 'lucide-react';
import axios from 'axios';

// Load YouTube IFrame API once
if (!window.YT) {
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

const MediaBridge = ({ deviceStatus, socket }) => {
  const [videoId, setVideoId] = useState(null);
  const [searching, setSearching] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [offset, setOffset] = useState(0);
  const [results, setResults] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const playerRef = useRef(null);
  const lastTitle = useRef('');
  const syncIntervalRef = useRef(null);

  // Detect and extract video ID
  useEffect(() => {
    if (!deviceStatus?.title) return;
    const t = deviceStatus.title.trim();
    if (t !== lastTitle.current && !t.includes('ynme')) {
      lastTitle.current = t;
      if (deviceStatus.url?.includes('youtube.com/watch')) {
        try {
          const vid = new URL(deviceStatus.url).searchParams.get('v');
          if (vid) { setVideoId(vid); setConfidence(1); return; }
        } catch (e) {}
      }
      findVideo(t);
    }
  }, [deviceStatus?.title, deviceStatus?.url]);

  // Initialize YT.Player
  useEffect(() => {
    if (!videoId) return;
    const init = () => {
      if (playerRef.current) { try { playerRef.current.destroy(); } catch (e) {} }
      setPlayerReady(false);
      playerRef.current = new window.YT.Player('ynme-yt-player', {
        videoId,
        playerVars: { autoplay: 0, mute: 1, controls: 1, modestbranding: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: (e) => {
            e.target.seekTo(Number(deviceStatus?.currentTime || 0) + offset + 0.5, true);
            e.target.playVideo();
            setPlayerReady(true);
          },
          onError: (e) => console.error('[MediaBridge] Error:', e.data)
        }
      });
    };
    if (window.YT?.Player) init();
    else window.onYouTubeIframeAPIReady = init;
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [videoId]);

  // Drift correction
  useEffect(() => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (!syncEnabled || !playerReady || !deviceStatus || deviceStatus.paused) return;
    syncIntervalRef.current = setInterval(() => {
      if (!playerRef.current || !deviceStatus) return;
      try {
        const drift = Math.abs(playerRef.current.getCurrentTime() - (Number(deviceStatus.currentTime || 0) + offset + 0.5));
        if (drift > 3) playerRef.current.seekTo(Number(deviceStatus.currentTime || 0) + offset + 0.5, true);
      } catch (e) {}
    }, 5000);
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [syncEnabled, playerReady, deviceStatus?.currentTime, offset]);

  const findVideo = async (q) => {
    if (!q) return;
    setSearching(true);
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL || `http://${window.location.hostname || 'localhost'}:5001`}/api/search?q=${encodeURIComponent(q)}&mode=video`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setResults(data);
      const yt = data.find(i => i.platform === 'youtube');
      if (yt) { setVideoId(yt.id); setConfidence(yt.confidence || 0.5); }
      else { setVideoId(null); setConfidence(0); }
    } catch (e) { console.error('[MediaBridge]', e); }
    finally { setSearching(false); }
  };

  if (!deviceStatus) return null;

  return (
    <div className={`transition-all duration-300 ${isExpanded ? 'fixed inset-0 z-50 bg-black p-4' : ''}`}>
      <div className="rounded-xl overflow-hidden bg-[#111] border border-white/[0.06]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full ${playerReady ? 'bg-emerald-500' : searching ? 'bg-amber-500 animate-pulse' : 'bg-white/10'}`} />
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Video Bridge</span>
            {playerReady && <span className="text-[10px] text-emerald-500/60 font-medium">Live</span>}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Offset */}
            <div className="flex items-center bg-white/[0.03] rounded-lg border border-white/[0.04]">
              <button onClick={() => setOffset(p => p - 1)} className="px-2 py-1 text-[10px] text-white/25 hover:text-white/60 transition-all">−1</button>
              <span className="px-1.5 text-[10px] text-white/30 font-mono border-x border-white/[0.04]">{offset > 0 ? `+${offset}` : offset}s</span>
              <button onClick={() => setOffset(p => p + 1)} className="px-2 py-1 text-[10px] text-white/25 hover:text-white/60 transition-all">+1</button>
            </div>
            <button onClick={() => setShowPicker(!showPicker)}
              className={`p-1.5 rounded-lg transition-all ${showPicker ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/50'}`}
            ><List size={14} /></button>
            <button onClick={() => { lastTitle.current = ''; findVideo(deviceStatus.title); }}
              className="p-1.5 rounded-lg text-white/20 hover:text-white/50 transition-all"
            ><RefreshCw size={14} className={searching ? 'animate-spin' : ''} /></button>
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 rounded-lg text-white/20 hover:text-white/50 transition-all">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Player */}
        <div className={`relative bg-black ${isExpanded ? 'flex-1' : 'aspect-video'}`}>
          {searching ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              <p className="text-[11px] text-white/20 font-medium">Searching...</p>
            </div>
          ) : !videoId ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Radio size={24} className="text-white/10" />
              <p className="text-[12px] text-white/20 font-medium">No video synced</p>
              <button onClick={() => findVideo(deviceStatus.title)}
                className="text-[11px] text-white/30 hover:text-white/60 border border-white/10 px-3 py-1 rounded-lg transition-all"
              >Try sync</button>
            </div>
          ) : (
            <div id="ynme-yt-player" className="w-full h-full" />
          )}

          {/* Results Picker */}
          {showPicker && (
            <div className="absolute inset-0 bg-[#0a0a0a]/98 z-40 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-white/[0.04]">
                <span className="text-[12px] font-semibold text-white/50">Select version</span>
                <button onClick={() => setShowPicker(false)} className="text-[11px] text-white/20 hover:text-white/50 transition-all">Close</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {results.filter(r => r.platform === 'youtube').map((r, i) => (
                  <button key={i} onClick={() => { setVideoId(r.id); setConfidence(r.confidence || 0.5); setShowPicker(false); }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                      videoId === r.id ? 'bg-white/[0.06] border border-white/[0.08]' : 'hover:bg-white/[0.03] border border-transparent'
                    }`}
                  >
                    <img src={r.thumbnail} alt="" className="w-16 h-10 rounded object-cover flex-shrink-0 bg-white/5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-white/70 truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          (r.confidence || 0) > 0.8 ? 'bg-emerald-500/10 text-emerald-400/70' : 'bg-white/5 text-white/20'
                        }`}>{Math.round((r.confidence || 0) * 100)}%</span>
                        {videoId === r.id && <span className="text-[9px] text-emerald-500/50 font-medium">Active</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaBridge;
