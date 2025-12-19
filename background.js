// Background service worker for Gemini Dictate extension

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-dictation') {
    // Query the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Send message to content script to toggle dictation
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-dictation' }, (response) => {
          if (chrome.runtime.lastError) {
            // This is expected if the content script hasn't loaded yet or the tab is restricted
            // console.error('Error sending message:', chrome.runtime.lastError.message);
            console.log('Dictation toggle: Content script not ready or restricted page:', chrome.runtime.lastError.message);
          }
        });
      }
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-api-key') {
    // Retrieve API key from storage
    chrome.storage.sync.get(['geminiApiKey'], (result) => {
      sendResponse({ apiKey: result.geminiApiKey || null });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'log') {
    console.log('[Content Script]:', request.message);
  }

  // Proxy Gemini API requests through offscreen document
  if (request.action === 'gemini-transcribe' || request.action === 'chirp-transcribe') {
    console.log(`Background: Received ${request.action} request`);

    // Ensure offscreen document exists
    ensureOffscreenDocument().then(async (created) => {
      // If we just created the document, wait a bit for it to be ready
      if (created) {
        console.log('Background: Waiting for offscreen document to initialize...');
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      console.log('Background: Forwarding to offscreen document');
      const offscreenRequest = { ...request, action: `offscreen-${request.action}` };

      // Add a timeout for the offscreen response
      let responseSent = false;
      const timeoutId = setTimeout(() => {
        if (!responseSent) {
          responseSent = true;
          sendResponse({ success: false, error: 'Transcription request timed out (20s)' });
        }
      }, 20000);

      chrome.runtime.sendMessage(offscreenRequest, (response) => {
        if (responseSent) return;
        clearTimeout(timeoutId);
        responseSent = true;

        if (chrome.runtime.lastError) {
          console.error('Background: Error from offscreen message:', chrome.runtime.lastError.message);
          sendResponse({
            success: false,
            error: `Offscreen communication failed: ${chrome.runtime.lastError.message}`
          });
        } else if (!response) {
          console.error('Background: No response received from offscreen document');
          sendResponse({ success: false, error: 'No response from offscreen document' });
        } else {
          console.log('Background: Got response from offscreen:', response);
          sendResponse(response);
        }
      });
    }).catch(error => {
      console.error('Background: Failed to manage offscreen document:', error);
      sendResponse({ success: false, error: `Offscreen management error: ${error.message}` });
    });

    return true; // Keep message channel open
  }
});

// Ensure offscreen document is created
async function ensureOffscreenDocument() {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL('offscreen.html')]
  });

  if (existingContexts.length > 0) {
    return false; // Already exists
  }

  // Create offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['AUDIO_PLAYBACK'], // Using AUDIO_PLAYBACK as the reason
    justification: 'Making Gemini API calls for audio transcription'
  });

  console.log('Background: Created offscreen document');
  return true; // Just created
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});
