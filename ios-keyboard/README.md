# Gemini Dictate iOS Keyboard

This folder contains the source code for a custom iOS Keyboard Extension that uses Gemini 1.5 Flash for high-quality speech-to-text transcription.

## Features
- **Premium UI**: Sleek SwiftUI-based keyboard interface.
- **Microphone Integration**: Quick-toggle recording with visual feedback.
- **Gemini AI**: Professional-grade transcription with grammar correction and filler word removal.

## Setup Instructions

1. **Open Xcode**: Create a new iOS App project named `GeminiDictate`.
   - **Interface**: SwiftUI
   - **Language**: Swift
   - **Storage**: None (unless you want to add history later, then select SwiftData)
   - **Testing**: Swift Testing
2. **Add Keyboard Extension**: 
   - Go to `File > New > Target...`
   - Select `Custom Keyboard Extension`.
   - Name it `GeminiKeyboard`.
3. **Copy Source Files**:
   - Replace the contents of the `GeminiKeyboard` folder in Xcode with the files in `./ios-keyboard/GeminiKeyboard/`.
   - Replace the contents of the `GeminiDictate` app folder with the files in `./ios-keyboard/GeminiDictateApp/App/`.
4. **Configure Permissions**:
   - In the `GeminiKeyboard` target settings, under `Info`, ensure `RequestsOpenAccess` is set to `YES`.
   - Add the `NSMicrophoneUsageDescription` key to your main App's `Info.plist`.

5. **App Groups (Shared Recording Settings)**:
   - For the keyboard to read the API key you enter in the main app, you **must** set up an App Group.
   - Go to the **Signing & Capabilities** tab for BOTH the `GeminiDictate` app and the `GeminiKeyboard` targets.
   - Click **+ Capability** and add **App Groups**.
   - Create a new group (e.g., `group.com.yourcompany.GeminiDictate`).
   - Open `SettingsManager.swift` and update `appGroupId` with your new group ID.

## 🔑 API Key Management
The app no longer stores the API key in the code.
1. Launch the `GeminiDictate` app on your iPhone.
2. Enter your Gemini API key in the input field.
3. This key is saved to your device's memory and shared with the keyboard extension automatically.
