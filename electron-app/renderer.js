const { ipcRenderer } = require('electron');

let isRecording = false;
let isToggling = false;
let geminiController = null;
let chirpClient = null;

// Listen for toggle command from main process
ipcRenderer.on('toggle-dictation', async () => {
    console.log('Renderer: Received toggle-dictation command');

    if (isToggling) {
        console.log('Renderer: Already toggling, ignoring command');
        return;
    }

    isToggling = true;

    try {
        if (isRecording) {
            console.log('Renderer: Stopping dictation...');
            stopDictation();
        } else {
            console.log('Renderer: Starting dictation...');
            await startDictation();
        }
    } catch (error) {
        console.error('Renderer: Error toggling dictation:', error);
    } finally {
        isToggling = false;
    }
});

async function startDictation() {
    try {
        // Fetch all settings at once
        const settings = await ipcRenderer.invoke('get-settings');
        const engine = settings.speechEngine || 'chrome';
        console.log('Starting dictation with engine:', engine);

        if (engine === 'gemini') {
            await startGeminiDictation(settings);
        } else if (engine === 'chirp') {
            await startChirpDictation(settings);
        } else {
            // Chrome Web Speech API not supported in Electron background. Defaulting to Chirp.
            console.warn('Chrome Web Speech API not supported in Electron background. Defaulting to Chirp.');
            await startChirpDictation(settings);
        }
    } catch (error) {
        console.error('Failed to start dictation:', error);
        ipcRenderer.send('log', `Error: ${error.message}`);
    }
}

async function startGeminiDictation(settings) {
    const apiKey = settings.geminiApiKey;
    if (!apiKey) {
        // We can't show alerts in hidden window easily, log error
        console.error('Gemini API Key missing');
        ipcRenderer.send('log', 'Error: Gemini API Key missing in settings');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        ipcRenderer.send('dictation-state', true);

        const client = new GeminiClient(apiKey);

        geminiController = await client.streamAudio(
            stream,
            (text) => {
                if (text) {
                    console.log('Transcript:', text);
                    ipcRenderer.send('insert-text', text + ' ');
                }
            },
            (error) => {
                console.error('Gemini error:', error);
                ipcRenderer.send('log', `Gemini Error: ${error.message}`);
            }
        );
    } catch (error) {
        console.error('Gemini start error:', error);
        throw error;
    }
}

async function startChirpDictation(settings) {
    const projectId = settings.chirpProjectId;

    if (!projectId) {
        console.error('Chirp Project ID missing');
        ipcRenderer.send('log', 'Error: Chirp Project ID missing in settings');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        isRecording = true;
        ipcRenderer.send('dictation-state', true);

        // Initialize AudioWorklet
        const audioContext = new AudioContext();
        await audioContext.audioWorklet.addModule('audio-processor.js');
        const source = audioContext.createMediaStreamSource(stream);
        const processor = new AudioWorkletNode(audioContext, 'audio-processor');

        source.connect(processor);
        processor.connect(audioContext.destination);

        // Notify main process to start stream
        console.log('Renderer: Starting Chirp stream via IPC...');
        ipcRenderer.send('start-stream', { sampleRate: audioContext.sampleRate });

        // Stream audio chunks to main process
        processor.port.onmessage = (event) => {
            if (event.data.audio) {
                ipcRenderer.send('audio-chunk', event.data.audio);
            }
        };

        // Store controller to stop recording
        geminiController = {
            stop: () => {
                source.disconnect();
                processor.disconnect();
                audioContext.close();
                stream.getTracks().forEach(track => track.stop());
                ipcRenderer.send('stop-stream');
            }
        };

        console.log('Chirp dictation started successfully (IPC Streaming)');
        ipcRenderer.send('log', 'Chirp dictation started successfully (IPC Streaming)');

    } catch (error) {
        console.error('Chirp start error:', error);
        throw error;
    }
}

// Listen for transcripts from main process
ipcRenderer.on('transcript', (event, text) => {
    console.log(`Renderer: Received transcript: "${text}"`);
    // Note: Text insertion is handled in main process now, but we can log it here
});

ipcRenderer.on('stream-error', (event, error) => {
    console.error('Renderer: Stream Error:', error);
    ipcRenderer.send('log', `Stream Error: ${error}`);
    stopDictation();
});

ipcRenderer.on('log', (event, message) => {
    console.log(`[Main Process] ${message}`);
});

function stopDictation() {
    isRecording = false;
    ipcRenderer.send('dictation-state', false);

    if (geminiController) {
        geminiController.stop();
        geminiController = null;
    }

    // Stop other clients if active
}
