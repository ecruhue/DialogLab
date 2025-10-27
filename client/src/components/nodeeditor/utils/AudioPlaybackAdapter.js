// AudioPlaybackAdapter.js
import useEditorStore from '../../../components/inspector/store';
import API_CONFIG from '../../../config';

/**
 * Adapts the node configuration to the format required by the server-side audio playback
 * for scene-based audio and animation
 */
export class AudioPlaybackAdapter {
  /**
   * Convert node configuration to server-side audio playback configuration
   * @param {Object} config - Node conversation configuration
   * @returns {Object} Server-ready audio playback configuration
   */
  static adaptPlaybackConfiguration(config) {
    // Make a copy of the config to avoid modifying the original
    const serverConfig = { ...config };
    
    console.log('Initial audio playback config received:', {
      scene: serverConfig.scene ? (serverConfig.scene.id || 'No scene ID') : 'No scene',
      playAudio: serverConfig.playAudio,
      playAnimation: serverConfig.playAnimation,
      speakers: serverConfig.agents?.map(a => a.name) || []
    });
    
    // Ensure required flags are set
    serverConfig.playAudio = serverConfig.playAudio !== false;
    serverConfig.playAnimation = serverConfig.playAnimation !== false;
    
    // Validate scene object
    if (!serverConfig.scene) {
      console.warn('No scene attached, audio playback cannot proceed');
      return serverConfig;
    }
    
    // Ensure scene has an ID
    if (!serverConfig.scene.id) {
      console.warn('Scene object is missing ID property:', serverConfig.scene);
      // Check if scene is just a string (name) or other primitive
      if (typeof serverConfig.scene === 'string' || typeof serverConfig.scene !== 'object') {
        console.error('Scene must be a complete object with an ID, not just a name.');
      }
    }

    // Ensure participants array exists (critical for the server to work correctly)
    if (!serverConfig.participants || !Array.isArray(serverConfig.participants) || serverConfig.participants.length === 0) {
      console.warn('No participants specified, adding from agents');
      serverConfig.participants = serverConfig.agents?.map(agent => agent.name) || [];
      
      // If we still have no participants, we can't proceed
      if (serverConfig.participants.length === 0) {
        console.error('No valid participants could be added, conversation may fail');
      }
    }

    // Add TalkingHead flags to enable audio and animation events in the API response
    serverConfig.talkingHeadOptions = {
      enableAudio: true,
      enableAnimations: true,
      voiceOptions: {
        useElevenLabs: true, // Use ElevenLabs TTS if available
        useBrowserTTS: false  // Fallback to browser TTS if needed
      },
      animationOptions: {
        syncWithAudio: true,
        expressiveness: "medium"
      }
    };
    
    // Handle party mode if enabled
    if (serverConfig.partyMode && serverConfig.partyCommands?.length > 0) {
      console.log('Party mode enabled for audio playback with commands:', 
                 serverConfig.partyCommands.map(cmd => cmd.command));
    }
    
    // Handle derailer commands if present
    if (serverConfig.derailerCommands?.length > 0) {
      console.log('Derailer mode enabled with commands:',
                 serverConfig.derailerCommands.map(cmd => `${cmd.command} for ${cmd.agentName}`));
      
      // If no partyCommands array exists, create one
      if (!serverConfig.partyCommands) {
        serverConfig.partyCommands = [];
      }
      
      // Add derailer commands to party commands for backward compatibility
      serverConfig.partyCommands.push(...serverConfig.derailerCommands);
    }
    
    console.log('Final audio playback config:', {
      participants: serverConfig.participants,
      initiator: serverConfig.initiator
    });
    
    return serverConfig;
  }
  
  /**
   * Debug utility to log the structure of a scene object
   * @param {Object} scene - Scene object to debug
   * @param {string} source - Source identifier for the log
   */
  static debugSceneObject(scene, source = 'unknown') {
    if (!scene) {
      console.error(`[${source}] Scene object is null or undefined`);
      return;
    }
    
    console.log(`[${source}] Scene debug:`, {
      type: typeof scene,
      isObject: typeof scene === 'object',
      hasId: !!scene.id,
      id: scene.id || 'missing',
      name: scene.name || 'unnamed',
      hasBoxes: Array.isArray(scene.boxes),
      boxCount: Array.isArray(scene.boxes) ? scene.boxes.length : 0,
      keys: Object.keys(scene || {})
    });
    
    // If scene is just a string or primitive, log that
    if (typeof scene !== 'object') {
      console.error(`[${source}] Scene is not an object, it's a ${typeof scene}:`, scene);
    }
    // If scene is missing ID, log more details
    else if (!scene.id) {
      console.error(`[${source}] Scene is missing ID property:`, scene);
    }
  }
  
  /**
   * Activates a scene in the editor for playback
   * @param {Object} scene - The scene object to activate
   * @param {Object} options - Options for scene activation
   * @param {boolean} options.skipAvatarInit - Whether to skip avatar initialization
   * @returns {Promise<boolean>} - Whether the activation was successful
   */
  static activateSceneInEditor(scene, options = {}) {
    if (!scene || !scene.id) {
      console.error('Invalid scene provided to activateSceneInEditor');
      return Promise.resolve(false);
    }
    
    console.log(`Activating scene for editor: ${scene.name || scene.id}`);
    
    return new Promise(async (resolve) => {
      try {
        // Ensure the scene is in the store
        const { scenes, savedScenes, loadSavedScene, setActiveSceneId, setScenes, activeSceneId } = useEditorStore.getState();
        
        // Check if this scene is already the active scene
        if (activeSceneId === scene.id) {
          console.log(`Scene ${scene.name || scene.id} is already the active scene, no need to reload`);
          return resolve(true);
        }
        
        // Close current scene if there is one active - use a more direct approach
        if (activeSceneId) {
          console.log(`Closing current active scene (${activeSceneId}) before activating new scene`);
          
          // First set active scene to null to force a clean state
          setActiveSceneId(null);
          
          // Clear out any existing scene content
          window.dispatchEvent(new CustomEvent('clear-scene-content', {
            detail: {
              source: 'audio-playback-adapter'
            }
          }));
          
          // Force reset of TalkingHead components
          window.dispatchEvent(new CustomEvent('reset-talking-head', {
            detail: {
              force: true,
              source: 'audio-playback-adapter'
            }
          }));
          
          // Reset avatar editing mode
          window.dispatchEvent(new CustomEvent('set-edit-avatar', {
            detail: {
              value: false
            }
          }));
          
          // Short delay to allow scene clearing to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Check if the scene is already in the store
        let targetScene = scenes.find(s => s.id === scene.id);
        
        // If not in the store, try to load it
        if (!targetScene) {
          try {
            // Load from saved scenes
            const savedScene = savedScenes.find(s => s.id === scene.id);
            if (savedScene) {
              console.log(`Found scene in saved scenes: ${savedScene.name} (${savedScene.id})`);
              try {
                // Load the scene into the store
                const loadedScene = await loadSavedScene(savedScene.id);
                if (loadedScene) {
                  console.log(`Successfully loaded scene: ${loadedScene.name}`);
                  
                  // Add the scene to the scenes array (if not already there)
                  const existingScene = scenes.find(s => s.id === loadedScene.id);
                  if (!existingScene) {
                    setScenes([...scenes, loadedScene]);
                  }
                  
                  // Update target reference
                  targetScene = loadedScene;
                }
              } catch (loadError) {
                console.error('Error loading saved scene:', loadError);
              }
            } else {
              console.warn(`Scene not found in saved scenes: ${scene.id}`);
            }
          } catch (findError) {
            console.error('Error finding scene in saved scenes:', findError);
          }
        }
        
        // Set active scene id in the store
        if (targetScene || scene) {
          // Update with the found scene or fallback to the provided scene
          const sceneToActivate = targetScene || scene;
          setActiveSceneId(sceneToActivate.id);
          
          // Broadcast an event for scene update
          window.dispatchEvent(new CustomEvent('editor-scenes-updated', {
            detail: {
              scenes: scenes,
              activeSceneId: sceneToActivate.id,
              source: 'audio-playback-adapter',
              initiator: true,
              forceRefresh: true
            }
          }));
          
          // Also set the scene setup modal visibility
          window.dispatchEvent(new CustomEvent('toggle-scene-setup-modal', {
            detail: {
              show: false
            }
          }));
          
          // Get direct access to setEditAvatar from TalkingHeadComponent
          // This ensures editAvatar is set to true before scene activation
          try {
            // Create and dispatch an event to set editAvatar to true in TalkingHeadComponent
            window.dispatchEvent(new CustomEvent('set-edit-avatar', {
              detail: {
                value: true
              }
            }));
            console.log('Dispatched set-edit-avatar event before scene activation');
          } catch (error) {
            console.error('Error setting editAvatar:', error);
          }
          
          // Dispatch a custom event to notify the UI to show the scene
          const uniqueEventId = `scene-activation-${Date.now()}`;
          window.dispatchEvent(new CustomEvent('show-scene-in-editor', { 
            detail: { 
              sceneId: sceneToActivate.id,
              sceneName: sceneToActivate.name,
              source: 'audio-playback-adapter',
              context: 'playback', // Use 'playback' as the context for avatar initialization
              mode: 'playback',    // Always use 'playback' mode for audio playback
              eventId: uniqueEventId, // Add a unique event ID to track and prevent duplicate processing
              timestamp: Date.now(),
              initializeAvatars: true, // Signal that avatars should be initialized
              maintainMode: true,  // ALWAYS maintain current UI mode for audio playback
              setEditAvatar: true,  // Add explicit flag to set editAvatar to true
              forceRefresh: true   // Force a complete refresh of the scene
            }
          }));
          
          // No need to initialize avatars here - TalkingHeadComponent will handle it
          // This prevents double initialization
          
          // Give a longer delay for the UI to update before resolving
          setTimeout(() => {
            resolve(true);
          }, 800);
          
        } else {
          // Fallback - we couldn't find the scene in the store or load it
          console.warn(`Could not find or load scene: ${scene.id}, using fallback approach`);
          
          // Set active scene id directly
          setActiveSceneId(scene.id);
          
        }
      } catch (error) {
        console.error('Error activating scene in editor:', error);
        resolve(false);
      }
    });
  }
  
  /**
   * Submit the audio playback configuration to the server
   * @param {Object} config - Audio playback configuration
   * @param {Object} options - Additional options for playback
   * @returns {Promise} - Promise that resolves with the fetch response
   */
  static async initiateAudioPlayback(config, options = {}) {
    try {
      // Check LLM status before starting
      try {
        const statusResp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LLM_STATUS}`);
        if (statusResp.ok) {
          const status = await statusResp.json();
          if (!status.geminiConfigured) {
            alert('Please set your Gemini API key first.');
            return Promise.reject(new Error('Gemini API key not configured'));
          }
        }
      } catch (e) {
        console.warn('Could not verify LLM status before playback start:', e);
      }

      // Adapt configuration for server-side consumption
      const serverConfig = this.adaptPlaybackConfiguration(config);
      
      // Log with better error checking for scene object
      console.log('Initiating audio playback with config:', {
        sceneId: serverConfig.scene?.id || 'missing-id',
        speakers: serverConfig.agents?.length,
        playAudio: serverConfig.playAudio,
        playAnimation: serverConfig.playAnimation,
        talkingHeadOptions: serverConfig.talkingHeadOptions
      });
      
      // Check for valid scene object with ID
      if (!serverConfig.scene) {
        console.warn('No scene object provided for audio playback');
        // Debug the original config to see what was passed
        this.debugSceneObject(config.scene, 'original-config');
      } else if (!serverConfig.scene.id) {
        console.warn('Scene object has no ID, playback may fail');
        // Debug the problematic scene object
        this.debugSceneObject(serverConfig.scene, 'adapted-config');
      }
      
      // Check if we need to activate the scene in the SceneEditor
      if (serverConfig.scene && serverConfig.scene.id) {
        try {
          const { activeSceneId } = useEditorStore.getState();
          const isSceneAlreadyActive = activeSceneId === serverConfig.scene.id;
          
          if (!isSceneAlreadyActive) {
            console.log(`Scene ${serverConfig.scene.id} is not active, activating it now`);
            await this.activateSceneInEditor(serverConfig.scene, options);
          } else {
            console.log(`Scene ${serverConfig.scene.id} is already active, skipping activation`);
          }
        } catch (activationError) {
          console.error('Error activating scene, continuing with playback:', activationError);
          // Don't rethrow the error - we'll try to continue with playback
        }
      }
      
      // Use the same API endpoint as conversation, but with TalkingHead options
      const provider = localStorage.getItem('LLM_PROVIDER') || 'gemini';
      const key = provider === 'openai' ? localStorage.getItem('OPENAI_API_KEY') : localStorage.getItem('GEMINI_API_KEY');
      return fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.START_CONVERSATION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-llm-provider': provider,
          'x-llm-key': key || ''
        },
        body: JSON.stringify(serverConfig)
      });
    } catch (error) {
      console.error('Error adapting audio playback configuration:', error);
      throw error;
    }
  }
  
  /**
   * Process an audio event received from the server
   * @param {Object} event - Audio event data
   * @returns {Object} - Processed event for client-side handling
   */
  static processAudioEvent(event) {
    if (!event) return null;
    
    // Map the event to TalkingHead expected format if needed
    if (event.audioUrl && event.speaker) {
      return {
        type: 'audioEvent',
        speaker: event.speaker,
        audioUrl: event.audioUrl,
        duration: event.duration || 0,
        text: event.text || '',
        emotion: event.emotion || 'neutral'
      };
    }
    
    return event;
  }
  
  /**
   * Process an animation event received from the server
   * @param {Object} event - Animation event data
   * @returns {Object} - Processed event for client-side handling
   */
  static processAnimationEvent(event) {
    if (!event) return null;
    
    // Map the event to TalkingHead expected format if needed
    if (event.animationType && event.speaker) {
      return {
        type: 'animationEvent',
        speaker: event.speaker,
        animationType: event.animationType,
        intensity: event.intensity || 0.5,
        duration: event.duration || 0,
        emotion: event.emotion || 'neutral'
      };
    }
    
    return event;
  }

  /**
   * Find the avatar element in the scene by name
   * @param {Object} scene - The scene containing avatar elements
   * @param {string} speakerName - The name of the speaker to find
   * @returns {Object|null} - The avatar element or null if not found
   */
  static findAvatarInScene(scene, speakerName) {
    if (!scene || !scene.boxes) return null;

    // Iterate through all boxes and elements to find the avatar with the matching name
    for (const box of scene.boxes) {
      if (!box.elements) continue;
      
      for (const element of box.elements) {
        if (element.elementType === 'avatar' && 
            element.avatarData && 
            element.avatarData.name === speakerName) {
          return element;
        }
      }
    }

    return null;
  }
}

export default AudioPlaybackAdapter;

/**
 * Creates a simplified audio playback configuration from a node
 * @param {Object} node - SnippetNode with conversation settings
 * @returns {Object} - Audio playback configuration
 */
export const createAudioPlaybackConfig = (node) => {
  if (!node || !node.attachedScene) {
    console.error("Node or attached scene is missing");
    return null;
  }
  
  // Extract participants from the scene
  const scene = node.attachedScene;
  const participants = [];
  const participantAvatarData = {};
  
  // Extract avatar names and avatar data from the scene
  if (scene.boxes) {
    scene.boxes.forEach(box => {
      // New structure with elements
      if (box.elements) {
        box.elements.forEach(element => {
          if (element.elementType === 'avatar' && element.avatarData) {
            participants.push(element.avatarData.name);
            // Store avatar data by name for later reference
            participantAvatarData[element.avatarData.name] = {
              ...element.avatarData,
              elementId: element.id
            };
          }
        });
      }
      // Legacy structure with direct avatarData
      else if (box.avatarData) {
        participants.push(box.avatarData.name);
        // Store avatar data by name for later reference
        participantAvatarData[box.avatarData.name] = {
          ...box.avatarData,
          boxId: box.id
        };
      }
    });
  }
  
  // Extract speakers from the node
  let agents = [];
  if (node.speakers) {
    agents = node.speakers.map(speaker => {
      // Try to get avatar data from the scene
      const avatarData = participantAvatarData[speaker.name] || {};
      
      return {
        name: speaker.name,
        personality: speaker.personality || "friendly",
        interactionPattern: node.interactionPattern || "neutral",
        isHumanProxy: false,
        voiceSettings: {
          voice: avatarData.voice || speaker.voice || "en-GB-Standard-A",
          language: "en-GB"
        },
        avatarSettings: {
          model: avatarData.url || speaker.url || "/assets/avatar1.glb",
          elementId: avatarData.elementId || avatarData.boxId
        },
        customAttributes: {
          ...(speaker.customAttributes || {}),
          party: speaker.party || null,
          isPartyRepresentative: speaker.isPartyRepresentative || false
        },
        fillerWordsFrequency: "low",
        roleDescription: speaker.roleDescription || ""
      };
    });
  } else {
    // If no speakers in the node, create agents from scene participants
    agents = participants.map(name => {
      const avatarData = participantAvatarData[name] || {};
      
      return {
        name: name,
        personality: "friendly",
        interactionPattern: "neutral",
        isHumanProxy: false,
        voiceSettings: {
          voice: avatarData.voice || "en-GB-Standard-A",
          language: "en-GB"
        },
        avatarSettings: {
          model: avatarData.url || "/assets/avatar1.glb",
          elementId: avatarData.elementId || avatarData.boxId
        },
        customAttributes: {},
        fillerWordsFrequency: "low"
      };
    });
  }
  
  // Basic playback configuration
  const config = {
    scene: node.attachedScene,
    playAudio: true,
    playAnimation: true,
    maxTurns: node.turns || 3,
    agents: agents,
    // Add participants array to avoid "filter" TypeError in the server
    participants: participants,
    initiator: node.initiator?.name || (node.speakers.length > 0 ? node.speakers[0].name : null),
    topic: node.topic || node.objective || "general conversation",
    subTopic: node.subTopic || "",
    interactionPattern: node.interactionPattern || "neutral",
    turnTakingMode: node.turnTakingMode || "round-robin",
    derailerMode: node.derailerMode !== false, // Add derailer mode (default to true unless explicitly set to false)
    derailerCommands: [], // Initialize empty derailer commands array
    shouldLoadPreviousConversationManager: false,
    conversationMode: useEditorStore.getState().conversationMode,
    conversationPrompt: node.conversationPrompt || null
  };

  // Add party configuration if needed
  if (node.partyMode) {
    // Group speakers by their party
    const speakersByParty = {};
    const unassignedSpeakers = [];
    
    // Assign speakers to parties or unassigned group
    node.speakers.forEach(speaker => {
      if (speaker.party) {
        if (!speakersByParty[speaker.party]) {
          speakersByParty[speaker.party] = [];
        }
        speakersByParty[speaker.party].push(speaker);
      } else {
        unassignedSpeakers.push(speaker);
      }
    });
    
    // Prepare party commands
    const partyCommands = Object.keys(speakersByParty).map(partyName => {
      const partySpeakers = speakersByParty[partyName];
      const representative = partySpeakers.find(s => s.isPartyRepresentative);
      
      return {
        command: 'createParty',
        partyName: partyName,
        members: partySpeakers.map(s => s.name),
        config: {
          speakingMode: representative ? 'representative' :'random',
          representative: representative ? representative.name : null,
          canInterrupt: true,
          speakingProbability: 1.0,
          backchannelProbability: 0.3,
          partyDescription: `${partyName} - ${partySpeakers.map(s => s.roleDescription || s.personality).join(', ')}`
        }
      };
    });
    
    // Add party mode and commands to config
    config.partyMode = Object.keys(speakersByParty).length > 0;
    config.partyCommands = partyCommands;
    
    // Add enablePartyMode command if party mode is enabled and we have parties
    if (config.partyMode) {
      config.partyCommands.push({
        command: 'enablePartyMode',
        turnMode: node.partyTurnMode || 'free'
      });
    }
  }
  
  // Extract content commands for PDFs in the scene
  if (node.attachedScene && node.attachedScene.boxes) {
    const contentCommands = [];
    const contentByBox = {};
    const publicContent = [];

    // Extract PDF content elements from the scene
    node.attachedScene.boxes.forEach(box => {
      if (!box.elements) return;
      
      // Collect all content elements in this box
      const contentElements = box.elements.filter(element => 
        element.elementType === 'content' && 
        element.contentType === 'application/pdf'
      );
      
      if (contentElements.length > 0) {
        // Check if the box has any avatar elements
        const hasAvatars = box.elements.some(element => 
          element.elementType === 'avatar' && element.avatarData
        );
        
        if (hasAvatars) {
          // Content in a box with avatars - owned by the avatars/party
          contentByBox[box.id] = contentElements;
        } else {
          // Content in a box without avatars - public content
          publicContent.push(...contentElements);
        }
      }
    });

    // For each box with content and avatars, create a content command
    Object.entries(contentByBox).forEach(([boxId, contentElements]) => {
      const box = node.attachedScene.boxes.find(b => b.id === boxId);
      if (!box) return;
      
      // Get avatars/party information for this box
      const avatarElements = (box.elements || []).filter(element => 
        element.elementType === 'avatar' && element.avatarData
      );
      
      const partyName = box.party;
      const avatarNames = avatarElements.map(element => element.avatarData?.name).filter(Boolean);
      
      // For each PDF in the box, create a content command
      contentElements.forEach(content => {
        if (!content.contentName) return;
        
        contentCommands.push({
          command: 'initializeContent',
          filename: content.contentName,
          // Always set content as public
          owners: null,
          isParty: false,
          // Still use the party or avatar in the box as presenter
          presenter: partyName || (avatarNames.length > 0 ? avatarNames[0] : null),
          presenterIsParty: !!partyName
        });
      });
    });
    
    // For public content (in boxes without avatars), create public content commands
    publicContent.forEach(content => {
      if (!content.contentName) return;
      
      contentCommands.push({
        command: 'initializeContent',
        filename: content.contentName,
        // No owners for public content
        owners: null,
        isParty: false,
        // No presenter for public content
        presenter: null,
        presenterIsParty: false
      });
    });

    // Add content commands to config if there are any
    if (contentCommands.length > 0) {
      config.contentCommands = contentCommands;
      console.log(`AudioPlayback: Added ${contentCommands.length} content commands for PDFs in the scene`);
    }
  }
  
  // Add derailer commands for human agents if derailerMode is enabled
  if (node.derailerMode !== false) {
    // Check for human agents from speakers or avatarData
    let humanAgents = [];
    
    // Method 1: Check speaker list directly
    if (node.speakers) {
      humanAgents = node.speakers.filter(speaker => speaker.isHuman);
    }
    
    // Method 2: If no human speakers found, check avatarData in the scene
    if (humanAgents.length === 0 && node.attachedScene) {
      // Check localStorage for human participants
      try {
        const topicDataStr = localStorage.getItem('topicData');
        if (topicDataStr) {
          const parsedData = JSON.parse(topicDataStr);
          if (parsedData.humanParticipants && parsedData.humanParticipants.length) {
            // Find agents with names matching human participants
            humanAgents = agents.filter(agent => 
              parsedData.humanParticipants.includes(agent.name)
            );
          }
        }
      } catch (e) {
        console.error("Error checking for human participants in localStorage:", e);
      }
    }
    
    // If we have human agents and need to create partyCommands
    if (humanAgents.length > 0) {
      if (!config.partyCommands) {
        config.partyCommands = []; // Initialize if not already created
      }
      
      // Add setAsDerailer commands for each human agent
      humanAgents.forEach(humanAgent => {
        config.partyCommands.push({
          command: 'setAsDerailer',
          agentName: humanAgent.name,
          config: {
            enable: true,
            mode: "random", // Use random mode by default (will pick between drift/extend)
            threshold: 0.5, // 50% chance to derail when not their turn
            minTurns: 3,    // Minimum 3 turns for impromptu phase
            maxTurns: 6     // Maximum 6 turns for impromptu phase
          }
        });
        
        console.log(`AudioPlayback: Added setAsDerailer command for human agent: ${humanAgent.name}`);
      });
    } else {
      console.log("No human agents found for derailer mode");
    }
  }
  
  // Add interruption rules if defined
  if (node.interruptionRules && node.interruptionRules.length > 0) {
    config.interruptionRules = node.interruptionRules.map(rule => ({
      interrupter: rule.fromSpeaker.name,
      interrupted: rule.toSpeaker.name,
      probability: 0.3,
      vibe: rule.emotion || "neutral"
    }));
  }
  
  // Add backchannel rules if defined
  if (node.backChannelRules && node.backChannelRules.length > 0) {
    config.backChannelRules = node.backChannelRules.map(rule => ({
      fromPeople: rule.fromSpeaker.name,
      toPeople: rule.toSpeaker.name,
      frequency: "medium",
      vibe: rule.emotion || "neutral",
      probability: 0.2
    }));
  }
  
  // Add TalkingHead-specific options
  config.talkingHeadOptions = {
    enableAudio: true,
    enableAnimations: true,
    voiceOptions: {
      useElevenLabs: true,
      useBrowserTTS: false
    },
    animationOptions: {
      syncWithAudio: true,
      expressiveness: "medium"
    },
    avatarMapping: participantAvatarData
  };
  
  console.log('Created audio playback config:', {
    scene: config.scene?.id || 'unknown',
    participants: config.participants,
    partyMode: config.partyMode,
    agents: config.agents.length
  });
  
  return config;
};

/**
 * Dispatches audio and animation events for the scene
 * @param {Object} event - Event data from server
 */
export const dispatchSceneEvent = (event) => {
  if (!event || !event.type) return;
  
  switch(event.type) {
    case 'message':
      // Handle conversation message events that might contain audio/animation data
      if (event.message && event.message.sender) {
        // For messages with attached audio
        if (event.message.audioData) {
          const audioEvent = {
            type: 'audioEvent',
            speaker: event.message.sender,
            audioUrl: event.message.audioData.url,
            duration: event.message.audioData.duration || 0,
            text: event.message.message || '',
            emotion: event.message.emotion || 'neutral'
          };
          window.dispatchEvent(new CustomEvent('audio-event', { detail: audioEvent }));
        }
        
        // For messages with animation instructions
        if (event.message.animationData) {
          const animationEvent = {
            type: 'animationEvent',
            speaker: event.message.sender,
            animationType: event.message.animationData.type || 'talk',
            intensity: event.message.animationData.intensity || 0.5,
            duration: event.message.animationData.duration || 0,
            emotion: event.message.emotion || 'neutral'
          };
          window.dispatchEvent(new CustomEvent('animation-event', { detail: animationEvent }));
        }
        
        // Dispatch the message event itself
        window.dispatchEvent(new CustomEvent('conversation-message', { detail: event.message }));
      }
      break;
      
    case 'audioEvent':
      window.dispatchEvent(new CustomEvent('audio-event', { detail: AudioPlaybackAdapter.processAudioEvent(event) }));
      break;
      
    case 'animationEvent':
      window.dispatchEvent(new CustomEvent('animation-event', { detail: AudioPlaybackAdapter.processAnimationEvent(event) }));
      break;
      
    case 'completion':
      window.dispatchEvent(new CustomEvent('playback-complete'));
      break;
      
    case 'error':
      console.error('Error in scene playback:', event.error);
      window.dispatchEvent(new CustomEvent('playback-error', { detail: { error: event.error } }));
      break;
      
    default:
      console.log('Unknown event type:', event.type);
  }
}; 