import * as llmProvider from "./providers/llmProvider.js";

/**
 * Generate backchannel text for an agent
 * @param {string} message - The message to respond to
 * @param {string} vibe - The emotional vibe of the backchannel
 * @param {Object} agent - The agent object generating the backchannel
 * @returns {Promise<string>} - Generated backchannel text
 */
export async function generateBackchannel(message, vibe, agent) {
  // Rich set of vibe examples for non-verbal reactions
  const vibeExamples = {
    Amused: "smirking, chuckling quietly, eyes twinkling with mirth",
    Skeptical: "tilting head in doubt",
    Excited: "leaning forward, nodding encouragingly",
    Supportive: "leaning forward, nodding encouragingly",
    Curious: "grinning broadly, eyes lighting up, gesturing animatedly",
    Concerned: "furrowing brow, lips pressing together, slight head shake",
    Empathetic: "nodding understanding, softening expression, leaning in slightly",
    Bored: "suppressing a yawn, eyes glazing over, fidgeting slightly",
    Surprised: "eyebrows shooting up, mouth forming an 'O', blinking rapidly",
    Confused: "squinting, tilting head, mouth slightly open in puzzlement",
    Impressed: "nodding approvingly, eyes widening, slight smile forming",
    agreeable: "nodding thoughtfully, making affirming gestures",
    excited: "widening eyes, leaning forward eagerly",
    skeptical: "raising an eyebrow, crossing arms slightly",
    supportive: "nodding encouragingly, offering a warm smile",
    neutral: "maintaining attentive posture, slight nod",
    nodding: "tilting head slightly, giving a small nod"
  };
  
  // Get the appropriate vibe examples (normalize to lowercase for matching)
  const normalizedVibe = vibe.toLowerCase();
  const exampleText = vibeExamples[vibe] || vibeExamples[normalizedVibe] || "nodding attentively";
  
  // If agent is not provided or has isHumanProxy, use a generic backchannel
  if (!agent || agent.isHumanProxy) {
    const examples = exampleText.split(", ");
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    return `${agent ? agent.name : "They"} is ${randomExample}`;
  }
  
  // Generate custom non-verbal backchannel based on vibe
  const prompt = `You are ${agent.name}, a ${agent.personality || ""} person responding to this message with a ${vibe} non-verbal reaction.

  Message: "${message}"

  Generate a brief, non-verbal backchannel response in the format: "${agent.name} is [action]", where [action] is a short phrase describing your physical reaction.
  
  Examples of ${vibe} reactions might include: ${exampleText}
  
  Make your reaction between 3-8 words, believable, and appropriate for your personality. Don't use dialog or quotes.`;
  
  try {
    const messages = [{ role: "user", content: prompt }];
    let backchannelText = await llmProvider.chatCompletion(messages, {
      maxTokens: 20,
      temperature: 0.7
    });
    
    // Ensure proper format
    backchannelText = backchannelText.trim();
    
    // If response doesn't start with the agent's name, fix the format
    if (!backchannelText.startsWith(agent.name)) {
      backchannelText = `${agent.name} is ${backchannelText.replace(/^[^a-z]+is /i, '')}`;
    }
    
    // Limit length
    const words = backchannelText.split(/\s+/);
    if (words.length > 10) {
      backchannelText = words.slice(0, 10).join(" ") + "...";
    }
    
    return backchannelText;
  } catch (error) {
    console.error("Error generating backchannel:", error);
    // Fallback to default
    return `${agent.name} is ${exampleText.split(", ")[0]}`;
  }
}

/**
 * Get the next speaker in a round-robin conversation
 * @param {Array<string>} participants - List of participant names
 * @param {string} lastSpeaker - Name of the last speaker
 * @param {number} lastSpeakerIndex - Current index in round-robin sequence
 * @returns {Object} - Next speaker and updated index
 */
export function getNextRoundRobinSpeaker(participants, lastSpeaker, lastSpeakerIndex = -1) {
  // Check if participants is undefined or empty
  if (!participants || participants.length === 0) {
    console.error("getNextRoundRobinSpeaker: participants array is undefined or empty");
    // Return the last speaker as fallback, or "All" if no lastSpeaker
    return {
      nextSpeaker: lastSpeaker || "All",
      updatedIndex: lastSpeakerIndex
    };
  }
  
  // If lastSpeaker is undefined or not in the participants, pick the first participant
  if (!lastSpeaker || participants.indexOf(lastSpeaker) === -1) {
    console.warn(`getNextRoundRobinSpeaker: lastSpeaker "${lastSpeaker}" is undefined or not found in participants`);
    
    // If we have a stored lastSpeakerIndex, use it to determine next speaker
    let nextIndex;
    if (lastSpeakerIndex >= 0 && lastSpeakerIndex < participants.length - 1) {
      nextIndex = lastSpeakerIndex + 1; // Move to next speaker
    } else {
      nextIndex = 0; // Start from beginning
    }
    
    console.log(`Selecting participant at index ${nextIndex}: ${participants[nextIndex]}`);
    return {
      nextSpeaker: participants[nextIndex],
      updatedIndex: nextIndex
    };
  }

  // Standard round-robin behavior for valid lastSpeaker
  const lastIndex = participants.indexOf(lastSpeaker);
  let nextIndex = (lastIndex + 1) % participants.length;

  // Handle the case where the last speaker is "All"
  if (lastSpeaker === "All") {
    nextIndex = 0; // Start with the first participant
  } else {
    // Skip the current speaker to avoid selecting the same agent again
    let attempt = 0;
    while (participants[nextIndex] === lastSpeaker && attempt < participants.length) {
      nextIndex = (nextIndex + 1) % participants.length;
      attempt++; // Prevent infinite loop
    }
  }

  console.log(`Next round-robin speaker: ${participants[nextIndex]}`);

  return {
    nextSpeaker: participants[nextIndex],
    updatedIndex: nextIndex
  };
}

/**
 * Parse user instructions for polishing/editing messages
 * @param {string} instruction - The user instruction text
 * @returns {Array<Object>} - Array of command objects
 */
export function interpretUserInstructions(instruction) {
  // Simple interpretation logic (extend with NLP tools for more complex scenarios)
  const commands = [];
  if (instruction.includes("change recipient to")) {
    const recipient = instruction.split("change recipient to")[1].trim();
    commands.push({ type: "changeRecipient", value: recipient });
  }
  if (instruction.match(/rephrase to "(.+)"/)) {
    const newMessage = instruction.match(/rephrase to "(.+)"/)[1];
    commands.push({ type: "editMessage", value: newMessage });
  }
  return commands;
}

/**
 * Generate standard context for conversation patterns
 * @param {string} lastSpeaker - Name of the last speaker
 * @param {Object} currentAgent - Current agent object
 * @param {Object|string} nextAgent - Next agent or "All"
 * @param {string} interactionPattern - Global interaction pattern
 * @param {string} topic - Conversation topic
 * @param {string} recentMessages - Recent message history summary
 * @param {string} themeAnalysis - Theme analysis if available
 * @param {string} conversationPrompt - Optional custom conversation prompt
 * @returns {string} - Generated context
 */
export function getContextForPattern(lastSpeaker, currentAgent, nextAgent, interactionPattern, topic, recentMessages, themeAnalysis, conversationPrompt = null) {
  // Handle case where currentAgent is undefined
  if (!currentAgent) {
    console.error("getContextForPattern: currentAgent is undefined");
    return "Contribute to the conversation with your own perspective.";
  }

  // Determine appropriate interaction pattern
  const patterns = {
    Critical: "Try to critically analyze and challenge the last statement.",
    Skeptical: "Express skepticism towards the last statement.",
    Neutral: "Contribute to the conversation with your own perspective.",
    Receptive: "Be open to the ideas presented in the last statement.",
    Agreeable: "Agree with the last statement and expand on it.",
    disagree: "Try to respectfully disagree with or challenge the last statement.",
    agree: "Agree with the last statement and expand on it.",
  };

  // Safely determine effective pattern
  const customAttributes = currentAgent.customAttributes || {};
  const effectivePattern = (customAttributes.interactionOverride && currentAgent.interactionPattern) 
    ? currentAgent.interactionPattern 
    : (interactionPattern || "Neutral");
  
  const additionalContext = patterns[effectivePattern] || patterns.Neutral;
  const themeContext = themeAnalysis ? `Key themes: ${themeAnalysis.split('\n').slice(0, 2).join(' ')}` : '';
  const lastSpeakerContext = lastSpeaker ? `The last person who spoke was ${lastSpeaker}.` : '';

  let context = "";
  if (conversationPrompt) {
    console.log(`Using custom conversation prompt for context: ${conversationPrompt.substring(0, 50)}...`);
    context = `Now, you are in a converation where you should follow this context: ${conversationPrompt}.`;
  } else {
    context += `Topic: ${topic || "General discussion"}`;
  }

  context += ` ${themeContext} ${lastSpeakerContext} Recent discussion summary: ${recentMessages} ${additionalContext}`;
  
  // Add recipient guidance
  if (nextAgent === "All" || !nextAgent) {
    context += "\n\nAddress your response to all participants.";
  } else if (lastSpeaker) {
    if (typeof lastSpeaker === 'string' && lastSpeaker !== 'All') {
      context += `\n\nReply to ${lastSpeaker}'s message.`;
    } else if (lastSpeaker.name) {
      context += `\n\nReply to ${lastSpeaker.name}'s message.`;
    }
  }

  return context;
}

/**
 * Generate party-specific context for an agent
 * @param {string} currentAgentParty - Party name of the current agent
 * @param {Object} partyConfig - Party configuration object
 * @param {string} currentAgentName - Name of the current agent
 * @param {string} lastSpeakerParty - Party name of the last speaker
 * @returns {string} - Party-specific context
 */
export function getPartySpecificContext(currentAgentParty, partyConfig, currentAgentName, lastSpeakerParty) {
  if (!currentAgentParty) {
    return "";
  }
  
  const isRepresentative = 
    partyConfig && 
    partyConfig.speakingMode === "representative" && 
    currentAgentName === partyConfig.representative;

  const partyDescription = partyConfig && partyConfig.partyDescription ? partyConfig.partyDescription : '';
  
  // Construct party-aware context
  return `You are part of the "${currentAgentParty}" group. ${partyDescription ? "Party role: " + partyDescription : ""}
  ${isRepresentative ? "You speak as the representative for your group." : ""}
  ${lastSpeakerParty === currentAgentParty ? "Build on your group member's point." : lastSpeakerParty ? `Respond to the "${lastSpeakerParty}" group.` : "Contribute your perspective to the conversation."}`;
}

/**
 * Analyze themes in a conversation 
 * @param {string} historicalContext - Previous conversation history
 * @returns {Promise<string>} - Analysis of themes
 */
export async function analyzeConversationThemes(historicalContext) {
  const prompt = `Given this conversation history, identify the main themes and recurring topics that have been discussed:

    ${historicalContext}

    Please provide:
    1. Key themes (2-3 points)
    2. Any unresolved questions or points of discussion
    3. Suggestions for naturally bringing up relevant previous points`;

  try {
    const messages = [{ role: "user", content: prompt }];
    const result = await llmProvider.chatCompletion(messages, {
      maxTokens: 200,
      temperature: 0.7
    });
    
    return result.trim();
  } catch (error) {
    console.error("Error analyzing conversation themes:", error);
    return "Error analyzing themes";
  }
}

// Add helper function at the top level
function isSystemMessage(message) {
  if (!message) return false;
  const systemIndicators = [
    'System:',
    '[System]',
    '(System)',
    'has raised their hand',
    'hand has been approved',
    'is now the moderator',
    'has joined the conversation',
    'has left the conversation',
    'Turn order is now',
    'The conversation mode is now'
  ];
  
  // Convert to string in case we get an object
  const messageStr = typeof message === 'object' ? 
    (message.name || message.toString()) : 
    message.toString();
  
  return systemIndicators.some(indicator => 
    messageStr.toLowerCase().includes(indicator.toLowerCase())
  );
} 