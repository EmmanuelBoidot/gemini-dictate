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
5. **Add API Key**:
   - Open `GeminiClient.swift` and replace `YOUR_GEMINI_API_KEY` with your actual Gemini API key.

## Important Note
For the microphone to work in a Keyboard Extension:
- You **must** enable "Allow Full Access" in the iOS Keyboard Settings for this keyboard.
- The containing app must also have microphone permissions.
