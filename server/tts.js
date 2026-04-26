import path from "path";
import fs from "fs";
import { exec, execFile } from "child_process";
import os from "os";
import dotenv from "dotenv";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { addNoiseForSpeaker } from "./audioNoise.js";
// Load environment variables
dotenv.config();

let currentTtsApiKey = process.env.TTS_API_KEY || '';
let currentTtsProvider = 'gemini';
let currentTtsEndpoint = process.env.TTS_ENDPOINT || '';
let currentGeminiApiKey = process.env.GEMINI_API_KEY || '';
let currentGeminiTtsModel = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
let currentGradiumApiKey = process.env.GRADIUM_API_KEY || '';
let currentGradiumTtsEndpoint = process.env.GRADIUM_TTS_ENDPOINT || 'https://api.gradium.ai/api/post/speech/tts';
let currentGradiumTtsModel = process.env.GRADIUM_TTS_MODEL || 'default';
let currentGradiumDefaultVoiceId = process.env.GRADIUM_TTS_VOICE_ID || 'YTpq7expH9539ERJ';
let currentGradiumAliceVoiceId = process.env.GRADIUM_TTS_VOICE_ID_ALICE || 'YTpq7expH9539ERJ';
let currentGradiumBobVoiceId = process.env.GRADIUM_TTS_VOICE_ID_BOB || 'LFZvm12tW_z0xfGo';

function isGoogleTtsConfigured() {
  return Boolean(currentTtsApiKey && String(currentTtsApiKey).trim()) &&
    Boolean(currentTtsEndpoint && String(currentTtsEndpoint).trim());
}

function buildGoogleTtsUrl() {
  const base = String(currentTtsEndpoint || '').trim();
  if (!base) return '';
  return base.includes('?')
    ? `${base}&key=${encodeURIComponent(currentTtsApiKey)}`
    : `${base}?key=${encodeURIComponent(currentTtsApiKey)}`;
}

function isGradiumConfigured() {
  return Boolean(currentGradiumApiKey && String(currentGradiumApiKey).trim()) &&
    Boolean(currentGradiumTtsEndpoint && String(currentGradiumTtsEndpoint).trim());
}

function resolveGradiumVoiceId(request) {
  const speaker = String(request?.speakerName || '').trim().toLowerCase();
  const voiceName = String(request?.voice?.name || '').trim().toLowerCase();

  const inferredSpeaker = (() => {
    if (speaker) return speaker;
    if (!voiceName) return '';

    if (voiceName.includes('male') || voiceName.endsWith('-b') || voiceName.endsWith('-d')) {
      return 'bob';
    }

    if (voiceName.includes('female') || voiceName.endsWith('-a') || voiceName.endsWith('-c') || voiceName.endsWith('-f')) {
      return 'alice';
    }

    return '';
  })();

  if (inferredSpeaker === 'alice' && currentGradiumAliceVoiceId) {
    return currentGradiumAliceVoiceId;
  }
  if (inferredSpeaker === 'bob' && currentGradiumBobVoiceId) {
    return currentGradiumBobVoiceId;
  }

  return currentGradiumDefaultVoiceId;
}

function normalizeSpeechText(text) {
  const collapsed = text
    .replace(/\s+/g, ' ')
    .replace(/([,;:!?])\s{2,}/g, '$1 ')
    .replace(/\.\s{2,}/g, '. ')
    .trim();

  // Gemini tends to over-pause at punctuation, so flatten internal punctuation for faster delivery.
  return collapsed
    .replace(/\.\s+(?=[A-Z])/g, ' ')
    .replace(/[,;:](?=\s)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSpeechText(input = {}) {
  if (typeof input.text === 'string' && input.text.trim()) {
    return normalizeSpeechText(input.text);
  }

  if (typeof input.ssml === 'string' && input.ssml.trim()) {
    return normalizeSpeechText(
      input.ssml
        .replace(/<mark\b[^>]*\/>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    );
  }

  return '';
}

// Gemini TTS client - uses Gemini 2.0 Live API for text-to-speech
const geminiClient = {
  synthesizeSpeech: async (request) => {
    try {
      console.log(`[${new Date().toISOString()}] Gemini TTS: Making API call via Gemini SDK`);
      
      if (!currentGeminiApiKey) {
        throw new Error('Gemini API key not configured');
      }
      
      const text = extractSpeechText(request.input);
      console.log(`[${new Date().toISOString()}] Gemini TTS: Extracted text preview: "${text.slice(0, 120)}${text.length > 120 ? '...' : ''}"`);

      if (!text) {
        throw new Error('Gemini TTS request did not contain readable text or SSML content');
      }
      
      // Use Gemini API REST endpoint for text-to-speech audio generation
      // This uses the Audio generation capability of Gemini
      // Map incoming voices (like en-US-AriaNeural or en-GB-Standard-A) to Gemini voices
      let geminiVoice = "Aoede"; // female default
      const validVoices = ["Aoede", "Charon", "Fenrir", "Kore", "Puck"];
      if (request.voice?.name) {
        const vRaw = request.voice.name;
        const v = vRaw.toLowerCase();
        
        if (validVoices.includes(vRaw)) {
          geminiVoice = vRaw; // Already a valid Gemini voice
        } else if (v.includes("male") || v.includes("thomas") || v.includes("brian") || v.includes("charlie") || v.includes("ryan") || v.includes("christopher") || v.endsWith("-b") || v.endsWith("-d")) {
          geminiVoice = "Charon"; // mapped to male
        } else if (v.includes("aria") || v.includes("sonia") || v.includes("eve") || v.includes("jane") || v.includes("grace") || v.endsWith("-a") || v.endsWith("-c") || v.endsWith("-f")) {
          geminiVoice = "Aoede"; // mapped to female
        }
      }

      // Keep the spoken words exact, but bias the model toward brisk conversational pacing.
      const promptText = `Speak the following text exactly as written. Preserve the words verbatim, but use natural conversational pacing with short sentence pauses and no exaggerated breaks at punctuation. Do not add filler, effects, or descriptions.\n\n"${text}"`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${currentGeminiTtsModel}:generateContent?key=${currentGeminiApiKey}`,
        {
          contents: [{
            role: "user",
            parts: [{
              text: promptText
            }]
          }],
          generationConfig: {
             responseModalities: ["AUDIO"],
             speechConfig: {
               voiceConfig: {
                 prebuiltVoiceConfig: {
                   voiceName: geminiVoice
                 }
               }
             }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
        const audioBase64 = response.data.candidates[0].content.parts[0].inlineData.data;
        const pcmBuffer = Buffer.from(audioBase64, 'base64');
        
        // Add WAV header for 24kHz, mono, 16-bit PCM
        const dataLen = pcmBuffer.length;
        const sampleRate = 24000;
        const numChannels = 1;
        const bitsPerSample = 16;
        
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(dataLen + 36, 4); // File size - 8
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // Subchunk1Size
        header.writeUInt16LE(1, 20); // PCM format (1)
        header.writeUInt16LE(numChannels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // Byte rate
        header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // Block align
        header.writeUInt16LE(bitsPerSample, 34);
        header.write('data', 36);
        header.writeUInt32LE(dataLen, 40);
        
        const wavBuffer = Buffer.concat([header, pcmBuffer]);
        console.log(`[${new Date().toISOString()}] Gemini TTS: Audio generated successfully`);
        return [{ audioContent: wavBuffer.toString('base64') }];
      } else {
        console.log(`[${new Date().toISOString()}] Gemini TTS: No audio in response`);
        throw new Error('Gemini TTS returned no audio content');
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Gemini TTS API Error:`, error.message);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data:`, error.response.data);
      }
      throw error;
    }
  }
};

const googleClient = {
  synthesizeSpeech: async (request) => {
    if (!isGoogleTtsConfigured()) {
      throw new Error('Google TTS fallback is not configured');
    }

    const endpoint = buildGoogleTtsUrl();
    const response = await axios.post(
      endpoint,
      {
        input: request.input,
        voice: request.voice,
        audioConfig: {
          audioEncoding: request.audioConfig?.audioEncoding || "LINEAR16",
          speakingRate: request.audioConfig?.speakingRate,
          pitch: request.audioConfig?.pitch,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const audioContent = response?.data?.audioContent;
    if (!audioContent) {
      throw new Error('Google TTS returned no audio content');
    }

    return [{ audioContent }];
  },
};

const gradiumClient = {
  synthesizeSpeech: async (request) => {
    if (!isGradiumConfigured()) {
      throw new Error('Gradium TTS fallback is not configured');
    }

    const text = extractSpeechText(request.input);
    if (!text) {
      throw new Error('Gradium TTS request did not contain readable text or SSML content');
    }

    const response = await axios.post(
      currentGradiumTtsEndpoint,
      {
        text,
        voice_id: resolveGradiumVoiceId(request),
        output_format: 'wav',
        model_name: currentGradiumTtsModel,
        only_audio: true,
      },
      {
        headers: {
          'x-api-key': currentGradiumApiKey,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    const audioBuffer = Buffer.from(response.data);
    if (!audioBuffer.length) {
      throw new Error('Gradium TTS returned empty audio response');
    }

    return [{ audioContent: audioBuffer.toString('base64') }];
  },
};

const localClient = {
  synthesizeSpeech: async (request) => {
    const text = extractSpeechText(request.input);
    if (!text) {
      throw new Error('Local TTS request did not contain readable text or SSML content');
    }

    const tmpFilePath = path.join(process.cwd(), "audio", `local-tts-${uuidv4()}.wav`);
    ensureDirectoryExistence(tmpFilePath);

    const speakingRate = Number(request?.audioConfig?.speakingRate || 1.0);
    const pitchDelta = Number(request?.audioConfig?.pitch || 0);
    const speed = Math.max(120, Math.min(300, Math.round(175 * speakingRate)));
    const pitch = Math.max(0, Math.min(99, 50 + Math.round(pitchDelta * 5)));

    const languageCode = String(request?.voice?.languageCode || "en-US").toLowerCase();
    const voice = languageCode.startsWith("en") ? "en" : languageCode;

    await new Promise((resolve, reject) => {
      execFile(
        "espeak-ng",
        ["-v", voice, "-s", String(speed), "-p", String(pitch), "-w", tmpFilePath, text],
        (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        }
      );
    });

    try {
      const wavBuffer = await fs.promises.readFile(tmpFilePath);
      return [{ audioContent: wavBuffer.toString('base64') }];
    } finally {
      fs.promises.unlink(tmpFilePath).catch(() => {});
    }
  },
};

function toSafeTtsError(error) {
  const status = error?.response?.status || 500;
  const providerMessage = error?.response?.data?.error?.message;
  const message = typeof providerMessage === 'string' && providerMessage.trim()
    ? providerMessage
    : (error?.message || 'Unknown TTS error');

  return {
    status,
    message,
  };
}

function shouldFallbackToGoogle(error) {
  const safeError = toSafeTtsError(error);
  return safeError.status === 429 || /resource_exhausted|quota/i.test(safeError.message);
}

async function synthesizeSpeechWithFallback(request) {
  try {
    return await geminiClient.synthesizeSpeech(request);
  } catch (error) {
    if (!shouldFallbackToGoogle(error)) {
      throw error;
    }

    if (isGoogleTtsConfigured()) {
      console.warn(`[${new Date().toISOString()}] Gemini TTS quota hit. Falling back to Google TTS endpoint.`);
      try {
        return await googleClient.synthesizeSpeech(request);
      } catch (googleError) {
        const safeGoogleError = toSafeTtsError(googleError);
        console.warn(`[${new Date().toISOString()}] Google TTS fallback failed: ${safeGoogleError.message} (status ${safeGoogleError.status}).`);
      }
    }

    if (isGradiumConfigured()) {
      console.warn(`[${new Date().toISOString()}] Falling back to Gradium TTS endpoint.`);
      try {
        return await gradiumClient.synthesizeSpeech(request);
      } catch (gradiumError) {
        const safeGradiumError = toSafeTtsError(gradiumError);
        console.warn(`[${new Date().toISOString()}] Gradium TTS fallback failed: ${safeGradiumError.message} (status ${safeGradiumError.status}). Falling back to local TTS.`);
      }
    }

    console.warn(`[${new Date().toISOString()}] Using local espeak-ng fallback TTS.`);
    return localClient.synthesizeSpeech(request);
  }
}



console.log(`[${new Date().toISOString()}] TTS: Provider configured as "${currentTtsProvider}"`);

// Helper function to get the correct TTS client based on current provider
function getClient() {
  return {
    synthesizeSpeech: synthesizeSpeechWithFallback,
  };
}

// Helper function to ensure directory exists
const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) return true;
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};

// Helper function to determine Rhubarb binary path
function determineRhubarbPath() {
  switch (os.platform()) {
    case "darwin": // macOS
      return path.join(process.cwd(), "Rhubarb-Lip-Mac", "rhubarb");
    case "win32": // Windows
      return path.join(process.cwd(), "Rhubarb_Lip", "rhubarb.exe");
    case "linux": // Linux
      return path.join(process.cwd(), "Rhubarb_Lip_Linux", "rhubarb");
    default: // Default case for other OS, if any
      throw new Error("Unsupported operating system for Rhubarb Lip Sync");
  }
}

/**
 * Sets up the TTS routes for Express
 * @param {Express} app - Express app instance
 * @param {number} port - Server port number
 */
// Route to the appropriate TTS client based on provider
const client = {
  synthesizeSpeech: async (request) => {
    return synthesizeSpeechWithFallback(request);
  }
};

export const setupTTSRoutes = (app, port) => {
  // Batch TTS processing endpoint
  app.post("/api/batch-synthesize", async (req, res) => {
    try {
      console.log(`[${new Date().toISOString()}] Batch TTS: Received request for batch synthesis`);
      
      const { segments } = req.body;
      
      if (!segments || !Array.isArray(segments) || segments.length === 0) {
        console.error(`[${new Date().toISOString()}] Batch TTS: Invalid request - no segments provided`);
        return res.status(400).json({ error: 'No segments provided' });
      }
      
      console.log(`[${new Date().toISOString()}] Batch TTS: Processing ${segments.length} segments`);
      console.log(`[${new Date().toISOString()}] Batch TTS: Segment IDs: ${segments.map(s => s.segmentId).join(', ')}`);
      
      // Create audio directory if it doesn't exist
      const audioDir = path.join(process.cwd(), "audio");
      if (!fs.existsSync(audioDir)) {
        console.log(`[${new Date().toISOString()}] Batch TTS: Creating audio directory at ${audioDir}`);
        fs.mkdirSync(audioDir, { recursive: true });
      } else {
        console.log(`[${new Date().toISOString()}] Batch TTS: Audio directory exists at ${audioDir}`);
      }
      
      // Process the segments with TTS
      const results = [];
      let successCount = 0;
      let failureCount = 0;
      
      console.log(`[${new Date().toISOString()}] Batch TTS: Starting processing of ${segments.length} segments`);
      
      for (const [index, segment] of segments.entries()) {
        const { text, voiceSettings, segmentId, speakerName } = segment;
        
        console.log(`[${new Date().toISOString()}] Batch TTS: Processing segment ${index + 1}/${segments.length} (ID: ${segmentId})`);
        console.log(`  - Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        console.log(`  - Voice: ${JSON.stringify(voiceSettings)}`);
        
        if (!text || !voiceSettings) {
          console.error(`[${new Date().toISOString()}] Batch TTS: Segment ${segmentId} missing text or voice settings`);
          results.push({
            segmentId,
            error: "Missing text or voice settings",
            success: false
          });
          failureCount++;
          continue;
        }
        
        try {
          // Generate speech for this segment
          console.log(`[${new Date().toISOString()}] Batch TTS: Calling TTS API for segment ${segmentId}`);
          const startTime = Date.now();
          
          const [response] = await getClient().synthesizeSpeech({
            input: { text },
            voice: {
              languageCode: voiceSettings.languageCode || "en-US",
              name: voiceSettings.name,
            },
            speakerName,
            audioConfig: { 
              audioEncoding: "LINEAR16", 
              speakingRate: voiceSettings.rate || 1.0,
              pitch: voiceSettings.pitch || 0,
            },
          });
          
          const apiDuration = Date.now() - startTime;
          console.log(`[${new Date().toISOString()}] Batch TTS: TTS API response received for segment ${segmentId} (took ${apiDuration}ms)`);
          
          // Create a unique filename for this segment
          const fileName = `segment-${segmentId.replace(/[^\w\-\.]/g, '_')}-${uuidv4()}.wav`;
          const filePath = path.join(process.cwd(), "audio", fileName);
          ensureDirectoryExistence(filePath);

          // Save the audio file (with optional speaker-specific background noise)
          const audioBuffer = typeof response.audioContent === 'string' ? Buffer.from(response.audioContent, 'base64') : response.audioContent;
          const { audioBuffer: processedAudioBuffer, profileApplied, mixed } = await addNoiseForSpeaker(audioBuffer, speakerName);
          await fs.promises.writeFile(filePath, processedAudioBuffer);
          console.log(`[${new Date().toISOString()}] Batch TTS: Audio file saved for segment ${segmentId}: ${fileName} (profile=${profileApplied}, mixed=${mixed})`);

          let audioUrl;
          if (process.env.NODE_ENV === "development") {
            // Construct the proper URL for the audio file
            audioUrl = `http://localhost:${port}/audio/${encodeURIComponent(fileName)}`;
          } else {
            audioUrl = `https://chatlab.3dvar.com/server/audio/${encodeURIComponent(fileName)}`;
          }
          console.log(`[${new Date().toISOString()}] Batch TTS: Audio URL created: ${audioUrl}`);

          // Add the result to our array
          results.push({
            segmentId,
            audioUrl,
            success: true
          });
          successCount++;
        } catch (segmentError) {
          const safeError = toSafeTtsError(segmentError);
          console.error(`[${new Date().toISOString()}] Batch TTS: Error processing segment ${segmentId}: ${safeError.message} (status ${safeError.status})`);
          results.push({
            segmentId,
            error: safeError.message,
            success: false
          });
          failureCount++;
        }
      }
      
      console.log(`[${new Date().toISOString()}] Batch TTS: Processing complete. Success: ${successCount}, Failed: ${failureCount}`);
      
      res.json({
        results,
        totalSuccess: successCount,
        totalFailed: failureCount
      });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Batch TTS: Fatal error in batch synthesis:`, error);
      res.status(500).json({ error: "Error in batch synthesis" });
    }
  });

  // TalkingHead TTS endpoint
  app.post(["/api/tts", "/api/tts/:speakerName"], async (req, res) => {
    try {
      console.log(`[${new Date().toISOString()}] TalkingHead TTS: Received request`);
      
      // Extract the request body that would normally go directly to Google's API
      const { input, voice, audioConfig, enableTimePointing, speakerName, noiseProfile } = req.body;
      
      if (!input || !voice) {
        console.error(`[${new Date().toISOString()}] TalkingHead TTS: Invalid request - missing input or voice`);
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      console.log(`[${new Date().toISOString()}] TalkingHead TTS: Processing request with voice: ${voice.name}`);
      
      // Make the request to the configured TTS provider
      const resolvedSpeakerName = req.params?.speakerName || speakerName || req.headers['x-speaker-name'] || null;

      const [response] = await getClient().synthesizeSpeech({
        input: input,
        voice: voice,
        speakerName: resolvedSpeakerName,
        audioConfig: audioConfig,
        apiKey: req.headers['x-tts-key'] || undefined
      });

      const rawAudioBuffer = typeof response.audioContent === 'string'
        ? Buffer.from(response.audioContent, 'base64')
        : response.audioContent;

      const { audioBuffer: processedAudioBuffer, profileApplied, mixed } = await addNoiseForSpeaker(rawAudioBuffer, resolvedSpeakerName, {
        voiceName: voice?.name,
        noiseProfile,
      });
      
      // audioContent is already base64 from the client, use directly
      const audioContentBase64 = processedAudioBuffer.toString('base64');
      
      console.log(`[${new Date().toISOString()}] TalkingHead TTS: Sending ${audioContentBase64.length} chars of base64 audio`);
      console.log(`[${new Date().toISOString()}] TalkingHead TTS: Noise profile=${profileApplied}, mixed=${mixed}, speaker=${resolvedSpeakerName || 'n/a'}, voice=${voice?.name || 'n/a'}`);
      
      // Return the response in the format expected by TalkingHead
      res.json({
        audioContent: audioContentBase64,
        timepoints: [] // Add logic for timepoints if needed
      });
      
    } catch (error) {
      const safeError = toSafeTtsError(error);
      console.error(`[${new Date().toISOString()}] TalkingHead TTS: Error: ${safeError.message} (status ${safeError.status})`);
      res.status(safeError.status).json({ error: safeError.message });
    }
  });

  // Single text-to-speech synthesis endpoint with lip sync
  app.post("/synthesize", async (req, res) => {
    const { text, voiceSettings, speakerName, noiseProfile } = req.body;

    try {
      const [response] = await getClient().synthesizeSpeech({
        input: { text },
        voice: {
          languageCode: voiceSettings.languageCode,
          name: voiceSettings.name,
        },
        speakerName,
        audioConfig: { audioEncoding: "LINEAR16" },
      });

      const filePath = path.join(
        process.cwd(),
        "audio",
        `${voiceSettings.name}-${Date.now()}.wav`,
      );
      ensureDirectoryExistence(filePath);

      const audioBuffer = typeof response.audioContent === 'string' ? Buffer.from(response.audioContent, 'base64') : response.audioContent;
      const { audioBuffer: processedAudioBuffer, profileApplied, mixed } = await addNoiseForSpeaker(audioBuffer, speakerName, {
        voiceName: voiceSettings?.name,
        noiseProfile,
      });
      await fs.promises.writeFile(filePath, processedAudioBuffer);
      console.log(`[${new Date().toISOString()}] Synthesize TTS: Audio saved with profile=${profileApplied}, mixed=${mixed}`);

      const rhubarbPath = determineRhubarbPath();
      const jsonFilePath = filePath.replace(".wav", ".json");

      // Process with Rhubarb lip sync
      exec(
        `${rhubarbPath} -f json "${filePath}" -o "${jsonFilePath}"`,
        (error, stderr, stdout) => {
          if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).send("Error generating lip sync data");
          }
          if (stderr) console.error(`stderr: ${stderr}`);
          console.log(`stdout: ${stdout}`);

          if (process.env.NODE_ENV === "development") {
            res.json({
              audioUrl: `http://localhost:${port}/audio/${encodeURIComponent(path.basename(filePath))}`,
              jsonUrl: `http://localhost:${port}/audio/${encodeURIComponent(path.basename(jsonFilePath))}`,
            });
          } else {
            res.json({
              audioUrl: `https://chatlab.3dvar.com/server/audio/${encodeURIComponent(path.basename(filePath))}`,
              jsonUrl: `https://chatlab.3dvar.com/server/audio/${encodeURIComponent(path.basename(jsonFilePath))}`,
            });
          }
        },
      );
    } catch (error) {
      const safeError = toSafeTtsError(error);
      console.error(`[${new Date().toISOString()}] Synthesize TTS: Error: ${safeError.message} (status ${safeError.status})`);
      res.status(safeError.status).send(safeError.message);
    }
  });
};

// Export the TTS client for use in other parts of the application
export { client as ttsClient };

// Runtime key management
export function setTtsApiKey(apiKey) {
  currentTtsApiKey = apiKey || '';
}

export function setTtsEndpoint(endpoint) {
  currentTtsEndpoint = endpoint || '';
}

export function setGeminiTtsApiKey(apiKey) {
  currentGeminiApiKey = apiKey || '';
  console.log(`[${new Date().toISOString()}] Gemini TTS API key configured`);
}

export function setGeminiTtsModel(model) {
  if (model && String(model).trim()) {
    currentGeminiTtsModel = String(model).trim();
    console.log(`[${new Date().toISOString()}] Gemini TTS model configured: ${currentGeminiTtsModel}`);
  }
}

export function setGradiumTtsApiKey(apiKey) {
  currentGradiumApiKey = apiKey || '';
}

export function setGradiumTtsEndpoint(endpoint) {
  currentGradiumTtsEndpoint = endpoint || currentGradiumTtsEndpoint;
}

export function setGradiumTtsModel(model) {
  if (model && String(model).trim()) {
    currentGradiumTtsModel = String(model).trim();
  }
}

export function setTtsProvider(provider) {
  if (provider !== 'gemini') {
    console.error(`Invalid TTS provider: ${provider}. Only 'gemini' is supported.`);
  }
}

export function getTtsProvider() {
  return currentTtsProvider;
}

export function isTtsConfigured() {
  const geminiConfigured = Boolean(currentGeminiApiKey && String(currentGeminiApiKey).trim().length > 0);
  return geminiConfigured || isGoogleTtsConfigured() || isGradiumConfigured();
}
