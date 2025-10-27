import React, { useState, useEffect, useCallback } from 'react';
import useEditorStore from './store';
import { avatarTemplates } from '../topic/avatarTemplates';

const voiceMapByGender = {
  male: [
    { value: 'en-US-Standard-B', label: 'American Voice (M)' },
    { value: 'en-GB-Standard-B', label: 'British Voice (M)' },
    { value: 'en-GB-Standard-D', label: 'British Voice (M2)' }
  ],
  female: [
    { value: 'en-US-Standard-C', label: 'American Voice (F)' },
    { value: 'en-GB-Standard-A', label: 'British Voice (F)' }
  ]
};

// Predefined options for personality and interaction pattern
const personalityOptions = [
  "friendly",
  "professional",
  "casual",
  "formal",
  "enthusiastic",
  "reserved",
  "empathetic",
  "analytical"
];

const interactionPatternOptions = [
  "neutral",
  "supportive",
  "critical",
  "skeptical",
  "receptive",
  "agreeable"
];

const fillerWordsFrequencyOptions = [
  "none",
  "low",
  "medium",
  "high"
];

function AvatarInspector({ avatar }) {
  const { selectedItem, updateSelectedItem } = useEditorStore();

  // Add state for collapsible sections
  const [activeTab, setActiveTab] = useState('basic');

  // Add state for custom attributes
  const [customAttributes, setCustomAttributes] = useState({});
  const [attributeKey, setAttributeKey] = useState('');
  const [attributeValue, setAttributeValue] = useState('');
  
  const getDefaultVoiceByGender = (gender) => {
    const genderVoices = voiceMapByGender[gender] || voiceMapByGender.male;
    return genderVoices[0].value; // Return first voice in the list for the gender
  };
  
  // Guard against missing avatar data
  if (!avatar || !avatar.avatarConfig) {
    return (
      <div className="p-0 overflow-y-auto max-h-[calc(100vh-6rem)] theme-bg-secondary theme-text-primary">
        <div className="p-3">
          <h3 className="text-sm font-medium theme-text-primary">Avatar Properties</h3>
          <p className="text-xs theme-text-tertiary mt-2">No avatar configuration available</p>
        </div>
      </div>
    );
  }

  const avatarGender = avatar.avatarConfig.gender || 'male';

  // Modify the useEffect hook that loads configurations
  useEffect(() => {
    if (avatar && avatar.avatarConfig) {
      // Create a unique key for this avatar based on name or id
      const storageKey = `avatar-config-${avatar.avatarConfig.name || selectedItem.id}`;
      
      try {
        const savedConfig = localStorage.getItem(storageKey);
        
        // Check if we have a template for this avatar
        const template = avatarTemplates[avatar.avatarConfig.name];
        
        if (savedConfig) {
          // If there's a saved config, use it
          const parsedConfig = JSON.parse(savedConfig);
          const savedAvatarConfig = parsedConfig.avatarConfig || parsedConfig;
          
          // Merge with template if available
          const mergedConfig = template ? {
            ...template,
            ...savedAvatarConfig,
            customAttributes: {
              ...(template.customAttributes || {}),
              ...(savedAvatarConfig.customAttributes || {})
            },
            settings: {
              ...(template.settings || {}),
              ...(savedAvatarConfig.settings || {})
            }
          } : savedAvatarConfig;
          
          // Update the store with merged configuration
          updateSelectedItem({
            ...selectedItem,
            avatarConfig: {
              ...avatar.avatarConfig,
              ...mergedConfig
            }
          });
          
          // Set custom attributes
          setCustomAttributes(mergedConfig.customAttributes || {});
          
        } else if (template) {
          // If no saved config but template exists, use template
          updateSelectedItem({
            ...selectedItem,
            avatarConfig: {
              ...avatar.avatarConfig,
              ...template
            }
          });
          
          // Set custom attributes from template
          setCustomAttributes(template.customAttributes || {});
          
          // Save template to localStorage
          localStorage.setItem(storageKey, JSON.stringify(template));
          
        } else {
          // If no saved config and no template, use defaults
          const defaultVoice = getDefaultVoiceByGender(avatarGender);
          updateSelectedItem({
            ...selectedItem,
            avatarConfig: {
              ...avatar.avatarConfig,
              voice: defaultVoice,
              personality: "friendly",
              interactionPattern: "neutral",
              isProactive: false,
              proactiveThreshold: 0.3,
              fillerWordsFrequency: "none",
              roleDescription: "",
              customAttributes: {}
            }
          });
        }
        
        // Apply settings to avatar instance
        applySettingsToAvatar(selectedItem.avatarConfig);
        
      } catch (error) {
        console.error('Error loading avatar configuration:', error);
      }
    }
  }, [avatar?.avatarConfig?.name, selectedItem?.id]);

  // Function to apply settings to the active avatar instance
  const applySettingsToAvatar = useCallback((config) => {
    // Get the avatar instance, either from the direct prop or from the global ref
    const avatarInstance = selectedItem?.instance || window.avatarInstancesRef?.current?.[selectedItem.id];
    
    if (!avatarInstance) {
      console.warn('No avatar instance found to apply settings');
      return;
    }
    
    try {
      // Apply personality setting
      if (config.personality && typeof avatarInstance.setPersonality === 'function') {
        avatarInstance.setPersonality(config.personality);
      }
      
      // Apply custom attributes
      if (config.customAttributes && typeof avatarInstance.setCustomAttributes === 'function') {
        avatarInstance.setCustomAttributes(config.customAttributes);
      }
      
      // Apply interaction pattern
      if (config.interactionPattern && typeof avatarInstance.setInteractionPattern === 'function') {
        avatarInstance.setInteractionPattern(config.interactionPattern);
      }
      
      // Apply voice setting
      if (config.voice && typeof avatarInstance.setVoice === 'function') {
        avatarInstance.setVoice(config.voice);
      }
      
      // Apply proactive settings
      if (typeof avatarInstance.setProactive === 'function') {
        if (config.isProactive !== undefined) {
          const proactiveSettings = {
            isProactive: config.isProactive,
            threshold: config.proactiveThreshold || 0.3
          };
          avatarInstance.setProactive(proactiveSettings);
        }
      }
      
      // Apply filler words frequency
      if (config.fillerWordsFrequency && typeof avatarInstance.setFillerWordsFrequency === 'function') {
        avatarInstance.setFillerWordsFrequency(config.fillerWordsFrequency);
      }
      
      // Apply settings for mood and camera
      applyConfigToInstance(avatarInstance, config);
      
      // Publish a global event that all components can listen to
    const customEvent = new CustomEvent('avatarConfigChanged', {
      detail: {
        id: selectedItem.id,
          config: config
      }
    });
    document.dispatchEvent(customEvent);
      
      console.log('Applied settings to avatar instance:', config);
    } catch (error) {
      console.error('Error applying settings to avatar:', error);
    }
  }, [selectedItem?.id, selectedItem?.instance]);
  
  // Helper function to apply config to a specific avatar instance
  const applyConfigToInstance = (instance, config) => {
    // Apply mood if provided
    if (config.settings?.mood) {
      const validMoods = ["neutral", "happy", "sad", "angry", "surprised"];
      if (validMoods.includes(config.settings.mood) && instance.setMood) {
        try {
          instance.setMood(config.settings.mood);
        } catch (error) {
          console.error(`Error applying mood "${config.settings.mood}":`, error);
        }
      }
    }
    
    // Apply camera view if provided
    if (instance.setView) {
      // Map UI view value to API value
      let apiView = config.settings?.cameraView || "upper";
      if (apiView === "face") {
        apiView = "head"; // TalkingHead API uses "head" for face closeup
      }
      
      try {
        instance.setView(apiView, {
          cameraDistance: config.settings?.cameraDistance || 0.5,
          cameraRotateY: config.settings?.cameraRotateY || 0
        });
      } catch (error) {
        console.error(`Error applying view "${apiView}":`, error);
      }
    }
  };

  // Function to save avatar config to localStorage
  const saveAvatarConfig = (config) => {
    try {
      // Create a unique key for this avatar
      const storageKey = `avatar-config-${avatar.avatarConfig.name || selectedItem.id}`;
      
      // Determine if we're working with a full config object or just an avatarConfig
      const avatarConfigToSave = config.avatarConfig || config;
      
      // Include all settings in the saved config using a consistent structure
      const configToSave = {
        name: avatar.avatarConfig.name || selectedItem.id,
        // Save all settings directly at the root level for simplicity and consistency
        personality: avatarConfigToSave.personality || selectedItem.avatarConfig?.personality || "friendly",
        interactionPattern: avatarConfigToSave.interactionPattern || selectedItem.avatarConfig?.interactionPattern || "neutral",
        isProactive: avatarConfigToSave.isProactive !== undefined ? avatarConfigToSave.isProactive : selectedItem.avatarConfig?.isProactive || false,
        proactiveThreshold: avatarConfigToSave.proactiveThreshold || selectedItem.avatarConfig?.proactiveThreshold || 0.3,
        fillerWordsFrequency: avatarConfigToSave.fillerWordsFrequency || selectedItem.avatarConfig?.fillerWordsFrequency || "none",
        roleDescription: avatarConfigToSave.roleDescription || selectedItem.avatarConfig?.roleDescription || "",
        voice: avatarConfigToSave.voice || selectedItem.avatarConfig?.voice,
        customAttributes: avatarConfigToSave.customAttributes || selectedItem.avatarConfig?.customAttributes || {},
        settings: {
          ...(avatarConfigToSave.settings || selectedItem.avatarConfig?.settings || {})
        }
      };
      
      // Save to localStorage
      localStorage.setItem(storageKey, JSON.stringify(configToSave));
      
      console.log(`Saved configuration for avatar: ${storageKey}`, configToSave);
      
      // Also update the topicPanel-participants localStorage item to make these settings available to node.speakers
      try {
        let participants = [];
        const savedParticipants = localStorage.getItem('topicPanel-participants');
        if (savedParticipants) {
          participants = JSON.parse(savedParticipants);
        }
        
        // Find the participant with matching name and update their settings
        const participantIndex = participants.findIndex(p => 
          p.name === avatar.avatarConfig.name || p.id === selectedItem.id
        );
        
        // Create a new participant entry with proper structure if not found
        const participantToAdd = {
          id: selectedItem.id || `generated-${Date.now()}`,
          name: avatar.avatarConfig.name || selectedItem.id,
          gender: avatar.avatarConfig.gender || selectedItem.avatarConfig?.gender || "neutral",
          voice: configToSave.voice || "",
          personality: configToSave.personality,
          interactionPattern: configToSave.interactionPattern,
          isProactive: configToSave.isProactive,
          proactiveThreshold: configToSave.proactiveThreshold,
          fillerWordsFrequency: configToSave.fillerWordsFrequency,
          roleDescription: configToSave.roleDescription,
          customAttributes: configToSave.customAttributes,
          settings: configToSave.settings || {}
        };
        
        if (participantIndex !== -1) {
          // Update existing participant with conversation settings
          participants[participantIndex] = {
            ...participants[participantIndex],
            // Copy all the conversation-related settings to the participant
            personality: configToSave.personality,
            interactionPattern: configToSave.interactionPattern,
            isProactive: configToSave.isProactive,
            proactiveThreshold: configToSave.proactiveThreshold,
            fillerWordsFrequency: configToSave.fillerWordsFrequency,
            roleDescription: configToSave.roleDescription,
            voice: configToSave.voice,
            customAttributes: configToSave.customAttributes,
            // Copy settings like mood, cameraView, etc.
            settings: {
              ...participants[participantIndex].settings,
              ...configToSave.settings
            }
          };
          
          console.log(`Updated existing participant in topicPanel-participants:`, participants[participantIndex]);
        } else {
          // Add new participant to the list
          participants.push(participantToAdd);
          console.log(`Added new participant to topicPanel-participants:`, participantToAdd);
        }
        
        // Save updated participants back to localStorage
        localStorage.setItem('topicPanel-participants', JSON.stringify(participants));
        
        // Update the store with new speakers data
        if (window.editorStore && typeof window.editorStore.getState === 'function') {
          window.editorStore.getState().setSpeakers(participants);
        } else if (useEditorStore && typeof useEditorStore.getState === 'function') {
          useEditorStore.getState().setSpeakers(participants);
        }
      } catch (error) {
        console.error('Error updating topicPanel-participants:', error);
      }
      
    } catch (error) {
      console.error('Error saving avatar configuration:', error);
    }
  };

  const handleVoiceChange = (e) => {
    const newVoice = e.target.value;
    const updatedConfig = {
      ...avatar.avatarConfig,
      voice: newVoice
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage using our consistent structure
    saveAvatarConfig(updatedConfig);
    
    // Apply changes immediately to all avatar instances
    const customEvent = new CustomEvent('avatarConfigChanged', {
      detail: {
        id: selectedItem.id,
        config: updatedConfig
      }
    });
    document.dispatchEvent(customEvent);
    
    // Also apply to the current instance if available
    const avatarInstance = window.avatarInstancesRef?.current?.[selectedItem.id];
    if (avatarInstance && typeof avatarInstance.setVoice === 'function') {
      try {
        avatarInstance.setVoice(newVoice);
      } catch (error) {
        console.error('Error setting voice:', error);
      }
    }
    
    // Test the voice
    setTimeout(() => {
      const avatarInstance = window.avatarInstancesRef?.current?.[selectedItem.id];
      if (avatarInstance && typeof avatarInstance.say === 'function') {
        try {
          const testText = getVoiceTestText(newVoice);
          console.log(`Testing voice ${newVoice} with text: "${testText}"`);
          avatarInstance.say(testText);
        } catch (error) {
          console.error('Error testing voice:', error);
        }
      }
    }, 500);
  };
  
  // Function to get appropriate test text based on voice type
  const getVoiceTestText = (voice) => {
    // Shorter test phrases to avoid TTS rate limiting
    if (voice.includes('en-GB')) {
      return "Hello, this is my British voice.";
    } else if (voice.includes('en-US')) {
      return "Hello, this is my American voice.";
    } else {
      return "Hello, this is my new voice.";
    }
  };

  const handleMoodChange = (e) => {
    const newMood = e.target.value;
    
    // Verify that the mood is valid before applying
    const validMoods = ["neutral", "happy", "sad", "angry", "surprised"];
    if (!validMoods.includes(newMood)) {
      console.error(`Invalid mood value: ${newMood}`);
      return; // Don't update with invalid mood
    }
    
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      settings: {
        ...selectedItem.avatarConfig.settings,
        mood: newMood
      }
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage
    saveAvatarConfig(updatedConfig);
    
    // Apply changes immediately to all avatar instances
    applySettingsToAvatar(updatedConfig);
    
    // Show subtle notification
    showTemporaryNotification("Mood updated");
  };

  const handleCameraViewChange = (e) => {
    const newViewUI = e.target.value; // UI value ("upper", "face", "full")
    
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      settings: {
        ...selectedItem.avatarConfig.settings,
        cameraView: newViewUI // Store the UI value in config
      }
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage
    saveAvatarConfig(updatedConfig);
    
    // Apply changes immediately to all avatar instances
    applySettingsToAvatar(updatedConfig);
    
    // Show subtle notification
    showTemporaryNotification("Camera view updated");
  };

  const handleCameraDistanceChange = (e) => {
    const newDistance = parseFloat(e.target.value);
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      settings: {
        ...selectedItem.avatarConfig.settings,
        cameraDistance: newDistance
      }
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage
    saveAvatarConfig(updatedConfig);
    
    // Apply changes immediately to all avatar instances
    applySettingsToAvatar(updatedConfig);
  };

  const handleApplyChanges = () => {
    // Save to localStorage
    saveAvatarConfig({ 
      name: avatar.avatarConfig.name,
      avatarConfig: selectedItem.avatarConfig 
    });
    
    // Show success notification
    showSaveNotification("Avatar configuration saved and applied to all instances!");
    
    // Apply to all avatar instances in all scenes
    applySettingsToAvatar({ avatarConfig: selectedItem.avatarConfig });
    
    // Publish a global event that all components can listen to
    if (window.applyAvatarChanges) {
      window.applyAvatarChanges(selectedItem.id, selectedItem.avatarConfig);
    }
  };

  // Function to show a save notification
  const showSaveNotification = (message) => {
    // Create a temporary element to show a save notification
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 theme-bg-success theme-text-inverse px-4 py-2 rounded-md shadow-lg';
    notification.style.zIndex = '9999';
    notification.textContent = message || 'Avatar configuration saved successfully!';
    document.body.appendChild(notification);
    
    // Remove the notification after 2 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s ease-out';
      setTimeout(() => document.body.removeChild(notification), 500);
    }, 2000);
  };

  // Add new handlers for the additional settings
  const handlePersonalityChange = (e) => {
    const newPersonality = e.target.value;
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      personality: newPersonality
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage immediately
    saveAvatarConfig({ avatarConfig: updatedConfig });
    
    // Apply changes immediately
    applySettingsToAvatar(updatedConfig);
  };

  const handleInteractionPatternChange = (e) => {
    const newPattern = e.target.value;
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      interactionPattern: newPattern
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage immediately
    saveAvatarConfig({ avatarConfig: updatedConfig });
    
    // Apply changes immediately
    applySettingsToAvatar(updatedConfig);
  };

  const handleProactiveToggle = (e) => {
    const isProactive = e.target.checked;
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      isProactive
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage immediately
    saveAvatarConfig({ avatarConfig: updatedConfig });
    
    // Apply changes immediately
    applySettingsToAvatar(updatedConfig);
  };

  const handleProactiveThresholdChange = (e) => {
    const threshold = parseFloat(e.target.value);
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      proactiveThreshold: threshold
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage immediately
    saveAvatarConfig({ avatarConfig: updatedConfig });
    
    // Apply changes immediately
    applySettingsToAvatar(updatedConfig);
  };

  const handleFillerWordsFrequencyChange = (e) => {
    const frequency = e.target.value;
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      fillerWordsFrequency: frequency
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage immediately
    saveAvatarConfig({ avatarConfig: updatedConfig });
    
    // Apply changes immediately
    applySettingsToAvatar(updatedConfig);
  };

  const handleRoleDescriptionChange = (e) => {
    const description = e.target.value;
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      roleDescription: description
    };
    
    // Update the store
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage immediately
    saveAvatarConfig({ avatarConfig: updatedConfig });
    
    // Apply changes immediately
    applySettingsToAvatar(updatedConfig);
  };

  // Add state for collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    conversation: false,
    appearance: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Helper component for tooltip icons
  const TooltipIcon = ({ text }) => (
    <span className="inline-flex items-center ml-1 relative group">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="theme-text-tertiary hover:theme-text-secondary cursor-help">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-1 w-48 theme-bg-tooltip theme-text-inverse text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
        {text}
      </div>
    </span>
  );

  // Function to show a temporary notification for subtle feedback
  const showTemporaryNotification = (message) => {
    // Only create if a notification doesn't already exist
    if (!document.getElementById('avatar-temp-notification')) {
      const notification = document.createElement('div');
      notification.id = 'avatar-temp-notification';
      notification.className = 'fixed bottom-4 right-4 theme-bg-success theme-text-inverse px-4 py-2 rounded-md shadow-lg';
      notification.style.zIndex = '9999';
      notification.textContent = message;
      notification.style.transition = 'opacity 0.5s ease-out';
      document.body.appendChild(notification);
      
      // Remove after a short time
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 500);
      }, 1000);
    }
  };

  // Add handlers for custom attributes
  const handleAddAttribute = () => {
    if (!attributeKey.trim()) {
      return; // Don't add empty keys
    }
    
    const newAttributes = {
      ...customAttributes,
      [attributeKey]: attributeValue
    };
    
    setCustomAttributes(newAttributes);
    
    // Update the store
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      customAttributes: newAttributes
    };
    
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage
    saveAvatarConfig({ avatarConfig: updatedConfig });
    
    // Apply changes immediately
    applySettingsToAvatar(updatedConfig);
    
    // Clear inputs
    setAttributeKey('');
    setAttributeValue('');
  };
  
  const handleRemoveAttribute = (key) => {
    const newAttributes = { ...customAttributes };
    delete newAttributes[key];
    
    setCustomAttributes(newAttributes);
    
    // Update the store
    const updatedConfig = {
      ...selectedItem.avatarConfig,
      customAttributes: newAttributes
    };
    
    updateSelectedItem({
      ...selectedItem,
      avatarConfig: updatedConfig
    });
    
    // Save to localStorage
    saveAvatarConfig({ avatarConfig: updatedConfig });
    
    // Apply changes immediately
    applySettingsToAvatar(updatedConfig);
  };

  return (
    <div className="p-0 overflow-y-auto max-h-[calc(100vh-6rem)] theme-bg-secondary theme-text-primary">
      {/* Header */}
      <div className="sticky top-0 theme-bg-secondary theme-border-b theme-border p-2 shadow-sm z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium theme-text-primary">Avatar: {avatar.avatarConfig.name}</h2>
          <div className="text-xs theme-text-success">
            <span className="inline-flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M20 6L9 17l-5-5"></path>
              </svg>
              Real-time updates
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-2 pt-2 pb-0">
        {/* Tabbed Interface */}
        <div className="mb-2">
          <nav className="flex theme-border-b theme-border">
            <button
              type="button"
              className={`px-2 py-1 border-b-2 text-xs font-medium ${activeTab === 'basic' ? 'theme-border-accent theme-text-accent' : 'border-transparent theme-text-tertiary hover:theme-text-secondary hover:theme-border-hover'}`}
              onClick={() => setActiveTab('basic')}
            >
              Basic Settings
            </button>
            <button
              type="button"
              className={`px-2 py-1 border-b-2 text-xs font-medium ${activeTab === 'conversation' ? 'theme-border-accent theme-text-accent' : 'border-transparent theme-text-tertiary hover:theme-text-secondary hover:theme-border-hover'}`}
              onClick={() => setActiveTab('conversation')}
            >
              Conversation
            </button>
            <button
              type="button"
              className={`px-2 py-1 border-b-2 text-xs font-medium ${activeTab === 'appearance' ? 'theme-border-accent theme-text-accent' : 'border-transparent theme-text-tertiary hover:theme-text-secondary hover:theme-border-hover'}`}
              onClick={() => setActiveTab('appearance')}
            >
              Avatar Settings
            </button>
          </nav>
        </div>
        
        {/* Tab content */}
        <div className="pt-2 space-y-2">
          {/* Basic Settings Tab Content */}
          {activeTab === 'basic' && (
            <div className="theme-bg-tertiary rounded-md theme-border theme-border overflow-hidden">
              <div className="theme-bg-secondary px-3 py-1.5 theme-border-b theme-border">
                <h3 className="text-xs font-medium theme-text-secondary">Primary Configuration</h3>
              </div>
              <div className="p-3 space-y-3">
                 {/* Personality Selection */}
                 <div className="space-y-1">
                  <label className="block text-xs font-medium theme-text-tertiary">
                    Personality
                    <TooltipIcon text="The avatar's general demeanor and personality type" />
                  </label>
                  <select 
                    className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
                    value={selectedItem.avatarConfig?.personality || "friendly"}
                    onChange={handlePersonalityChange}
                  >
                    {personalityOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Role Description */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium theme-text-tertiary">
                    Role Description
                    <TooltipIcon text="Describe this avatar's role, personality, or background" />
                  </label>
                  <textarea 
                    className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
                    value={selectedItem.avatarConfig?.roleDescription || ""}
                    onChange={handleRoleDescriptionChange}
                    rows={2}
                    placeholder="Describe the avatar's role..."
                  />
                </div>

                {/* Custom Attributes Section */}
                <div className="space-y-1">
                  <label className="block text-xs font-medium theme-text-tertiary">
                    Custom Attributes
                    <TooltipIcon text="Additional attributes that define this character (age, profession, etc.)" />
                  </label>
                  
                  {/* List of current attributes */}
                  <div className="mb-3 max-h-40 overflow-y-auto bg-black/20 rounded-md p-2">
                    {Object.entries(customAttributes).length > 0 ? (
                      <ul className="space-y-1 mt-1">
                        {Object.entries(customAttributes).map(([key, value], index) => (
                          <li key={`attr-${index}`} className="flex items-center justify-between py-1 px-2 theme-bg-tertiary rounded theme-border theme-border-light">
                            <div className="flex items-center">
                              <span className="text-xs font-medium theme-text-primary">{key}:</span>
                              <span className="text-xs ml-1 theme-text-secondary">{value}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveAttribute(key)}
                              className="p-1 theme-text-tertiary hover:theme-text-error rounded-full transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs theme-text-tertiary italic text-center py-2">No custom attributes defined</p>
                    )}
                  </div>
                  
                  {/* Form to add new attributes with "+" button */}
                  <div className="theme-bg-accent-secondary p-2 rounded-md border theme-border-accent">
                    <h4 className="text-xs font-medium theme-text-accent mb-2">Add New Attribute</h4>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs font-medium theme-text-tertiary mb-1">Name</label>
                        <input 
                          type="text"
                          placeholder="e.g. age, expertise"
                          className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
                          value={attributeKey}
                          onChange={(e) => setAttributeKey(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium theme-text-tertiary mb-1">Value</label>
                        <input 
                          type="text"
                          placeholder="e.g. 35, medicine"
                          className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
                          value={attributeValue}
                          onChange={(e) => setAttributeValue(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleAddAttribute}
                      className="px-2 py-1 theme-bg-accent theme-text-inverse text-xs rounded hover:theme-bg-accent-hover transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Add Attribute
                    </button>
                  
                  </div>
                </div>

               
              </div>
            </div>
          )}
          
          {/* Conversation Settings Tab Content */}
          {activeTab === 'conversation' && (
            <div className="theme-bg-tertiary rounded-md theme-border theme-border overflow-hidden">
              <div className="theme-bg-secondary px-3 py-1.5 theme-border-b theme-border">
                <h3 className="text-xs font-medium theme-text-secondary">Conversation Behavior</h3>
              </div>
              <div className="p-3 space-y-3">
                {/* Interaction Pattern */}
                <div className="p-2 theme-bg-accent-secondary rounded border theme-border-accent">
                  <h4 className="text-xs font-medium text-black mb-2">Communication Style</h4>
                  
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-black">
                      Interaction Pattern
                      <TooltipIcon text="How the avatar responds to others in conversation" />
                    </label>
                    <select 
                      className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
                      value={selectedItem.avatarConfig?.interactionPattern || "neutral"}
                      onChange={handleInteractionPatternChange}
                    >
                      {interactionPatternOptions.map(option => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Proactive Settings */}
                              <div className="p-2 bg-sky-900/30 rounded border border-sky-800/30">
                <h4 className="text-xs font-medium text-black-300 mb-2">Proactive Behavior</h4>
                  
                  <div className="flex items-center">
                    <input 
                      type="checkbox"
                      id="isProactive"
                      className="h-3 w-3 theme-text-accent theme-focus-ring theme-border rounded"
                      checked={selectedItem.avatarConfig?.isProactive || false}
                      onChange={handleProactiveToggle}
                    />
                    <label htmlFor="isProactive" className="ml-2 block text-xs font-medium text-black">
                      Enable Proactive Responses
                      <TooltipIcon text="When enabled, the avatar may jump into conversations without being directly addressed" />
                    </label>
                  </div>
                  
                  {selectedItem.avatarConfig?.isProactive && (
                    <div className="mt-3 ml-5 space-y-1">
                      <label className="block text-xs font-medium text-black">
                        Proactive Threshold: {selectedItem.avatarConfig?.proactiveThreshold || 0.3}
                        <TooltipIcon text="Higher values mean more frequent proactive responses" />
                      </label>
                      <input 
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        className="w-full"
                        value={selectedItem.avatarConfig?.proactiveThreshold || 0.3}
                        onChange={handleProactiveThresholdChange}
                      />
                      <p className="text-xs text-black mt-1">Higher values mean more frequent proactive responses</p>
                    </div>
                  )}
                </div>

                {/* Filler Words Frequency */}
                <div className="p-2 bg-cyan-900/30 rounded border border-cyan-800/30">
                  <h4 className="text-xs font-medium text-black-300 mb-2">Speech Pattern</h4>
                  
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-black">
                      Filler Words Frequency
                      <TooltipIcon text="How often the avatar uses filler words like 'um', 'uh', etc." />
                    </label>
                    <select 
                      className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
                      value={selectedItem.avatarConfig?.fillerWordsFrequency || "none"}
                      onChange={handleFillerWordsFrequencyChange}
                    >
                      {fillerWordsFrequencyOptions.map(option => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Avatar Settings Tab Content */}
          {activeTab === 'appearance' && (
            <div className="theme-bg-tertiary rounded-md theme-border theme-border overflow-hidden">
              <div className="theme-bg-secondary px-3 py-1.5 theme-border-b theme-border">
                <h3 className="text-xs font-medium theme-text-secondary">Avatar Settings</h3>
              </div>
              <div className="p-3 space-y-3">
                {/* Voice Settings */}
                <div className="p-2 bg-sky-900/30 rounded border border-sky-800/30">
                  <h4 className="text-xs font-medium text-black-300 mb-2">Voice Settings</h4>
                  
        {/* Voice selection */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-black">
            Voice
            <TooltipIcon text="The avatar's speaking voice" />
          </label>
          <select 
            className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
            value={selectedItem.avatarConfig?.voice || getDefaultVoiceByGender(avatarGender)}
            onChange={handleVoiceChange}
          >
            <option value="en-GB-Standard-A">British Voice (F)</option>
            <option value="en-GB-Standard-B">British Voice (M)</option>
            <option value="en-GB-Standard-D">British Voice (M2)</option>
            <option value="en-US-Standard-B">American Voice (M)</option>
            <option value="en-US-Standard-C">American Voice (F)</option>
          </select>
          <div className="mt-2">
            <button 
              onClick={() => handleTestVoice(selectedItem.avatarConfig?.voice || getDefaultVoiceByGender(avatarGender))}
              className="px-2 py-1 theme-bg-accent theme-text-inverse text-xs rounded-sm hover:theme-bg-accent-hover transition-colors ml-2"
            >
              Test Voice
            </button>
            <span className="text-xs text-black ml-2 italic">Changes apply immediately</span>
          </div>
          </div>
        </div>

                {/* Mood Settings */}
                <div className="p-2 bg-slate-900/30 rounded border border-slate-800/30">
                  <h4 className="text-xs font-medium text-black-300 mb-2">Emotional State</h4>
        
        {/* Mood selection */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-black">
                      Mood
                      <TooltipIcon text="The avatar's emotional state" />
                    </label>
          <select 
            className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
            value={selectedItem.avatarConfig?.settings?.mood || "neutral"}
            onChange={handleMoodChange}
          >
            <option value="neutral">Neutral</option>
            <option value="happy">Happy</option>
            <option value="sad">Sad</option>
            <option value="angry">Angry</option>
            <option value="surprised">Surprised</option>
          </select>
                    <p className="text-xs text-black mt-1 italic">Changes apply immediately</p>
                  </div>
        </div>
        
        {/* Camera View */}
        <div className="p-2 bg-blue-900/30 rounded border border-blue-800/30">
        <h4 className="text-xs font-medium text-black-300 mb-2">Camera Settings</h4>
                  
        <div className="space-y-1">
            <label className="block text-xs font-medium text-black">
              Camera View
              <TooltipIcon text="How much of the avatar is visible" />
            </label>
          <select 
            className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
            value={selectedItem.avatarConfig?.settings?.cameraView || "upper"}
            onChange={handleCameraViewChange}
          >
            <option value="upper">Upper Body</option>
            <option value="head">Face Only</option>
            <option value="full">Full Body</option>
          </select>
                    <p className="text-xs text-black mt-1 italic">Changes apply immediately</p>
        </div>
        
        {/* Camera Distance */}
                  <div className="space-y-1 mt-3">
                    <label className="block text-xs font-medium text-black">
                      Camera Distance: {selectedItem.avatarConfig?.settings?.cameraDistance || 0.1}
                      <TooltipIcon text="How close the camera is to the avatar" />
          </label>
          <input 
            type="range" 
            min="0.1" 
            max="2" 
            step="0.1"
            className="w-full"
                      value={selectedItem.avatarConfig?.settings?.cameraDistance || 0.1}
            onChange={handleCameraDistanceChange}
          />
                    <p className="text-xs text-black mt-1 italic">Changes apply immediately</p>
                  </div>
        </div>
                
                {/* Model Information */}
                <div className="p-2 theme-bg-secondary rounded border theme-border-secondary">
                  <h4 className="text-xs font-medium theme-text-tertiary mb-2">Model Information</h4>
        
        {/* URL Display (read-only) */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium theme-text-tertiary">
                      Model URL
                      <TooltipIcon text="URL to the avatar's 3D model - read only" />
                    </label>
          <input 
            type="text"
                      className="w-full p-1.5 theme-bg-input theme-border theme-text-primary text-xs rounded"
            value={avatar.avatarConfig?.url || ""}
            readOnly
          />
        </div>
                </div>
              </div>
            </div>
          )}
        
          {/* Save button and configuration manager */}
          <div className="mt-4 space-y-2">
        <button
          onClick={handleApplyChanges}
              className="w-full px-3 py-2 theme-bg-accent theme-text-inverse text-xs rounded-md hover:theme-bg-accent-hover transition-colors flex justify-center items-center"
        >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
          Save & Apply To All Instances
        </button>
            <p className="text-xs theme-text-tertiary text-center">
         
        </p>

      {/* Configuration Manager */}
            {/* <div className="mt-6 pt-4 theme-border-t theme-border">
              <h3 className="text-xs font-medium theme-text-tertiary mb-2">Avatar Configuration Manager</h3>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to clear the saved configuration for "${avatar.avatarConfig.name}"?`)) {
                      const storageKey = `avatar-config-${avatar.avatarConfig.name}`;
      localStorage.removeItem(storageKey);
                      alert(`Configuration for "${avatar.avatarConfig.name}" has been cleared.`);
                    }
                  }}
                  className="px-3 py-1.5 theme-bg-warning theme-text-inverse text-xs rounded hover:theme-bg-warning-hover transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Clear Configuration for This Avatar
                </button>
                <button
                  onClick={() => {
    if (confirm('Are you sure you want to clear ALL saved avatar configurations?')) {
      // Get all localStorage keys
      const avatarConfigKeys = Object.keys(localStorage).filter(key => key.startsWith('avatar-config-'));
      
      // Remove each avatar config
      avatarConfigKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      alert(`All avatar configurations have been cleared (${avatarConfigKeys.length} found).`);
    }
                  }}
                  className="px-3 py-1.5 theme-bg-error theme-text-inverse text-xs rounded hover:theme-bg-error transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
          Clear All Avatar Configurations
        </button>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AvatarInspector;