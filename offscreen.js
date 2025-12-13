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

    if (request.action === 'chirp-transcribe') {
        const { apiKey, projectId, region, recognizerId, audioBase64 } = request;

        console.log('Offscreen: Received Chirp transcription request');

        // Check for Service Account credentials in local storage
        chrome.storage.local.get(['serviceAccountCreds'], async (result) => {
            let authHeader = {};
            let finalApiKey = apiKey;

            try {
                if (result.serviceAccountCreds && result.serviceAccountCreds.private_key) {
                    console.log('Offscreen: Using Service Account for authentication');

                    // Initialize TokenService if not already done
                    if (!window.tokenService) {
                        window.tokenService = new TokenService(result.serviceAccountCreds);
                    }

                    const accessToken = await window.tokenService.getAccessToken();
                    authHeader = { 'Authorization': `Bearer ${accessToken}` };

                    // When using OAuth token, API key is not strictly needed but good for quota tracking
                    // If no API key provided, we rely solely on the token
                } else if (!apiKey) {
                    throw new Error('No API Key or Service Account credentials found.');
                } else {
                    console.log('Offscreen: Using API Key for authentication');
                }

                // Construct V2 API URL
                let url = `https://speech.googleapis.com/v2/projects/${projectId}/locations/${region}/recognizers/${recognizerId}:recognize`;
                if (finalApiKey) {
                    url += `?key=${finalApiKey}`;
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeader
                    },
                    body: JSON.stringify({
                        config: {
                            autoDecodingConfig: {},
                            model: "chirp"
                        },
                        content: audioBase64
                    })
                });

                console.log('Offscreen: Got Chirp response, status:', response.status);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Chirp API error (${response.status}): ${errorText}`);
                }

                const data = await response.json();

                // Extract text from V2 response structure
                const results = data.results || [];
                let text = '';

                for (const result of results) {
                    if (result.alternatives && result.alternatives[0]) {
                        text += result.alternatives[0].transcript + ' ';
                    }
                }

                console.log('Offscreen: Chirp Transcribed text:', text);
                sendResponse({ success: true, text: text.trim(), data });

            } catch (error) {
                console.error('Offscreen: Chirp API error:', error);
                sendResponse({ success: false, error: error.message });
            }
        });

        return true;
    }
});

console.log('Offscreen document loaded and ready');
