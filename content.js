// Content script for Gemini Dictate extension
// Handles text input detection, audio capture, and transcription insertion

let isActive = false;
let currentInput = null;
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
        return;
    }

    currentInput = activeElement;

    // Check if browser supports Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('Speech recognition is not supported in this browser. Please use Chrome.');
        return;
    }

    try {
        // Create speech recognition instance
        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening
        recognition.interimResults = true; // Get partial results
        recognition.lang = 'en-US'; // Language

        isActive = true;

        // Store recognition instance and input reference for cleanup
        window.currentRecognition = recognition;
        window.dictationTarget = currentInput; // Store separately so it persists

        // Add visual indicator
        addVisualIndicator();

        // Track the last interim text we inserted so we can replace it
        let lastInterimLength = 0;

        // Handle results
        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            if (window.dictationTarget) {
                // If we have a final transcript, insert it permanently
                if (finalTranscript) {
                    // Remove any interim text first
                    if (lastInterimLength > 0) {
                        removeLastChars(window.dictationTarget, lastInterimLength);
                        lastInterimLength = 0;
                    }
                    // Insert final text
                    insertTextToTarget(window.dictationTarget, finalTranscript);
                }
                // If we have interim text, show it (but it will be replaced)
                else if (interimTranscript) {
                    // Remove previous interim text
                    if (lastInterimLength > 0) {
                        removeLastChars(window.dictationTarget, lastInterimLength);
                    }
                    // Insert new interim text
                    insertTextToTarget(window.dictationTarget, interimTranscript);
                    lastInterimLength = interimTranscript.length;
                }
            }
        };

        // Handle speech start
        recognition.onspeechstart = () => { };

        // Handle speech end
        recognition.onspeechend = () => { };

        // Handle audio start
        recognition.onaudiostart = () => { };

        // Handle audio end
        recognition.onaudioend = () => { };

        // Handle sound start
        recognition.onsoundstart = () => { };

        // Handle sound end
        recognition.onsoundend = () => { };

        // Handle errors
        recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                return;
            }
            if (event.error === 'not-allowed') {
                alert('Microphone access denied. Please allow microphone access and try again.');
                stopDictation();
            }
        };

        // Handle end (restart if still active)
        recognition.onend = () => {
            if (isActive) {
                try {
                    recognition.start();
                } catch (e) {
                    // Already started, ignore
                }
            }
        };

        // Start recognition
        recognition.start();

        // Monitor for focus loss
        setupFocusMonitoring();

        // Log success (ignore errors if background script isn't ready)
        try {
            chrome.runtime.sendMessage({ action: 'log', message: 'Dictation started (Chrome Web Speech)' }).catch(() => { });
        } catch (e) {
            // Ignore messaging errors
        }
    } catch (error) {
        console.error('Error starting dictation:', error);
        alert('Could not start speech recognition. Please try again.');
        stopDictation();
    }
}

/**
 * Start Gemini-based dictation
 */
async function startGeminiDictation(apiKey) {
    console.log('[Gemini Dictate] Initializing Gemini-based dictation...');
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('[Gemini Dictate] Microphone access granted for Gemini.');

        isActive = true;
        window.dictationTarget = currentInput;

        // Add visual indicator
        addVisualIndicator();

        // Create Gemini client
        const geminiClient = new GeminiClient(apiKey);
        console.log('[Gemini Dictate] GeminiClient initialized.');

        // Start streaming audio to Gemini
        const controller = await geminiClient.streamAudio(
            stream,
            // onTranscript callback
            (text) => {
                if (window.dictationTarget && text) {
                    console.log('[Gemini Dictate] Gemini - Transcript received:', text);
                    insertTextToTarget(window.dictationTarget, text + ' ');
                }
            },
            // onError callback
            (error) => {
                console.error('[Gemini Dictate] Gemini transcription error:', error);
                // Don't stop on errors, just log them
            },
            // onProcessing callback
            () => {
                window.updateIndicatorText?.('Processing...');
                setTimeout(() => {
                    window.updateIndicatorText?.('Listening...');
                }, 500);
            }
        );

        // Store controller for cleanup
        window.geminiController = controller;

        // Monitor for focus loss
        setupFocusMonitoring();

        // Log success (ignore errors if background script isn't ready)
        try {
            chrome.runtime.sendMessage({ action: 'log', message: 'Dictation started (Gemini AI)' }).catch(() => { });
        } catch (e) {
            // Ignore messaging errors
        }
    } catch (error) {
        console.error('Error starting Gemini dictation:', error);

        if (error.name === 'NotAllowedError') {
            alert('Microphone access denied. Please allow microphone access and try again.');
        } else {
            alert('Could not start Gemini transcription. Falling back to Chrome Web Speech API.');
            // Fallback to Chrome Web Speech
            await startChromeWebSpeech();
        }

        stopDictation();
    }
}

/**
 * Stop dictation
 */
function stopDictation() {
    isActive = false;

    // Stop speech recognition (Chrome Web Speech)
    if (window.currentRecognition) {
        window.currentRecognition.stop();
        window.currentRecognition = null;
    }

    // Stop Gemini controller
    if (window.geminiController) {
        window.geminiController.stop();
        window.geminiController = null;
    }

    // Clear target reference after a delay to allow final transcripts to arrive
    setTimeout(() => {
        window.dictationTarget = null;
    }, 2000);

    // Remove visual indicator
    removeVisualIndicator();

    // Clear current input reference
    currentInput = null;

    // Log stop (ignore errors if background script isn't ready)
    try {
        chrome.runtime.sendMessage({ action: 'log', message: 'Dictation stopped' }).catch(() => { });
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
 * Remove the last N characters from target element
 */
function removeLastChars(target, count) {
    if (!target || count <= 0) return;

    const tagName = target.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
        const currentValue = target.value || '';
        target.value = currentValue.substring(0, currentValue.length - count);
    } else if (target.contentEditable === 'true') {
        const textContent = target.textContent || '';
        target.textContent = textContent.substring(0, textContent.length - count);
    }
}

/**
 * Insert text into a specific target element (bypasses isActive check)
 */
function insertTextToTarget(target, text) {
    if (!target) return;

    const tagName = target.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
        // For input and textarea elements
        const start = target.selectionStart || 0;
        const end = target.selectionEnd || 0;
        const currentValue = target.value || '';

        // Insert text at cursor position
        const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
        target.value = newValue;

        // Move cursor to end of inserted text
        const newCursorPos = start + text.length;
        target.setSelectionRange(newCursorPos, newCursorPos);

        // Trigger events
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (target.contentEditable === 'true') {
        // For contenteditable elements
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();

            const textNode = document.createTextNode(text);
            range.insertNode(textNode);

            // Move cursor to end of inserted text
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger input event
            target.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

/**
 * Insert text into the current input
 */
function insertText(text) {
    console.log('insertText called with:', text);
    console.log('currentInput:', currentInput);
    console.log('isActive:', isActive);

    if (!currentInput || !isActive) {
        console.log('Skipping insert - no input or not active');
        return;
    }

    const tagName = currentInput.tagName.toLowerCase();
    console.log('Input tag name:', tagName);

    if (tagName === 'input' || tagName === 'textarea') {
        // For input and textarea elements
        const start = currentInput.selectionStart;
        const end = currentInput.selectionEnd;
        const currentValue = currentInput.value;

        console.log('Current value:', currentValue);
        console.log('Selection:', start, '-', end);

        // Insert text at cursor position
        const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
        currentInput.value = newValue;

        console.log('New value:', newValue);

        // Move cursor to end of inserted text
        const newCursorPos = start + text.length;
        currentInput.setSelectionRange(newCursorPos, newCursorPos);

        // Trigger input event for frameworks that listen to it
        currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        currentInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (currentInput.contentEditable === 'true') {
        // For contenteditable elements
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();

            const textNode = document.createTextNode(text);
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
    // Monitor focus loss - only stop if focus moves to a different element
    const focusHandler = (e) => {
        if (isActive && currentInput && e.target !== currentInput && !currentInput.contains(e.target)) {
            stopDictation();
        }
    };

    // Monitor blur on current input - no delay needed since we use dictationTarget
    const blurHandler = () => {
        if (isActive && currentInput) {
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
