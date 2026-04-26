import * as llmProvider from './providers/llmProvider.js';
import { setGeminiApiKey, isGeminiConfigured } from './providers/geminiAPI.js';
import { setTtsApiKey, isTtsConfigured } from './tts.js';

/**
 * Sets up model-related API routes for the Express app
 * @param {object} app - The Express app instance
 */
export function setupModelRoutes(app) {
  /**
   * GET /api/llm-models - Get available models and current provider
   */
  app.get("/api/llm-models", (req, res) => {
    try {
      res.json({
        status: "success",
        currentProvider: llmProvider.getProvider(),
        availableModels: llmProvider.getAvailableModels(),
        currentModel: llmProvider.getCurrentModel()
      });
    } catch (error) {
      console.error("Error getting LLM models:", error);
      res.status(500).json({ 
        status: "error", 
        message: "Failed to get LLM models",
        error: error.message 
      });
    }
  });

  /**
   * POST /api/update-model - Update the default model for a provider
   */
  app.post("/api/update-model", (req, res) => {
    try {
      const { provider, model } = req.body;
      
      if (!provider || !model) {
        return res.status(400).json({ 
          status: "error", 
          message: "Provider and model are required" 
        });
      }
      
      console.log(`Attempting to update model: provider=${provider}, model=${model}`);
      
      // Update the model for the specified provider
      try {
        llmProvider.setDefaultModel(provider, model);
        
        // Return success response with current settings
        res.json({ 
          status: "success", 
          message: `Model updated to ${model} for ${provider}`,
          currentProvider: llmProvider.getProvider(),
          availableModels: llmProvider.getAvailableModels(),
          currentModel: llmProvider.getCurrentModel()
        });
      } catch (modelError) {
        // Handle model validation errors specifically
        console.error(`Error setting model: ${modelError.message}`);
        res.status(400).json({ 
          status: "error", 
          message: modelError.message,
          provider,
          model
        });
      }
    } catch (error) {
      console.error("Error processing update-model request:", error);
      res.status(500).json({ 
        status: "error", 
        message: "Failed to update model",
        error: error.message 
      });
    }
  });

  /**
   * POST /api/llm-keys - Set API keys for providers
   * { provider: 'openai'|'gemini'|'azure', apiKey: '...' }
   */
  app.post("/api/llm-keys", (req, res) => {
    try {
      const { provider, apiKey } = req.body || {};
      if (!provider || !apiKey) {
        return res.status(400).json({ status: 'error', message: 'provider and apiKey are required' });
      }

      if (provider === 'openai') {
        if (typeof llmProvider.setOpenAIApiKey === 'function') {
          llmProvider.setOpenAIApiKey(apiKey);
        }
      } else if (provider === 'gemini') {
        setGeminiApiKey(apiKey);
      } else if (provider === 'azure') {
      } else if (provider === 'tts') {
        setTtsApiKey(apiKey);
      } else {
        return res.status(400).json({ status: 'error', message: 'Unsupported provider' });
      }

      return res.json({ status: 'success' });
    } catch (error) {
      console.error('Error setting API key:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to set API key' });
    }
  });

  /**
   * GET /api/llm-status - Simple status of LLM configuration
   */
  app.get("/api/llm-status", (req, res) => {
    try {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      return res.json({
        status: 'success',
        geminiConfigured: isGeminiConfigured(),
        openaiConfigured: typeof llmProvider.isOpenAIConfigured === 'function' ? llmProvider.isOpenAIConfigured() : false,
        azureConfigured: typeof llmProvider.isAzureConfigured === 'function' ? llmProvider.isAzureConfigured() : false,
        ttsConfigured: isTtsConfigured(),
        currentProvider: typeof llmProvider.getProvider === 'function' ? llmProvider.getProvider() : 'gemini'
      });
    } catch (error) {
      console.error('Error getting LLM status:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to get status' });
    }
  });

  /**
   * POST /api/llm-provider - Set the active LLM provider
   * { provider: 'openai'|'gemini'|'azure' }
   */
  app.post("/api/llm-provider", (req, res) => {
    try {
      const { provider } = req.body || {};
      if (!provider || !['openai', 'gemini', 'azure'].includes(provider)) {
        return res.status(400).json({ status: 'error', message: 'provider must be "openai", "gemini", or "azure"' });
      }
      if (typeof llmProvider.setProvider === 'function') {
        llmProvider.setProvider(provider);
      }
      return res.json({ status: 'success', currentProvider: llmProvider.getProvider() });
    } catch (error) {
      console.error('Error setting provider:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to set provider' });
    }
  });

  /**
   * POST /api/azure-config - Configure Azure OpenAI
   * { endpoint: '...', apiKey: '...', deployment: '...', apiVersion: '...' }
   */
  app.post("/api/azure-config", (req, res) => {
    try {
      const { endpoint, apiKey, deployment = 'gpt-5.4-nano', apiVersion = '2024-12-01-preview' } = req.body || {};
      
      if (!endpoint || !apiKey) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'endpoint and apiKey are required' 
        });
      }

      if (typeof llmProvider.configureAzureOpenAI === 'function') {
        const success = llmProvider.configureAzureOpenAI(endpoint, apiKey, deployment, apiVersion);
        if (success) {
          return res.json({ 
            status: 'success', 
            message: 'Azure OpenAI configured successfully',
            config: llmProvider.getAzureConfig()
          });
        } else {
          return res.status(400).json({ 
            status: 'error', 
            message: 'Failed to configure Azure OpenAI' 
          });
        }
      }

      return res.status(400).json({ status: 'error', message: 'Azure configuration not available' });
    } catch (error) {
      console.error('Error configuring Azure OpenAI:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to configure Azure' });
    }
  });

  /**
   * GET /api/azure-config - Get current Azure OpenAI configuration
   */
  app.get("/api/azure-config", (req, res) => {
    try {
      if (typeof llmProvider.getAzureConfig === 'function') {
        return res.json({ 
          status: 'success', 
          config: llmProvider.getAzureConfig()
        });
      }
      return res.status(400).json({ status: 'error', message: 'Azure configuration not available' });
    } catch (error) {
      console.error('Error getting Azure config:', error);
      return res.status(500).json({ status: 'error', message: 'Failed to get Azure config' });
    }
  });
} 