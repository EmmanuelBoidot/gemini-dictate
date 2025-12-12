// Content script for Gemini Dictate extension
// Handles text input detection, audio capture, and transcription insertion

let isActive = false;
let currentInput = null;
let audioStream = null;
let geminiController = null;
let visualIndicator = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle-dictation') {
        toggleDictation();
        sendResponse({ success: true });
    }
    return true;
});

/**
 * Toggle dictation on/off
 */
async function toggleDictation() {
    if (isActive) {
        stopDictation();
    } else {
        await startDictation();
    }
}

/**
 * Start dictation
 */
async function startDictation() {
    // Check if a text input is focused
    const activeElement = document.activeElement;

    if (!isTextInput(activeElement)) {
        console.log('No text input focused');
        return;
    }

    currentInput = activeElement;

    // Get API key from storage (with retry for when extension just reloaded)
    let apiKey;
    let retries = 3;
    while (retries > 0) {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get-api-key' });
            apiKey = response?.apiKey;
            break; // Success, exit loop
        } catch (error) {
            retries--;
            if (retries === 0) {
                console.error('Error getting API key:', error);
                alert('Extension error: Please wait a moment and try again, or reload the extension.');
                return;
            }
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    if (!apiKey) {
        alert('Please set your Gemini API key in the extension options.');
        return;
    }

    try {
        // Request microphone access
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true,
            }
        });

        isActive = true;

        // Add visual indicator
        addVisualIndicator();

        // Set up Gemini client
        const geminiClient = new GeminiClient(apiKey);

        // Start streaming audio to Gemini
        geminiController = await geminiClient.streamAudio(
            audioStream,
            (text) => {
                // Update indicator
                if (window.updateIndicatorText) {
                    window.updateIndicatorText('Listening...');
                }
                // Insert transcribed text into input
                insertText(text);
            },
            (error) => {
                console.error('Transcription error:', error);
                stopDictation();
                alert('Transcription error: ' + error.message);
            },
            // Add callback for when processing starts
            () => {
                if (window.updateIndicatorText) {
                    window.updateIndicatorText('Processing...');
                }
            }
        );

        // Monitor for focus loss
        setupFocusMonitoring();

        // Log success (ignore errors if background script isn't ready)
        try {
            chrome.runtime.sendMessage({ action: 'log', message: 'Dictation started' });
        } catch (e) {
            // Ignore messaging errors
        }
    } catch (error) {
        console.error('Error starting dictation:', error);
        alert('Could not access microphone. Please grant permission and try again.');
        stopDictation();
    }
}

/**
 * Stop dictation
 */
function stopDictation() {
    isActive = false;

    // Stop audio stream
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
    }

    // Stop Gemini streaming
    if (geminiController) {
        geminiController.stop();
        geminiController = null;
    }

    // Remove visual indicator
    removeVisualIndicator();

    // Clear current input reference
    currentInput = null;

    // Log stop (ignore errors if background script isn't ready)
    try {
        chrome.runtime.sendMessage({ action: 'log', message: 'Dictation stopped' });
    } catch (e) {
        // Ignore messaging errors
    }
}

/**
 * Check if element is a text input
 */
function isTextInput(element) {
    if (!element) return false;

    const tagName = element.tagName.toLowerCase();

    // Check for input elements
    if (tagName === 'input') {
        const type = element.type.toLowerCase();
        return ['text', 'search', 'email', 'url', 'tel', 'password'].includes(type);
    }

    // Check for textarea
    if (tagName === 'textarea') {
        return true;
    }

    // Check for contenteditable
    if (element.contentEditable === 'true') {
        return true;
    }

    return false;
}

/**
 * Insert text into the current input
 */
function insertText(text) {
    if (!currentInput || !isActive) return;

    const tagName = currentInput.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
        // For input and textarea elements
        const start = currentInput.selectionStart;
        const end = currentInput.selectionEnd;
        const currentValue = currentInput.value;

        // Insert text at cursor position
        const newValue = currentValue.substring(0, start) + ' ' + text + currentValue.substring(end);
        currentInput.value = newValue;

        // Move cursor to end of inserted text
        const newCursorPos = start + text.length + 1;
        currentInput.setSelectionRange(newCursorPos, newCursorPos);

        // Trigger input event for frameworks that listen to it
        currentInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (currentInput.contentEditable === 'true') {
        // For contenteditable elements
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();

            const textNode = document.createTextNode(' ' + text);
            range.insertNode(textNode);

            // Move cursor to end of inserted text
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger input event
            currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

/**
 * Add visual indicator that dictation is active
 */
function addVisualIndicator() {
    if (!currentInput) return;

    // Add border highlight to input
    currentInput.style.outline = '3px solid #4285f4';
    currentInput.style.outlineOffset = '2px';

    // Create floating indicator
    visualIndicator = document.createElement('div');
    visualIndicator.id = 'gemini-dictate-indicator';
    visualIndicator.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 25px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: pulse 2s infinite;
    ">
      <span style="
        width: 8px;
        height: 8px;
        background: #ff4444;
        border-radius: 50%;
        animation: blink 1s infinite;
      "></span>
      <span id="indicator-text">Listening...</span>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
    </style>
  `;
    document.body.appendChild(visualIndicator);
}

// Helper to update indicator text
window.updateIndicatorText = function (text) {
    const indicatorText = document.getElementById('indicator-text');
    if (indicatorText) {
        indicatorText.textContent = text;
    }
};

/**
 * Remove visual indicator
 */
function removeVisualIndicator() {
    if (currentInput) {
        currentInput.style.outline = '';
        currentInput.style.outlineOffset = '';
    }

    if (visualIndicator) {
        visualIndicator.remove();
        visualIndicator = null;
    }
}

/**
 * Set up monitoring for focus loss, tab changes, etc.
 */
function setupFocusMonitoring() {
    // Monitor focus loss
    const focusHandler = (e) => {
        if (isActive && !currentInput.contains(e.target) && e.target !== currentInput) {
            stopDictation();
        }
    };

    // Monitor blur on current input
    const blurHandler = () => {
        if (isActive) {
            stopDictation();
        }
    };

    // Monitor visibility change (tab switch)
    const visibilityHandler = () => {
        if (document.hidden && isActive) {
            stopDictation();
        }
    };

    document.addEventListener('focusin', focusHandler);
    currentInput?.addEventListener('blur', blurHandler);
    document.addEventListener('visibilitychange', visibilityHandler);

    // Store handlers for cleanup
    if (!window.geminiDictateHandlers) {
        window.geminiDictateHandlers = [];
    }

    window.geminiDictateHandlers.push({
        type: 'focusin',
        handler: focusHandler,
        target: document
    });

    window.geminiDictateHandlers.push({
        type: 'blur',
        handler: blurHandler,
        target: currentInput
    });

    window.geminiDictateHandlers.push({
        type: 'visibilitychange',
        handler: visibilityHandler,
        target: document
    });
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (isActive) {
        stopDictation();
    }
});
