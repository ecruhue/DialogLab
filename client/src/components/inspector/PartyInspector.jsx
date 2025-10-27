import React, { useState, useEffect } from 'react';
import { X, Trash, Plus, HelpCircle } from 'lucide-react';
import useEditorStore, { getDefaultParties } from './store';
import { cleanupPartyConfigs } from '../avatarconfig/utils/partyHelpers';

const PartyInspector = ({ party }) => {
  // Initialize parties state with an empty array
  const [parties, setParties] = useState(getDefaultParties());
  const [isCreatingParty, setIsCreatingParty] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [boxAvatars, setBoxAvatars] = useState([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(true);
  const [activeTab, setActiveTab] = useState('basic'); // Add state for active tab

  const { updateSelectedItem, activeSceneId, scenes, updatePartyForBox } = useEditorStore();
  
  const [storedParty, setStoredParty] = useState({
    id: '',
    type: 'party',
    name: '',
    description: '',
    speakingMode: 'random',
    hasRepresentative: false,
    enableBackchannel: false,
    representativeSpeaker: '',
    participantIds: [],
    partyTurnMode: 'free',
    isModeratorParty: false,
    subsetSize: null
  });

  // Add debug effect to monitor scene state
  useEffect(() => {
    console.log('PartyInspector - Current Scene State:', {
      scenesExist: !!scenes,
      sceneCount: scenes?.length,
      activeSceneId,
      activeScene: scenes?.find(s => s.name === activeSceneId),
      allSceneIds: scenes?.map(s => s.name)
    });
  }, [scenes, activeSceneId]);

  // Helper function to find the box and extract avatars
  const findBoxAndExtractAvatars = (boxId, context = "default") => {
    setIsLoadingAvatars(true);
    console.log(`[${context}] Looking for avatars for party/box with ID:`, boxId);
    console.log('Current store state:', {
      hasScenes: !!scenes,
      sceneCount: scenes?.length,
      activeSceneId,
      party
    });
    
    // Find the active scene
    let activeScene = null;
    if (scenes && Array.isArray(scenes) && scenes.length > 0) {
      activeScene = activeSceneId ? scenes.find(s => s.id === activeSceneId) : scenes[0];
      console.log('Found active scene:', activeScene, 'with boxes:', activeScene?.boxes?.length);
    }
    
    if (!activeScene) {
      console.log(`[${context}] No active scene found. Available scenes:`, 
        scenes?.map(s => ({ id: s.name, boxCount: s.boxes?.length }))
      );
      setBoxAvatars([]);
      setIsLoadingAvatars(false);
      return;
    }

    console.log(`[${context}] Active scene found:`, activeScene.name);

    // Find the box in the active scene
    const boxInScene = activeScene.boxes?.find(box => box.id === boxId);
    if (!boxInScene) {
      console.log(`[${context}] Box not found in active scene`);
      setBoxAvatars([]);
      setIsLoadingAvatars(false);
      return;
    }
    extractAvatarsFromBox(boxInScene);
  };

  // Load saved parties from localStorage when component mounts
  useEffect(() => {
    try {
      const savedParties = localStorage.getItem('savedParties');
      
      if (savedParties) {
        try {
          const parsedParties = JSON.parse(savedParties);
          setParties(parsedParties);
        } catch (error) {
          console.error('Error parsing saved parties:', error);
          // Fall back to default parties if there's an error
          setParties(getDefaultParties());
        }
      } else {
        // If no saved parties exist, initialize with defaults
        setParties(getDefaultParties());
      }
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      setParties(getDefaultParties());
    }
  }, []);
  

  // Get avatars for the selected box from the scenes data
  useEffect(() => {
    if (!party || !party.id) {
      setBoxAvatars([]);
      setIsLoadingAvatars(false);
      return;
    }

    // Use a short delay to avoid excessive avatar refreshing during scene manipulations
    const timer = setTimeout(() => {
      findBoxAndExtractAvatars(party.id, "useEffect");
    }, 300);
    
    return () => clearTimeout(timer);
  }, [party?.id, activeSceneId, scenes]);

  // Function to extract avatars from a box
  const extractAvatarsFromBox = (box) => {
    if (!box) {
      console.log("extractAvatarsFromBox: Box is null or undefined");
      setBoxAvatars([]);
      setIsLoadingAvatars(false);
      return;
    }
    
    console.log("extractAvatarsFromBox: Processing box:", box);
    const avatars = [];
    
    // Check for elements array with avatar elements
    if (box.elements && Array.isArray(box.elements)) {
      const avatarElements = box.elements.filter(el => el.elementType === 'avatar' && el.avatarData);

      avatarElements.forEach(element => {
        avatars.push({
          id: element.id,
          name: element.avatarData.name || 'Unnamed Avatar',
          avatarData: element.avatarData
        });
      });
    }

    // Remove duplicates based on ID
    const uniqueAvatars = avatars.filter((avatar, index, self) =>
      index === self.findIndex(a => a.id === avatar.id)
    );
    
    setBoxAvatars(uniqueAvatars);
    setIsLoadingAvatars(false);
  };
  
  // Update form state when party changes or the scene updates
  useEffect(() => {
    if (party) {
      console.log("Party or scene updated - checking for party assignment:", {
        partyId: party.id, 
        partyName: party.name
      });
      
      // First check if we have saved configuration for this specific party ID
      let savedPartyConfigs = {};
      try {
        savedPartyConfigs = JSON.parse(localStorage.getItem('partyConfigs') || '{}');
      } catch (error) {
        console.error('Error parsing party configs from localStorage:', error);
        savedPartyConfigs = {};
      }
      
      const savedConfig = party.id ? savedPartyConfigs[party.id] : undefined;
      
      // Get current party name from active scene if it exists
      let currentPartyName = party.name;
      
      // Check if there's an active scene and the box has a party assignment
      if (scenes && activeSceneId) {
        const currentActiveScene = scenes.find(scene => scene.id === activeSceneId);
        if (currentActiveScene && currentActiveScene.boxes) {
          const box = currentActiveScene.boxes.find(box => box.id === party.id);
          if (box) {
            console.log(`Box found in scene. Current party assignment:`, box.party || 'none');
            
            // If there's a party assigned to this box in the scene, prioritize that
            if (box.party) {
              currentPartyName = box.party;
              
              // Get party description from saved parties if available
              let savedParties = [];
              try {
                savedParties = JSON.parse(localStorage.getItem('savedParties') || '[]');
              } catch (error) {
                console.error('Error parsing saved parties from localStorage:', error);
                savedParties = [];
              }
              
              const partyConfig = savedParties.find(p => p.name === currentPartyName);
              
              console.log(`Found party name in scene: ${currentPartyName}, description: ${partyConfig?.description || 'none'}`);
              
              if (partyConfig) {
                // This will ensure the inspector UI is in sync with the scene data
                setStoredParty(prev => ({
                  id: party.id || '',
                  type: party.type || 'party',
                  name: currentPartyName,
                  description: partyConfig.description || `Default description for ${currentPartyName}. Edit this to provide context about this party's role and behavior.`,
                  speakingMode: partyConfig.speakingMode || 'random',
                  hasRepresentative: partyConfig.hasRepresentative || false,
                  enableBackchannel: partyConfig.enableBackchannel || false,
                  representativeSpeaker: savedConfig?.representativeSpeaker || '',
                  participantIds: savedConfig?.participantIds || [],
                  partyTurnMode: savedConfig?.partyTurnMode || 'free',
                  isModeratorParty: savedConfig?.isModeratorParty || false,
                  subsetSize: savedConfig?.speakingMode === 'subset' ? (savedConfig?.subsetSize || 2) : null
                }));
                
                console.log('Updated form state with party data from scene');
                setIsLoadingAvatars(true);
                setTimeout(() => {
                  findBoxAndExtractAvatars(party.id, "party-sync");
                }, 50);
                
                return; // Skip the rest of the function
              } else {
                // No party template found - create a default description
                const defaultDesc = `Default description for ${currentPartyName}. Edit this to provide context about this party's role and behavior.`;
                
                // Add this party to our templates to persist the description
                const updatedParties = [
                  ...parties,
                  {
                    name: currentPartyName,
                    description: defaultDesc,
                    speakingMode: 'random',
                    hasRepresentative: false,
                    enableBackchannel: false
                  }
                ];
                
                // Update the template list
                setParties(updatedParties);
                localStorage.setItem('savedParties', JSON.stringify(updatedParties));
                
                // Set the party with the default description
                setStoredParty(prev => ({
                  ...prev,
                  name: currentPartyName,
                  description: defaultDesc,
                  speakingMode: 'random',
                  hasRepresentative: false,
                  enableBackchannel: false,
                  subsetSize: null
                }));
                
                console.log(`Created default description for party "${currentPartyName}"`);
                return;
              }
            } else {
              // This is important - if there's no party assigned in the scene,
              // we should make sure the inspector reflects that by clearing the name
              setStoredParty(prev => ({
                ...prev,
                name: '',
                description: '',
                subsetSize: null
              }));
              
              console.log('No party assigned in scene, cleared inspector form state');
              return;
            }
          }
        }
      }
      
      if (savedConfig) {
        // If we have a saved configuration for this party ID, use it
        setStoredParty(prev => ({
          id: party.id || '',
          type: party.type || 'party',
          name: savedConfig?.name || party.name || '',
          description: savedConfig?.description || party.description || `Default description for ${savedConfig?.name || party.name || 'Party'}. Edit this to provide context about this party's role and behavior.`,
          speakingMode: savedConfig?.speakingMode || party.speakingMode || 'random',
          hasRepresentative: savedConfig?.hasRepresentative !== undefined ? savedConfig?.hasRepresentative : party.hasRepresentative || false,
          enableBackchannel: savedConfig?.enableBackchannel !== undefined ? savedConfig?.enableBackchannel : party.enableBackchannel || false,
          representativeSpeaker: savedConfig?.representativeSpeaker || party.representativeSpeaker || '',
          participantIds: savedConfig?.participantIds || party.participantIds || [],
          partyTurnMode: savedConfig?.partyTurnMode || party.partyTurnMode || 'free',
          isModeratorParty: savedConfig?.isModeratorParty !== undefined ? savedConfig?.isModeratorParty : party.isModeratorParty || false,
          subsetSize: savedConfig?.speakingMode === 'subset' ? (savedConfig?.subsetSize || 2) : null
        }));
        
        console.log(`Loaded saved configuration for party ID: ${party.id}`);
      } else {
        // Otherwise use the current party properties
        setStoredParty(prev => ({
          id: party.id || '',
          type: party.type || 'party',
          name: party.name || '',
          description: party.description || `Default description for ${party.name || 'Party'}. Edit this to provide context about this party's role and behavior.`,
          speakingMode: 'random',
          hasRepresentative: party.hasRepresentative || false,
          enableBackchannel: party.enableBackchannel || false,
          representativeSpeaker: party.representativeSpeaker || '',
          participantIds: party.participantIds || [],
          partyTurnMode: party.partyTurnMode || 'free',
          isModeratorParty: party.isModeratorParty || false,
          subsetSize: null
        }));
      }
      
      // Immediately refresh avatars when party changes
      setIsLoadingAvatars(true);
      setTimeout(() => {
        findBoxAndExtractAvatars(party.id, "party-changed");
      }, 50);
    }
  }, [party, scenes, activeSceneId, party?.id, parties]);

  // Also refresh on component mount if party exists
  useEffect(() => {
    if (party && party.id) {
      console.log("PartyInspector mounted, refreshing avatars for:", party.id);
      setIsLoadingAvatars(true);
      setTimeout(() => {
        findBoxAndExtractAvatars(party.id, "component-mount");
      }, 100);
    }
  }, []);

  // Special effect to react to selectedItem changes from the store
  // This ensures we immediately update when a party is assigned via the dropdown in ConversationGroup
  useEffect(() => {
    if (party && party.name) {
      console.log("Party name in selectedItem changed to:", party.name);
      
      // Update the form state with new data from party
      setStoredParty(prev => ({
        ...prev,
        name: party.name || '',
        description: party.description || '',
        speakingMode: party.speakingMode || prev.speakingMode || 'random',
        hasRepresentative: party.hasRepresentative !== undefined ? party.hasRepresentative : prev.hasRepresentative,
        enableBackchannel: party.enableBackchannel !== undefined ? party.enableBackchannel : prev.enableBackchannel,
        representativeSpeaker: party.representativeSpeaker || prev.representativeSpeaker || '',
        participantIds: party.participantIds?.length > 0 ? party.participantIds : prev.participantIds,
        subsetSize: party.speakingMode === 'subset' ? (party.subsetSize || 2) : null
      }));
    }
  }, [party?.name, party?.description, party?.speakingMode, party?.hasRepresentative, party?.enableBackchannel, party?.representativeSpeaker, party?.participantIds]);

  // Special effect to detect party assignments directly from scene data,
  // which might happen when dropdown is used in ConversationGroup
  useEffect(() => {
    if (!party || !party.id || !scenes || !activeSceneId) return;
    
    console.log("Scene or activeSceneId changed - checking for party assignments");
    
    // Find the active scene
    const currentActiveScene = scenes.find(scene => scene.id === activeSceneId);
    if (!currentActiveScene || !currentActiveScene.boxes) return;
    
    // Find the box in scene
    const box = currentActiveScene.boxes.find(box => box.id === party.id);
    if (!box) return;
    
    console.log(`Found box in scene, party assignment:`, box.party || 'none');
    
    // Always update form state when box party changes, not just on mismatch
    if (box.party !== storedParty.name) {
      console.log(`Party assignment changed: Scene has "${box.party || 'none'}" but form has "${storedParty.name || 'none'}"`);
      
      if (box.party) {
        // Find the party details from saved parties
        let savedParties = [];
        try {
          savedParties = JSON.parse(localStorage.getItem('savedParties') || '[]');
        } catch (error) {
          console.error('Error parsing saved parties from localStorage:', error);
          savedParties = [];
        }
        
        const partyConfig = savedParties.find(p => p.name === box.party);
        
        if (partyConfig) {
          console.log(`Found party details for "${box.party}" in saved parties`);
          
          // Update the form state
          setStoredParty(prev => ({
            ...prev,
            name: box.party,
            description: partyConfig.description || prev.description || '',
            speakingMode: partyConfig.speakingMode || 'random',
            hasRepresentative: partyConfig.hasRepresentative || false,
            enableBackchannel: partyConfig.enableBackchannel || false,
            subsetSize: partyConfig.speakingMode === 'subset' ? (partyConfig.subsetSize || 2) : null
          }));
        } else {
          // Just update the name if we don't have details
          console.log(`No details found for party "${box.party}", just updating name`);
          setStoredParty(prev => ({
            ...prev,
            name: box.party,
            description: prev.description || '',
            subsetSize: null
          }));
        }
      } else {
        // Clear form if no party assigned
        console.log('No party assigned, clearing form');
        setStoredParty(prev => ({
          ...prev,
          name: '',
          description: '',
          subsetSize: null
        }));
      }
      
      // Refresh avatars after party change
      setIsLoadingAvatars(true);
      setTimeout(() => {
        findBoxAndExtractAvatars(party.id, "party-change");
      }, 50);
    }
  }, [scenes, activeSceneId, party?.id, storedParty.name]);

  // Add a new effect to sync the party selector with box party changes
  useEffect(() => {
    if (!party || !party.id || !scenes || !activeSceneId) return;
    
    const currentActiveScene = scenes.find(scene => scene.id === activeSceneId);
    if (!currentActiveScene || !currentActiveScene.boxes) return;
    
    const box = currentActiveScene.boxes.find(box => box.id === party.id);
    if (!box) return;
    
    // If the box's party has changed and it's not in our parties list, add it
    if (box.party && !parties.some(p => p.name === box.party)) {
      console.log(`Adding new party "${box.party}" to available parties`);
      setParties(prev => [
        ...prev,
        {
          name: box.party,
          description: `Default description for ${box.party}. Edit this to provide context about this party's role and behavior.`,
          speakingMode: 'random',
          hasRepresentative: false,
          enableBackchannel: false
        }
      ]);
    }
  }, [scenes, activeSceneId, party?.id, parties]);

  // When a predefined party is selected, load its details
  const handlePartySelect = (selectedPartyName) => {
    console.log(`handlePartySelect: Selected party name: "${selectedPartyName}"`);
    
    // If empty selection, clear the form
    if (!selectedPartyName) {
      console.log('handlePartySelect: Empty selection, clearing form');
      setStoredParty(prev => ({
        ...prev,
        name: '',
        description: '',
        speakingMode: 'random',
        hasRepresentative: false,
        enableBackchannel: false,
        subsetSize: null
      }));
      
      // Also immediately update the party in the box to null
      if (party && party.id) {
        console.log(`handlePartySelect: Removing party from box ${party.id}`);
        updatePartyForBox(party.id, null);
      }
      
      return;
    }
    
    // Find the selected party in the available parties
    const existingParty = parties.find(p => p.name === selectedPartyName);
    
    if (existingParty) {
      console.log(`handlePartySelect: Selected party "${selectedPartyName}" found in party templates:`, existingParty);
      
      // Update form with party template data
      setStoredParty(prev => ({
        ...prev,
        name: selectedPartyName,
        description: existingParty.description || `Default description for ${selectedPartyName}. Edit this to provide context about this party's role and behavior.`,
        speakingMode: existingParty.speakingMode || 'random',
        hasRepresentative: existingParty.hasRepresentative || false,
        enableBackchannel: existingParty.enableBackchannel || false,
        subsetSize: existingParty.speakingMode === 'subset' ? (existingParty.subsetSize || 2) : null
      }));
      
      // Also immediately update the party in the box to ensure real-time synchronization
      if (party && party.id) {
        console.log(`handlePartySelect: Updating box ${party.id} with party ${selectedPartyName}`);
        updatePartyForBox(party.id, selectedPartyName);
      }
    } else {
      console.log(`handlePartySelect: Selected party "${selectedPartyName}" not found in templates, creating basic entry`);
      
      // Create default description for new parties
      const defaultDescription = `Default description for ${selectedPartyName}. Edit this to provide context about this party's role and behavior.`;
      
      // Just update the name and description for new parties
      setStoredParty(prev => ({
        ...prev,
        name: selectedPartyName,
        description: defaultDescription,
        speakingMode: 'random',
        hasRepresentative: false,
        enableBackchannel: false,
        subsetSize: null
      }));
      
      // Add this party to the available parties list
      const updatedParties = [
        ...parties, 
        {
          name: selectedPartyName,
          description: defaultDescription,
          speakingMode: 'random',
          hasRepresentative: false,
          enableBackchannel: false
        }
      ];
      
      setParties(updatedParties);
      localStorage.setItem('savedParties', JSON.stringify(updatedParties));
      
      // Also immediately update the party in the box
      if (party && party.id) {
        console.log(`handlePartySelect: Updating box ${party.id} with new party ${selectedPartyName}`);
        updatePartyForBox(party.id, selectedPartyName);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'speakingMode') {
      setStoredParty(prev => ({ 
        ...prev, 
        [name]: value,
        // Automatically set hasRepresentative based on speaking mode
        hasRepresentative: value === 'representative',
        subsetSize: value === 'subset' ? (prev.subsetSize || 2) : null
      }));
    } else {
      setStoredParty(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setStoredParty(prev => ({ ...prev, [name]: checked }));
  };

  const handleCreateParty = () => {
    if (newPartyName.trim()) {
      const trimmedPartyName = newPartyName.trim();
      
      // Check if party already exists
      const existingParty = parties.find(p => p.name === trimmedPartyName);
      
      if (!existingParty) {
        // If not existing, add to parties with a default description
        const defaultDescription = `Default description for ${trimmedPartyName}. Edit this to provide context about this party's role and behavior.`;
        
        const newParty = {
          name: trimmedPartyName,
          description: defaultDescription,
          speakingMode: 'random',
          hasRepresentative: false,
          enableBackchannel: false,
          participantIds: []
        };
        
        const updatedParties = [...parties, newParty];
        setParties(updatedParties);
        
        // Save to localStorage
        localStorage.setItem('savedParties', JSON.stringify(updatedParties));
      
        // Select the newly created party and set its description
      setStoredParty(prev => ({
        ...prev,
        name: trimmedPartyName,
          description: defaultDescription,
          speakingMode: 'random',
          hasRepresentative: false,
          enableBackchannel: false,
          subsetSize: null
        }));
      } else {
        // If party exists, use its description
        setStoredParty(prev => ({
          ...prev,
          name: trimmedPartyName,
          description: existingParty.description || `Default description for ${trimmedPartyName}. Edit this to provide context about this party's role and behavior.`,
          speakingMode: existingParty.speakingMode ?? 'random',
          hasRepresentative: existingParty.hasRepresentative ?? false,
          enableBackchannel: existingParty.enableBackchannel ?? false,
          subsetSize: existingParty.speakingMode === 'subset' ? (existingParty.subsetSize || 2) : null
        }));
      }
      
      // Reset create party state
      setNewPartyName('');
      setIsCreatingParty(false);
      
      // If we're editing an existing party, immediately update it in the box
      if (party && party.id) {
        updatePartyForBox(party.id, trimmedPartyName);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Log party assignment data for debugging
    console.log("Submitting party form with:", {
      id: party.id,
      storedPartyNameValue: storedParty.name,
      currentPartyName: party.name,
    });
    
    try {
      // First update the box's party in the scene to ensure synchronization
      updatePartyForBox(party.id, storedParty.name || null);
      
      // Create the updated party object with all necessary properties
      const updatedParty = {
        ...party, // Keep all original properties
        name: storedParty.name,
        description: storedParty.description,
        speakingMode: storedParty.speakingMode,
        hasRepresentative: storedParty.hasRepresentative,
        enableBackchannel: storedParty.enableBackchannel,
        representativeSpeaker: storedParty.representativeSpeaker,
        participantIds: storedParty.participantIds
      };
      
      // Update the selected item in the store
      updateSelectedItem(updatedParty);
      
      // Save the current party configuration to localStorage by ID for future retrieval
      let savedPartyConfigs = {};
      try {
        savedPartyConfigs = JSON.parse(localStorage.getItem('partyConfigs') || '{}');
      } catch (error) {
        console.error('Error parsing party configs from localStorage:', error);
        savedPartyConfigs = {};
      }
      
      // Store using the party's ID as the key
      savedPartyConfigs[party.id] = {
        name: storedParty.name,
        description: storedParty.description,
        speakingMode: storedParty.speakingMode,
        hasRepresentative: storedParty.hasRepresentative,
        enableBackchannel: storedParty.enableBackchannel,
        representativeSpeaker: storedParty.representativeSpeaker,
        participantIds: storedParty.participantIds,
        partyTurnMode: storedParty.partyTurnMode,
        isModeratorParty: storedParty.isModeratorParty,
        subsetSize: storedParty.subsetSize
      };
      
      // Save the updated configurations and dispatch a storage event
      try {
        localStorage.setItem('partyConfigs', JSON.stringify(savedPartyConfigs));
        window.dispatchEvent(new Event('storage')); // Trigger storage event for immediate detection
      } catch (error) {
        console.error('Error saving party configs to localStorage:', error);
        alert('Could not save party configuration to localStorage. Your browser may have insufficient storage or private browsing mode enabled.');
      }
      
      // Also update the party template in localStorage if it exists
      if (storedParty.name) {
        let savedParties = [];
        try {
          savedParties = JSON.parse(localStorage.getItem('savedParties') || '[]');
        } catch (error) {
          console.error('Error parsing saved parties from localStorage:', error);
          savedParties = [];
        }
        
        // Check if this party already exists in the savedParties
        const existingPartyIndex = savedParties.findIndex(p => p.name === storedParty.name);
        
        if (existingPartyIndex !== -1) {
          // Update existing party template
          savedParties[existingPartyIndex] = {
            ...savedParties[existingPartyIndex],
            description: storedParty.description,
            speakingMode: storedParty.speakingMode,
            hasRepresentative: storedParty.hasRepresentative,
            enableBackchannel: storedParty.enableBackchannel,
            subsetSize: storedParty.subsetSize
          };
        } else {
          // Add new party template
          savedParties.push({
            name: storedParty.name,
            description: storedParty.description,
            speakingMode: storedParty.speakingMode,
            hasRepresentative: storedParty.hasRepresentative,
            enableBackchannel: storedParty.enableBackchannel,
            participantIds: [],
            subsetSize: storedParty.subsetSize
          });
        }
        
        // Save updated parties
        try {
          localStorage.setItem('savedParties', JSON.stringify(savedParties));
          
          // Update the local state
          setParties(savedParties);
        } catch (error) {
          console.error('Error saving saved parties to localStorage:', error);
        }
      }
      
      // Force update the scene to ensure the change sticks
      if (scenes && activeSceneId) {
        const updatedScenes = [...scenes];
        const updatedActiveScene = updatedScenes.find(scene => scene.id === activeSceneId);
        if (updatedActiveScene && updatedActiveScene.boxes) {
          const boxIndex = updatedActiveScene.boxes.findIndex(box => box.id === party.id);
          if (boxIndex !== -1) {
            updatedActiveScene.boxes[boxIndex].party = storedParty.name || null;
            updatedActiveScene.hasUnsavedChanges = true;
            if (window.editorStore && window.editorStore.getState() && window.editorStore.getState().setScenes) {
              window.editorStore.getState().setScenes(updatedScenes);
            }
          }
        }
      }
      
      // Refresh the avatars display to reflect the new saved participantIds
      findBoxAndExtractAvatars(party.id, "after-save");
      
      // Create a temporary element to show a save notification
      const notification = document.createElement('div');
      notification.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg';
      notification.style.zIndex = '9999';
      notification.textContent = 'Party configuration saved successfully!';
      document.body.appendChild(notification);
      
      // Remove the notification after 2 seconds
      setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
          try {
            document.body.removeChild(notification);
          } catch (error) {
            console.error('Error removing notification:', error);
          }
        }, 500);
      }, 2000);
    } catch (error) {
      console.error('Error submitting party form:', error);
      alert('Error saving party configuration. Please try again.');
    }
  };

  // Add a function to handle manual cleanup of party configs
  const handleCleanupPartyConfigs = () => {
    const cleaned = cleanupPartyConfigs(true, [], true); // Pass force=true to override disabled flag
    if (cleaned) {
      // Update the UI state to reflect the cleanup
      setStoredParty({
        id: party?.id || '',
        type: 'party',
        name: '',
        description: '',
        speakingMode: 'random',
        hasRepresentative: false,
        enableBackchannel: false,
        representativeSpeaker: '',
        participantIds: [],
        partyTurnMode: 'free',
        isModeratorParty: false,
        subsetSize: null
      });
      
      // If there's an active scene and box, update it in the store
      if (activeSceneId && party?.id) {
        updatePartyForBox(activeSceneId, party.id, null);
      }
      
      console.log('Manually cleaned up all party configurations');
    }
  };

  // Helper component for tooltip icons
  const TooltipIcon = ({ text }) => (
    <span className="inline-flex items-center ml-1 relative group">
      <HelpCircle size={12} className="theme-text-tertiary hover:theme-text-secondary cursor-help" />
      <span className="absolute left-full top-1/2 transform -translate-y-1/2 ml-1 w-48 theme-bg-tooltip theme-text-inverse text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
        {text}
      </span>
    </span>
  );

  return (
    <div className="p-0 overflow-y-auto max-h-[calc(100vh-6rem)] theme-bg-primary theme-text-primary">
      {/* Sticky header with party selection */}
      <div className="sticky top-0 theme-bg-secondary theme-border-b theme-border p-2 shadow-sm z-10">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="name" className="block text-xs font-medium theme-text-primary">
              Party Assignment
            </label>
            {!isCreatingParty ? (
              <button
                type="button"
                onClick={() => setIsCreatingParty(true)}
                className="p-1 theme-bg-accent theme-text-inverse rounded-md hover:theme-bg-accent-hover transition-colors"
                title="Create New Party"
              >
                <Plus className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center space-x-2">
            <select
              id="name"
              name="name"
              value={storedParty.name}
              onChange={(e) => handlePartySelect(e.target.value)}
              className="w-full p-1.5 theme-bg-input border theme-border theme-focus-ring text-sm theme-text-primary"
            >
              <option value="">Select a Party</option>
              {parties.map(partyOption => (
                <option key={partyOption.name} value={partyOption.name}>
                  {partyOption.name}
                </option>
              ))}
            </select>
          </div>
          
          {isCreatingParty && (
            <div className="theme-bg-panel p-2 rounded-md border theme-border">
              <div className="flex space-x-2 items-center">
                <input
                  type="text"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="New party name"
                  className="flex-grow p-1 theme-bg-input border theme-border rounded-md text-sm theme-text-primary placeholder-gray-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateParty}
                  disabled={!newPartyName.trim()}
                  className="p-1 theme-bg-success theme-text-inverse rounded-md disabled:theme-bg-disabled disabled:theme-text-tertiary disabled:cursor-not-allowed transition-colors"
                >
                  <span className="text-xs">Create</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingParty(false);
                    setNewPartyName('');
                  }}
                  className="p-1 theme-bg-secondary theme-text-tertiary rounded-md hover:theme-bg-tertiary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-2 pt-2 pb-0">
        {/* Party Status Banner - more compact */}
        <div className={`mb-2 p-1.5 rounded-md ${storedParty.name ? 'bg-green-900 border border-green-700' : 'bg-yellow-900 border border-yellow-700'}`}>
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-1.5 ${storedParty.name ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className={`text-xs font-medium ${storedParty.name ? 'text-green-300' : 'text-yellow-300'}`}>
              {storedParty.name ? `Party "${storedParty.name}" assigned` : 'No party assigned'}
            </span>
          </div>
        </div>

        {/* Main Tabbed Interface - more compact tabs */}
        <div className="mb-2">
          <nav className="flex theme-border-b theme-border">
            <button 
              type="button"
              className={`px-2 py-1 border-b-2 text-xs font-medium ${activeTab === 'basic' ? 'theme-border-accent theme-text-accent' : 'border-transparent theme-text-tertiary hover:theme-text-secondary hover:theme-border'}`}
              onClick={() => setActiveTab('basic')}
            >
              Basic
            </button>
            <button 
              type="button"
              className={`px-2 py-1 border-b-2 text-xs font-medium ${activeTab === 'communication' ? 'theme-border-accent theme-text-accent' : 'border-transparent theme-text-tertiary hover:theme-text-secondary hover:theme-border'}`}
              onClick={() => setActiveTab('communication')}
            >
              Party Communication
            </button>
            <button 
              type="button"
              className={`px-2 py-1 border-b-2 text-xs font-medium ${activeTab === 'participants' ? 'theme-border-accent theme-text-accent' : 'border-transparent theme-text-tertiary hover:theme-text-secondary hover:theme-border'}`}
              onClick={() => setActiveTab('participants')}
            >
              Participants
            </button>
          </nav>
          
          <div className="pt-2 space-y-2">
            {/* Basic Configuration Tab Content - more compact */}
            {activeTab === 'basic' && (
              <div className="theme-bg-secondary rounded-md border theme-border overflow-hidden">
                <div className="theme-bg-panel px-3 py-1.5 border-b theme-border">
                  <h3 className="text-xs font-medium theme-text-primary">Basic Configuration</h3>
                </div>
                <div className="p-2 space-y-2">
                  <div className="space-y-1">
                    <label htmlFor="description" className="block text-xs font-medium theme-text-secondary">
                      Description
                      <TooltipIcon text="A brief description of the party's purpose and role in the conversation" />
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={storedParty.description}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full p-1.5 theme-bg-input border theme-border rounded-md theme-focus-ring text-xs theme-text-primary"
                      placeholder="Enter party description"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="speakingMode" className="block text-xs font-medium theme-text-secondary">
                      Speaking Mode
                      <TooltipIcon text="Controls who can speak within this party. 'All' allows everyone to speak, 'Representative' restricts to one speaker, 'Subset' allows a specific number to speak." />
                    </label>
                    <select
                      id="speakingMode"
                      name="speakingMode"
                      value={storedParty.speakingMode}
                      onChange={handleInputChange}
                      className="w-full p-1.5 theme-bg-input border theme-border rounded-md theme-focus-ring text-xs theme-text-primary"
                    >
                      <option value="random">Random Mode</option>
                      <option value="all">All Members Speak</option>
                      <option value="representative">Representative Only</option>
                      <option value="subset">Subset of Members</option>
                    </select>
                  </div>

                  {/* Only show representative selection when speakingMode is set to "representative" */}
                  {storedParty.speakingMode === 'representative' && (
                    <div className="space-y-1 ml-4 p-2 theme-bg-accent-secondary rounded-md border theme-border-accent">
                      <label htmlFor="representativeSpeaker" className="block text-xs font-medium theme-text-secondary">
                        Representative Speaker
                        <TooltipIcon text="The single avatar that will speak on behalf of the entire party" />
                      </label>
                      <select
                        id="representativeSpeaker"
                        name="representativeSpeaker"
                        value={storedParty.representativeSpeaker}
                        onChange={handleInputChange}
                        className="w-full p-1.5 theme-bg-input border theme-border rounded-md theme-focus-ring text-xs theme-text-primary"
                      >
                        <option value="">Select a representative</option>
                        {boxAvatars.map(avatar => (
                          <option key={avatar.id} value={avatar.id}>
                            {avatar.name}
                          </option>
                        ))}
                      </select>
                      {boxAvatars.length === 0 && (
                        <p className="text-xs text-yellow-400 mt-1">
                          No avatars available.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Show subset size input when subset mode is selected */}
                  {storedParty.speakingMode === 'subset' && (
                    <div className="space-y-1 ml-4 p-2 theme-bg-accent-secondary rounded-md border theme-border-accent">
                      <label htmlFor="subsetSize" className="block text-xs font-medium theme-text-secondary">
                        Subset Size
                        <TooltipIcon text="The number of party members that will be randomly selected to speak" />
                      </label>
                      <input
                        type="number"
                        id="subsetSize"
                        name="subsetSize"
                        value={storedParty.subsetSize || ''}
                        onChange={handleInputChange}
                        min="1"
                        max={boxAvatars.length || 10}
                        className="w-full p-1.5 theme-bg-input border theme-border rounded-md theme-focus-ring text-xs theme-text-primary"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Party Communication Tab Content */}
            {activeTab === 'communication' && (
              <div className="space-y-2">
                {/* Turn Taking Section */}
                <div className="theme-bg-secondary rounded-md border theme-border overflow-hidden">
                  <div className="theme-bg-panel px-3 py-1.5 border-b theme-border">
                    <h3 className="text-xs font-medium theme-text-primary">Verbal Communication (Turn Taking)</h3>
                  </div>
                  <div className="p-2 space-y-2">
                    <div className="p-2 theme-bg-info-light border theme-border-info rounded mb-2">
                      <p className="text-xs theme-text-info flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Some party communication settings are now managed globally.
                      </p>
                      <p className="text-xs theme-text-tertiary mt-1">
                        Click the "Party Settings" button in the Scene Hierarchy to access the global party manager.
                      </p>
                    </div>
                    
                    <div className="space-y-1">
                      <label htmlFor="partyTurnMode" className="block text-xs font-medium theme-text-secondary">
                        Party Turn Mode
                        <TooltipIcon text="Controls how speaking turns are managed within the party. 'Free Discussion' allows spontaneous speaking, 'Round Robin' follows a sequence, 'Moderated' requires permission." />
                      </label>
                      <select
                        id="partyTurnMode"
                        name="partyTurnMode"
                        value={storedParty.partyTurnMode}
                        onChange={handleInputChange}
                        className="w-full p-1.5 theme-bg-input border theme-border rounded-md theme-focus-ring text-xs theme-text-primary"
                      >
                        <option value="free">Free Discussion</option>
                        <option value="round-robin">Round Robin</option>
                        <option value="moderated">Moderated (Hand Raising)</option>
                      </select>
                    </div>

                    {/* Moderator Party Selection */}
                    {storedParty.partyTurnMode === 'moderated' && (
                      <div className="p-2 theme-bg-accent-secondary rounded-md border theme-border-accent">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="isModeratorParty"
                            name="isModeratorParty"
                            checked={storedParty.isModeratorParty}
                            onChange={handleCheckboxChange}
                            className="h-3 w-3 theme-text-accent theme-focus-ring theme-border rounded"
                          />
                          <label htmlFor="isModeratorParty" className="ml-2 block text-xs font-medium theme-text-secondary">
                            This party is the moderator
                            <TooltipIcon text="Designates this party as the one that approves raised hands in moderated discussions. Only one party can be the moderator." />
                          </label>
                        </div>
                        <p className="text-xs theme-text-tertiary mt-1 ml-5">
                          Only one party can be the moderator.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Non-Verbal Communication Section */}
                <div className="theme-bg-secondary rounded-md border theme-border overflow-hidden">
                  <div className="theme-bg-panel px-3 py-1.5 border-b theme-border">
                    <h3 className="text-xs font-medium theme-text-primary">Non-Verbal Communication</h3>
                  </div>
                  <div className="p-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="enableBackchannel"
                        name="enableBackchannel"
                        checked={storedParty.enableBackchannel}
                        onChange={handleCheckboxChange}
                        className="h-3 w-3 theme-text-accent theme-focus-ring theme-border rounded"
                      />
                      <label htmlFor="enableBackchannel" className="ml-2 block text-xs font-medium theme-text-secondary">
                        Enable Backchannel
                        <TooltipIcon text="Allows party members to communicate privately with each other without the rest of the conversation hearing them" />
                      </label>
                    </div>
                    <p className="text-xs theme-text-tertiary ml-5">
                      Allow party members to communicate privately
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Participants Tab Content - more compact */}
            {activeTab === 'participants' && (
              <div className="bg-gray-800 rounded-md border border-gray-700 overflow-hidden">
                <div className="bg-gray-700 px-3 py-1.5 border-b border-gray-600 flex justify-between items-center">
                  <h3 className="text-xs font-medium text-gray-200">
                    Participants
                    <TooltipIcon text="Avatars assigned to this party. These avatars will behave according to the party's configuration." />
                  </h3>
                  <button 
                    type="button"
                    className="text-xs bg-blue-800 hover:bg-blue-700 text-blue-300 px-1.5 py-0.5 rounded transition-colors"
                    onClick={() => {
                      setIsLoadingAvatars(true);
                      setTimeout(() => findBoxAndExtractAvatars(party.id, "manual-refresh"), 100);
                    }}
                    title="Refresh avatar list"
                  >
                    ↻ Refresh
                  </button>
                </div>
                
                <div className="p-2">
                  {isLoadingAvatars ? (
                    <div className="p-2 bg-gray-700 rounded-md text-gray-300 text-xs flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading avatars...
                    </div>
                  ) : boxAvatars.length > 0 ? (
                    <div>
                      <div className="mb-1 text-xs text-gray-400">
                        The following avatars are assigned to this party:
                      </div>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                        {boxAvatars.map((avatar, index) => (
                          <li key={avatar.id || `avatar-${index}`} className="p-1 rounded-md border border-gray-600 bg-gray-700 flex items-center hover:bg-gray-600 transition-colors">
                            <div className="h-6 w-6 rounded-full bg-sky-900 flex items-center justify-center text-sky-300 mr-2 text-xs">
                              {avatar.avatarData?.gender === 'male' ? '♂' : 
                              avatar.avatarData?.gender === 'female' ? '♀' : '👤'}
                            </div>
                            <div className="flex-grow overflow-hidden">
                              <div className="font-medium text-xs text-gray-200 truncate">{avatar.name}</div>
                              <div className="text-xs text-gray-400 truncate">
                                {avatar.avatarData?.voice || 'No voice set'}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 mb-1 mx-auto">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <h3 className="text-gray-200 text-xs font-medium">No avatars found</h3>
                      <button 
                        type="button"
                        className="mt-1 px-2 py-1 bg-blue-600 text-gray-200 text-xs rounded hover:bg-blue-700 transition-colors"
                        onClick={() => findBoxAndExtractAvatars(party.id, "try-again-button")}
                      >
                        Refresh
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button - more compact */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 py-2 px-2 -mx-2 mt-2 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            {storedParty.name ? 'Ready to apply' : 'Choose a party'}
          </div>
          <button
            type="submit"
            disabled={!storedParty.name}
            className="px-3 py-1 bg-blue-600 text-gray-200 text-xs rounded-md hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-gray-800 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Apply Changes
          </button>
        </div>
      </form>
      
      {/* Debug section - collapsed by default - more compact */}
      <div className="bg-gray-800 border-t border-gray-700 p-2">
        <div className="flex items-center justify-between cursor-pointer" 
             onClick={() => document.getElementById('debugSection').classList.toggle('hidden')}>
          <h3 className="text-xs font-medium text-gray-400">Advanced Options</h3>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        <div id="debugSection" className="hidden mt-1 space-y-1">
          <div className="text-xs text-gray-400">Box ID: {party?.id}</div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => {
                console.log('Current Scenes:', scenes);
                console.log('Active Scene ID:', activeSceneId);
                console.log('Current Party:', party);
                
                if (scenes && activeSceneId) {
                  const currentActiveScene = scenes.find(scene => scene.id === activeSceneId);
                  if (currentActiveScene && currentActiveScene.boxes) {
                    const box = currentActiveScene.boxes.find(box => box.id === party.id);
                    console.log('Box in scene:', box);
                    console.log('Party assignment:', box?.party);
                    alert(`Current party assignment for box ${party.id}: ${box?.party || 'none'}`);
                  }
                }
              }}
              className="text-xs text-blue-400 hover:underline bg-blue-900 px-1.5 py-0.5 rounded"
            >
              Debug Party Assignment
            </button>
            
            <button
              onClick={() => {
                if (!scenes || !activeSceneId || !storedParty.name) {
                  alert('Cannot force update: Missing scene or party name');
                  return;
                }
                
                const updatedScenes = [...scenes];
                const updatedActiveScene = updatedScenes.find(scene => scene.id === activeSceneId);
                
                if (updatedActiveScene && updatedActiveScene.boxes) {
                  const boxIndex = updatedActiveScene.boxes.findIndex(box => box.id === party.id);
                  
                  if (boxIndex !== -1) {
                    console.log(`Force updating box ${party.id} party from "${updatedActiveScene.boxes[boxIndex].party}" to "${storedParty.name}"`);
                    updatedActiveScene.boxes[boxIndex].party = storedParty.name;
                    updatedActiveScene.hasUnsavedChanges = true;
                    
                    window.editorStore.getState().setScenes(updatedScenes);
                    
                    alert(`Force updated party to "${storedParty.name}" - Try refreshing the hierarchy view now`);
                  } else {
                    alert(`Box with ID ${party.id} not found in active scene`);
                  }
                }
              }}
              className="text-xs bg-blue-700 text-gray-200 px-1.5 py-0.5 rounded hover:bg-blue-600"
            >
              Force Update Party
            </button>
            
            <button
              onClick={handleCleanupPartyConfigs}
              className="text-xs bg-red-700 text-gray-200 px-1.5 py-0.5 rounded hover:bg-red-600"
            >
              Reset Party Configs
            </button>
          </div>
      
          {/* Configuration manager */}
          <div className="mt-1 pt-1 border-t border-gray-700">
            <h4 className="text-xs font-medium text-gray-400 mb-1">Party Configuration Manager</h4>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all saved party configurations?')) {
                  localStorage.removeItem('partyConfigs');
                  alert('All party configurations have been cleared!');
                }
              }}
              className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-1.5 py-0.5 rounded"
            >
              Clear All Saved Configurations
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartyInspector;