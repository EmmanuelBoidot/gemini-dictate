#!/usr/bin/env python3
"""
EchoFlow POC - Voice to Text with Gemini

Flow:
1. Hold Right Ctrl to start recording
2. Audio chunked every 5s → parallel STT via Gemini Flash
3. Release Right Ctrl → Gemini Pro aggregates all transcripts → print
"""

import os
import queue
import threading
import time
import base64
import io
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import sounddevice as sd
from pynput import keyboard
import google.generativeai as genai

# Config
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_DURATION = 5  # seconds
TRIGGER_KEY = keyboard.Key.ctrl_r  # Right Ctrl - hold to talk

# Gemini models
STT_MODEL = "gemini-2.0-flash-exp"  # Fast model for chunk transcription
AGGREGATION_MODEL = "gemini-2.5-pro-preview-06-05"  # Pro model for final aggregation

# State
is_recording = False
audio_buffer = []
audio_queue = queue.Queue()
transcript_results = {}  # chunk_id -> transcript
chunk_counter = 0
executor = ThreadPoolExecutor(max_workers=5)
futures = []
chunk_timer = None
buffer_lock = threading.Lock()


def init_gemini():
    """Initialize Gemini with API key from environment."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    genai.configure(api_key=api_key)


def audio_to_base64_wav(audio_data: np.ndarray, sample_rate: int) -> str:
    """Convert numpy audio array to base64-encoded WAV."""
    import wave

    # Convert float32 to int16
    audio_int16 = (audio_data * 32767).astype(np.int16)

    # Write to WAV in memory
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav_file:
        wav_file.setnchannels(CHANNELS)
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_int16.tobytes())

    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode('utf-8')


def transcribe_chunk(chunk_id: int, audio_data: np.ndarray) -> tuple[int, str]:
    """Transcribe a single audio chunk using Gemini Flash."""
    try:
        audio_b64 = audio_to_base64_wav(audio_data, SAMPLE_RATE)

        model = genai.GenerativeModel(STT_MODEL)
        response = model.generate_content([
            {
                "mime_type": "audio/wav",
                "data": audio_b64
            },
            "Transcribe this audio exactly as spoken. Return only the transcription, nothing else. If there is no speech, return empty string."
        ])

        transcript = response.text.strip()
        print(f"  [Chunk {chunk_id}] STT complete: {transcript[:50]}..." if len(transcript) > 50 else f"  [Chunk {chunk_id}] STT complete: {transcript}")
        return (chunk_id, transcript)
    except Exception as e:
        print(f"  [Chunk {chunk_id}] STT error: {e}")
        return (chunk_id, "")


def process_chunk():
    """Called every CHUNK_DURATION seconds to process accumulated audio."""
    global chunk_counter, audio_buffer

    with buffer_lock:
        if not audio_buffer:
            return

        # Get current buffer and reset
        chunk_data = np.concatenate(audio_buffer)
        audio_buffer = []
        chunk_id = chunk_counter
        chunk_counter += 1

    print(f"  [Chunk {chunk_id}] Queued for STT ({len(chunk_data)/SAMPLE_RATE:.1f}s audio)")

    # Submit for parallel processing
    future = executor.submit(transcribe_chunk, chunk_id, chunk_data)
    futures.append(future)


def schedule_chunk_timer():
    """Schedule the next chunk processing."""
    global chunk_timer
    if is_recording:
        chunk_timer = threading.Timer(CHUNK_DURATION, on_chunk_timer)
        chunk_timer.start()


def on_chunk_timer():
    """Timer callback - process chunk and schedule next."""
    if is_recording:
        process_chunk()
        schedule_chunk_timer()


def audio_callback(indata, frames, time_info, status):
    """Called by sounddevice for each audio block."""
    if status:
        print(f"  Audio status: {status}")
    if is_recording:
        with buffer_lock:
            audio_buffer.append(indata.copy().flatten())


def aggregate_transcripts(transcripts: list[str]) -> str:
    """Use Gemini Pro to aggregate all transcripts into clean text."""
    if not transcripts or all(t.strip() == "" for t in transcripts):
        return ""

    # Filter empty transcripts
    non_empty = [t for t in transcripts if t.strip()]
    if not non_empty:
        return ""

    model = genai.GenerativeModel(AGGREGATION_MODEL)

    prompt = f"""You are aggregating speech-to-text transcripts from consecutive audio chunks.
The chunks were recorded continuously and transcribed separately.

Your task:
1. Combine these transcripts into a single coherent text
2. Fix any word fragments at chunk boundaries
3. Remove duplicate words that may appear at chunk edges
4. Clean up minor speech artifacts (ums, uhs) if present
5. Preserve the speaker's meaning and style exactly
6. Return ONLY the final clean text, nothing else

Transcripts (in order):
{chr(10).join(f"[Chunk {i}]: {t}" for i, t in enumerate(non_empty))}

Final aggregated text:"""

    response = model.generate_content(prompt)
    return response.text.strip()


def start_recording():
    """Start audio capture."""
    global is_recording, audio_buffer, chunk_counter, futures, transcript_results

    # Reset state
    audio_buffer = []
    chunk_counter = 0
    futures = []
    transcript_results = {}

    is_recording = True
    print("\n[Recording started] Hold key and speak...")

    # Start chunk timer
    schedule_chunk_timer()


def stop_recording():
    """Stop recording and process final results."""
    global is_recording, chunk_timer

    is_recording = False
    print("[Recording stopped] Processing...")

    # Cancel chunk timer
    if chunk_timer:
        chunk_timer.cancel()
        chunk_timer = None

    # Process any remaining audio in buffer
    with buffer_lock:
        if audio_buffer:
            chunk_data = np.concatenate(audio_buffer)
            audio_buffer.clear()
            chunk_id = chunk_counter
            print(f"  [Chunk {chunk_id}] Final chunk ({len(chunk_data)/SAMPLE_RATE:.1f}s audio)")
            future = executor.submit(transcribe_chunk, chunk_id, chunk_data)
            futures.append(future)

    # Wait for all STT to complete
    print("  Waiting for all STT to complete...")
    results = {}
    for future in as_completed(futures):
        chunk_id, transcript = future.result()
        results[chunk_id] = transcript

    # Order transcripts by chunk_id
    ordered_transcripts = [results[i] for i in sorted(results.keys())]

    print(f"  All {len(ordered_transcripts)} chunks transcribed")

    # Aggregate with Gemini Pro
    print("  Aggregating with Gemini Pro...")
    final_text = aggregate_transcripts(ordered_transcripts)

    print("\n" + "="*60)
    print("FINAL OUTPUT:")
    print("="*60)
    print(final_text)
    print("="*60 + "\n")


def on_press(key):
    """Handle key press."""
    global is_recording
    if key == TRIGGER_KEY and not is_recording:
        start_recording()


def on_release(key):
    """Handle key release."""
    global is_recording
    if key == TRIGGER_KEY and is_recording:
        stop_recording()

    # Exit on Escape
    if key == keyboard.Key.esc:
        print("\n[Exiting...]")
        return False


def main():
    print("="*60)
    print("EchoFlow POC")
    print("="*60)
    print(f"Trigger key: Right Ctrl (hold to record)")
    print(f"Chunk duration: {CHUNK_DURATION}s")
    print(f"STT Model: {STT_MODEL}")
    print(f"Aggregation Model: {AGGREGATION_MODEL}")
    print("="*60)
    print("Press ESC to exit")
    print("="*60 + "\n")

    # Initialize Gemini
    init_gemini()
    print("[Gemini initialized]")

    # Start audio stream
    stream = sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype='float32',
        callback=audio_callback,
        blocksize=1024
    )

    with stream:
        print("[Audio stream ready]")
        print("\nHold Right Ctrl to record...\n")

        # Start keyboard listener (blocking)
        with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
            listener.join()

    # Cleanup
    executor.shutdown(wait=True)
    print("[Done]")


if __name__ == "__main__":
    main()
