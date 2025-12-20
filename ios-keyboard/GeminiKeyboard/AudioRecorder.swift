import Foundation
import AVFoundation

class AudioRecorder: NSObject, AVAudioRecorderDelegate {
    private var audioRecorder: AVAudioRecorder?
    private var audioFilename: URL?
    private var isRecording = false

    func startRecording(completion: @escaping (Bool) -> Void) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
            try session.setActive(true)
            
            if #available(iOS 17.0, *) {
                AVAudioApplication.requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.beginRecording()
                            completion(true)
                        } else {
                            completion(false)
                        }
                    }
                }
            } else {
                session.requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        if granted {
                            self.beginRecording()
                            completion(true)
                        } else {
                            completion(false)
                        }
                    }
                }
            }
        } catch {
            print("Failed to set up audio session: \(error)")
            completion(false)
        }
    }

    private func beginRecording() {
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        audioFilename = documentsPath.appendingPathComponent("recording.wav")

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: 16000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsFloatKey: false
        ]

        do {
            audioRecorder = try AVAudioRecorder(url: audioFilename!, settings: settings)
            audioRecorder?.delegate = self
            audioRecorder?.record()
            isRecording = true
        } catch {
            print("Could not start recording: \(error)")
        }
    }

    func stopRecording() -> Data? {
        audioRecorder?.stop()
        isRecording = false
        
        guard let url = audioFilename else { return nil }
        return try? Data(contentsOf: url)
    }

    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            print("Recording failed")
        }
    }
}
