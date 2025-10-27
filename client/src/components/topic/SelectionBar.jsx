import React, {useState, useEffect, useRef, useCallback} from 'react';
import useEditorStore from '../inspector/store';
import { generateModelThumbnailCache } from '../avatarconfig/utils/modelThumbnailGenerator';

// Default names by gender
const defaultMaleNames = ['Bob', 'David', 'Henry'];
const defaultFemaleNames = ['Alice', 'Ivy', 'Grace', 'Jane'];

// Gender mapping for names to use appropriate voices
const nameGenderMap = {
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

const SelectionBar = ({
  avatarUrls,
  onAvatarConfigRequest,
  participantNames = [],
  currentScene, // Add currentScene prop to track imported avatars
  handleParticipantsSelected = () => {}, // Provide a default empty function
}) => {
  const { setSelectedItem } = useEditorStore();
  const [thumbnails, setThumbnails] = useState({});
  const [loadingIndices, setLoadingIndices] = useState(new Set());
  const [currentParticipants, setCurrentParticipants] = useState([]);
  const [currentUrls, setCurrentUrls] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const thumbnailCacheRef = useRef({}); // Add ref for persistent cache
  
  // Get human participants information from localStorage
  const [humanParticipants, setHumanParticipants] = useState([]);
  const initialLoadDoneRef = useRef(false);
  const humanParticipantsRef = useRef([]);
  
  // State for human participants menu
  const [showHumanMenu, setShowHumanMenu] = useState(false);

  // Function to load human participants from localStorage
  const loadHumanParticipants = useCallback(() => {
    try {
      const savedData = localStorage.getItem('aiPanelData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        // Only update if we have valid data and it's different from current state
        if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
          console.log('Loading human participants in SelectionBar:', parsedData.humanParticipants);
          
          // Compare with our ref instead of previous state to avoid unnecessary updates
          if (JSON.stringify(humanParticipantsRef.current) !== JSON.stringify(parsedData.humanParticipants)) {
            console.log('Setting new human participants:', parsedData.humanParticipants);
            humanParticipantsRef.current = [...parsedData.humanParticipants];
            setHumanParticipants([...parsedData.humanParticipants]);
          } else {
            console.log('No change in participants, keeping current:', humanParticipantsRef.current);
          }
        }
      }
    } catch (error) {
      console.error('Error loading human participants from localStorage:', error);
    }
  }, []);

  // Initial load of human participants from localStorage
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      loadHumanParticipants();
    }
  }, [loadHumanParticipants]);

  // Listen for changes in localStorage
  useEffect(() => {
    // Add event listener for localStorage changes
    const handleStorageChange = (e) => {
      if (e.key === 'aiPanelData') {
        console.log('aiPanelData changed, reloading human participants');
        // Add a small delay to ensure we get the latest data
        setTimeout(loadHumanParticipants, 50);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('humanParticipantsChanged', loadHumanParticipants);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('humanParticipantsChanged', loadHumanParticipants);
    };
  }, [loadHumanParticipants]);

  // Update humanParticipantsRef when the state changes to keep them in sync
  useEffect(() => {
    humanParticipantsRef.current = humanParticipants;
  }, [humanParticipants]);

  // Function to check if an avatar is imported in the scene
  const isAvatarImported = (name, index) => {
    if (!currentScene || !currentScene.boxes) return false;
    
    // Check all boxes in the scene
    return currentScene.boxes.some(box => {
      // Check elements array first (new structure)
      if (box.elements) {
        return box.elements.some(element => 
          element.elementType === 'avatar' && 
          element.avatarData && 
          element.avatarData.name === name
        );
      }
      // Check legacy avatarSlots
      if (box.avatarSlots) {
        return box.avatarSlots.some(slot => 
          slot.avatarData && 
          slot.avatarData.name === name
        );
      }
      // Check direct avatarData (legacy)
      if (box.avatarData && box.avatarData.name === name) {
        return true;
      }
      return false;
    });
  };

  // Detect changes in participants or URLs
  useEffect(() => {
    const participantsChanged = JSON.stringify(participantNames) !== JSON.stringify(currentParticipants);
    const urlsChanged = JSON.stringify(avatarUrls) !== JSON.stringify(currentUrls);
    
    if (participantsChanged || urlsChanged) {
      setCurrentParticipants([...participantNames]);
      setCurrentUrls([...avatarUrls]);
      
      // Find new URLs and their correct indices
      const newUrlsWithIndices = avatarUrls.map((url, index) => ({
        url,
        index
      })).filter(({ url, index }) => !thumbnailCacheRef.current[index]);
      
      if (newUrlsWithIndices.length > 0) {
        // Generate thumbnails for new URLs
        generateThumbnailsForUrls(newUrlsWithIndices);
      }
    }
  }, [participantNames, avatarUrls]);

  // Separate function to generate thumbnails
  const generateThumbnailsForUrls = async (urlsWithIndices) => {
    if (!urlsWithIndices || urlsWithIndices.length === 0) return;
    
    try {
      setLoadingIndices(new Set(urlsWithIndices.map(({ index }) => index)));
      // Extract just the URLs for thumbnail generation
      const urls = urlsWithIndices.map(({ url }) => url);
      console.log('Generating thumbnails for new URLs:', urls);
      const thumbnailCache = await generateModelThumbnailCache(urls);
      
      // Map the generated thumbnails back to their correct indices
      const indexedThumbnails = {};
      urlsWithIndices.forEach(({ index }, i) => {
        indexedThumbnails[index] = thumbnailCache[i];
      });
      
      // Update both the ref cache and state with correct indices
      thumbnailCacheRef.current = {
        ...thumbnailCacheRef.current,
        ...indexedThumbnails
      };
      setThumbnails(thumbnailCacheRef.current);
    } catch (error) {
      console.error('Failed to generate thumbnails:', error);
    } finally {
      setLoadingIndices(new Set());
    }
  };

  // Remove the old thumbnail generation effect since we're handling it directly in the change detection effect
  useEffect(() => {
    if (!avatarUrls || avatarUrls.length === 0) {
      setLoadingIndices(new Set());
    }
  }, [avatarUrls]);

  // Default avatar settings
  const DEFAULT_AVATAR_SETTINGS = {
    ttsLang: "en-GB",
    lipsyncLang: "en",
    cameraView: "upper",
    cameraDistance: 0.1,
    cameraRotateY: 0,
    mood: "neutral"
  };

  // Get avatar configuration based on participant name and index
  const getAvatarConfig = (name, index) => {
    // Determine gender from name or avatarUrl
    const gender = nameGenderMap[name] || 'unknown';
    const isMale = gender === 'male' || 
             (avatarUrls[index] && 
              avatarUrls[index].includes('/male-avatar') && 
              !avatarUrls[index].includes('/female-avatar'));
    // Alternate between different voice types for variety
    const maleVoices = ["en-GB-Standard-B", "en-GB-Standard-D", "en-GB-Standard-O", "en-GB-Standard-B"];
    const femaleVoices = ["en-GB-Standard-A", "en-GB-Standard-C", "en-GB-Standard-F", "en-GB-Standard-N"];
    
    // Select voice based on gender and index for variety
    const voiceIndex = index % 4;
    const voice = isMale ? maleVoices[voiceIndex] : femaleVoices[voiceIndex];
    
    // Select mood based on index for variety
    const moods = ["neutral", "happy", "sad", "angry", "love", "fear"];
    const mood = moods[index % moods.length];

    // Check if this participant is human
    const isHuman = humanParticipants.includes(name);

    return {
      name: name,
      url: avatarUrls[index],
      settings: {
        ...DEFAULT_AVATAR_SETTINGS,
        body: isMale ? "M" : "F",
        mood: mood
      },
      voice: voice,
      gender: isMale ? 'male' : 'female', // Add gender info to config
      isHuman: isHuman // Add human flag to config
    };
  };

  const handleDragStart = (e, index) => {
    if (index >= participantNames.length) {
      console.error('Participant not found for index:', index);
      return;
    }

    const name = participantNames[index];
    const avatarConfig = getAvatarConfig(name, index);

    console.log('Dragging avatar:', name, 'with config:', avatarConfig);
    
    const avatarData = {
      type: 'avatar',
      index,
      persona: avatarConfig
    };

    console.log('Dragging avatar with data:', avatarData);
    e.dataTransfer.setData('application/json', JSON.stringify(avatarData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAvatarClick = (index) => {
    setSelectedAvatar(index);
    
    if (index < participantNames.length) {
      const name = participantNames[index];
      const avatarConfig = getAvatarConfig(name, index);
      
      // Debug info
      console.log(`Avatar ${index} (${name}) config:`, {
        gender: nameGenderMap[name] || 'unknown',
        url: avatarUrls[index],
        isMale: avatarUrls[index]?.includes('male-avatar')
      });
      
      // This will set the selected item in the store to open the inspector
      setSelectedItem({avatarConfig, type: "avatar", id: index });
      
      // Call the new prop function to request avatar config scene
      if (onAvatarConfigRequest) {
        onAvatarConfigRequest(avatarConfig);
      }
    }
  };
  
  // Toggle human status for a participant
  const toggleHumanStatus = (name) => {
    let updatedHumanParticipants;
    if (humanParticipants.includes(name)) {
      updatedHumanParticipants = humanParticipants.filter(p => p !== name);
    } else {
      updatedHumanParticipants = [...humanParticipants, name];
    }
    
    // Update state and ref
    setHumanParticipants(updatedHumanParticipants);
    humanParticipantsRef.current = updatedHumanParticipants;
    
    // Update localStorage directly
    try {
      const savedData = localStorage.getItem('aiPanelData') || '{}';
      const parsedData = JSON.parse(savedData);
      
      // Update with new human participants
      parsedData.humanParticipants = updatedHumanParticipants;
      
      // Save back to localStorage
      localStorage.setItem('aiPanelData', JSON.stringify(parsedData));
      
      // Dispatch a custom event to notify other components
      setTimeout(() => {
        window.dispatchEvent(new Event('humanParticipantsChanged'));
        
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'aiPanelData',
          newValue: JSON.stringify(parsedData),
          storageArea: localStorage
        }));
      }, 0);
    } catch (error) {
      console.error('Error updating human participants:', error);
    }
  };
  
  // Check if handleParticipantsSelected is provided
  const updateParticipants = useCallback((newParticipants) => {
    if (typeof handleParticipantsSelected === 'function') {
      handleParticipantsSelected(newParticipants);
    } else {
      console.warn('handleParticipantsSelected is not a function');
    }
  }, [handleParticipantsSelected]);

  return (
    <div className="selection-bar h-full p-2 px-3 overflow-y-auto bg-gray-50 rounded-lg shadow">
      <div className="space-y-1 w-full">
        {Array.from({ length: Math.max(participantNames.length, avatarUrls.length) }).map((_, index) => {
          const name = participantNames[index] || `Participant ${index + 1}`;
          const gender = nameGenderMap[name] || 'unknown';
          const isMale = gender === 'male';
          const isImported = isAvatarImported(name, index);
          const avatarConfig = getAvatarConfig(name, index);
          const isLoading = loadingIndices.has(index);
          const isHuman = humanParticipants.includes(name);
          
          return (
            <div
              key={index}
              className={`flex items-center p-1.5 rounded-md transition
                ${isImported ? 'bg-gray-50' : 'hover:bg-blue-50 cursor-move'}
                ${selectedAvatar === index ? 'ring-1 ring-blue-500 bg-blue-50' : ''}
                ${isHuman ? 'border-l-4 border-green-400' : ''}`}
              draggable={!isImported}
              onDragStart={(e) => !isImported && handleDragStart(e, index)}
              onClick={() => handleAvatarClick(index)}
            >
              {/* Avatar thumbnail */}
              <div 
                className={`relative w-8 h-8 rounded-full overflow-hidden border
                  ${isImported ? 'border-gray-300' : 'border-gray-200'}
                  ${isMale ? 'bg-blue-50' : 'bg-pink-50'}`}
              >
                {thumbnails[index] ? (
                  <img 
                    src={thumbnails[index]} 
                    alt={name}
                    className="w-full h-full object-cover" 
                  />
                ) : isLoading ? (
                  <div className="flex items-center justify-center w-full h-full">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full h-full">
                    <span className="text-xs text-gray-500">{name[0]}</span>
                  </div>
                )}
                {!isImported && (
                  <div className="absolute inset-0 bg-black/30" />
                )}
              </div>

              {/* Avatar info */}
              <div className="ml-2 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className={`text-sm font-medium ${isImported ? 'text-gray-500' : 'text-gray-900'} truncate`}>{name}</span>
                    {isHuman && (
                      <span className="ml-2 text-xs font-medium text-green-500 bg-green-50 px-1.5 py-0.5 rounded">
                        Human
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center text-xs text-gray-500 space-x-2">
                  <span className="truncate">{avatarConfig.voice}</span>
                  <span>•</span>
                  <span>{avatarConfig.settings.mood}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelectionBar;