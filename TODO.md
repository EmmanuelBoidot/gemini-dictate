# TODO: Gemini Post-Processing Experiment

## Concept
Instead of using Gemini for speech-to-text (which has Chrome extension fetch limitations), use Chrome Web Speech API for transcription and optionally send the transcribed text to Gemini for cleanup/enhancement.

## Why This Approach?
- Chrome Web Speech API works perfectly for real-time transcription
- Gemini API calls fail in Chrome extensions due to CORS/fetch restrictions with large audio payloads
- Text-only API calls to Gemini are much smaller and more likely to work
- Gives users the benefit of Gemini's intelligence without audio upload issues

## Implementation Ideas

### Option A: Real-time Post-Processing
- Chrome Web Speech transcribes in real-time
- When a sentence/phrase is finalized, send it to Gemini for cleanup
- Gemini fixes grammar, removes filler words, improves phrasing
- Replace the original text with Gemini's enhanced version

### Option B: Batch Post-Processing
- Chrome Web Speech transcribes everything
- User can optionally click a button to "enhance with Gemini"
- Sends all transcribed text to Gemini at once
- Gemini cleans up the entire block of text

### Option C: Hybrid
- Real-time transcription with Chrome
- Optional toggle: "Auto-enhance with Gemini"
- When enabled, periodically sends recent text to Gemini for cleanup
- Updates text in-place with enhanced version

## Technical Considerations

### API Call Size
- Text-only requests are much smaller than audio
- Should work fine in background script
- May still need to test CORS in extension context

### Prompt Design
Example prompt for Gemini:
```
Clean up this transcribed speech. Fix grammar, remove filler words (um, uh, like), 
and improve clarity while preserving the speaker's original meaning and tone. 
Return only the cleaned text, nothing else.

Original: [transcribed text here]
```

### Settings UI
Add option:
- [ ] Enable Gemini enhancement
- [ ] Enhancement mode: Real-time / On-demand / Disabled

### Performance
- Real-time might be too slow (API latency)
- Batch/on-demand might be better UX
- Consider showing loading indicator during enhancement

## Next Steps
1. Test if text-only Gemini API calls work in background script
2. Implement simple prototype with on-demand enhancement
3. Add UI toggle for the feature
4. Test with real usage scenarios
5. Decide on best enhancement mode based on testing

## Current Status
- Chrome Web Speech API: ✅ Working perfectly
- Gemini audio transcription: ❌ Blocked by Chrome extension fetch limitations
- Gemini text post-processing: 🔄 To be experimented with
