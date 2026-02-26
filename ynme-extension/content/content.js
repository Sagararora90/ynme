let subtitleElement = null;

function showSubtitle(text) {
    if (!subtitleElement) {
        subtitleElement = document.createElement('div');
        subtitleElement.id = 'ynme-subtitle-overlay';
        Object.assign(subtitleElement.style, {
            position: 'fixed',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '16px 32px',
            borderRadius: '24px',
            fontSize: '28px',
            fontWeight: 'bold',
            zIndex: '999999',
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'center',
            maxWidth: '80%',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            pointerEvents: 'none',
            opacity: '0'
        });
        document.body.appendChild(subtitleElement);
    }

    subtitleElement.innerText = text;
    subtitleElement.style.opacity = '1';
    subtitleElement.style.transform = 'translateX(-50%) translateY(0)';

    if (window.subtitleTimeout) clearTimeout(window.subtitleTimeout);
    window.subtitleTimeout = setTimeout(() => {
        subtitleElement.style.opacity = '0';
        subtitleElement.style.transform = 'translateX(-50%) translateY(10px)';
    }, 4000);
}

function findMediaInShadow(root) {
    if (!root) return null;
    
    // 1. Check current level
    const media = root.querySelector('video, audio');
    if (media) return media;

    // 2. Search deeper in all elements (including shadow roots)
    const all = root.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el.shadowRoot) {
            const result = findMediaInShadow(el.shadowRoot);
            if (result) return result;
        }
    }
    return null;
}

function findMediaElement() {
    // Priority 1: Standard tags
    const media = Array.from(document.querySelectorAll('video, audio'));
    const active = media.find(m => !m.paused && m.currentTime > 0);
    if (active) return active;

    // Priority 2: Recursively search Shadow DOM
    const shadowMedia = findMediaInShadow(document);
    if (shadowMedia) return shadowMedia;

    // Priority 3: Any video with a source
    const video = document.querySelector('video');
    if (video) return video;

    // Priority 4: Any audio with a source
    return document.querySelector('audio');
}

const isSmallFrame = window.top !== window.self && (window.innerWidth < 100 || window.innerHeight < 100);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SHOW_SUBTITLE') {
        showSubtitle(message.text);
        sendResponse({ success: true });
        return;
    }

    const media = findMediaElement();

    if (message.type === "GET_STATUS") {
        if (isSmallFrame) {
            sendResponse({ error: 'SMALL_FRAME' });
            return;
        }

        // --- ENHANCED METADATA DETECTION ---
        let title = document.title;
        let artist = "";
        let isKnownMediaSite = false;

        // Spotify Specific Logic
        if (window.location.host.includes('spotify.com')) {
            isKnownMediaSite = true;
            const trackEl = document.querySelector('[data-testid="now-playing-widget"] [data-testid="context-item-link"]') || 
                           document.querySelector('[data-testid="track-info-name"]');
            const artistEl = document.querySelector('[data-testid="now-playing-widget"] [data-testid="context-item-info-artist"]') ||
                            document.querySelector('[data-testid="track-info-artists"]');
            
            if (trackEl) title = trackEl.innerText;
            if (artistEl) artist = artistEl.innerText;
            
            if (title === "Spotify" && !trackEl) {
                const parts = document.title.split(' • ');
                if (parts.length > 1) {
                    title = parts[0];
                    artist = parts[1];
                }
            }
        }

        // YouTube Logic
        if (window.location.host.includes('youtube.com')) {
            isKnownMediaSite = true;
            // Clean title: Remove "(1) " prefix and " - YouTube" suffix
            title = title.replace(/^\(\d+\)\s/, '').replace(/ - YouTube$/, '');
        }

        if (!media && !isKnownMediaSite) {
            sendResponse({ error: 'NO_MEDIA' });
            return;
        }

        // If we have no media element but we ARE on a known site, return metadata with defaults
        sendResponse({
            title: artist ? `${title} - ${artist}` : title,
            currentTime: media ? media.currentTime : 0,
            duration: media ? media.duration : 0,
            paused: media ? media.paused : true,
            volume: media ? media.volume : 1,
            url: window.location.href,
            isReady: !!media // Tell dashboard if it's actually ready to be controlled
        });
    }

    // Media Controls
    try {
        if (message.type === "PLAY") media?.play();
        if (message.type === "PAUSE") media?.pause();
        if (message.type === "SEEK_FORWARD") if (media) media.currentTime += 10;
        if (message.type === "SEEK_BACKWARD") if (media) media.currentTime -= 10;
        if (message.type === "SET_VOLUME") if (media) media.volume = message.value;
        if (message.type === "SET_SPEED") if (media) media.playbackRate = message.value;
        if (message.type === "SEEK_TO" && media) media.currentTime = message.value;
    } catch (e) {
        console.error('[ynme] Control error:', e);
    }

    sendResponse({ success: true });
    return false;
});
