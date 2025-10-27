import React, { useEffect, useState } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import useEditorStore, { EditorState, Scene, SavedScene, Box, ScenePreview } from "./store";

const DraggableScenes: React.FC = () => {
  const { scenes, savedScenes, loadSavedScenes, deleteSavedScene, activeSceneId, setActiveSceneId } = useEditorStore() as EditorState;
  const [allScenes, setAllScenes] = useState<SavedScene[]>([]);
  const [deletingSceneId, setDeletingSceneId] = useState<string | null>(null);

  // Load saved scenes only once when component mounts
  useEffect(() => {
    loadSavedScenes();
  }, []);

  // Process and combine scenes whenever scenes or savedScenes change
  useEffect(() => {
    // Process saved scenes to extract preview data
    let processedSavedScenes: SavedScene[] = [];
    
    if (savedScenes?.length > 0) {
      processedSavedScenes = savedScenes.map(scene => {
        // Try to get processed scene data from localStorage
        let sceneData: any = {};
        try {
          const storedData = localStorage.getItem(`scene:${scene.id}`);
          if (storedData) {
            sceneData = JSON.parse(storedData);
          }
        } catch (error) {
          console.error("Error parsing scene data:", error);
        }

        return {
          ...scene,
          preview: sceneData.preview || null,
          isFileReference: sceneData.isFileReference || false,
          isSaved: true
        } as SavedScene;
      });
    }
    
    // Convert active scenes to SavedScene format
    const activeScenes: SavedScene[] = scenes.map(scene => ({
      ...scene,
      preview: undefined,
      isFileReference: false,
      isSaved: false,
      isActive: true
    }));

    // Get IDs of active scenes to avoid duplicates
    const activeSceneIds = new Set(activeScenes.map(scene => scene.id));

    // Filter out saved scenes that are also in active scenes
    const uniqueSavedScenes = processedSavedScenes.filter(scene => !activeSceneIds.has(scene.id));

    // Combine both arrays, with active scenes first
    setAllScenes([...activeScenes, ...uniqueSavedScenes]);
  }, [savedScenes, scenes]);

  const handleDragStart = (scene: Scene, e: React.DragEvent<HTMLDivElement>) => {
    // Set the data to be transferred in the drag operation
    // We'll use stringified JSON containing the scene data and a flag for the drop target
    e.dataTransfer.setData("application/json", JSON.stringify({
      type: "scene",
      scene: scene,
      source: "draggable-scenes"
    }));

    // Set custom drag image if needed
    e.dataTransfer.effectAllowed = "copyMove";
    
    // Log the drag start for debugging
    console.log(`Started dragging scene: ${scene.name}`);
  };

  const handleDeleteScene = (sceneId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Set deleting state to show loading indicator
    setDeletingSceneId(sceneId);
    
    // Delete the scene
    deleteSavedScene(sceneId);
    
    // Clear the deleting state after a brief delay
    setTimeout(() => {
      setDeletingSceneId(null);
    }, 500);
  };

  const handleSceneClick = (sceneId: string, e: React.MouseEvent) => {
    // Don't set active scene if we're clicking on the delete button
    if ((e.target as HTMLElement).closest('.delete-button')) {
      return;
    }
    
    // Toggle active scene - if already active, deactivate it. Otherwise, activate it.
    setActiveSceneId(activeSceneId === sceneId ? null : sceneId);
  };

  // Function to simulate drop behavior
  const simulateSceneDrop = (scene: Scene) => {
    // Create a custom event that matches the drop event data structure
    const event = new CustomEvent('scenepaneldrop', {
      detail: {
        type: "scene",
        scene: scene,
        source: "draggable-scenes"
      }
    });
    
    // Dispatch the event on the document so other components can listen for it
    document.dispatchEvent(event);
  };

  const handleDoubleClick = (scene: Scene, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't trigger if clicking on delete or toggle buttons
    if ((e.target as HTMLElement).closest('.delete-button')) {
      return;
    }
    
    // Simulate the drop behavior
    simulateSceneDrop(scene);
  };

  const renderScenePreview = (sceneData: SavedScene) => {
    let boxes: any[] = [];
    let avatarNames: string[] = [];
    let parties = new Set<string>();
    let hasAnyContent = false;
    
    // For file references, use the preview data
    if (sceneData.isFileReference && sceneData.preview) {
      // Use the preview data for thumbnails
      hasAnyContent = sceneData.preview.hasContent || false;
      parties = new Set(sceneData.preview.parties || []);
      
      // Extract avatar information from preview data
      if (sceneData.preview.avatarNames && sceneData.preview.avatarNames.length > 0) {
        avatarNames = sceneData.preview.avatarNames;
      }
      
      // Create boxes for visualization based on preview data
      if (sceneData.preview.boxPositions && sceneData.preview.boxPositions.length > 0) {
        boxes = sceneData.preview.boxPositions.map((pos: any, i: number) => {
          // Create the box with proper position
          const currentBox: Box = {
            id: `preview-box-${i}`,
            x: pos.x,
            y: pos.y,
            width: pos.width,
            height: pos.height,
            elements: [],
            elementRatio: 1,
            layoutMode: 'grid',
            party: null,
            view: 'default'
          };

          // If we have box contents data, use it
          if (sceneData.preview?.boxContents && i < sceneData.preview.boxContents.length) {
            const boxContent = sceneData.preview.boxContents[i];
            
            // Add party if it exists
            if (boxContent.party) {
              currentBox.party = boxContent.party;
            }
          }
          
          return currentBox;
        });
      }
    } else {
      // Use actual scene boxes if available
      boxes = sceneData.boxes || [];
      
      // Extract avatar information and parties
      boxes.forEach(box => {
        // Add party if exists
        if (box.party) {
          parties.add(box.party);
        }
        
        // Check elements array for avatars and content
        if (box.elements) {
          box.elements.forEach((element: any) => {
            if (element.elementType === 'avatar' && element.avatarData?.name) {
              avatarNames.push(element.avatarData.name);
            }
            // Check for content
            if (element.elementType === 'content') {
              hasAnyContent = true;
            }
          });
        }
      });
    }
    
    // If we don't have avatar names but we have preview data, use that
    if (avatarNames.length === 0 && sceneData.preview?.avatarNames) {
      avatarNames = sceneData.preview.avatarNames;
    }
    
    // If we still don't have avatars, use some defaults for demo purposes
    if (avatarNames.length === 0) {
      try {
        const savedParticipants = localStorage.getItem('topicPanel-participants');
        if (savedParticipants) {
          const participants = JSON.parse(savedParticipants);
          if (Array.isArray(participants) && participants.length > 0) {
            avatarNames = participants.slice(0, 2).map(p => p.name);
          }
        }
      } catch (e) {
        console.log('Error getting default speakers', e);
      }
      
      // If still no avatars, use defaults
      if (avatarNames.length === 0) {
        avatarNames = ['Alice', 'Bob'];
      }
    }
    
    // Get avatar color based on name
    const getAvatarColor = (name: string) => {
      const colors: Record<string, string> = {
        'alice': '#1e3a8a',  // deep blue
        'bob': '#065f46',    // green
        'charlie': '#92400e', // amber
        'david': '#0ea5e9',  // sky blue
        'eve': '#9f1239',    // red
        'frank': '#155e75',  // cyan
        'grace': '#3f6212'   // lime
      };
      
      const lowerName = name?.toLowerCase() || '';
      return colors[lowerName] || '#374151'; // default gray
    };
    
    // Format avatar list for display
    const formatNames = (names: string[]) => {
      if (!names || names.length === 0) return '';
      if (names.length <= 3) {
        return names.join(', ');
      } else {
        return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
      }
    };
    
    return (
      <div className={`scene-thumbnail cursor-pointer transition-all duration-200 w-full overflow-hidden border ${activeSceneId === sceneData.id ? 'border-blue-400 border-2' : 'border-blue-700'} rounded-md hover:border-blue-500 hover:bg-black/20 hover:scale-[1.01] shadow-md relative theme-bg-tertiary`}>
        {/* Active scene indicator */}
        {/* {activeSceneId === sceneData.id && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-md z-20 shadow-md">
            Active Scene
          </div>
        )} */}
        
        {/* Current project scene indicator (not saved) */}
        {sceneData.isActive && !sceneData.isSaved && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-600 text-white text-[10px] rounded-md z-20 shadow-md">
            Active Scene
          </div>
        )}
        
        {/* Delete button with loading state - only show for saved scenes */}
        {sceneData.isSaved && (
          <div 
            className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors z-20 opacity-100 flex items-center justify-center shadow-md cursor-pointer delete-button"
            onClick={(e) => handleDeleteScene(sceneData.id, e)}
          >
            {deletingSceneId === sceneData.id ? (
              <div className="w-2 h-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        )}

        {/* Active scene toggle button */}
        {/* <div 
          className={`absolute top-1 ${sceneData.isSaved ? 'right-6' : 'right-1'} w-4 h-4 rounded-full transition-colors z-20 flex items-center justify-center shadow-md cursor-pointer delete-button ${
            activeSceneId === sceneData.id 
              ? "bg-blue-600 text-white hover:bg-blue-700" 
              : "bg-gray-600 text-white/70 hover:bg-gray-700"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setActiveSceneId(activeSceneId === sceneData.id ? null : sceneData.id);
          }}
          title={activeSceneId === sceneData.id ? "Deactivate Scene" : "Activate Scene"}
        >
          {activeSceneId === sceneData.id ? (
            <Eye size={10} />
          ) : (
            <EyeOff size={10} />
          )}
        </div> */}

        <div className="flex flex-col h-full">
          {/* Scene visualization with boxes and avatars */}
          <div className="flex p-1 flex-1">
            <div 
              className="relative h-12 w-full rounded overflow-hidden flex-shrink-0 hidden group-hover:block"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                backgroundImage: sceneData.backgroundImage ? `url(${sceneData.backgroundImage})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* Render boxes as small rectangles */}
              {boxes.map((box, index) => {
                // Calculate position and size based on box data
                const x = box.x || 0;
                const y = box.y || 0;
                const width = box.width || 33;
                const height = box.height || 33;
                
                // Find avatars in this box
                const boxAvatars: string[] = [];
                let hasContent = false;
                
                // Check elements array for avatars and content
                if (box.elements) {
                  box.elements.forEach((element: any) => {
                    if (element.elementType === 'avatar' && element.avatarData?.name) {
                      boxAvatars.push(element.avatarData.name);
                    }
                    if (element.elementType === 'content') {
                      hasContent = true;
                    }
                  });
                }
                
                // Determine box color based on party or content
                let boxColor = 'var(--bg-tertiary)'; // default gray
                if (box.party) {
                  boxColor = 'var(--bg-accent)'; // blue for party boxes
                } else if (boxAvatars.length > 0) {
                  boxColor = 'var(--bg-success)'; // green for avatar boxes
                } else if (hasContent) {
                  boxColor = 'var(--bg-warning-light)'; // amber for content boxes
                }
                
                return (
                  <div
                    key={box.id || index}
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: `${y}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      backgroundColor: boxColor,
                      opacity: 0.7,
                      border: '1px solid white',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    {box.party && (
                      <div className="absolute top-0 left-0 right-0 bg-blue-900 bg-opacity-70 text-white text-xs px-1 truncate">
                        {box.party}
                      </div>
                    )}
                    
                    {boxAvatars.length > 0 && (
                      <div className="flex items-center justify-center space-x-2">
                        {boxAvatars.slice(0, 2).map((name, idx) => (
                          <div 
                            key={idx} 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                            style={{
                              backgroundColor: getAvatarColor(name),
                              border: '2px solid rgba(255, 255, 255, 0.7)'
                            }}
                          >
                            {name.substring(0, 1).toUpperCase()}
                          </div>
                        ))}
                        {boxAvatars.length > 2 && (
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white bg-gray-600 border-2 border-white/70"
                          >
                            +{boxAvatars.length - 2}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {hasContent && (
                      <div className="px-1 bg-amber-500 rounded text-white text-xs">
                        Txt
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* If no boxes or empty scene, show placeholder */}
              {(!boxes || boxes.length === 0) && (
                <div className="w-full h-full flex items-center justify-center theme-text-tertiary">
                  <span className="text-xs">Empty</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Scene info section - below the visualization */}
          <div className="p-1 border-t theme-border-light theme-bg-primary">
            {/* Scene name */}
            <div className="text-sm font-medium truncate theme-text-primary">
              {sceneData.name}
              {sceneData.isFileReference && sceneData.preview?.size && (
                <span className="ml-1 text-[10px] text-blue-300">[{sceneData.preview.size}MB]</span>
              )}
            </div>
            
            {/* Metadata section - more compact, horizontal layout */}
            <div className="text-[10px] flex flex-wrap gap-1">
              {avatarNames.length > 0 && (
                <div className="truncate">
                  <span className="font-medium theme-text-secondary">A: </span>
                  <span className="theme-text-tertiary">{formatNames(avatarNames)}</span>
                </div>
              )}
              {parties.size > 0 && (
                <div className="truncate">
                  <span className="font-medium theme-text-secondary">P: </span>
                  <span className="text-blue-400">{formatNames(Array.from(parties))}</span>
                </div>
              )}
              {hasAnyContent && (
                <div className="truncate">
                  <span className="font-medium theme-text-secondary">C: </span>
                  <span className="text-amber-400">Has content</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[calc(100%-28px)] flex flex-col theme-bg-tertiary rounded-lg shadow mt-3">
      {/* Scene Library header - fixed at the top */}
      <div className="preview-header text-sm font-semibold theme-text-primary mb-2">Scene Library</div>

      {/* Scrollable content section */}
      <div className="overflow-y-auto flex-1 w-full">
        {/* Active Scenes Section */}
        {allScenes.some(scene => scene.isActive) && (
          <div className="mb-2">
            <div className="grid grid-cols-1 gap-3 p-1 pr-2">
              {allScenes
                .filter(scene => scene.isActive)
                .map((scene) => (
                  <div
                    key={scene.id}
                    draggable
                    onDragStart={(e) => handleDragStart(scene, e)}
                    onDoubleClick={(e) => handleDoubleClick(scene, e)}
                    className="group cursor-move"
                    // onClick={(e) => handleSceneClick(scene.id, e)}
                  > 
                    {renderScenePreview(scene)}
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Saved Scenes Section */}
        {allScenes.some(scene => scene.isSaved) && (
          <div>
            <div className="grid grid-cols-1 gap-3 p-1 pr-2">
              {allScenes
                .filter(scene => scene.isSaved)
                .map((scene) => (
                  <div
                    key={scene.id}
                    draggable
                    onDragStart={(e) => handleDragStart(scene, e)}
                    onDoubleClick={(e) => handleDoubleClick(scene, e)}
                    className="group cursor-move"
                    // onClick={(e) => handleSceneClick(scene.id, e)}
                  > 
                    {renderScenePreview(scene)}
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Empty State */}
        {allScenes.length === 0 && (
          <p className="text-sm theme-text-tertiary">No scenes available.</p>
        )}
      </div>
    </div>
  );
};

export default DraggableScenes; 