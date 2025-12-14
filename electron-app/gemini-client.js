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
                const workletUrl = 'audio-processor.js'; // Relative path for Electron
                console.log('Loading AudioWorklet from:', workletUrl);
                await audioContext.audioWorklet.addModule(workletUrl);
                console.log('AudioWorklet loaded successfully');
            } catch (workletError) {
                console.error('Failed to load AudioWorklet:', workletError);
                throw new Error('Failed to load audio processor. Please reload the extension.');
            }

            const source = audioContext.createMediaStreamSource(audioStream);
            const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');

            let isActive = true;
            const audioChunks = [];

            // Listen for audio data from the worklet
            workletNode.port.onmessage = (event) => {
                if (!isActive) return;

                // AudioProcessor now sends Int16 ArrayBuffer in event.data.audio
                if (event.data.audio) {
                    const int16Data = new Int16Array(event.data.audio);
                    audioChunks.push(int16Data);
                }
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

                    // Convert to WAV format (add header)
                    const wavBuffer = this.createWavBuffer(combinedAudio, 16000);
                    const base64Audio = this.arrayBufferToBase64(wavBuffer);

                    console.log(`Base64 audio length: ${base64Audio.length} characters`);

                    // Notify that we're processing
                    if (onProcessing) onProcessing();

                    try {
                        console.log('Sending request to Gemini API...');

                        const response = await fetch(
                            `${this.baseUrl}/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`,
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    systemInstruction: {
                                        parts: [{
                                            text: `You are an expert audio transcriptionist and copy editor. I will provide you with an audio sample. Your sole task is to generate a full, perfect, and professional-grade transcript of the spoken content, in the language of the audio. It is possible that the audio contains English words in a language other than English. If so, please keep the English words in the transcript.

Transcription Rules:
* Refinement: Correct all grammatical errors, smooth out any awkward phrasing, and ensure all verb conjugations are accurate and consistent with the tense of the speech.
* Punctuation: Apply correct standard English punctuation (commas, periods, question marks, capitalization, etc.) to enhance readability and clarity.

Exclusions (Non-Verbatim Cleaning):
* Remove all disfluencies/stuttering: Omit repetitions, stutters, and false starts (e.g., "I- I - I went" becomes "I went").
* Remove all non-words/fillers: Exclude common hesitation sounds and filler words, such as 'um,' 'uh,' 'ah,' 'hmmm,' 'like' (when used as a filler), 'you know' (when used as a filler), 'so' (when used as a false start), and any audible breathing sounds or coughs.

Return only the transcribed text, nothing else. Do not add commentary, explanations, or descriptions.`
                                        }]
                                    },
                                    contents: [{
                                        parts: [{
                                            inlineData: {
                                                mimeType: "audio/wav",
                                                data: base64Audio
                                            }
                                        }]
                                    }]
                                })
                            }
                        );

                        if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.error?.message || 'Gemini API request failed');
                        }

                        const data = await response.json();
                        console.log('Gemini response data:', JSON.stringify(data, null, 2));

                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

                        if (text && text.trim()) {
                            console.log('Transcribed text:', text);
                            onTranscript(text);
                        } else {
                            console.log('No text in response');
                        }
                    } catch (error) {
                        console.error('Gemini API error:', error);
                        console.error('Error name:', error.name);
                        console.error('Error message:', error.message);

                        // Check for common error types
                        if (error.name === 'TypeError' && error.message.includes('fetch')) {
                            console.error('Network error: Failed to fetch. This could be a CORS issue or network connectivity problem.');
                        }
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
     * Create a WAV buffer from Int16 PCM data
     */
    createWavBuffer(pcmData, sampleRate) {
        const numChannels = 1;
        const byteRate = sampleRate * numChannels * 2;
        const blockAlign = numChannels * 2;
        const dataSize = pcmData.length * 2;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        // RIFF chunk descriptor
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        this.writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
        view.setUint16(22, numChannels, true); // NumChannels
        view.setUint32(24, sampleRate, true); // SampleRate
        view.setUint32(28, byteRate, true); // ByteRate
        view.setUint16(32, blockAlign, true); // BlockAlign
        view.setUint16(34, 16, true); // BitsPerSample

        // data sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Write PCM data
        const pcmBytes = new Uint8Array(pcmData.buffer);
        const wavBytes = new Uint8Array(buffer, 44);
        wavBytes.set(pcmBytes);

        return buffer;
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
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
