import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// API key is set at runtime via setGeminiApiKey
let CURRENT_API_KEY;

// Gemini API client is initialized after key is provided
let genAI = null;

const GEMINI_MODELS = {          
  FLASH_LITE: "gemini-2.0-flash-lite",
  FLASH: "gemini-2.0-flash",
};

// Default model
const DEFAULT_MODEL = GEMINI_MODELS.FLASH;

/**
 * Gets the appropriate Gemini model
 * @param {string} modelName - The model name to use, defaults to DEFAULT_MODEL
 * @returns {object} The Gemini model instance
 */
function getModel(modelName = DEFAULT_MODEL) {
  try {
    if (!genAI) {
      throw new Error('Gemini API key is not set. Please set it first.');
    }
    return genAI.getGenerativeModel({ model: modelName });
  } catch (error) {
    console.error(`Error getting model ${modelName}, falling back to legacy model:`, error);
    if (!genAI) {
      throw error;
    }
    return genAI.getGenerativeModel({ model: GEMINI_MODELS.LEGACY_PRO });
  }
}

/**
 * Formats a prompt to ensure structured data responses (like JSON) are returned correctly
 * @param {string} prompt - The original prompt
 * @param {boolean} requestJson - Whether JSON is being requested
 * @returns {string} The formatted prompt
 */
function formatPrompt(prompt, requestJson = false) {
  if (requestJson) {
    return `${prompt}\n\nIMPORTANT: Return ONLY the raw JSON without any markdown, code formatting, or explanation. The response should parse directly as JSON.`;
  }
  return prompt;
}

/**
 * Read a file as Uint8Array for file attachments
 * @param {string} filepath - Path to the file
 * @returns {Promise<Uint8Array>} The file data
 */
async function readFileAsBytes(filepath) {
  try {
    if (!fs.existsSync(filepath)) {
      console.error(`File not found at: ${filepath}`);
      return null;
    }
    
    return new Uint8Array(fs.readFileSync(filepath));
  } catch (error) {
    console.error(`Error reading file ${filepath}:`, error);
    return null;
  }
}

/**
 * Generates text using Gemini API
 * @param {string} prompt - The prompt to send to Gemini
 * @param {object} options - Configuration options
 * @param {number} options.maxTokens - Maximum number of tokens to generate
 * @param {number} options.temperature - Sampling temperature (0.0 to 1.0)
 * @param {string} options.model - Specific model to use
 * @param {boolean} options.requestJson - Whether to format the prompt for JSON response
 * @param {string|object} options.contentAttachment - Optional content attachment to include with the prompt
 * @returns {Promise<string>} The generated text
 */
async function generateText(prompt, options = {}) {
  try {
    // Allow per-request API key by temporarily creating a client
    const modelName = options.model || DEFAULT_MODEL;
    let client = genAI;
    if (options.apiKey) {
      client = new GoogleGenerativeAI(String(options.apiKey).trim());
    }
    const model = (client || genAI).getGenerativeModel({ model: modelName });
    
    const generationConfig = {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 100,
    };

    // Format the prompt for structured data if needed
    let formattedPrompt = formatPrompt(prompt, options.requestJson);
    
    // Prepare message parts
    let parts = [{ text: formattedPrompt }];
    
    // Handle file attachment if provided
    if (options.contentAttachment) {
      if (typeof options.contentAttachment === 'string') {
        // Text attachment
        parts.push({ text: options.contentAttachment });
      } else if (typeof options.contentAttachment === 'object') {
        // File attachment (PDF)
        if (options.contentAttachment.filepath && path.extname(options.contentAttachment.filepath).toLowerCase() === '.pdf') {
          console.log(`Attaching PDF file: ${options.contentAttachment.filepath}`);
          
          const fileData = await readFileAsBytes(options.contentAttachment.filepath);
          if (fileData) {
            parts.push({ 
              inlineData: {
                mimeType: "application/pdf",
                data: Buffer.from(fileData).toString('base64')
              }
            });
            
            // Add description of the content
            parts.push({ 
              text: `This is ${options.contentAttachment.description || 'the attached document'}. ${options.contentAttachment.isPresenter ? 'You are presenting this document.' : 'Someone else is presenting this document.'}`
            });
          } else {
            // Fall back to text description if file can't be read
            parts.push({ text: `[Failed to attach PDF. Using description instead]: ${options.contentAttachment.textPrompt || options.contentAttachment.description || 'content attachment'}` });
          }
        } else if (options.contentAttachment.textPrompt) {
          // Text prompt from content object
          parts.push({ text: options.contentAttachment.textPrompt });
        }
      }
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
    });

    return result.response.text();
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw error;
  }
}

/**
 * Chat completion using Gemini API
 * @param {Array} messages - Array of message objects with role and content
 * @param {object} options - Configuration options
 * @param {string} options.model - Specific model to use
 * @param {boolean} options.requestJson - Whether to format the last message for JSON response
 * @param {string|object} options.contentAttachment - Optional content attachment to include with the chat
 * @returns {Promise<string>} The generated response
 */
async function chatCompletion(messages, options = {}) {
  try {
    const modelName = options.model || DEFAULT_MODEL;
    let client = genAI;
    if (options.apiKey) {
      client = new GoogleGenerativeAI(String(options.apiKey).trim());
    }
    const model = (client || genAI).getGenerativeModel({ model: modelName });
    
    const generationConfig = {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 100,
    };

    // Convert from OpenAI format to Gemini format
    const geminiMessages = messages.map((msg, index) => {
      // If this is the last message and JSON is requested, format the prompt
      let content = msg.content;
      if (index === messages.length - 1) {
        if (options.requestJson) {
          content = formatPrompt(content, true);
        }
      }
      
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: content }]
      };
    });

    const chat = model.startChat({
      generationConfig,
    });
    
    // For simpler implementation, just use the last message
    // This is more reliable with different Gemini models
    const lastMsg = geminiMessages[geminiMessages.length - 1];
    let parts = [{ text: lastMsg.parts[0].text }];
    
    // Handle file attachment for the last message if provided
    if (options.contentAttachment && lastMsg.role === 'user') {
      if (typeof options.contentAttachment === 'string') {
        // Text attachment
        parts.push({ text: options.contentAttachment });
      } else if (typeof options.contentAttachment === 'object') {
        // File attachment (PDF)
        if (options.contentAttachment.filepath && path.extname(options.contentAttachment.filepath).toLowerCase() === '.pdf') {
          console.log(`Attaching PDF file to chat: ${options.contentAttachment.filepath}`);
          
          const fileData = await readFileAsBytes(options.contentAttachment.filepath);
          if (fileData) {
            parts.push({ 
              inlineData: {
                mimeType: "application/pdf",
                data: Buffer.from(fileData).toString('base64')
              }
            });
            
            // Add description of the content
            parts.push({ 
              text: `This is ${options.contentAttachment.description || 'the attached document'}. ${options.contentAttachment.isPresenter ? 'You are presenting this document.' : 'Someone else is presenting this document.'}`
            });
          } else {
            // Fall back to text description if file can't be read
            parts.push({ text: `[Failed to attach PDF. Using description instead]: ${options.contentAttachment.textPrompt || options.contentAttachment.description || 'content attachment'}` });
          }
        } else if (options.contentAttachment.textPrompt) {
          // Text prompt from content object
          parts.push({ text: options.contentAttachment.textPrompt });
        }
      }
    }
    
    const result = await chat.sendMessage(parts);
    
    return result.response.text();
  } catch (error) {
    console.error("Error calling Gemini Chat API:", error);
    
    // Try with legacy model if different model was specified
    if (options.model && options.model !== GEMINI_MODELS.LEGACY_PRO) {
      console.log("Retrying with legacy model...");
      options.model = GEMINI_MODELS.LEGACY_PRO;
      return chatCompletion(messages, options);
    }
    
    throw error;
  }
}

export { GEMINI_MODELS, generateText, chatCompletion };

/**
 * Update the Gemini API key at runtime and reinitialize the client
 * @param {string} apiKey
 */
export function setGeminiApiKey(apiKey) {
  // Sanitize: remove whitespace and non-ASCII characters (e.g., EM DASH)
  const cleaned = String(apiKey)
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\x00-\x7F]/g, '');

  if (cleaned !== apiKey) {
    console.warn('Gemini API key contained whitespace or non-ASCII characters and was sanitized.');
  }

  // Basic validation: ensure only URL-safe characters
  if (!/^[A-Za-z0-9_\-]+$/.test(cleaned)) {
    throw new Error('Invalid Gemini API key: contains unsupported characters.');
  }

  CURRENT_API_KEY = cleaned;
  genAI = new GoogleGenerativeAI(CURRENT_API_KEY);
}

/**
 * Check whether Gemini API is configured (key present and client initialized)
 * @returns {boolean}
 */
export function isGeminiConfigured() {
  return Boolean(CURRENT_API_KEY && genAI);
}


