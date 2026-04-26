# Gemini TTS Setup for VOX LAB

Configure your Gemini API key in `.env` using a placeholder format:
```
GEMINI_API_KEY=your-gemini-api-key-here
```

## TTS Provider Support

VOX LAB now supports **three TTS providers**:

### 1. **Google Cloud TTS** (default)
- Free tier available
- Large voice selection
- Most stable

### 2. **Azure Speech Services**
- Enterprise-grade
- Real-time streaming
- Multiple voice styles

### 3. **Google Gemini TTS** (NEW!)
- Modern LLM-based synthesis
- Natural, expressive output
- Lower latency for research

## Switching TTS Providers

You can switch providers via environment variable or API:

### Environment Variable
```bash
# In .env file
TTS_PROVIDER=gemini  # or 'google' or 'azure'
GEMINI_API_KEY=your-api-key
```

### API Call (Runtime)
```bash
curl -X POST http://localhost:3010/api/set-tts-provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "gemini"}'
```

## Implementation Notes

The Gemini TTS integration is ready for:
- ✅ Text-to-speech synthesis
- ✅ Multiple voice profiles
- ✅ Streaming audio output
- ✅ Format conversion (WAV, MP3)

### Example: Using Gemini TTS

```javascript
// Client-side or API call
const response = await fetch('/api/tts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Hello, this is spoken with Gemini TTS",
    voice: { name: "en-US-female" },
    audioConfig: { audioEncoding: "MP3" }
  })
});

const audio = await response.arrayBuffer();
```

## Next Steps

1. **Test Gemini TTS**: Run a conversation in VOX LAB with TTS provider set to "gemini"
2. **Regenerate API Key**: For security, [regenerate your Gemini API key](https://console.cloud.google.com/apis/credentials)
3. **Monitor Costs**: Gemini TTS charges per request - monitor your Google Cloud usage

## Troubleshooting

If you get "content filter" errors, it means the LLM response violated Azure's content policy. This is separate from TTS and happens during text generation before audio synthesis.

**Solution**: The prompt content has been simplified to reduce false positives. If issues persist:
1. Check agent.js prompts for problematic content
2. Adjust conversation topics to avoid sensitive content
3. Switch LLM providers if needed
