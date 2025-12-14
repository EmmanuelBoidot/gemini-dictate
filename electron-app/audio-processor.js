// Audio worklet processor for capturing microphone audio
class AudioCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];

        // Log once every ~100 calls (approx 1.5s) to verify it's running
        if (Math.random() < 0.01) {
            console.log('AudioProcessor: process() called. Input channels:', input.length);
        }

        if (input.length > 0) {
            const inputChannel = input[0];

            // Convert Float32 to Int16
            const int16Data = new Int16Array(inputChannel.length);
            for (let i = 0; i < inputChannel.length; i++) {
                const s = Math.max(-1, Math.min(1, inputChannel[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Send Int16 buffer to main thread
            // We use the underlying ArrayBuffer to transfer efficiently
            this.port.postMessage({
                audio: int16Data.buffer
            }, [int16Data.buffer]); // Transfer ownership
        }

        return true; // Keep processor alive
    }
}

registerProcessor('audio-processor', AudioCaptureProcessor);
