import SwiftUI

struct ContentView: View {
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
            
            Text("To use the keyboard:")
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
