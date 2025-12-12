// Offscreen document for making Gemini API calls
// This runs in a hidden page context with fewer restrictions than service workers

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'gemini-transcribe') {
        const { apiKey, audioBase64, systemInstruction } = request;

        console.log('Offscreen: Received transcription request, audio length:', audioBase64?.length);

        fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            inline_data: {
                                mime_type: "audio/pcm;rate=16000",
                                data: audioBase64
                            }
                        }]
                    }],
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    },
                    generationConfig: {
                        temperature: 0.0,
                        topP: 1.0,
                        topK: 1
                    }
                })
            }
        )
            .then(response => {
                console.log('Offscreen: Got response, status:', response.status);
                if (!response.ok) {
                    return response.text().then(errorText => {
                        throw new Error(`API error (${response.status}): ${errorText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                console.log('Offscreen: Transcribed text:', text);
                sendResponse({ success: true, text: text?.trim() || '', data });
            })
            .catch(error => {
                console.error('Offscreen: Gemini API error:', error);
                sendResponse({ success: false, error: error.message });
            });

        return true; // Keep message channel open for async response
    }
});

console.log('Offscreen document loaded and ready');
