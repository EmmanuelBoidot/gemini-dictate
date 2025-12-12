# PCM Format Correction

## Issue
Previous fix used WAV format, but Gemini documentation states that **raw 16-bit PCM at 16kHz is the optimal input format**.

## Correction
Reverted to raw PCM format with the correct MIME type specification.

## Changes Made

### Updated `gemini-client.js`

#### MIME Type (Line 76)
- **Correct format**: `audio/pcm;rate=16000`
- The `rate=16000` parameter is crucial - it tells Gemini the sample rate

#### Audio Data (Line 60)
- Sending raw PCM data (Int16Array buffer)
- Little-endian byte order (default for JavaScript)
- 16-bit samples
- Mono channel
- 16kHz sample rate

#### Removed WAV Methods
- Removed `createWavBuffer()` method (not needed)
- Removed `writeString()` helper (not needed)
- Sending raw PCM is simpler and optimal per Gemini docs

## Gemini Audio Specifications
According to official documentation:
- **Optimal format**: Raw 16-bit PCM, little-endian, mono, 16kHz
- **MIME type**: `audio/pcm;rate=16000`
- **Token usage**: 32 tokens per second of audio
- **Downsampling**: Gemini downsamples to 16 Kbps automatically
- **Max length**: 9.5 hours per prompt

## Why This Should Work Better
1. Using the exact format Gemini recommends
2. Proper MIME type with rate parameter
3. No unnecessary WAV wrapper overhead
4. 2-second chunks for better context

## Testing
1. Reload the extension
2. Try dictating
3. Should now get accurate transcriptions

The raw PCM format is what Gemini is optimized for!
