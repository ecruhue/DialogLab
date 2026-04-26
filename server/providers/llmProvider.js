import * as geminiAPI from './geminiAPI.js';

// Model configurations
const MODELS = {
  GEMINI: geminiAPI.GEMINI_MODELS
};

let defaultGeminiModel = geminiAPI.GEMINI_MODELS.FLASH_LITE;

function setDefaultModel(model) {
  if (Object.values(MODELS.GEMINI).includes(model)) {
    defaultGeminiModel = model;
    console.log(`Default Gemini model set to: ${model}`);
  } else {
    throw new Error(`Invalid Gemini model: ${model}`);
  }
}

function getAvailableModels() {
  return MODELS.GEMINI;
}

function getCurrentModel() {
  return defaultGeminiModel;
}

async function generateText(prompt, options = {}) {
  const geminiOptions = { ...options };
  if (!geminiOptions.model) {
    geminiOptions.model = defaultGeminiModel;
  }
  return geminiAPI.generateText(prompt, geminiOptions);
}

async function chatCompletion(messages, options = {}) {
  const geminiOptions = { ...options };
  if (!geminiOptions.model) {
    geminiOptions.model = defaultGeminiModel;
  }
  return geminiAPI.chatCompletion(messages, geminiOptions);
}

export {
  MODELS,
  setDefaultModel,
  getAvailableModels,
  getCurrentModel,
  generateText,
  chatCompletion
};
