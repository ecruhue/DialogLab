// partyHelpers.js

/**
 * Groups avatars by their assigned parties based on box configurations
 * @param {Array} avatars - List of all avatars in the scene
 * @param {Object} partyConfigs - Party configurations from localStorage
 * @param {Object} currentScene - Current scene data
 * @returns {Object} Grouped avatars by party
 */
export const groupAvatarsByParty = (avatars, partyConfigs, currentScene) => {
    // Initialize result object
    const result = {
      parties: {},
      unassignedAvatars: []
    };
    
    if (!currentScene || !currentScene.boxes || !partyConfigs) {
      result.unassignedAvatars = avatars;
      return result;
    }
    
    // First, create a map of avatar ID to its group (box) ID
    const avatarToGroupMap = {};
    
    currentScene.boxes.forEach(box => {
      if (box.elements) {
        box.elements.forEach(element => {
          if (element.elementType === 'avatar' && element.id) {
            avatarToGroupMap[element.id] = box.id;
          }
        });
      }
    });
    
    // Group avatars by their party (via their group)
    avatars.forEach(avatar => {
      const groupId = avatarToGroupMap[avatar.id];
      
      if (groupId && partyConfigs[groupId] && partyConfigs[groupId].name) {
        const partyName = partyConfigs[groupId].name;
        
        if (!result.parties[partyName]) {
          const partyConfig = {
            name: partyName,
            description: partyConfigs[groupId].description || '',
            avatars: [],
            representativeSpeaker: partyConfigs[groupId].hasRepresentative ? 
              partyConfigs[groupId].representativeSpeaker : null,
            speakingMode: partyConfigs[groupId].speakingMode || 'turn-based',
            enableBackchannel: partyConfigs[groupId].enableBackchannel || false
          };
          
          // Only add subsetSize if speaking mode is 'subset'
          if (partyConfigs[groupId].speakingMode === 'subset' && partyConfigs[groupId].subsetSize !== null) {
            partyConfig.subsetSize = partyConfigs[groupId].subsetSize || Math.max(1, Math.ceil(partyConfigs[groupId].participantIds?.length / 2) || 2);
          }
          
          result.parties[partyName] = partyConfig;
        }
        
        result.parties[partyName].avatars.push(avatar);
      } else {
        result.unassignedAvatars.push(avatar);
      }
    });
    
    return result;
  };
  
  /**
   * Prepare party-related configurations for the conversation manager
   * @param {Object} currentScene - Current scene data 
   * @param {Object} partyConfigs - Party configurations
   * @returns {Object} Party mode configurations
   */
  export const preparePartyModeConfig = (currentScene, partyConfigs) => {
    if (!currentScene || !currentScene.boxes || !partyConfigs) {
      return { partyMode: false };
    }
    
    // Check if any party configurations exist
    const hasPartyConfigs = currentScene.boxes.some(box => 
      partyConfigs[box.id] && partyConfigs[box.id].name
    );
    
    if (!hasPartyConfigs) {
      return { partyMode: false };
    }
    
    // Collect all valid party configurations
    const partySettings = {};
    
    currentScene.boxes.forEach(box => {
      const boxConfig = partyConfigs[box.id];
      
      if (boxConfig && boxConfig.name) {
        // Get avatar names from this box
        const avatarNames = [];
        
        // Extract avatars from elements
        if (box.elements) {
          box.elements.forEach(element => {
            if (element.elementType === 'avatar' && element.avatarData) {
              avatarNames.push(element.avatarData.name || `Avatar${element.id}`);
            }
          });
        }
        
        if (avatarNames.length > 0) {
          const partyConfig = {
            name: boxConfig.name,
            description: boxConfig.description || '',
            members: avatarNames,
            speakingMode: boxConfig.speakingMode || 'random', // Use 'random' as default
            representativeName: boxConfig.hasRepresentative && boxConfig.representativeSpeaker ? 
              (box.elements.find(e => e.id === boxConfig.representativeSpeaker)?.avatarData?.name || null) : 
              null,
            enableBackchannel: boxConfig.enableBackchannel || false
          };
          
          // Only add subsetSize if speaking mode is 'subset'
          if (boxConfig.speakingMode === 'subset' && boxConfig.subsetSize !== null) {
            partyConfig.subsetSize = boxConfig.subsetSize || Math.max(1, Math.ceil(avatarNames.length / 2));
          }
          
          partySettings[boxConfig.name] = partyConfig;
        }
      }
    });
    
    // If no valid parties were created, disable party mode
    if (Object.keys(partySettings).length === 0) {
      return { partyMode: false };
    }
    
    return {
      partyMode: true,
      partyTurnMode: 'free', // Default to free turn-taking between parties
      partySettings,
      speakingMode: 'random' // Default to random mode
    };
  };
  
  /**
   * Maps conversation messages to their parties to display in UI
   * @param {Array} messages - Conversation messages
   * @param {Object} currentScene - Current scene data
   * @param {Object} partyConfigs - Party configurations
   * @returns {Array} Messages with party information
   */
  export const mapMessagesToParties = (messages, currentScene, partyConfigs) => {
    if (!messages || !currentScene || !partyConfigs) {
      return messages;
    }
    
    // Create a map of avatar names to their party
    const avatarToPartyMap = {};
    
    // Map each avatar to its party
    currentScene.boxes.forEach(box => {
      const boxParty = partyConfigs[box.id]?.name;
      if (!boxParty) return;
      
      if (box.elements) {
        box.elements.forEach(element => {
          if (element.elementType === 'avatar' && element.avatarData) {
            const avatarName = element.avatarData.name || `Avatar${element.id}`;
            avatarToPartyMap[avatarName] = boxParty;
          }
        });
      }
    });
    
    // Enhance each message with party information
    return messages.map(message => {
      const party = avatarToPartyMap[message.sender];
      return party ? { ...message, party } : message;
    });
  };

  /**
   * Deletes party configurations related to a specific scene
   * @param {Object} scene - The scene being deleted
   * @returns {boolean} - True if configurations were deleted, false otherwise
   */
  export const deletePartyConfigsForScene = (scene) => {
    if (!scene || !scene.boxes || scene.boxes.length === 0) {
      return false;
    }

    try {
      // Get current party configurations
      const savedPartyConfigs = JSON.parse(localStorage.getItem('partyConfigs') || '{}');
      let configsDeleted = false;
      
      // Collect all box IDs in the scene
      const boxIds = scene.boxes.map(box => box.id);
      
      // Remove configurations for these boxes
      boxIds.forEach(boxId => {
        if (savedPartyConfigs[boxId]) {
          delete savedPartyConfigs[boxId];
          configsDeleted = true;
        }
      });
      
      // Save updated configurations back to localStorage if changes were made
      if (configsDeleted) {
        localStorage.setItem('partyConfigs', JSON.stringify(savedPartyConfigs));
        console.log(`Deleted party configurations for ${boxIds.length} boxes from scene: ${scene.name || scene.id}`);
        
        // Trigger storage event for other components to detect the change
        window.dispatchEvent(new Event('storage'));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting party configurations for scene:', error);
      return false;
    }
  };

  /**
   * Cleans up party configurations from localStorage on page refresh or scene change
   * This helps prevent accumulation of stale party configs
   * Note: This function is now disabled by default to prevent losing settings
   * @param {boolean} cleanAll - Whether to clean all configs or just those not in active scenes
   * @param {Array} activeScenes - List of active scenes to preserve configurations for (optional)
   * @param {boolean} force - Set to true to force cleanup despite the disabled flag
   * @returns {boolean} - True if configurations were cleaned, false otherwise
   */
  export const cleanupPartyConfigs = (cleanAll = false, activeScenes = [], force = false) => {
    // Disabled flag to prevent automatic cleanups
    const CLEANUP_DISABLED = true;
    
    if (CLEANUP_DISABLED && !force) {
      console.log('Party config cleanup is disabled to prevent losing settings. Use force=true to override.');
      return false;
    }
    
    try {
      // Get current party configurations
      const savedPartyConfigs = JSON.parse(localStorage.getItem('partyConfigs') || '{}');
      
      // If no configs or we don't want to clean, return early
      if (Object.keys(savedPartyConfigs).length === 0) {
        return false;
      }
      
      if (cleanAll) {
        // Remove all party configs
        localStorage.removeItem('partyConfigs');
        console.log('Cleaned up all party configurations from localStorage');
        
        // Trigger storage event for other components to detect the change
        window.dispatchEvent(new Event('storage'));
        return true;
      } else if (activeScenes.length > 0) {
        // Get all box IDs from active scenes to preserve their configs
        const activeBoxIds = activeScenes.flatMap(scene => 
          scene.boxes ? scene.boxes.map(box => box.id) : []
        );
        
        let configsDeleted = false;
        
        // Remove configs for boxes that don't exist in active scenes
        Object.keys(savedPartyConfigs).forEach(boxId => {
          if (!activeBoxIds.includes(boxId)) {
            delete savedPartyConfigs[boxId];
            configsDeleted = true;
          }
        });
        
        // Save updated configurations back to localStorage if changes were made
        if (configsDeleted) {
          localStorage.setItem('partyConfigs', JSON.stringify(savedPartyConfigs));
          console.log(`Cleaned up stale party configurations for non-active boxes`);
          
          // Trigger storage event for other components to detect the change
          window.dispatchEvent(new Event('storage'));
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error cleaning up party configurations:', error);
      return false;
    }
  };