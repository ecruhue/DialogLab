import React, { useState, useEffect } from 'react';
import { Plus, X, Loader2, Trash } from 'lucide-react';
import useEditorStore from '../inspector/store';

const SceneSetupModal = ({
  errorMessage,
  createNewScene,
  loadSavedScene,
  deleteScene,
  fileInputRef,
  scenes,
  setScenes,
  setActiveSceneIndex,
  setShowInitialModal,
  loadBoxesForScene,
  setErrorMessage
}) => {
  const [loadingSceneId, setLoadingSceneId] = useState(null);
  const [deletingSceneId, setDeletingSceneId] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Get savedScenes from the store instead of props
  const { savedScenes, loadSavedScenes, deleteSavedScene } = useEditorStore();
  
  // Load saved scenes when the component mounts
  useEffect(() => {
    loadSavedScenes();
  }, [loadSavedScenes]);

  // Add event listener for custom scene drop event
  useEffect(() => {
    const handleSceneDrop = (e) => {
      const data = e.detail;
      if (data.type === "scene" && data.scene) {
        handleLoadScene(data.scene.id);
      }
    };

    // Add event listener
    document.addEventListener('scenepaneldrop', handleSceneDrop);

    // Cleanup
    return () => {
      document.removeEventListener('scenepaneldrop', handleSceneDrop);
    };
  }, []);

  // Wrapper for loadSavedScene that adds loading state
  const handleLoadScene = (sceneId, options = {}) => {
    setLoadingSceneId(sceneId);
    
    // Add a direct store update to set the scene as active
    const sceneData = localStorage.getItem(`scene:${sceneId}`);
    if (sceneData) {
      try {
        const parsedData = JSON.parse(sceneData);
        console.log(`Directly setting active scene ID: ${parsedData.id}`);
        const editorStore = useEditorStore.getState();
        editorStore.setActiveSceneId(parsedData.id);
        
        // Also set globalPartySettings if they exist in the scene data
        if (parsedData.globalPartySettings) {
          console.log(`Setting globalPartySettings from scene:`, parsedData.globalPartySettings);
          editorStore.setGlobalPartySettings(parsedData.globalPartySettings);
        } else if (parsedData.isFileReference && parsedData.globalPartySettings) {
          // In case this is a file reference with globalPartySettings included
          console.log(`Setting globalPartySettings from file reference:`, parsedData.globalPartySettings);
          editorStore.setGlobalPartySettings(parsedData.globalPartySettings);
        }
        
        // Skip container creation if we're loading for playback (containers will be created by TalkingHeadComponent)
        // if (!options.forPlayback) {
        //   // Ensure scene container elements are prepared
        //   // setTimeout(() => {
        //   //   // Create avatar containers if they don't exist
        //   //   if (parsedData.boxes) {
        //   //     parsedData.boxes.forEach(box => {
        //   //       // For new structure with elements
        //   //       if (box.elements) {
        //   //         box.elements.forEach(element => {
        //   //           if (element.elementType === 'avatar') {
        //   //             const containerId = `avatar-container-${element.id}`;
        //   //             if (!document.getElementById(containerId)) {
        //   //               const container = document.createElement('div');
        //   //               container.id = containerId;
        //   //               container.classList.add('avatar-container');
        //   //               container.style.width = '100%';
        //   //               container.style.height = '100%';
        //   //               container.style.position = 'relative';
        //   //               document.body.appendChild(container);
        //   //               console.log(`Created container: ${containerId}`);
        //   //             }
        //   //           }
        //   //         });
        //   //       }
        //   //       // For legacy structure
        //   //       else if (box.avatarData) {
        //   //         const containerId = `avatar-container-${box.id}`;
        //   //         if (!document.getElementById(containerId)) {
        //   //           const container = document.createElement('div');
        //   //           container.id = containerId;
        //   //           container.classList.add('avatar-container');
        //   //           container.style.width = '100%';
        //   //           container.style.height = '100%';
        //   //           container.style.position = 'relative';
        //   //           document.body.appendChild(container);
        //   //           console.log(`Created container: ${containerId}`);
        //   //         }
        //   //       }
        //   //     });
        //   //   }
        //   // }, 100);
        // } else {
        //   console.log("Skipping container creation during playback-initiated load");
        // }
      } catch (e) {
        console.error('Error parsing scene data:', e);
      }
    }
    
    // Small delay to show the loading state
    setTimeout(() => {
      try {
        // Check if this load is for playback
        const isForPlayback = window.lastSceneLoadIsForPlayback === true;
        
        const result = loadSavedScene(sceneId);
        // Handle both Promise and non-Promise results
        if (result && typeof result.then === 'function') {
          result.then((loadedScene) => {
            setLoadingSceneId(null);
            
            // If we have a loaded scene, explicitly dispatch an event to update components
            if (loadedScene) {
              // Update store immediately
              const store = useEditorStore.getState();
              if (store.scenes) {
                // Make sure we're not replacing any existing scenes
                const existingScene = store.scenes.find(s => s.id === loadedScene.id);
                if (!existingScene) {
                  store.setScenes([...store.scenes, loadedScene]);
                }
              }
              
              // Set active scene ID
              store.setActiveSceneId(loadedScene.id);
              
              // Also broadcast a scene update event
              window.dispatchEvent(new CustomEvent('editor-scenes-updated', { 
                detail: { 
                  scenes: [loadedScene],
                  activeSceneId: loadedScene.id,
                  source: isForPlayback ? 'playback-handler' : 'scenesetupmodal',
                  initiator: true
                }
              }));
              
              // Trigger a mode change to keep in authoring (unless for playback)
              window.dispatchEvent(new CustomEvent('show-scene-in-editor', { 
                detail: { 
                  sceneId: loadedScene.id,
                  sceneName: loadedScene.name,
                  source: isForPlayback ? 'playback-handler' : 'scenesetupmodal',
                  context: isForPlayback ? 'playback' : 'authoring',
                  mode: isForPlayback ? 'playback' : 'authoring',
                  maintainMode: isForPlayback,
                  eventId: `scene-activation-${Date.now()}`
                }
              }));
            }
          }).catch(err => {
            console.error('Error loading scene:', err);
            setLoadingSceneId(null);
          });
        } else {
          // If not a Promise, just clear the loading state
          setTimeout(() => {
            setLoadingSceneId(null);
            
            // If we have a result (the loaded scene), ensure it's set as active
            if (result) {
              // Update store directly
              const store = useEditorStore.getState();
              
              // Make sure we're not replacing any existing scenes
              const existingScene = store.scenes.find(s => s.id === result.id);
              if (!existingScene && store.scenes) {
                store.setScenes([...store.scenes, result]);
              }
              
              // Set active scene
              store.setActiveSceneId(result.id);
              
              // Broadcast events
              window.dispatchEvent(new CustomEvent('editor-scenes-updated', { 
                detail: { 
                  scenes: [result],
                  activeSceneId: result.id,
                  source: isForPlayback ? 'playback-handler' : 'scenesetupmodal',
                  initiator: true
                }
              }));
              
              // Trigger a mode change to keep in authoring
              window.dispatchEvent(new CustomEvent('show-scene-in-editor', { 
                detail: { 
                  sceneId: result.id,
                  sceneName: result.name,
                  source: isForPlayback ? 'playback-handler' : 'scenesetupmodal',
                  context: isForPlayback ? 'playback' : 'authoring',
                  mode: isForPlayback ? 'playback' : 'authoring',
                  maintainMode: isForPlayback,
                  eventId: `scene-activation-${Date.now()}`
                }
              }));
            }
          }, 500);
        }
      } catch (error) {
        console.error('Error in handleLoadScene:', error);
        setLoadingSceneId(null);
      }
    }, 300);
  };
  
  // Wrapper for deleteScene that adds loading state
  const handleDeleteScene = (sceneId, e) => {
    e.stopPropagation();
    setDeletingSceneId(sceneId);
    
    // Delete from the store first
    deleteSavedScene(sceneId);
    
    // Call the parent delete function if it exists
    if (typeof deleteScene === 'function') {
      deleteScene(sceneId, e);
    }
    
    // Remove loading state after a delay
    setTimeout(() => {
      setDeletingSceneId(null);
    }, 1000);
  };
  
  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if the dragged item is a scene
    const types = Array.from(e.dataTransfer.types);
    if (types.includes('application/json')) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'scene' && data.scene) {
        // Load the dropped scene
        handleLoadScene(data.scene.id);
      }
    } catch (error) {
      console.error('Error handling dropped scene:', error);
    }
  };

  return (
    <div 
      className="w-full p-2 items-center justify-center"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div 
        className={`border shadow-xl rounded-xl p-3 w-full theme-text-primary transition-all duration-300 ${
          isDragOver 
            ? 'border-blue-500 bg-blue-500/10 scale-[1.02] shadow-blue-500/20' 
            : 'theme-border theme-bg-secondary hover:theme-border-hover'
        }`}
      >
        {errorMessage && (
          <div className="mb-2 p-2 theme-bg-error theme-border theme-border-error rounded-lg">
            <p className="theme-text-error text-xs flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {errorMessage}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Action buttons */}
          <div className="flex justify-start gap-2 pb-2 theme-border-b theme-border">
              <button
                onClick={createNewScene}
              className="px-3 py-1.5 theme-bg-accent theme-text-inverse rounded-lg hover:theme-bg-accent-hover text-sm flex items-center font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                title="Create New Scene"
              >
              <Plus className="h-4 w-4 mr-1.5" />
                New Scene
              </button>
              
              <label 
                htmlFor="file-upload" 
              className="px-3 py-1.5 theme-bg-tertiary theme-text-primary rounded-lg hover:theme-bg-hover text-sm flex items-center font-medium cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                title="Load from File"
              >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" />
                </svg>
                Load File
              </label>
              <input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Process the file
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      try {
                        const jsonData = JSON.parse(event.target?.result);

                        // Create a new scene with the loaded data
                        const loadedScene = {
                          id: jsonData.id || `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                          name: jsonData.name || "Imported Scene",
                          boxes: [],
                          backgroundImage: jsonData.backgroundImage,
                          hasUnsavedChanges: false,
                        };

                        // Add the scene to our list and make it active
                        const newScenes = [...scenes, loadedScene];
                        setScenes(newScenes);
                        const newIndex = newScenes.length - 1;
                        setActiveSceneIndex(newIndex);
                        setShowInitialModal(false);

                        // Load boxes and initialize avatars after the scene is created
                        await loadBoxesForScene(newIndex, jsonData.boxes);
                        
                        // Create a file URL for future reference if the file is large
                        try {
                          const jsonString = JSON.stringify(jsonData);
                          const sizeInBytes = jsonString.length * 2; // Rough estimate
                          const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
                          
                          // If the file is large (>2MB), create a file reference
                          if (sizeInBytes > 2 * 1024 * 1024) {
                            const blob = new Blob([jsonString], { type: "application/json" });
                            const fileUrl = URL.createObjectURL(blob);
                            
                            // Extract avatar names from the boxes
                            function extractAvatarNames(boxes) {
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
                            
                            // Create a metadata entry for this file
                            const metadataEntry = {
                              id: loadedScene.id,
                              name: loadedScene.name,
                              timestamp: Date.now(),
                              fileUrl: fileUrl,
                              size: sizeInMB,
                              isFileReference: true,
                              preview: {
                                backgroundImage: jsonData.backgroundImage,
                                boxCount: jsonData.boxes.length,
                                hasAvatars: jsonData.boxes.some(box => 
                                  (box.elements && box.elements.some(el => el.elementType === 'avatar' && el.avatarData)) ||
                                  box.avatarData
                                ),
                                hasContent: jsonData.boxes.some(box => 
                                  (box.elements && box.elements.some(el => el.elementType === 'content'))
                                ),
                                parties: [...new Set(jsonData.boxes.filter(box => box.party).map(box => box.party))],
                                // Store actual box positions for better visualization
                                boxPositions: jsonData.boxes.map(box => ({
                                  x: box.x || 0,
                                  y: box.y || 0,
                                  width: box.width || 33,
                                  height: box.height || 33
                                })),
                                // Extract and store avatar names
                                avatarNames: extractAvatarNames(jsonData.boxes),
                                // Store per-box content information
                                boxContents: jsonData.boxes.map(box => {
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
                                      // Check for content elements
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
                            
                            // Save the metadata to localStorage
                            localStorage.setItem(`scene:${loadedScene.id}`, JSON.stringify(metadataEntry));
                            console.log(`Saved file reference for large scene (${sizeInMB}MB): ${loadedScene.name}`);
                          }
                        } catch (storageError) {
                          console.warn("Could not save file reference to localStorage:", storageError);
                        }
                      } catch (error) {
                        console.error("Error parsing scene file:", error);
                        setErrorMessage(
                          "Failed to load scene: Invalid file format",
                        );
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
              />
            </div>

          {/* Drop zone with enhanced styling */}
          <div 
            className={`flex flex-col items-center justify-center py-6 px-4 rounded-lg border-2 border-dashed transition-all duration-300 ${
              isDragOver 
                ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
                : 'theme-border-light hover:theme-border-hover theme-bg-tertiary'
            }`}
          >
            <div className={`theme-text-tertiary mb-3 transition-transform duration-300 ${isDragOver ? 'scale-110' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            <p className="theme-text-primary text-sm font-medium mb-1">
              {isDragOver ? 'Drop scene to load' : 'Drag and drop a scene here'}
            </p>
            <p className="theme-text-tertiary text-xs">
              or use the buttons above to get started
            </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SceneSetupModal; 