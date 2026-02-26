const { google } = require('googleapis');
const SpotifyWebApi = require('spotify-web-api-node');
const ytsr = require('ytsr');
const { Groq } = require('groq-sdk');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

let spotifyTokenExpiry = 0;
async function ensureSpotifyToken() {
  if (Date.now() < spotifyTokenExpiry) return;
  try {
    console.log('[Search] Refreshing Spotify token...');
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    spotifyTokenExpiry = Date.now() + (data.body['expires_in'] * 1000) - 60000;
    console.log('[Search] Spotify token OK');
  } catch (err) {
    console.error('[Search] Spotify Auth FAILED:', err.body?.error || err.message || JSON.stringify(err));
    throw err;
  }
}

const calcConfidence = (title, query) => {
  const r = title.toLowerCase(), o = query.toLowerCase();
  if (r.includes(o)) return 0.95;
  const words = o.split(' ').filter(w => w.length > 2);
  return words.filter(w => r.includes(w)).length / (words.length || 1);
};

// ── FREE YouTube search (no API key, no quota) ──
const searchYTFree = async (query) => {
  try {
    console.log(`[Search] YouTube (free/ytsr) → "${query}"`);
    const results = await ytsr(query, { limit: 10 });
    const videos = results.items.filter(i => i.type === 'video');
    console.log(`[Search] YouTube (free/ytsr) → ${videos.length} videos`);
    return videos.map(v => ({
      title: v.title || 'Untitled',
      id: v.id,
      platform: 'youtube',
      type: 'video',
      thumbnail: v.bestThumbnail?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      description: v.description || '',
      playUrl: v.url,
      confidence: calcConfidence(v.title || '', query),
      duration: v.duration || ''
    }));
  } catch (err) {
    console.error('[Search] YouTube (free/ytsr) Error:', err.message);
    return [];
  }
};

// ── Official YouTube API (uses quota) ──
const searchYTOfficial = async (query) => {
  try {
    const ytRes = await youtube.search.list({ part: 'snippet', q: query, maxResults: 10, type: 'video' });
    return ytRes.data.items.map(item => ({
      title: item.snippet.title,
      id: item.id.videoId,
      platform: 'youtube',
      type: 'video',
      thumbnail: item.snippet.thumbnails.high.url,
      description: item.snippet.description,
      playUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      confidence: calcConfidence(item.snippet.title, query)
    }));
  } catch (err) {
    console.error('[Search] YouTube (official) Error:', err.response?.data?.error?.message || err.message);
    return null; // null = fallback to free
  }
};

// ── YouTube: try official first, fallback to free ──
const searchYT = async (query) => {
  const official = await searchYTOfficial(query);
  if (official !== null) return official;
  console.log('[Search] Quota exceeded → using free fallback');
  return searchYTFree(query);
};

// ── Spotify ──
const searchSpotify = async (query) => {
  try {
    await ensureSpotifyToken();
    const res = await spotifyApi.searchTracks(query, { limit: 6 });
    console.log(`[Search] Spotify → ${res.body.tracks.items?.length || 0} results`);
    return res.body.tracks.items.map(item => ({
      title: `${item.name} - ${item.artists.map(a => a.name).join(', ')}`,
      id: item.id,
      platform: 'spotify',
      type: 'audio',
      thumbnail: item.album.images[0]?.url,
      playUrl: item.external_urls.spotify
    }));
  } catch (err) {
    const detail = err.body?.error_description || err.body?.error || err.statusCode || err.message;
    console.error('[Search] Spotify Error:', detail);
    return [];
  }
};

// ── Main ──
const searchMedia = async (query, mode = 'smart') => {
  console.log(`[Search] query="${query}" mode="${mode}"`);
  
  const videoQ = mode === 'video' && !query.toLowerCase().includes('video')
    ? `${query} official music video` : query;

  let results;
  if (mode === 'video') {
    const [yt, spot] = await Promise.all([searchYT(videoQ), searchSpotify(query)]);
    results = [...yt, ...spot.slice(0, 2)];
  } else if (mode === 'audio') {
    const [spot, yt] = await Promise.all([searchSpotify(query), searchYT(query)]);
    results = [...spot, ...yt.slice(0, 2)];
  } else {
    const [yt, spot] = await Promise.all([searchYT(query), searchSpotify(query)]);
    const balanced = [];
    for (let i = 0; i < Math.max(yt.length, spot.length); i++) {
      if (yt[i]) balanced.push(yt[i]);
      if (spot[i]) balanced.push(spot[i]);
    }
    results = balanced;
  }

  console.log(`[Search] Final: ${results.length} results`);
  return results;
};

// ── Recommendations (Spotify based) ──
const getRelatedMedia = async (seedTitle, seedId, platform) => {
  try {
    await ensureSpotifyToken();
    let targetSeedId = seedId;

    // If it's not a spotify track, we need to find the closest spotify track by title
    if (platform !== 'spotify' || !targetSeedId) {
      console.log(`[Search] Finding Spotify seed for "${seedTitle}"...`);
      const spotRes = await searchSpotify(seedTitle);
      if (spotRes.length > 0) {
        targetSeedId = spotRes[0].id;
      } else {
        throw new Error('Could not find a valid Spotify seed track to generate recommendations.');
      }
    }

    console.log(`[Search] Fetching recommendations for seed track: ${targetSeedId}`);
    const res = await spotifyApi.getRecommendations({
      seed_tracks: [targetSeedId],
      min_energy: 0.4,
      min_popularity: 50,
      limit: 10
    });

    console.log(`[Search] Recommendations → ${res.body.tracks?.length || 0} results`);
    const recommendedTracks = res.body.tracks.map(item => ({
      title: `${item.name} - ${item.artists.map(a => a.name).join(', ')}`,
      id: item.id,
      platform: 'spotify',
      type: 'audio',
      thumbnail: item.album.images[0]?.url,
      playUrl: item.external_urls.spotify
    }));

    // Find YouTube equivalents so playback works reliably (Spotify embed is 30s preview)
    const playableTracks = await Promise.all(
      recommendedTracks.map(async (track) => {
        try {
          const ytSearch = await searchYT(track.title);
          if (ytSearch && ytSearch.length > 0) {
            return { ...track, id: ytSearch[0].id, playUrl: ytSearch[0].playUrl, platform: 'youtube', type: 'video' };
          }
        } catch (e) { console.error('YT fallback error for recommendation:', e.message); }
        return track;
      })
    );

    return playableTracks;

  } catch (err) {
    const detail = err.body?.error_description || err.body?.error || err.message || err.statusCode;
    console.error('[Search] Spotify Recommendation Error:', detail);
    
    // 🔥 AI FALLBACK 🔥
    if (groq && seedTitle) {
      try {
        console.log(`[Search] Using AI fallback to recommend songs for "${seedTitle}"...`);
        const response = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content: "You are an expert music recommendation algorithm API. Your ONLY output must be a valid JSON array of strings containing 10 similar song titles. Format each string as 'Song Name - Artist Name'. Do not include any explanations, greetings, or markdown formatting outside of the JSON."
            },
            {
              role: "user",
              content: `Recommend 10 similar songs to: "${seedTitle}". Return ONLY a JSON array of strings.`
            }
          ],
          model: "llama-3.1-8b-instant",
          temperature: 0.7
        });

        const content = response.choices[0]?.message?.content || "[]";
        let aiTitles = [];
        try {
          // Strip any markdown code blocks
          const cleanedText = content.replace(/```json/g, "").replace(/```/g, "").trim();
          aiTitles = JSON.parse(cleanedText);
        } catch (parseErr) {
          console.error('[Search] AI parse error:', parseErr.message, content);
          return [];
        }

        if (Array.isArray(aiTitles) && aiTitles.length > 0) {
          console.log(`[Search] AI generated ${aiTitles.length} recommendations. Fetching YouTube links...`);
          // Find YouTube equivalents for AI recommendations
          const playableAITracks = await Promise.all(
            aiTitles.slice(0, 10).map(async (title) => {
              try {
                const ytSearch = await searchYT(title);
                if (ytSearch && ytSearch.length > 0) {
                  return {
                    title: title,
                    id: ytSearch[0].id,
                    platform: 'youtube',
                    type: 'video',
                    thumbnail: ytSearch[0].thumbnail,
                    playUrl: ytSearch[0].playUrl
                  };
                }
              } catch (e) { console.error('YT search failed for AI track:', e.message); }
              return null;
            })
          );
          return playableAITracks.filter(t => t !== null);
        }
      } catch (aiErr) {
        console.error('[Search] AI Fallback Error:', aiErr.message);
      }
    }
    
    return [];
  }
};

module.exports = { searchMedia, getRelatedMedia };
