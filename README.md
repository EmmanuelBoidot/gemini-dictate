# 🎤 Gemini Dictate

A Chrome extension that enables speech-to-text transcription using Google's Gemini AI. Activate with a keyboard shortcut and dictate directly into any text input field on the web.

## Features

- ⌨️ **Keyboard Shortcut Activation**: Press `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac) to start dictating
- 🎯 **Smart Input Detection**: Only works when a text input field is focused
- 🔄 **Real-time Transcription**: Powered by Gemini 2.0 Flash for accurate speech recognition
- 👁️ **Visual Feedback**: Clear indicators when dictation is active
- 🛡️ **Privacy-Focused**: Your API key stays local, audio sent directly to Gemini
- 🎨 **Beautiful UI**: Modern, gradient-styled options page

## 🗂️ Project Versions

This repository contains two versions of Gemini Dictate:
1.  **Chrome Extension**: Works directly in your browser. Supports **built-in Chrome Speech-to-Text (No API key required)** or Gemini AI (Premium accuracy).
2.  **macOS Electron App**: A system-wide application that works in any Mac app (Notes, Slack, etc.). **Requires a Gemini API key.**

---

## 🔑 1. Setup Your Gemini API Key (Optional for Extension)

You can skip this part if you only want to use the built-in Chrome Speech-to-Text engine in the Chrome Extension. You only need an API key if you want to use the high-accuracy Gemini engine in the Chrome Extension, or if you are using the Electron App.

1.  **Create a Google Cloud Project**: Follow the [Google Cloud documentation](https://cloud.google.com/resource-manager/docs/creating-managing-projects) to create a new project.
2.  **Get your API Key**:
    *   **Recommended**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to generate a free API key.
    *   **Alternative**: Use the [Google Cloud Vertex AI documentation](https://cloud.google.com/vertex-ai/docs/generative-ai/start/quickstarts/api-key) for enterprise-grade setup.
3.  **Copy the key** for the next steps.

---

## 🌐 2. Chrome Extension

The Chrome extension can use your browser's built-in transcription engine immediately, or you can supply a Gemini key for significantly better results.

### Installation

1.  Download or clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **"Developer mode"** (toggle in the top-right corner).
4.  Click **"Load unpacked"**.
5.  Select the root folder of this repository (where `manifest.json` is located).
6.  **(Optional)** Click the extension icon in Chrome's toolbar, select **Options**, enter your Gemini API key, and select the **Gemini** engine.

### Usage

1.  **Focus**: Click into any text input field on a webpage.
2.  **Activate**: Press `Cmd+Shift+S` (Mac) or `Ctrl+Shift+S` (Windows).
3.  **Dictate**: Speak clearly. A visual indicator will appear.
4.  **Stop**: Press the shortcut again or click away.

---

## 💻 3. macOS Electron App

A native application for system-wide dictation. **Note: This version requires a Gemini API key.**

### Installation

1.  Ensure you have [Node.js](https://nodejs.org/) installed.
2.  Open your terminal and navigate to the `electron-app` directory:
    ```bash
    cd electron-app
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```

### Usage

1.  **Start the app**:
    ```bash
    npm run start
    ```
2.  **Configure**: On first launch, enter your Gemini API key in the Settings window.
3.  **Key Bindings**: Use `Command+Shift+S` (default) while focused on any application.

### Building & Packaging

To create a standalone `.app` bundle:
```bash
npm run make
```

---

## 🛠️ Development & Troubleshooting

### Project Structure
- `/`: Root directory contains the Chrome Extension files.
- `/electron-app`: Contains the native macOS application.

### Troubleshooting
- **Microphone Access**: Ensure Chrome or the Electron app has permission to access your microphone in System Settings.
- **Engine Selection**: If you haven't provided an API key in the extension settings, it will fallback to the default Chrome Web Speech engine.
- **API Errors**: Use the "Test Connection" button in the Settings page to verify your key if using Gemini/Chirp.

## 📄 License
MIT License - feel free to use, modify, and distribute!

---
**Made with ❤️ using Gemini AI**
