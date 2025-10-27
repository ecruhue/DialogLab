import { deletePartyConfigsForScene } from './partyHelpers';

// Function to extract all avatar names from boxes
export function extractAvatarNames(boxes) {
  const avatarNames = [];
  
  boxes.forEach(box => {
    // Check elements array first (new structure)
    if (box.elements) {
      box.elements.forEach(element => {
        if (element.elementType === 'avatar' && element.avatarData && element.avatarData.name) {
          avatarNames.push(element.avatarData.name);
        }
      });
    }
    
    // Check legacy avatarSlots
    if (box.avatarSlots) {
      box.avatarSlots.forEach(slot => {
        if (slot.avatarData && slot.avatarData.name) {
          avatarNames.push(slot.avatarData.name);
        }
      });
    }
    
    // Check direct avatarData (legacy)
    if (box.avatarData && box.avatarData.name) {
      avatarNames.push(box.avatarData.name);
    }
  });
  
  return [...new Set(avatarNames)]; // Return unique names
}

// Load the list of saved scenes from localStorage
export const loadSavedScenesList = (setSavedScenes, setErrorMessage) => {
  try {
    // Clean up any duplicate scenes first
    cleanupDuplicateScenes();
    
    const sceneKeys = Object.keys(localStorage).filter((key) =>
      key.startsWith("scene:"),
    );
    
    // Use a Map to deduplicate scenes by ID
    const scenesMap = new Map();
    
    for (const key of sceneKeys) {
      try {
        const sceneData = JSON.parse(localStorage.getItem(key));
        
        // Skip if not valid scene data
        if (!sceneData || !sceneData.id || !sceneData.name) continue;
        
        // If we already have this scene ID and it's newer, skip this one
        if (scenesMap.has(sceneData.id) && 
            scenesMap.get(sceneData.id).timestamp > (sceneData.timestamp || 0)) {
          continue;
        }
        
        // Check if this is a file reference
        if (sceneData.isFileReference) {
          // For file references, use the preview data
          scenesMap.set(sceneData.id, {
            id: sceneData.id,
            name: sceneData.name,
            timestamp: sceneData.timestamp || 0,
            preview: sceneData.preview?.backgroundImage 
              ? sceneData.preview.backgroundImage.substring(0, 30) + "..."
              : "No background",
            isFileReference: true,
            fileUrl: sceneData.fileUrl,
            size: sceneData.size,
            // Include preview data for the thumbnail
            previewData: sceneData.preview || {}
          });
        } else {
          // For regular scenes, use the normal data
          scenesMap.set(sceneData.id, {
            id: sceneData.id,
            name: sceneData.name,
            timestamp: sceneData.timestamp || 0,
            preview: sceneData.backgroundImage
              ? sceneData.backgroundImage.substring(0, 30) + "..."
              : "No background",
            isFileReference: false
          });
        }
      } catch (err) {
        console.warn(`Error parsing scene data for key ${key}:`, err);
      }
    }
    
    // Convert map to array and sort by timestamp
    const loadedScenes = Array.from(scenesMap.values())
      .sort((a, b) => b.timestamp - a.timestamp);
      
    setSavedScenes(loadedScenes);
  } catch (error) {
    console.error("Error loading saved scenes:", error);
    setErrorMessage(
      "Failed to load saved scenes. Local storage might be corrupted.",
    );
  }
};

// Function to clean up duplicate scenes where the same scene is stored by both ID and name
export const cleanupDuplicateScenes = () => {
  try {
    console.log("Cleaning up duplicate scenes in localStorage...");
    const sceneKeys = Object.keys(localStorage).filter((key) => 
      key.startsWith("scene:")
    );
    
    // Create a map of scene IDs to their storage keys
    const sceneMap = new Map();
    
    // First pass: collect all scenes by their ID
    for (const key of sceneKeys) {
      try {
        const sceneData = JSON.parse(localStorage.getItem(key));
        
        // Skip if not valid scene data
        if (!sceneData || !sceneData.id) continue;
        
        const sceneId = sceneData.id;
        const keyType = key === `scene:${sceneId}` ? 'id' : 'name';
        
        // If we haven't seen this scene ID yet, initialize its entry
        if (!sceneMap.has(sceneId)) {
          sceneMap.set(sceneId, { id: null, name: null });
        }
        
        // Mark this key type as found
        sceneMap.get(sceneId)[keyType] = key;
      } catch (err) {
        console.warn(`Error parsing scene data for key ${key}:`, err);
      }
    }
    
    // Second pass: remove name-based duplicates
    let removedCount = 0;
    for (const [sceneId, keys] of sceneMap.entries()) {
      // If we have both an ID-based and name-based key for the same scene
      if (keys.id && keys.name) {
        console.log(`Found duplicate scene ${sceneId} stored by both ID and name, removing name-based entry`);
        localStorage.removeItem(keys.name);
        removedCount++;
      }
    }
    
    console.log(`Cleanup complete. Removed ${removedCount} duplicate scenes.`);
  } catch (error) {
    console.error("Error cleaning up duplicate scenes:", error);
  }
};

// Create a new scene
export const createNewScene = (scenes, setScenes, setActiveSceneIndex, setNewSceneCounter, setShowInitialModal) => {
  console.log('Creating new scene');
  
  const newSceneCounter = scenes.length + 1;
  const newSceneName = `New Scene ${newSceneCounter}`;
  
  // Create the scene object with needed properties
  const newScene = {
    id: `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: newSceneName,
    boxes: [],
    backgroundImage: null,
    hasUnsavedChanges: false,
    objects: [], // Initialize empty objects array if needed by Three.js
    initialized: true // Mark as initialized to prevent redundant init
  };
  
  console.log(`Created new scene with ID: ${newScene.id}`);
  
  // Create a new scenes array with the new scene, ensuring we don't mutate the original
  const updatedScenes = [...(scenes || []), newScene];
  
  // Update scenes state - important to trigger React re-render
  console.log(`Setting scenes array with ${updatedScenes.length} scenes`);
  setScenes(updatedScenes);
  
  // Set active index to point to the new scene
  const newIndex = updatedScenes.length - 1;
  console.log(`Setting active scene index to ${newIndex}`);
  setActiveSceneIndex(newIndex);
  
  // Update counter for next scene name
  if (setNewSceneCounter) {
    setNewSceneCounter((prev) => prev + 1);
  }
  
  // Hide the initial modal if it exists
  if (setShowInitialModal) {
    setShowInitialModal(false);
  }
  
  // Sync with store if available - do this immediately to prevent scene loss
  try {
    // Use dynamic import for the store to avoid circular dependencies
    import('../../inspector/store').then((storeModule) => {
      try {
        const useEditorStore = storeModule.default;
        
        if (useEditorStore && typeof useEditorStore.getState === 'function') {
          const store = useEditorStore.getState();
          if (store && typeof store.setScenes === 'function') {
            // Get current store scenes
            const storeScenes = Array.isArray(store.scenes) ? [...store.scenes] : [];
            
            // Only add if the scene isn't already in the store
            const existingIndex = storeScenes.findIndex(s => s.id === newScene.id);
            
            if (existingIndex === -1) {
              // Add the new scene to the store
              console.log(`Adding new scene ${newScene.id} to store`);
              storeScenes.push(newScene);
              store.setScenes(storeScenes);
              
              // Set as active in the store
              if (typeof store.setActiveSceneId === 'function') {
                console.log(`Setting active scene ID in store: ${newScene.id}`);
                store.setActiveSceneId(newScene.id);
              }
            } else {
              console.log(`Scene ${newScene.id} already exists in store, updating`);
              storeScenes[existingIndex] = newScene;
              store.setScenes(storeScenes);
            }
          }
        }
      } catch (importErr) {
        console.warn('Failed to use store module:', importErr);
      }
    }).catch((err) => {
      console.warn('Failed to import store module:', err);
    });
  } catch (storeErr) {
    console.warn('Failed to sync scene to store:', storeErr);
  }
  
  // Return the new scene for immediate use by caller
  return newScene;
};

// Load a saved scene
export const loadSavedScene = async (
  sceneId, 
  scenes, 
  setScenes, 
  setActiveSceneIndex, 
  setShowInitialModal, 
  setErrorMessage,
  initializedScenesRef,
  initializeAvatar,
  avatarInstancesRef,
  fileInputRef
) => {
  try {
    // Try to load the scene directly using the ID as the key
    let sceneStr = localStorage.getItem(`scene:${sceneId}`);
    
    // If not found, search for a scene with this ID in the data
    if (!sceneStr) {
      const allSceneKeys = Object.keys(localStorage).filter(key => key.startsWith("scene:"));
      for (const key of allSceneKeys) {
        const data = JSON.parse(localStorage.getItem(key));
        if (data.id === sceneId) {
          sceneStr = JSON.stringify(data);
          break;
        }
      }
    }
    
    if (!sceneStr) {
      setErrorMessage(`Scene with ID "${sceneId}" not found in local storage.`);
      return;
    }

    const sceneData = JSON.parse(sceneStr);
    console.log("Loading scene data:", sceneData);

    // Check if this is a file reference metadata entry
    if (sceneData.isFileReference && sceneData.fileUrl) {
      console.log("Loading scene from file URL:", sceneData.fileUrl);
      try {
        // Fetch the scene data from the file URL
        const response = await fetch(sceneData.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch scene file: ${response.status} ${response.statusText}`);
        }
        const fileData = await response.json();
        
        // Replace sceneData with the full data from the file
        Object.assign(sceneData, fileData);
      } catch (fileError) {
        console.error("Error loading scene from file URL:", fileError);
        setErrorMessage(
          "Failed to load scene from file reference. The file may no longer be available. Please load the scene from your downloaded file."
        );
        
        // Show file input to allow user to load the scene from their downloaded file
        fileInputRef.current.click();
        return;
      }
    }

    // Load the boxes first with avatar data intact
    const boxesWithAvatarData = sceneData.boxes || [];

    // Create a new scene object with the loaded data
    const loadedScene = {
      id: sceneData.id || `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: sceneData.name,
      boxes: boxesWithAvatarData,
      backgroundImage: sceneData.backgroundImage,
      hasUnsavedChanges: false,
    };

    // Include globalPartySettings if they exist in the loaded scene data
    if (sceneData.globalPartySettings) {
      loadedScene.globalPartySettings = sceneData.globalPartySettings;
      console.log("Loading globalPartySettings from scene:", sceneData.globalPartySettings);
    }

    // First, cleanup any existing avatar instances
    Object.values(avatarInstancesRef.current).forEach((instance) => {
      if (instance && !instance._isStopped) {
        try {
          instance.stop();
        } catch (err) {
          console.error("Error stopping avatar:", err);
        }
      }
    });

    // Reset the avatar instances ref
    avatarInstancesRef.current = {};

    // Create a new updated scenes array immediately
    const newScenes = [...scenes, loadedScene];
    const newIndex = newScenes.length - 1;

    // Set all the state at once to avoid race conditions
    setScenes(newScenes);
    setActiveSceneIndex(newIndex);
    setShowInitialModal(false);

    // Mark this scene as being initialized
    initializedScenesRef.current.add(newIndex);
    
    // Directly update the editor store for immediate effect
    try {
      const store = (await import('../../inspector/store')).default.getState();
      
      // Find if we already have this scene in the store
      const existingSceneIndex = store.scenes.findIndex(s => s.id === loadedScene.id);
      if (existingSceneIndex === -1) {
        // Add the scene to the store if it doesn't exist
        store.setScenes([...store.scenes, loadedScene]);
      } else {
        // Update the existing scene
        const updatedScenes = [...store.scenes];
        updatedScenes[existingSceneIndex] = loadedScene;
        store.setScenes(updatedScenes);
      }
      
      // Update globalPartySettings in the store if they exist in the loaded scene
      if (loadedScene.globalPartySettings) {
        console.log("Setting globalPartySettings in editor store:", loadedScene.globalPartySettings);
        store.setGlobalPartySettings(loadedScene.globalPartySettings);
      }
      
      // Set this scene as active in the store
      store.setActiveSceneId(loadedScene.id);
      
      console.log(`Scene "${loadedScene.name}" loaded and set as active (ID: ${loadedScene.id})`);
    } catch (e) {
      console.error('Error updating store directly:', e);
    }
    
    // Initialize avatars for each box that has avatar data - added back for proper avatar initialization
    setTimeout(() => {
      // Initialize avatars for each box that has avatar data
      console.log("Starting avatar initialization for scene:", loadedScene.name);

      // If we have a new box structure with elements
      boxesWithAvatarData.forEach((box) => {
        if (box.elements) {
          // Initialize each avatar element in the box
          box.elements.forEach((element) => {
            if (element.elementType === "avatar" && element.avatarData) {
              console.log("Initializing avatar for element:", element.id, element.avatarData);
              initializeAvatar(element.id, element.avatarData, avatarInstancesRef)
                .then((success) => {
                  if (!success) {
                    console.error(`Failed to initialize avatar for element ${element.id}`);
                  }
                })
                .catch((err) => {
                  console.error(`Error initializing avatar for element ${element.id}:`, err);
                });
            }
          });
        }
        // Legacy structure with avatarData directly on the box
        else if (box.avatarData) {
          console.log("Initializing avatar for box (legacy format):", box.id, box.avatarData);
          initializeAvatar(box.id, box.avatarData, avatarInstancesRef)
            .then((success) => {
              if (!success) {
                console.error(`Failed to initialize avatar for box ${box.id}`);
              }
            })
            .catch((err) => {
              console.error(`Error initializing avatar for box ${box.id}:`, err);
            });
        }
        // Legacy structure with avatarSlots
        else if (box.avatarSlots) {
          box.avatarSlots.forEach((slot) => {
            if (slot.avatarData) {
              console.log("Initializing avatar for slot (legacy format):", slot.id, slot.avatarData);
              initializeAvatar(slot.id, slot.avatarData, avatarInstancesRef)
                .then((success) => {
                  if (!success) {
                    console.error(`Failed to initialize avatar for slot ${slot.id}`);
                  }
                })
                .catch((err) => {
                  console.error(`Error initializing avatar for slot ${slot.id}:`, err);
                });
            }
          });
        }
      });
    }, 500); // Use a shorter timeout to initialize avatars faster
    
    return loadedScene;
  } catch (error) {
    console.error("Error loading saved scene:", error);
    setErrorMessage(
      `Failed to load scene "${sceneId}". The saved data might be corrupted.`,
    );
    return null;
  }
};

// Delete a saved scene
export const deleteScene = (sceneId, e, savedScenes, setSavedScenes, setErrorMessage, loadSavedScenesList) => {
  e.stopPropagation(); // Prevent opening the scene when clicking delete

  // Find scene name for better confirmation dialog
  let sceneName = "this scene";
  const targetScene = savedScenes.find(scene => scene.id === sceneId);
  if (targetScene && targetScene.name) {
    sceneName = `"${targetScene.name}"`;
  }

  // Confirm deletion with better message
  if (
    window.confirm(
      `Are you sure you want to delete ${sceneName}? This cannot be undone.`,
    )
  ) {
    try {
      console.log(`Starting deletion of scene: ${sceneId}`);
      
      // IMPORTANT: Immediately update the savedScenes state with a new array reference
      // This ensures the UI updates immediately
      const filteredScenes = savedScenes.filter(scene => scene.id !== sceneId);
      console.log(`Filtered scenes count: ${filteredScenes.length} (before: ${savedScenes.length})`);
      setSavedScenes([...filteredScenes]);
      
      // After UI update, handle localStorage cleanup
      // This ensures the user sees a response even if localStorage operations are slow
      setTimeout(async () => {
        try {
          // Find the scene in localStorage
          let sceneKey = `scene:${sceneId}`;
          let found = localStorage.getItem(sceneKey) !== null;
          let sceneData = null;
          
          // If not found directly, search for a scene with this ID
          if (!found) {
            const allSceneKeys = Object.keys(localStorage).filter(key => key.startsWith("scene:"));
            for (const key of allSceneKeys) {
              try {
                const data = JSON.parse(localStorage.getItem(key));
                if (data && data.id === sceneId) {
                  sceneKey = key;
                  sceneData = data;
                  found = true;
                  console.log(`Found scene with key ${key}`);
                  break;
                }
              } catch (err) {
                console.warn(`Error parsing scene data for key ${key}:`, err);
              }
            }
          } else {
            // If found directly, parse the data
            try {
              sceneData = JSON.parse(localStorage.getItem(sceneKey));
              console.log(`Found scene directly with key ${sceneKey}`);
            } catch (err) {
              console.warn(`Error parsing direct scene data:`, err);
            }
          }
          
          if (found) {
            // Remove from localStorage
            localStorage.removeItem(sceneKey);
            console.log(`Removed scene from localStorage: ${sceneKey}`);
            
            // Also delete any associated party configurations
            if (sceneData && sceneData.boxes) {
              try {
                deletePartyConfigsForScene(sceneData);
                console.log(`Party configurations for scene "${sceneId}" cleaned up`);
              } catch (error) {
                console.error("Failed to clean up party configurations:", error);
              }
            }
            
            // Finally do one more refresh of the scenes list to ensure everything is in sync
            loadSavedScenesList(setSavedScenes, setErrorMessage);
            console.log(`Scene "${sceneId}" deleted successfully`);
          } else {
            console.error(`Scene with ID "${sceneId}" not found in localStorage, but was removed from UI.`);
          }
        } catch (cleanupError) {
          console.error("Error during scene cleanup:", cleanupError);
        }
      }, 100);
    } catch (error) {
      console.error("Error deleting scene:", error);
      setErrorMessage(
        `Failed to delete scene "${sceneId}". Please try again.`,
      );
    }
  }
};

// Estimate the size of a string in bytes
export const estimateStringSize = (str) => {
  // A rough estimate: each character is approximately 2 bytes in UTF-16
  return str.length * 2;
};

// Check if the scene data is approaching the localStorage limit
export const checkSceneSize = (jsonData) => {
  const sizeInBytes = estimateStringSize(jsonData);
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  // Warn if approaching 2MB (most browsers have 5-10MB limit)
  if (sizeInMB > 2) {
    console.warn(`Scene data is large: ${sizeInMB.toFixed(2)}MB`);
    return {
      isLarge: true,
      sizeInMB: sizeInMB.toFixed(2)
    };
  }
  
  return {
    isLarge: false,
    sizeInMB: sizeInMB.toFixed(2)
  };
};

// Save current scene
export const handleSave = (
  activeSceneIndex,
  scenes,
  setScenes,
  setErrorMessage,
  setShowSaveDialog,
  saveSceneName,
  updateCurrentRotationValues,
  loadSavedScenesList,
  customName = null
) => {
  if (activeSceneIndex === null) return;

  try {
    const name = customName || saveSceneName.trim();

    if (!name) {
      setErrorMessage("Please enter a scene name");
      return;
    }

    // Capture the current rotation values before saving
    updateCurrentRotationValues();

    // Ensure the scene has an ID
    if (!scenes[activeSceneIndex].id) {
      const updatedScenes = [...scenes];
      updatedScenes[activeSceneIndex].id = `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      setScenes(updatedScenes);
    }

    // Get current human participants from localStorage
    let humanParticipants = [];
    try {
      const savedData = localStorage.getItem('aiPanelData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
          humanParticipants = parsedData.humanParticipants;
          console.log("Found human participants when saving scene:", humanParticipants);
        }
      }
    } catch (error) {
      console.error('Error loading human participants:', error);
    }

    // Create a deep copy of the scene to modify
    const sceneToSave = JSON.parse(JSON.stringify(scenes[activeSceneIndex]));
    
    // Update all avatar elements with current isHuman status
    sceneToSave.boxes = sceneToSave.boxes.map(box => {
      // Update all avatar elements in the elements array
      if (box.elements) {
        box.elements = box.elements.map(element => {
          if (element.elementType === 'avatar' && element.avatarData) {
            return {
              ...element,
              avatarData: {
                ...element.avatarData,
                isHuman: humanParticipants.includes(element.avatarData.name)
              }
            };
          }
          return element;
        });
      }
      
      // Handle legacy format with avatarSlots
      if (box.avatarSlots) {
        box.avatarSlots = box.avatarSlots.map(slot => {
          if (slot.avatarData) {
            return {
              ...slot,
              avatarData: {
                ...slot.avatarData,
                isHuman: humanParticipants.includes(slot.avatarData.name)
              }
            };
          }
          return slot;
        });
      }
      
      // Handle legacy format with direct avatarData
      if (box.avatarData) {
        box.avatarData = {
          ...box.avatarData,
          isHuman: humanParticipants.includes(box.avatarData.name)
        };
      }
      
      return box;
    });

    // Prepare the scene data for serialization
    const sceneData = {
      id: sceneToSave.id,
      name,
      timestamp: Date.now(),
      boxes: sceneToSave.boxes,
      backgroundImage: sceneToSave.backgroundImage,
      globalPartySettings: sceneToSave.globalPartySettings || null,
    };

    // Convert to JSON string
    const jsonData = JSON.stringify(sceneData);
    
    // Check if the scene data is large
    const sizeInfo = checkSceneSize(jsonData);
    if (sizeInfo.isLarge) {
      console.warn(`Large scene detected (${sizeInfo.sizeInMB}MB), may exceed localStorage limits`);
    }

    // Create a Blob and URL for the scene data
    const blob = new Blob([jsonData], { type: "application/json" });
    const fileUrl = URL.createObjectURL(blob);
    
    // Create a metadata entry that references the file URL
    const metadataEntry = {
      id: sceneData.id,
      name: name,
      timestamp: Date.now(),
      fileUrl: fileUrl,
      size: sizeInfo.sizeInMB,
      isFileReference: true,
      globalPartySettings: sceneData.globalPartySettings,
      // Include a small preview of the scene for the thumbnail
      preview: {
        backgroundImage: sceneData.backgroundImage,
        boxCount: sceneData.boxes.length,
        hasAvatars: sceneData.boxes.some(box => 
          (box.elements && box.elements.some(el => el.elementType === 'avatar' && el.avatarData)) ||
          box.avatarData
        ),
        hasContent: sceneData.boxes.some(box => 
          (box.elements && box.elements.some(el => el.elementType === 'content'))
        ),
        parties: [...new Set(sceneData.boxes.filter(box => box.party).map(box => box.party))],
        // Store actual box positions for better visualization
        boxPositions: sceneData.boxes.map(box => ({
          x: box.x || 0,
          y: box.y || 0,
          width: box.width || 33,
          height: box.height || 33
        })),
        // Extract and store avatar names
        avatarNames: extractAvatarNames(sceneData.boxes),
        // Store per-box content information
        boxContents: sceneData.boxes.map(box => {
          const boxAvatarNames = [];
          let boxHasContent = false;
          let boxHasAvatars = false;
          
          // Check elements array first (new structure)
          if (box.elements) {
            box.elements.forEach(element => {
              if (element.elementType === 'avatar' && element.avatarData && element.avatarData.name) {
                boxAvatarNames.push(element.avatarData.name);
                boxHasAvatars = true;
              }
              if (element.elementType === 'content') {
                boxHasContent = true;
              }
            });
          }
          
          // Check legacy avatarSlots
          if (box.avatarSlots) {
            box.avatarSlots.forEach(slot => {
              if (slot.avatarData && slot.avatarData.name) {
                boxAvatarNames.push(slot.avatarData.name);
                boxHasAvatars = true;
              }
            });
          }
          
          // Check direct avatarData (legacy)
          if (box.avatarData && box.avatarData.name) {
            boxAvatarNames.push(box.avatarData.name);
            boxHasAvatars = true;
          }
          
          // Also check for content element in the box
          if (box.content) {
            boxHasContent = true;
          }
          
          // Check if any property indicates this is a content box
          if (box.contentType || box.contentUrl || (box.elements && box.elements.some(el => el.content))) {
            boxHasContent = true;
          }
          
          return {
            hasAvatars: boxHasAvatars,
            hasContent: boxHasContent,
            avatarNames: boxAvatarNames,
            party: box.party
          };
        })
      }
    };

    // Try to save to localStorage, but handle quota exceeded errors
    let savedToLocalStorage = true;
    try {
      // Use the scene ID as the key instead of the name for consistency
      const storageKey = `scene:${sceneData.id}`;
      
      // For large scenes, only save the metadata with file reference
      if (sizeInfo.isLarge) {
        localStorage.setItem(storageKey, JSON.stringify(metadataEntry));
        console.log(`Large scene (${sizeInfo.sizeInMB}MB) saved as file reference`);
      } else {
        // For smaller scenes, save the full data
        localStorage.setItem(storageKey, jsonData);
      }
    } catch (storageError) {
      console.warn(`localStorage quota exceeded (scene size: ${sizeInfo.sizeInMB}MB), falling back to file download only`, storageError);
      savedToLocalStorage = false;
      
      // Show a more helpful error message
      setErrorMessage(
        `Scene is too large (${sizeInfo.sizeInMB}MB) for browser storage. Please reduce the scene size or clear browser data.`
      );
    }

    // Note: File download functionality removed - scenes are now saved only to localStorage

    // Close the dialog
    setShowSaveDialog(false);
    
    // Only reload the scenes list if we successfully saved to localStorage
    if (savedToLocalStorage) {
      loadSavedScenesList();
    }

    // Update current scene name and reset unsaved changes flag only if successfully saved
    if (savedToLocalStorage) {
      const updatedScenes = [...scenes];
      updatedScenes[activeSceneIndex].name = name;
      updatedScenes[activeSceneIndex].hasUnsavedChanges = false;
      setScenes(updatedScenes);
    }

    console.log(`Scene saved ${savedToLocalStorage ? 'to localStorage' : 'failed - scene too large'}`);
  } catch (error) {
    console.error("Error saving scene:", error);
    setErrorMessage("Failed to save scene. Please try again.");
  }
};

// Load boxes for a scene and initialize avatars
export const loadBoxesForScene = async (
  sceneIndex, 
  boxesData, 
  scenes, 
  setScenes, 
  initializeAvatar
) => {
  try {
    // Safety: verify scene index is valid
    if (sceneIndex < 0 || sceneIndex >= scenes.length) {
      console.error(
        `Invalid scene index: ${sceneIndex}, total scenes: ${scenes.length}`,
      );
      return;
    }

    // Set boxes without avatars initially using the functional setState pattern
    setScenes((prevScenes) => {
      // Double check scene index is still valid
      if (sceneIndex < 0 || sceneIndex >= prevScenes.length) {
        console.error(
          `Invalid scene index: ${sceneIndex}, current scenes: ${prevScenes.length}`,
        );
        return prevScenes;
      }

      const boxesWithoutAvatars = boxesData.map((box) => ({
        ...box,
        avatarData: null, // Temporarily set to null
      }));

      const updatedScenes = [...prevScenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        boxes: boxesWithoutAvatars,
      };

      return updatedScenes;
    });

    // Wait for the components to render
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Now initialize avatars one by one
    for (const box of boxesData) {
      if (box.avatarData) {
        // Update boxes to include avatar data using the functional setState pattern
        setScenes((prevScenes) => {
          // Check that scene and box still exist
          if (sceneIndex < 0 || sceneIndex >= prevScenes.length) {
            console.error("Scene no longer exists");
            return prevScenes;
          }

          const updatedScenes = [...prevScenes];
          updatedScenes[sceneIndex] = {
            ...updatedScenes[sceneIndex],
            boxes: updatedScenes[sceneIndex].boxes.map((b) =>
              b.id === box.id ? { ...b, avatarData: box.avatarData } : b
            ),
          };

          return updatedScenes;
        });

        // Give the DOM time to update
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Initialize avatar
        await initializeAvatar(box.id, box.avatarData);
      }
    }
  } catch (error) {
    console.error("Error loading boxes for scene:", error);
  }
};

// Close a tab/scene
export const closeTab = async (
  index, 
  e, 
  scenes, 
  setScenes, 
  activeSceneIndex, 
  setActiveSceneIndex,
  setShowInitialModal,
  avatarInstancesRef,
  activeSceneId,
  setActiveSceneId,
  syncScenesToStore
) => {
  e.stopPropagation();

  const sceneToClose = scenes[index];
  console.log(`Closing scene "${sceneToClose.name}" (${sceneToClose.id})`);

  // Check if there are unsaved changes
  if (sceneToClose.hasUnsavedChanges) {
    if (
      !window.confirm(
        `Scene "${sceneToClose.name}" has unsaved changes. Close anyway?`,
      )
    ) {
      return;
    }
  }

  // Stop and cleanup any avatar instances for this scene
  if (sceneToClose.boxes) {
    for (const box of sceneToClose.boxes) {
      // Check for elements first (new structure)
      if (box.elements) {
        for (const element of box.elements) {
          if (
            element.elementType === "avatar" &&
            avatarInstancesRef.current[element.id]
          ) {
            try {
              await avatarInstancesRef.current[element.id].stop();
            } catch (e) {
              console.warn(`Failed to stop avatar instance for ${element.id}:`, e);
            }
            delete avatarInstancesRef.current[element.id];
          }
        }
      }
  
      // Also check direct avatarData (legacy)
      if (avatarInstancesRef.current[box.id]) {
        try {
          await avatarInstancesRef.current[box.id].stop();
        } catch (e) {
          console.warn(`Failed to stop avatar instance for ${box.id}:`, e);
        }
        delete avatarInstancesRef.current[box.id];
      }
    }
  }

  // Clean up any party configurations for unsaved scenes
  // Only do this for scenes that haven't been saved to localStorage
  if (sceneToClose.hasUnsavedChanges || !localStorage.getItem(`scene:${sceneToClose.id}`)) {
    // Import the delete function from partyHelpers
    try {
      deletePartyConfigsForScene(sceneToClose);
      console.log(`Party configurations for unsaved scene "${sceneToClose.name}" cleaned up`);
    } catch (error) {
      console.error("Failed to clean up party configurations:", error);
    }
  }

  // Remove the scene from the list
  const updatedScenes = [...scenes];
  updatedScenes.splice(index, 1);
  setScenes(updatedScenes);

  // Update active index if needed
  if (index === activeSceneIndex) {
    // If we closed the active tab, activate the previous one or the first available
    if (updatedScenes.length > 0) {
      const newIndex = index > 0 ? index - 1 : 0;
      setActiveSceneIndex(newIndex);
      
      // Make sure the active scene ID is also updated in the store
      if (updatedScenes[newIndex]) {
        setActiveSceneId(updatedScenes[newIndex].id);
      }
    } else {
      // No scenes left, show the initial modal
      setActiveSceneIndex(null);
      setShowInitialModal(true);
      // Set active scene ID to null in the store
      setActiveSceneId(null);
    }
  } else if (index < activeSceneIndex) {
    // If we closed a tab before the active one, adjust the active index
    setActiveSceneIndex(activeSceneIndex - 1);
  }
  
  // Force sync to store with the updated scenes
  setTimeout(() => {
    // Use the direct store access to ensure the state is updated correctly
    try {
      // Use dynamic import instead of require
      import('../../inspector/store').then(storeModule => {
        const useEditorStore = storeModule.default;
        const store = useEditorStore.getState();
        
        // Update scenes in the store directly
        store.setScenes(updatedScenes);
        
        // If no scenes left, reset the active scene ID in the store
        if (updatedScenes.length === 0) {
          store.setActiveSceneId(null);
        }
        
        console.log('Store sync completed after closing tab');
      }).catch(err => {
        console.error('Failed to import store module:', err);
      });
    } catch (e) {
      console.error('Failed to sync with store after closing tab:', e);
    }
  }, 50);
};

// Check current scene size
export const checkCurrentSceneSize = (activeSceneIndex, scenes) => {
  if (activeSceneIndex === null) return { isLarge: false, sizeInMB: "0.00" };
  
  // Prepare the scene data for serialization (same as in handleSave)
  const sceneData = {
    id: scenes[activeSceneIndex].id || `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: scenes[activeSceneIndex].name,
    timestamp: Date.now(),
    boxes: scenes[activeSceneIndex].boxes,
    backgroundImage: scenes[activeSceneIndex].backgroundImage,
  };

  // Convert to JSON string and check size
  const jsonData = JSON.stringify(sceneData);
  return checkSceneSize(jsonData);
};

// Update all saved scenes in localStorage with the current human participants
export const updateAllSavedScenesWithHumanParticipants = (humanParticipants) => {
  if (!humanParticipants || !Array.isArray(humanParticipants)) {
    console.warn('Invalid human participants data:', humanParticipants);
    return;
  }

  console.log('Updating all saved scenes with human participants:', humanParticipants);
  
  try {
    // Get all scene keys from localStorage
    const sceneKeys = Object.keys(localStorage).filter(key => key.startsWith('scene:'));
    
    // Process each scene
    for (const key of sceneKeys) {
      try {
        // Get scene data from localStorage
        const sceneDataStr = localStorage.getItem(key);
        if (!sceneDataStr) continue;
        
        const sceneData = JSON.parse(sceneDataStr);
        
        // Skip file references since they don't contain the full scene data
        if (sceneData.isFileReference) {
          continue;
        }
        
        // Check if scene has boxes
        if (!sceneData.boxes || !Array.isArray(sceneData.boxes)) {
          continue;
        }
        
        let hasChanges = false;
        
        // Update all avatar elements with current isHuman status
        const updatedBoxes = sceneData.boxes.map(box => {
          const updatedBox = { ...box };
          
          // Update all avatar elements in the elements array
          if (updatedBox.elements) {
            updatedBox.elements = updatedBox.elements.map(element => {
              if (element.elementType === 'avatar' && element.avatarData) {
                const wasHuman = element.avatarData.isHuman;
                const isHuman = humanParticipants.includes(element.avatarData.name);
                
                // Only mark as changed if the status actually changed
                if (wasHuman !== isHuman) {
                  hasChanges = true;
                }
                
                return {
                  ...element,
                  avatarData: {
                    ...element.avatarData,
                    isHuman: isHuman
                  }
                };
              }
              return element;
            });
          }
          
          // Handle legacy format with avatarSlots
          if (updatedBox.avatarSlots) {
            updatedBox.avatarSlots = updatedBox.avatarSlots.map(slot => {
              if (slot.avatarData) {
                const wasHuman = slot.avatarData.isHuman;
                const isHuman = humanParticipants.includes(slot.avatarData.name);
                
                if (wasHuman !== isHuman) {
                  hasChanges = true;
                }
                
                return {
                  ...slot,
                  avatarData: {
                    ...slot.avatarData,
                    isHuman: isHuman
                  }
                };
              }
              return slot;
            });
          }
          
          // Handle legacy format with direct avatarData
          if (updatedBox.avatarData) {
            const wasHuman = updatedBox.avatarData.isHuman;
            const isHuman = humanParticipants.includes(updatedBox.avatarData.name);
            
            if (wasHuman !== isHuman) {
              hasChanges = true;
            }
            
            updatedBox.avatarData = {
              ...updatedBox.avatarData,
              isHuman: isHuman
            };
          }
          
          return updatedBox;
        });
        
        // Only update localStorage if changes were made
        if (hasChanges) {
          const updatedScene = {
            ...sceneData,
            boxes: updatedBoxes
          };
          
          localStorage.setItem(key, JSON.stringify(updatedScene));
          console.log(`Updated human participants in scene: ${key}`);
        }
      } catch (error) {
        console.error(`Error updating scene ${key}:`, error);
      }
    }
    
    // Dispatch a custom event to notify that scenes have been updated
    window.dispatchEvent(new CustomEvent('scenesUpdatedWithHumanParticipants'));
  } catch (error) {
    console.error('Error updating saved scenes with human participants:', error);
  }
};

// Initialize event listeners for human participants changes
export const initHumanParticipantsSync = () => {
  // Only initialize once
  if (window._humanParticipantsSyncInitialized) {
    return;
  }
  
  window._humanParticipantsSyncInitialized = true;
  
  // Listen for storage events (changes from other tabs)
  window.addEventListener('storage', (e) => {
    if (e.key === 'aiPanelData') {
      try {
        const parsedData = JSON.parse(e.newValue || '{}');
        if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
          updateAllSavedScenesWithHumanParticipants(parsedData.humanParticipants);
        }
      } catch (error) {
        console.error('Error handling aiPanelData storage event:', error);
      }
    }
  });
  
  // Listen for custom event (changes from current tab)
  window.addEventListener('humanParticipantsChanged', () => {
    try {
      const savedData = localStorage.getItem('aiPanelData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
          updateAllSavedScenesWithHumanParticipants(parsedData.humanParticipants);
        }
      }
    } catch (error) {
      console.error('Error handling humanParticipantsChanged event:', error);
    }
  });
  
  console.log('Human participants sync initialized');
}; 