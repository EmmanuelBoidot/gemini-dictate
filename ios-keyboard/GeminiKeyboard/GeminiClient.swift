import Foundation

class GeminiClient {
    private let apiKey: String
    private let baseUrl = "https://generativelanguage.googleapis.com/v1beta"
    private let model = "gemini-1.5-flash" // Using flash for speed

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    func transcribe(audioData: Data, completion: @escaping (Result<String, Error>) -> Void) {
        let urlString = "\(baseUrl)/models/\(model):generateContent?key=\(apiKey)"
        guard let url = URL(string: urlString) else {
            completion(.failure(NSError(domain: "GeminiClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])))
            return
        }

        let base64Audio = audioData.base64EncodedString()
        
        let systemInstruction = """
        You are an expert audio transcriptionist and copy editor. I will provide you with an audio sample. Your sole task is to generate a full, perfect, and professional-grade transcript of the spoken content, in the language of the audio. It is possible that the audio contains English words in a language other than English. If so, please keep the English words in the transcript.

        Transcription Rules:
        * Refinement: Correct all grammatical errors, smooth out any awkward phrasing, and ensure all verb conjugations are accurate and consistent with the tense of the speech.
        * Punctuation: Apply correct standard English punctuation (commas, periods, question marks, capitalization, etc.) to enhance readability and clarity.

        Exclusions (Non-Verbatim Cleaning):
        * Remove all disfluencies/stuttering: Omit repetitions, stutters, and false starts (e.g., "I- I - I went" becomes "I went").
        * Remove all non-words/fillers: Exclude common hesitation sounds and filler words, such as 'um,' 'uh,' 'ah,' 'hmmm,' 'like' (when used as a filler), 'you know' (when used as a filler), 'so' (when used as a false start), and any audible breathing sounds or coughs.

        Return only the transcribed text, nothing else. Do not add commentary, explanations, or descriptions.
        """

        let json: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": "Please transcribe this audio."],
                        [
                            "inline_data": [
                                "mime_type": "audio/wav",
                                "data": base64Audio
                            ]
                        ]
                    ]
                ]
            ],
            "system_instruction": [
                "parts": [
                    ["text": systemInstruction]
                ]
            ]
        ]

        guard let jsonData = try? JSONSerialization.data(withJSONObject: json) else {
            completion(.failure(NSError(domain: "GeminiClient", code: -2, userInfo: [NSLocalizedDescriptionKey: "Failed to encode request"])))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData

        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = data else {
                completion(.failure(NSError(domain: "GeminiClient", code: -3, userInfo: [NSLocalizedDescriptionKey: "No data received"])))
                return
            }

            do {
                if let jsonResponse = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let candidates = jsonResponse["candidates"] as? [[String: Any]],
                   let firstCandidate = candidates.first,
                   let content = firstCandidate["content"] as? [String: Any],
                   let parts = content["parts"] as? [[String: Any]],
                   let firstPart = parts.first,
                   let text = firstPart["text"] as? String {
                    completion(.success(text.trimmingCharacters(in: .whitespacesAndNewlines)))
                } else {
                    let errorMsg = String(data: data, encoding: .utf8) ?? "Unknown response format"
                    completion(.failure(NSError(domain: "GeminiClient", code: -4, userInfo: [NSLocalizedDescriptionKey: "Failed to parse response: \(errorMsg)"])))
                }
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
}
