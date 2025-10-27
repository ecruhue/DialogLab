import Agent from "./agent.js";
import ConversationMemory from "./conversationmemory.js";
import * as chatUtils from "./chatutils.js";

class ConversationManager {
  constructor(maxTurns, memory) {
    this.maxTurns = maxTurns || 6;
    this.currentTurn = 0;
    this.agents = [];
    this.conversation = [];
    this.interactionPattern = "neutral";
    this.interruptionRules = [];
    this.backChannelRules = [];
    this.memory = memory || new ConversationMemory();
    this.messagesSinceLastAnalysis = 0;
    this.themeAnalysisInterval = 5;
    this.lastThemeAnalysis = null;
    this.currentInitiator = null;
    this.currentRecipient = null;
    this.polishMode = false;
    this.currentParticipants = [];
    this.currentConfig = null; // Store the current config
    this.onConversationComplete = null; // Initialize callback for conversation completion

    // Party mode settings
    this.partyMode = false;
    this.parties = new Map();
    this.partyRoles = new Map();
    this.partyMembership = new Map();
    this.partyTurnMode = "free"; // "free", "round-robin", or "moderated"
    this.moderatorParty = null;
    this.raisedHandsQueue = [];
    this.approvedSpeakers = [];
    this.handRaisingEnabled = false;
    this.partySpeakerQueue = []; // Initialize the party speaker queue

    // Derailer mode settings
    this.impromptuPhaseActive = false;
    this.impromptuTurnsLeft = 0;
    this.originalPartyMode = false;
    this.originalPartyTurnMode = null;
    this.originalModerator = null;
    this.predefinedParties = new Map();
    this.impromptuDerailer = null;
    this.impromptuDerailMode = null;
    this.pendingImpromptuPhase = null;
    this.isWaitingForApproval = false;
    this.conversationPaused = false;
    this.recentlyRejectedImpromptu = false;
    this.derailingEnabled = true;
    this._autoApproveImpromptu = false;
    this.impromptuPhaseCount = 0; // Add counter for impromptu phases
    
    console.log(`DEBUG - Constructor initialized with autoApproveImpromptu: ${this._autoApproveImpromptu}`);
  }

  togglePolishMode() {
    this.polishMode = !this.polishMode;
    console.log(
      `Polish mode is now ${this.polishMode ? "enabled" : "disabled"}.`,
    );
  }

  parseAndApplyUserCommands(index, userInstruction) {
    if (index < 0 || index >= this.conversation.length) {
      console.error("Invalid message index for polishing.");
      return;
    }

    const commands = this.interpretUserInstructions(userInstruction);
    let message = this.conversation[index].message;

    commands.forEach((command) => {
      switch (command.type) {
        case "changeRecipient":
          this.conversation[index].recipient = command.value;
          break;
        case "editMessage":
          message = command.value;
          break;
        default:
          console.error("Unknown command type:", command.type);
      }
    });

    this.conversation[index].message = message;
  }

  async regenerateMessagesFromIndex(index) {
    if (index >= this.conversation.length) return;

    console.log(`Regenerating messages starting from index ${index}.`);
    // Remove all messages from the given index onward
    this.conversation.splice(index);

    // Reset the current turn to the index of the first message being regenerated
    this.currentTurn = index;

    // Continue the conversation using the modified state
    const lastMessage = this.conversation[index - 1];
    const participants = this.agents.map((agent) => agent.name);
    await this.continueConversation(
      participants,
      lastMessage.sender,
      lastMessage.recipient,
    );
  }

  interpretUserInstructions(instruction) {
    return chatUtils.interpretUserInstructions(instruction);
  }

  adjustLastRecipient(newRecipient) {
    if (this.conversation.length > 0) {
      const lastMessage = this.conversation[this.conversation.length - 1];
      lastMessage.recipient = newRecipient; // Change the recipient of the last message

      console.log(
        `Changed last recipient to ${newRecipient} and set as next sender.`,
      );

      this.temporaryNextRecipient = newRecipient;
    } else {
      console.error("No messages in conversation history to change.");
    }
  }

  setNextRecipient(recipient) {
    this.nextRecipient = recipient;
  }

  continueConversationFromLast() {
    if (this.conversation.length === 0) {
      console.error("No conversation history to continue from.");
      return;
    }

    // Assuming the last message's recipient is now the next speaker
    const nextSpeaker = this.nextRecipient;
    const lastMessage = this.conversation[this.conversation.length - 1];
    const participants = this.agents.map((agent) => agent.name);

    this.continueConversation(participants, lastMessage.sender, lastMessage.recipient, nextSpeaker);
  }

  setTopic(topic) {
    this.topic = topic;
  }

  setNextRecipient(recipient) {
    this.nextRecipient = recipient;
    this.setTurnTakingMode("direct"); // Switch to direct mode when a nextRecipient is set
  }

  addAgent(
    name,
    personality,
    interactionPattern,
    isHumanProxy = false,
    customAttributes = {},
    fillerWordsFrequency = "none",
    proactiveSettings = null,
    roleDescription = null,
  ) {
    console.log(
      `Adding agent ${name} with custom attributes:`,
      customAttributes,
    );

    const isProactive = !!proactiveSettings;

    const agent = new Agent(
      name,
      personality,
      interactionPattern,
      isHumanProxy,
      customAttributes,
      fillerWordsFrequency,
      isProactive,
      roleDescription,
    );

    if (proactiveSettings) {
      agent.setProactiveSettings(proactiveSettings);
    }
    if (!this.agents) this.agents = [];
    this.agents.push(agent);
    return agent;
  }

  // Create a party with specified members and configuration
  createParty(partyName, members, config = {}) {
    if (!partyName || !Array.isArray(members) || members.length === 0) {
      console.error("Invalid party creation parameters");
      return false;
    }
    
    // Create or update the party in the parties map
    this.parties.set(partyName, [...members]);
    
    // Update the party membership for each member
    members.forEach(member => {
      this.partyMembership.set(member, partyName);
    });
    
    // Set any additional party configuration
    const partyConfig = {
      // Default settings
      speakingMode: "all", // "all", "representative", "subset", "sequential"
      representative: null,
      subsetSize: Math.ceil(members.length / 2),
      backchannelProbability: 0.3,
      // Override with provided config
      ...config
    };
    
    this.partyRoles.set(partyName, partyConfig);
    
    console.log(`Created party "${partyName}" with ${members.length} members`);
    return true;
  }

  // Enable party mode with specified turn-taking mode
  enablePartyMode(turnMode = "free", moderatorParty = null) {
    this.partyMode = true;
    
    // Validate and set party turn mode
    if (["free", "round-robin", "moderated"].includes(turnMode)) {
      this.partyTurnMode = turnMode;
    } else {
      console.warn(`Invalid party turn mode: ${turnMode}. Using "free" mode.`);
      this.partyTurnMode = "free";
    }
    
    // Set moderator party if provided and it exists
    if (moderatorParty && this.parties.has(moderatorParty)) {
      this.moderatorParty = moderatorParty;
      console.log(`Set moderator party to: ${moderatorParty}`);
    } else if (turnMode === "moderated") {
      // If moderated mode but no moderator specified, warn and use first party
      console.warn("Moderated mode enabled but no valid moderator party specified");
      if (this.parties.size > 0) {
        this.moderatorParty = Array.from(this.parties.keys())[0];
        console.log(`Using first party as moderator: ${this.moderatorParty}`);
      }
    }
    
    // Enable hand-raising for moderated mode
    if (turnMode === "moderated") {
      this.handRaisingEnabled = true;
      console.log("Hand-raising mode enabled for moderated mode");
      
      // Clear any existing queues
      this.raisedHandsQueue = [];
      this.approvedSpeakers = [];
      
      // Initialize with moderator party's turn
      if (this.moderatorParty) {
        this.currentPartyTurn = this.moderatorParty;
      }
    } else {
      this.handRaisingEnabled = false;
    }
    
    console.log(`Party mode enabled with ${turnMode} turn-taking mode`);
    return true;
  }
  
  // Get the party that an agent belongs to
  getAgentParty(agentName) {
    if (!agentName || !this.partyMembership) {
      return null;
    }
    return this.partyMembership.get(agentName) || null;
  }
  
  /**
   * Get an agent by name
   * @param {string} name - The name of the agent to retrieve
   * @returns {Agent|null} - The agent object if found, null otherwise
   */
  getAgentByName(name) {
    return this.agents.find(agent => agent.name === name) || null;
  }

  // Set the representative for a specific party
  setPartyRepresentative(partyName, representative) {
    if (!partyName || !representative) return false;
    const partyConfig = this.partyRoles.get(partyName) || {};
    const partyMembers = this.parties.get(partyName) || [];
    if (!partyMembers.includes(representative)) {
      console.warn(`Representative ${representative} is not a member of party ${partyName}`);
      return false;
    }
    this.partyRoles.set(partyName, { ...partyConfig, representative });
    return true;
  }

  // Set speaking mode for a specific party (supports options like subsetSize)
  setPartySpeakingMode(partyName, mode, options = {}) {
    if (!partyName || !mode) return false;
    const allowed = ["all", "representative", "subset", "sequential", "random"];
    if (!allowed.includes(mode)) {
      console.warn(`Invalid speaking mode ${mode} for party ${partyName}`);
      return false;
    }
    const partyConfig = this.partyRoles.get(partyName) || {};
    const updated = { ...partyConfig, speakingMode: mode };
    if (mode === "subset" && typeof options.subsetSize === "number") {
      updated.subsetSize = options.subsetSize;
    }
    if (mode === "representative" && options.representative) {
      updated.representative = options.representative;
    }
    this.partyRoles.set(partyName, updated);
    return true;
  }

  setAgentAsHumanProxy(name) {
    const agent = this.agents.find((a) => a.name === name);
    if (agent) {
      agent.isHumanProxy = true;
      console.log(`${name} is now set as a human-proxy agent.`);
    } else {
      console.log(`Agent ${name} not found.`);
    }
  }

  setTurnTakingMode(mode) {
    if (["random", "round-robin", "direct"].includes(mode)) {
      this.turnTakingMode = mode;
    } else {
      console.error("Invalid turn-taking mode. Using 'random' by default.");
      this.turnTakingMode = "random";
    }
  }

  setInteractionPattern(pattern) {
    if (["disagree", "agree", "neutral"].includes(pattern)) {
      this.interactionPattern = pattern;
    } else {
      console.log("Invalid interaction pattern. Using 'neutral' by default.");
      this.interactionPattern = "neutral";
    }
  }

  setInterruptionRule(
    interrupterName,
    interruptedName,
    probability = 0.5,
    vibe = "excited",
  ) {
    if (!this.interruptionRules[interruptedName]) {
      this.interruptionRules[interruptedName] = [];
    }
    this.interruptionRules[interruptedName].push({
      name: interrupterName,
      probability,
      vibe,
    });
  }

  shouldInterrupt(currentAgent, nextAgent) {
    const rules = this.interruptionRules[currentAgent.name];
    if (!rules) return { interrupt: false };

    const rule = rules.find((r) => r.name === nextAgent.name);
    if (!rule) return { interrupt: false };

    return {
      interrupt: Math.random() < rule.probability,
      vibe: rule.vibe,
    };
  }

  setBackChannelRule(fromPeople, toPeople, frequency, vibe, probability = 1) {
    if (!this.backChannelRules[toPeople]) {
      this.backChannelRules[toPeople] = [];
    }
    this.backChannelRules[toPeople].push({
      fromPeople: fromPeople,
      frequency,
      vibe,
      probability,
    });
  }

  shouldBackChannel(fromAgent, toAgentName) {
    // Validate parameters
    if (!fromAgent) {
      console.error("shouldBackChannel: fromAgent is null or undefined");
      return { backchannel: false };
    }
    
    if (!toAgentName) {
      console.error("shouldBackChannel: toAgentName is null or undefined");
      return { backchannel: false };
    }

    if (!fromAgent.name) {
      console.error("shouldBackChannel: fromAgent does not have a name property", fromAgent);
      return { backchannel: false };
    }
    
    const rules = this.backChannelRules[toAgentName];
    if (!rules || rules.length == 0) return { backchannel: false };

    for (const rule of rules) {
      if (rule.fromPeople === fromAgent.name) {
        let shouldTrigger = false;
        switch (rule.frequency.toLowerCase()) {
          case "always":
            shouldTrigger = true;
            break;
          case "sometimes":
            shouldTrigger = Math.random() < 0.5;
            break;
          case "rarely":
            shouldTrigger = Math.random() < 0.2;
            break;
          default:
            shouldTrigger = Math.random() < rule.probability;
        }

        return {
          backchannel: shouldTrigger,
          vibe: rule.vibe,
        };
      }
    }
    return { backchannel: false };
  }



  async getContextForPattern(lastSpeaker, currentAgent, nextAgent) {
    // Get the recent messages summary from memory
    const contextualHistory = await this.memory.getContextualHistory();
    const recentMessagesSummary = contextualHistory?.recentMessages || "";

    let context = chatUtils.getContextForPattern(
      lastSpeaker, 
      currentAgent, 
      nextAgent,
      this.interactionPattern,
      this.topic,
      recentMessagesSummary,
      this.lastThemeAnalysis,
      this.conversationPrompt
    );

    // If not in party mode, return standard context
    if (!this.partyMode) {
      return context;
    }

    const currentAgentParty = currentAgent?.name ? this.getAgentParty(currentAgent.name) : null;
    const lastSpeakerParty = lastSpeaker ? this.getAgentParty(lastSpeaker) : null;
    
    if (!currentAgentParty) {
      return context;
    }
    
    const currentPartyConfig = this.partyRoles.get(currentAgentParty) || {};

    const partyContext = chatUtils.getPartySpecificContext(
      currentAgentParty,
      currentPartyConfig,
      currentAgent.name,
      lastSpeakerParty
    );
    
    return `${context}\n\n${partyContext}`;
  }

  async analyzeConversationThemes() {
    const contextualHistory = await this.memory.getContextualHistory();
    const historicalContext = contextualHistory.historicalContext;
    return await chatUtils.analyzeConversationThemes(historicalContext);
  }


  async initiateConversation(config) {
    // Store the current config
    this.currentConfig = config;
    
    const {
      initiator,
      startingMessage,
      participants,
      topic,
      subTopic,
      conversationHistory,
      lastRecipient,
      turnTakingMode,
      polishCommands,
      removeBackchannel = false,
      partyMode = false,
      partyTurnMode = "free",
      moderatorParty = null,
      conversationPrompt = null
    } = config;
    this.currentInitiator = initiator;
    // Store participants for future reference, using agent names as fallback
    this.currentParticipants = Array.isArray(participants) && participants.length > 0 
      ? [...participants] 
      : this.agents.map(agent => agent.name);
    
    console.log(`Stored current participants: ${this.currentParticipants.join(', ')}`);
  
    // Set topic and subtopic
    if (subTopic) {
      this.setTopic(
        `main topic of this conversation is ${topic}, and the subtopic is ${subTopic}`,
      );
    } else {
      this.setTopic(`${topic}`);
    }

    this.conversationPrompt = conversationPrompt;
    console.log(`conversationPrompt: ${this.conversationPrompt}`);

    console.log(`current topic: ${this.topic}`);
    this.setTurnTakingMode(turnTakingMode);
    if (partyMode) {
      this.enablePartyMode(partyTurnMode, moderatorParty);
    }
  
    if (conversationHistory && conversationHistory.length > 0) {
      console.log("Continuing conversation from history", conversationHistory);
      this.conversation = conversationHistory;
      this.currentTurn = conversationHistory.length;
      this.conversationStartIndex = conversationHistory.length;
  
      const lastSpeaker =
        conversationHistory[conversationHistory.length - 1].sender;
      await this.continueConversation(
        participants,
        lastSpeaker,
        lastRecipient,
        removeBackchannel,
      );
    } else {
      // updateConversation with initialize message to ensure party info is added if in party mode
      this.updateConversation({
        sender: initiator,
        message: startingMessage ? startingMessage : await this.generateStartingMessageFromAgent(
          this.agents.find((a) => a.name === initiator),
          this.topic,
          this.conversationPrompt
        ),
        recipient: "All",
      });

      this.currentTurn = 1;

      // Set currentPartyTurn based on initiator's party if in party mode
      if (this.partyMode) {
        const initiatorParty = this.getAgentParty(initiator);
        if (initiatorParty) {
          this.currentPartyTurn = initiatorParty;
          console.log(`Set initial currentPartyTurn to "${initiatorParty}" based on initiator`);
        }
      }

      if (polishCommands && this.polishMode) {
        polishCommands.forEach((command) => {
          if (command.index < this.conversation.length) {
            this.parseAndApplyUserCommands(command.index, command.command);
          }
        });
      }
  
      // Add direct mode
      if (this.turnTakingMode === "direct") {
        // In direct mode, set the next recipient
        // But ensure it's not the initiator
        if (!this.nextRecipient || this.nextRecipient === initiator) {
          // Find a participant that isn't the initiator
          const availableParticipants = participants.filter(p => p !== initiator);
          if (availableParticipants.length > 0) {
            this.setNextRecipient(availableParticipants[Math.floor(Math.random() * availableParticipants.length)]);
          } else {
            // If initiator is the only participant, still use them
            this.setNextRecipient(participants[0]);
          }
        }
      }
      
      // Now we'll modify how we start the conversation to ensure the initiator doesn't speak twice
      await this.continueConversation(participants, initiator, null, removeBackchannel);
    }
  }

  async generateStartingMessageFromAgent(agent, topic, conversationPrompt = null) {
    if (!agent) {
      console.error("generateStartingMessageFromAgent: agent is null or undefined");
      return "";
    }

    // Get party information
    const agentParty = this.getAgentParty(agent.name);
    const partyConfig = (agentParty && this.partyRoles) ? (this.partyRoles.get(agentParty) || {}) : {};
    const partyInfo = partyConfig.description ? `You are a member of the "${agentParty}" party. ${partyConfig.description}\n` : "";
    let context = "";
    if (conversationPrompt) {
      context += `${partyInfo} Now, you are in a converation where you should follow this context: ${conversationPrompt}`;
    } else {
      context += `${partyInfo} The conversation's topic is ${topic}.`;
    }

    // Add content-specific context
    if (this.contentMode && this.activeContentId) {
      const ownership = this.contentManager.getOwnership(this.activeContentId);
      const isPresenter = ownership.presenterIsParty 
        ? this.getAgentParty(agent.name) === ownership.presenter
        : agent.name === ownership.presenter;
      
      if (isPresenter) {
        context += ` You are the presenter of the content. Start by introducing it to everyone and highlighting key points.`;
      } else if (this.agentHasContentAccess(agent.name)) {
        context += ` The discussion involves shared content that will be presented. Start the discussion by introducing the topic.`;
      }
    } else {
      context += ` Start the discussion by introducing the topic and inviting opinions.`;
    }
    
    // Set up for agent reply
    const options = {
      maxTokens: 150,
      temperature: 0.8
    };
    
    // Add content prompt if available
    const contentPrompt = this.contentMode ? this.getContentPromptForAgent(agent.name) : '';
    if (contentPrompt) {
      options.contentAttachment = contentPrompt;
    }

    console.log(`generateStartingMessageFromAgent context: ${context}`);
    
    // Get recent message summary
    const contextualHistory = await this.memory.getContextualHistory();
    console.log(`contextualHistory: ${JSON.stringify(contextualHistory)}`);
    
    // Get agent's response
    const message = await agent.reply(
      contextualHistory.recentMessages,
      context,
      "All", // Open to all participants
      { interrupt: false, vibe: "neutral" },
      options,
      true, // This is a starting message
      contextualHistory.lastSpeaker // Pass the last speaker
    );
    console.log(`generateStartingMessageFromAgent: ${message.fullResponse}`);

    return message.fullResponse || `Let's discuss the topic: ${topic}. What are your thoughts?`;
  }

  async continueConversation(
    participants,
    lastSpeaker,
    lastRecipient = null,
    removeBackchannel = false,
  ) {
    // Add debug logging at the start of the method
    console.log(`DEBUG - continueConversation - autoApproveImpromptu: ${this._autoApproveImpromptu}, impromptuPhaseActive: ${this.impromptuPhaseActive}, isWaitingForApproval: ${this.isWaitingForApproval}, conversationPaused: ${this.conversationPaused}`);

    // Don't continue if waiting for impromptu phase approval
    if (this.isWaitingForApproval || this.conversationPaused) {
      console.log('Conversation paused: waiting for impromptu phase approval');
      return;
    }

    // Remove backchannel messages if requested
    if (removeBackchannel) {
      this.removeBackchannelMessages();
    }

    participants = (participants && Array.isArray(participants) && participants.length > 0) ? [...participants] : this.agents.map(agent => agent.name);
    
    // Check for derailer interventions when not in impromptu phase
    if (!this.impromptuPhaseActive && this.derailingEnabled) {
      const derailResponse = await this.checkForDerailInterventions(
        participants,
        lastSpeaker,
        this.getLastMessage()
      );

      if (derailResponse) {
        console.log(`Derailer intervention detected from ${derailResponse.sender}`);
        
        if (this.autoApproveImpromptu) {
          // First start impromptu phase with derailer as moderator
          this.startImpromptuPhase(
            derailResponse.derailerAgent,
            derailResponse.derailMode,
            derailResponse.turnCount || 3
          );

          // Make sure hasDerailerSpokenFirst is true to prevent double speaking
          this.hasDerailerSpokenFirst = true;
          console.log(`Ensured hasDerailerSpokenFirst=true for auto-approved impromptu phase`);

          // Then add the derail response message
          derailResponse.recipient = "All";
          this.updateConversation(derailResponse);
          console.log(`Added derail message from ${derailResponse.sender} after starting impromptu phase`);
          
          // Update last speaker and increment turn
          lastSpeaker = derailResponse.sender;
          this.currentTurn++;
          console.log(`Set lastSpeaker to ${lastSpeaker} after derail intervention`);
          
          // Skip the rest of this iteration and continue with next turn
          return this.continueConversation(participants, lastSpeaker, "All", removeBackchannel);
        } else {
          // For non-auto-approve mode, add message with needsApproval flag
          derailResponse.recipient = "All";
          derailResponse.needsApproval = true;
          this.updateConversation(derailResponse);
          console.log(`Added derail message from ${derailResponse.sender} waiting for approval`);
          
          // Store pending impromptu phase info
          this.storePendingImpromptuPhase(
            derailResponse.derailerAgent,
            derailResponse.derailMode,
            derailResponse.turnCount || 3,
            derailResponse
          );
          
          // Set waiting flags and pause conversation until approval
          this.isWaitingForApproval = true;
          this.conversationPaused = true;
          console.log('Setting waiting flags and pausing conversation for impromptu phase approval');
          
          // Return immediately without generating next message
          return;
        }
      }
    }
    
    // Continue with normal message generation
    while (this.currentTurn < this.maxTurns) {
      // Check at the beginning of each loop if the conversation has been paused
      // This prevents continuing to cycle through speakers after a pause occurs
      if (this.isWaitingForApproval || this.conversationPaused) {
        console.log('Conversation was paused during processing - halting message generation');
        return;
      }
      
      // Check if we're transitioning from an approved speaker back to the moderator
      if (this.partyMode && this.partyTurnMode === "moderated" && this.handRaisingEnabled && !this.impromptuPhaseActive) {
        const lastSpeakerParty = this.getAgentParty(lastSpeaker);
        
        // If last speaker was from a non-moderator party and approved to speak
        if (lastSpeakerParty && lastSpeakerParty !== this.moderatorParty) {
          // Check if they were an approved speaker or if we should transition back to moderator anyway
          const wasApprovedSpeaker = this.approvedSpeakers.some(s => s.member === lastSpeaker);
          
          if (wasApprovedSpeaker || this.conversation.length > 0) {
            console.log(`Speaker ${lastSpeaker} from ${lastSpeakerParty} has spoken, transitioning back to moderator`);
            
            // Get a moderator agent to acknowledge and transition
            const moderatorMembers = this.parties.get(this.moderatorParty) || [];
            if (moderatorMembers.length > 0) {
              // Find the most recent moderator that spoke to avoid selecting the same one
              const recentModerators = this.conversation.slice(-10)
                .filter(msg => msg.party === this.moderatorParty && !msg.isSystemMessage)
                .map(msg => msg.sender);
              
              const lastModeratorSpeaker = recentModerators.length > 0 ? recentModerators[0] : null;
              console.log(`Most recent moderator speaker was: ${lastModeratorSpeaker || 'none'}`);
              
              // Exclude the last moderator from selection if possible
              const eligibleModerators = lastModeratorSpeaker && moderatorMembers.length > 1
                ? moderatorMembers.filter(m => m !== lastModeratorSpeaker)
                : moderatorMembers;
              
              // Select a random moderator from the eligible ones
              const moderatorSpeaker = eligibleModerators.length > 0
                ? eligibleModerators[Math.floor(Math.random() * eligibleModerators.length)]
                : moderatorMembers[0];
              
              console.log(`Selected moderator ${moderatorSpeaker} to speak next (from ${eligibleModerators.length} eligible moderators)`);
            
            const moderatorAgent = this.agents.find(a => a.name === moderatorSpeaker);
              if (moderatorAgent) {
                // Get the last message that the moderator will respond to
            const lastActualMessage = this.getLastMessage();
            
                // Create a transition context
            const transitionContext = {
                  sender: lastActualMessage ? lastActualMessage.sender : lastSpeaker,
                  message: lastActualMessage ? lastActualMessage.message : `Party "${lastSpeakerParty}" has just spoken.`,
              isSystemMessage: false,
              recipient: moderatorSpeaker,
              isTransitionMessage: true
            };

                // If there are raised hands, select a random one for the moderator to approve
                if (this.raisedHandsQueue.length > 0) {
                  // Ensure we don't select someone from the same party as the last speaker if possible
                  const eligibleHands = this.raisedHandsQueue.filter(hand => 
                    hand.party !== lastSpeakerParty || this.raisedHandsQueue.length <= 1);
                  
                  const randomHand = eligibleHands.length > 0
                    ? eligibleHands[Math.floor(Math.random() * eligibleHands.length)]
                    : this.raisedHandsQueue[Math.floor(Math.random() * this.raisedHandsQueue.length)];
                  
                  // Make sure we're not selecting the moderator as the next speaker
                  if (randomHand.member === moderatorSpeaker) {
                    console.warn(`WARNING: Was about to select the moderator ${moderatorSpeaker} as the next speaker. Finding alternative...`);
                    
                    // Find another hand raiser that's not the moderator
                    const alternativeHands = this.raisedHandsQueue.filter(hand => hand.member !== moderatorSpeaker);
                    if (alternativeHands.length > 0) {
                      const alternativeHand = alternativeHands[Math.floor(Math.random() * alternativeHands.length)];
                      transitionContext.nextSpeaker = alternativeHand.member;
                      transitionContext.nextSpeakerParty = alternativeHand.party;
                      console.log(`Selected alternative next speaker: ${alternativeHand.member}`);
                    } else {
                      // No alternative found, just use "All" as recipient with no specific next speaker
                      transitionContext.nextSpeaker = null;
                      transitionContext.nextSpeakerParty = null;
                      console.log(`No alternative hand raiser found, will invite open discussion`);
                    }
                  } else {
                    // Normal case - set the next speaker to the random hand
                    transitionContext.nextSpeaker = randomHand.member;
                    transitionContext.nextSpeakerParty = randomHand.party;
                  }
                  
                  try {
                    // Generate the moderator's response
              const reply = await this.generateReplyMessage(
                moderatorAgent,
                transitionContext,
                      randomHand.member // Important: set the recipient to the next speaker, not "All"
              );
              
                    // Create message from moderator
              const moderatorMessage = {
                sender: moderatorSpeaker,
                      message: reply.fullResponse || `Thank you for that input. I'd like to hear from ${randomHand.member} next.`,
                      recipient: randomHand.member, // Important: set the recipient explicitly
                      isHumanInput: false,
                      party: this.moderatorParty
                    };
                    
                    // Add to conversation
              this.updateConversation(moderatorMessage);
              this.currentTurn++;
              
                    // Approve the random raised hand
              this.approveRaisedHand(randomHand.member);
              
                    // Update last speaker
                    lastSpeaker = moderatorSpeaker;
                    
                    // Skip to next iteration to let the approved speaker talk
              continue;
            } catch (error) {
              console.error("Error generating moderator transition message:", error);
                    // Fall through to normal flow
                  }
                } else {
                  // If no raised hands, have moderator acknowledge and invite any parties to speak
                  try {
                    // Generate the moderator's response
                    const reply = await this.generateReplyMessage(
                      moderatorAgent,
                      transitionContext,
                      "All" // No specific recipient when inviting any party to speak
                    );
                    
                    // Create message from moderator
                    const moderatorMessage = {
                sender: moderatorSpeaker,
                      message: reply.fullResponse || `Thank you for that contribution. The floor is open for comments.`,
                      recipient: "All",
                      isHumanInput: false,
                      party: this.moderatorParty
                    };
                    
                    // Add to conversation
                    this.updateConversation(moderatorMessage);
                    this.currentTurn++;
                    
                    // Force new hand-raising cycle
                    this.raiseHandsForAllParties(true);
                    
                    // Clear approved speakers
            this.approvedSpeakers = [];
                    
                    // Update last speaker
                    lastSpeaker = moderatorSpeaker;
                    
                    // Skip to next iteration
                    continue;
                  } catch (error) {
                    console.error("Error generating moderator transition message:", error);
                    // Fall through to normal flow
                  }
                }
              }
            }
          }
        }
      }
      
      // Get next speaker based on mode
      let currentSpeaker;
      if (this.partyMode) {
        // Get next speaker from party queue if available
        if (this.partySpeakerQueue && this.partySpeakerQueue.length > 0) {
          currentSpeaker = this.partySpeakerQueue.shift();
          console.log(`Next speaker from party queue: ${currentSpeaker}`);
          
          // Double-check: In free mode, don't let the same person speak twice in a row
          if (this.partyTurnMode === "free" && currentSpeaker === lastSpeaker) {
            console.log(`Free mode: preventing ${currentSpeaker} from speaking twice in a row`);
            
            // Try to get another speaker from the queue
            if (this.partySpeakerQueue.length > 0) {
              currentSpeaker = this.partySpeakerQueue.shift();
              console.log(`Free mode: selected alternative speaker ${currentSpeaker}`);
              // Add the original speaker back to the end of the queue
              this.partySpeakerQueue.push(lastSpeaker);
            } else {
              // If no other speakers in queue, try to switch parties
              const currentParty = this.getAgentParty(lastSpeaker);
              console.log(`Free mode: no other speakers in queue, trying to switch from party ${currentParty}`);
              
              if (currentParty) {
                const nextParty = this.selectNextParty(currentParty);
                if (nextParty && nextParty !== currentParty) {
                  console.log(`Free mode: forcing switch to party ${nextParty}`);
                  await this.preparePartyTurn(nextParty, participants, lastSpeaker);
                  if (this.partySpeakerQueue && this.partySpeakerQueue.length > 0) {
                    currentSpeaker = this.partySpeakerQueue.shift();
                    console.log(`Free mode: selected speaker ${currentSpeaker} from new party ${nextParty}`);
                    // Continue with this new speaker
                  } else {
                    // If we still have no speaker, use round-robin across all participants
                    console.log(`Free mode: no speakers available in new party queue, using round-robin`);
                    currentSpeaker = this.getNextSpeakerExcluding(participants, lastSpeaker);
                  }
                }
              }
            }
          }
        } else {
          // Transition to next party's turn
          const nextParty = this.selectNextParty(this.currentPartyTurn);
          console.log(`Transitioning to next party: ${nextParty}`);
          
          // Special handling for moderated mode
          if (this.partyTurnMode === "moderated" && this.handRaisingEnabled) {
            const lastSpeakerParty = this.getAgentParty(lastSpeaker);
            
            // If last speaker was moderator and addressed someone specific
            if (lastSpeakerParty === this.moderatorParty) {
              const lastMessage = this.getLastMessage();
              if (lastMessage && lastMessage.recipient && lastMessage.recipient !== "All") {
                const recipientParty = this.getAgentParty(lastMessage.recipient);
                if (recipientParty && recipientParty !== this.moderatorParty) {
                  // Force new hand-raising cycle
                  console.log(`Moderator addressed ${lastMessage.recipient}, forcing new hand-raising`);
                  this.raiseHandsForAllParties(true);
                }
              }
            }
            
            // If there are raised hands and we're transitioning to moderator
            if (nextParty === this.moderatorParty && this.raisedHandsQueue.length > 0) {
              // Auto-approve a random raised hand
              const randomIndex = Math.floor(Math.random() * this.raisedHandsQueue.length);
              const approved = this.approveRaisedHand(this.raisedHandsQueue[randomIndex].member);
              if (approved) {
                currentSpeaker = approved.member;
                console.log(`Auto-approved ${currentSpeaker} to speak`);
                continue;
              }
            }
            
            // If transitioning to non-moderator party, trigger hand-raising
            if (nextParty !== this.moderatorParty) {
              console.log(`Transitioning to non-moderator party ${nextParty}, triggering hand-raising`);
              const handRaisers = this.raiseHandsForParty(nextParty);
              if (handRaisers.length > 0) {
                // Set party turn but wait for moderator approval
                this.currentPartyTurn = nextParty;
        continue;
              }
            }
          }
          
          await this.preparePartyTurn(nextParty, participants, lastSpeaker);
          if (this.partySpeakerQueue && this.partySpeakerQueue.length > 0) {
            currentSpeaker = this.partySpeakerQueue.shift();
            console.log(`Selected speaker from new party: ${currentSpeaker}`);
        } else {
            console.warn('No speakers available in party queue after preparation');
            currentSpeaker = this.getNextRoundRobinSpeaker(participants, lastSpeaker);
              }
            }
          } else {
        currentSpeaker = this.getNextRoundRobinSpeaker(participants, lastSpeaker);
      }

      if (!currentSpeaker) {
        console.error("No valid currentSpeaker selected");
        this.currentTurn++;
        continue;
      }

      const currentAgent = this.agents.find((a) => a.name === currentSpeaker);
      if (!currentAgent) {
        console.error(`Agent not found for name: ${currentSpeaker}`);
        this.currentTurn++;
        continue;
      }
      
      // Determine next speaker
      let nextSpeaker;
      if (this.partyMode) {
        if (this.partySpeakerQueue.length > 0) {
          // Next speaker is the next in queue from same party
          nextSpeaker = this.partySpeakerQueue[0];
        } else {
          // Next speaker will be from next party (determined in next iteration)
          const nextParty = this.selectNextParty(this.currentPartyTurn);
          console.log(`Transitioning to next party's turn: ${nextParty}`);
          
          // In moderated mode with hand-raising, always direct to the moderator or from moderator to approved speaker
          if (this.handRaisingEnabled && this.partyTurnMode === "moderated") {
            const currentSpeakerParty = this.getAgentParty(currentSpeaker);
            
            if (currentSpeakerParty !== this.moderatorParty) {
              // Non-moderator is speaking - they always address the moderator
              const moderatorMembers = this.parties.get(this.moderatorParty);
              if (moderatorMembers && moderatorMembers.length > 0) {
                // Get the representative or first member of the moderator party
                const moderatorConfig = this.partyRoles.get(this.moderatorParty);
                nextSpeaker = (moderatorConfig && moderatorConfig.speakingMode === "representative" && moderatorConfig.representative) 
                  ? moderatorConfig.representative 
                  : moderatorMembers[0];
                console.log(`Non-moderator ${currentSpeaker} addressing moderator ${nextSpeaker}`);
              } else {
                nextSpeaker = "All"; // Fallback
              }
            } else {
              // Moderator is speaking - they should direct to an approved speaker if available
              if (this.approvedSpeakers.length > 0) {
                nextSpeaker = this.approvedSpeakers[0].member;
                console.log(`Moderator ${currentSpeaker} addressing approved speaker ${nextSpeaker}`);
              } else {
                // No approved speakers, moderator addresses the next party as a whole
                nextSpeaker = "All";
                console.log(`Moderator ${currentSpeaker} addressing all as no approved speakers`);
              }
            }
          } else {
            // Default behavior for other modes
            const nextPartyMembers = this.parties.get(nextParty);
            nextSpeaker = nextPartyMembers ? nextPartyMembers[0] : "All"; // Default to first member or All if no members
          }
        }
      } else {
        nextSpeaker = this.getNextRoundRobinSpeaker(participants, currentSpeaker);
      }
  
      // Generate and process the reply
      const reply = await this.generateReplyMessage(
        currentAgent,
        this.getLastMessage(),
        nextSpeaker
      );
  
      if (reply.requiresHumanInput) {
        if (this.onHumanInputRequired) {
          this.onHumanInputRequired(currentSpeaker);
        }
        return;
      }

        const message = {
          sender: currentSpeaker,
        message: reply.fullResponse,
          recipient: nextSpeaker,
        isHumanInput: false
      };

      // Add party information if in party mode
      if (this.partyMode) {
        message.party = this.getAgentParty(currentSpeaker);
      }

        this.updateConversation(message);

      // Process backchannels if enabled
        if (!removeBackchannel) {
          const backchannelMessages = await this.processBackchannels(
          participants,
            currentSpeaker,
          message
          );
          backchannelMessages.forEach((msg) => this.updateConversation(msg));
        }
        
      // If in moderated mode and a non-moderator just spoke,
      // remove them from approved speakers list
      if (this.partyMode && this.partyTurnMode === "moderated" && message.party !== this.moderatorParty) {
        // Remove the speaker from approved speakers if they were on it
        this.approvedSpeakers = this.approvedSpeakers.filter(s => s.member !== currentSpeaker);
      }
      
      lastSpeaker = currentSpeaker;
      this.currentTurn++;
    }

    // Signal conversation completion if we've reached the end
    if (this.currentTurn >= this.maxTurns && this.onConversationComplete) {
      console.log("Calling onConversationComplete callback");
      this.onConversationComplete();
    }
  }

  getNextSpeakerExcluding(participants, excludedSpeakers) {
    // Make sure excludedSpeakers is always an array
    if (!Array.isArray(excludedSpeakers)) {
      excludedSpeakers = [excludedSpeakers];
    }
    
    // Filter out excluded speakers
    const eligibleSpeakers = participants.filter(p => !excludedSpeakers.includes(p));
    
    // Return a random eligible speaker, or "All" if none are available
    if (eligibleSpeakers.length === 0) {
      return "All";
    }
    
    return eligibleSpeakers[Math.floor(Math.random() * eligibleSpeakers.length)];
  }

  // Method to prepare a party's turn - determine which members will speak
  async preparePartyTurn(partyName, participants, lastSpeaker, isFirstTurn = false) {
    if (!this.parties || !this.parties.has(partyName)) {
      console.warn(`Party ${partyName} not found`);
      return null;
    }

    // Get party members
    let partyMembers = this.parties.get(partyName);
    console.log(`Preparing turn for party: ${partyName} with ${partyMembers.length} members`);

    // Start a fresh queue for this party turn
    this.currentPartyTurn = partyName;
    this.partySpeakerQueue = [];

    // Filter out last speaker if not first turn or if in free mode
    let eligibleSpeakers = [...partyMembers];

    // Special handling for impromptu phase - prevent derailer from speaking twice
    if (this.impromptuPhaseActive && partyName === 'Derailer') {
      // If derailer has already spoken, they should not speak again in this turn
      if (this.hasDerailerSpokenFirst || lastSpeaker === this.impromptuDerailer) {
        console.log(`Impromptu phase: Derailer ${this.impromptuDerailer} has already spoken, forcing transition to Participants`);
        this.currentPartyTurn = 'Participants';
        return this.preparePartyTurn('Participants', participants, lastSpeaker, isFirstTurn);
      }
    }

    // Filter out last speaker for non-first turns or free mode
    if ((this.partyTurnMode === "free" || !isFirstTurn) && lastSpeaker && partyMembers.includes(lastSpeaker)) {
      eligibleSpeakers = partyMembers.filter(member => member !== lastSpeaker);
      console.log(`Filtered out last speaker ${lastSpeaker} from eligible speakers`);
    }

    // If no eligible speakers in current party
    if (eligibleSpeakers.length === 0) {
      console.log(`No eligible speakers in party ${partyName}`);
      
      // For impromptu phase, handle special case of derailer party
      if (this.impromptuPhaseActive && partyName === 'Derailer') {
        console.log(`Impromptu phase: Derailer party has no eligible speakers, transitioning to Participants`);
        this.currentPartyTurn = 'Participants';
        return this.preparePartyTurn('Participants', participants, lastSpeaker, isFirstTurn);
      }
      
      return null;
    }

    // Determine speaking mode configuration
    const partyConfig = this.partyRoles.get(partyName) || {};
    const speakingMode = partyConfig.speakingMode || "all";

    switch (speakingMode) {
      case "representative": {
        const rep = partyConfig.representative;
        if (rep && partyMembers.includes(rep)) {
          this.partySpeakerQueue = [rep];
        } else {
          // Fallback to first eligible if representative is invalid
          this.partySpeakerQueue = [eligibleSpeakers[0]];
        }
        break;
      }
      case "subset": {
        const desired = typeof partyConfig.subsetSize === "number" && partyConfig.subsetSize > 0
          ? partyConfig.subsetSize
          : Math.ceil(eligibleSpeakers.length / 2);
        // Shuffle a copy and take desired count
        const shuffled = [...eligibleSpeakers].sort(() => Math.random() - 0.5);
        this.partySpeakerQueue = shuffled.slice(0, Math.min(desired, shuffled.length));
        break;
      }
      case "sequential": {
        // All eligible members in their current order
        this.partySpeakerQueue = [...eligibleSpeakers];
        break;
      }
      case "random": {
        // Randomize order of all eligible
        this.partySpeakerQueue = [...eligibleSpeakers].sort(() => Math.random() - 0.5);
        break;
      }
      case "all":
      default: {
        // Default to all eligible members (original order)
        this.partySpeakerQueue = [...eligibleSpeakers];
        break;
      }
    }

    // For impromptu phase, prevent derailer from speaking twice as first
    if (this.impromptuPhaseActive && this.impromptuDerailer) {
      // If derailer already spoke first, remove from the front of the queue
      if (this.hasDerailerSpokenFirst) {
        this.partySpeakerQueue = this.partySpeakerQueue.filter(s => s !== this.impromptuDerailer);
      } else if (this.partySpeakerQueue[0] === this.impromptuDerailer) {
        // Mark as spoken first and keep queue as is
        this.hasDerailerSpokenFirst = true;
        console.log(`Marked derailer ${this.impromptuDerailer} as having spoken first`);
      }
    }

    console.log(`Prepared party turn for ${partyName}, speakers: ${this.partySpeakerQueue.join(', ')}`);
    return this.partySpeakerQueue.length > 0 ? this.partySpeakerQueue[0] : null;
  }
  
  selectNextParty(currentParty) {
    if (!this.partyMode || !currentParty) {
      console.error("Invalid party or party mode not active:", currentParty);
      // Instead of returning null, return the first available party
      return Array.from(this.parties.keys())[0];
    }

    // Special handling for impromptu phase
    if (this.impromptuPhaseActive) {
      // In impromptu phase, alternate between derailer and participants parties
      const derailerParty = "Derailer";
      const participantsParty = "Participants";
      
      // Make sure both parties exist
      const partiesExist = this.parties.has(derailerParty) && this.parties.has(participantsParty);
      if (!partiesExist) {
        console.error("Impromptu phase parties missing - recreating parties");
        // Recreate parties if missing
        if (!this.parties.has(derailerParty) && this.impromptuDerailer) {
          this.parties.set(derailerParty, [this.impromptuDerailer]);
          this.partyMembership.set(this.impromptuDerailer, derailerParty);
        }
        
        if (!this.parties.has(participantsParty)) {
          // Add all agents except derailer to participants party
          const participants = this.agents
            .filter(agent => agent.name !== this.impromptuDerailer)
            .map(agent => agent.name);
          
          this.parties.set(participantsParty, participants);
          participants.forEach(name => {
            this.partyMembership.set(name, participantsParty);
          });
        }
      }
      
      // Handle undefined currentParty during impromptu phase
      if (currentParty === undefined || currentParty === null) {
        console.log("Impromptu phase: currentParty was undefined, using Participants as default next party");
        return participantsParty;
      }
      
      if (currentParty === derailerParty) {
        console.log("Impromptu phase: Switching from derailer to participants party");
        return participantsParty;
      } else {
        console.log("Impromptu phase: Switching from participants to derailer party");
        return derailerParty;
      }
    }

    // Rest of the method remains unchanged
    // Get all party names
    const partyNames = Array.from(this.parties.keys());
    if (partyNames.length === 0) {
      return null;
    }

    // For moderated mode with hand-raising
    if (this.partyTurnMode === "moderated" && this.handRaisingEnabled) {
      // If current party is moderator, check for approved speakers
      if (currentParty === this.moderatorParty) {
        if (this.approvedSpeakers.length > 0) {
          // Return the party of the approved speaker
          return this.approvedSpeakers[0].party;
        }
        // If no approved speakers but there are raised hands, stay with moderator
        if (this.raisedHandsQueue.length > 0) {
          return this.moderatorParty;
        }
        // If no raised hands, trigger hand-raising for other parties
        this.raiseHandsForAllParties(true);
        return this.moderatorParty;
      } else {
        // If current party is not moderator, always return to moderator
        return this.moderatorParty;
      }
    }

    // For free mode, select a random party that's not the current one
    if (this.partyTurnMode === "free") {
      const otherParties = partyNames.filter(p => p !== currentParty);
      if (otherParties.length === 0) {
        // If there's only one party, check if it has multiple members
        const currentPartyMembers = this.parties.get(currentParty) || [];
        if (currentPartyMembers.length <= 1) {
          // Only one member in the only party - we need to return the same party
          // but let preparePartyTurn handle the single member case
          console.log(`Only one party (${currentParty}) with a single member. Continuing with same party.`);
          return currentParty;
        }
        // Multiple members in the only party - we can still use it
        console.log(`Only one party (${currentParty}) but with multiple members (${currentPartyMembers.length}). Using it again.`);
        return partyNames[0];
      }
      
      // Get a random party that isn't the current one
      const nextParty = otherParties[Math.floor(Math.random() * otherParties.length)];
      console.log(`Free mode: Transitioning from "${currentParty}" to "${nextParty}"`);
      return nextParty;
    }

    // For round-robin mode, select the next party in sequence
    if (this.partyTurnMode === "round-robin") {
      const currentIndex = partyNames.indexOf(currentParty);
      return partyNames[(currentIndex + 1) % partyNames.length];
    }

    // Fallback to first party if something goes wrong
    return partyNames[0];
  }

  // Get context for party-based conversation
  getPartyContextForPattern(lastSpeaker, currentAgent, nextAgent) {
    if (!this.partyMode) {
      return "";
    }
    
    // Get party information - with null checks
    const currentParty = currentAgent?.name ? this.getAgentParty(currentAgent.name) : null;
    const lastSpeakerParty = lastSpeaker ? this.getAgentParty(lastSpeaker) : null;
    const nextAgentParty = typeof nextAgent === 'string' ? null : this.getAgentParty(nextAgent?.name);
    
    if (!currentParty) {
      return "";
    }
    
    // Get party config and description
    const partyConfig = this.partyRoles.get(currentParty) || {};
    const partyDescription = partyConfig.description || "";
    
    // Build context string
    let context = `You are a member of the "${currentParty}" party. ${partyDescription}\n`;
    
    // Add special context for moderator in moderated mode
    if (this.partyTurnMode === "moderated" && currentParty === this.moderatorParty) {
      context += "You are the moderator for this discussion. ";
      
      // If the last speaker was from a different party, acknowledge them
      if (lastSpeakerParty && lastSpeakerParty !== this.moderatorParty) {
        context += `The previous speaker (${lastSpeaker}) from party "${lastSpeakerParty}" just finished. You should acknowledge their contribution, reply to their question, and thoughtfully transition to the next speaker.\n`;
      }
      
      // Add hand-raising specific context only if enabled
      if (this.handRaisingEnabled) {
        if (this.raisedHandsQueue.length > 0) {
          // When there are raised hands, acknowledge the previous speaker and invite the next approved speaker
          context += `Members have raised their hands. You should reply to the previous speaker and invite one of them to speak next. Make sure to address them by name.\n`;
        } else if (this.approvedSpeakers.length > 0) {
          // When there's an approved speaker, direct to them
          const approvedName = this.approvedSpeakers[0].member;
          const approvedParty = this.approvedSpeakers[0].party;
          context += `You should direct your response to ${approvedName} from party "${approvedParty}" and invite them to share their perspective.\n`;
        } else {
          // When no hands are raised, keep the floor open without addressing anyone
          context += `Keep the floor open for anyone who would like to speak. You can pose a general question to continue the discussion or highlight an interesting point from the previous speaker.\n`;
        }
      }
      // For moderated mode, if next turn is going to a specific party
      else if (nextAgentParty && nextAgentParty !== this.moderatorParty) {
        context += `Next, you should reply to the previous speaker and invite the next speaker to share their perspective.\n`;
      }
      
      // Add general guidance for the moderator
      context += "As the moderator, always try to combine acknowledging previous speakers with introducing the next speakers in a single message to keep the conversation flowing smoothly. Don't just quote what they said - provide a thoughtful response that shows you understood their point. Do not mention party names in your acknowledgment or make assumptions about what the next speaker will say.\n";
    } else if (this.partyTurnMode === "moderated" && currentParty !== this.moderatorParty) {
      // Guidance for non-moderator parties in moderated mode
      const wasApproved = this.approvedSpeakers.some(s => s.member === currentAgent.name);
      
      if (wasApproved) {
        context += `You have been approved by the moderator ${lastSpeaker} to speak. Address your response to the ${lastSpeaker}, not directly to other parties. Speak thoughtfully and substantively since you've been given the floor.\n`;
      } else {
        context += `In this moderated discussion, wait until approved by the moderator before speaking at length. Keep responses brief unless called upon. If you want to speak, you need to raise your hand (which happens automatically in the system).\n`;
      }
    }
    
    return context;
  }

  // Process backchannel responses within a party
  async processPartyBackchannels(currentSpeaker, message) {
    if (!this.partyMode) {
      return [];
    }
    
    // Get the party of the current speaker
    const speakerParty = this.getAgentParty(currentSpeaker);
    if (!speakerParty) {
      return [];
    }
    
    // Get other members of the same party
    const partyMembers = this.parties.get(speakerParty);
    if (!partyMembers) {
      return [];
    }
    
    // Filter out the current speaker
    const otherMembers = partyMembers.filter(
      (member) => member !== currentSpeaker
    );
    
    if (otherMembers.length === 0) {
      return [];
    }
    
    // Get party configuration
    const partyConfig = this.partyRoles.get(speakerParty);
    const backchannelProb = partyConfig ? (partyConfig.backchannelProbability || 0.3) : 0.3;
    
    // Process backchannel for each party member
    const backchannelMessages = [];
    const backchannelPromises = otherMembers.map(async (member) => {
      // Apply probability filter
      if (Math.random() > backchannelProb) {
        return null;
      }
      
      const memberAgent = this.agents.find(a => a.name === member);
      if (!memberAgent) {
        return null;
      }
      
      // Generate supportive backchannel
      const vibe = ["Supportive", "Agreeable", "Nodding"][Math.floor(Math.random() * 3)];
      try {
        const backchannelText = await this.generateBackchannel(
          message,
          vibe,
          memberAgent
        );
        
        return {
          sender: member,
          message: backchannelText,
          recipient: currentSpeaker,
          isBackchannel: true,
          backchannelVibe: vibe,
          partyBackchannel: true,
          party: speakerParty
        };
      } catch (error) {
        console.error(`Error generating backchannel for ${member}:`, error);
        return null;
      }
    });
    
    // Wait for all backchannel generations to complete
    const results = await Promise.all(backchannelPromises);
    
    // Filter out null results
    return results.filter(result => result !== null);
  }
  
  // New method to initiate a party-based conversation
  async initiatePartyConversation(config) {
    const {
      initiator,
      startingMessage,
      agents,
      topic,
      subTopic,
      turnMode = "free",
      speakingMode = "random"
    } = config;

    const participants = agents.map(agent => agent.name);
    // Initialize party-related structures if needed
    if (!this.parties) this.parties = new Map();
    if (!this.partyMembership) this.partyMembership = new Map();
    if (!this.partyRoles) this.partyRoles = new Map();
    
    // Enable party mode if not already enabled
    this.enablePartyMode(turnMode);
    
    // Set speaking mode for all parties if specified
    if (speakingMode !== "all") {
      for (const [partyName, partyConfig] of this.partyRoles.entries()) {
        partyConfig.speakingMode = speakingMode;
        this.partyRoles.set(partyName, partyConfig);
      }
    }
    
    // Set topic and other configurations
    if (subTopic) {
      this.setTopic(
        `subtopic of this conversation is around ${subTopic}, where the main topic is ${topic}`,
      );
    } else {
      this.setTopic(`${topic}`);
    }
    
    // Now use the existing initiateConversation with party awareness
    return this.initiateConversation({
      initiator,
      startingMessage,
      participants,
      topic,
      subTopic
    });
  }

  getNextRoundRobinSpeaker(participants, lastSpeaker) {
    // Check if conversation is paused before proceeding
    if (this.isWaitingForApproval || this.conversationPaused) {
      console.log('Skipping next speaker selection - conversation is paused');
      return null;
    }
    
    // During impromptu phase, ensure derailer speaks first
    if (this.impromptuPhaseActive && this.impromptuDerailer && !this.hasDerailerSpokenFirst) {
      console.log(`Impromptu phase: ensuring derailer ${this.impromptuDerailer} speaks first`);
      this.hasDerailerSpokenFirst = true;
      return this.impromptuDerailer;
    }

    // In impromptu phase with derailer as last speaker, don't let them speak again
    if (this.impromptuPhaseActive && this.impromptuDerailer && lastSpeaker === this.impromptuDerailer) {
      console.log(`Impromptu phase: preventing derailer ${this.impromptuDerailer} from speaking twice`);
      // Find a participant that's not the derailer
      const nonDerailers = participants.filter(p => p !== this.impromptuDerailer);
      if (nonDerailers.length > 0) {
        const randomParticipant = nonDerailers[Math.floor(Math.random() * nonDerailers.length)];
        console.log(`Selected non-derailer participant ${randomParticipant}`);
        return randomParticipant;
      }
    }

    const result = chatUtils.getNextRoundRobinSpeaker(participants, lastSpeaker, this.lastSpeakerIndex);
    this.lastSpeakerIndex = result.updatedIndex;
    return result.nextSpeaker;
  }

  // Method to simulate parties raising hands based on their speaking mode
  raiseHandsForParty(partyName, excludeLastSpeaker = true) {
    // Skip hand raising if we're in an impromptu phase
    if (this.impromptuPhaseActive) {
      console.log(`raiseHandsForParty: Skipping hand raising during impromptu phase`);
      return [];
    }
    
    if (!this.handRaisingEnabled) {
      console.log(`raiseHandsForParty: No hands raised because handRaisingEnabled is false`);
      return [];
    }
    
    if (!partyName) {
      console.log(`raiseHandsForParty: No hands raised because partyName is not provided`);
      return [];
    }
    
    if (!this.parties.has(partyName)) {
      console.log(`raiseHandsForParty: No hands raised because party "${partyName}" doesn't exist`);
      return [];
    }
    
    // Don't allow moderator party to raise hands
    if (partyName === this.moderatorParty) {
      console.log(`raiseHandsForParty: No hands raised because "${partyName}" is the moderator party`);
      return [];
    }
    
    const partyMembers = this.parties.get(partyName);
    if (!partyMembers || partyMembers.length === 0) {
      console.log(`raiseHandsForParty: No hands raised because party "${partyName}" has no members`);
      return [];
    }
    
    const partyConfig = this.partyRoles.get(partyName);
    const lastSpeaker = this.getLastMessage()?.sender;
    
    console.log(`raiseHandsForParty: Processing for party "${partyName}" with ${partyMembers.length} members. Last speaker: ${lastSpeaker}`);
    
    // Filter out last speaker if needed
    let eligibleMembers = excludeLastSpeaker && lastSpeaker 
      ? partyMembers.filter(m => m !== lastSpeaker) 
      : [...partyMembers];
    
    if (eligibleMembers.length === 0) {
      console.log(`raiseHandsForParty: No eligible members in party "${partyName}" after filtering out last speaker`);
      // If all members were filtered out (unlikely), just use a random party member
      eligibleMembers = [partyMembers[Math.floor(Math.random() * partyMembers.length)]];
    }
    
    // Handle different speaking modes
    let handRaisers = [];
    
    switch (partyConfig && partyConfig.speakingMode ? partyConfig.speakingMode : "all") {
      case "representative":
        // Only the representative raises hand
        const representative = partyConfig && partyConfig.representative;
        if (representative && eligibleMembers.includes(representative)) {
          handRaisers = [representative];
          console.log(`raiseHandsForParty: Representative "${representative}" raising hand`);
        } else if (eligibleMembers.length > 0) {
          // Use first eligible member if no valid representative
          handRaisers = [eligibleMembers[0]];
          console.log(`raiseHandsForParty: No valid representative, using first eligible member "${eligibleMembers[0]}"`);
        }
        break;
        
      case "subset":
        // A subset of members raise hands
        const subsetSize = Math.min(
          eligibleMembers.length,
          partyConfig.subsetSize || Math.ceil(eligibleMembers.length / 2)
        );
        
        // Shuffle and select subset
        const shuffled = eligibleMembers.sort(() => Math.random() - 0.5);
        handRaisers = shuffled.slice(0, subsetSize);
        console.log(`raiseHandsForParty: Subset of ${subsetSize} members raising hands: ${handRaisers.join(', ')}`);
        break;
        
      case "all":
      default:
        // All eligible members raise hands
        handRaisers = [...eligibleMembers];
        console.log(`raiseHandsForParty: All eligible members raising hands: ${handRaisers.join(', ')}`);
        break;
    }
    
    // Add raised hands to queue and create system message
    const raisedHandObjects = handRaisers.map(member => ({ 
      party: partyName, 
      member,
      timestamp: Date.now()
    }));
    
    // Add system message only if there are raised hands
    if (handRaisers.length > 0) {
      console.log(`raiseHandsForParty: ${handRaisers.length} members from party "${partyName}" raised hands`);
      
      // Don't add to conversation here - this will be done by the calling method
      return raisedHandObjects;
    } else {
      console.log(`raiseHandsForParty: No hands raised from party "${partyName}" - something went wrong`);
    }
    
    return raisedHandObjects;
  }
  
  // Method to have all eligible parties raise hands
  raiseHandsForAllParties(excludeLastSpeaker = true) {
    // Skip hand raising if we're in an impromptu phase
    if (this.impromptuPhaseActive) {
      console.log(`raiseHandsForAllParties: Skipping hand raising during impromptu phase`);
      return [];
    }
    
    if (!this.handRaisingEnabled) {
      console.log(`raiseHandsForAllParties: Hand raising is disabled`);
      return [];
    }
    
    // Clear previous raised hands
    this.raisedHandsQueue = [];
    
    // Get the current party whose turn it is
    const currentParty = this.currentPartyTurn;
    
    // If current party is moderator or moderatorOnly is true, we need to have all other parties raise hands
    const isModerator = currentParty === this.moderatorParty;
    
    if (!currentParty) {
      console.log(`raiseHandsForAllParties: No current party defined`);
      return [];
    }
    
    // For normal case, only have the current party raise hands
    if (!isModerator) {
      console.log(`raiseHandsForAllParties: Getting party "${currentParty}" to raise hands`);
      const handRaisers = this.raiseHandsForParty(currentParty, excludeLastSpeaker);
      this.raisedHandsQueue.push(...handRaisers);
      
      // Add a system message to show who raised their hands
      if (handRaisers.length > 0) {
        const raisedMembers = handRaisers.map(hand => hand.member);
        const systemMessage = {
          sender: "System",
          message: `From party "${currentParty}": ${raisedMembers.join(', ')} have raised their hands.`,
          isSystemMessage: true
        };
        
        this.conversation.push(systemMessage);
        if (this.onMessageGenerated) {
          this.onMessageGenerated(systemMessage);
        }
      }
      
      console.log(`raiseHandsForAllParties: Party "${currentParty}": ${this.raisedHandsQueue.length} members have raised hands`);
    } else {
      // When the moderator is speaking and has a single member (or forced hand raising),
      // have all non-moderator parties raise hands
      const nonModeratorParties = Array.from(this.parties.keys()).filter(p => p !== this.moderatorParty);
      console.log(`raiseHandsForAllParties: Moderator's turn. Getting all non-moderator parties to raise hands: ${nonModeratorParties.join(', ')}`);
      
      let totalHandRaisers = 0;
      let allRaisedMembers = [];
      
      for (const partyName of nonModeratorParties) {
        const handRaisers = this.raiseHandsForParty(partyName, excludeLastSpeaker);
        this.raisedHandsQueue.push(...handRaisers);
        totalHandRaisers += handRaisers.length;
        
        // Collect all raised hands info for the system message
        if (handRaisers.length > 0) {
          const raisedMembers = handRaisers.map(hand => `${hand.member} (${hand.party})`);
          allRaisedMembers.push(...raisedMembers);
        }
      }
      
      // Add a single system message for all raised hands
      if (allRaisedMembers.length > 0) {
        const systemMessage = {
          sender: "System",
          message: `Members who raised their hands: ${allRaisedMembers.join(', ')}.`,
          isSystemMessage: true
        };
        
        this.conversation.push(systemMessage);
        if (this.onMessageGenerated) {
          this.onMessageGenerated(systemMessage);
        }
      }
      
      console.log(`raiseHandsForAllParties: Total ${totalHandRaisers} members from non-moderator parties have raised hands`);
    }
    
    return this.raisedHandsQueue;
  }
  
  // Method for moderator to approve a raised hand
  approveRaisedHand(memberToApprove) {
    if (!this.handRaisingEnabled || this.raisedHandsQueue.length === 0) {
      return null;
    }
    
    // Find the member in the raised hands queue
    const handIndex = this.raisedHandsQueue.findIndex(hand => hand.member === memberToApprove);
    
    if (handIndex === -1) {
      console.error(`Member "${memberToApprove}" not found in raised hands queue.`);
      return null;
    }
    
    // Check if this member is the same as the last person who spoke
    // to avoid having the same person speak repeatedly
    const lastMessage = this.getLastMessage();
    const lastSpeaker = lastMessage ? lastMessage.sender : null;
    
    if (memberToApprove === lastSpeaker) {
      console.log(`Warning: Attempting to approve ${memberToApprove} who just spoke last. Looking for alternative.`);
      
      // Find an alternative speaker from a different party
      const lastSpeakerParty = this.getAgentParty(lastSpeaker);
      const alternativeHands = this.raisedHandsQueue.filter(hand => 
        hand.member !== lastSpeaker && (hand.party !== lastSpeakerParty || this.raisedHandsQueue.length <= 1));
      
      if (alternativeHands.length > 0) {
        // Select an alternative speaker from a different party if possible
        const randomAltIndex = Math.floor(Math.random() * alternativeHands.length);
        const alternativeMember = alternativeHands[randomAltIndex].member;
        console.log(`Selected alternative speaker ${alternativeMember} instead of ${memberToApprove}`);
        
        // Recursively approve the alternative member
        return this.approveRaisedHand(alternativeMember);
      }
      // else proceed with approving the same speaker if no alternatives
    }
    
    // Get the party that just finished speaking (before the moderator)
    // This will be used to acknowledge them in the approval message
    const recentMessages = this.conversation.slice(-3);
    let previousParty = null;
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      if (recentMessages[i].party && recentMessages[i].party !== this.moderatorParty) {
        previousParty = recentMessages[i].party;
        break;
      }
    }
    
    // Remove from queue and add to approved speakers
    const approved = this.raisedHandsQueue.splice(handIndex, 1)[0];
    
    // Clear any existing approved speakers (we only allow one at a time in moderated mode)
    this.approvedSpeakers = [approved];
    
    // Create an approval message that acknowledges previous party and introduces approved speaker
    let approvalMessage;
    if (previousParty) {
      approvalMessage = {
        sender: "System",
        message: `The moderator approves ${approved.member} from party "${approved.party}" to speak next.`,
        isSystemMessage: true
      };
    } else {
      approvalMessage = {
        sender: "System",
        message: `The moderator has approved ${approved.member} from party "${approved.party}" to speak.`,
        isSystemMessage: true
      };
    }
    
    this.conversation.push(approvalMessage);
    if (this.onMessageGenerated) {
      this.onMessageGenerated(approvalMessage);
    }
    
    // Immediately transition to the approved speaker's party turn
    this.currentPartyTurn = approved.party;
    
    // Clear the party speaker queue and set the approved speaker as the next speaker
    this.partySpeakerQueue = [approved.member];
    
    return approved;
  }
  
  // Method to get the next approved speaker
  getNextApprovedSpeaker() {
    if (!this.handRaisingEnabled || this.approvedSpeakers.length === 0) {
      return null;
    }
    
    return this.approvedSpeakers[0].member;
  }
  
  // Method to remove speaker after they've spoken
  removeApprovedSpeaker(speaker) {
    if (!this.handRaisingEnabled || this.approvedSpeakers.length === 0) {
      return;
    }
    
    const speakerIndex = this.approvedSpeakers.findIndex(s => s.member === speaker);
    if (speakerIndex !== -1) {
      this.approvedSpeakers.splice(speakerIndex, 1);
    }
  }

  // Method to track impromptu phase progress
  trackImpromptuTurn() {
    if (!this.impromptuPhaseActive) {
      return { impromptuPhase: false };
    }
    
    // Only decrement turns if we haven't already ended the phase
    if (this.impromptuTurnsLeft > 0) {
      this.impromptuTurnsLeft--;
      console.log(`Tracking impromptu turn: ${this.impromptuTurnsLeft} turns left`);
    }
    
    const isEnding = this.impromptuTurnsLeft <= 0;
    
    // Only end the phase if we haven't already ended it
    if (isEnding && this.impromptuPhaseActive) {
      // Before ending the impromptu phase, capture the last speaker
      const lastSpeaker = this.getLastMessage()?.sender || this.currentInitiator;
      console.log(`Captured last speaker before ending impromptu phase: ${lastSpeaker}`);
      
      // End the impromptu phase
      this.endImpromptuPhase();
    }
    
    return {
      impromptuPhase: this.impromptuPhaseActive,
      turnsLeft: this.impromptuTurnsLeft,
      isEnding
    };
  }

  startImpromptuPhase(derailerAgent, derailMode, turns = 3) {
    if (!derailerAgent) {
      console.error('Invalid derailer agent:', derailerAgent);
      return null;
    }

    // Ensure the agent's derail mode is current (especially if using random mode)
    // This will re-randomize the derail mode if agent was set to random mode
    derailerAgent.startImpromptuPhase(turns);
    
    // Use the agent's current derail mode, which may have been re-randomized
    const currentDerailMode = derailerAgent.derailMode;
    
    console.log(`Starting impromptu phase with derailer ${derailerAgent.name}, mode ${currentDerailMode}, turns ${turns}`);
    
    // If auto-approve is enabled, activate the phase immediately without storing pending state
    if (this.autoApproveImpromptu) {
      console.log('DEBUG - Auto-approve mode detected: activating impromptu phase immediately');
      
      // Store original party settings to restore later
      this.originalPartyMode = this.partyMode;
      this.originalPartyTurnMode = this.partyTurnMode;
      this.originalModerator = this.moderatorParty;
      this.originalHandRaisingEnabled = this.handRaisingEnabled;
      this.predefinedParties = new Map(this.parties);
      
      // Store the current participants
      this.originalParticipants = [...(this.currentParticipants || this.agents.map(agent => agent.name))];
      
      // Enable impromptu phase
      this.impromptuPhaseActive = true;
      this.impromptuTurnsLeft = turns;
      this.impromptuDerailer = derailerAgent.name;
      this.impromptuDerailMode = currentDerailMode;
      
      // CRITICAL: Set hasDerailerSpokenFirst to true since the derailer has already spoken their derailing message
      // This prevents the derailer from speaking twice
      this.hasDerailerSpokenFirst = true;
      console.log(`Set hasDerailerSpokenFirst=true in auto-approve mode to prevent derailer speaking twice`);
      
      // Create a temporary new party setup with derailer as moderator
      this.parties = new Map();
      this.partyMembership = new Map();
      
      // Create a "derailer" party with the derailer as the only member
      const derailerParty = "Derailer";
      this.parties.set(derailerParty, [derailerAgent.name]);
      this.partyMembership.set(derailerAgent.name, derailerParty);
      
      // Create a "participants" party with everyone else
      const participantsParty = "Participants";
      const otherAgents = this.agents
        .filter(agent => agent.name !== derailerAgent.name)
        .map(agent => agent.name);
      
      this.parties.set(participantsParty, otherAgents);
      otherAgents.forEach(agent => {
        this.partyMembership.set(agent, participantsParty);
      });
      
      // Enable party mode with moderated turn-taking
      this.partyMode = true;
      this.partyTurnMode = "moderated";
      this.moderatorParty = derailerParty;
      this.handRaisingEnabled = false;
      
      // Create a system message announcing the impromptu phase
      const systemMessage = {
        sender: "System",
        message: `${derailerAgent.name} has started an impromptu discussion phase for ${turns} turns${currentDerailMode === "drift" ? " on a different topic" : " with a new perspective"}.`,
        isSystemMessage: true,
        impromptuPhase: true,
        derailMode: currentDerailMode,
        isImpromptuPhaseStart: true
      };
      
      // Add the system message to conversation
      this.conversation.push(systemMessage);
      if (this.onMessageGenerated) {
        this.onMessageGenerated(systemMessage);
      }
      
      // CRITICAL: Set the current party turn to Participants since derailer has already spoken
      this.currentPartyTurn = participantsParty;
      console.log(`Set initial party turn to Participants since derailer has already spoken`);
      
      // Select a random participant from the participants party to speak next
      if (otherAgents.length > 0) {
        const randomParticipant = otherAgents[Math.floor(Math.random() * otherAgents.length)];
        this.partySpeakerQueue = [randomParticipant];
        console.log(`Selected ${randomParticipant} to respond to the derailment`);
      }
      
      return {
        needsApproval: false,
        derailer: derailerAgent.name,
        derailMode: currentDerailMode,
        turns,
        impromptuPhase: true
      };
    }
    
    // For non-auto-approve mode, store the pending impromptu phase information
    this.pendingImpromptuPhase = {
      derailerAgent,
      derailMode: currentDerailMode,
      turns
    };
    
    // Set waiting flags since we're not in auto-approve mode
    this.isWaitingForApproval = true;
    this.conversationPaused = true;
    console.log('Conversation paused for impromptu phase approval');
    
    return {
      needsApproval: true,
      derailer: derailerAgent.name,
      derailMode: currentDerailMode,
      turns
    };
  }

  async handleImpromptuPhaseApproval(approved) {
    if (!this.pendingImpromptuPhase || !this.isWaitingForApproval) {
      console.log('No pending impromptu phase to approve/reject');
      return;
    }
    
    const { derailerAgent, derailMode, turns, response } = this.pendingImpromptuPhase;
    
    if (approved) {
      console.log(`Approving impromptu phase from ${derailerAgent.name} with mode: ${derailMode}`);
      
      // Store original party settings to restore later
      this.originalPartyMode = this.partyMode;
      this.originalPartyTurnMode = this.partyTurnMode;
      this.originalModerator = this.moderatorParty;
      this.originalHandRaisingEnabled = this.handRaisingEnabled;
      this.predefinedParties = new Map(this.parties);
      
      // Store the current participants
      this.originalParticipants = [...(this.currentParticipants || this.agents.map(agent => agent.name))];
      
      // Enable impromptu phase with the current derail mode from the pending phase (may have been changed via regeneration)
      this.impromptuPhaseActive = true;
      this.impromptuTurnsLeft = turns;
      this.impromptuDerailer = derailerAgent.name;
      this.impromptuDerailMode = derailMode; // Use the potentially updated derail mode
      
      // Reset the current turn count to ensure we don't end prematurely
      // This is critical to prevent the conversation from being marked as "done"
      this.currentTurn = 0;
      
      // Set this flag to true since the derailer has already spoken with their derailing message
      this.hasDerailerSpokenFirst = true;
      console.log(`Set hasDerailerSpokenFirst=true to prevent derailer from speaking twice`);
      
      // Create a temporary new party setup with derailer as moderator
      this.parties = new Map();
      this.partyMembership = new Map();
      
      // Create a "derailer" party with the derailer as the only member
      const derailerParty = "Derailer";
      this.parties.set(derailerParty, [derailerAgent.name]);
      this.partyMembership.set(derailerAgent.name, derailerParty);
      
      // Create a "participants" party with everyone else
      const participantsParty = "Participants";
      const otherAgents = this.agents
        .filter(agent => agent.name !== derailerAgent.name)
        .map(agent => agent.name);
      
      this.parties.set(participantsParty, otherAgents);
      otherAgents.forEach(agent => {
        this.partyMembership.set(agent, participantsParty);
      });
      
      // Enable party mode with moderated turn-taking
      this.partyMode = true;
      this.partyTurnMode = "moderated";
      this.moderatorParty = derailerParty;
      this.handRaisingEnabled = false;
      
      // First, remove any existing derailing messages with needsApproval flag
      // This ensures we're not displaying duplicate messages if the message was regenerated
      for (let i = this.conversation.length - 1; i >= 0; i--) {
        const msg = this.conversation[i];
        if (msg.sender === derailerAgent.name && msg.isDerailing && msg.needsApproval) {
          console.log(`Removing existing derailing message at index ${i} to avoid duplicates`);
          this.conversation.splice(i, 1);
        }
      }
      
      // Generate a unique timestamp for this impromptu phase
      const phaseTimestamp = Date.now();
      
      // Create system message announcing the impromptu phase with the current mode
      let modeDescription = "with a new perspective";
      if (derailMode === "drift") {
        modeDescription = "on a different topic";
      } else if (derailMode === "question") {
        modeDescription = "with a thought-provoking question";
      } else if (derailMode === "emotional") {
        modeDescription = "focusing on emotional aspects";
      }
      
      const systemMessage = {
        sender: "System",
        message: `${derailerAgent.name} has started an impromptu discussion phase for ${turns} turns ${modeDescription}.`,
        isSystemMessage: true,
        impromptuPhase: true,
        derailMode: derailMode,
        isImpromptuPhaseStart: true,
        phaseTimestamp: phaseTimestamp // Add unique timestamp
      };
      
      // Add the system message to conversation
      this.conversation.push(systemMessage);
      if (this.onMessageGenerated) {
        this.onMessageGenerated(systemMessage);
      }
      
      console.log(`Added system message announcing impromptu phase with mode: ${derailMode}`);
      
      // Now add the regenerated message (if available) after the system message
      if (response) {
        // Create a copy of the response with updated properties
        const approvedResponse = {
          ...response,
          needsApproval: false,
          isApproved: true,
          phaseTimestamp: phaseTimestamp,
          impromptuPhase: true, // Mark as part of impromptu phase
          derailMode: derailMode // Use current derail mode (may have been changed)
        };
        
        // Add it to the conversation
        this.conversation.push(approvedResponse);
        
        // Emit the updated message to ensure UI refreshes
        if (this.onMessageGenerated) {
          this.onMessageGenerated(approvedResponse);
        }
        
        // Update the agent's derail mode to match the regenerated message for consistency
        const liveDerailerAgent = this.getAgentByName(derailerAgent.name);
        if (liveDerailerAgent) {
          liveDerailerAgent.setDerailMode(derailMode);
          console.log(`Updated ${derailerAgent.name}'s derail mode to ${derailMode} for consistency with approved message`);
        }
        
        console.log(`Added approved derail message with mode ${derailMode}: "${approvedResponse.message?.substring(0, 50)}..."`);
      } else {
        console.warn('No derailing response found in pending impromptu phase');
      }
    } else {
      console.log(`Rejecting impromptu phase from ${derailerAgent.name}`);
      
      // Set cooldown flag
      this.recentlyRejectedImpromptu = true;
      this.impromptuDerailer = derailerAgent.name;
      
      // Remove the pending message from conversation
      if (response) {
        const pendingMsgIndex = this.conversation.findIndex(msg => 
          msg.sender === response.sender && 
          msg.needsApproval === true && 
          msg.isDerailing === true
        );
        
        if (pendingMsgIndex !== -1) {
          console.log(`Removing rejected derail message from ${response.sender} from conversation`);
          this.conversation.splice(pendingMsgIndex, 1);
        }
      }
      
      // Clear cooldown after delay
      setTimeout(() => {
        this.recentlyRejectedImpromptu = false;
        this.impromptuDerailer = null;
      }, 2000); // Reduced cooldown to 2 seconds
    }
    
    // Clear pending state
    this.pendingImpromptuPhase = null;
    this.isWaitingForApproval = false;
    this.conversationPaused = false;
  }

  storePendingImpromptuPhase(derailerAgent, derailMode, turns, response, messageConfig = {}) {
    if (!derailerAgent || !derailerAgent.name) {
      console.error('Invalid derailer agent:', derailerAgent);
      return;
    }

    console.log('Storing pending impromptu phase:', {
      derailer: derailerAgent.name,
      mode: derailMode,
      turns,
      messageConfig
    });
    
    console.log(`DEBUG - storePendingImpromptuPhase - autoApproveImpromptu is ${this._autoApproveImpromptu}, requireImpromptuApproval is ${this.requireImpromptuApproval}`);
    
    // If auto-approve is enabled or approval is not required, don't store pending state
    if (this._autoApproveImpromptu || !this.requireImpromptuApproval) {
      console.log('DEBUG - No approval needed: skipping pending state storage and not setting wait flags');
      return;
    }
    
    // Store only necessary agent information
    const derailerInfo = {
      name: derailerAgent.name,
      personality: derailerAgent.personality,
      interactionPattern: derailerAgent.interactionPattern,
      derailMode: derailerAgent.derailMode,
      party: derailerAgent.party
    };
    
    this.pendingImpromptuPhase = {
      derailerAgent: derailerInfo,
      derailMode,
      turns,
      response,
      messageConfig
    };

    // Set waiting flag since we're in human-control mode
    this.isWaitingForApproval = true;
    this.conversationPaused = true;
    console.log('Setting waiting for approval flags in human-control mode');
  }

  async checkForDerailInterventions(participants, lastSpeaker, lastMessage) {
    // Skip if we're already in an impromptu phase or if no lastMessage
    if (this.impromptuPhaseActive || !lastMessage || !this.derailingEnabled) {
      return null;
    }
    
    // Find derailer agents
    const derailerAgents = this.agents.filter(agent => 
      agent.isDerailer && agent.name !== lastSpeaker
    );
    
    if (derailerAgents.length === 0) {
      return null;
    }
    
    // Check each derailer to see if they want to intervene
    for (const derailerAgent of derailerAgents) {
      // Skip if we recently rejected this derailer's intervention
      if (this.recentlyRejectedImpromptu && this.impromptuDerailer === derailerAgent.name) {
        console.log(`Skipping derailer ${derailerAgent.name} due to recent rejection`);
        continue;
      }
      
      // Store the original threshold
      const originalThreshold = derailerAgent.derailThreshold;
      
      // Override threshold for first two impromptu phases
      if (this.impromptuPhaseCount < 2) {
        derailerAgent.derailThreshold = 1; // 100% chance to derail
        console.log(`Setting derail threshold to 1 for phase ${this.impromptuPhaseCount + 1}`);
      }
      
      // Check if derailer wants to interrupt based on threshold
      const shouldDerail = Math.random() <= derailerAgent.derailThreshold;
      
      // Restore original threshold
      if (this.impromptuPhaseCount < 2) {
        derailerAgent.derailThreshold = originalThreshold;
      }
      
      if (!shouldDerail) {
        continue; // Skip this derailer
      }
      
      // Start impromptu phase for this agent to re-randomize derail mode if needed
      const minTurns = derailerAgent.minImpromptuTurns || 3;
      const maxTurns = derailerAgent.maxImpromptuTurns || 5;
      const turnCount = Math.floor(Math.random() * (maxTurns - minTurns + 1)) + minTurns;
      derailerAgent.startImpromptuPhase(turnCount);
      
      // Attempt to get a derail response
      try {
        const derailResponse = await derailerAgent.generateDerailResponse(lastMessage.message);
        
        if (derailResponse && derailResponse.isDerailing) {
          console.log(`Derailer ${derailerAgent.name} is intervening with mode: ${derailerAgent.derailMode}`);
          console.log(`Derailer ${derailerAgent.name} will lead impromptu phase for ${turnCount} turns`);
          
          // Increment the impromptu phase counter
          this.impromptuPhaseCount++;
          console.log(`Incremented impromptu phase count to ${this.impromptuPhaseCount}`);
          
          return {
            sender: derailerAgent.name,
            message: derailResponse.fullResponse,
            isHumanInput: false,
            derailerAgent: derailerAgent,
            derailMode: derailerAgent.derailMode,
            turnCount: turnCount,
            isDerailing: true
          };
        }
      } catch (error) {
        console.error(`Error generating derail response from ${derailerAgent.name}:`, error);
      }
    }
    
    return null;
  }

  // Method to check for proactive responses from agents
  async checkForProactiveResponses(participants, lastSpeaker, lastMessage) {
    // Skip if no last message or if we're in impromptu phase
    if (!lastMessage || this.impromptuPhaseActive) {
      return null;
    }
    
    // Find proactive agents that aren't the last speaker
    const proactiveAgents = this.agents.filter(agent => 
      agent.isProactive && agent.name !== lastSpeaker
    );
    
    if (proactiveAgents.length === 0) {
      return null;
    }
    
    // Get basic context from the conversation
    const context = `Topic: ${this.topic}\nCurrent discussion: ${lastMessage.message}`;
    
    // Check each proactive agent
    for (const proactiveAgent of proactiveAgents) {
      // Check if agent should react proactively
      const shouldReact = proactiveAgent.shouldReactProactively(
        lastMessage.message, 
        context
      );
      
      if (!shouldReact) {
        continue;
      }
      
      // Generate proactive response
      try {
        const proactiveResponse = await proactiveAgent.generateProactiveResponse(
          lastMessage.message,
          context
        );
        
        if (proactiveResponse) {
          console.log(`Agent ${proactiveAgent.name} is responding proactively`);
          
          return {
            sender: proactiveAgent.name,
            message: proactiveResponse.fullResponse,
            isHumanInput: false,
            isProactive: true
          };
        }
      } catch (error) {
        console.error(`Error generating proactive response from ${proactiveAgent.name}:`, error);
      }
    }
    
    return null;
  }
  
  // Method to generate a reply message from an agent
  async generateReplyMessage(currentAgent, lastMessage, nextRecipient) {
    if (!currentAgent) {
      console.error("generateReplyMessage: currentAgent is undefined");
      return { fullResponse: "I can't respond right now." };
    }
    
    if (currentAgent.isHumanProxy) {
      return { requiresHumanInput: true, speaker: currentAgent.name };
    }
    
    // Use the last message or provide an empty one
    const lastMessageText = lastMessage ? lastMessage.message : "";
    
    // Get the appropriate context for this interaction
    const context = await this.getContextForPattern(
      lastMessage ? lastMessage.sender : null,
      currentAgent,
      nextRecipient
    );
    
    // Add party-specific context if in party mode
    let fullContext = context;
    if (this.partyMode) {
      const partyContext = this.getPartyContextForPattern(
        lastMessage ? lastMessage.sender : null,
        currentAgent,
        nextRecipient
      );
      
      if (partyContext) {
        fullContext = `${context}\n\n${partyContext}`;
      }
      
      // Add transition context if this is a transition message
      if (lastMessage && lastMessage.isTransitionMessage) {
        let transitionContext = "\nAs the moderator, reply to the previous speaker and ";
        
        if (lastMessage.nextSpeaker && lastMessage.nextSpeakerParty) {
          // Make sure the moderator doesn't refer to themselves as the next speaker
          const isReferringToSelf = lastMessage.nextSpeaker === currentAgent.name;
          if (isReferringToSelf) {
            console.warn(`WARNING: Moderator ${currentAgent.name} was about to refer to themselves as the next speaker. Correcting...`);
            // Find an appropriate approved speaker instead
            if (this.approvedSpeakers && this.approvedSpeakers.length > 0) {
              lastMessage.nextSpeaker = this.approvedSpeakers[0].member;
              lastMessage.nextSpeakerParty = this.approvedSpeakers[0].party;
              console.log(`Corrected next speaker to approved speaker: ${lastMessage.nextSpeaker}`);
            } else {
              // If no approved speakers, just invite any party to speak
              transitionContext += "invite others to share their perspectives.";
              console.log("No approved speakers found, inviting others instead");
              fullContext = `${fullContext}\n${transitionContext}`;
              return fullContext;
            }
          }
          
          // Now we're sure we're not referring to ourselves
          transitionContext += `introduce the next speaker: ${lastMessage.nextSpeaker}${lastMessage.nextSpeakerParty ? ` from party "${lastMessage.nextSpeakerParty}"` : ""}.`;
          transitionContext += `\nIMPORTANT: Do NOT refer to yourself. Address ${lastMessage.nextSpeaker} directly in your response.`;
        } else {
          transitionContext += "invite others to share their perspectives.";
          transitionContext += "\nIMPORTANT: Do NOT refer to yourself in your response.";
        }
        
        fullContext = `${fullContext}\n${transitionContext}`;
      }
    }
    
    // For the recipient, use the name or "All"
    let recipientName = typeof nextRecipient === 'string' ? 
                        nextRecipient : 
                        (nextRecipient ? nextRecipient.name : "All");
    
    try {
      const interruptionInfo = this.shouldInterrupt(currentAgent, nextRecipient);
      
      // Generate the reply
      // Propagate per-request LLM options if present
      if (this.llmOptions) {
        currentAgent.llmOptions = this.llmOptions;
      }
      return await currentAgent.reply(lastMessageText, fullContext, recipientName, interruptionInfo);
    } catch (error) {
      console.error(`Error generating reply from ${currentAgent.name}:`, error);
      return { fullResponse: "I apologize, but I'm having trouble formulating a response." };
    }
  }
  
  // Process backchannels from other agents in response to a message
  async processBackchannels(participants, currentSpeaker, lastMessage) {
    if (!lastMessage) {
      return [];
    }
    
    // First check for party-specific backchannels
    if (this.partyMode) {
      const partyBackchannels = await this.processPartyBackchannels(currentSpeaker, lastMessage.message);
      if (partyBackchannels.length > 0) {
        return partyBackchannels;
      }
    }
    
    // Regular backchannels
    const backchannelMessages = [];
    const backchannelPromises = participants
      .filter(agentName => agentName !== currentSpeaker) // Don't backchannel to yourself
      .map(async (agentName) => {
        const agent = this.agents.find(a => a.name === agentName);
        if (!agent) return null;
        
        // Check if this agent should backchannel
        const backchannelInfo = this.shouldBackChannel(
          this.agents.find(a => a.name === currentSpeaker),
          agentName
        );
        
        if (!backchannelInfo.backchannel) {
          return null;
        }
        
        try {
          const backchannelText = await this.generateBackchannel(
            lastMessage.message,
            backchannelInfo.vibe,
            agent
          );
          
          return {
            sender: agentName,
            message: backchannelText,
            recipient: currentSpeaker,
            isBackchannel: true,
            backchannelVibe: backchannelInfo.vibe
          };
        } catch (error) {
          console.error(`Error generating backchannel for ${agentName}:`, error);
          return null;
        }
      });
    
    // Wait for all backchannel generations to complete
    const results = await Promise.all(backchannelPromises);
    
    // Filter out null results
    return results.filter(result => result !== null);
  }
  
  // Generate backchannel text from an agent
  async generateBackchannel(message, vibe, agent) {
    return await chatUtils.generateBackchannel(message, vibe, agent);
  }

  updateConversation(message) {
    // Add party information to the message if in party mode
    if (this.partyMode && message.sender && message.sender !== "System") {
      message.party = this.getAgentParty(message.sender);
    }
    
    // Add impromptu phase flag if we're in an impromptu phase
    if (this.impromptuPhaseActive && !message.impromptuPhase) {
      message.impromptuPhase = true;
      
      // Add derail mode information if it exists
      if (this.impromptuDerailMode && !message.derailMode) {
        message.derailMode = this.impromptuDerailMode;
      }
    }
    
    // Add the message to the conversation array
    this.conversation.push(message);
    
    // Add message to memory for context tracking
    if (this.memory) {
      this.memory.addMessage(message);
    }
    
    // Call the message generated callback if provided
    if (this.onMessageGenerated) {
      this.onMessageGenerated(message);
    }
    
    // Only track turns for actual conversation messages 
    // Exclude: system messages, transition messages, ending phase messages, and backchannels
    if (this.impromptuPhaseActive && 
        !message.isSystemMessage && 
        !message.isTransition && 
        !message.isEndingPhase && 
        !message.isBackchannel && // Exclude backchannels
        !message.isProactive && // Also exclude proactive messages
        !this.isBackchannelMessage(message)) { // Additional check for backchannel content
      const phaseStatus = this.trackImpromptuTurn();
      if (phaseStatus.isEnding) {
        console.log(`Impromptu phase ending after message from ${message.sender}`);
      } else if (this.impromptuTurnsLeft >= 0) {
        console.log(`Tracked impromptu turn after message from ${message.sender}, turns left: ${this.impromptuTurnsLeft}`);
      }
    }
  }

  // Helper method to check if a message is a backchannel based on its content
  isBackchannelMessage(message) {
    if (!message || !message.message) return false;
    
    // Check for typical backchannel indicators in the message
    const backchannelPatterns = [
      /nodding/i,
      /nods/i,
      /smiles/i,
      /laughs/i,
      /gestures/i,
      /shakes.*head/i,
      /raises.*eyebrow/i,
      /tilts.*head/i,
      /leans/i,
      /grins/i
    ];
    
    return backchannelPatterns.some(pattern => pattern.test(message.message));
  }
  
  // Display the full conversation
  displayConversation() {
    if (this.conversation.length === 0) {
      console.log("No conversation to display.");
      return;
    }
    
    console.log("\n===== CONVERSATION =====");
    this.conversation.forEach((message, index) => {
      const partyInfo = message.party ? ` (${message.party})` : '';
      const recipientInfo = message.recipient && message.recipient !== "All" ? ` → ${message.recipient}` : '';
      const messageType = message.isSystemMessage ? "[SYSTEM]" : 
                         message.isBackchannel ? "[BACKCHANNEL]" : 
                         message.isTransition ? "[TRANSITION]" : "";
      
      console.log(`[${index}] ${message.sender}${partyInfo}${recipientInfo} ${messageType}: ${message.message}`);
    });
    console.log("=======================\n");
  }

  // Method to get the next speaker in a conversation
  getNextSpeaker(participants, lastSpeaker) {
    // Check if we have a forced next speaker from transition
    if (this.forcedNextSpeaker) {
      const nextSpeaker = this.forcedNextSpeaker;
      this.forcedNextSpeaker = null; // Clear it after use
      return nextSpeaker;
    }
    
    // Filter out the transition speaker from eligible participants
    if (this.transitionSpeaker) {
      const eligibleParticipants = participants.filter(p => 
        p !== this.transitionSpeaker && 
        p !== this.impromptuDerailer &&
        !this.agents.find(a => a.name === p && a.isDerailer)
      );
      
      // If we have eligible participants, use round-robin with them
      if (eligibleParticipants.length > 0) {
        const result = chatUtils.getNextRoundRobinSpeaker(eligibleParticipants, lastSpeaker, this.lastSpeakerIndex);
        this.lastSpeakerIndex = result.updatedIndex;
        // Clear transition speaker after using it to filter
        this.transitionSpeaker = null;
        return result.nextSpeaker;
      }
    }
    
    return this.getNextRoundRobinSpeaker(participants, lastSpeaker);
  }

  /**
   * Load content from a file and initialize content mode
   * @param {string} filename - Name of the file to load
   * @param {Array<string>|string|null} owners - Owner(s) of the content (agent or party names)
   * @param {boolean} isParty - Whether owners are parties
   * @param {string|null} presenter - Agent or party presenting the content
   * @param {boolean} presenterIsParty - Whether the presenter is a party
   * @returns {Promise<string>} Content ID
   */
  async initializeContentMode(filename, owners = null, isParty = false, presenter = null, presenterIsParty = null) {
    try {
      // Load the content
      const content = await this.contentManager.loadContent(filename);
      
      // If presenterIsParty is not specified but presenter is, use isParty value
      if (presenter !== null && presenterIsParty === null) {
        presenterIsParty = isParty;
      }
      
      // Assign ownership or set as public
      if (owners) {
        this.contentManager.assignOwnership(content.id, owners, isParty, presenter);
      } else {
        this.contentManager.setContentAsPublic(content.id, presenter, presenterIsParty);
      }
      
      // Set as active content
      this.activeContentId = content.id;
      this.contentMode = true;
      
      // Set the content title as the conversation topic
      this.setTopic(`Discussion about ${content.metadata.filename}`);
      
      // Get ownership details for logging
      const ownership = this.contentManager.getOwnership(content.id);
      const presenterInfo = ownership.presenter 
        ? ` (presented by ${ownership.presenter})` 
        : '';
      
      console.log(`Content mode initialized with ${filename} (ID: ${content.id})${presenterInfo}`);
      
      return content.id;
    } catch (error) {
      console.error("Error initializing content mode:", error);
      throw error;
    }
  }
  
  /**
   * Disable content mode
   */
  disableContentMode() {
    this.contentMode = false;
    this.activeContentId = null;
    console.log("Content mode disabled");
  }
  
  /**
   * Check if an agent has access to the active content
   * @param {string} agentName - Name of the agent
   * @returns {boolean} Whether the agent has access
   */
  agentHasContentAccess(agentName) {
    if (!this.contentMode || !this.activeContentId) {
      return false;
    }
    
    return this.contentManager.hasAccess(
      this.activeContentId,
      agentName,
      this.partyMembership
    );
  }
  
  /**
   * Get content prompt for an agent
   * @param {string} agentName - Name of the agent
   * @returns {string} Content prompt or empty string
   */
  getContentPromptForAgent(agentName) {
    if (!this.contentMode || !this.activeContentId) {
      return '';
    }
    
    return this.contentManager.getContentPrompt(
      this.activeContentId,
      agentName,
      this.partyMembership
    );
  }

  // Method to get the last non-backchannel message
  getLastMessage() {
    if (this.conversation.length === 0) {
      return null;
    }

    // Find the last message that is neither a system message nor a backchannel
    for (let i = this.conversation.length - 1; i >= 0; i--) {
      const message = this.conversation[i];
      // Skip system messages and backchannels
      if (!message.isBackchannel && 
          !message.isSystemMessage && 
          !message.message?.toLowerCase().includes('has raised their hand') &&
          !message.message?.toLowerCase().includes('hand has been approved') &&
          !message.message?.toLowerCase().includes('is now the moderator') &&
          !message.message?.toLowerCase().includes('has joined the conversation') &&
          !message.message?.toLowerCase().includes('has left the conversation') &&
          !message.message?.toLowerCase().includes('turn order is now') &&
          !message.message?.toLowerCase().includes('the conversation mode is now')) {
        return message;
      }
    }

    // If all messages were system messages or backchannels, return null
    return null;
  }

  // Method to end impromptu phase
  async endImpromptuPhase() {
    // Store the last message's sender before ending the phase
    const lastSpeaker = this.getLastMessage()?.sender || this.currentInitiator;
    
    // Clear any pending next speaker to prevent continuation of previous context
    this.nextSpeaker = null;
    this.partySpeakerQueue = [];
    this.approvedSpeakers = [];
    console.log('Cleared next speaker queue to prevent continuation of previous context');
    
    // Create system message announcing end of impromptu phase
    const systemMessage = {
      sender: "System",
      message: `The impromptu discussion phase has ended. Returning to the regular conversation.`,
      isSystemMessage: true,
      impromptuPhase: true,
      isEndingPhase: true
    };
    
    this.conversation.push(systemMessage);
    if (this.onMessageGenerated) {
      this.onMessageGenerated(systemMessage);
    }
    
    // Restore original party settings
    this.partyMode = this.originalPartyMode;
    this.partyTurnMode = this.originalPartyTurnMode;
    this.moderatorParty = this.originalModerator;
    this.handRaisingEnabled = this.originalHandRaisingEnabled;
    this.parties = new Map(this.predefinedParties);
    
    // Restore the original participants list
    if (this.originalParticipants && Array.isArray(this.originalParticipants)) {
      this.currentParticipants = [...this.originalParticipants];
      console.log(`Restored original participants: ${this.currentParticipants.join(', ')}`);
    } else {
      // Fallback to using all agent names if original participants is missing
      this.currentParticipants = [...this.agents.map(agent => agent.name)];
      console.log(`No original participants found, using agent names: ${this.currentParticipants.join(', ')}`);
    }
    
    // Rebuild party membership map
    this.partyMembership = new Map();
    for (const [partyName, members] of this.parties) {
      for (const member of members) {
        this.partyMembership.set(member, partyName);
      }
    }
    
    // Reset impromptu phase properties
    this.impromptuPhaseActive = false;
    this.impromptuTurnsLeft = 0;
    this.impromptuDerailer = null;
    this.impromptuDerailMode = null;
    this.hasDerailerSpokenFirst = false;
    
    // Clear predefined parties storage
    this.predefinedParties = new Map();
    
    // Reset other impromptu-related properties
    this.originalHandRaisingEnabled = undefined;
    
    // Re-enable derailing for all derailer agents
    for (const agent of this.agents) {
      if (agent.isDerailer) {
        agent.setAsDerailer(true);
        console.log(`Re-enabling derailer functionality for ${agent.name}`);
      }
    }
    
    // Re-enable derailing based on conversation mode
    if (this.autoApproveImpromptu || this.requireImpromptuApproval) {
      this.derailingEnabled = true;
      console.log('Re-enabling derailing after impromptu phase');
    }
    
    // Find an appropriate speaker for the transition
    // Exclude both the last speaker and the derailer
    const eligibleSpeakers = this.agents
      .filter(agent => 
        agent.name !== lastSpeaker && 
        agent.name !== this.impromptuDerailer &&
        !agent.isDerailer // Also exclude any other derailer agents
      )
      .map(agent => agent.name);

    if (eligibleSpeakers.length > 0) {
      // Select a random eligible speaker
      const transitionSpeaker = eligibleSpeakers[Math.floor(Math.random() * eligibleSpeakers.length)];
      
      // Find the next eligible speaker (excluding both lastSpeaker and transitionSpeaker)
      const nextEligibleSpeakers = this.agents
        .filter(agent => 
          agent.name !== lastSpeaker && 
          agent.name !== transitionSpeaker &&
          agent.name !== this.impromptuDerailer &&
          !agent.isDerailer
        )
        .map(agent => agent.name);
      
      // If we have eligible next speakers, select one randomly
      let nextSpeaker = null;
      if (nextEligibleSpeakers.length > 0) {
        nextSpeaker = nextEligibleSpeakers[Math.floor(Math.random() * nextEligibleSpeakers.length)];
      } else {
        // If no other eligible speakers, use the transition speaker as fallback
        nextSpeaker = transitionSpeaker;
      }
      
      // Store both speakers in class properties
      this.transitionSpeaker = transitionSpeaker;
      this.nextSpeakerAfterTransition = nextSpeaker;
      
      // Generate the transition message first, but don't add it yet
      // Generate a more dynamic transition message that references the impromptu discussion
      const transitionPhrases = [
        `Now that we've discussed that, let's return to our main conversation.`,
        `That was an interesting detour. Shall we continue with our original discussion?`,
        `Thanks for that insight. Let's get back to what we were talking about.`,
        `That's a good point to consider. Now, returning to our main topic...`,
        `Having explored that tangent, let's resume our conversation.`
      ];
      
      // Select a random transition phrase
      const randomIndex = Math.floor(Math.random() * transitionPhrases.length);
      let transitionPhrase = transitionPhrases[randomIndex];
      
      // If we have impromptu messages, try to reference their content
      if (this.impromptuMessages && this.impromptuMessages.length > 0) {
        // Get the topic or key point from the impromptu phase if possible
        const topicKeywords = this.impromptuMessages
          .map(msg => msg.message)
          .join(' ')
          .split(' ')
          .filter(word => word.length > 5)
          .slice(0, 3)
          .join(', ');
        
        if (topicKeywords) {
          const topicReferences = [
            `After our discussion about ${topicKeywords}, let's get back to our main conversation.`,
            `That was an interesting point about ${topicKeywords}. Now, where were we?`,
            `Having covered ${topicKeywords}, shall we continue with our original topic?`
          ];
          transitionPhrase = topicReferences[Math.floor(Math.random() * topicReferences.length)];
        }
      }
      
      const transitionMessage = {
        sender: transitionSpeaker,
        recipient: nextSpeaker === transitionSpeaker ? "All" : nextSpeaker, // Direct to next speaker if different
        message: transitionPhrase,
        isSystemGenerated: true,
        isTransition: true,
        nextSpeaker: nextSpeaker // Include next speaker in message
      };
      
      // Check for derailer interventions immediately after phase end
      let derailInterventionDetected = false;
      if (this.derailingEnabled && this.nextSpeakerAfterTransition) {
        console.log('Checking for derailer interventions immediately after impromptu phase');
        const derailResponse = await this.checkForDerailInterventions(
          this.currentParticipants || this.agents.map(agent => agent.name),
          this.nextSpeakerAfterTransition,
          this.getLastMessage()
        );

        if (derailResponse) {
          derailInterventionDetected = true;
          console.log(`Derailer intervention detected immediately after impromptu phase from ${derailResponse.sender}`);
          
          if (this.autoApproveImpromptu || !this.requireImpromptuApproval) {
            // First add the transition message to maintain conversation flow
            this.conversation.push(transitionMessage);
            if (this.onMessageGenerated) {
              this.onMessageGenerated(transitionMessage);
            }
            console.log(`Added transition message from ${transitionSpeaker} before auto-approved derail`);
            
            // Start new impromptu phase with derailer as moderator (autonomous mode)
            this.startImpromptuPhase(
              derailResponse.derailerAgent,
              derailResponse.derailMode,
              derailResponse.turnCount || 3
            );

            // Make sure hasDerailerSpokenFirst is true to prevent double speaking
            this.hasDerailerSpokenFirst = true;
            console.log(`Ensured hasDerailerSpokenFirst=true for auto-approved impromptu phase`);

            // Add the derail response message as a reply to the transition message
            derailResponse.recipient = "All";
            derailResponse.needsApproval = false;
            derailResponse.isApproved = true;
            derailResponse.replyToMessage = transitionMessage.message; // Set the reply reference
            this.updateConversation(derailResponse);
            console.log(`Added approved derail message from ${derailResponse.sender} after transition message`);
          } else {
            // For human-control mode, add transition message first
            this.conversation.push(transitionMessage);
            if (this.onMessageGenerated) {
              this.onMessageGenerated(transitionMessage);
            }
            console.log(`Added transition message from ${transitionSpeaker} before pending derail approval`);
            
            // Then add message with needsApproval flag
            derailResponse.recipient = "All";
            derailResponse.needsApproval = true;
            derailResponse.isApproved = false;
            derailResponse.replyToMessage = transitionMessage.message; // Set the reply reference
            this.updateConversation(derailResponse);
            console.log(`Added derail message from ${derailResponse.sender} waiting for approval`);
            
            // Store pending impromptu phase info
            this.storePendingImpromptuPhase(
              derailResponse.derailerAgent,
              derailResponse.derailMode,
              derailResponse.turnCount || 3,
              derailResponse
            );
            
            // Set waiting flags and pause conversation until approval
            this.isWaitingForApproval = true;
            this.conversationPaused = true;
            console.log('Setting waiting flags and pausing conversation for impromptu phase approval (human-control mode)');
          }
        }
      }
      
      // If no derailer intervention was detected, add the transition message
      if (!derailInterventionDetected) {
        this.conversation.push(transitionMessage);
        if (this.onMessageGenerated) {
          this.onMessageGenerated(transitionMessage);
        }
        console.log(`Added transition message from ${transitionSpeaker} to ${nextSpeaker}`);
        
        // Log the speaker sequence for debugging
        console.log(`Transition sequence: lastSpeaker=${lastSpeaker} -> transitionSpeaker=${transitionSpeaker} -> nextSpeaker=${nextSpeaker}`);
      }
    }
    
    console.log(`Impromptu phase ended. Restored settings: partyMode=${this.partyMode}, partyTurnMode=${this.partyTurnMode}, handRaisingEnabled=${this.handRaisingEnabled}, derailingEnabled=${this.derailingEnabled}`);
  }

  // Add a setter for autoApproveImpromptu that handles pending approvals
  set autoApproveImpromptu(value) {
    // Store the new value
    this._autoApproveImpromptu = value;
    
    // If turning on auto-approve and there's a pending impromptu phase, approve it immediately
    if (value === true && this.pendingImpromptuPhase) {
      console.log('DEBUG - autoApproveImpromptu setter - Auto-approving pending impromptu phase');
      // Use setTimeout to ensure this happens after the current execution context
      setTimeout(() => {
        this.handleImpromptuPhaseApproval(true);
      }, 0);
    }
  }

  // Add a getter for autoApproveImpromptu
  get autoApproveImpromptu() {
    return this._autoApproveImpromptu;
  }

}

export default ConversationManager;


