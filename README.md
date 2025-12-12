# 🎤 Gemini Dictate

A Chrome extension that enables speech-to-text transcription using Google's Gemini AI. Activate with a keyboard shortcut and dictate directly into any text input field on the web.

## Features

- ⌨️ **Keyboard Shortcut Activation**: Press `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac) to start dictating
- 🎯 **Smart Input Detection**: Only works when a text input field is focused
- 🔄 **Real-time Transcription**: Powered by Gemini 2.0 Flash for accurate speech recognition
- 👁️ **Visual Feedback**: Clear indicators when dictation is active
- 🛡️ **Privacy-Focused**: Your API key stays local, audio sent directly to Gemini
- 🎨 **Beautiful UI**: Modern, gradient-styled options page

## Installation

### 1. Get a Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key for later use

### 2. Install the Extension

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `gemini-dictate` folder
6. The extension is now installed!

### 3. Configure Your API Key

1. Click the extension icon in Chrome's toolbar
2. Click "Options" or right-click and select "Options"
3. Enter your Gemini API key
4. Click "Save API Key"
5. Optionally, click "Test Connection" to verify it works

## Usage

1. **Focus on a text input**: Click on any text field, textarea, or contenteditable element
2. **Activate dictation**: Press `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac)
3. **Start speaking**: You'll see a visual indicator that dictation is active
4. **Watch the magic**: Your words will appear in the text field in real-time
5. **Stop dictation**: Click away from the input, switch tabs, or press the shortcut again

### Supported Input Types

- Standard text inputs (`<input type="text">`)
- Textareas (`<textarea>`)
- Contenteditable elements
- Search boxes, email fields, URL fields, etc.

### Customizing the Keyboard Shortcut

1. Navigate to `chrome://extensions/shortcuts`
2. Find "Gemini Dictate"
3. Click the pencil icon next to "Toggle speech-to-text dictation"
4. Press your desired key combination
5. Click "OK"

## How It Works

1. **Keyboard Shortcut**: The background service worker listens for your keyboard shortcut
2. **Input Detection**: The content script checks if a text input is focused
3. **Audio Capture**: Your microphone captures audio using the Web Audio API
4. **Gemini Processing**: Audio is sent to Gemini 2.0 Flash for transcription
5. **Text Insertion**: Transcribed text is inserted into the focused input field
6. **Auto-Stop**: Dictation stops when you click away or switch tabs

## Privacy & Permissions

### Required Permissions

- **Microphone**: To capture your voice for transcription
- **Active Tab**: To interact with text inputs on the current page
- **Storage**: To save your API key locally
- **Host Permissions**: To communicate with Google's Gemini API

### Privacy Guarantee

- ✅ Your API key is stored locally in Chrome's sync storage
- ✅ Audio is sent directly to Google's Gemini API (not stored by this extension)
- ✅ No data is logged, tracked, or sent to third parties
- ✅ Open source - you can review all the code

## Troubleshooting

### Extension doesn't activate

- Make sure a text input is focused before pressing the shortcut
- Check that you've configured your API key in the options page
- Verify microphone permissions are granted

### No transcription appears

- Test your API key using the "Test Connection" button in options
- Check your internet connection
- Ensure your microphone is working (test in another app)
- Check the browser console for error messages

### Microphone access denied

- Click the microphone icon in Chrome's address bar
- Select "Always allow" for this extension
- Reload the page and try again

### Poor transcription quality

- Speak clearly and at a moderate pace
- Reduce background noise
- Check your microphone quality and positioning
- Ensure you have a stable internet connection

## Development

### Project Structure

```
gemini-dictate/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (keyboard shortcuts)
├── content.js            # Content script (input detection, audio capture)
├── gemini-client.js      # Gemini API integration
├── options.html          # Settings page
├── options.js            # Settings page logic
├── styles.css            # Styling for options page
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

### Technologies Used

- **Chrome Extension Manifest V3**: Latest extension platform
- **Web Audio API**: For capturing and processing audio
- **Gemini 2.0 Flash**: Google's multimodal AI model
- **Chrome Storage API**: For secure local storage
- **Modern JavaScript**: ES6+ features

### Building from Source

No build process required! This is a pure JavaScript extension. Just load it unpacked in Chrome.

## Known Limitations

- Requires active internet connection for transcription
- Transcription accuracy depends on Gemini API performance
- May not work on all websites due to CSP restrictions
- Audio processing can be CPU-intensive on older devices

## Future Enhancements

- [ ] Support for multiple languages
- [ ] Offline transcription using Web Speech API as fallback
- [ ] Custom voice commands (e.g., "new line", "delete that")
- [ ] Transcription history
- [ ] Adjustable audio quality settings
- [ ] Support for Firefox and other browsers

## License

MIT License - feel free to use, modify, and distribute!

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Support

If you encounter any issues or have questions:

1. Check the Troubleshooting section above
2. Review the browser console for error messages
3. Open an issue on GitHub with details about your problem

---

**Made with ❤️ using Gemini AI**
