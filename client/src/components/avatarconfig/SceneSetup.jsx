import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Plus, X, Trash } from "lucide-react";
import VerticalToolbar from "./VerticalToolbar";
import ConversationGroup from "./ConversationGroup";
import useEditorStore from "../inspector/store";
import SceneSetupModal from "./SceneSetupModal";
import { 
  loadSavedScenesList, 
  createNewScene, 
  loadSavedScene,
  deleteScene,
  handleSave,
  loadBoxesForScene,
  closeTab,
  checkCurrentSceneSize,
  initHumanParticipantsSync,
  updateAllSavedScenesWithHumanParticipants
} from "./utils/SceneManagement";

import {
  initializeAvatar,
  handleAvatarConfigRequest as avatarConfigRequest,
  updateCurrentRotationValues as updateRotations
} from "./utils/AvatarHandler";

import {
  handleAddBox,
  handleDeleteBox,
  handleBackgroundUpload,
  handleDrop,
  handleBackgroundDrop,
  handleContentBackgroundDrop,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleResizeStart,
  handleBackgroundClick,
} from "./utils/BoxInteractions";

import {
  updateElementCount,
  updateElementType,
  deleteElement,
  handleContentDrop,
  processExcelFile,
  handleAssignParty,
} from "./utils/ElementHandler";

const SceneSetup = forwardRef(
  (
    {
      messages,
      setMessages,
      scenes,
      setScenes,
      activeSceneIndex,
      setActiveSceneIndex,
      selectedBoxId,
      setSelectedBoxId,
      showInitialModal,
      setShowInitialModal,
      className,
      avatarInstancesRef,
    },
    ref,
  ) => {
    // Expose handleAvatarConfigRequest method to parent via ref
    useImperativeHandle(ref, () => ({
      handleAvatarConfigRequest,
    }));
    
    // Get the editor store to sync scenes
    const { activeSceneId, setScenes: storeSetScenes, setActiveSceneId } = useEditorStore();
    
    // Use a ref to store previous scenes to compare
    const prevScenesRef = useRef(null);
    const prevActiveIndexRef = useRef(null);
    
    // Add state to track emoji states
    const [emojiStates, setEmojiStates] = useState({});
    // Add state to track current speaking info
    const [speakingInfo, setSpeakingInfo] = useState(null);
    
    // State for tracking multiple scenes/tabs
    const [newSceneCounter, setNewSceneCounter] = useState(1);
    // Use the prop if provided, otherwise use local state
    const [localShowInitialModal, setLocalShowInitialModal] = useState(true);
    
    // Use either the prop or local state for modal visibility
    const effectiveShowInitialModal = setShowInitialModal ? 
      // If prop setter is provided, respect the prop value
      showInitialModal : 
      // Otherwise use local state with fallback behavior (show if no scenes)
      typeof localShowInitialModal === 'boolean' ? 
        localShowInitialModal : 
        scenes.length === 0;
    
    const effectiveSetShowInitialModal = setShowInitialModal || setLocalShowInitialModal;
    
    const [savedScenes, setSavedScenes] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [configuredAvatar, setConfiguredAvatar] = useState(null);
    const [containerDimensions, setContainerDimensions] = useState({
      width: 0,
      height: 0,
    });
    
    // State for save dialog
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveMode, setSaveMode] = useState(""); // 'save' or 'saveAs' or 'rename'
    const [saveSceneName, setSaveSceneName] = useState("");
    const [sceneSizeInfo, setSceneSizeInfo] = useState({ isLarge: false, sizeInMB: "0.00" });
    
    // Drag and resize state
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [loadingBoxIds, setLoadingBoxIds] = useState(new Set());
    const dragRef = useRef({ 
      boxId: null, 
      offsetX: 0, 
      offsetY: 0, 
      containerWidth: 0, 
      containerHeight: 0 
    });
    const resizeRef = useRef({
      boxId: null,
      handle: null,
      startWidth: 0,
      startHeight: 0,
      startX: 0,
      startY: 0,
    });
    
    const [show360View, setShow360View] = useState(false);
    const [availableParties, setAvailableParties] = useState([]);

    // Add effect to load and sync availableParties with savedParties
    useEffect(() => {
      try {
        const savedParties = JSON.parse(localStorage.getItem('savedParties') || '[]');
        if (savedParties && savedParties.length > 0) {
          // Extract party names from savedParties
          const partyNames = savedParties.map(party => party.name);
          setAvailableParties(partyNames);
        } else {
          // If no saved parties, use default parties
          setAvailableParties([
            "Teaching Staff",
            "Students",
            "Moderators",
            "Presenters",
            "Audience",
          ]);
        }
      } catch (error) {
        console.error('Error loading saved parties:', error);
        // Fallback to default parties on error
        setAvailableParties([
          "Teaching Staff",
          "Students",
          "Moderators",
          "Presenters",
          "Audience",
        ]);
      }
    }, []); // Empty dependency array means this runs once on mount

    // Initialize human participants sync system
    useEffect(() => {
      // Initialize the system that syncs human participants across scenes
      initHumanParticipantsSync();
      
      // Also sync any existing human participants with all scenes immediately
      try {
        const savedData = localStorage.getItem('aiPanelData');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
            console.log('Initial sync of human participants with all scenes:', parsedData.humanParticipants);
            updateAllSavedScenesWithHumanParticipants(parsedData.humanParticipants);
          }
        }
      } catch (error) {
        console.error('Error during initial human participants sync:', error);
      }
    }, []); // Empty dependency array means this runs once on mount

    // Add effect to listen for storage events to keep availableParties in sync
    useEffect(() => {
      const handleStorageChange = (e) => {
        if (e.key === 'savedParties') {
          try {
            const savedParties = JSON.parse(e.newValue || '[]');
            if (savedParties && savedParties.length > 0) {
              const partyNames = savedParties.map(party => party.name);
              setAvailableParties(partyNames);
            }
          } catch (error) {
            console.error('Error handling storage event for savedParties:', error);
          }
        }
        
        // Handle changes to human participants
        if (e.key === 'aiPanelData') {
          try {
            const parsedData = JSON.parse(e.newValue || '{}');
            const humanParticipants = parsedData.humanParticipants || [];
            
            console.log('Human participants updated:', humanParticipants);
            
            // Create a new scenes array to trigger a re-render
            const updatedScenes = [...scenes];
            let hasChanges = false;
            
            // Update all scenes, not just the active one
            updatedScenes.forEach(scene => {
              if (scene.boxes) {
                scene.boxes.forEach(box => {
                  if (box.elements) {
                    box.elements.forEach(element => {
                      if (element.elementType === 'avatar' && element.avatarData) {
                        const wasHuman = element.avatarData.isHuman;
                        const isHuman = humanParticipants.includes(element.avatarData.name);
                        
                        // Only update if there's a change
                        if (wasHuman !== isHuman) {
                          element.avatarData.isHuman = isHuman;
                          hasChanges = true;
                        }
                      }
                    });
                  }
                });
              }
            });
            
            // Only update scenes if there were actual changes
            if (hasChanges) {
              console.log('Updating scenes with new human status');
              setScenes(updatedScenes);
            }
          } catch (error) {
            console.error('Error handling storage event for aiPanelData:', error);
          }
        }
      };

      window.addEventListener('storage', handleStorageChange);
      
      // Also listen for custom event for local changes
      const handleHumanParticipantsChanged = () => {
        try {
          // Re-read localStorage directly
          const savedData = localStorage.getItem('aiPanelData');
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            const humanParticipants = parsedData.humanParticipants || [];
            
            console.log('Human participants changed (custom event):', humanParticipants);
            
            // Create a new scenes array to trigger a re-render
            const updatedScenes = JSON.parse(JSON.stringify(scenes)); // Deep clone for clean reference change
            let hasChanges = false;
            
            // Update all scenes, not just the active one
            updatedScenes.forEach(scene => {
              if (scene.boxes) {
                scene.boxes.forEach(box => {
                  if (box.elements) {
                    box.elements.forEach(element => {
                      if (element.elementType === 'avatar' && element.avatarData) {
                        const wasHuman = element.avatarData.isHuman;
                        const isHuman = humanParticipants.includes(element.avatarData.name);
                        
                        // Always update to ensure immediate visual changes
                        element.avatarData.isHuman = isHuman;
                        if (wasHuman !== isHuman) {
                          hasChanges = true;
                        }
                      }
                    });
                  }
                });
              }
            });
            
            // Always update scenes to guarantee refresh
            console.log('Updating scenes with new human status');
            setScenes(updatedScenes);
            
            // Force a rerender by setting selected box ID to itself (if selected) or null (if not)
            if (selectedBoxId) {
              setTimeout(() => {
                setSelectedBoxId(null);
                setTimeout(() => setSelectedBoxId(selectedBoxId), 0);
              }, 0);
            }
          }
        } catch (error) {
          console.error('Error handling custom human participants event:', error);
        }
      };
      
      window.addEventListener('humanParticipantsChanged', handleHumanParticipantsChanged);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('humanParticipantsChanged', handleHumanParticipantsChanged);
      };
    }, [activeSceneIndex, scenes, setScenes, selectedBoxId]); // Add dependencies to handle scene changes

    // Various refs
    const sceneContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    // const avatarInstancesRef = useRef({});
    const previousActiveSceneRef = useRef(null);
    const initializedScenesRef = useRef(new Set());

    // Add handler function for emoji state changes
    const handleEmojiStateChange = (newEmojiStates) => {
      setEmojiStates(newEmojiStates);
    };
    
    // Add handler for speaking info changes
    const handleSpeakingInfoChange = (newSpeakingInfo) => {
      setSpeakingInfo(newSpeakingInfo);
    };
    
    // A direct sync function that can be called after important updates
    const syncScenesToStore = (forceUpdate = false) => {
      // Get the current scenes from the store
      const { scenes: storeScenes } = useEditorStore.getState();
      
      // Special case: Don't overwrite non-empty store scenes with an empty array
      if ((!scenes || scenes.length === 0) && storeScenes && storeScenes.length > 0) {
        console.log(`Warning: Not syncing empty scenes array to non-empty store (${storeScenes.length} scenes)`);
        // Actually, update our local scenes from the store instead
        if (!scenes || scenes.length === 0) {
          console.log(`Updating local state with ${storeScenes.length} scenes from store`);
          setScenes([...storeScenes]);
          
          // Find and set the active scene index based on the store's active scene ID
          const storeActiveId = useEditorStore.getState().activeSceneId;
          if (storeActiveId) {
            const index = storeScenes.findIndex(s => s.id === storeActiveId);
            if (index >= 0) {
              setActiveSceneIndex(index);
            }
          }
        }
        return;
      }
      
      // Check if we need to update the store
      const needUpdate = forceUpdate || 
                       !storeScenes || 
                       storeScenes.length !== scenes.length;
      
      if (needUpdate) {
        console.log(`Syncing ${scenes.length} scenes to store`);
        console.log(`Component scenes:`, scenes.map(s => s.id || 'undefined'));
        console.log(`Store scenes:`, storeScenes?.map(s => s.id || 'undefined') || []);
        
        // Only update if we have scenes to sync
        if (scenes && scenes.length > 0) {
          // Make deep copies to ensure we're not causing issues with references
          const scenesToSync = scenes.map(scene => ({...scene}));
          
          // Update the store with the current scenes
          useEditorStore.getState().setScenes(scenesToSync);
          
          // Update active scene ID if needed
          if (activeSceneIndex !== -1 && activeSceneIndex < scenes.length && scenes[activeSceneIndex]) {
            const activeId = scenes[activeSceneIndex].id;
            console.log(`Setting active scene ID in store: ${activeId}`);
            useEditorStore.getState().setActiveSceneId(activeId);
          }
          
          // Log success for debugging
          console.log(`Successfully synced ${scenesToSync.length} scenes to store`);
        } else {
          console.warn(`Skipped syncing scenes - no scenes available to sync`);
        }
      } else {
        console.log(`Store already in sync with component scenes (${scenes?.length || 0} scenes)`);
      }
    };

    // Function to broadcast scene updates to other components
    const broadcastSceneUpdate = (scenesToBroadcast) => {
      if (!scenesToBroadcast || scenesToBroadcast.length === 0) {
        console.log('No scenes to broadcast');
        return;
      }
      
      // Get the active scene ID
      const activeId = activeSceneIndex !== -1 && activeSceneIndex < scenesToBroadcast.length ? 
        scenesToBroadcast[activeSceneIndex]?.id : null;
      
      console.log(`Broadcasting scene update event with ${scenesToBroadcast.length} scenes, active ID: ${activeId}`);
      
      // Dispatch event with current scenes
      window.dispatchEvent(new CustomEvent('editor-scenes-updated', { 
        detail: { 
          scenes: scenesToBroadcast,
          activeSceneId: activeId,
          source: 'scene-setup-update',
          initiator: true
        }
      }));
    };

    // Sync scenes with the editor store when scenes change, but avoid infinite loops
    useEffect(() => {
      // Skip if no scenes to sync
      if (!scenes || scenes.length === 0) {
        // Check if store has scenes we should use
        const { scenes: storeScenes } = useEditorStore.getState();
        if (storeScenes && storeScenes.length > 0) {
          console.log(`Found ${storeScenes.length} scenes in store but none in component state, updating local state`);
          setScenes([...storeScenes]);
          
          // If the store has an active scene ID, try to match it
          const storeActiveId = useEditorStore.getState().activeSceneId;
          if (storeActiveId) {
            const activeIndex = storeScenes.findIndex(s => s.id === storeActiveId);
            if (activeIndex !== -1) {
              setActiveSceneIndex(activeIndex);
            }
          }
        }
        return;
      }
      
      // We need to compare references, not just contents
      const sceneReferencesChanged = prevScenesRef.current !== scenes;
      const activeIndexChanged = prevActiveIndexRef.current !== activeSceneIndex;
      
      // Only update if references actually changed (not just internal properties)
      if (sceneReferencesChanged || activeIndexChanged) {
        // Store current references for next comparison
        prevScenesRef.current = scenes;
        prevActiveIndexRef.current = activeSceneIndex;
        
        // Use RAF to avoid immediate state updates which can cause loops
        requestAnimationFrame(() => {
          console.log(`Syncing ${scenes.length} scenes to store (ref changed: ${sceneReferencesChanged})`);
          
          // Only update store if we have a store setter and it's different from our current scenes
          const { scenes: currentStoreScenes } = useEditorStore.getState();
          const storeNeedsUpdate = !currentStoreScenes || 
                                 currentStoreScenes.length !== scenes.length ||
                                 !currentStoreScenes.every((s, i) => s.id === scenes[i]?.id);
          
          if (storeNeedsUpdate) {
            // Create a new array to ensure reference change
            storeSetScenes([...scenes]);
          }

          // Set the active scene ID in the store when it changes
          if (activeSceneIndex !== null && scenes[activeSceneIndex]) {
            const currentStoreActiveId = useEditorStore.getState().activeSceneId;
            if (currentStoreActiveId !== scenes[activeSceneIndex].id) {
              setActiveSceneId(scenes[activeSceneIndex].id);
            }
          } else if (activeSceneId !== null) {
            // Only set to null if it's not already null
            setActiveSceneId(null);
          }
        });
      }
    }, [scenes, activeSceneIndex, storeSetScenes, setActiveSceneId, activeSceneId]);

    // Get saved scenes on component mount
    useEffect(() => {
      loadSavedScenesList(setSavedScenes, setErrorMessage);
    }, []);

    // Add resize observer to track container size changes
    useEffect(() => {
      if (!sceneContainerRef.current) return;

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setContainerDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.width * 0.5625, // 16:9 aspect ratio
          });
        }
      });

      resizeObserver.observe(sceneContainerRef.current);
      return () => resizeObserver.disconnect();
    }, []);

    // Cleanup avatars on unmount
    useEffect(() => {
      return () => {
        Object.values(avatarInstancesRef.current).forEach((instance) => {
          if (instance) {
            instance.stop();
          }
        });
      };
    }, []);

    // Handle tab switching - reinitialize avatars when switching tabs
    useEffect(() => {
      if (activeSceneIndex === null) return; // Skip if no active scene

      // Skip first render and cases where the index hasn't changed
      if (previousActiveSceneRef.current === activeSceneIndex) {
        return;
      }

      console.log("Tab switch detected, active scene index:", activeSceneIndex);

      // Store previous active scene index
      const previousIndex = previousActiveSceneRef.current;
      previousActiveSceneRef.current = activeSceneIndex;

      // Skip initialization if this scene was just loaded (marked as initialized)
      if (initializedScenesRef.current.has(activeSceneIndex)) {
        console.log("Scene is marked as initialized, skipping reinitialization");
        // Remove from initialized set so future tab switches will work normally
        initializedScenesRef.current.delete(activeSceneIndex);
        return;
      }

      // Clean up avatars from the previous scene if needed
      if (previousIndex !== null && scenes[previousIndex]) {
        console.log("Cleaning up avatars from previous scene:", previousIndex);
        const previousScene = scenes[previousIndex];

        // Handle new element-based structure first
        if (previousScene.boxes) {
          previousScene.boxes.forEach((box) => {
            if (box.elements) {
              box.elements.forEach((element) => {
                if (
                  element.elementType === "avatar" &&
                  element.avatarData &&
                  avatarInstancesRef.current[element.id]
                ) {
                  console.log("Cleaning up avatar instance for element:", element.id);
                  avatarInstancesRef.current[element.id].stop();
                  delete avatarInstancesRef.current[element.id];
                }
              });
            }
            // Legacy support for direct avatarData
            else if (box.avatarData && avatarInstancesRef.current[box.id]) {
              console.log("Cleaning up avatar instance for box:", box.id);
              avatarInstancesRef.current[box.id].stop();
              delete avatarInstancesRef.current[box.id];
            }
            // Legacy support for avatarSlots
            else if (box.avatarSlots) {
              box.avatarSlots.forEach((slot) => {
                if (slot.avatarData && avatarInstancesRef.current[slot.id]) {
                  console.log("Cleaning up avatar instance for slot:", slot.id);
                  avatarInstancesRef.current[slot.id].stop();
                  delete avatarInstancesRef.current[slot.id];
                }
              });
            }
          });
        }
      }

      // Get current scene
      const currentScene = scenes[activeSceneIndex];
      if (!currentScene) {
        console.error("Current scene not found at index:", activeSceneIndex);
        return;
      }

      console.log("Initializing avatars for scene:", currentScene.name);

      // Wait for the DOM to update
      setTimeout(() => {
        // Handle new element-based structure first
        if (currentScene.boxes) {
          currentScene.boxes.forEach((box) => {
            if (box.elements) {
              box.elements.forEach((element) => {
                if (element.elementType === "avatar" && element.avatarData) {
                  console.log("Initializing avatar for element:", element.id);
                  initializeAvatar(element.id, element.avatarData, avatarInstancesRef).catch((err) => {
                    console.error("Error initializing avatar for element:", element.id, err);
                  });
                }
              });
            }
            // Legacy support for direct avatarData
            else if (box.avatarData) {
              console.log("Initializing avatar for box (legacy):", box.id);
              initializeAvatar(box.id, box.avatarData, avatarInstancesRef).catch((err) => {
                console.error("Error initializing avatar for box:", box.id, err);
              });
            }
            // Legacy support for avatarSlots
            else if (box.avatarSlots) {
              box.avatarSlots.forEach((slot) => {
                if (slot.avatarData) {
                  console.log("Initializing avatar for slot (legacy):", slot.id);
                  initializeAvatar(slot.id, slot.avatarData, avatarInstancesRef).catch((err) => {
                    console.error("Error initializing avatar for slot:", slot.id, err);
                  });
                }
              });
            }
          });
        }
      }, 300);
    }, [activeSceneIndex, scenes]);

    // Listen for avatar configuration changes
    useEffect(() => {
      const handleAvatarConfigChanged = (event) => {
        const { id, config } = event.detail;
        console.log("Avatar configuration changed event received:", config.name || id);

        // Find all instances of this avatar by name across all scenes
        let updatedScenes = [...scenes];
        let scenesChanged = false;

        scenes.forEach((scene, sceneIndex) => {
          if (!scene.boxes) return;

          scene.boxes.forEach((box, boxIndex) => {
            // Handle new element-based structure
            if (box.elements) {
              box.elements.forEach((element, elementIndex) => {
                if (element.elementType === "avatar" && element.avatarData) {
                  // Match by name (preferred) or id as fallback
                  if (element.avatarData.name === config.name || element.id === id) {
                    console.log(`Updating avatar instance: ${element.id} (${element.avatarData.name})`);

                    // Update the avatar data in state
                    if (!scenesChanged) {
                      updatedScenes = [...scenes]; // Create a new copy only if we haven't yet
                      scenesChanged = true;
                    }
                    
                    // Update with new configuration
                    updatedScenes[sceneIndex].boxes[boxIndex].elements[elementIndex].avatarData = {
                      ...element.avatarData,
                      voice: config.voice || element.avatarData.voice,
                      settings: {
                        ...element.avatarData.settings,
                        ...(config.settings || {}),
                      },
                    };

                    // Apply changes to the running avatar instance
                    const avatarInstance = avatarInstancesRef.current[element.id];
                    if (avatarInstance) {
                      // Apply mood if it changed
                      if (config.settings?.mood && avatarInstance.setMood) {
                        avatarInstance.setMood(config.settings.mood);
                      }

                      // Apply view settings if they changed
                      if (avatarInstance.setView) {
                        avatarInstance.setView(config.settings?.cameraView || "upper", {
                          cameraDistance: config.settings?.cameraDistance || 0.5,
                          cameraRotateY: config.settings?.cameraRotateY || 0,
                        });
                      }
                    }

                    // Mark scene as having changes
                    updatedScenes[sceneIndex].hasUnsavedChanges = true;
                  }
                }
              });
            }

            // Legacy support for direct avatarData
            else if (box.avatarData && (box.avatarData.name === config.name || box.id === id)) {
              console.log(`Updating legacy avatar: ${box.id} (${box.avatarData.name})`);

              if (!scenesChanged) {
                updatedScenes = [...scenes]; // Create a new copy only if we haven't yet
                scenesChanged = true;
              }

              // Update configuration
              updatedScenes[sceneIndex].boxes[boxIndex].avatarData = {
                ...box.avatarData,
                voice: config.voice || box.avatarData.voice,
                settings: {
                  ...box.avatarData.settings,
                  ...(config.settings || {}),
                },
              };

              // Apply changes to the running avatar instance
              const avatarInstance = avatarInstancesRef.current[box.id];
              if (avatarInstance) {
                // Apply configurations as above
                if (config.settings?.mood && avatarInstance.setMood) {
                  avatarInstance.setMood(config.settings.mood);
                }

                if (avatarInstance.setView) {
                  avatarInstance.setView(config.settings?.cameraView || "upper", {
                    cameraDistance: config.settings?.cameraDistance || 0.5,
                    cameraRotateY: config.settings?.cameraRotateY || 0,
                  });
                }
              }

              updatedScenes[sceneIndex].hasUnsavedChanges = true;
            }
          });
        });

        // Update state with all the changes
        if (scenesChanged) {
          setScenes(updatedScenes);
        }
      };

      // Add event listener
      document.addEventListener("avatarConfigChanged", handleAvatarConfigChanged);

      // Clean up on unmount
      return () => {
        document.removeEventListener("avatarConfigChanged", handleAvatarConfigChanged);
      };
    }, [scenes, avatarInstancesRef]);

    // Also implement the window.applyAvatarChanges function if not already present
    useEffect(() => {
      if (typeof window !== "undefined" && !window.applyAvatarChanges) {
        window.applyAvatarChanges = (id, config) => {
          // Save to localStorage
          const storageKey = `avatar-config-${config.name || id}`;
          localStorage.setItem(storageKey, JSON.stringify(config));

          // Dispatch event for real-time updates
          const event = new CustomEvent("avatarConfigChanged", {
            detail: { id, config },
          });
          document.dispatchEvent(event);
        };
      }
    }, []);

    // Current active scene
    const currentScene = activeSceneIndex !== null ? scenes[activeSceneIndex] : null;

    // Wrapper methods that use our utility functions but with local state
    const handleAvatarConfigRequest = (avatarConfig) => {
      avatarConfigRequest(
        avatarConfig, 
        scenes, 
        setScenes, 
        setActiveSceneIndex, 
        setConfiguredAvatar, 
        effectiveSetShowInitialModal, 
        avatarInstancesRef,
        (id, persona) => initializeAvatar(id, persona, avatarInstancesRef)
      );
    };

    const onLoadSavedScene = (sceneId) => {
      loadSavedScene(
        sceneId, 
        scenes, 
        setScenes, 
        setActiveSceneIndex, 
        effectiveSetShowInitialModal, 
        setErrorMessage,
        initializedScenesRef,
        (id, persona) => initializeAvatar(id, persona, avatarInstancesRef),
        avatarInstancesRef,
        fileInputRef
      );
    };

    const onDeleteScene = (sceneId, e) => {
      deleteScene(
        sceneId, 
        e, 
        savedScenes, 
        setSavedScenes, 
        setErrorMessage, 
        () => loadSavedScenesList(setSavedScenes, setErrorMessage)
      );
    };

    const onCreateNewScene = () => {
      // First check if we already have scenes in the store that might not be in our component state
      const { scenes: storeScenes } = useEditorStore.getState();
      if (storeScenes && storeScenes.length > 0 && (!scenes || scenes.length === 0)) {
        // Update our local state from the store before proceeding
        console.log("Found scenes in store but not in component, syncing first");
        setScenes([...storeScenes]);
      }
      
      // Create the new scene - this updates local state
      const newScene = createNewScene(
        scenes, 
        setScenes, 
        setActiveSceneIndex, 
        setNewSceneCounter, 
        effectiveSetShowInitialModal
      );
      
      // Ensure the new scene is properly tracked
      if (newScene && newScene.id) {
        // Calculate the new index which will be the scenes length after addition
        const newIndex = scenes.length;
        
        // Store this updated scenes array for consistency
        const updatedScenes = [...scenes, newScene];
        
        // Mark the new scene as initialized to prevent redundant initialization
        if (initializedScenesRef.current) {
          initializedScenesRef.current.add(newIndex);
          console.log(`Scene marked as initialized at index ${newIndex}`);
        }
        
        // Force our local state to include the new scene, avoiding race conditions
        setScenes(updatedScenes);
        setActiveSceneIndex(newIndex);
        
        // CRITICAL: Ensure the store has the updated scene data 
        // This is the most important part to prevent the scene from disappearing
        try {
          const store = useEditorStore.getState();
          if (store) {
            // Make a defensive copy of the store scenes
            const currentStoreScenes = [...(store.scenes || [])];
            
            // Check if the new scene is already in the store (by ID)
            const existingIndex = currentStoreScenes.findIndex(s => s.id === newScene.id);
            
            // If not in store, add it; otherwise update it
            if (existingIndex === -1) {
              currentStoreScenes.push(newScene);
            } else {
              currentStoreScenes[existingIndex] = newScene;
            }
            
            // Update the store with our combined scenes
            store.setScenes(currentStoreScenes);
            store.setActiveSceneId(newScene.id);
            console.log(`Store directly updated with ${currentStoreScenes.length} scenes`);
          }
        } catch (err) {
          console.warn('Direct store update failed:', err);
        }
        
        // Dispatch scene update event for other components with a slight delay
        setTimeout(() => {
          console.log(`New scene created: ${newScene.name} with ID: ${newScene.id}`);
          
          // Get the latest scenes - either from our updated local state or the store
          const { scenes: latestStoreScenes } = useEditorStore.getState();
          const scenesToBroadcast = (latestStoreScenes && latestStoreScenes.length > 0) 
            ? latestStoreScenes 
            : updatedScenes;
          
          // Broadcast event with the most up-to-date scenes
          broadcastSceneUpdate(scenesToBroadcast);
        }, 50);
      }
    };

    const onCloseTab = async (index, e) => {
      closeTab(
        index, 
        e, 
        scenes, 
        setScenes, 
        activeSceneIndex, 
        setActiveSceneIndex,
        effectiveSetShowInitialModal,
        avatarInstancesRef,
        activeSceneId,
        setActiveSceneId,
        syncScenesToStore
      );
    };

    const onLoadBoxesForScene = async (sceneIndex, boxesData) => {
      loadBoxesForScene(
        sceneIndex, 
        boxesData, 
        scenes, 
        setScenes, 
        (id, persona) => initializeAvatar(id, persona, avatarInstancesRef)
      );
    };

    const onUpdateCurrentRotationValues = () => {
      updateRotations(activeSceneIndex, scenes, setScenes, avatarInstancesRef);
    };

    const handleSaveButton = () => {
      if (activeSceneIndex === null) return;

      // Check scene size before showing dialog
      const sizeInfo = checkCurrentSceneSize(activeSceneIndex, scenes);
      setSceneSizeInfo(sizeInfo);

      const sceneName = scenes[activeSceneIndex].name;
      if (sceneName.startsWith("New Scene")) {
        // If it's a new scene, show save dialog
        setSaveMode("save");
        setSaveSceneName("");
        setErrorMessage("");
        setShowSaveDialog(true);
      } else {
        // If it's an existing scene, save directly
        handleSave(
          activeSceneIndex,
          scenes,
          setScenes,
          setErrorMessage,
          setShowSaveDialog,
          saveSceneName,
          onUpdateCurrentRotationValues,
          () => loadSavedScenesList(setSavedScenes, setErrorMessage),
          sceneName
        );
      }
    };

    const handleRenameClick = (index, e) => {
      e.stopPropagation(); // Prevent tab selection
      setActiveSceneIndex(index); // Set the active scene to the one being renamed
      
      // Set up rename mode
      setSaveMode("rename");
      setSaveSceneName(scenes[index].name); // Pre-fill with current name
      setErrorMessage("");
      setShowSaveDialog(true);
    };

    const handleSaveAsButton = () => {
      if (activeSceneIndex === null) return;
      
      // Check scene size before showing dialog
      const sizeInfo = checkCurrentSceneSize(activeSceneIndex, scenes);
      setSceneSizeInfo(sizeInfo);
      
      setSaveMode("saveAs");
      setSaveSceneName("");
      setErrorMessage("");
      setShowSaveDialog(true);
    };

    const handleSaveDialogConfirm = () => {
      handleSave(
        activeSceneIndex,
        scenes,
        setScenes,
        setErrorMessage,
        setShowSaveDialog,
        saveSceneName,
        onUpdateCurrentRotationValues,
        () => loadSavedScenesList(setSavedScenes, setErrorMessage)
      );
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 100);
    };

    // Handle mouse events with our utility functions
    const onMouseMove = (e) => {
      handleMouseMove(
        e, 
        isDragging, 
        isResizing, 
        dragRef, 
        resizeRef, 
        activeSceneIndex, 
        currentScene, 
        scenes, 
        setScenes, 
        sceneContainerRef
      );
    };

    const onMouseDown = (e, boxId) => {
      handleMouseDown(e, boxId, dragRef, setIsDragging);
    };

    const onMouseUp = () => {
      handleMouseUp(setIsDragging, setIsResizing, dragRef, resizeRef);
    };

    const onResizeStart = (e, boxId, handle) => {
      handleResizeStart(e, boxId, handle, setIsResizing, setSelectedBoxId, resizeRef, currentScene);
    };

    const onBackgroundClick = (e) => {
      handleBackgroundClick(e, isDragging, setSelectedBoxId);
    };

    // Element handling wrappers
    const onUpdateElementCount = (boxId, newCount) => {
      updateElementCount(boxId, newCount, activeSceneIndex, scenes, setScenes, avatarInstancesRef);
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 50);
    };

    const onUpdateElementType = (boxId, elementId, newType) => {
      updateElementType(boxId, elementId, newType, activeSceneIndex, scenes, setScenes, avatarInstancesRef);
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 50);
    };

    const onDeleteElement = (boxId, elementId) => {
      deleteElement(boxId, elementId, activeSceneIndex, scenes, setScenes, avatarInstancesRef);
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 50);
    };

    const onContentDrop = async (e, boxId, elementId, file) => {
      await handleContentDrop(e, boxId, elementId, file, activeSceneIndex, scenes, setScenes, loadingBoxIds, setLoadingBoxIds);
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 50);
    };

    const onAssignParty = (boxId, partyName) => {
      handleAssignParty(
        boxId, 
        partyName, 
        activeSceneIndex, 
        scenes, 
        setScenes, 
        availableParties, 
        setAvailableParties, 
        setSelectedBoxId
      );
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 50);
    };

    // Box handling wrappers
    const onAddBox = () => {
      handleAddBox(activeSceneIndex, scenes, setScenes, setSelectedBoxId, syncScenesToStore);
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 50);
    };

    const onDeleteBox = (boxId, e) => {
      handleDeleteBox(
        boxId, 
        e, 
        activeSceneIndex, 
        scenes, 
        setScenes, 
        setSelectedBoxId,
        avatarInstancesRef,
        syncScenesToStore
      );
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 50);
    };

    const onBackgroundUpload = (e) => {
      handleBackgroundUpload(e, activeSceneIndex, scenes, setScenes);
      // Broadcast the scene update
      setTimeout(broadcastSceneUpdate(scenes), 50);
    };

    const onDrop = async (e, boxId, elementId) => {
      handleDrop(
        e, 
        boxId, 
        elementId, 
        activeSceneIndex, 
        scenes, 
        setScenes, 
        avatarInstancesRef, 
        (id, persona) => initializeAvatar(id, persona, avatarInstancesRef)
      );
    };

    const onBackgroundDrop = async (e) => {
      // Check if this is a content drop first
      try {
        let contentData;
        try {
          const jsonData = e.dataTransfer.getData("application/json");
          if (jsonData) {
            contentData = JSON.parse(jsonData);
          }
        } catch (parseError) {
          console.error("Error parsing JSON data:", parseError);
        }
        
        // Handle content drop if it's content type
        const hasContentData = contentData && contentData.type === "content" && contentData.content;
        const hasFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
        
        if (hasContentData || hasFiles) {
          return onContentBackgroundDrop(e);
        }
      } catch (error) {
        console.error("Error checking drop content type:", error);
      }
      
      // If not content, handle as avatar drop
      handleBackgroundDrop(
        e, 
        activeSceneIndex, 
        scenes, 
        setScenes, 
        setSelectedBoxId, 
        sceneContainerRef, 
        avatarInstancesRef, 
        (id, persona) => initializeAvatar(id, persona, avatarInstancesRef)
      );
    };
    
    // Handle content drop on background
    const onContentBackgroundDrop = async (e) => {
      handleContentBackgroundDrop(
        e, 
        activeSceneIndex, 
        scenes, 
        setScenes, 
        setSelectedBoxId, 
        sceneContainerRef,
        loadingBoxIds,
        setLoadingBoxIds
      );
    };

    // Update modal visibility when scenes change
    useEffect(() => {
      // If no scenes, show the modal unless explicitly set to false
      if (scenes.length === 0 && !effectiveShowInitialModal) {
        effectiveSetShowInitialModal(true);
      }
      // If we have scenes and a selected index, hide the modal
      else if (scenes.length > 0 && activeSceneIndex !== null && effectiveShowInitialModal) {
        effectiveSetShowInitialModal(false);
      }
    }, [scenes.length, activeSceneIndex, effectiveShowInitialModal, effectiveSetShowInitialModal]);

    // If no scenes are open, show initial modal
    if (effectiveShowInitialModal) {
      return (
        <SceneSetupModal
          errorMessage={errorMessage}
          createNewScene={onCreateNewScene}
          loadSavedScene={onLoadSavedScene}
          deleteScene={onDeleteScene}
          fileInputRef={fileInputRef}
          scenes={scenes}
          setScenes={setScenes}
          setActiveSceneIndex={setActiveSceneIndex}
          setShowInitialModal={effectiveSetShowInitialModal}
          loadBoxesForScene={onLoadBoxesForScene}
          setErrorMessage={setErrorMessage}
          modalContext="authoring"
        />
      );
    }

    return (
      <div className={`w-full h-[340px] overflow-y-scroll relative overflow-x-hidden ${className}`}>
        {/* Tabs */}
        <div className="flex border-b theme-border-primary mb-1 overflow-x-auto">
          {scenes.map((scene, index) => {
            // Calculate max width based on number of tabs
            // As tabs increase, we reduce their maximum width
            const tabCount = scenes.length;
            const maxTabWidth = Math.max(
              100,
              100 - Math.min(50, (tabCount - 3) * 15),
            );

            return (
              <div
                key={index}
                className={`flex items-center gap-1 px-2 cursor-pointer rounded-t-md border-t border-l border-r theme-border-primary ${
                  index === activeSceneIndex
                    ? "theme-bg-secondary theme-text-primary border-b-2 theme-border-b-secondary-accent"
                    : "theme-bg-tertiary theme-text-primary hover:theme-bg-hover"
                } ${scene.isAvatarConfig ? "theme-bg-accent-light theme-border-accent" : ""}`}
                onClick={() => setActiveSceneIndex(index)}
                style={{ maxWidth: `${maxTabWidth}px`, minWidth: "50px" }}
              >
                <div className="mr-1 text-xs">⁝</div>
                <span
                  className="truncate text-sm"
                  style={{ maxWidth: `${maxTabWidth - 50}px` }}
                >
                  {scene.name}
                </span>
                {scene.hasUnsavedChanges && (
                  <span className="text-xs italic ml-1">
                    {index === activeSceneIndex ? "" : "*"}
                  </span>
                )}
                {scene.isAvatarConfig && (
                  <span className="text-xs theme-text-accent ml-1">[C]</span>
                )}
                <button
                  onClick={(e) => handleRenameClick(index, e)}
                  className={`ml-auto p-0.5 rounded-full ${
                    index === activeSceneIndex
                      ? "hover:theme-bg-hover"
                      : "hover:theme-bg-hover"
                  }`}
                  aria-label="Save as"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                </button>
                <button
                  onClick={(e) => onCloseTab(index, e)}
                  className={`ml-1 p-0.5 rounded-full ${
                    index === activeSceneIndex
                      ? "hover:theme-bg-hover"
                      : "hover:theme-bg-hover"
                  }`}
                  aria-label="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-row">
          {/* Scene background */}
          <div
            ref={sceneContainerRef}
            className="scene-background w-full relative overflow-hidden"
            style={{
              aspectRatio: currentScene?.isAvatarConfig ? "4/3" : "16/9",
              maxHeight: "300px",
              backgroundImage: currentScene?.backgroundImage
                ? `url(${currentScene.backgroundImage})`
                : "none",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundColor: currentScene?.isAvatarConfig
                ? "var(--bg-tertiary)"
                : !currentScene?.backgroundImage
                  ? "var(--bg-secondary)"
                  : "transparent",
            }}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onClick={onBackgroundClick}
            onDrop={onBackgroundDrop}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => e.preventDefault()}
          >
            {currentScene && (
              <>
                {/* Toggle 360 view button */}
                {/* {currentScene.backgroundImage && (
                  <button
                    onClick={() => setShow360View(true)}
                    className="absolute top-2 right-2 z-10 theme-bg-primary theme-bg-opacity-75 px-3 py-1 rounded-md 
                   hover:bg-opacity-100 transition-all flex items-center gap-2 theme-text-primary"
                  >
                    <span>View in 360°</span>
                  </button>
                )} */}

                {/* Render conversation boxes */}
                {currentScene.boxes.map((box) => (
                  <ConversationGroup
                    key={box.id}
                    box={box}
                    selectedBoxId={selectedBoxId}
                    onSelectBox={setSelectedBoxId}
                    onDeleteBox={onDeleteBox}
                    onUpdateElementCount={onUpdateElementCount}
                    onUpdateElementType={onUpdateElementType}
                    onDeleteElement={onDeleteElement}
                    onMouseDown={onMouseDown}
                    onResizeStart={onResizeStart}
                    avatarInstancesRef={avatarInstancesRef}
                    loadingBoxIds={loadingBoxIds}
                    onDrop={onDrop}
                    onContentDrop={onContentDrop}
                    availableParties={availableParties}
                    onAssignParty={onAssignParty}
                    currentScene={currentScene}
                    emojiStates={emojiStates}
                    speakingInfo={speakingInfo}
                    messages={messages}
                  />
                ))}

                {/* 360 Viewer */}

              </>
            )}
          </div>
          {/* Toolbar */}
          <VerticalToolbar
            onAddBox={onAddBox}
            onUploadBackground={onBackgroundUpload}
            onRemoveBackground={() => {
              const updatedScenes = [...scenes];
              updatedScenes[activeSceneIndex].backgroundImage = null;
              updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
              setScenes(updatedScenes);
            }}
            onSave={handleSaveButton}
            onSaveAs={handleSaveAsButton}
            onLoad={() => {
              effectiveSetShowInitialModal(true);
              loadSavedScenesList(setSavedScenes, setErrorMessage);
            }}
            hasBackground={currentScene?.backgroundImage}
            currentScene={currentScene}
            avatarInstancesRef={avatarInstancesRef}
            messages={messages}
            setMessages={setMessages}
            onEmojiStateChange={handleEmojiStateChange}
            onSpeakingInfoChange={handleSpeakingInfoChange}
          />
        </div>

        {/* Save Dialog */}
        {showSaveDialog && (
          <div className="absolute top-12 left-0 right-0 theme-bg-primary border theme-border-primary shadow-lg rounded-lg p-6 z-50 max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4">
              {saveMode === "rename" ? "Rename Scene" : 
               saveMode === "saveAs" ? "Save Scene As..." : "Save Scene"}
            </h2>

            {errorMessage && (
              <p className="theme-text-error mb-4">{errorMessage}</p>
            )}

            {/* Scene size warning */}
            {sceneSizeInfo.isLarge && saveMode !== "rename" && (
              <div className="mb-4 p-3 theme-bg-warning-light border theme-border-warning rounded-md">
                <p className="theme-text-warning text-sm flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Large scene detected ({sceneSizeInfo.sizeInMB}MB)
                </p>
                <p className="theme-text-warning text-sm mt-1">
                  This scene will be saved as a file download due to its size. You can reload it later from your downloads folder.
                </p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="sceneName" className="block text-sm font-medium theme-text-primary mb-1">
                {saveMode === "rename" ? "New Scene Name" : "Scene Name"}
              </label>
              <input
                type="text"
                id="sceneName"
                value={saveSceneName}
                onChange={(e) => setSaveSceneName(e.target.value)}
                className="w-full p-2 border theme-border-primary rounded theme-focus-ring"
                placeholder={saveMode === "rename" ? "Enter new name for your scene" : "Enter a name for your scene"}
                autocomplete="off"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 theme-bg-secondary theme-text-primary rounded hover:theme-bg-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDialogConfirm}
                className="px-4 py-2 theme-bg-accent theme-text-inverse rounded hover:theme-bg-accent-hover"
                disabled={!saveSceneName.trim()}
              >
                {saveMode === "rename" ? "Rename" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default SceneSetup; 