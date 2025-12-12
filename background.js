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
            console.error('Error sending message:', chrome.runtime.lastError.message);
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
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  }
});
