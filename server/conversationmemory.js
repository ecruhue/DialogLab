import axios from 'axios';
import dotenv from 'dotenv';
import * as llmProvider from './providers/llmProvider.js';
dotenv.config();

/**
 * Extracts clean JSON from a potentially markdown-wrapped response
 * @param {string} text - The text that might contain JSON
 * @returns {string} Cleaned JSON string
 */
function extractJsonFromText(text) {
  // Check if the response is wrapped in markdown code blocks
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const match = text.match(jsonRegex);
  
  if (match && match[1]) {
    // Return the content between the code blocks
    return match[1].trim();
  }
  
  // If no markdown wrapping, return the original text
  return text.trim();
}

class ConversationMemory {
    constructor(shortTermLimit = 3, summaryInterval = 5) {
      this.shortTermLimit = shortTermLimit;
      this.summaryInterval = summaryInterval;
      this.conversationHistory = [];
      this.summaries = [];
      this.lastSummaryIndex = 0;
      this.coveredPoints = new Set();  // Track points that have been discussed
      this.analogiesUsed = new Set();  // Track analogies that have been used
    }
  
    async generateSummary(messages) {
      const conversationText = messages
        .map(m => `${m.message}`)
        .join('\n');
  
      const prompt = `Summarize these messages in 2-3 concise points, focusing on:
  1. Main topics discussed
  2. Key decisions or agreements
  3. New concepts introduced
  
  Messages:
  ${conversationText}
  
  Format your response as clear, concise bullet points.`;
  
      try {
        return await llmProvider.generateText(prompt, { maxTokens: 150, temperature: 0.7 });
      } catch (error) {
        console.error("Error generating summary:", error);
        return "Error generating summary";
      }
    }
  
  
    async addMessage(message) {
      this.conversationHistory.push(message);

      // Extract and track key points and analogies
      await this.updateTracking(message);
  
      if (this.conversationHistory.length - this.lastSummaryIndex >= this.summaryInterval) {
        const messagesForSummary = this.conversationHistory.slice(
          this.lastSummaryIndex,
          this.conversationHistory.length
        );
        
        const summary = await this.generateSummary(messagesForSummary);
        this.summaries.push({
          startIndex: this.lastSummaryIndex,
          endIndex: this.conversationHistory.length - 1,
          summary: summary,
          coveredPoints: Array.from(this.coveredPoints),
          analogiesUsed: Array.from(this.analogiesUsed)
        });
        
        this.lastSummaryIndex = this.conversationHistory.length;
      }
    }
  
    async updateTracking(message) {
      const prompt = `Analyze this message and extract:
  1. Key points/concepts discussed
  2. Analogies or metaphors used
  
  Message: "${message.message}"
  
  Respond in JSON format ONLY, without any markdown formatting:
  {
    "points": ["point1", "point2"],
    "analogies": ["analogy1", "analogy2"]
  }`;
  
      try {
        // Use the requestJson option to ensure we get proper JSON formatting
        const rawResponse = await llmProvider.generateText(prompt, { 
          maxTokens: 150, 
          temperature: 0.7,
          requestJson: true 
        });
        
        // Clean the response as a backup in case requestJson option wasn't effective
        const cleanedResponse = extractJsonFromText(rawResponse);
        
        try {
          // Try to parse the raw response first
          let analysis;
          try {
            analysis = JSON.parse(rawResponse);
          } catch (initialParseError) {
            // If that fails, try the cleaned version
            analysis = JSON.parse(cleanedResponse);
          }
          
          // Handle the case where points or analogies might be missing
          if (analysis.points && Array.isArray(analysis.points)) {
            analysis.points.forEach(point => this.coveredPoints.add(point));
          } else {
            console.warn("Invalid points array in analysis response");
          }
          
          if (analysis.analogies && Array.isArray(analysis.analogies)) {
            analysis.analogies.forEach(analogy => this.analogiesUsed.add(analogy));
          } else {
            console.warn("Invalid analogies array in analysis response");
          }
        } catch (parseError) {
          console.error("Failed to parse JSON response:", parseError);
          console.log("Raw response:", rawResponse);
          console.log("Cleaned response:", cleanedResponse);
          
          // Create default empty arrays as fallback
          this.coveredPoints.add(`Message: ${message.message.substring(0, 30)}...`);
        }
      } catch (error) {
        console.error("Error analyzing message:", error);
      }
    }
  
    /**
     * Generates a summary of recent messages, excluding backchannels and system messages
     * @param {Array} messages - Array of messages to summarize
     * @returns {Promise<string>} - Summary of recent messages
     */
    async summarizeRecentMessages(messages) {
      // Filter out backchannel and system messages
      const filteredMessages = messages.filter(m => !m.isBackchannel && !m.isSystemMessage);
      
      if (filteredMessages.length === 0) {
        return "This is the first scene";
      }

      const conversationText = filteredMessages
        .map(m => `${m.sender}: ${m.message}`)
        .join('\n');
      
      const prompt = `Summarize these recent messages in 1-2 concise sentences, capturing the key points and flow of conversation:

      ${conversationText}

      Your summary should be brief but informative, focusing on the main ideas discussed.`;
      
      try {
        return await llmProvider.generateText(prompt, { maxTokens: 100, temperature: 0.7 });
      } catch (error) {
        console.error("Error generating recent messages summary:", error);
        // Fallback to a simple list if summarization fails
        return filteredMessages
          .map(m => `${m.sender}: ${m.message}`)
          .join('\n');
      }
    }
  
    async getContextualHistory() {
      // Filter out backchannel and system messages
      let filteredMessages = this.conversationHistory
        .filter(m => !m.isBackchannel && !m.isSystemMessage);
      
      // If we have fewer than shortTermLimit messages after filtering,
      // increase the slice size to get at least shortTermLimit messages if possible
      let sliceSize = this.shortTermLimit;
      let startIndex = Math.max(0, filteredMessages.length - sliceSize);
      
      const recentMessagesForSummary = filteredMessages.slice(startIndex);
      
      // Generate summary of recent messages
      const recentMessagesSummary = await this.summarizeRecentMessages(recentMessagesForSummary);

      // Get covered points and used analogies
      const coveredPointsList = Array.from(this.coveredPoints).join(', ');
      const analogiesList = Array.from(this.analogiesUsed).join(', ');
    
      return {
        recentMessages: recentMessagesSummary,
        historicalContext: `
        Points already covered: ${coveredPointsList}

        Previous discussion summaries:
        ${this.summaries.map(s => s.summary).join('\n')}`,
                fullContext: `Key points covered so far:
        - ${coveredPointsList}

        Recent discussion summary:
        ${recentMessagesSummary}

        Remember to:
        - Avoid repeating analogies already used (${analogiesList})
        - Build on previous points rather than restating them
        - Add new information or perspective to the discussion`
              };
    }
  
    // Method to remove a specific message from history
    removeMessageFromHistory(messageToRemove) {
      if (!messageToRemove) return;
      
      // Find the message in the history
      const messageIndex = this.conversationHistory.findIndex(m => 
        (m.sender === messageToRemove.sender) && 
        (m.message === messageToRemove.message || m.content === messageToRemove.content)
      );
      
      if (messageIndex >= 0) {
        console.log(`Removing message from memory: ${messageToRemove.message?.substring(0, 20)}...`);
        // Remove the message
        this.conversationHistory.splice(messageIndex, 1);
      } else {
        console.log('Message not found in memory for removal');
      }
    }
  }

export { extractJsonFromText };
export default ConversationMemory;