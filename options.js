// Options page script for Gemini Dictate extension

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
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get([
        'geminiApiKey',
        'speechEngine',
        'chirpProjectId',
        'chirpRegion',
        'chirpRecognizerId',
        'chirpApiKey',
        'chirpAuthMethod'
    ], (result) => {
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

        // Load engine preference
        const engine = result.speechEngine || 'chrome';
        if (engine === 'gemini' && result.geminiApiKey) {
            engineGeminiRadio.checked = true;
        } else if (engine === 'chirp') {
            engineChirpRadio.checked = true;
            chirpSettings.style.display = 'block';
        } else { // Default to Chrome
            const chromeRadio = document.querySelector('input[value="chrome"]');
            if (chromeRadio) chromeRadio.checked = true;
        }
    });
});

// Save settings
saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    const chirpProjectId = chirpProjectIdInput.value.trim();
    const chirpRegion = chirpRegionSelect.value;
    const chirpRecognizerId = chirpRecognizerIdInput.value.trim();
    const chirpApiKey = chirpApiKeyInput.value.trim();
    const chirpAuthMethod = document.querySelector('input[name="chirpAuthMethod"]:checked').value;
    const selectedEngine = document.querySelector('input[name="engine"]:checked').value;

    if (selectedEngine === 'gemini' && !apiKey) {
        showStatus('Please enter a Gemini API key to use the Gemini engine.', 'error');
        return;
    }

    // Validate Gemini API key format
    if (apiKey && !apiKey.startsWith('AIza')) {
        showStatus('Invalid Gemini API key format (should start with "AIza")', 'error');
        return;
    }

    const settings = {
        geminiApiKey: apiKey,
        speechEngine: selectedEngine,
        chirpProjectId: chirpProjectId,
        chirpRegion: chirpRegion,
        chirpRecognizerId: chirpRecognizerId,
        chirpApiKey: chirpApiKey,
        chirpAuthMethod: chirpAuthMethod
    };

    chrome.storage.sync.set(settings, () => {
        showStatus('Settings saved successfully!', 'success');

        // Update UI state
        if (apiKey) {
            enableGeminiOption();
        } else {
            disableGeminiOption();
        }
    });
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

            // Store sensitive credentials
            const creds = {
                client_email: json.client_email,
                private_key: json.private_key,
                project_id: json.project_id
            };

            chrome.storage.sync.set({ serviceAccountCreds: creds });

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
        chrome.storage.sync.set({ speechEngine: engine });

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
    // Fallback if current selection becomes disabled
    const chromeRadio = document.querySelector('input[value="chrome"]');
    if (chromeRadio) chromeRadio.checked = true;
    chrome.storage.sync.set({ speechEngine: 'chrome' });
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
