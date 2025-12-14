// Options page script for Gemini Dictate extension
const { ipcRenderer } = require('electron');

const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusDiv = document.getElementById('status');

// Engine selection elements
const engineGeminiRadio = document.getElementById('engineGemini');
const engineChirpRadio = document.getElementById('engineChirp');
const geminiOption = document.getElementById('geminiOption');
const chirpOption = document.getElementById('chirpOption');
const geminiDisabledNote = document.getElementById('geminiDisabledNote');

// Chirp settings elements
const chirpSettings = document.getElementById('chirpSettings');
const chirpProjectIdInput = document.getElementById('chirpProjectId');
const chirpRegionSelect = document.getElementById('chirpRegion');
const chirpRecognizerIdInput = document.getElementById('chirpRecognizerId');
const chirpApiKeyInput = document.getElementById('chirpApiKey');

// Service Account elements
const serviceAccountFile = document.getElementById('serviceAccountFile');
const serviceAccountStatus = document.getElementById('serviceAccountStatus');

// Load saved settings on page load
document.addEventListener('DOMContentLoaded', async () => {
    const result = await ipcRenderer.invoke('get-settings');

    // Load Gemini API key
    if (result.geminiApiKey) {
        apiKeyInput.value = result.geminiApiKey;
        enableGeminiOption();
    } else {
        disableGeminiOption();
    }

    // Load Chirp settings
    if (result.chirpProjectId) chirpProjectIdInput.value = result.chirpProjectId;
    if (result.chirpRegion) chirpRegionSelect.value = result.chirpRegion;
    if (result.chirpRecognizerId) chirpRecognizerIdInput.value = result.chirpRecognizerId;
    if (result.chirpApiKey) chirpApiKeyInput.value = result.chirpApiKey;

    // Load Chirp auth method
    const chirpAuthMethod = result.chirpAuthMethod || 'apiKey';
    const authRadio = document.querySelector(`input[name="chirpAuthMethod"][value="${chirpAuthMethod}"]`);
    if (authRadio) authRadio.checked = true;
    toggleAuthSections(chirpAuthMethod);

    // Load Service Account credentials status
    if (result.serviceAccountCreds && result.serviceAccountCreds.client_email) {
        serviceAccountStatus.textContent = `✅ Loaded: ${result.serviceAccountCreds.client_email}`;
        serviceAccountStatus.style.color = 'green';
    } else {
        serviceAccountStatus.textContent = 'No Service Account file loaded.';
        serviceAccountStatus.style.color = 'gray';
    }

    // Load engine preference
    const engine = result.speechEngine || 'chrome';
    if (engine === 'gemini' && result.geminiApiKey) {
        engineGeminiRadio.checked = true;
    } else if (engine === 'chirp') {
        engineChirpRadio.checked = true;
        chirpSettings.style.display = 'block';
    } else { // Default to Chrome if no preference or Gemini key is missing
        document.querySelector('input[value="chrome"]').checked = true;
    }
});

// Save settings
saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const chirpProjectId = chirpProjectIdInput.value.trim();
    const chirpRegion = chirpRegionSelect.value;
    const chirpRecognizerId = chirpRecognizerIdInput.value.trim();
    const chirpApiKey = chirpApiKeyInput.value.trim();
    const chirpAuthMethod = document.querySelector('input[name="chirpAuthMethod"]:checked').value;

    if (!apiKey && !chirpApiKey && chirpAuthMethod === 'apiKey') {
        showStatus('Please enter at least one API key (Gemini or Chirp)', 'error');
        return;
    }

    // Validate Gemini API key format (basic check) if provided
    if (apiKey && !apiKey.startsWith('AIza')) {
        showStatus('Invalid Gemini API key format. Gemini API keys typically start with "AIza"', 'error');
        return;
    }

    // Save to Electron Store via IPC
    const settings = {
        geminiApiKey: apiKey,
        chirpProjectId: chirpProjectId,
        chirpRegion: chirpRegion,
        chirpRecognizerId: chirpRecognizerId,
        chirpApiKey: chirpApiKey,
        chirpAuthMethod: chirpAuthMethod
    };

    // We also need to get the current engine selection to save it, 
    // or rely on the radio button listener. 
    // But let's save everything here to be safe.
    const selectedEngine = document.querySelector('input[name="engine"]:checked').value;
    settings.speechEngine = selectedEngine;

    ipcRenderer.send('set-settings', settings);

    showStatus('Settings saved successfully!', 'success');

    // Update Gemini option state
    if (apiKey) {
        enableGeminiOption();
    } else {
        disableGeminiOption();
    }
});

// Handle Service Account File Upload
serviceAccountFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target.result);
            if (!json.client_email || !json.private_key) {
                throw new Error('Invalid Service Account JSON. Missing client_email or private_key.');
            }

            // Store sensitive credentials via IPC
            const creds = {
                client_email: json.client_email,
                private_key: json.private_key,
                project_id: json.project_id
            };

            ipcRenderer.send('set-setting', 'serviceAccountCreds', creds);

            serviceAccountStatus.textContent = `✅ Loaded: ${json.client_email}`;
            serviceAccountStatus.style.color = 'green';

            // Auto-fill Project ID if empty
            if (!chirpProjectIdInput.value && json.project_id) {
                chirpProjectIdInput.value = json.project_id;
            }

        } catch (error) {
            console.error('Error parsing JSON:', error);
            serviceAccountStatus.textContent = '❌ Error: ' + error.message;
            serviceAccountStatus.style.color = 'red';
        }
    };
    reader.readAsText(file);
});

// Handle Auth Method Toggle
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

// Handle engine selection changes
document.querySelectorAll('input[name="engine"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const engine = e.target.value;
        ipcRenderer.send('set-setting', 'speechEngine', engine);

        // Show/hide Chirp settings
        if (engine === 'chirp') {
            chirpSettings.style.display = 'block';
        } else {
            chirpSettings.style.display = 'none';
        }
    });
});

function enableGeminiOption() {
    geminiOption.classList.remove('disabled');
    engineGeminiRadio.disabled = false;
    geminiDisabledNote.style.display = 'none';
}

function disableGeminiOption() {
    geminiOption.classList.add('disabled');
    engineGeminiRadio.disabled = true;
    if (engineGeminiRadio.checked) {
        // Fallback if current selection becomes disabled
        document.querySelector('input[value="chrome"]').checked = true;
        ipcRenderer.send('set-setting', 'speechEngine', 'chrome');
    }
    geminiDisabledNote.style.display = 'block';
}

// Test API connection
testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showStatus('Please enter an API key first', 'error');
        return;
    }

    showStatus('Testing connection...', 'info');

    try {
        const geminiClient = new GeminiClient(apiKey);
        await geminiClient.testConnection();
        showStatus('✓ Connection successful! API key is valid.', 'success');
    } catch (error) {
        showStatus('✗ Connection failed: ' + error.message, 'error');
        console.error('Full error:', error);
    }
});

// Show status message
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');

    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }
}

// Allow Enter key to save
apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveBtn.click();
    }
});
