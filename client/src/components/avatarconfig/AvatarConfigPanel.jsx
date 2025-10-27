import React, { useState, useRef, useEffect } from 'react';
import SceneHierarchyView from './SceneHierarchyView';
import SceneSetup from './SceneSetup';
import './AvatarConfigPanel.css';
import useEditorStore from '../inspector/store';

const AvatarPanel = ({
  messages, 
  setMessages, 
  participantNames = [], 
  avatarUrls = [], 
  scenes: propScenes, 
  setScenes: propSetScenes,
  activeSceneId,
  setActiveSceneId,
  avatarInstancesRef,
}) => {
  const containerRef = useRef(null);
  // Create refs dynamically based on the number of avatars we need to display
  const [avatarRefs, setAvatarRefs] = useState([]);
 
  const [loading, setLoading] = useState('');
  const [error, setError] = useState(null);
  const [allAvatarsLoaded, setAllAvatarsLoaded] = useState(false);
  const [loadedAvatars, setLoadedAvatars] = useState({});

  // Use scenes from props if available, otherwise use local state
  const { scenes: storeScenes, setScenes: storeSetScenes } = useEditorStore();
  const [localScenes, setLocalScenes] = useState([]);
  const [localActiveSceneIndex, setLocalActiveSceneIndex] = useState(null);
  
  const scenes = propScenes || storeScenes || localScenes;
  const setScenes = propSetScenes || storeSetScenes || setLocalScenes;
  
  // Calculate activeSceneIndex from activeSceneId more efficiently
  const activeSceneIndex = React.useMemo(() => {
    return scenes.findIndex(scene => scene.id === activeSceneId);
  }, [scenes, activeSceneId]);
  
  // Cache the current scene to avoid recalculations
  const currentScene = React.useMemo(() => {
    return scenes[activeSceneIndex !== -1 ? activeSceneIndex : localActiveSceneIndex] || null;
  }, [scenes, activeSceneIndex, localActiveSceneIndex]);
  
  const [selectedBoxId, setSelectedBoxId] = useState(null);
  const [showInitialModal, setShowInitialModal] = useState(true);

  // Default avatar URLs if none are provided
  const [currentAvatarUrls, setCurrentAvatarUrls] = useState(
    avatarUrls.length > 0 ? avatarUrls : []
  );

  // Update refs when participant count changes
  useEffect(() => {
    // Create new refs for the avatars
    const newRefs = [];
    const count = participantNames.length > 0 ? participantNames.length : 3;
    
    for (let i = 0; i < count; i++) {
      newRefs.push(React.createRef());
    }
    
    setAvatarRefs(newRefs);
    // Reset loaded state when ref count changes
    setAllAvatarsLoaded(false);
    setLoadedAvatars({});
  }, [participantNames.length]);

  // Update avatar URLs when they change from props
  useEffect(() => {
    if (avatarUrls.length > 0) {
      console.log("Updating avatar URLs in AvatarPanel:", avatarUrls);
      setCurrentAvatarUrls(avatarUrls);
      // Reset loaded state when URLs change
      setAllAvatarsLoaded(false);
      setLoadedAvatars({});
    }
  }, [avatarUrls]);

  // Sync activeSceneIndex with store
  useEffect(() => {
    if (activeSceneIndex !== -1) {
      setLocalActiveSceneIndex(activeSceneIndex);
    }
  }, [activeSceneIndex]);

  const handleAvatarConfigDone = (updatedConfig) => {
    console.log('Avatar configuration updated:', updatedConfig);
  };

  const sceneSetupRef = useRef(null);

  // Track when a scene is opened or closed
  useEffect(() => {
    // The scene setup modal should only be shown when:
    // 1. No scene is active (activeSceneIndex is -1 or localActiveSceneIndex is null)
    // AND
    // 2. We haven't explicitly set showInitialModal to false
    const shouldShowModal = (activeSceneIndex === -1 && localActiveSceneIndex === null);
    
    // Set showInitialModal only if it's different to avoid unnecessary renders
    if (shouldShowModal !== showInitialModal) {
      setShowInitialModal(shouldShowModal);
    }
  }, [activeSceneIndex, localActiveSceneIndex, showInitialModal]);
  
  // Make sure when a scene is active, the modal is hidden
  useEffect(() => {
    if (activeSceneIndex !== -1 || localActiveSceneIndex !== null) {
      setShowInitialModal(false);
    }
  }, [activeSceneIndex, localActiveSceneIndex]);

  // For logging/debugging
  useEffect(() => {
    // Only log significant changes to avoid loops
    console.log("AvatarConfigPanel - Current scenes:", scenes.length);
    // Only log the scene ID when it changes
    if (currentScene?.id) {
      console.log("AvatarConfigPanel - Current scene ID:", currentScene.id);
    }
  }, [scenes.length, currentScene?.id]); // Only trigger on length or ID changes

  // Handler for when local activeSceneIndex changes
  const handleActiveSceneIndexChange = (index) => {
    setLocalActiveSceneIndex(index);
    if (index !== null && index >= 0 && index < scenes.length) {
      setActiveSceneId(scenes[index].id);
    } else {
      setActiveSceneId(null);
    }
  };

  // Listen for explicit scene updates from other components
  useEffect(() => {
    const handleScenesUpdated = (event) => {
      console.log('AvatarConfigPanel received editor-scenes-updated event:', event.detail);
      if (event.detail && event.detail.scenes && setScenes) {
        // Only update if we have the prop function
        if (event.detail.scenes.length > 0) {
          setScenes(event.detail.scenes);
        }
        
        // Update active scene if provided
        if (event.detail.activeSceneId && setActiveSceneId) {
          setActiveSceneId(event.detail.activeSceneId);
        }
      }
    };
    
    window.addEventListener('editor-scenes-updated', handleScenesUpdated);
    
    return () => {
      window.removeEventListener('editor-scenes-updated', handleScenesUpdated);
    };
  }, [setScenes, setActiveSceneId]);

  return (
    <div className="flex h-full" ref={containerRef}>
      {/* Only show the hierarchy view when there's an active scene */}
      {!showInitialModal && (
        <SceneHierarchyView 
          currentScene={currentScene}
          activeSceneIndex={activeSceneIndex !== -1 ? activeSceneIndex : localActiveSceneIndex}
          selectedBoxId={selectedBoxId}
          onSelectBox={setSelectedBoxId}
          key={`hierarchy-${activeSceneIndex}-${currentScene?.boxes?.length || 0}`}
        />
      )}
     
      <SceneSetup
        ref={sceneSetupRef}
        onAvatarConfigDone={handleAvatarConfigDone}
        messages={messages}
        setMessages={setMessages}
        participantNames={participantNames}
        avatarUrls={currentAvatarUrls}
        avatarRefs={avatarRefs}
        scenes={scenes}
        setScenes={setScenes}
        activeSceneIndex={activeSceneIndex !== -1 ? activeSceneIndex : localActiveSceneIndex}
        setActiveSceneIndex={handleActiveSceneIndexChange}
        selectedBoxId={selectedBoxId}
        setSelectedBoxId={setSelectedBoxId}
        showInitialModal={showInitialModal}
        setShowInitialModal={setShowInitialModal}
        className="flex-1"
        avatarInstancesRef={avatarInstancesRef}
      />
      {loading && <div className="loading-message">{loading}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default AvatarPanel;