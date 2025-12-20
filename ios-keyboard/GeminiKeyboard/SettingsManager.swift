import Foundation

class SettingsManager {
    static let shared = SettingsManager()
    
    // Replace with your actual App Group ID from Xcode
    private let appGroupId = "group.com.yourcompany.GeminiDictate"
    
    private var defaults: UserDefaults? {
        return UserDefaults(suiteName: appGroupId)
    }
    
    var apiKey: String {
        get {
            return defaults?.string(forKey: "gemini_api_key") ?? ""
        }
        set {
            defaults?.set(newValue, forKey: "gemini_api_key")
        }
    }
}
