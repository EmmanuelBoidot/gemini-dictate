/**
 * Client for Google Cloud Speech-to-Text V2 (Chirp 3) API
 */
class ChirpClient {
    constructor(apiKey, projectId, region, recognizerId) {
        this.apiKey = apiKey;
        this.projectId = projectId;
        this.region = region || 'global';
        this.recognizerId = recognizerId || '_';
        this.baseUrl = `https://speech.googleapis.com/v2/projects/${this.projectId}/locations/${this.region}/recognizers/${this.recognizerId}`;
    }

    /**
     * Stream audio to Chirp API (simulated streaming via chunking)
     * @param {MediaStream} stream - Microphone stream
     * @param {Function} onTranscript - Callback for transcriptions
     * @param {Function} onError - Callback for errors
     * @param {Function} onProcessing - Callback when processing starts
     */
    async streamAudio(stream, onTranscript, onError, onProcessing) {
        console.log('Starting Chirp audio streaming...');

        // Initialize AudioWorklet
        const audioContext = new AudioContext({ sampleRate: 16000 });
        await audioContext.audioWorklet.addModule(chrome.runtime.getURL('audio-processor.js'));

        const source = audioContext.createMediaStreamSource(stream);
        const processor = new AudioWorkletNode(audioContext, 'audio-processor');

        source.connect(processor);
        processor.connect(audioContext.destination);

        const audioChunks = [];
        let isProcessing = false;

        // Process audio chunks from worklet
        processor.port.onmessage = async (event) => {
            if (event.data.audio) {
                audioChunks.push(event.data.audio);
            }
        };

        // Send audio to API every 5 seconds
        const intervalId = setInterval(async () => {
            if (audioChunks.length === 0 || isProcessing) return;

            isProcessing = true;
            if (onProcessing) onProcessing();

            // Combine chunks
            const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const combinedAudio = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunks) {
                combinedAudio.set(chunk, offset);
                offset += chunk.length;
            }

            // Clear chunks buffer
            audioChunks.length = 0;

            // Convert to base64 (16-bit PCM)
            const base64Audio = this.float32To16BitPCMBase64(combinedAudio);

            try {
                console.log('Sending request to background script (Chirp)...');

                // Send request through background script (which uses offscreen document)
                const response = await chrome.runtime.sendMessage({
                    action: 'chirp-transcribe',
                    apiKey: this.apiKey,
                    projectId: this.projectId,
                    region: this.region,
                    recognizerId: this.recognizerId,
                    audioBase64: base64Audio
                });

                console.log('Background script response (Chirp):', response);

                if (!response.success) {
                    throw new Error(response.error || 'Unknown error from background script');
                }

                if (response.text && response.text.trim()) {
                    console.log('Chirp Transcribed text:', response.text);
                    onTranscript(response.text);
                }
            } catch (error) {
                console.error('Chirp API error:', error);
                if (onError) onError(error);
            } finally {
                isProcessing = false;
            }
        }, 5000); // STREAMING EVERY 5 SECONDS

        // Return controller to stop recording
        return {
            stop: () => {
                clearInterval(intervalId);
                source.disconnect();
                processor.disconnect();
                audioContext.close();
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }

    /**
     * Convert Float32Array audio to base64-encoded 16-bit PCM
     */
    float32To16BitPCMBase64(float32Array) {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const binary = String.fromCharCode(...new Uint8Array(int16Array.buffer));
        return btoa(binary);
    }
}
