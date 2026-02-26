let activeStream = null;
let captureInterval = null;
let isChatMode = false;

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'START_CAPTURE') {
        console.log('[ynme-offscreen] START_CAPTURE received. StreamId:', message.streamId);
        startCapture(message.streamId, message.duration, message.mode);
    }
    if (message.type === 'STOP_CAPTURE') {
        console.log('[ynme-offscreen] STOP_CAPTURE received.');
        stopAllCapture();
    }
});

function stopAllCapture() {
    isChatMode = false;
    if (captureInterval) clearInterval(captureInterval);
    if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
        activeStream = null;
    }
}

async function startCapture(streamId, duration = 5000, mode = 'summary') {
    console.log('[ynme-offscreen] Starting capture for duration:', duration, 'mode:', mode);
    stopAllCapture(); // Clean up any existing captures
    
    try {
        activeStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        });

        console.log('[ynme-offscreen] getUserMedia success. Stream active:', activeStream.active);

        // Continue playing audio in the tab while capturing
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(activeStream);
        source.connect(audioContext.destination);

        const recordChunk = () => {
            if (!activeStream) return null;
            const mediaRecorder = new MediaRecorder(activeStream, { mimeType: 'audio/webm' });
            const chunks = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                if (chunks.length === 0) return;
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    chrome.runtime.sendMessage({
                        type: 'AUDIO_CHUNK',
                        data: reader.result,
                        mode: mode
                    });
                };
            };

            mediaRecorder.start();
            return mediaRecorder;
        };

        if (mode === 'chat') {
            isChatMode = true;
            let currentRecorder = recordChunk();
            captureInterval = setInterval(() => {
                if (!isChatMode) return clearInterval(captureInterval);
                if (currentRecorder && currentRecorder.state === 'recording') currentRecorder.stop();
                currentRecorder = recordChunk();
            }, 15000); // 15 second chunks
        } else {
            const currentRecorder = recordChunk();
            setTimeout(() => {
                if (currentRecorder && currentRecorder.state === 'recording') currentRecorder.stop();
                stopAllCapture();
            }, duration);
        }

    } catch (err) {
        console.error('[ynme-offscreen] Capture Error:', err);
    }
}
