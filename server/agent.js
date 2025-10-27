import dotenv from "dotenv";
import * as llmProvider from "./providers/llmProvider.js";
dotenv.config();

async function generateDynamicAttributeContext(customAttributes) {
    // Create a list of attribute descriptions to send to the AI.
    const attributeDescriptions = Object.entries(customAttributes)
      .map(([key, value]) => {
        return `${key} is ${value}`;
      })
      .join(", ");
  
    console.log(attributeDescriptions);
  
    const prompt = `Given these attributes of a person - ${attributeDescriptions}. Generate a concise sentence that could be used in a conversation to reflect these attributes contextually, starting from you rather than I .`;

    try {
      return await llmProvider.generateText(prompt, { maxTokens: 75, temperature: 0.7 });
    } catch (error) {
      console.error("Error generating dynamic attribute context:", error);
      return "This agent has unique qualities that enhance our conversation.";
    }
  }

class Agent {
    constructor(
      name,
      personality,
      interactionPattern,
      isHumanProxy = false,
      customAttributes = {},
      fillerWordsFrequency = "none",
      isProactive = false,
      proactiveThreshold = 0.3,
      roleDescription = "", // Add role description parameter
      isDerailer = false, // Add derailer parameter
      derailThreshold = 0.3, // Probability threshold for derailing
      derailMode = "drift" // "drift" or "extend"
    ) {
      this.name = name;
      this.personality = personality;
      this.interactionPattern = interactionPattern;
      this.isHumanProxy = isHumanProxy;
      this.customAttributes = customAttributes;
      this.fillerWordsFrequency = fillerWordsFrequency;
      this.isProactive = isProactive;
      this.proactiveThreshold = proactiveThreshold;
      this.triggerWords = new Set();
      this.proactiveTopics = new Set();
      this.roleDescription = roleDescription; // Set role description
      this.isDerailer = isDerailer; // Set derailer flag
      this.derailThreshold = derailThreshold; // Set derail threshold
      this.derailMode = derailMode; // Set derail mode
      this.impromptuPhase = false; // Track if impromptu phase is active
      this.impromptuTurnsLeft = 0; // Track turns left in impromptu phase
    }
  
    async setupAttributeContext() {
      if (Object.keys(this.customAttributes).length > 0) {
        this.attributeContext = await generateAttributeContext(
          this.customAttributes,
        );
      }
    }
  
    async reply(
      message,
      context,
      nextSpeaker,
      interruptionInfo = { interrupt: false, vibe: "neutral" },
      options = {},
      isStartingMessage = false,
    ) {
      if (this.isHumanProxy) {
        return { requiresHumanInput: true, speaker: this.name };
      }
  
      const attributeContext =
        this.customAttributes && Object.keys(this.customAttributes).length > 0
          ? await generateDynamicAttributeContext(this.customAttributes)
          : "";
  
      let interruptionContext = "";
      if (interruptionInfo.interrupt) {
        interruptionContext = `Your response should be an interruption with a ${interruptionInfo.vibe} vibe, reacting to part of the previous incomplete message.`;
      }
  
      // Add derailer context if agent is in derailer mode
      let derailerContext = "";
      if (this.isDerailer) {
        if (this.derailMode === "drift") {
          derailerContext = "Subtly shift the topic to something tangentially related.";
        } else if (this.derailMode === "extend") {
          derailerContext = "Build on the current topic but add a novel and unexpected perspective.";
        } else if (this.derailMode === "question") {
          derailerContext = "Respond with a probing question that shifts focus to a different aspect of the topic.";
        } else if (this.derailMode === "emotional") {
          derailerContext = "Respond to the emotional subtext rather than the content, changing the conversation's emotional tone.";
        }
      }
  
      const prompt = `You are ${this.name}, a ${this.personality} person. ${attributeContext} 
            ${this.roleDescription ? "Role: " + this.roleDescription : ""}
            ${isStartingMessage && message !== "This is the first scene" ? `What happened in the last scene: ${message}` : ""}
            ${isStartingMessage && message !== "This is the first scene" ? "briefly summarize what happened in the last scene and transition to the current context (use 1-2 sentences): " : ""}
            ${derailerContext}
            ${context}
            ${interruptionContext}
            ${!isStartingMessage ? `Last message: ${message}` : ""}
           
            Respond briefly (1-2 sentences), building on previous points without repeating them.
            Keep your response conversational and natural. After you speak, ${nextSpeaker} will respond.`;

            // console.log(prompt);
             // ${isStartingMessage ? "What happened in the last scene: " : `${lastSpeaker ? lastSpeaker + " said: " : "Last message: "}`}${message}"
            

      try {
        const fullResponse = this.postProcessResponse(
          await llmProvider.generateText(prompt, { ...options, ...(this.llmOptions || {}) })
        );
  
        if (interruptionInfo.interrupt) {
          // Generate a random interruption point with 25% - 75%
          const minPercentage = 0.25;
          const maxPercentage = 0.75;
          const randomPercentage =
            minPercentage + (maxPercentage - minPercentage) * Math.random();
          const interruptPoint = Math.floor(
            randomPercentage * fullResponse.length,
          );
          return {
            fullResponse,
            interrupted: true,
            partialResponse: fullResponse.slice(0, interruptPoint),
          };
        }
  
        return { fullResponse, interrupted: false };
      } catch (error) {
        console.error("Error in reply method:", error);
        return {
          fullResponse: "Sorry, I couldn't generate a response.",
          interrupted: false,
        };
      }
    }
  
    postProcessResponse(response) {
      // Remove any instances of the agent's name from the beginning of the response
      response = response.replace(/^[^:]+:\s*/, "");
  
      // Limit the response to three sentences
      const sentences = response.match(/[^.!?]+[.!?]+/g) || [];
      return sentences.slice(0, 3).join(" ").trim();
    }
  
    setProactiveSettings(settings) {
      const { triggerWords = [], proactiveTopics = [], threshold } = settings;
      this.triggerWords = new Set(triggerWords);
      this.proactiveTopics = new Set(proactiveTopics);
      if (threshold) this.proactiveThreshold = threshold;
    }
  
    // Method to check if a message triggers proactive behavior
    shouldReactProactively(message, context) {
      if (!this.isProactive) return false;
  
      // Check for trigger words
      const hasTriggerWord = Array.from(this.triggerWords).some(word => 
        message.toLowerCase().includes(word.toLowerCase())
      );
  
      // Check for relevant topics
      const hasRelevantTopic = Array.from(this.proactiveTopics).some(topic =>
        context.toLowerCase().includes(topic.toLowerCase())
      );
  
      // Random chance based on proactiveThreshold
      const randomChance = Math.random() < this.proactiveThreshold;
  
      return (hasTriggerWord || hasRelevantTopic) && randomChance;
    }
  
    // Method to generate a proactive response
    async generateProactiveResponse(message, context, nextSpeaker, options = {}) {
      const proactivePrompt = `You are ${this.name}, a ${this.personality} person in a casual conversation. You just heard: "${message}"
  
      Generate a quick, natural reaction - like you're cutting into the conversation because you have something to add. Your response should:
      - Be very brief (1-2 short sentences)
      - Sound like natural speech (use contractions, casual language)
      - Cut in naturally (e.g. "Wait", "Hey", "Oh", "Actually")
      - Skip formal acknowledgments of other speakers
      - Stay true to your ${this.personality} personality
      
      Focus on adding your key point quickly and naturally. Imagine this as audio - keep it short and punchy.`;
  
      try {
        const fullResponse = this.postProcessResponse(
          await llmProvider.generateText(proactivePrompt, options)
        );
        
        return {
          fullResponse,
          isProactive: true
        };
      } catch (error) {
        console.error("Error generating proactive response:", error);
        return {
          fullResponse: "Actually, I have something to add about that...",
          isProactive: true
        };
      }
    }

    // Method to check if agent should derail the conversation
    shouldDerail() {
      if (!this.isDerailer) return false;
      return Math.random() < this.derailThreshold;
    }

    // Method to generate a derailing response
    async generateDerailResponse(message, context, nextSpeaker, options = {}) {
      let derailPrompt;
      
      if (this.derailMode === "drift") {
        derailPrompt = `You are ${this.name}, a ${this.personality} person who likes to shift conversations in new directions.
        The current conversation is about: "${message}"
        
        Generate a response that subtly shifts the topic to something tangentially related but different.
        Your response should:
        - Be brief (1-2 sentences)
        - Sound natural and conversational
        - Introduce a new angle or topic that's somewhat related but changes the direction
        - Stay true to your ${this.personality} personality
        
        Make your topic shift seem natural but noticeable.`;
      } else if (this.derailMode === "extend") {
        derailPrompt = `You are ${this.name}, a ${this.personality} person who thinks outside the box.
        The current conversation is about: "${message}"
        
        Generate a response that extends the current topic in an unexpected or novel way.
        Your response should:
        - Be brief (1-2 sentences)
        - Sound natural and conversational
        - Add a surprising perspective or angle to the current topic
        - Stay true to your ${this.personality} personality
        
        Make your extension interesting and somewhat unexpected.`;
      } else if (this.derailMode === "question") {
        derailPrompt = `You are ${this.name}, a ${this.personality} person who likes to ask questions.
        The current conversation is about: "${message}"
        
        Generate a response that asks a probing question that shifts focus to a different aspect of the topic.
        Your response should: 
        - Be brief (1-2 sentences)
        - Sound natural and conversational
        - Ask a question that's related to the current topic but not obvious
        - Stay true to your ${this.personality} personality
        
        Make your question interesting and thought-provoking.`;
      } else if (this.derailMode === "emotional") {
        derailPrompt = `You are ${this.name}, a ${this.personality} person who likes to express emotions.
        The current conversation is about: "${message}"
        
        Generate a response that expresses an emotion related to the current topic.
        Your response should:
        - Be brief (1-2 sentences)
        - Sound natural and conversational
        - Express an emotion that's relevant to the current topic
        - Stay true to your ${this.personality} personality
        
        Make your emotional response feel genuine and natural.`;
      }

      // console.log("Derail prompt: ", derailPrompt);

      try {
        const fullResponse = this.postProcessResponse(
          await llmProvider.generateText(derailPrompt, options)
        );
        
        return {
          fullResponse,
          isDerailing: true,
          derailMode: this.derailMode
        };
      } catch (error) {
        console.error("Error generating derail response:", error);
        return {
          fullResponse: this.derailMode === "drift" 
            ? "That reminds me of something completely different..."
            : "I have an unusual perspective on that...",
          isDerailing: true,
          derailMode: this.derailMode
        };
      }
    }

    // Method to start impromptu phase
    startImpromptuPhase(turns = 3) {
      this.impromptuPhase = true;
      this.impromptuTurnsLeft = turns;
      
      // Re-randomize the derail mode if the agent was configured for random mode
      if (this.isDerailer && this._isRandomMode) {
        const availableModes = ["drift", "extend", "question", "emotional"];
        const randomIndex = Math.floor(Math.random() * availableModes.length);
        this.derailMode = availableModes[randomIndex];
        console.log(`Re-randomized derail mode for new impromptu phase: ${this.derailMode} for ${this.name}`);
      }
      
      return {
        impromptuPhase: true,
        turnsLeft: turns,
        moderator: this.name,
        derailMode: this.derailMode
      };
    }

    // Method to track impromptu phase progress
    trackImpromptuTurn() {
      if (!this.impromptuPhase) return { impromptuPhase: false };
      
      this.impromptuTurnsLeft--;
      const isEnding = this.impromptuTurnsLeft <= 0;
      
      if (isEnding) {
        this.impromptuPhase = false;
      }
      
      return {
        impromptuPhase: this.impromptuPhase,
        turnsLeft: this.impromptuTurnsLeft,
        isEnding
      };
    }

    // Set derailer mode
    setDerailMode(mode, threshold = null) {
      if (mode && (mode === "drift" || mode === "extend" || mode === "question" || mode === "emotional")) {
        this.derailMode = mode;
      } 
      
      if (threshold !== null && threshold >= 0 && threshold <= 1) {
        this.derailThreshold = threshold;
      }
    }

    // Enable or disable derailer functionality
    setAsDerailer(enable = true, settings = {}) {
      this.isDerailer = enable;
      
      if (settings.mode) {
        // Track if we're using random mode for future re-randomization
        this._isRandomMode = settings.mode === "random";
        
        // If mode is "random", randomly choose between all available modes
        if (settings.mode === "random") {
          const availableModes = ["drift", "extend", "question", "emotional"];
          const randomIndex = Math.floor(Math.random() * availableModes.length);
          this.derailMode = availableModes[randomIndex];
          console.log(`Randomly selected derail mode: ${this.derailMode} for ${this.name}`);
        } else if (settings.mode === "drift" || settings.mode === "extend" || 
                   settings.mode === "question" || settings.mode === "emotional") {
          this.derailMode = settings.mode;
        } else {
          console.warn(`Invalid derail mode: ${settings.mode}. Using default "drift" mode.`);
          this.derailMode = "drift";
        }
      }
      
      if (settings.threshold !== undefined) {
        this.derailThreshold = settings.threshold;
      }
      
      // Set turn count range for impromptu phases
      if (settings.minTurns !== undefined) {
        this.minImpromptuTurns = Math.max(3, settings.minTurns); // Ensure at least 3
      } else {
        this.minImpromptuTurns = 3; // Default minimum
      }
      
      if (settings.maxTurns !== undefined) {
        this.maxImpromptuTurns = Math.max(this.minImpromptuTurns, settings.maxTurns);
      } else {
        this.maxImpromptuTurns = 5; // Default maximum
      }
    }
  }

export default Agent;