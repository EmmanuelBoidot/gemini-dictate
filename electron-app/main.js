const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let Store;
let store;
let mainWindow; // Hidden window for audio processing
let settingsWindow;
let tray;
let isDictating = false;

// Initialize app
app.whenReady().then(async () => {
    const module = await import('electron-store');
    Store = module.default;
    store = new Store();

    createWindow();
    createTray();
    registerShortcuts();

    // Set Dock Icon
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, 'assets', 'icon_source.png');
        const icon = nativeImage.createFromPath(iconPath);
        app.dock.setIcon(icon);
    }

    // Check for credentials and open settings if missing
    const hasGeminiKey = store.get('geminiApiKey');
    const hasChirpCreds = store.get('serviceAccountCreds') || store.get('chirpApiKey');

    if (!hasGeminiKey && !hasChirpCreds) {
        console.log('Main: No credentials found, opening settings...');
        openSettings();
    }

    // Open settings on launch for debugging
    // openSettings();

    // On macOS, hide the dock icon since we are a menu bar app
    // Commented out for debugging visibility
    // if (process.platform === 'darwin') {
    //     app.dock.hide();
    // }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 400,
        height: 600,
        show: false, // Hidden by default
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // For easier prototype access to node modules
            backgroundThrottling: false // Keep running in background
        }
    });

    mainWindow.loadFile('index.html');

    // Open DevTools for debugging (hidden window)
    mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function createTray() {
    const iconPath = path.join(__dirname, 'assets', 'icon_source.png');

    // Resize icon to standard macOS tray size (16x16 points, allowing for @2x)
    // The image file seems to be large, so we resize it programmatically.
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    // icon.setTemplateImage(true); // Ensure macOS treats it as a template (dark/light mode adaptation)

    tray = new Tray(icon);
    updateTrayMenu();
}

function updateTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
        { label: isDictating ? 'Stop Dictation' : 'Start Dictation', click: toggleDictation },
        { type: 'separator' },
        { label: 'Settings...', click: openSettings },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);
    tray.setContextMenu(contextMenu);
    tray.setTitle(isDictating ? ' 🟠' : '');
}

function registerShortcuts() {
    // Default shortcut: Command+Shift+S
    const shortcut = store.get('shortcut', 'Command+Shift+S');

    try {
        globalShortcut.register(shortcut, () => {
            toggleDictation();
        });
        console.log(`Registered global shortcut: ${shortcut}`);
    } catch (err) {
        console.error('Shortcut registration failed:', err);
    }
}

function toggleDictation() {
    console.log('Main: Toggling dictation...');
    if (!mainWindow) {
        console.error('Main: mainWindow not created!');
        return;
    }
    mainWindow.webContents.send('toggle-dictation');
    console.log('Main: Sent toggle-dictation to renderer');
}

function openSettings() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 500,
        height: 700,
        title: 'Gemini Dictate Settings',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    settingsWindow.loadFile('settings.html');

    // Open DevTools for debugging
    // settingsWindow.webContents.openDevTools();

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

const speech = require('@google-cloud/speech').v2;

// Speech Service for gRPC Streaming
class SpeechService {
    constructor() {
        this.client = null;
        this.recognizeStream = null;
        this.projectId = null;
        this.recognizerId = null;
        this.region = null;
    }

    async initialize(settings) {
        const creds = settings.serviceAccountCreds;
        if (!creds) throw new Error('Service Account credentials missing');

        // Prioritize settings, fallback to credentials
        this.projectId = settings.chirpProjectId || creds.project_id;

        if (!this.projectId) {
            console.error('Main: Project ID not found in settings or credentials');
            throw new Error('Project ID is missing. Please check your settings or Service Account JSON.');
        }

        // Force us-central1 for stability testing
        this.region = 'us-central1';
        this.recognizerId = settings.chirpRecognizerId || '_';

        const clientConfig = {
            credentials: {
                client_email: creds.client_email,
                private_key: creds.private_key
            },
            projectId: this.projectId,
            apiEndpoint: `${this.region}-speech.googleapis.com`
        };

        this.client = new speech.SpeechClient(clientConfig);
        console.log('Main: SpeechClient initialized');

        // Verify connection by listing recognizers (lightweight check)
        this.verifyConnection();
    }

    async verifyConnection() {
        try {
            const parent = `projects/${this.projectId}/locations/${this.region}`;
            console.log(`Main: Verifying connection to ${parent}...`);
            await this.client.listRecognizers({ parent });
            console.log('Main: Connection verified successfully');
            if (mainWindow) mainWindow.webContents.send('log', 'Main: API Connection Verified');
        } catch (error) {
            console.error('Main: Connection Verification Failed:', error);
            if (mainWindow) mainWindow.webContents.send('log', `Main: Connection Failed: ${error.message}`);
        }
    }

    startStream(sampleRate, onTranscript, onError) {
        if (!this.client) throw new Error('SpeechClient not initialized');

        this.audioChunks = [];
        this.sampleRate = sampleRate;
        this.onTranscript = onTranscript;
        this.onError = onError;

        console.log('Main: Starting batch recording...');
        if (mainWindow) mainWindow.webContents.send('log', 'Main: Batch recording started');
    }

    writeAudio(buffer) {
        if (this.audioChunks) {
            this.audioChunks.push(Buffer.from(buffer));
        }
    }

    async stopStream() {
        if (!this.audioChunks || this.audioChunks.length === 0) {
            console.log('Main: No audio recorded');
            return;
        }

        console.log(`Main: Processing ${this.audioChunks.length} chunks...`);
        if (mainWindow) mainWindow.webContents.send('log', `Main: Processing ${this.audioChunks.length} chunks...`);

        const audioBytes = Buffer.concat(this.audioChunks).toString('base64');
        this.audioChunks = null; // Clear buffer

        const recognizerName = `projects/${this.projectId}/locations/${this.region}/recognizers/${this.recognizerId}`;

        const request = {
            recognizer: recognizerName,
            config: {
                explicitDecodingConfig: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: this.sampleRate,
                    audioChannelCount: 1
                },
                languageCodes: ['en-US'],
                model: 'long',
                features: {
                    enableAutomaticPunctuation: true,
                    enableWordTimeOffsets: true
                }
            },
            content: audioBytes
        };

        try {
            console.log('Main: Sending Batch Request...');
            if (mainWindow) mainWindow.webContents.send('log', 'Main: Sending Batch Request...');

            const [response] = await this.client.recognize(request);

            if (response.results && response.results.length > 0) {
                // Join all results
                const transcript = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join(' ');

                console.log('Main: Final Transcript:', transcript);
                if (this.onTranscript) this.onTranscript(transcript);
            } else {
                console.log('Main: No transcription results');
                if (mainWindow) mainWindow.webContents.send('log', 'Main: No transcription results');
            }
        } catch (err) {
            console.error('Main: Batch Recognition Error:', err);
            if (mainWindow) mainWindow.webContents.send('log', `Main: Error: ${err.message}`);
            if (this.onError) this.onError(err);
        }
    }
}

const speechService = new SpeechService();

// IPC Handlers
ipcMain.handle('get-settings', () => {
    return store.store;
});

ipcMain.handle('get-setting', (event, key, defaultValue) => {
    return store.get(key, defaultValue);
});

ipcMain.on('set-setting', (event, key, value) => {
    store.set(key, value);
});

ipcMain.on('set-settings', (event, newSettings) => {
    store.set(newSettings);
});

ipcMain.on('dictation-state', (event, state) => {
    isDictating = state;
    updateTrayMenu();
});

// Audio Streaming IPC
ipcMain.on('start-stream', async (event, { sampleRate }) => {
    try {
        const settings = store.store;
        await speechService.initialize(settings);

        speechService.startStream(
            sampleRate,
            (text) => {
                if (mainWindow) mainWindow.webContents.send('transcript', text);
                insertTextIntoActiveApp(text + ' ');
            },
            (err) => {
                if (mainWindow) mainWindow.webContents.send('stream-error', err.message);
            }
        );
    } catch (err) {
        console.error('Main: Failed to start stream:', err);
        if (mainWindow) mainWindow.webContents.send('stream-error', err.message);
    }
});

ipcMain.on('audio-chunk', (event, buffer) => {
    speechService.writeAudio(buffer);
});

ipcMain.on('stop-stream', () => {
    speechService.stopStream();
});

ipcMain.on('insert-text', (event, text) => {
    // Insert text into active application
    insertTextIntoActiveApp(text);
});

ipcMain.on('log', (event, msg) => {
    console.log('[Renderer]', msg);
});

// Helper to insert text
function insertTextIntoActiveApp(text) {
    // Escape backslashes and double quotes for AppleScript
    const safeText = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

    // AppleScript to type text (simulates keyboard)
    // Using 'keystroke' is slower but safer. 
    // Using clipboard + paste is faster for long text.
    // Added delay to ensure clipboard is ready.

    const script = `
        set the clipboard to "${safeText}"
        delay 0.1
        tell application "System Events" to keystroke "v" using command down
    `;

    exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
        if (error) {
            console.error('Error pasting text:', error);
        }
    });
}

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
