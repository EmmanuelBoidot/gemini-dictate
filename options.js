// Options page script for Gemini Dictate extension

const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const statusDiv = document.getElementById('status');

// Load saved API key on page load
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
    });
});

// Save API key
saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showStatus('Please enter an API key', 'error');
        return;
    }

    // Validate API key format (basic check)
    if (!apiKey.startsWith('AIza')) {
        showStatus('Invalid API key format. Gemini API keys typically start with "AIza"', 'error');
        return;
    }

    // Save to Chrome storage
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
        showStatus('API key saved successfully!', 'success');
    });
});

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
