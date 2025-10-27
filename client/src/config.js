/**
 * Internet configuration
 */

const isProduction = window.location.hostname !== 'localhost' && 
                    window.location.hostname !== '127.0.0.1';

// API configuration
export const API_CONFIG = {
  // Use chatlab.3dvar.com in production, localhost in development
  BASE_URL: isProduction ? 'https://chatlab.3dvar.com' : 'http://localhost:3010',
  
  // API endpoints
  ENDPOINTS: {
    START_CONVERSATION: '/api/start-conversation',
    BATCH_SYNTHESIZE: '/api/batch-synthesize',
    TTS: '/api/tts',
    IMPROMPTU_APPROVE: '/api/impromptu/approve',
    IMPROMPTU_REJECT: '/api/impromptu/reject',
    IMPROMPTU_EDIT: '/api/impromptu/edit-message',
    IMPROMPTU_REGENERATE_WITH_MODE: '/api/impromptu/regenerate-with-mode',
    CONVERSATION_MODE: '/api/conversation/mode',
    LLM_MODELS: '/api/llm-models',
    UPDATE_MODEL: '/api/update-model',
    SET_LLM_PROVIDER: '/api/llm-provider',
    SET_LLM_KEYS: '/api/llm-keys',
    LLM_STATUS: '/api/llm-status',
    VERIFICATION_CALCULATE_COHERENCE: '/api/verification/calculate-coherence',
    VERIFICATION_ASK_AGENT: '/api/verification/ask-agent',
    GENERATE_CONVERSATION_PROMPT: '/api/generate-conversation-prompt',
    CONTENT_UPLOAD: '/api/content/upload',
    CONTENT_LIST: '/api/content/list',
  }
};

export default API_CONFIG; 