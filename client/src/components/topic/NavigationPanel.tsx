import React, { useEffect, useState, useRef } from 'react';
import { FaEdit, FaSave, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import useEditorStore from '../inspector/store';
// Import avatar templates from the new file
import { avatarTemplates } from './avatarTemplates';

// Default names by gender that match TalkingHeadComponent.jsx
const defaultMaleNames = ['Bob', 'David', 'Henry', 'Charlie'];
const defaultFemaleNames = ['Alice', 'Grace', 'Ivy','Jane', 'Eve'];

// Gender mapping for names
const nameGenderMap: Record<string, 'male' | 'female'> = {
  'Alice': 'female',
  'Bob': 'male',
  'Charlie': 'male',
  'David': 'male',
  'Eve': 'female',
  'Frank': 'male',
  'Grace': 'female',
  'Henry': 'male',
  'Ivy': 'female',
  'Jack': 'male',
  'Jane': 'female'
};

// Fixed Avatar URL paths by name (gender-consistent)
const nameAvatarMap: Record<string, string> = {
  // 'Alice': '/assets/p-f-a2.glb',
  'Alice': '/assets/female-avatar1.glb',
  // 'Bob': '/assets/p-m-a4.glb',
  'Bob': '/assets/male-avatar1.glb',
  'Charlie': '/assets/male-avatar2.glb',
  // 'David': '/assets/p-m-a3.glb',
  'David': '/assets/male-avatar3.glb',
  'Eve': '/assets/female-avatar2.glb',
  'Frank': '/assets/male-avatar4.glb',
  'Grace': '/assets/female-avatar3.glb',
  'Henry': '/assets/male-avatar5.glb',
  // 'Ivy': '/assets/p-f-a1.glb',
  'Ivy': '/assets/female-avatar4.glb',
  'Jack': '/assets/male-avatar5.glb',
  'Jane': '/assets/female-avatar5.glb'
};

// Function to assign fixed avatars based on names
const assignFixedAvatars = (selectedNames: string[]): string[] => {
  return selectedNames.map(name => nameAvatarMap[name] || '/assets/default-avatar.glb');
};

interface NavigationPanelProps {
  editAgent: boolean;
  showPreview: boolean;
  previewInitialized: boolean;
  setEditAgent: (value: boolean) => void;
  setShowPreview: (value: boolean) => void;
  selectedParticipants: string[];
  handleParticipantsSelected: (participants: string[]) => void;
  currentTopic: string;
  editTopic: boolean;
  setEditTopic: (value: boolean) => void;
  handleTopicChange: (value: string) => void;
  thumbnails: string[];
  loadingThumbnails: Set<number>;
  updateAvatarPanel: (names: string[], avatarUrls: string[], thumbnails?: Record<number, string>) => void;
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({
  editAgent,
  showPreview,
  previewInitialized,
  setEditAgent,
  setShowPreview,
  selectedParticipants,
  handleParticipantsSelected,
  currentTopic,
  editTopic,
  setEditTopic,
  handleTopicChange,
  thumbnails,
  loadingThumbnails,
  updateAvatarPanel
}) => {
  // Get setSpeakers from the store
  const { setSpeakers } = useEditorStore();
  
  // State to track human participants
  const [humanParticipants, setHumanParticipants] = useState<string[]>([]);
  // References to track initialization state
  const initialLoadDoneRef = useRef<boolean>(false);
  const humanParticipantsRef = useRef<string[]>([]);

  // Add state for thumbnails
  const [thumbnailsState, setThumbnails] = useState<Record<number, string>>({});

  // Function to initialize speakers
  const initializeSpeakers = (names: string[]) => {
    console.log("Initializing speakers for:", names);
    
    // Get the fixed avatar URLs
    const avatarUrls = assignFixedAvatars(names);
    
    console.log("Assigned avatar URLs:", avatarUrls);
    
    // Use the ref for most up-to-date human participants
    const currentHumanParticipants = humanParticipantsRef.current;
    
    // Save participants data in format compatible with AvatarConfig
    const participantsData = names.map((name, index) => {
      // Try to load avatar template first
      let templateData: {
        voice?: string;
        personality?: string;
        roleDescription?: string;
        isProactive?: boolean;
        proactiveThreshold?: number;
        fillerWordsFrequency?: string;
        interactionPattern?: string;
        customAttributes?: Record<string, any>;
        settings?: {
          body?: string;
          cameraDistance?: number;
          cameraRotateY?: number;
          cameraView?: string;
          lipsyncLang?: string;
          mood?: string;
          ttsLang?: string;
          ttsRate?: number;
          [key: string]: any;
        };
        [key: string]: any;
      } = {};

      try {
        // Check if there's a template saved for this avatar
        const templateKey = `avatar-config-${name}`;
        const savedTemplate = localStorage.getItem(templateKey);
        if (savedTemplate) {
          const parsedTemplate = JSON.parse(savedTemplate);
          templateData = parsedTemplate;
          console.log(`Using saved template for ${name}:`, templateData);
        } 
        // If no saved template but there's a predefined template
        else if (avatarTemplates[name]) {
          templateData = avatarTemplates[name];
          console.log(`Using predefined template for ${name}:`, templateData);
        }
        else {
          console.log(`No template found for ${name}`);
        }
      } catch (error) {
        console.error(`Error loading template for ${name}:`, error);
      }

      // Merge template data with basic avatar data, with template taking precedence
      return {
        id: (index + 1).toString(),
        gender: nameGenderMap[name],
        name: name,
        url: nameAvatarMap[name],
        voice: templateData.voice || (nameGenderMap[name] === 'male' ? 'en-GB-Standard-B' : 'en-GB-Standard-A'),
        isHuman: currentHumanParticipants.includes(name),
        // Add personality and conversation attributes, using template values if available
        personality: templateData.personality || "friendly",
        roleDescription: templateData.roleDescription || "",
        isProactive: templateData.isProactive !== undefined ? templateData.isProactive : false,
        proactiveThreshold: templateData.proactiveThreshold || 0.3,
        fillerWordsFrequency: templateData.fillerWordsFrequency || "none",
        interactionPattern: templateData.interactionPattern || "neutral",
        customAttributes: templateData.customAttributes || {},
        // Merge settings
        settings: {
          body: nameGenderMap[name] === 'male' ? 'M' : 'F',
          cameraDistance: 1.2,
          cameraRotateY: 0,
          cameraView: "upper",
          lipsyncLang: "en",
          mood: "neutral",
          ttsLang: "en-GB",
          ttsRate: 1.5,
          ...(templateData.settings || {})
        }
      };
    });
    
    // Update speakers directly in the store, which will also update localStorage
    setSpeakers(participantsData);

    // Update the avatar panel with new names and avatar URLs
    updateAvatarPanel(names, avatarUrls);
  };

  // Load saved settings from localStorage on mount
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    
    try {
      const savedData = localStorage.getItem('aiPanelData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        
        // Load participants if we have saved data, regardless of current state
        if (parsedData.selectedNames?.length > 0) {
          // Load human participants if available
          if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
            const savedHumanParticipants = [...parsedData.humanParticipants];
            console.log("Loading saved human participants:", savedHumanParticipants);
            setHumanParticipants(savedHumanParticipants);
            humanParticipantsRef.current = savedHumanParticipants;
          }
          
          // Load topic if available
          if (parsedData.discussionTopic) {
            console.log("Loading saved topic:", parsedData.discussionTopic);
            handleTopicChange(parsedData.discussionTopic);
          }
          
          // Check if we have valid cached thumbnails
          if (parsedData.thumbnailsValid) {
            const cachedThumbnails = localStorage.getItem('avatarThumbnails');
            const cachedUrlMap = localStorage.getItem('avatarThumbnailsUrlMap');
            
            if (cachedThumbnails && cachedUrlMap) {
              try {
                const urlMap = JSON.parse(cachedUrlMap);
                const thumbnailsValid = parsedData.avatarUrls.length === Object.keys(urlMap).length &&
                  parsedData.avatarUrls.every((url: string, index: number) => urlMap[index] === url);
                
                if (thumbnailsValid) {
                  setThumbnails(JSON.parse(cachedThumbnails));
                }
              } catch (error) {
                console.error('Error parsing cached thumbnail data:', error);
              }
            }
          }
          
          // Initialize speakers with saved data
          initializeSpeakers(parsedData.selectedNames);
        } else {
          // No participants saved, load default participants          
          // Start with 2 default participants - one male and one female
          const defaultParticipants = [defaultFemaleNames[0], defaultMaleNames[0]];
          console.log("Loading default participants:", defaultParticipants);
          
          // Initialize speakers with default participants
          initializeSpeakers(defaultParticipants);
          
          // Also update the selectedParticipants prop if provided
          if (handleParticipantsSelected) {
            handleParticipantsSelected(defaultParticipants);
          }
        }
      } else {
        // No saved data at all, load default participants        
        // Start with 2 default participants - one male and one female
        const defaultParticipants = [defaultFemaleNames[0], defaultMaleNames[0]];
        console.log("Loading default participants:", defaultParticipants);
        
        // Initialize speakers with default participants
        initializeSpeakers(defaultParticipants);
        
        // Also update the selectedParticipants prop if provided
        if (handleParticipantsSelected) {
          handleParticipantsSelected(defaultParticipants);
        }
      }
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
      // If there's an error, clear the corrupted data
      localStorage.removeItem('aiPanelData');
      
      // Load default participants as fallback      
      // Start with 2 default participants - one male and one female
      const defaultParticipants = [defaultFemaleNames[0], defaultMaleNames[0]];
      console.log("Loading default participants after error:", defaultParticipants);
      
      // Initialize speakers with default participants
      initializeSpeakers(defaultParticipants);
      
      // Also update the selectedParticipants prop if provided
      if (handleParticipantsSelected) {
        handleParticipantsSelected(defaultParticipants);
      }
    }
  }, []); // Only run once on mount

  // Update humanParticipantsRef when the state changes
  useEffect(() => {
    humanParticipantsRef.current = humanParticipants;
  }, [humanParticipants]);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    // Skip saving if we're still initializing
    if (!selectedParticipants) {
      console.log('Skipping save - no selectedParticipants');
      return;
    }

    try {
      console.log('Saving participants to localStorage:', selectedParticipants);
      // Always save current state, even if empty
      const avatarUrls = assignFixedAvatars(selectedParticipants);
      
      // Get cached thumbnails if they exist
      const cachedThumbnails = localStorage.getItem('avatarThumbnails');
      const cachedUrlMap = localStorage.getItem('avatarThumbnailsUrlMap');
      
      // Check if we have valid cached thumbnails
      let thumbnailsValid = false;
      if (cachedThumbnails && cachedUrlMap) {
        try {
          const urlMap = JSON.parse(cachedUrlMap);
          thumbnailsValid = avatarUrls.length === Object.keys(urlMap).length &&
            avatarUrls.every((url, index) => urlMap[index] === url);
        } catch (error) {
          console.error('Error parsing cached thumbnail data:', error);
        }
      }
      
      const dataToSave = {
        totalParticipants: selectedParticipants.length,
        selectedNames: selectedParticipants,
        discussionTopic: currentTopic || '',
        avatarUrls: avatarUrls,
        lastUpdated: Date.now(),
        humanParticipants: humanParticipants,
        thumbnailsValid: thumbnailsValid
      };
      
      localStorage.setItem('aiPanelData', JSON.stringify(dataToSave));

      // Also update topicPanel-participants
      const participants = selectedParticipants.map((name, index) => ({
        id: (index + 1).toString(),
        name: name,
        gender: nameGenderMap[name],
        voice: nameGenderMap[name] === 'male' ? 'en-GB-Standard-B' : 'en-GB-Standard-A',
        url: nameAvatarMap[name],
        isHuman: humanParticipants.includes(name),
        personality: "friendly",
        roleDescription: "",
        isProactive: false,
        proactiveThreshold: 0.3,
        fillerWordsFrequency: "none",
        interactionPattern: "neutral",
        customAttributes: {},
        settings: {
          body: nameGenderMap[name] === 'male' ? 'M' : 'F',
          cameraDistance: 1.2,
          cameraRotateY: 0,
          cameraView: "upper",
          lipsyncLang: "en",
          mood: "neutral",
          ttsLang: "en-GB",
          ttsRate: 1.5
        }
      }));

      console.log('Updating topicPanel-participants:', participants);
      localStorage.setItem('topicPanel-participants', JSON.stringify(participants));
      
      // Update the store with new speakers data
      if (window.editorStore && typeof window.editorStore.getState === 'function') {
        window.editorStore.getState().setSpeakers(participants);
      } else if (useEditorStore && typeof useEditorStore.getState === 'function') {
        useEditorStore.getState().setSpeakers(participants);
      }
      
      // Dispatch both storage and custom events to ensure all components are notified
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'aiPanelData',
        newValue: JSON.stringify(dataToSave),
        storageArea: localStorage
      }));
      
      window.dispatchEvent(new Event('topicChanged'));
      
      // Dispatch a participants changed event
      window.dispatchEvent(new Event('participantsChanged'));
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  }, [selectedParticipants, currentTopic, humanParticipants]);

  return (
    <div className="absolute bottom-0 left-0 w-[300px] mr-auto p-2 flex items-center justify-center theme-bg-secondary theme-border-t z-50">
      <div className="flex gap-2">
        <button 
          className={`px-3 py-2 rounded-md flex items-center gap-2 transition-all duration-200 shadow-sm ${
            editAgent 
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium' 
              : 'bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50'
          }`}
          onClick={() => {
            setEditAgent(true);
            setShowPreview(false);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
            <path d="M12 10v6"/>
            <path d="m9 13 3-3 3 3"/>
          </svg>
          <span>Library</span>
        </button>
        {previewInitialized && (
          <button 
            className={`px-3 py-2 rounded-md flex items-center gap-2 transition-all duration-200 shadow-sm ${
              showPreview 
                                  ? 'bg-gradient-to-r from-sky-600 to-sky-500 text-white font-medium'
                  : 'bg-white border-2 border-sky-500 text-sky-600 hover:bg-sky-50'
            }`}
            onClick={() => {
              setEditAgent(false);
              setShowPreview(true);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <span>Preview</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default NavigationPanel; 