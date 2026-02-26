const authView = document.getElementById('auth-view');
const playerView = document.getElementById('player-view');
const noMediaOverlay = document.getElementById('no-media');
const titleEl = document.getElementById('video-title');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const progressBar = document.getElementById('progress-bar');
const playPauseBtn = document.getElementById('play-pause-button');
const backBtn = document.getElementById('back-button');
const forwardBtn = document.getElementById('forward-button');
const volumeSlider = document.getElementById('volume-slider');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authError = document.getElementById('auth-error');

const playIcon = playPauseBtn.querySelector('.icon-play');
const pauseIcon = playPauseBtn.querySelector('.icon-pause');

let isDragging = false;

async function checkAuth() {
    const data = await chrome.storage.local.get(['token']);
    if (data.token) {
        authView.classList.add('hidden');
        playerView.classList.remove('hidden');
    } else {
        authView.classList.remove('hidden');
        playerView.classList.add('hidden');
    }
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateUI(status) {
    if (!status || status.error === "NO_MEDIA") {
        noMediaOverlay.classList.remove('hidden');
        return;
    }

    noMediaOverlay.classList.add('hidden');
    titleEl.textContent = status.title || "No Title";
    
    if (!isDragging) {
        currentTimeEl.textContent = formatTime(status.currentTime);
        durationEl.textContent = formatTime(status.duration);
        progressBar.max = status.duration || 100;
        progressBar.value = status.currentTime || 0;
    }

    if (status.paused) {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    } else {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    }

    volumeSlider.value = status.volume;
}

function sendMessage(type, value = null) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type, value }, (response) => {
                if (chrome.runtime.lastError) {
                    updateUI({ error: "NO_MEDIA" });
                }
            });
        }
    });
}

// Event Listeners
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    authError.classList.add('hidden');

    try {
        const response = await fetch('http://127.0.0.1:5001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            await chrome.storage.local.set({ token: data.token, user: data.user });
            checkAuth();
        } else {
            authError.textContent = data.message || 'Login failed';
            authError.classList.remove('hidden');
        }
    } catch (err) {
        authError.textContent = 'Server unreachable';
        authError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    checkAuth();
});

playPauseBtn.addEventListener('click', () => {
    const isPaused = !playIcon.classList.contains('hidden');
    sendMessage(isPaused ? "PLAY" : "PAUSE");
});

backBtn.addEventListener('click', () => sendMessage("SEEK_BACKWARD"));
forwardBtn.addEventListener('click', () => sendMessage("SEEK_FORWARD"));

volumeSlider.addEventListener('input', (e) => {
    sendMessage("SET_VOLUME", parseFloat(e.target.value));
});

progressBar.addEventListener('mousedown', () => isDragging = true);
progressBar.addEventListener('mouseup', () => {
    isDragging = false;
    sendMessage("SEEK_TO", parseFloat(progressBar.value));
});
progressBar.addEventListener('input', () => {
    currentTimeEl.textContent = formatTime(parseFloat(progressBar.value));
});

// Polling for UI updates
setInterval(() => {
    // Check connection with background
    chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' }, (response) => {
        const connStatus = document.getElementById('conn-status');
        if (!connStatus) return;
        
        if (response && response.connected) {
            connStatus.textContent = 'Syncing';
            connStatus.classList.add('online');
        } else {
            connStatus.textContent = 'Offline';
            connStatus.classList.remove('online');
        }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;

        try {
            const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
            let statusFound = false;

            for (const frame of frames) {
                if (statusFound) break;
                
                chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }, { frameId: frame.frameId }, (response) => {
                    if (chrome.runtime.lastError) return;
                    if (!statusFound && response && !response.error) {
                        statusFound = true;
                        updateUI(response);
                    }
                });
            }

            // If after checking all frames (this is async though, so it's tricky)
            // For simplicity in popup, we'll rely on the background script's lastMediaTabId if needed,
            // but the above is usually fast enough.
        } catch (err) {
            chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" }, (response) => {
                if (!chrome.runtime.lastError && response && !response.error) {
                    updateUI(response);
                } else {
                    updateUI({ error: "NO_MEDIA" });
                }
            });
        }
    });
}, 500);

checkAuth();
