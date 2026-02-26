importScripts('socket.io.min.js');

// Manifest V3: Register listeners at top-level to avoid 'offline' event warnings
self.addEventListener('online', () => console.log('[ynme] System Online'));
self.addEventListener('offline', () => console.log('[ynme] System Offline'));

let socket = null;
let userId = null;
let lastMediaTabId = null;

async function createOffscreen() {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'Capture tab audio for AI transcription.'
    });
}

async function initSocket() {
    try {
        const data = await chrome.storage.local.get(['token', 'user']);
        if (!data.token || !data.user) {
            console.log('[ynme] No auth token found in storage.');
            return;
        }

        userId = data.user.id;
        console.log('[ynme] Initializing socket for user:', userId);

        const socketIo = typeof io !== 'undefined' ? io : self.io;

        socket = socketIo('http://127.0.0.1:5001', {
            auth: { token: data.token },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            console.log('[ynme] CONNECTED successfully!');
            socket.emit('register_device', {
                userId: userId,
                deviceName: 'Chrome Extension',
                deviceType: 'browser'
            });
        });

        socket.on('execute_command', (data) => {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                        chrome.tabs.sendMessage(tab.id, {
                            type: data.command,
                            value: data.value
                        }, () => { if (chrome.runtime.lastError) {} });
                    }
                });
            });
        });

        socket.on('execute_play', (media) => {
            chrome.tabs.create({ url: media.playUrl, active: true });
        });

        socket.on('start_audio_capture', async (data) => {
            console.log('[ynme] Backend requested audio capture. Duration:', data.duration);
            try {
                // Get all tabs to verify the media source
                const tabs = await chrome.tabs.query({});
                
                // 1. Try to use recently tracked media tab
                let targetTab = tabs.find(t => t.id === lastMediaTabId);
                
                // 2. If not found or invalid, find any tab that isn't the dashboard or a system page
                if (!targetTab || targetTab.url.includes('5173') || targetTab.url.includes('chrome://')) {
                    targetTab = tabs.find(t => t.url.includes('youtube.com') || t.url.includes('spotify.com'));
                }

                // 3. Last resort: current active tab (if it's not the dashboard)
                if (!targetTab) {
                    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    targetTab = (activeTab && !activeTab.url.includes('5173')) ? activeTab : null;
                }

                if (!targetTab) {
                    console.error('[ynme] No valid media tab found for capture. (Ignored dashboard)');
                    return;
                }

                console.log('[ynme] Target for capture:', targetTab.id, targetTab.title);
                const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: targetTab.id });
                console.log('[ynme] Got streamId:', streamId);
                await createOffscreen();
                chrome.runtime.sendMessage({
                    type: 'START_CAPTURE',
                    streamId,
                    duration: data.duration,
                    mode: data.mode
                });
                console.log('[ynme] Sent START_CAPTURE to offscreen.');
            } catch (err) {
                console.error('[ynme] Capture setup failed:', err);
                socket.emit('ai_analysis_error', { message: 'Extension failed to capture audio: ' + err.message });
            }
        });

        socket.on('sync_playback', (data) => {
            const command = data.paused ? 'PAUSE' : 'PLAY';
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                        chrome.tabs.sendMessage(tab.id, {
                            type: command,
                            value: data.currentTime
                        }, () => { if (chrome.runtime.lastError) {} });
                    }
                });
            });
        });

        socket.on('subtitle_update', (data) => {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                        chrome.tabs.sendMessage(tab.id, {
                            type: 'SHOW_SUBTITLE',
                            text: data.text
                        }, () => { if (chrome.runtime.lastError) {} });
                    }
                });
            });
        });

        socket.on('disconnect', (reason) => {
            console.warn('[ynme] Disconnected:', reason);
        });

    } catch (error) {
        console.error('[ynme] Socket initialization failed:', error);
    }
}

// Media status sync - Reduced frequency and optimized tab targeting
setInterval(async () => {
    if (!socket || !socket.connected || !userId) return;

    chrome.tabs.query({ audible: true }, (audibleTabs) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
            chrome.tabs.query({ windowType: 'normal' }, async (allTabs) => {
                const tabsToPoll = new Set([
                    ...audibleTabs.map(t => t.id),
                    ...activeTabs.map(t => t.id),
                    lastMediaTabId
                ].filter(Boolean));

                for (const tabId of tabsToPoll) {
                    const tab = allTabs.find(t => t.id === tabId);
                    if (!tab || !tab.url || !tab.url.startsWith('http')) continue;

                    try {
                        const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
                        frames.forEach(frame => {
                            chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }, { frameId: frame.frameId }, (response) => {
                                if (chrome.runtime.lastError) return;
                                if (response && !response.error) {
                                    lastMediaTabId = tab.id;
                                    socket.emit('media_status', { userId, status: response });
                                }
                            });
                        });
                    } catch (err) {
                        chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }, (response) => {
                            if (chrome.runtime.lastError) return;
                            if (response && !response.error) {
                                lastMediaTabId = tab.id;
                                socket.emit('media_status', { userId, status: response });
                            }
                        });
                    }
                }
            });
        });
    });
}, 1500);

initSocket();

chrome.storage.onChanged.addListener((changes) => {
    if (changes.token) {
        if (socket) socket.disconnect();
        initSocket();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUDIO_CHUNK' && socket && socket.connected) {
        socket.emit('stt_chunk', {
            userId,
            audioData: message.data,
            mode: message.mode
        });
        sendResponse({ received: true });
    }
    if (message.type === 'CHECK_CONNECTION') {
        sendResponse({ 
            connected: (socket && socket.connected) || false, 
            authenticated: !!userId 
        });
    }
    return false;
});
