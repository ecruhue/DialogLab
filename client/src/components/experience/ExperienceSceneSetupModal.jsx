import React, { useState, useEffect } from 'react';
import { Loader2, Trash } from 'lucide-react';
import useEditorStore from '../inspector/store';

const ExperienceSceneSetupModal = ({
  errorMessage,
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
  
  // Get savedScenes from the store
  const { savedScenes, loadSavedScenes, deleteSavedScene } = useEditorStore();
  
  // Load saved scenes when the component mounts
  useEffect(() => {
    loadSavedScenes();
  }, [loadSavedScenes]);

  // Wrapper for loadSavedScene that adds loading state
  const handleLoadScene = (sceneId) => {
    setLoadingSceneId(sceneId);
    
    // Small delay to show the loading state
    setTimeout(() => {
      loadSavedScene(sceneId).finally(() => {
        setLoadingSceneId(null);
      });
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
  
  // Helper function to process scene data for display
  const getProcessedSceneData = (scene) => {
    try {
      // Try to get scene data from localStorage
      const sceneData = localStorage.getItem(`scene-${scene.id}`);
      if (sceneData) {
        return JSON.parse(sceneData);
      }
      
      // If no localStorage data, return basic scene info
      return {
        id: scene.id,
        name: scene.name,
        backgroundImage: scene.backgroundImage,
        boxCount: scene.boxes?.length || 0,
        hasAvatars: scene.boxes?.some(box => 
          (box.elements && box.elements.some(el => el.elementType === 'avatar' && el.avatarData)) ||
          box.avatarData
        ) || false,
        hasContent: scene.boxes?.some(box => 
          (box.elements && box.elements.some(el => el.elementType === 'content'))
        ) || false,
        parties: [...new Set(scene.boxes?.filter(box => box.party).map(box => box.party) || [])],
        avatarNames: scene.boxes?.reduce((names, box) => {
          if (box.elements) {
            box.elements.forEach(el => {
              if (el.elementType === 'avatar' && el.avatarData?.name) {
                names.push(el.avatarData.name);
              }
            });
          }
          if (box.avatarData?.name) {
            names.push(box.avatarData.name);
          }
          return names;
        }, []) || []
      };
    } catch (error) {
      console.error('Error processing scene data:', error);
      return {
        id: scene.id,
        name: scene.name,
        boxCount: 0,
        hasAvatars: false,
        hasContent: false,
        parties: [],
        avatarNames: []
      };
    }
  };

  return (
    <div className="w-full p-2 flex items-center justify-center">
      <div className="border border-gray-700 shadow-lg rounded-lg p-3 w-full text-gray-200 theme-bg-secondary">
        {errorMessage && (
          <p className="text-red-400 mb-2 text-sm">{errorMessage}</p>
        )}

        <div className="flex flex-col gap-2">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-200">
              Select a Scene to Experience
            </h2>
            
            <span className="text-gray-500 mx-1">|</span>
            
            <h3 className="text-sm font-medium text-gray-300">
              {savedScenes.length > 0 ? "Available Scenes:" : "No Saved Scenes"}
            </h3>
          </div>

          {/* Saved Scenes Grid */}
          {savedScenes.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 max-h-[350px] overflow-y-auto p-1">
              {savedScenes.map((scene) => {
                const sceneData = getProcessedSceneData(scene);
                const isLoading = loadingSceneId === scene.id;
                const isDeleting = deletingSceneId === scene.id;
                
                return (
                  <div
                    key={scene.id}
                    className={`scene-thumbnail cursor-pointer transition-all duration-200 relative border rounded-md overflow-hidden group ${
                      isLoading || isDeleting
                        ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-[1.02]' 
                        : 'border-gray-600 hover:border-blue-400 hover:scale-[1.02] hover:shadow-md'
                    } ${isDeleting ? 'opacity-50' : ''}`}
                    onClick={() => !isLoading && !isDeleting && handleLoadScene(scene.id)}
                    style={{
                      width: '100%',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}
                  >
                    <div 
                      style={{
                        backgroundImage: sceneData.backgroundImage ? `url(${sceneData.backgroundImage})` : 'none',
                        backgroundColor: 'var(--bg-secondary)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        width: '100%',
                        height: '70px',
                        position: 'relative',
                        transition: 'height 0.2s ease-in-out'
                      }}
                      className="group-hover:h-[80px]"
                    >
                      {/* Loading overlay */}
                      {isLoading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
                          <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                        </div>
                      )}
                      
                      {/* Deleting overlay */}
                      {isDeleting && (
                        <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-20">
                          <Trash className="w-6 h-6 text-red-400 animate-pulse" />
                        </div>
                      )}
                      
                      {/* Scene preview content */}
                      {sceneData.backgroundImage && (
                        <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-0 transition-opacity duration-200" />
                      )}
                      
                      {/* Scene info overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-1 text-xs text-white">
                        <div className="flex items-center justify-between">
                          <span className="truncate">{scene.name}</span>
                          {sceneData.boxCount > 0 && (
                            <span className="ml-2 text-gray-300">
                              {sceneData.boxCount} box{sceneData.boxCount !== 1 ? 'es' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDeleteScene(scene.id, e)}
                      className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors z-20"
                      title="Delete Scene"
                      disabled={isLoading || isDeleting}
                    >
                      {isDeleting ? 
                        <Loader2 className="w-3 h-3 animate-spin" /> : 
                        <Trash className="w-3 h-3" />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* No scenes message */}
          {savedScenes.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p>No saved scenes available.</p>
              <p className="text-sm mt-1">Please create scenes in the authoring mode first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExperienceSceneSetupModal; 