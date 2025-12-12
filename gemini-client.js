// Gemini API client for speech-to-text transcription

class GeminiClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    }

    /**
     * Stream audio to Gemini for real-time transcription
     * @param {MediaStream} audioStream - Audio stream from microphone
     * @param {Function} onTranscript - Callback for transcribed text chunks
     * @param {Function} onError - Callback for errors
     * @param {Function} onProcessing - Callback when processing starts
     * @returns {Object} Controller with stop() method
     */
    async streamAudio(audioStream, onTranscript, onError, onProcessing) {
        try {
            // Set up audio processing with AudioWorklet (modern approach)
            const audioContext = new AudioContext({ sampleRate: 16000 });

            // Load the audio worklet processor
            try {
                const workletUrl = chrome.runtime.getURL('audio-processor.js');
                console.log('Loading AudioWorklet from:', workletUrl);
                await audioContext.audioWorklet.addModule(workletUrl);
                console.log('AudioWorklet loaded successfully');
            } catch (workletError) {
                console.error('Failed to load AudioWorklet:', workletError);
                throw new Error('Failed to load audio processor. Please reload the extension.');
            }

            const source = audioContext.createMediaStreamSource(audioStream);
            const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');

            let isActive = true;
            const audioChunks = [];

            // Listen for audio data from the worklet
            workletNode.port.onmessage = (event) => {
                if (!isActive) return;

                const audioData = event.data.audioData;
                // Convert Float32Array to Int16Array for PCM
                const int16Data = new Int16Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    const s = Math.max(-1, Math.min(1, audioData[i]));
                    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                audioChunks.push(int16Data);
            };

            source.connect(workletNode);
            workletNode.connect(audioContext.destination);

            // Use Gemini's generateContent API with audio
            const sendToGemini = async () => {
                while (isActive) {
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Send every 5 seconds to avoid rate limits

                    if (audioChunks.length === 0) continue;

                    // Combine audio chunks
                    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
                    const combinedAudio = new Int16Array(totalLength);
                    let offset = 0;
                    for (const chunk of audioChunks) {
                        combinedAudio.set(chunk, offset);
                        offset += chunk.length;
                    }
                    audioChunks.length = 0; // Clear processed chunks

                    console.log(`Sending ${combinedAudio.length} audio samples (${(combinedAudio.length / 16000).toFixed(2)}s of audio)`);

                    // Convert to base64 (raw PCM, little-endian, 16-bit)
                    const base64Audio = this.arrayBufferToBase64(combinedAudio.buffer);
                    console.log(`Base64 audio length: ${base64Audio.length} characters`);

                    // Notify that we're processing
                    if (onProcessing) onProcessing();

                    try {
                        const response = await fetch(
                            `${this.baseUrl}/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    contents: [{
                                        parts: [
                                            {
                                                inline_data: {
                                                    mime_type: "audio/pcm;rate=16000",
                                                    data: base64Audio
                                                }
                                            }
                                        ]
                                    }],
                                    generationConfig: {
                                        temperature: 0.1,
                                        topP: 0.8,
                                        topK: 10
                                    }
                                })
                            }
                        );

                        if (!response.ok) {
                            const errorData = await response.json();

                            // Handle rate limiting specifically
                            if (response.status === 429) {
                                console.warn('Rate limit hit. Waiting before retry...');
                                // Don't call onError, just skip this chunk and continue
                                continue;
                            }

                            throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
                        }

                        const data = await response.json();
                        console.log('Gemini response:', data);

                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

                        if (text && text.trim()) {
                            console.log('Transcribed text:', text.trim());
                            onTranscript(text.trim());
                        } else {
                            console.log('No text in response');
                        }
                    } catch (error) {
                        console.error('Gemini API error:', error);
                        onError(error);
                    }
                }
            };

            // Start sending audio to Gemini
            sendToGemini();

            // Return controller
            return {
                stop: () => {
                    isActive = false;
                    workletNode.disconnect();
                    source.disconnect();
                    audioContext.close();
                }
            };
        } catch (error) {
            onError(error);
            return { stop: () => { } };
        }
    }

    /**
     * Convert ArrayBuffer to base64
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Test API key validity
     */
    async testConnection() {
        try {
            const response = await fetch(
                `${this.baseUrl}/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: "Hello" }]
                        }]
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API test error:', errorData);
                throw new Error(errorData.error?.message || 'API request failed');
            }

            return response.ok;
        } catch (error) {
            console.error('Connection test failed:', error);
            throw error;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeminiClient;
}
