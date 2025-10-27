/**
 * Utility for initializing avatars in scenes
 */

export const initializeSceneAvatars = async (sceneId, scenes) => {
  try {
    // Import avatar initialization functions
    const { initializeAvatar, ensureAvatarContainer } = await import('./AvatarHandler.js');
    const avatarInstancesRef = { current: {} };
    
    // Find the scene in the store
    const targetScene = scenes.find(s => s.id === sceneId);
    if (!targetScene?.boxes) {
      return { success: false, reason: 'Scene not found or has no boxes' };
    }

    console.log(`Initializing avatars for scene: ${targetScene.name} (keeping current UI)`);
    
    // Initialize avatars with a short delay to ensure DOM is ready
    return new Promise((resolve) => {
      setTimeout(() => {
        const initPromises = [];
        
        targetScene.boxes.forEach(box => {
          // Initialize for elements (new structure)
          if (box.elements) {
            box.elements.forEach(element => {
              if (element.elementType === 'avatar' && element.avatarData) {
                // Ensure container exists
                const container = ensureAvatarContainer(element.id);
                if (container) {
                  console.log(`Container created for element: ${element.id}`);
                  
                  // Now initialize the avatar
                  const promise = initializeAvatar(element.id, element.avatarData, avatarInstancesRef)
                    .then(success => {
                      console.log(`Avatar initialization ${success ? 'successful' : 'failed'} for: ${element.avatarData.name}`);
                      return success;
                    })
                    .catch(err => {
                      console.error(`Error initializing avatar for element ${element.id}:`, err);
                      return false;
                    });
                  
                  initPromises.push(promise);
                }
              }
            });
          }
          // Legacy structure
          else if (box.avatarData) {
            // Ensure container exists
            const container = ensureAvatarContainer(box.id);
            if (container) {
              console.log(`Container created for box: ${box.id}`);
              
              // Now initialize the avatar
              const promise = initializeAvatar(box.id, box.avatarData, avatarInstancesRef)
                .then(success => {
                  console.log(`Avatar initialization ${success ? 'successful' : 'failed'} for: ${box.avatarData.name}`);
                  return success;
                })
                .catch(err => {
                  console.error(`Error initializing avatar for box ${box.id}:`, err);
                  return false;
                });
              
              initPromises.push(promise);
            }
          }
        });
        
        // Resolve when all avatar initializations are complete
        Promise.all(initPromises)
          .then(results => {
            const successCount = results.filter(Boolean).length;
            console.log(`Avatar initialization complete. Success: ${successCount}/${results.length}`);
            resolve({
              success: successCount > 0,
              total: results.length,
              successCount
            });
          })
          .catch(err => {
            console.error('Error during avatar initialization:', err);
            resolve({ success: false, error: err });
          });
      }, 300);
    });
  } catch (err) {
    console.error('Failed to import avatar initialization modules:', err);
    return { success: false, error: err };
  }
};

/**
 * Comprehensive function that initializes avatars for a scene and validates them
 * @param {Object} scene - The scene object containing avatar elements
 * @param {Object} avatarInstancesRef - Reference to store initialized avatars
 * @returns {Promise<Object>} Result containing success status, count, and validated elements
 */
export const initializeAvatarsForScene = async (scene, avatarInstancesRef) => {
  if (!scene || !scene.id) {
    return { success: false, reason: 'Invalid scene provided', validElements: [] };
  }
  
  if (!avatarInstancesRef) {
    return { success: false, reason: 'Avatar instances reference is not available', validElements: [] };
  }

  try {
    // Import avatar initialization functions
    const { initializeAvatar, ensureAvatarContainer } = await import('./AvatarHandler.js');
    
    console.log(`Initializing avatars for scene: ${scene.name || scene.id}`);
    
    // Initialize avatars
    const initPromises = [];
    let initializedCount = 0;
    
    // Process all boxes in the scene
    if (!scene.boxes || scene.boxes.length === 0) {
      return { success: false, reason: 'Scene has no boxes', validElements: [] };
    }
    
    scene.boxes.forEach(box => {
      // Process elements (modern structure)
      if (box.elements) {
        box.elements.forEach(element => {
          if (element.elementType === 'avatar' && element.avatarData) {
            // Create container for this avatar
            const container = ensureAvatarContainer(element.id);
            
            if (container) {
              const initPromise = initializeAvatar(element.id, element.avatarData, avatarInstancesRef)
                .then(success => {
                  if (success) initializedCount++;
                  return { elementId: element.id, success };
                })
                .catch(err => {
                  console.error(`Error initializing avatar ${element.id}:`, err);
                  return { elementId: element.id, success: false };
                });
              
              initPromises.push(initPromise);
            }
          }
        });
      }
    });
    
    // Wait for all initializations to complete
    const results = await Promise.all(initPromises);
    
    // Validate which avatars are working properly
    const validElements = scene.boxes.flatMap(box => {
      return (box.elements || [])
        .filter(element => {
          // Only check avatar-type elements
          if (element.elementType !== 'avatar') return false;
          
          const instance = avatarInstancesRef.current[element.id];
          const hasValidInstance = instance && typeof instance.speakText === 'function';
          
          return element.avatarData && hasValidInstance;
        })
        .map(element => ({
          ...element,
          groupId: box.id
        }));
    });
    
    console.log(`Found ${validElements.length} valid avatar elements out of ${results.length} initialized`);
    
    return {
      success: validElements.length > 0,
      count: initializedCount,
      validElements,
      total: results.length
    };
  } catch (error) {
    console.error('Error initializing avatars for scene:', error);
    return { success: false, error, validElements: [] };
  }
};

export default initializeSceneAvatars; 