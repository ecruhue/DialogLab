import * as llmProvider from './providers/llmProvider.js';

/**
 * Helper function to extract JSON from markdown code blocks if present
 * @param {string} text - The text potentially containing markdown-formatted JSON
 * @returns {string} Clean JSON text
 */
const extractJson = (text) => {
  // Check if the text is wrapped in markdown code blocks
  const jsonRegex = /```(?:json)?\s*(\{[\s\S]*\})\s*```/;
  const match = text.match(jsonRegex);
  
  if (match && match[1]) {
    return match[1].trim();
  }
  
  return text.trim();
};

/**
 * Calculate coherence and sentiment scores for a conversation
 * @param {Array} segments - Array of conversation segments
 * @returns {Promise<Object>} Analysis results with coherence and sentiment scores
 */
export async function calculateCoherenceAndSentiment(segments, llmOptions = {}) {
  if (!segments || !Array.isArray(segments)) {
    throw new Error('Invalid segments data');
  }

  // Filter out system messages and prepare conversation text
  const nonSystemSegments = segments.filter(segment => 
    segment.message?.message && !segment.message.isSystemMessage
  );
  
  const conversationText = nonSystemSegments
    .map(segment => `${segment.avatarName}: ${segment.message.message}`)
    .join('\n');

  if (!conversationText) {
    throw new Error('No valid conversation text found');
  }

  // Prepare prompt for LLM to analyze both coherence and sentiment
  const prompt = `Analyze the following conversation and provide:
  1. A coherence score between 0 and 1, where:
    - 1.0 means perfect coherence (conversation stays on topic, responses are relevant)
    - 0.0 means no coherence (conversation is completely disjointed, responses are irrelevant)

  2. An overall sentiment score between -1 and 1, where:
    - 1.0 means very positive sentiment
    - 0.0 means neutral sentiment
    - -1.0 means very negative sentiment

  3. Individual sentiment scores for each participant, using the same -1 to 1 scale.

  Consider:
  - Topic consistency and response relevance
  - Emotional tone and word choice
  - Interaction patterns between participants

  Conversation:
  ${conversationText}

  Format your response as a JSON object with this structure:
  {
    "coherenceScore": (number between 0-1),
    "overallSentiment": (number between -1 and 1),
    "sentiment": {
      "participantName1": (sentiment score between -1 and 1),
      "participantName2": (sentiment score between -1 and 1),
      ...
    }
  }`;

  try {
    // Get response from LLM
    const response = await llmProvider.generateText(prompt, { 
      requestJson: true,
      temperature: 0.2,
      ...llmOptions
    });
    
    // Extract JSON from markdown code blocks if needed, then parse
    const jsonText = extractJson(response);
    const analysisResult = JSON.parse(jsonText);
    
    // Create a mapping of participant names to IDs
    const nameToIdMap = {};
    nonSystemSegments.forEach(segment => {
      if (segment.avatarName && segment.avatarId) {
        nameToIdMap[segment.avatarName] = segment.avatarId;
      }
    });
    
    // Convert name-based sentiment to ID-based sentiment
    const idBasedSentiment = {};
    if (analysisResult.sentiment) {
      Object.entries(analysisResult.sentiment).forEach(([name, score]) => {
        const id = nameToIdMap[name] || name;
        idBasedSentiment[id] = score;
      });
    }
    
    // Validate and ensure all required fields are present
    const coherenceScore = Number(analysisResult.coherenceScore) || 0;
    const overallSentiment = Number(analysisResult.overallSentiment) || 0;
    console.log(`Analysis results: coherence=${coherenceScore}, overall sentiment=${overallSentiment}, individual sentiments for ${Object.keys(idBasedSentiment).length} participants`);
    
    // Format all numerical values to 2 decimal places
    const formattedCoherenceScore = parseFloat(Math.max(0, Math.min(1, coherenceScore)).toFixed(2));
    const formattedOverallSentiment = parseFloat(Math.max(-1, Math.min(1, overallSentiment)).toFixed(2));
    const formattedSentiment = {};

    // Format individual sentiment scores
    Object.entries(idBasedSentiment).forEach(([id, score]) => {
      formattedSentiment[id] = parseFloat(parseFloat(score).toFixed(2));
    });
    
    // Return the formatted result
    return {
      coherenceScore: formattedCoherenceScore,
      overallSentiment: formattedOverallSentiment,
      sentiment: formattedSentiment
    };
  } catch (error) {
    console.error('Error in calculateCoherenceAndSentiment:', error);
    
    // Try to extract coherence score if possible
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      try {
        // Generate a fallback response with basic coherence analysis
        // Extract just the coherence score using regex if possible
        const coherenceMatch = response.match(/coherence(?:\s+)?(?:score)?(?:\s*)?(?::|=|is)(?:\s*)?([0-9.]+)/i);
        const coherenceScore = coherenceMatch ? parseFloat(coherenceMatch[1]) : 0.5;
        
        return {
          coherenceScore: parseFloat(Math.max(0, Math.min(1, coherenceScore)).toFixed(2)),
          overallSentiment: 0,
          sentiment: {}
        };
      } catch (fallbackError) {
        console.error('Error in fallback parsing:', fallbackError);
      }
    }
    
    // Default fallback
    return {
      coherenceScore: 0,
      overallSentiment: 0,
      sentiment: {}
    };
  }
}

/**
 * Ask an LLM agent questions about a conversation
 * @param {Object} verificationData - Verification data containing the conversation
 * @param {string} question - The question to ask the LLM
 * @returns {Promise<Object>} Answer from the LLM
 */
export async function askAgentQuestions(verificationData, question, llmOptions = {}) {
  if (!verificationData || !question) {
    throw new Error('Invalid request data');
  }

  // Extract conversation segments
  const segments = verificationData.segments || [];
  
  // Filter out system messages and prepare conversation text
  const nonSystemSegments = segments.filter(segment => 
    segment.message?.message && !segment.message.isSystemMessage
  );
  
  const conversationText = nonSystemSegments
    .map(segment => `${segment.avatarName}: ${segment.message.message}`)
    .join('\n');

  if (!conversationText) {
    throw new Error('No valid conversation text found');
  }

  // Prepare prompt for LLM
  const prompt = `You are an insightful conversation analyst. You have access to the transcript of a conversation, along with 
  metrics about it such as participation time, turn-taking frequency, speaking balance, and sentiment.

  Here's the conversation transcript:
  ${conversationText}

  Here are the conversation metrics:
  - Participation time: ${JSON.stringify(verificationData.metrics.participationTime)}
  - Turn-taking frequency: ${JSON.stringify(verificationData.metrics.turnTakingFrequency)}
  - Speaking balance: ${verificationData.metrics.speakingBalance}
  - Overall sentiment: ${verificationData.metrics.overallSentiment}
  - Individual sentiment: ${JSON.stringify(verificationData.metrics.sentiment)}
  - Coherence score: ${verificationData.metrics.coherenceScore}
  - Interruptions: ${JSON.stringify(verificationData.metrics.interruptions)}

  Based on this information, please answer the following question as accurately and insightfully as possible, but be concise and to the point:

  Question: ${question}`;

  try {
    // Get response from the specified LLM
    const response = await llmProvider.generateText(prompt, {
      maxTokens: 500, temperature: 0.7,
      ...llmOptions
    });

    return { answer: response };
  } catch (error) {
    console.error('Error in askAgentQuestions:', error);
    throw new Error('Failed to get answer from LLM');
  }
}

/**
 * Express middleware to handle verification API endpoint requests
 * @param {object} app - Express app instance
 */
export function setupVerificationRoutes(app) {
  // Add endpoint for coherence score calculation
  app.post('/api/verification/calculate-coherence', async (req, res) => {
    try {
      const { segments } = req.body;
      
      if (!segments || !Array.isArray(segments)) {
        return res.status(400).json({ error: 'Invalid segments data' });
      }

      const llmOptions = {
        provider: req.headers['x-llm-provider'],
        apiKey: req.headers['x-llm-key']
      };
      const result = await calculateCoherenceAndSentiment(segments, llmOptions);
      res.json(result);
    } catch (error) {
      console.error('Error calculating conversation analysis:', error);
      res.status(500).json({ 
        error: 'Failed to analyze conversation',
        coherenceScore: 0,
        overallSentiment: 0,
        sentiment: {}
      });
    }
  });

  // Add new endpoint for agent questions with the path /api/verification/ask-agent
  app.post('/api/verification/ask-agent', async (req, res) => {
    try {
      const { verificationData, question, model = 'gpt-4' } = req.body;
      
      if (!verificationData || !question) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const llmOptions = {
        provider: req.headers['x-llm-provider'],
        apiKey: req.headers['x-llm-key'],
        model
      };
      const result = await askAgentQuestions(verificationData, question, llmOptions);
      res.json(result);
    } catch (error) {
      console.error('Error asking agent questions:', error);
      res.status(500).json({ 
        error: 'Failed to get answer from LLM',
        answer: 'Sorry, I was unable to process your question at this time.'
      });
    }
  });
} 