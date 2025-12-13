# EchoFlow POC

Hold-to-talk voice transcription using Google Chirp 3 + Gemini Pro.

## Flow

```
Hold Right Ctrl → Audio chunked every 5s → Chirp 3 STT (parallel)
Release Right Ctrl → Gemini Pro aggregates → Final text output
```

## Prerequisites

- Python 3.10+
- Google Cloud project with Speech-to-Text API enabled
- Gemini API key
- gcloud CLI installed and authenticated

## Setup

### 1. Install dependencies

```bash
cd echoflow-poc
pip install -r requirements.txt
```

### 2. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Enable Speech-to-Text API

```bash
gcloud services enable speech.googleapis.com
```

### 4. Set environment variables

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GEMINI_API_KEY="your-gemini-api-key"

# Optional (defaults shown)
export CHIRP_REGION="us-central1"
export CHIRP_RECOGNIZER="_"
```

## Run

```bash
python main.py
```

## Usage

1. **Hold Right Ctrl** to start recording
2. **Speak** - audio is chunked every 5 seconds and sent to Chirp 3
3. **Release Right Ctrl** to stop and get aggregated result
4. **Press ESC** to exit

## Platform Notes

### macOS

Grant accessibility permission when prompted:
System Preferences → Privacy & Security → Accessibility → Enable for Terminal/IDE

### Linux

May need to add user to input group:
```bash
sudo usermod -aG input $USER
# Log out and back in
```

## Example Output

```
============================================================
EchoFlow POC - Chirp 3 + Gemini Pro
============================================================
Trigger key: Right Ctrl (hold to record)
Chunk duration: 5s
STT: Google Chirp 3
  Project: my-project
  Region: us-central1
Aggregation: gemini-2.5-pro-preview-06-05
============================================================

Hold Right Ctrl to record...

[Recording started] Hold key and speak...
  [Chunk 0] Queued for Chirp 3 (5.0s audio)
  [Chunk 0] Chirp 3 complete: "Hello this is a test of the..."
  [Chunk 1] Queued for Chirp 3 (5.0s audio)
  [Chunk 1] Chirp 3 complete: "...transcription system"
[Recording stopped] Processing...
  [Chunk 2] Final chunk (2.3s audio)
  Waiting for all Chirp 3 STT to complete...
  All 3 chunks transcribed
  Aggregating with Gemini Pro...

============================================================
FINAL OUTPUT:
============================================================
Hello, this is a test of the transcription system.
============================================================
```
