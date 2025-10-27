import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import os from "os";
import ConversationManager from "./chat.js";
import ConversationMemory from "./conversationmemory.js";
import { fileURLToPath } from "url";
import { setupTTSRoutes, ttsClient, setTtsApiKey } from "./tts.js";
import * as llmProvider from "./providers/llmProvider.js";
import { setupModelRoutes } from "./modelAPI.js";
import ContentManager from "./contentManager.js";
import { setupContentRoutes } from "./contentAPI.js";
import { setupVerificationRoutes } from "./verificationAPI.js";


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3010;
let quotesArray = [];
// const conversationHistory = [];

app.use(
  cors({
    origin: ["http://localhost:5173", "https://chatlab.3dvar.com"],
    credentials: true,
  }),
);
app.use(bodyParser.json({ limit: "50mb" }));
app.use("/audio", express.static("audio"));

// Use the TTS client from the tts.js module instead of creating a new one
const client = ttsClient;

const ensureDirectoryExistence = (filePath) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) return true;
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
};


app.post("/save-quotes", (req, res) => {
  const quotes = req.body; // Assuming quotes is an array
  if (Array.isArray(quotes)) {
    quotesArray.push(...quotes); // Spread operator to add all items to the array
    console.log("Quotes saved:", quotesArray);
    res.status(200).send({ message: "Quotes saved successfully", quotesArray });
  } else {
    res
      .status(400)
      .send({ message: "Invalid data format, expected an array." });
  }
});

// Setup TTS routes from the tts.js module
setupTTSRoutes(app, port);

// Setup model management routes
setupModelRoutes(app);

// Setup content API routes
setupContentRoutes(app);

// Setup verification routes
setupVerificationRoutes(app);

let conversationManager, conversationMemory;

app.post("/api/start-conversation", async (req, res) => {
  try {
    const config = req.body;
    console.log(`Starting conversation with maxTurns: ${config.maxTurns}, completeConversation: ${config.completeConversation}`);

    // Track if response has been ended
    let responseEnded = false;

    // Function to safely write to response
    const safeWrite = (data) => {
      if (!responseEnded && !res.writableEnded) {
        res.write(data);
      } else {
        console.warn("Attempted to write to an ended response");
      }
    };

    // Function to safely end response
    const safeEnd = () => {
      if (!responseEnded && !res.writableEnded) {
        responseEnded = true;
        res.end();
      } else {
        console.warn("Attempted to end an already ended response");
      }
    };

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    });

    if (!config.shouldLoadPreviousConversationManager) {
      conversationMemory = new ConversationMemory();
    }
    conversationManager = new ConversationManager(config.maxTurns || 6, conversationMemory);
    // Attach per-request LLM options to the manager for downstream usage
    conversationManager.llmOptions = {
      provider: req.headers['x-llm-provider'] || undefined,
      apiKey: req.headers['x-llm-key'] || undefined
    };
    console.log(`ConversationManager created with ${config.maxTurns || 6} maxTurns with conversationMemory`, conversationMemory);

    conversationManager.onMessageGenerated = (message) => {
      console.log(`Message generated from ${message.sender}: ${message.message?.substring(0, 30)}...`);
      
      // If message has needsApproval flag, log it clearly for debugging
      if (message.needsApproval) {
        console.log(`APPROVAL REQUIRED: Message from ${message.sender} needs approval - isDerailing: ${message.isDerailing}`);
      }
      
      // If conversation is paused and this is not a system message or derailing message,
      // don't send the message to the client
      if ((conversationManager.isWaitingForApproval || conversationManager.conversationPaused) && 
          !message.isSystemMessage && !message.isDerailing) {
        console.log('Message generation skipped - conversation is paused');
        return;
      }
      
      safeWrite(JSON.stringify({ type: "message", message }) + "\n");
    };

    conversationManager.onHumanInputRequired = (speaker) => {
      console.log(`Human input required from: ${speaker}`);
      safeWrite(JSON.stringify({ type: "human_input_required", speaker }) + "\n");
    };

    // Add a callback for when the conversation is complete
    conversationManager.onConversationComplete = () => {
      // Update the conversation memory when conversation is complete
      if (conversationManager && conversationMemory) {
        console.log("Conversation complete, updating conversation memory");
        conversationMemory.conversationHistory = [...conversationManager.conversation];
      }
      
      // Only send completion signal if conversation is not paused or waiting for approval
      if (!conversationManager.isWaitingForApproval && !conversationManager.conversationPaused) {
        console.log("Conversation complete, sending completion signal");
        safeWrite(JSON.stringify({ type: "completion", status: "done" }) + "\n");
      } else {
        console.log("Conversation complete but paused - holding completion signal");
      }
    };

    await runConversation(config, res, safeWrite, safeEnd);

    // After runConversation is complete, if completeConversation was requested,
    // ensure we signal completion if it wasn't already signaled AND conversation isn't paused
    if (config.completeConversation && !conversationManager.isWaitingForApproval && !conversationManager.conversationPaused) {
      console.log("Conversation processing finished");
      safeWrite(JSON.stringify({ type: "completion", status: "finished" }) + "\n");
    }
    safeEnd();
  } catch (error) {
    console.error("Error running conversation:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error running conversation" });
    } else if (!res.writableEnded) {
      res.write(JSON.stringify({ type: "error", error: error.message }) + "\n");
      res.end();
    } else {
      console.error("Cannot send error response, connection already closed");
    }
  }
});

app.post("/api/human-input", (req, res) => {
  const { input, speaker } = req.body;
  if (conversationManager) {
    conversationManager.provideHumanInput(speaker, input);
    res.status(200).json({ message: "Input received" });
  } else {
    res.status(400).json({ error: "Conversation not initialized" });
  }
});

// Existing /api/conversation-replay endpoint modified for audio generation only
app.post("/api/generate-audio", async (req, res) => {
  const { text, voice } = req.body;

  try {
    const voiceSettings = {
      languageCode: "en-US",
      name: voice,
    };

    const [response] = await client.synthesizeSpeech({
      input: { text: text },
      voice: voiceSettings,
      audioConfig: { audioEncoding: "LINEAR16" },
    });

    const filePath = path.join(
      __dirname,
      "audio",
      `${voiceSettings.name}-${Date.now()}.wav`,
    );
    ensureDirectoryExistence(filePath);
    await fs.promises.writeFile(filePath, response.audioContent, "binary");

    // const rhubarbPath = determineRhubarbPath();
    // const jsonFilePath = filePath.replace(".wav", ".json");

    if (process.env.NODE_ENV === "development") {
      res.json({
        audioUrl: `http://localhost:${port}/audio/${encodeURIComponent(path.basename(filePath))}`,
      });
    } else {
      res.json({
        audioUrl: `https://chatlab.3dvar.com/server/audio/${encodeURIComponent(path.basename(filePath))}`,
      });
    }
  } catch (error) {
    console.error("Failed to generate audio:", error);
    res.status(500).json({ error: "Failed to generate audio" });
  }
});


// Update the runConversation function in your server.js file
async function runConversation(config) {
  console.log("running conversation with config:", config);

  // Create the conversation manager if it doesn't exist
  if (!conversationManager) {
    conversationManager = new ConversationManager(config.maxTurns || 6);
  }

  // Set conversation mode settings
  if (config.conversationMode) {
    console.log(`DEBUG - Setting conversation mode to: ${config.conversationMode}`);
    
    switch (config.conversationMode) {
      case 'human-control':
        conversationManager.requireImpromptuApproval = true;
        conversationManager.autoApproveImpromptu = false;
        conversationManager.derailingEnabled = true;
        console.log(`DEBUG - human-control mode: requireImpromptuApproval=${conversationManager.requireImpromptuApproval}, autoApproveImpromptu=${conversationManager.autoApproveImpromptu}, derailingEnabled=${conversationManager.derailingEnabled}`);
        break;
        
      case 'autonomous':
        conversationManager.requireImpromptuApproval = false;
        conversationManager.autoApproveImpromptu = true;
        conversationManager.derailingEnabled = true;
        console.log(`DEBUG - autonomous mode: requireImpromptuApproval=${conversationManager.requireImpromptuApproval}, autoApproveImpromptu=${conversationManager.autoApproveImpromptu}, derailingEnabled=${conversationManager.derailingEnabled}`);
        break;
        
      case 'reactive':
        conversationManager.requireImpromptuApproval = false;
        conversationManager.autoApproveImpromptu = false;
        conversationManager.derailingEnabled = false;
        conversationManager.derailMode = null;
        console.log(`DEBUG - reactive mode: requireImpromptuApproval=${conversationManager.requireImpromptuApproval}, autoApproveImpromptu=${conversationManager.autoApproveImpromptu}, derailingEnabled=${conversationManager.derailingEnabled}`);
        
        // Also disable any existing derailer settings for all agents
        if (conversationManager.agents) {
          Object.values(conversationManager.agents).forEach(agent => {
            agent.isDerailer = false;
            agent.derailThreshold = 0;
          });
        }
        break;
    }
  }

  // Add agents to the conversation
  config.agents.forEach((agent) => {
    conversationManager.addAgent(
      agent.name,
      agent.personality,
      agent.interactionPattern,
      agent.isHumanProxy,
      agent.customAttributes,
      agent.fillerWordsFrequency,
    );

    if (agent.isHumanProxy) {
      conversationManager.setAgentAsHumanProxy(agent.name);
    }
  });

  // Set the interaction pattern
  conversationManager.setInteractionPattern(config.interactionPattern || "neutral");

  // Add interruption rules
  if (config.interruptionRules && Array.isArray(config.interruptionRules)) {
    config.interruptionRules.forEach((rule) => {
      conversationManager.setInterruptionRule(
        rule.interrupter,
        rule.interrupted,
        rule.probability,
        rule.vibe,
      );
    });
  }

  // Add backchannel rules
  if (config.backChannelRules && Array.isArray(config.backChannelRules)) {
    config.backChannelRules.forEach((rule) => {
      conversationManager.setBackChannelRule(
        rule.fromPeople,
        rule.toPeople,
        rule.frequency,
        rule.vibe,
        rule.probability,
      );
    });
  }

  // Handle party mode configuration if present
  if (config.partyMode && config.partyCommands && Array.isArray(config.partyCommands)) {
    console.log("Setting up party mode with commands:", config.partyCommands);
    
    // Process each party command in sequence
    for (const cmd of config.partyCommands) {
      switch (cmd.command) {
        case 'createParty':
          // Create a party with the specified members and configuration
          conversationManager.createParty(
            cmd.partyName,
            cmd.members,
            cmd.config,
            cmd.config.partyDescription
          );
          console.log(`Created party "${cmd.partyName}" with ${cmd.members.length} members`);
          break;
          
        case 'enablePartyMode':
          // Enable party mode with the specified turn-taking mode
          conversationManager.enablePartyMode(cmd.turnMode);
          console.log(`Enabled party mode with turn mode: ${cmd.turnMode}`);
          break;
          
        case 'setPartyRepresentative':
          // Set a representative for a specific party
          if (cmd.partyName && cmd.representative) {
            conversationManager.setPartyRepresentative(cmd.partyName, cmd.representative);
            console.log(`Set representative "${cmd.representative}" for party "${cmd.partyName}"`);
          }
          break;
          
        case 'setPartySpeakingMode':
          // Set speaking mode for a specific party
          if (cmd.partyName && cmd.mode) {
            conversationManager.setPartySpeakingMode(cmd.partyName, cmd.mode, cmd.options);
            console.log(`Set speaking mode "${cmd.mode}" for party "${cmd.partyName}"`);
          }
          break;
          
        case 'setAsDerailer':
          // Set an agent as a derailer with specified configuration
          if (cmd.agentName && cmd.config) {
            const agent = conversationManager.getAgentByName(cmd.agentName);
            if (agent) {
              agent.setAsDerailer(cmd.config.enable, {
                mode: cmd.config.mode || "random",
                threshold: cmd.config.threshold || 0.5,
                minTurns: cmd.config.minTurns || 3,
                maxTurns: cmd.config.maxTurns || 6
              });
              console.log(`Set agent "${cmd.agentName}" as derailer with mode: ${cmd.config.mode}, threshold: ${cmd.config.threshold}`);
            } else {
              console.warn(`Agent "${cmd.agentName}" not found for setAsDerailer command`);
            }
          }
          break;
          
        default:
          console.warn(`Unknown party command: ${cmd.command}`);
      }
    }
  }

  // Handle derailer commands if present
  if (config.derailerCommands && Array.isArray(config.derailerCommands)) {
    console.log("Setting up derailer mode with commands:", config.derailerCommands);
    
    // Process each derailer command in sequence
    for (const cmd of config.derailerCommands) {
      switch (cmd.command) {
        case 'setAsDerailer':
          // Set an agent as a derailer with specified configuration
          if (cmd.agentName && cmd.config) {
            const agent = conversationManager.getAgentByName(cmd.agentName);
            if (agent) {
              agent.setAsDerailer(cmd.config.enable, {
                mode: cmd.config.mode || "random",
                threshold: cmd.config.threshold || 0.5,
                minTurns: cmd.config.minTurns || 3,
                maxTurns: cmd.config.maxTurns || 6
              });
              console.log(`Set agent "${cmd.agentName}" as derailer with mode: ${cmd.config.mode}, threshold: ${cmd.config.threshold}`);
            } else {
              console.warn(`Agent "${cmd.agentName}" not found for setAsDerailer command`);
            }
          }
          break;
          
        default:
          console.warn(`Unknown derailer command: ${cmd.command}`);
      }
    }
  }

  // Handle content commands if present
  if (config.contentCommands && Array.isArray(config.contentCommands)) {
    console.log("Setting up content with commands:", config.contentCommands);
    
    // Ensure the ContentManager is initialized
    if (!conversationManager.contentManager) {
      conversationManager.contentManager = new ContentManager();
    }
    
    // Process each content command in sequence
    for (const cmd of config.contentCommands) {
      switch (cmd.command) {
        case 'initializeContent':
          try {
            // Load the PDF content
            const contentId = await conversationManager.initializeContentMode(
              cmd.filename,
              cmd.owners || null,
              cmd.isParty || false,
              cmd.presenter || null,
              cmd.presenterIsParty || false
            );
            
            console.log(`Initialized content "${cmd.filename}" with ID: ${contentId}`);
            console.log(`Content ownership: ${cmd.owners ? (cmd.isParty ? 'Party-owned' : 'Agent-owned') : 'Public'}`);
            console.log(`Presenter: ${cmd.presenter ? `${cmd.presenter} (${cmd.presenterIsParty ? 'party' : 'agent'})` : 'None'}`);
            
          } catch (error) {
            console.error(`Error initializing content "${cmd.filename}":`, error);
          }
          break;
          
        case 'setContentAsPublic':
          if (cmd.contentId) {
            try {
              conversationManager.contentManager.setContentAsPublic(
                cmd.contentId,
                cmd.presenter || null,
                cmd.presenterIsParty || false
              );
              console.log(`Set content ${cmd.contentId} as public`);
            } catch (error) {
              console.error(`Error setting content ${cmd.contentId} as public:`, error);
            }
          }
          break;
          
        default:
          console.warn(`Unknown content command: ${cmd.command}`);
      }
    }
  }

  // Start the conversation
  await conversationManager.initiateConversation(config);
}

// Add new endpoint for generating scene descriptions
app.post('/api/generate-scene-description', async (req, res) => {
  try {
    const { sceneName, speakers, partyInfo } = req.body;
    
    if (!sceneName) {
      return res.status(400).json({ error: 'Missing scene name' });
    }

    // Extract speaker names if available
    const speakerNames = speakers && Array.isArray(speakers) 
      ? speakers.map(s => s.name).join(', ')
      : null;
    
    // Format party information for the prompt if available
    let partyContext = '';
    if (partyInfo) {
      if (partyInfo.parties && Array.isArray(partyInfo.parties) && partyInfo.parties.length > 0) {
        const partyDescriptions = partyInfo.parties.map(party => 
          `"${party.name}" party consists of ${party.members.join(', ')}`
        );
        partyContext += `\nThe participants are organized in parties: ${partyDescriptions.join('. ')}.`;
      }
      
      if (partyInfo.moderatorParty) {
        partyContext += `\nThe "${partyInfo.moderatorParty}" party acts as the moderator of the conversation.`;
      }
      
      if (partyInfo.turnMode) {
        partyContext += `\nParty turn-taking happens in "${partyInfo.turnMode}" mode.`;
      }
    }
    
    // Prepare prompt for LLM
    const prompt = `Generate a concise description for a conversation scene named "${sceneName}".
    ${speakerNames ? `The scene includes the following participants: ${speakerNames}.` : ''}${partyContext}
    
    The description should:
    1. Be one sentence long
    2. Capture the essence of what the scene might be about based on its name
    3. Be suitable as context for a natural conversation
    4. Not include phrases like "In this scene" or "This scene is about"
    ${partyContext ? '5. Consider the party dynamics mentioned above' : ''}
    
    Provide only the description text without any additional explanations or formatting.`;

    // Get response from LLM
    const description = await llmProvider.generateText(prompt, { maxTokens: 120, temperature: 0.7 });
    
    console.log(`Generated scene description for "${sceneName}": ${description}`);

    res.json({ description: description.trim() });
  } catch (error) {
    console.error('Error generating scene description:', error);
    res.status(500).json({ error: 'Failed to generate scene description' });
  }
});

// Add new endpoint for generating conversation prompts
app.post('/api/generate-conversation-prompt', async (req, res) => {
  try {
    const { generalContext, sceneDescription, subTopic, speakers, interactionPattern } = req.body;
    
    if (!sceneDescription) {
      return res.status(400).json({ error: 'Missing scene description' });
    }

    // Extract speaker names if available
    const speakerNames = speakers && Array.isArray(speakers) 
      ? speakers.map(s => s.name).join(', ')
      : null;
    
    // Prepare prompt for LLM
    const prompt = `Create a situational context for a conversation using the following format:
    "${speakerNames || 'The participants'} is in a conversation where ${sceneDescription}. They are talking about ${subTopic || 'various topics related to the scene'}."

    The context should:
    1. Naturally incorporate all the provided speakers: ${speakerNames || 'Not specified'}
    2. Do not add any additional information about the topic, or participants
    3. Reference the interaction style (${interactionPattern || 'neutral'}) through the tone
    4. Be 1-2 sentences long and feel natural
    5. Not include phrases like "In this scene" or "This scene is about"

    Provide only the context text without any additional explanations or formatting.`;

    // Get response from LLM
    const conversationPrompt = await llmProvider.generateText(prompt, { maxTokens: 250, temperature: 0.7 });
    
    console.log(`Generated conversation prompt: ${conversationPrompt}`);

    res.json({ prompt: conversationPrompt.trim() });
  } catch (error) {
    console.error('Error generating conversation prompt:', error);
    res.status(500).json({ error: 'Failed to generate conversation prompt' });
  }
});

// Add new endpoint for deleting audio files
app.post('/api/delete-audio-files', async (req, res) => {
  try {
    const { segments } = req.body;
    
    if (!segments || !Array.isArray(segments)) {
      return res.status(400).json({ error: 'Invalid segments data' });
    }

    const deletedFiles = [];
    const errors = [];

    for (const segment of segments) {
      if (segment.audioUrl) {
        try {
          // Extract filename from URL
          const filename = decodeURIComponent(segment.audioUrl.split('/').pop());
          const filePath = path.join(__dirname, 'audio', filename);
          
          // Check if file exists before trying to delete
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles.push(filename);
            console.log(`Deleted audio file: ${filename}`);
          } else {
            console.log(`File not found: ${filename}`);
          }
        } catch (error) {
          errors.push(`Error deleting ${segment.audioUrl}: ${error.message}`);
          console.error(`Error deleting file: ${error.message}`);
        }
      }
    }

    res.json({
      success: true,
      deletedFiles,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error in delete-audio-files:', error);
    res.status(500).json({ error: 'Failed to delete audio files' });
  }
});

// Add impromptu phase approval endpoints
app.post('/api/impromptu/approve', async (req, res) => {
  try {
    if (!conversationManager) {
      return res.status(404).json({ error: 'No active conversation manager' });
    }

    console.log('Handling impromptu phase approval');
    
    // Get edited content from request if available
    const { editedContent } = req.body;
    if (editedContent) {
      console.log('Received edited content for impromptu message:', editedContent.substring(0, 30) + '...');
      
      // Update the pending message content if we have edited content
      if (conversationManager.pendingImpromptuPhase?.response) {
        conversationManager.pendingImpromptuPhase.response.content = editedContent;
        conversationManager.pendingImpromptuPhase.response.message = editedContent;
        console.log('Updated pending impromptu message with edited content');
      }
    }
    
    // Set up streaming response
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    });

    // Track if response has been ended
    let responseEnded = false;

    // Function to safely write to response
    const safeWrite = (data) => {
      if (!responseEnded && !res.writableEnded) {
        res.write(data);
      } else {
        console.warn("Attempted to write to an ended response");
      }
    };

    // Function to safely end response
    const safeEnd = () => {
      if (!responseEnded && !res.writableEnded) {
        responseEnded = true;
        res.end();
      } else {
        console.warn("Attempted to end an already ended response");
      }
    };
    
    // Store the pending derailing message before approval
    const pendingMessage = conversationManager.pendingImpromptuPhase?.response;
    const derailerAgent = conversationManager.pendingImpromptuPhase?.derailerAgent;
    const derailMode = conversationManager.pendingImpromptuPhase?.derailMode;
    const turns = conversationManager.pendingImpromptuPhase?.turns;
    
    // Override the message handler to control the order of messages
    const originalMessageHandler = conversationManager.onMessageGenerated;
    let systemMessageSent = false;
    let derailingMessageSent = false;
    
    conversationManager.onMessageGenerated = (message) => {
      // Skip all message generation if conversation is paused
      if (!message.isSystemMessage && 
          (conversationManager.isWaitingForApproval || conversationManager.conversationPaused)) {
        console.log('Message generation skipped - conversation is paused');
        return;
      }
      
      // If this is an impromptu phase system message, send it first
      if (message.isSystemMessage && message.impromptuPhase && message.isImpromptuPhaseStart) {
        systemMessageSent = true;
        safeWrite(JSON.stringify({ type: "message", message }) + "\n");
        console.log('Streamed system impromptu start message to client');
        return;
      }
      
      // If this is a derailing message and we've sent the system message, send it next
      if (message.sender === derailerAgent?.name && message.isDerailing && systemMessageSent && !derailingMessageSent) {
        derailingMessageSent = true;
        
        // Check if we require impromptu approval (human-control mode)
        if (conversationManager.requireImpromptuApproval) {
          // For human-control mode, keep the needsApproval flag
          const pendingMessage = {
            ...message,
            needsApproval: true,
            isApproved: false
          };
          safeWrite(JSON.stringify({ type: "message", message: pendingMessage }) + "\n");
          console.log('Streamed pending derailing message to client (requires approval)');
        } else {
          // For autonomous mode, mark as approved
          const approvedMessage = {
            ...message,
            needsApproval: false,
            isApproved: true
          };
          safeWrite(JSON.stringify({ type: "message", message: approvedMessage }) + "\n");
          console.log('Streamed approved derailing message to client');
        }
        return;
      }
      
      // For other messages, just stream them normally
      safeWrite(JSON.stringify({ type: "message", message }) + "\n");
    };
    
    // Handle approval
    await conversationManager.handleImpromptuPhaseApproval(true);
    
    // Send initial success response
    safeWrite(JSON.stringify({ type: "status", status: "approved" }) + "\n");
    
    // Send a special message to reset the client approval state
    safeWrite(JSON.stringify({ 
      type: "reset_approval_state", 
      status: "approval_handled"
    }) + "\n");
    
    // Continue the conversation from current state
    if (conversationManager.currentConfig) {
      // Check if we have the approved message and set it as the last speaker
      const lastSpeaker = conversationManager.impromptuDerailer || 
                          (pendingMessage && pendingMessage.sender) || 
                          (derailerAgent && derailerAgent.name);
      
      console.log(`Continuing impromptu phase with last speaker: ${lastSpeaker}`);
      
      // Continue conversation from the approved derailing message
      await conversationManager.continueConversation(
        conversationManager.currentParticipants,
        lastSpeaker,
        "All",
        false
      );
    } else {
      console.warn('No current config found in conversation manager');
    }
    
    // Restore original message handler
    conversationManager.onMessageGenerated = originalMessageHandler;
    
    // Don't send completion signal here - the conversation should continue
    
    safeEnd();
  } catch (error) {
    console.error('Error handling impromptu phase approval:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to approve impromptu phase', details: error.message });
    } else if (!res.writableEnded) {
      res.write(JSON.stringify({ type: "error", error: error.message }) + "\n");
      res.end();
    }
  }
});

app.post('/api/impromptu/reject', async (req, res) => {
  try {
    if (!conversationManager) {
      return res.status(404).json({ error: 'No active conversation manager' });
    }

    console.log('Handling impromptu phase rejection');
    
    // Set up streaming response
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    });

    // Track if response has been ended
    let responseEnded = false;

    // Function to safely write to response
    const safeWrite = (data) => {
      if (!responseEnded && !res.writableEnded) {
        res.write(data);
      } else {
        console.warn("Attempted to write to an ended response");
      }
    };

    // Function to safely end response
    const safeEnd = () => {
      if (!responseEnded && !res.writableEnded) {
        responseEnded = true;
        res.end();
      } else {
        console.warn("Attempted to end an already ended response");
      }
    };
    
    // Handle rejection - this will remove the derailing message from the conversation
    // and reset all impromptu phase state
    conversationManager.handleImpromptuPhaseApproval(false);
    
    // Send initial success response
    safeWrite(JSON.stringify({ type: "status", status: "rejected" }) + "\n");
    
    // Send a special message to reset the client approval state
    safeWrite(JSON.stringify({ 
      type: "reset_approval_state", 
      status: "approval_handled"
    }) + "\n");
    
    // Continue the conversation with the stored config
    if (conversationManager.currentConfig) {
      // Get the last message in the conversation after derailing message was removed
      const lastMessage = conversationManager.getLastMessage();
      const lastSpeaker = lastMessage ? lastMessage.sender : null;
      
      console.log(`Continuing normal conversation from last speaker: ${lastSpeaker || 'unknown'}`);
      
      // Force a refresh of the conversation memory context
      if (conversationManager.memory) {
        console.log('Refreshing conversation memory after impromptu rejection');
        // Ensure memory state is consistent with the conversation array
        conversationManager.memory.conversationHistory = [...conversationManager.conversation];
      }
      
      // Create a modified configuration that includes the current conversation state
      // and ensures we're back in normal mode (not impromptu)
      const config = {
        ...conversationManager.currentConfig,
        conversationHistory: conversationManager.conversation,
        lastSpeaker: lastSpeaker,
        completeConversation: true,
        // Add a flag to indicate we're in post-rejection mode
        isPostRejection: true
      };

      // Set up message handler for this continuation
      const originalMessageHandler = conversationManager.onMessageGenerated;
      conversationManager.onMessageGenerated = (message) => {
        if (!message.isSystemMessage && (conversationManager.isWaitingForApproval || conversationManager.conversationPaused)) {
          console.log('Message generation skipped - conversation is paused');
          return;
        }
        
        // Sanitize any derailing/impromptu flags from messages after rejection
        if (message && !message.isSystemMessage) {
          // Create a clean message without impromptu-related flags
          const sanitizedMessage = { ...message };
          
          // Remove impromptu-related flags
          delete sanitizedMessage.isDerailing;
          delete sanitizedMessage.needsApproval;
          delete sanitizedMessage.impromptuPhase;
          delete sanitizedMessage.derailMode;
          delete sanitizedMessage.isImpromptuPhaseStart;
          delete sanitizedMessage.isEndingPhase;
          
          console.log('Sanitized post-rejection message from impromptu flags');
          
          // Send the sanitized message instead
          safeWrite(JSON.stringify({ type: "message", message: sanitizedMessage }) + "\n");
        } else {
          safeWrite(JSON.stringify({ type: "message", message }) + "\n");
        }
      };

      // Double check that impromptu phase is fully disabled before continuing
      if (conversationManager.impromptuPhaseActive) {
        console.warn('Impromptu phase still active after rejection - forcibly disabling');
        conversationManager.impromptuPhaseActive = false;
        conversationManager.impromptuTurnsLeft = 0;
      }

      // Disable derailer agents temporarily to prevent immediate re-triggering
      const originalDerailerSettings = conversationManager.agents
        .filter(agent => agent.isDerailer)
        .map(agent => ({
          name: agent.name,
          isDerailer: true,
          threshold: agent.derailThreshold
        }));
      
      // Temporarily disable all derailers
      conversationManager.agents.forEach(agent => {
        if (agent.isDerailer) {
          console.log(`Temporarily disabling derailer functionality for ${agent.name}`);
          agent.isDerailer = false;
        }
      });

      // Resume the conversation in normal mode
      await runConversation(config);
      
      // Restore derailer settings after conversation continues
      originalDerailerSettings.forEach(setting => {
        const agent = conversationManager.getAgentByName(setting.name);
        if (agent) {
          console.log(`Re-enabling derailer functionality for ${setting.name}`);
          agent.isDerailer = setting.isDerailer;
          agent.derailThreshold = setting.threshold;
        }
      });

      // Restore original message handler
      conversationManager.onMessageGenerated = originalMessageHandler;
    } else {
      console.warn('No current config found in conversation manager');
    }
    
    // Don't send completion signal here - the conversation should continue
    
    safeEnd();
  } catch (error) {
    console.error('Error handling impromptu phase rejection:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to reject impromptu phase', details: error.message });
    } else if (!res.writableEnded) {
      res.write(JSON.stringify({ type: "error", error: error.message }) + "\n");
      res.end();
    }
  }
});

// Add new endpoint for setting conversation mode
app.post('/api/conversation/mode', (req, res) => {
  const mode = req.body.mode;
  
  console.log(`DEBUG - Changing conversation mode to: ${mode}`);
  
  if (!mode || !['human-control', 'autonomous', 'reactive'].includes(mode)) {
    return res.status(400).send({ error: "Invalid conversation mode" });
  }

  if(!conversationManager) {
    return res.status(400).send({ error: "No conversation manager found" });
  }

  try {
    // Update the conversation manager's mode settings
    switch (mode) {
      case 'human-control':
        conversationManager.requireImpromptuApproval = true;
        conversationManager.autoApproveImpromptu = false;
        conversationManager.derailingEnabled = true;
        break;
        
      case 'autonomous':
        conversationManager.requireImpromptuApproval = false;
        conversationManager.autoApproveImpromptu = true;
        conversationManager.derailingEnabled = true;
        break;
        
      case 'reactive':
        conversationManager.requireImpromptuApproval = false;
        conversationManager.autoApproveImpromptu = false;
        conversationManager.derailingEnabled = false;
        // Also disable derailer settings for agents
        if (conversationManager.agents) {
          conversationManager.agents.forEach(agent => {
            if (agent.setAsDerailer) {
              agent.setAsDerailer(false);
            }
          });
        }
        break;
    }
    
    console.log(`DEBUG - Updated conversation mode to ${mode}: requireImpromptuApproval=${conversationManager.requireImpromptuApproval}, autoApproveImpromptu=${conversationManager.autoApproveImpromptu}, derailingEnabled=${conversationManager.derailingEnabled}`);
    
    // If switching to autonomous mode and there's a pending impromptu phase, auto-approve it
    if (mode === 'autonomous' && conversationManager.pendingImpromptuPhase) {
      console.log(`DEBUG - Auto-approving pending impromptu phase due to mode change to autonomous`);
      conversationManager.handleImpromptuPhaseApproval(true);
    }
    
    res.send({ status: "success", mode });
  } catch (error) {
    console.error(`Error changing conversation mode:`, error);
    res.status(500).send({ error: "Failed to change conversation mode" });
  }
});

// Add endpoint for modifying a message before approval
app.post('/api/impromptu/edit-message', async (req, res) => {
  try {
    if (!conversationManager) {
      return res.status(404).json({ error: 'No active conversation manager' });
    }

    const { messageContent } = req.body;
    
    console.log('Handling impromptu message edit:', messageContent.substring(0, 30) + '...');
    
    if (!conversationManager.pendingImpromptuPhase) {
      return res.status(404).json({ error: 'No pending impromptu phase to edit' });
    }

    // Update the message content in the pending impromptu phase
    if (conversationManager.pendingImpromptuPhase.response) {
      // Update both content and message fields to ensure compatibility
      conversationManager.pendingImpromptuPhase.response.content = messageContent;
      conversationManager.pendingImpromptuPhase.response.message = messageContent;
      
      // Also find and update the message in the conversation array if it exists
      if (conversationManager.conversation) {
        const pendingMsgIndex = conversationManager.conversation.findIndex(msg => 
          msg.needsApproval === true && msg.isDerailing === true
        );
        
        if (pendingMsgIndex !== -1) {
          conversationManager.conversation[pendingMsgIndex].content = messageContent;
          conversationManager.conversation[pendingMsgIndex].message = messageContent;
          console.log('Updated pending message in conversation array');
        }
      }
      
      console.log('Updated pending impromptu message content');
    } else {
      console.warn('No response object found in pendingImpromptuPhase');
    }

    res.status(200).json({ success: true, message: 'Message updated successfully' });
    
  } catch (error) {
    console.error('Error editing impromptu message:', error);
    res.status(500).json({ error: 'Failed to edit message', details: error.message });
  }
});

// Add new endpoint for regenerating an impromptu message with a specific mode
app.post('/api/impromptu/regenerate-with-mode', async (req, res) => {
  try {
    if (!conversationManager) {
      return res.status(404).json({ error: 'No active conversation manager' });
    }

    const { mode } = req.body;
    console.log(`Regenerating impromptu message with mode: ${mode}`);
    
    if (!conversationManager.pendingImpromptuPhase) {
      return res.status(404).json({ error: 'No pending impromptu phase to regenerate' });
    }
    
    // Get the derailer agent
    const derailerName = conversationManager.pendingImpromptuPhase.derailerAgent.name;
    const derailerAgent = conversationManager.getAgentByName(derailerName);
    
    if (!derailerAgent) {
      return res.status(404).json({ error: `Could not find derailer agent: ${derailerName}` });
    }
    
    // Use the original derail mode if no new mode is specified
    const derailMode = mode || derailerAgent.derailMode;
    
    // Temporarily set the agent's derail mode to the requested mode
    const originalMode = derailerAgent.derailMode;
    derailerAgent.setDerailMode(derailMode);
    
    // Find the message before the derailing message in the conversation
    const conversation = conversationManager.conversation;
    let lastNonDerailingMessage = null;
    
    // Find the current derailing message index
    const derailingMessageIndex = conversation.findIndex(msg => 
      msg.sender === derailerName && 
      msg.isDerailing && 
      msg.needsApproval
    );
    
    if (derailingMessageIndex > 0) {
      // Get the last non-system message before the derailing message
      for (let i = derailingMessageIndex - 1; i >= 0; i--) {
        if (!conversation[i].isSystemMessage) {
          lastNonDerailingMessage = conversation[i];
          break;
        }
      }
    }
    
    // Get the content from the last non-derailing message
    const lastMessageContent = lastNonDerailingMessage ? 
      (lastNonDerailingMessage.message || lastNonDerailingMessage.content || '') : 
      '';
    
    console.log(`Using context from message by ${lastNonDerailingMessage?.sender}: "${lastMessageContent.substring(0, 50)}..."`);
    
    // Generate a new derailing response with the specified mode
    console.log(`Generating derailing response in ${derailMode} mode using context: "${lastMessageContent.substring(0, 50)}..."`);
    
    try {
      // Set up streaming response
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      });
      
      // Generate the new derailing response
      const derailResponse = await derailerAgent.generateDerailResponse(lastMessageContent);
      
      if (!derailResponse) {
        throw new Error('Failed to generate derailing response');
      }
      
      // Update the pending impromptu phase with the new response
      if (conversationManager.pendingImpromptuPhase && conversationManager.pendingImpromptuPhase.response) {
        // Store the original response's metadata
        const originalResponse = conversationManager.pendingImpromptuPhase.response;
        
        // Create an updated response with the new content but preserving other properties
        const updatedResponse = {
          ...originalResponse,
          message: derailResponse.fullResponse,
          content: derailResponse.fullResponse,
          derailMode: derailMode,
          regenerated: true,
          needsApproval: true, // Ensure needsApproval is set for regenerated messages
          isApproved: false,   // Reset approval state
          isDerailing: true    // Ensure isDerailing is set
        };
        
        // Update the response in the pending impromptu phase
        conversationManager.pendingImpromptuPhase.response = updatedResponse;
        conversationManager.pendingImpromptuPhase.derailMode = derailMode;
        
        console.log(`Updated pending impromptu phase with new ${derailMode} response: "${derailResponse.fullResponse.substring(0, 50)}..."`);
        
        // Send the updated message to the client
        res.write(JSON.stringify({
          type: "regenerated_message",
          message: updatedResponse,
          success: true,
          mode: derailMode
        }));
        res.end();
      } else {
        // If there's no existing response, create a new one
        const newResponse = {
          sender: derailerAgent.name,
          message: derailResponse.fullResponse,
          content: derailResponse.fullResponse,
          isDerailing: true,
          needsApproval: true,
          isApproved: false,
          derailMode: derailMode,
          regenerated: true,
          timestamp: Date.now()
        };
        
        // Set this as the new response
        if (conversationManager.pendingImpromptuPhase) {
          conversationManager.pendingImpromptuPhase.response = newResponse;
          conversationManager.pendingImpromptuPhase.derailMode = derailMode;
        }
        
        console.log(`Created new ${derailMode} response for pending impromptu phase: "${derailResponse.fullResponse.substring(0, 50)}..."`);
        
        // Send the new message to the client
        res.write(JSON.stringify({
          type: "regenerated_message",
          message: newResponse,
          success: true,
          mode: derailMode
        }));
        res.end();
      }
    } catch (error) {
      console.error('Error generating derailing response:', error);
      
      // Restore the original derail mode
      derailerAgent.setDerailMode(originalMode);
      
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate derailing response', details: error.message });
      } else {
        res.write(JSON.stringify({ 
          type: "error", 
          error: 'Failed to generate derailing response',
          details: error.message 
        }));
        res.end();
      }
    }
    
    // Restore the original derail mode
    derailerAgent.setDerailMode(originalMode);
    
  } catch (error) {
    console.error('Error regenerating impromptu message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to regenerate message', details: error.message });
    } else {
      res.write(JSON.stringify({ type: "error", error: error.message }));
      res.end();
    }
  }
});

app.listen(port, () => {
  console.log(`example app listening at port:${port}`);
});

// Initialize API keys from environment if provided
if (process.env.OPENAI_API_KEY && typeof llmProvider.setOpenAIApiKey === 'function') {
  llmProvider.setOpenAIApiKey(process.env.OPENAI_API_KEY);
}
if (process.env.GEMINI_API_KEY) {
  try {
    // Lazy import to avoid circular deps if any
    const { setGeminiApiKey } = await import('./providers/geminiAPI.js');
    setGeminiApiKey(process.env.GEMINI_API_KEY);
  } catch (e) {
    console.warn('Failed to initialize GEMINI_API_KEY from env:', e.message);
  }
}
if (process.env.TTS_API_KEY) {
  setTtsApiKey(process.env.TTS_API_KEY);
}

// Initialize provider from environment
if (process.env.LLM_PROVIDER && typeof llmProvider.setProvider === 'function') {
  try {
    llmProvider.setProvider(process.env.LLM_PROVIDER.toLowerCase());
  } catch (e) {
    console.warn('Invalid LLM_PROVIDER in env, using default:', e.message);
  }
}
