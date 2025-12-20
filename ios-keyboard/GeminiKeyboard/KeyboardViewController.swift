import UIKit
import SwiftUI

class KeyboardViewController: UIInputViewController {
    private var keyboardView: KeyboardView?
    private let recorder = AudioRecorder()
    private let geminiClient = GeminiClient(apiKey: "YOUR_GEMINI_API_KEY") // TODO: Replace with your actual key
    private var isRecording = false

    override func updateViewConstraints() {
        super.updateViewConstraints()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupSwiftUI()
    }

    private func setupSwiftUI() {
        let keyboardView = KeyboardView(
            onRecordToggle: { [weak self] in
                self?.handleRecordToggle()
            },
            onKeyTap: { [weak self] char in
                self?.textDocumentProxy.insertText(char)
            },
            onDelete: { [weak self] in
                self?.textDocumentProxy.deleteBackward()
            },
            onSpace: { [weak self] in
                self?.textDocumentProxy.insertText(" ")
            },
            onReturn: { [weak self] in
                self?.textDocumentProxy.insertText("\n")
            },
            onNextKeyboard: { [weak self] in
                self?.advanceToNextInputMode()
            }
        )
        
        let hostingController = UIHostingController(rootView: keyboardView)
        hostingController.view.backgroundColor = .clear
        
        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.didMove(toParent: self)
        
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingController.view.leftAnchor.constraint(equalTo: view.leftAnchor),
            hostingController.view.rightAnchor.constraint(equalTo: view.rightAnchor),
            hostingController.view.topAnchor.constraint(equalTo: view.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    private func handleRecordToggle() {
        if isRecording {
            stopRecordingAndTranscribe()
        } else {
            startRecording()
        }
    }

    private func startRecording() {
        recorder.startRecording { [weak self] success in
            if success {
                self?.isRecording = true
            } else {
                print("Failed to start recording")
            }
        }
    }

    private func stopRecordingAndTranscribe() {
        guard let audioData = recorder.stopRecording() else {
            isRecording = false
            return
        }
        
        isRecording = false
        // You might want to update the SwiftUI view state here to show "Processing"
        
        geminiClient.transcribe(audioData: audioData) { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let text):
                    self?.textDocumentProxy.insertText(text)
                case .failure(let error):
                    print("Transcription failed: \(error.localizedDescription)")
                    // Optionally show error in keyboard extension
                }
            }
        }
    }

    override func textWillChange(_ textInput: UITextInput?) {
        // The app is about to change the document's contents. Perform any preparation here.
    }

    override func textDidChange(_ textInput: UITextInput?) {
        // The app has just changed the document's contents, the document proxy will reflect those changes.
    }
}
