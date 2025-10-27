import { useState, useEffect, useRef } from 'react';
import './TalkingHead.css';
import Header from './Header';
import PanelHeader from './ui/PanelHeader';
import DraggableScenes from './inspector/DraggableScenes';
import SelectionBar from './topic/SelectionBar';
import ContentLibrary from './topic/ContentLibrary';
import SceneViewer from './scene/SceneViewer';
import PreviewPanel from './preview/PreviewPanel';
import NodeEditor from './nodeeditor/NodeEditor';
import VerificationPlayer from './verification/VerificationPlayer';
import useEditorStore from './inspector/store';
import { exportToVerificationData, exportToVerificationWithTTS } from './nodeeditor/utils/NodeEditorUtils';
import NavigationPanel from './topic/NavigationPanel.tsx';
import { generateModelThumbnailCache } from './avatarconfig/utils/modelThumbnailGenerator';
import AvatarConfigPanel from './avatarconfig/AvatarConfigPanel';
import Inspector from './inspector/Inspector';
import ExperienceMode from './experience/ExperienceMode';
import { setupSceneEventListeners, setupEditorScenesUpdateListener } from './events/SceneEventHandler';
import API_CONFIG from '@/config';

// Gender mapping for names
const nameGenderMap = {
  'Alice': 'female',
  'Bob': 'male',
  'David': 'male',
  'Eve': 'female',
  'Grace': 'female',
  'Henry': 'male',
  'Ivy': 'female',
  'Jane':  'famale',
  'Participant 1': 'female',
  'Participant 2': 'male',
  'Participant 3': 'female',
  'Participant 4': 'male',
  'Participant 5': 'female',
  'Participant 6': 'male',
  'Participant 7': 'female',
  'Participant 8': 'male',
  'Participant 9': 'female',
  'Participant 10': 'male'
};

// Fixed Avatar URL paths by name (gender-consistent)
const nameAvatarMap = {
  'Alice': '/assets/female-avatar1.glb',
  'Bob': '/assets/male-avatar1.glb',
  'David': '/assets/male-avatar3.glb',
  'Eve': '/assets/female-avatar2.glb',
  'Grace': '/assets/female-avatar3.glb',
  'Henry': '/assets/male-avatar5.glb',
  'Ivy': '/assets/female-avatar4.glb',
  'Jane': '/assets/female-avatar5.glb',
};

// Default names by gender
const defaultNames = {
  male: ['Bob',  'David', 'Henry'],
  female: ['Alice', 'Grace', 'Ivy', 'Jane']
};

// Function to get next available default name
const getNextDefaultName = (currentParticipants, gender) => {
  const usedNames = new Set(currentParticipants);
  return defaultNames[gender].find(name => !usedNames.has(name)) || 
         `${gender === 'male' ? 'M' : 'F'}-Participant-${currentParticipants.length + 1}`;
};

// Function to determine gender from avatar URL
const getGenderFromAvatarUrl = (url) => {
  return url.includes('female-avatar') ? 'female' : 'male';
};

const TalkingHeadComponent = () => {
  const [showPreview, setShowPreview] = useState(false);
  const [mode, setMode] = useState('authoring');
  const [showAvatarPanel, setShowAvatarPanel] = useState(true);
  const [editAvatar, setEditAvatar] = useState(true);
  const [editAgent, setEditAgent] = useState(true);
  const [showConversationPanel, setShowConversationPanel] = useState(true);
  const [editConversation, setEditConversation] = useState(true);
  const [showTopicPanel, setShowTopicPanel] = useState(true);
  const [editTopic, setEditTopic] = useState(true);
  const [showPanelManager, setShowPanelManager] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentTopic, setCurrentTopic] = useState('');
  const [showSceneView, setShowSceneView] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const { conversationMode, setConversationMode } = useEditorStore();
  
  // Add state for AudioTimeline data
  const [audioSegments, setAudioSegments] = useState([]);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  
  const [avatarUrls, setAvatarUrls] = useState([]);
  const [thumbnails, setThumbnails] = useState({});
  const [loadingThumbnails, setLoadingThumbnails] = useState(new Set());
  const [isExportingVerification, setIsExportingVerification] = useState(false);

  // Ref for tracking avatar instances for both AvatarConfig and NodeEditor
  const avatarInstancesRef = useRef({});

  // Get current scene from editor store
  const { scenes, activeSceneId, setActiveSceneId, setScenes: storeSetScenes } = useEditorStore();
  const currentScene = scenes.find(scene => scene.id === activeSceneId);

  // Initialize preview by default
  const [previewInitialized, setPreviewInitialized] = useState(true);

  // Modify the effect to handle only the topic and panel visibility
  useEffect(() => {
    if (messages.length > 0 && messages.some(msg => msg.content || msg.message)) {
      setEditTopic(false);
      // Show preview and hide library when messages are added
      setShowPreview(true);
      setEditAgent(false);
    }
  }, [messages]);

  // Function to register avatar instances
  const registerAvatarInstance = (id, instance) => {
    console.log(`Registering avatar instance: ${id}`);
    avatarInstancesRef.current[id] = instance;
  };

  // Function to remove avatar instances
  const removeAvatarInstance = (id) => {
    console.log(`Removing avatar instance: ${id}`);
    if (avatarInstancesRef.current[id]) {
      delete avatarInstancesRef.current[id];
    }
  };

  const handleTopicChange = (topic) => {
    setCurrentTopic(topic);
    
    // Update localStorage and dispatch events
    try {
      const savedData = localStorage.getItem('aiPanelData') || '{}';
      const parsedData = JSON.parse(savedData);
      parsedData.discussionTopic = topic;
      localStorage.setItem('aiPanelData', JSON.stringify(parsedData));
      
      // Dispatch events to notify other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'aiPanelData',
        newValue: JSON.stringify(parsedData),
        storageArea: localStorage
      }));
      
      window.dispatchEvent(new Event('topicChanged'));
    } catch (error) {
      console.error('Error updating topic in localStorage:', error);
    }
  };

  // Function to update the AvatarPanel with selected names and avatar URLs
  const updateAvatarPanel = (names, urls) => {
    console.log("Updating AvatarPanel with:", { names, urls });
    setSelectedParticipants(names);
    setAvatarUrls(urls);
  };
  
  const avatarContainerRef = useRef(null);

  // Effect to sync scenes from store to components
  useEffect(() => {
    // Only log on significant changes to avoid loops
    if (scenes && scenes.length > 0) {
      console.log("Scenes in TalkingHeadComponent:", scenes.length);
    }
  }, [scenes.length]); // Only trigger on length changes, not the entire scenes array

  // Setup event listeners for scene updates
  useEffect(() => {
    const cleanupScenesListener = setupEditorScenesUpdateListener(storeSetScenes, setActiveSceneId);
    return cleanupScenesListener;
  }, [storeSetScenes, setActiveSceneId]);

  // Setup event listeners for showing scenes in editor
  useEffect(() => {
    const cleanupEventListener = setupSceneEventListeners(
      setMode,
      setShowAvatarPanel,
      setEditAvatar,
      setShowSceneView,
      setShowTopicPanel,
      setShowPreview,
      setActiveSceneId,
      scenes
    );
    return cleanupEventListener;
  }, [setActiveSceneId, scenes]);

  // Reset scene view when switching to edit avatar mode
  useEffect(() => {
    if (editAvatar) {
      setShowSceneView(false);
    }
  }, [editAvatar]);

  // Entering other modes than authorizing, the showtopicpanel is set to false
  useEffect(() => {
    if (mode === 'authoring') {
      setShowTopicPanel(true);
      setShowPreview(false);
    } else if (mode === 'experience') {
      setShowTopicPanel(false);
      setShowPreview(false);
      setShowSceneView(false);
    } else if (mode === 'verification') {
      setShowTopicPanel(false);
      setShowPreview(true);
      setShowSceneView(false);
    }
  }, [mode]);

  // Add a new effect to handle mutual exclusivity between preview and library
  useEffect(() => {
    if (showPreview && editAgent) {
      // If both are somehow true, prioritize the most recent change
      const lastChanged = localStorage.getItem('lastPanelChange');
      if (lastChanged === 'preview') {
        setEditAgent(false);
      } else {
        setShowPreview(false);
      }
    }
  }, [showPreview, editAgent]);

  // Update handlers to track which panel was last changed
  const handlePreviewToggle = (show) => {
    setShowPreview(show);
    if (show) {
      localStorage.setItem('lastPanelChange', 'preview');
      setEditAgent(false);
    }
  };

  const handleLibraryToggle = (show) => {
    setEditAgent(show);
    if (show) {
      localStorage.setItem('lastPanelChange', 'library');
      setShowPreview(false);
    }
  };

  const togglePreview = () => setShowPreview(!showPreview);
  const toggleAvatarPanel = () => setShowAvatarPanel(!showAvatarPanel);
  const toggleConversationPanel = () => setShowConversationPanel(!showConversationPanel);
  const toggleTopicPanel = () => setShowTopicPanel(!showTopicPanel);
  const togglePanelManager = () => setShowPanelManager(!showPanelManager);

  // Function to assign fixed avatars based on names
  const assignFixedAvatars = (selectedNames) => {
    return selectedNames.map(name => nameAvatarMap[name] || '/assets/default-avatar.glb');
  };

  // Function to generate a single thumbnail
  const generateThumbnail = async (url, index) => {
    try {
      setLoadingThumbnails(prev => new Set([...prev, index]));
      const thumbnailCache = await generateModelThumbnailCache([url]);
      setThumbnails(prev => ({
        ...prev,
        [index]: Object.values(thumbnailCache)[0]
      }));
    } catch (error) {
      console.error(`Failed to generate thumbnail for index ${index}:`, error);
    } finally {
      setLoadingThumbnails(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  // Update handleParticipantsSelected to handle gender-based names
  const handleParticipantsSelected = (participants) => {
    const prevLength = selectedParticipants.length;
    
    // If adding a new participant, assign a gender-appropriate name
    if (participants.length > prevLength) {
      const newParticipants = [...participants];
      const lastIndex = participants.length - 1;
      const defaultAvatarUrl = participants.length % 2 === 0 ? 
        '/assets/male-avatar1.glb' : 
        '/assets/female-avatar1.glb';
      
      // Determine gender from avatar URL
      const gender = getGenderFromAvatarUrl(defaultAvatarUrl);
      // Get next available default name
      const defaultName = getNextDefaultName(selectedParticipants, gender);
      newParticipants[lastIndex] = defaultName;
      
      setSelectedParticipants(newParticipants);
      
      // Get avatar URLs with the default avatar for the new participant
      const avatarUrls = assignFixedAvatars(newParticipants);
      setAvatarUrls(avatarUrls);
      
      // Generate thumbnail for new avatar
      generateThumbnail(avatarUrls[lastIndex], lastIndex);
      
      // Initialize messages with updated settings
      const initialMessages = newParticipants.map((name, index) => ({
        participant: name,
        content: '',
        avatarConfig: {
          name: name,
          url: avatarUrls[index],
          settings: {
            ttsLang: 'en-GB',
            lipsyncLang: 'en',
            body: getGenderFromAvatarUrl(avatarUrls[index]) === 'male' ? 'M' : 'F',
            cameraView: 'upper',
            cameraDistance: 1.2
          },
          voice: getGenderFromAvatarUrl(avatarUrls[index]) === 'male' ? 
            'en-GB-Standard-B' : 'en-GB-Standard-A'
        }
      }));
      setMessages(initialMessages);
    } else {
      // Handling participant removal
      setSelectedParticipants(participants);
      const avatarUrls = assignFixedAvatars(participants);
      setAvatarUrls(avatarUrls);
      
      // Clean up thumbnails for removed participants
      if (participants.length < prevLength) {
        setThumbnails(prev => {
          const newThumbnails = { ...prev };
          for (let i = participants.length; i < prevLength; i++) {
            delete newThumbnails[i];
          }
          return newThumbnails;
        });
        setLoadingThumbnails(prev => {
          const next = new Set(prev);
          for (let i = participants.length; i < prevLength; i++) {
            next.delete(i);
          }
          return next;
        });
      }
      
      // Update messages for remaining participants
      const updatedMessages = participants.map((name, index) => ({
        participant: name,
        content: '',
        avatarConfig: {
          name: name,
          url: avatarUrls[index],
          settings: {
            ttsLang: 'en-GB',
            lipsyncLang: 'en',
            body: getGenderFromAvatarUrl(avatarUrls[index]) === 'male' ? 'M' : 'F',
            cameraView: 'upper',
            cameraDistance: 1.2
          },
          voice: getGenderFromAvatarUrl(avatarUrls[index]) === 'male' ? 
            'en-GB-Standard-B' : 'en-GB-Standard-A'
        }
      }));
      setMessages(updatedMessages);
    }
    
    setEditAvatar(true);
    setShowAvatarPanel(true);
    setShowSceneView(false);
  };

  // Ensure avatar container is ready
  useEffect(() => {
    if (editAvatar && showAvatarPanel) {
      const containerId = 'avatar-container-config-preview-1741388759802';
      if (!document.getElementById(containerId)) {
        const container = document.createElement('div');
        container.id = containerId;
        if (avatarContainerRef.current) {
          avatarContainerRef.current.appendChild(container);
        }
      }
    }
  }, [editAvatar, showAvatarPanel]);

  // Handler for seeking in the timeline
  const handleSeek = (time) => {
    setCurrentPlaybackTime(time);
    // Pass to NodeEditor through ref if needed
    if (window.nodeEditorRef && window.nodeEditorRef.current && 
        typeof window.nodeEditorRef.current.handleSeek === 'function') {
      window.nodeEditorRef.current.handleSeek(time);
    }
  };

  // Function to update audio timeline data from NodeEditor
  const updateAudioTimelineData = (data) => {
    const { segments, playbackTime, playing, duration } = data;
    if (segments) setAudioSegments(segments);
    if (playbackTime !== undefined) setCurrentPlaybackTime(playbackTime);
    if (playing !== undefined) setIsPlaying(playing);
    if (duration) setTotalDuration(duration);
  };

  // Set up a ref for NodeEditor to call methods from TalkingHeadComponent
  useEffect(() => {
    // Create global ref for NodeEditor to access
    window.talkingHeadRef = {
      updateAudioTimelineData
    };
    
    return () => {
      // Clean up ref when component unmounts
      window.talkingHeadRef = null;
    };
  }, []);

  // Add state for export progress indicator
  const [showProgressIndicator, setShowProgressIndicator] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  // Add state for impromptu phase approval
  const [pendingImpromptuMessage, setPendingImpromptuMessage] = useState(null);
  const [isImpromptuPaused, setIsImpromptuPaused] = useState(false);

  // Add a ref to track recent rejection
  const recentRejectionRef = useRef(false);
  const rejectionCooldownTimeoutRef = useRef(null);

  // Add handlers for export dialog
  const handleExport = async () => {
    setShowProgressIndicator(true);
    setProgressMessage('Preparing data for export...');
    setIsExportingVerification(true);

    // Remove all existing verification data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('verification-data-')) {
        try {
          localStorage.removeItem(key);
        } catch (err) {
          console.error(`Error removing verification data from ${key}:`, err);
        }
      }
    }

    // Get all nodes from store that might have audio segments
    const editorState = useEditorStore.getState();
    const { nodes } = editorState;
    
    let shouldGenerateTTS = false;
    if (nodes.length > 0) {
       // Ask user if they want to generate TTS audio
       shouldGenerateTTS = window.confirm(
        "Do you want to generate TTS audio for this conversation? " +
        "This will create audio files based on each avatar's voice settings. " +
        "\n\nClick OK to generate audio, or Cancel to export without audio."
      );
    }

    try {
      const parsedPlayedNodes = JSON.parse(localStorage.getItem('played-nodes'));
      const playedNodes = nodes.filter(node => parsedPlayedNodes.some(playedNode => playedNode.nodeId === node.id));

      if (playedNodes.length === 0) {
        setIsExportingVerification(false);
        setShowExportDialog(false);
        setShowProgressIndicator(false);
        return;
      }

      setProgressMessage('Processing audio data...');

      for (const node of playedNodes) {
        const totalDuration = node.totalDuration;
        const segmentsToExport = node.audioSegments;

        if (!segmentsToExport || segmentsToExport.length === 0) {
          console.log('No audio segments available to export. Please play a conversation first.');
          continue;
        }

        if (shouldGenerateTTS) {
          setProgressMessage('Generating TTS audio...');
          try {
            // Collect voice settings from avatar instances
            const avatarVoicesMap = new Map();
            
            if (avatarInstancesRef && avatarInstancesRef.current) {
              segmentsToExport.forEach(segment => {
                // Skip if already processed this avatar or if avatarId is missing
                if (!segment.avatarId || avatarVoicesMap.has(segment.avatarId)) {
                  return;
                }
                
                // Get avatar instance
                const instance = avatarInstancesRef.current[segment.avatarId];
                
                if (instance) {
                  // Extract voice settings
                  const voiceSettings = {
                    name: instance.avatar?.ttsVoice || instance.opt?.ttsVoice || "en-US-Neural2-F",
                    languageCode: instance.avatar?.ttsLang || instance.opt?.ttsLang || "en-US",
                    rate: instance.avatar?.ttsRate || instance.opt?.ttsRate || 1.5,
                    pitch: instance.avatar?.ttsPitch || instance.opt?.ttsPitch || 0
                  };
                  
                  avatarVoicesMap.set(segment.avatarId, voiceSettings);
                }
              });
            }
    
            setProgressMessage('Processing audio data with TTS...');
            // Call exportToVerificationWithTTS
            const result = await exportToVerificationWithTTS(
              segmentsToExport,
              totalDuration,
              avatarVoicesMap
            );
            console.log('exportToVerificationWithTTS result', result);

            if (result.data) {
              setProgressMessage('Saving verification data...');
              result.data.nodeId = node.id;
              localStorage.setItem(`verification-data-${node.id}`, JSON.stringify(result.data));
              console.log('Successfully exported with TTS audio');
            }
          } catch (error) {
            console.error('Error during TTS export:', error);
            setProgressMessage('Falling back to regular export...');
            
            // Fallback to regular export without audio
            try {
              const verificationData = await exportToVerificationData(segmentsToExport, totalDuration);
              if (verificationData) {
                verificationData.nodeId = node.id;
                localStorage.setItem(`verification-data-${node.id}`, JSON.stringify(verificationData));
              }
            } catch (fallbackError) {
              console.error('Error during fallback export:', fallbackError);
            }
          }
        } else {
          // Regular export without TTS
          setProgressMessage('Processing verification data without TTS...');
          try {
            const verificationData = await exportToVerificationData(segmentsToExport, totalDuration);
            if (verificationData) {
              verificationData.nodeId = node.id;
              localStorage.setItem(`verification-data-${node.id}`, JSON.stringify(verificationData));
            }
          } catch (error) {
            console.error('Error during regular export:', error);
          }
        }
      }
      
      setProgressMessage('Export complete. Switching to verification mode...');
      // Set a small timeout to let users see the completion message
      setTimeout(() => {
        // Switch to verification mode after processing is complete
        setMode('verification');
        setIsExportingVerification(false);
        setShowExportDialog(false);
        setShowProgressIndicator(false);
      }, 1000);
    } catch (error) {
      console.error('Error during export process:', error);
      setIsExportingVerification(false);
      setShowExportDialog(false);
      setShowProgressIndicator(false);
    }
  };

  const handleDeclineExport = () => {
    setShowExportDialog(false);
  };

  // Handle impromptu phase approval
  const handleApproveImpromptu = async (message, editedContent) => {
    try {
      // Check if this message has been edited
      const currentContent = message.content || message.message || '';
      const finalContent = editedContent || currentContent;
      const hasEdited = editedContent && editedContent !== currentContent;
      
      if (hasEdited) {
        console.log('Approving impromptu phase with edited content:', finalContent.substring(0, 30) + '...');
      } else {
        console.log('Approving impromptu phase with original content');
      }
      
      // Send approval to server via HTTP POST
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.IMPROMPTU_APPROVE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ editedContent: finalContent })
      });

      if (!response.ok) {
        throw new Error('Failed to approve impromptu phase');
      }

      // Update local message state immediately
      const updatedMessage = { 
        ...message, 
        needsApproval: false,
        isApproved: true,
        content: finalContent,
        message: finalContent 
      };
      setMessages(prevMessages => 
        prevMessages.map(m => 
          m === message ? updatedMessage : m
        )
      );
      setPendingImpromptuMessage(null);
      setIsImpromptuPaused(false);

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            if (data.type === 'message') {
              // Add new message to the conversation
              setMessages(prevMessages => [...prevMessages, data.message]);
            } else if (data.type === 'completion') {
              console.log('Conversation completed after impromptu phase approval');
            } else if (data.type === 'error') {
              console.error('Error in impromptu phase:', data.error);
            } else if (data.type === 'reset_approval_state') {
              console.log('Resetting approval state in client');
              // Explicitly reset the approval state flags
              setPendingImpromptuMessage(null);
              setIsImpromptuPaused(false);
            }
          } catch (error) {
            console.error('Error parsing server message:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error approving impromptu phase:', error);
    }
  };

  // Handle rejection of impromptu phase
  const handleRejectImpromptu = async (message) => {
    try {
      // Set the recent rejection flag
      recentRejectionRef.current = true;
      
      // Clear any existing timeout
      if (rejectionCooldownTimeoutRef.current) {
        clearTimeout(rejectionCooldownTimeoutRef.current);
      }
      
      // Set a cooldown period of 2 seconds (reduced from 5) to prevent immediate detection
      rejectionCooldownTimeoutRef.current = setTimeout(() => {
        recentRejectionRef.current = false;
        console.log('Rejection cooldown period ended, re-enabling impromptu detection');
      }, 2000);

      // Immediately remove the derailing message and any associated system messages
      setMessages(prevMessages => 
        prevMessages.filter(m => 
          m !== message && 
          !(m.isSystemMessage && 
            (m.content?.includes('started an impromptu discussion phase') || 
             m.content?.includes('impromptu discussion phase has ended')))
        )
      );
      
      // Reset impromptu state in the UI
      setPendingImpromptuMessage(null);
      setIsImpromptuPaused(false);
      
      console.log('Rejected impromptu phase, sending rejection to server');

      // Send rejection to server via HTTP POST
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.IMPROMPTU_REJECT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}) // Empty object since no parameters needed
      });

      if (!response.ok) {
        throw new Error('Failed to reject impromptu phase');
      }

      // Handle streaming response from server
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      console.log('Processing response from impromptu rejection');
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            if (data.type === 'message') {
              // Add new message to the conversation
              console.log('Received new message after rejection:', data.message);
              setMessages(prevMessages => [...prevMessages, data.message]);
            } else if (data.type === 'completion') {
              console.log('Conversation continued after impromptu phase rejection');
            } else if (data.type === 'error') {
              console.error('Error after impromptu phase rejection:', data.error);
            } else if (data.type === 'reset_approval_state') {
              console.log('Resetting approval state in client after rejection');
              // Explicitly reset the approval state flags
              setPendingImpromptuMessage(null);
              setIsImpromptuPaused(false);
              // Clear the rejection cooldown immediately to allow new impromptu phases
              recentRejectionRef.current = false;
              if (rejectionCooldownTimeoutRef.current) {
                clearTimeout(rejectionCooldownTimeoutRef.current);
              }
            }
          } catch (error) {
            console.error('Error parsing server message:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error rejecting impromptu phase:', error);
      // Ensure flags are reset even if there's an error
      setPendingImpromptuMessage(null);
      setIsImpromptuPaused(false);
      recentRejectionRef.current = false;
      if (rejectionCooldownTimeoutRef.current) {
        clearTimeout(rejectionCooldownTimeoutRef.current);
      }
    }
  };

  // Handle editing impromptu message content
  const handleEditImpromptu = async (messageContent) => {
    try {
      console.log('Editing impromptu message content:', messageContent.substring(0, 30) + '...');
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.IMPROMPTU_EDIT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageContent }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to edit message:', errorData.error);
        return;
      }
      
      // Update the message in our local state
      if (pendingImpromptuMessage) {
        const updatedMessage = {
          ...pendingImpromptuMessage,
          content: messageContent,
          message: messageContent
        };
        setPendingImpromptuMessage(updatedMessage);
        
        // Also update the message in the messages array
        setMessages(prevMessages => 
          prevMessages.map(m => 
            (m.needsApproval && m.isDerailing) ? 
              { ...m, content: messageContent, message: messageContent } : 
              m
          )
        );
      }
      
      console.log('Successfully edited impromptu message');
    } catch (error) {
      console.error('Error editing impromptu message:', error);
    }
  };

  // Handle regenerating an impromptu message with a new derail mode
  const handleRegenerateImpromptuWithMode = async (mode) => {
    try {
      console.log(`Regenerating impromptu message with mode: ${mode}`);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.IMPROMPTU_REGENERATE_WITH_MODE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate impromptu message');
      }

      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'regenerated_message' && data.message) {
              console.log('Received regenerated message:', data.message);
              
              // Update the pending impromptu message in state
              setPendingImpromptuMessage(data.message);
              
              // Also update the message in the messages array
              setMessages(prevMessages => 
                prevMessages.map(m => 
                  (m.needsApproval && m.isDerailing) ? data.message : m
                )
              );
            } else if (data.type === 'error') {
              console.error('Error from server:', data.error);
              // Could show an error notification here
            }
          } catch (error) {
            console.error('Error processing chunk:', error);
          }
        }
      }

      console.log('Successfully regenerated impromptu message with mode:', mode);
      return true;
    } catch (error) {
      console.error('Error regenerating impromptu message:', error);
      return false;
    }
  };

  // Modify message handling to check for impromptu phase
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Skip detection if we're in the cooldown period after a recent rejection
      if (recentRejectionRef.current) {
        console.log('Skipping impromptu detection - in post-rejection cooldown period');
        return;
      }
      
      // Check for new derailing messages that need approval
      // Look for messages that either:
      // 1. Have isDerailing=true and needsApproval=true (sent directly from server)
      // 2. Have isDerailing=true but not yet marked as needing approval (legacy pattern)
      if ((lastMessage.isDerailing && lastMessage.needsApproval) || 
          (lastMessage.isDerailing && !lastMessage.needsApproval && !lastMessage.isApproved && !pendingImpromptuMessage)) {
        
        console.log('Detected derailing message that needs approval:', lastMessage);
        
        // If the message already has needsApproval=true (from server), just set the pending state
        if (lastMessage.needsApproval) {
          setPendingImpromptuMessage(lastMessage);
          setIsImpromptuPaused(true);
        } else {
          // For messages not yet marked with needsApproval, add the flag (legacy pattern)
          const messageWithApproval = { ...lastMessage, needsApproval: true };
          setMessages(prevMessages => 
            prevMessages.map(m => 
              m === lastMessage ? messageWithApproval : m
            )
          );
          setPendingImpromptuMessage(messageWithApproval);
          setIsImpromptuPaused(true);
        }
      }
      
      // Check if this is a system message that marks the end of an impromptu phase
      if (lastMessage.isSystemMessage && lastMessage.isEndingPhase) {
        console.log('Impromptu phase ended, resetting client state');
        // Reset the approval state to ensure clean state for the next phase
        setPendingImpromptuMessage(null);
        setIsImpromptuPaused(false);
      }
    }
  }, [messages, pendingImpromptuMessage]);

  // Update handleConversationModeChange to use the store
  const handleConversationModeChange = async (newMode) => {
    try {
      // Update store
      setConversationMode(newMode);
      
      // Send mode change to server
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONVERSATION_MODE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: newMode })
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation mode');
      }

      // If switching to autonomous mode, automatically approve any pending impromptu phases
      if (newMode === 'autonomous' && messages.some(m => m.needsApproval)) {
        handleApproveImpromptu(messages.find(m => m.needsApproval));
      }
    } catch (error) {
      console.error('Error changing conversation mode:', error);
      // Revert to previous mode on error
      setConversationMode(conversationMode);
    }
  };

  return (
    <>
      <Header mode={mode} setMode={setMode} onOpenKeys={() => {
        const event = new CustomEvent('open-api-key-modal');
        window.dispatchEvent(event);
      }} />
      <div className="app-container theme-bg-primary">
        {/* Full screen progress indicator */}
        {showProgressIndicator && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1100]">
            <div className="bg-white/20 backdrop-blur-sm p-8 rounded-lg shadow-lg text-center max-w-md">
              <div className="mb-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
              <h3 className="text-xl font-semibold mb-2">Processing</h3>
              <p className="text-gray-600">{progressMessage}</p>
            </div>
          </div>
        )}

        {showTopicPanel && (
          <div className="max-w-[300px] w-[300px] h-full">
            {editAgent && (
              <>
                <PanelHeader 
                  title="Avatar Library"
                  isEditing={editAgent}
                  onToggleEdit={() => handleLibraryToggle(!editAgent)}
                  rightContent={
                    <div className="flex items-center gap-2">
                      {/* Participant controls */}
                      <div className="flex items-center gap-1 mr-2">
                        <button
                          className="p-1 rounded hover:bg-gray-200 text-gray-600"
                          onClick={() => {
                            const newCount = Math.max(2, selectedParticipants.length - 1);
                            // Keep only the first N participants
                            const newParticipants = selectedParticipants.slice(0, newCount);
                            handleParticipantsSelected(newParticipants);
                          }}
                          title="Remove Participant"
                          disabled={selectedParticipants.length <= 2}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                        </button>
                        <span className="text-xs text-gray-600">{selectedParticipants.length}</span>
                        <button
                          className="p-1 rounded hover:bg-gray-200 text-gray-600"
                          onClick={() => {
                            // Get the next available name from the predefined list
                            const availableMaleNames = defaultNames.male.filter(name => !selectedParticipants.includes(name));
                            const availableFemaleNames = defaultNames.female.filter(name => !selectedParticipants.includes(name));
                            
                            // Alternate between male and female names
                            const isMaleTurn = selectedParticipants.length % 2 === 1;
                            const availableNames = isMaleTurn ? availableMaleNames : availableFemaleNames;
                            
                            if (availableNames.length > 0) {
                              const nextName = availableNames[0];
                              const newParticipants = [...selectedParticipants, nextName];
                              handleParticipantsSelected(newParticipants);
                            }
                          }}
                          title="Add Participant"
                          disabled={selectedParticipants.length >= 10}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Human toggle dropdown */}
                      <div className="relative group">
                        <button 
                          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
                          title="Set Human Participants"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          <span>Human</span>
                        </button>
                        
                        {/* Dropdown menu */}
                        <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white rounded shadow-lg p-2 border border-gray-200 hidden group-hover:block">
                          <div className="text-xs text-gray-600 font-medium mb-1 pb-1 border-b">
                            Select Human Participants:
                          </div>
                          {selectedParticipants.length > 0 ? (
                            <div className="max-h-48 overflow-y-auto">
                              {selectedParticipants.map((name, i) => {
                                // Check if this participant is human from localStorage
                                const savedData = localStorage.getItem('aiPanelData');
                                const isHuman = savedData ? 
                                  JSON.parse(savedData)?.humanParticipants?.includes(name) : 
                                  false;
                                
                                return (
                                  <div 
                                    key={i} 
                                    className="flex items-center gap-1 py-1 px-1 hover:bg-gray-100 rounded cursor-pointer"
                                    onClick={() => {
                                      // Toggle human status
                                      const savedData = localStorage.getItem('aiPanelData') || '{}';
                                      const parsedData = JSON.parse(savedData);
                                      let humanParticipants = parsedData.humanParticipants || [];
                                      
                                      if (humanParticipants.includes(name)) {
                                        // Remove from humans
                                        humanParticipants = humanParticipants.filter(p => p !== name);
                                      } else {
                                        // Add to humans
                                        humanParticipants.push(name);
                                      }
                                      
                                      // Update localStorage
                                      parsedData.humanParticipants = humanParticipants;
                                      localStorage.setItem('aiPanelData', JSON.stringify(parsedData));
                                      
                                      // Dispatch events to update other components
                                      window.dispatchEvent(new Event('humanParticipantsChanged'));
                                      window.dispatchEvent(new StorageEvent('storage', {
                                        key: 'aiPanelData',
                                        newValue: JSON.stringify(parsedData),
                                        storageArea: localStorage
                                      }));
                                    }}
                                  >
                                    <input 
                                      type="checkbox" 
                                      checked={isHuman}
                                      readOnly
                                      className="rounded" 
                                    />
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      nameGenderMap[name] === 'male' ? 'bg-blue-500' : 'bg-pink-500'
                                    }`}></span>
                                    <span>{name}</span>
                                    {isHuman && (
                                      <span className="ml-auto text-green-500 text-xs">(Human)</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 italic py-1">
                              No participants available
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  }
                />
                {/* Create a flex container to allow percentage heights to work properly */}
                <div className="flex flex-col h-full">
                  <div className="h-[30%] mb-2">
                    <SelectionBar
                      avatarUrls={avatarUrls}
                      participantNames={selectedParticipants}
                      currentScene={currentScene}
                      handleParticipantsSelected={handleParticipantsSelected}
                    />
                  </div>
                  
                  {/* Content Library for drag-and-drop PDF content */}
                  <div className="h-[15%] mb-2">
                    <PanelHeader 
                      title="Content Library"
                      isEditing={true}
                      rightContent={
                        <div className="flex items-center space-x-2">
                          <input
                            type="file"
                            id="content-upload-input"
                            className="hidden"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx,.txt"
                          />
                          <button
                            onClick={() => document.getElementById('content-upload-input').click()}
                            className="flex items-center px-2 py-1 rounded text-xs bg-blue-500 text-white hover:bg-blue-600"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 mr-1">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="17 8 12 3 7 8"></polyline>
                              <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            Upload
                          </button>
                          <span id="content-file-count" className="text-xs text-gray-500"></span>
                        </div>
                      }
                    />
                    <ContentLibrary 
                      currentScene={currentScene}
                      fileInputId="content-upload-input"
                    />
                  </div>
                  
                  {/* Add DraggableScenes component */}
                  <div className="h-[43%]">
                    <DraggableScenes />
                  </div>
                </div>
              </>
            )}

            {/* Keep PreviewPanel mounted once initialized */}
            {previewInitialized && (
              <div>
                <PanelHeader 
                  title="Preview Panel"
                  isEditing={showPreview}
                  onToggleEdit={() => handlePreviewToggle(!showPreview)}
                />
                <PreviewPanel 
                  onClose={() => handlePreviewToggle(false)}
                  messages={messages}
                  audioSegments={audioSegments}
                  currentPlaybackTime={currentPlaybackTime}
                  isPlaying={isPlaying}
                  totalDuration={totalDuration}
                  onSeek={handleSeek}
                  avatarInstancesRef={avatarInstancesRef}
                  showExportDialog={showExportDialog}
                  onExport={handleExport}
                  onDeclineExport={handleDeclineExport}
                  onApproveImpromptu={handleApproveImpromptu}
                  onRejectImpromptu={handleRejectImpromptu}
                  onEditImpromptu={handleEditImpromptu}
                  onRegenerateImpromptuWithMode={handleRegenerateImpromptuWithMode}
                  conversationMode={conversationMode}
                  onModeChange={handleConversationModeChange}
                />
              </div>
            )}

            {/* Panel Navigation */}
            <NavigationPanel
              editAgent={editAgent}
              showPreview={showPreview}
              previewInitialized={previewInitialized}
              setEditAgent={handleLibraryToggle}
              setShowPreview={handlePreviewToggle}
              selectedParticipants={selectedParticipants}
              handleParticipantsSelected={handleParticipantsSelected}
              currentTopic={currentTopic}
              editTopic={editTopic}
              setEditTopic={setEditTopic}
              handleTopicChange={handleTopicChange}
              thumbnails={thumbnails}
              loadingThumbnails={loadingThumbnails}
              nameGenderMap={nameGenderMap}
              updateAvatarPanel={updateAvatarPanel}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="main-content">
          {mode === 'authoring' ? (
            <>
              {showAvatarPanel && (
                <div>
                  <PanelHeader 
                    title={showSceneView ? 'Scene Viewer' : 'Scene Panel'}
                    isEditing={editAvatar || showSceneView}
                    onToggleEdit={() => {
                      if (showSceneView) {
                        setShowSceneView(false);
                        setEditAvatar(true);
                      } else {
                        setEditAvatar(!editAvatar);
                      }
                    }}
                    rightContent={showSceneView && (
                      <button 
                        className="edit-btn bg-blue-500 hover:bg-blue-600 text-white mr-2 text-xs px-2"
                        onClick={() => {
                          setShowSceneView(false);
                          setEditAvatar(true);
                        }}
                      >
                        Edit Scene
                      </button>
                    )}
                  />
                  <div ref={avatarContainerRef} className="w-full h-full">
                    {showSceneView ? (
                      <SceneViewer 
                        currentScene={currentScene} 
                        avatarInstancesRef={avatarInstancesRef}
                        registerAvatarInstance={registerAvatarInstance}
                        removeAvatarInstance={removeAvatarInstance}
                      />
                    ) : editAvatar ? (
                      <AvatarConfigPanel 
                        messages={messages} 
                        setMessages={setMessages}
                        participantNames={selectedParticipants}
                        onAvatarChange={(updatedMessages) => setMessages(updatedMessages)}
                        avatarUrls={avatarUrls}
                        scenes={scenes}
                        setScenes={storeSetScenes}
                        activeSceneId={activeSceneId}
                        setActiveSceneId={setActiveSceneId}
                        avatarInstancesRef={avatarInstancesRef}
                        registerAvatarInstance={registerAvatarInstance}
                        removeAvatarInstance={removeAvatarInstance}
                      />
                    ) : (
                      <div></div>
                    )}
                  </div>
                </div>
              )}
              
              {showConversationPanel && (
                <div>
                  <PanelHeader 
                    title="Conversation Panel"
                    isEditing={editConversation}
                    onToggleEdit={() => setEditConversation(!editConversation)}
                    rightContent={
                      <div className="flex items-center gap-2">
                        {editTopic ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={currentTopic}
                              onChange={(e) => handleTopicChange(e.target.value)}
                              className="w-[240px] p-1 text-xs bg-gray-100 border border-gray-300 rounded text-gray-700"
                              placeholder="Enter conversation context..."
                            />
                            <button
                              onClick={() => setEditTopic(false)}
                              className="p-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded"
                              title="Save topic"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-gray-700">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                <polyline points="7 3 7 8 15 8"></polyline>
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-700 max-w-[240px] truncate">
                              {currentTopic || "No context set"}
                            </span>
                            <button
                              onClick={() => setEditTopic(true)}
                              className="p-1 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded"
                              title="Edit topic"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-gray-700">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    }
                  />
                  {editConversation ? (
                    <NodeEditor 
                      messages={messages} 
                      setMessages={setMessages} 
                      avatarInstancesRef={avatarInstancesRef}
                      setShowExportDialog={setShowExportDialog}
                    />
                  ) : (
                    <div className="awareness-content">[Conversation Awareness Content]</div>
                  )}
                </div>
              )}
            </>
          ) 
          : mode === 'experience' ? (
            <ExperienceMode />
          ) : mode === 'verification' ? (
            <div className="verification-mode">
              <VerificationPlayer />
            </div>
          ) : mode === 'playback' ? (
            <>
              {console.log('Rendering in playback mode - preserving current UI')}
            </>
          ) : (
            <div className="p-4 text-center">
              <p>Unknown mode: {mode}</p>
            </div>
          )}
        </div>

        {/* Inspector and ChatBox */}
        {mode === 'authoring' && <Inspector />}
      </div>
    </>
  );
};

export default TalkingHeadComponent;
