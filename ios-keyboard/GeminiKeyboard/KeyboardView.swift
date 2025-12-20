import SwiftUI

struct KeyboardView: View {
    @State private var isRecording = false
    @State private var isProcessing = false
    @State private var transcription: String = ""
    
    var onRecordToggle: () -> Void
    var onKeyTap: (String) -> Void
    var onDelete: () -> Void
    var onSpace: () -> Void
    var onReturn: () -> Void
    var onNextKeyboard: () -> Void
    
    var body: some View {
        VStack(spacing: 8) {
            // Processing/Status Bar
            HStack {
                if isProcessing {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Transcribing...")
                        .font(.caption)
                        .foregroundColor(.gray)
                } else if !transcription.isEmpty {
                    Text(transcription)
                        .font(.caption)
                        .lineLimit(1)
                        .foregroundColor(.blue)
                }
                Spacer()
            }
            .padding(.horizontal)
            .frame(height: 20)
            
            // Main Dictation Button
            Button(action: {
                onRecordToggle()
                withAnimation(.spring()) {
                    isRecording.toggle()
                }
            }) {
                ZStack {
                    Circle()
                        .fill(isRecording ? Color.red : Color.blue)
                        .frame(width: 60, height: 60)
                        .shadow(color: (isRecording ? Color.red : Color.blue).opacity(0.4), radius: 10, x: 0, y: 5)
                    
                    Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                        .font(.system(size: 30, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            .scaleEffect(isRecording ? 1.1 : 1.0)
            
            // Basic Bottom Controls
            HStack {
                Button(action: onNextKeyboard) {
                    Image(systemName: "globe")
                        .font(.system(size: 20))
                        .padding()
                        .background(Color(.systemGray4))
                        .cornerRadius(8)
                }
                
                Spacer()
                
                Button(action: onSpace) {
                    Text("space")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.systemGray4))
                        .cornerRadius(8)
                }
                
                Spacer()
                
                Button(action: onDelete) {
                    Image(systemName: "delete.left")
                        .padding()
                        .background(Color(.systemGray4))
                        .cornerRadius(8)
                }
            }
            .padding(.horizontal)
        }
        .padding(.vertical, 10)
        .background(Color(.systemGray6))
    }
}

struct KeyboardView_Previews: PreviewProvider {
    static var previews: some View {
        KeyboardView(
            onRecordToggle: {},
            onKeyTap: { _ in },
            onDelete: {},
            onSpace: {},
            onReturn: {},
            onNextKeyboard: {}
        )
    }
}
