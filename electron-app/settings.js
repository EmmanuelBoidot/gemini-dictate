const { ipcRenderer } = require('electron');

// Elements
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');

const engineGeminiRadio = document.getElementById('engineGemini');
const engineChirpRadio = document.getElementById('engineChirp');
const chirpSettings = document.getElementById('chirpSettings');

const chirpProjectIdInput = document.getElementById('chirpProjectId');
const chirpRegionSelect = document.getElementById('chirpRegion');
const chirpRecognizerIdInput = document.getElementById('chirpRecognizerId');
const chirpApiKeyInput = document.getElementById('chirpApiKey');

const serviceAccountFile = document.getElementById('serviceAccountFile');
const serviceAccountStatus = document.getElementById('serviceAccountStatus');

// Load settings
async function loadSettings() {
    console.log('Settings: Loading settings via IPC...');
    try {
        const settings = await ipcRenderer.invoke('get-settings');
        console.log('Settings received:', settings);

        apiKeyInput.value = settings.geminiApiKey || '';

        const engine = settings.speechEngine || 'gemini';
        console.log('Settings: Engine preference:', engine);

        if (engine === 'gemini') engineGeminiRadio.checked = true;
        if (engine === 'chirp') {
            engineChirpRadio.checked = true;
            chirpSettings.style.display = 'block';
        }

        chirpProjectIdInput.value = settings.chirpProjectId || '';
        chirpRegionSelect.value = settings.chirpRegion || 'global';
        chirpRecognizerIdInput.value = settings.chirpRecognizerId || '_';
        chirpApiKeyInput.value = settings.chirpApiKey || '';

        const authMethod = settings.chirpAuthMethod || 'apiKey';
        document.querySelector(`input[name="chirpAuthMethod"][value="${authMethod}"]`).checked = true;
        toggleAuthSections(authMethod);

        const creds = settings.serviceAccountCreds;
        if (creds && creds.client_email) {
            serviceAccountStatus.textContent = `✅ Loaded: ${creds.client_email}`;
            serviceAccountStatus.style.color = 'green';
        }
    } catch (err) {
        console.error('Settings: Error loading settings:', err);
        showStatus('Error loading settings: ' + err.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
});

// Save settings
saveBtn.addEventListener('click', () => {
    console.log('Settings: Save button clicked');

    try {
        const engine = document.querySelector('input[name="engine"]:checked').value;
        const authMethod = document.querySelector('input[name="chirpAuthMethod"]:checked').value;

        const newSettings = {
            geminiApiKey: apiKeyInput.value.trim(),
            speechEngine: engine,
            chirpProjectId: chirpProjectIdInput.value.trim(),
            chirpRegion: chirpRegionSelect.value,
            chirpRecognizerId: chirpRecognizerIdInput.value.trim(),
            chirpApiKey: chirpApiKeyInput.value.trim(),
            chirpAuthMethod: authMethod
        };

        ipcRenderer.send('set-settings', newSettings);

        console.log('Settings: Saved successfully via IPC');
        showStatus('Settings saved!', 'success');
    } catch (err) {
        console.error('Settings: Error saving settings:', err);
        showStatus('Error saving: ' + err.message, 'error');
    }
});

// Engine toggle
document.querySelectorAll('input[name="engine"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'chirp') {
            chirpSettings.style.display = 'block';
        } else {
            chirpSettings.style.display = 'none';
        }
    });
});

// Auth method toggle
document.querySelectorAll('input[name="chirpAuthMethod"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        toggleAuthSections(e.target.value);
    });
});

function toggleAuthSections(method) {
    const apiKeySection = document.getElementById('chirpApiKeySection');
    const serviceAccountSection = document.getElementById('chirpServiceAccountSection');

    if (method === 'serviceAccount') {
        apiKeySection.style.display = 'none';
        serviceAccountSection.style.display = 'block';
    } else {
        apiKeySection.style.display = 'block';
        serviceAccountSection.style.display = 'none';
    }
}

// Service Account File
serviceAccountFile.addEventListener('change', (e) => {
    console.log('Settings: File input changed');
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            console.log('Settings: File read complete');
            const json = JSON.parse(event.target.result);
            if (!json.client_email || !json.private_key) {
                throw new Error('Invalid JSON: Missing client_email or private_key');
            }

            // Send to main process to save
            ipcRenderer.send('set-setting', 'serviceAccountCreds', {
                client_email: json.client_email,
                private_key: json.private_key
            });

            serviceAccountStatus.textContent = `✅ Loaded: ${json.client_email}`;
            serviceAccountStatus.style.color = 'green';

            if (!chirpProjectIdInput.value && json.project_id) {
                chirpProjectIdInput.value = json.project_id;
            }
            console.log('Settings: Service account loaded and sent to main');
        } catch (error) {
            console.error('Settings: Error parsing JSON:', error);
            serviceAccountStatus.textContent = 'Error: ' + error.message;
            serviceAccountStatus.style.color = 'red';
        }
    };
    reader.readAsText(file);
});

function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
    setTimeout(() => statusDiv.classList.add('hidden'), 3000);
}
