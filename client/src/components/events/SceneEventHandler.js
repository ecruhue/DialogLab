/**
 * Handle scene-related events across the application
 */
import initializeSceneAvatars from '../avatarconfig/utils/AvatarInitializer';

export const setupSceneEventListeners = (
  setMode,
  setShowAvatarPanel,
  setEditAvatar,
  setShowSceneView,
  setShowTopicPanel,
  setShowPreview,
  setActiveSceneId,
  scenes
) => {
  // Keep track of processed events to avoid duplicates
  
  // Add a new event listener for the set-edit-avatar event
  const handleSetEditAvatar = (event) => {
    console.log('Received set-edit-avatar event with value:', event.detail.value);
    setEditAvatar(!!event.detail.value); // Convert to boolean
  };
  
  const handleShowSceneInEditor = (event) => {
    console.log('Scene event received:', event.detail);
    
    // Handle mode changes
    if (event.detail.mode && !event.detail.maintainMode) {
      console.log(`Setting mode to: ${event.detail.mode}`);
      setMode(event.detail.mode);
      
      // Reset panel visibility states when entering authoring mode
      if (event.detail.mode === 'authoring') {
        setShowAvatarPanel(true);
        setShowTopicPanel(true);
        setEditAvatar(true);
        setShowSceneView(false);
        setShowPreview(false);
      }
    } else if (event.detail.maintainMode) {
      // If maintainMode is true, log it but don't change the mode
      console.log(`Maintaining current mode (${event.detail.mode || event.detail.context || 'unknown context'})`);
    }
    
    // Handle scene ID changes
    if (event.detail.sceneId) {
      console.log(`Setting active scene ID to: ${event.detail.sceneId}`);
      setActiveSceneId(event.detail.sceneId);
    }
    
    // Handle panel visibility changes
    if (event.detail.showAvatarPanel !== undefined) {
      setShowAvatarPanel(event.detail.showAvatarPanel);
    }
    if (event.detail.showTopicPanel !== undefined) {
      setShowTopicPanel(event.detail.showTopicPanel);
    }
    if (event.detail.showSceneView !== undefined) {
      setShowSceneView(event.detail.showSceneView);
    }
    if (event.detail.showPreview !== undefined) {
      setShowPreview(event.detail.showPreview);
    }
    
    // Handle edit states
    if (event.detail.editAvatar !== undefined) {
      setEditAvatar(event.detail.editAvatar);
    }
    
    // Check for maintainMode flag with context=playback even without mode
    if (event.detail.maintainMode && event.detail.context === 'playback') {
      console.log(`Maintaining current mode with context=playback`);
      
      // Make sure editAvatar is set to true for proper avatar initialization
      if (event.detail.setEditAvatar) {
        console.log('Setting editAvatar to true for context=playback with maintainMode');
        setEditAvatar(true);
      }
      
      // If initializeAvatars flag is set, initialize avatars without changing mode
      if (event.detail.initializeAvatars) {
        initializeSceneAvatars(event.detail.sceneId, scenes);
      }
      
      // Early return to avoid any mode/panel changes from the code below
      return;
    }
    
    // Check context first, then fallback to source-based determination
    if (event.detail.context === 'authoring') {
      // Stay in authoring mode when context is explicitly set to authoring
      setMode('authoring');
      setShowAvatarPanel(true);
      setShowTopicPanel(true);
      setEditAvatar(true);
      setShowSceneView(false);
      setShowPreview(false);
      console.log('Setting authoring mode based on context');
    } else if (event.detail.context === 'playback') {
      // Preserve current UI mode but initialize avatars for playback
      console.log('Scene activation for playback (preserving current panels and layout)');
      
      // Make sure editAvatar is set to true for proper avatar initialization in playback context
      if (event.detail.setEditAvatar) {
        console.log('Setting editAvatar to true for context=playback');
        setEditAvatar(true);
      }
      
      // Initialize avatars if requested
      if (event.detail.initializeAvatars) {
        initializeSceneAvatars(event.detail.sceneId, scenes);
      }
    } else if (event.detail.source === 'nodeeditor' && !event.detail.context) {
      // Only switch to experience mode when coming from nodeeditor without explicit context
      setMode('experience');
      setShowTopicPanel(false);
      setShowPreview(false);
      setShowSceneView(false);
      console.log('Setting experience mode based on nodeeditor source');
    } else if (event.detail.source === 'experience-modal') {
      // Always switch to experience mode for experience-modal source
      setMode('experience');
      setShowTopicPanel(false);
      setShowPreview(false);
      setShowSceneView(false);
      console.log('Setting experience mode based on experience-modal source');
    } else {
      // Default behavior for other sources
      console.log('Using default behavior: setting authoring mode');
      setMode('authoring');
      setShowAvatarPanel(true);
      setShowTopicPanel(true);
      setEditAvatar(true);
      setShowSceneView(false);
      setShowPreview(false);
    }
    
    // Add a toast notification if we have react-hot-toast
    try {
      const { toast } = require('react-hot-toast');
      const mode = event.detail.mode || (event.detail.context === 'authoring' ? 'Authoring' : 
        event.detail.source === 'nodeeditor' ? 'Experience' : 'Authoring');
      
      // Special message for playback mode
      if (mode.toLowerCase() === 'playback') {
        toast(`Playing scene: ${event.detail.sceneName || 'Untitled Scene'}`, {
          icon: '▶️',
          duration: 2000,
          position: 'bottom-center'
        });
      } else {
        toast(`Opening scene: ${event.detail.sceneName || 'Untitled Scene'} in ${mode} Mode`, {
          icon: mode === 'Experience' ? '🎮' : '🖼️',
          duration: 2000,
          position: 'bottom-center'
        });
      }
    } catch (error) {
      console.log('Toast notification not available');
    }
  };
  
  // Setup the event listeners
  window.addEventListener('show-scene-in-editor', handleShowSceneInEditor);
  window.addEventListener('set-edit-avatar', handleSetEditAvatar);
  
  // Return a cleanup function
  return () => {
    window.removeEventListener('show-scene-in-editor', handleShowSceneInEditor);
    window.removeEventListener('set-edit-avatar', handleSetEditAvatar);
  };
};

export const setupEditorScenesUpdateListener = (storeSetScenes, setActiveSceneId) => {
  const handleScenesUpdated = (event) => {
    console.log('Received editor-scenes-updated event:', event.detail);
    
    // Only process if this is an initiating update or from a specific source
    // This helps prevent update loops between components
    if (event.detail && event.detail.scenes && event.detail.initiator) {
      // Check if this is from the playback button - ensure we flag this for the SceneSetupModal
      const isFromPlayback = event.detail.source === 'audio-playback-adapter';
      
      // If we need to load a scene for playback, attach a custom event listener to handle it specially
      if (isFromPlayback && event.detail.activeSceneId) {
        console.log('Scene update is from playback, will use forPlayback option');
        
        // Put this info in the window so SceneSetupModal can access it
        window.lastSceneLoadIsForPlayback = true;
        
        // Clear the flag after a delay
        setTimeout(() => {
          window.lastSceneLoadIsForPlayback = false;
        }, 2000);
      }
      
      // Update scenes in the store if needed
      if (event.detail.scenes.length > 0) {
        storeSetScenes(event.detail.scenes);
      }
      
      // Set the active scene ID if provided
      if (event.detail.activeSceneId) {
        setActiveSceneId(event.detail.activeSceneId);
      }
    }
  };
  
  window.addEventListener('editor-scenes-updated', handleScenesUpdated);
  
  // Return a cleanup function
  return () => {
    window.removeEventListener('editor-scenes-updated', handleScenesUpdated);
  };
};

export default {
  setupSceneEventListeners,
  setupEditorScenesUpdateListener
}; 