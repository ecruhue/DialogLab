import path from "path";
import fs from "fs";
import { exec } from "child_process";
import os from "os";
import dotenv from "dotenv";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
// Load environment variables
dotenv.config();

let currentTtsApiKey = process.env.TTS_API_KEY || '';

// Create custom TTS client that uses the API key with axios directly
const client = {
  synthesizeSpeech: async (request) => {
    try {
      console.log(`[${new Date().toISOString()}] TTS: Making direct API call with API key`);
      
      // Transform the request format if needed
      const apiRequest = {
        input: request.input,
        voice: request.voice,
        audioConfig: request.audioConfig
      };
      
      // Make a direct API call using axios
      const response = await axios.post(
        process.env.TTS_ENDPOINT || "https://texttospeech.googleapis.com/v1/text:synthesize", 
        apiRequest, 
        {
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": request.apiKey || currentTtsApiKey
          }
        }
      );

      console.log(`[${new Date().toISOString()}] TTS: Received response from API`);
      
      // Transform the response to match the format expected by the calling code
      let audioContent;
      
      if (response.data.audioContent) {
        // Convert base64 string to Buffer
        audioContent = Buffer.from(response.data.audioContent, 'base64');
        console.log(`[${new Date().toISOString()}] TTS: Audio content received and converted (${audioContent.length} bytes)`);
      } else {
        throw new Error("No audio content in response");
      }
      
      return [{ audioContent }];
    } catch (error) {
      console.error(`[${new Date().toISOString()}] TTS API Error:`, error.message);
      if (error.response) {
        console.error(`Response status: ${error.response.status}`);
        console.error(`Response data:`, error.response.data);
      }
      throw error;
    }
  }
};

console.log(`[${new Date().toISOString()}] TTS: Configured with API key for endpoint: ${process.env.TTS_ENDPOINT || "default Google TTS endpoint"}`);

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
        const { text, voiceSettings, segmentId } = segment;
        
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
          console.log(`[${new Date().toISOString()}] Batch TTS: Calling Google TTS API for segment ${segmentId}`);
          const startTime = Date.now();
          
          const [response] = await client.synthesizeSpeech({
            input: { text },
            voice: {
              languageCode: voiceSettings.languageCode || "en-US",
              name: voiceSettings.name,
            },
            audioConfig: { 
              audioEncoding: "MP3", 
              speakingRate: voiceSettings.rate || 1.0,
              pitch: voiceSettings.pitch || 0,
            },
          });
          
          const apiDuration = Date.now() - startTime;
          console.log(`[${new Date().toISOString()}] Batch TTS: TTS API response received for segment ${segmentId} (took ${apiDuration}ms)`);
          
          // Create a unique filename for this segment
          const fileName = `segment-${segmentId.replace(/[^\w\-\.]/g, '_')}-${uuidv4()}.mp3`;
          const filePath = path.join(process.cwd(), "audio", fileName);
          ensureDirectoryExistence(filePath);

          // Save the audio file
          await fs.promises.writeFile(filePath, response.audioContent, "binary");
          console.log(`[${new Date().toISOString()}] Batch TTS: Audio file saved for segment ${segmentId}: ${fileName}`);

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
          console.error(`[${new Date().toISOString()}] Batch TTS: Error processing segment ${segmentId}:`, segmentError);
          results.push({
            segmentId,
            error: segmentError.message,
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
  app.post("/api/tts", async (req, res) => {
    try {
      console.log(`[${new Date().toISOString()}] TalkingHead TTS: Received request`);
      
      // Extract the request body that would normally go directly to Google's API
      const { input, voice, audioConfig, enableTimePointing } = req.body;
      
      if (!input || !voice) {
        console.error(`[${new Date().toISOString()}] TalkingHead TTS: Invalid request - missing input or voice`);
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      console.log(`[${new Date().toISOString()}] TalkingHead TTS: Processing request with voice: ${voice.name}`);
      
      // Make the request to Google's TTS API using the server's credentials
      const [response] = await client.synthesizeSpeech({
        input: input,
        voice: voice,
        audioConfig: audioConfig,
        apiKey: req.headers['x-tts-key'] || undefined
      });
      
      // Convert audio content to base64 (this is what TalkingHead expects)
      const audioContentBase64 = response.audioContent.toString('base64');
      
      // Return the response in the format expected by TalkingHead
      res.json({
        audioContent: audioContentBase64,
        timepoints: [] // Add logic for timepoints if needed
      });
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] TalkingHead TTS: Error:`, error);
      res.status(500).json({ error: "Error processing TTS request" });
    }
  });

  // Single text-to-speech synthesis endpoint with lip sync
  app.post("/synthesize", async (req, res) => {
    const { text, voiceSettings } = req.body;

    try {
      const [response] = await client.synthesizeSpeech({
        input: { text },
        voice: {
          languageCode: voiceSettings.languageCode,
          name: voiceSettings.name,
        },
        audioConfig: { audioEncoding: "LINEAR16" },
      });

      const filePath = path.join(
        process.cwd(),
        "audio",
        `${voiceSettings.name}-${Date.now()}.wav`,
      );
      ensureDirectoryExistence(filePath);

      await fs.promises.writeFile(filePath, response.audioContent, "binary");

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
      console.error("Error:", error);
      res.status(500).send("Error synthesizing speech");
    }
  });
};

// Export the TTS client for use in other parts of the application
export { client as ttsClient };

// Runtime key management
export function setTtsApiKey(apiKey) {
  currentTtsApiKey = apiKey || '';
}

export function isTtsConfigured() {
  return Boolean(currentTtsApiKey && String(currentTtsApiKey).trim().length > 0);
}
