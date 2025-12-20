import SwiftUI

struct ContentView: View {
    @State private var apiKey: String = SettingsManager.shared.apiKey
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "keyboard.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 100, height: 100)
                .foregroundColor(.blue)
            
            Text("Gemini Dictate Keyboard")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            VStack(alignment: .leading, spacing: 14) {
                Text("1. Enter your Gemini API Key")
                    .font(.headline)
                
                TextField("Enter API Key here", text: $apiKey)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    .onChange(of: apiKey) { newValue in
                        SettingsManager.shared.apiKey = newValue
                    }
                
                if apiKey.isEmpty {
                    Text("⚠️ Required for transcription to work")
                        .font(.caption)
                        .foregroundColor(.red)
                } else {
                    Text("✅ Key saved")
                        .font(.caption)
                        .foregroundColor(.green)
                }
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)

            Text("2. Setup the keyboard:")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 10) {
                Label("Go to Settings > General", systemImage: "1.circle.fill")
                Label("Tap Keyboard > Keyboards", systemImage: "2.circle.fill")
                Label("Add New Keyboard > GeminiDictate", systemImage: "3.circle.fill")
                Label("Enable 'Allow Full Access'", systemImage: "4.circle.fill")
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)
            
            Spacer()
            
            Text("Powered by Gemini 1.5 Flash")
                .font(.footnote)
                .foregroundColor(.gray)
        }
        .padding()
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
