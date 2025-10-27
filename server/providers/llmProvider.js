import axios from 'axios';
import * as geminiAPI from './geminiAPI.js';

// LLM Provider types
const PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini'
};

// Model configurations for each provider
const MODELS = {
  OPENAI: {
    DEFAULT: 'gpt-4',
    GPT35: 'gpt-3.5-turbo',
    GPT4: 'gpt-4',
    GPT4_TURBO: 'gpt-4-turbo'
  },
  GEMINI: geminiAPI.GEMINI_MODELS
};

// Default provider and models
let currentProvider = PROVIDERS.GEMINI;
let defaultOpenAIModel = MODELS.OPENAI.DEFAULT;
let defaultGeminiModel = geminiAPI.GEMINI_MODELS.FLASH;

// API keys (mutable at runtime)
let openAIApiKey;
let openAIConfigured = false;

/**
 * Set the current LLM provider
 * @param {string} provider - The provider to use (from PROVIDERS enum)
 */
function setProvider(provider) {
  if (Object.values(PROVIDERS).includes(provider)) {
    currentProvider = provider;
    console.log(`LLM Provider set to: ${provider}`);
  } else {
    throw new Error(`Invalid provider: ${provider}. Valid options are: ${Object.values(PROVIDERS).join(', ')}`);
  }
}

/**
 * Set the default model for a provider
 * @param {string} provider - The provider to set the model for
 * @param {string} model - The model to use as default
 */
function setDefaultModel(provider, model) {
  if (provider === PROVIDERS.OPENAI) {
    if (Object.values(MODELS.OPENAI).includes(model)) {
      defaultOpenAIModel = model;
      console.log(`Default OpenAI model set to: ${model}`);
    } else {
      throw new Error(`Invalid OpenAI model: ${model}`);
    }
  } else if (provider === PROVIDERS.GEMINI) {
    if (Object.values(MODELS.GEMINI).includes(model)) {
      defaultGeminiModel = model;
      console.log(`Default Gemini model set to: ${model}`);
    } else {
      throw new Error(`Invalid Gemini model: ${model}`);
    }
  } else {
    throw new Error(`Invalid provider: ${provider}`);
  }
}

/**
 * Get the current LLM provider
 * @returns {string} The current provider
 */
function getProvider() {
  return currentProvider;
}

/**
 * Get all available models for the current provider
 * @returns {object} Available models
 */
function getAvailableModels() {
  return currentProvider === PROVIDERS.GEMINI ? MODELS.GEMINI : MODELS.OPENAI;
}

/**
 * Get the currently configured default model for the active provider
 * @returns {string}
 */
function getCurrentModel() {
  return currentProvider === PROVIDERS.GEMINI ? defaultGeminiModel : defaultOpenAIModel;
}

/**
 * Generate text from a prompt using the current provider
 * @param {string} prompt - The prompt to send
 * @param {object} options - Configuration options
 * @returns {Promise<string>} The generated text
 */
async function generateText(prompt, options = {}) {
  const provider = options.provider || currentProvider;
  if (provider === PROVIDERS.GEMINI) {
    // Set the default Gemini model if not specified
    const geminiOptions = { ...options };
    if (!geminiOptions.model) {
      geminiOptions.model = defaultGeminiModel;
    }
    return geminiAPI.generateText(prompt, geminiOptions);
  } else {
    // OpenAI
    try {
      const key = options.apiKey || openAIApiKey;
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: options.model || defaultOpenAIModel,
          messages: [{ role: "user", content: prompt }],
          max_tokens: options.maxTokens || 150,
          temperature: options.temperature || 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      throw error;
    }
  }
}

/**
 * Generate a chat completion using the current provider
 * @param {Array} messages - Array of message objects with role and content
 * @param {object} options - Configuration options
 * @returns {Promise<string>} The generated response
 */
async function chatCompletion(messages, options = {}) {
  const provider = options.provider || currentProvider;
  if (provider === PROVIDERS.GEMINI) {
    
    // Set the default Gemini model if not specified
    const geminiOptions = { ...options };
    if (!geminiOptions.model) {
      geminiOptions.model = defaultGeminiModel;
    }
    return geminiAPI.chatCompletion(messages, geminiOptions);
  } else {
    // OpenAI
    try {
      const key = options.apiKey || openAIApiKey;
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: options.model || defaultOpenAIModel,
          messages: messages,
          max_tokens: options.maxTokens || 150,
          temperature: options.temperature || 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      throw error;
    }
  }
}

export { 
  PROVIDERS, 
  MODELS,
  setProvider, 
  getProvider,
  setDefaultModel,
  getAvailableModels,
  getCurrentModel,
  generateText, 
  chatCompletion 
}; 

/**
 * Set the OpenAI API key at runtime
 * @param {string} apiKey
 */
export function setOpenAIApiKey(apiKey) {
  openAIApiKey = apiKey;
  openAIConfigured = Boolean(apiKey && String(apiKey).trim().length > 0);
}

/**
 * Check whether OpenAI API is configured
 * @returns {boolean}
 */
export function isOpenAIConfigured() {
  return openAIConfigured;
}


