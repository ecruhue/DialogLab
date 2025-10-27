import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { SnippetNode } from "../inspector/store";

// Interface definitions
export interface NodeDisplayProps {
  node: SnippetNode;
  nodes: SnippetNode[];
  forceUpdate: number;
  hasMoved: boolean;
  connectingFrom: string | null;
  onNodeClick: (node: SnippetNode, event: React.MouseEvent<SVGGElement, MouseEvent>, type: 'none' | 'text' | 'audio') => void;
  onStartDragging: (nodeId: string, e: React.MouseEvent, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onStartConnection: (nodeId: string) => void;
  onCompleteConnection: (nodeId: string) => void;
  onDuplicateNode: (node: SnippetNode) => void;
  activeContextMenuNode: string | null;
  onContextMenuOpen: (nodeId: string) => void;
  isFocused: boolean;
  draggingNode: string | null;
  scale: number;
  playingNodeId?: string | null;
  emojiStates?: Record<string, string>; // Add this line
}

// Dropdown option interface
interface DropdownOption {
  value: string;
  label: string;
}

// Dropdown type for identifying which dropdown is open
type DropdownType = 'turnMode' | 'moderator' | 'initiator' | 'subTopic' | 'turns' | 'pattern' | null;

// Helper function to format names similar to DraggableScenes
const formatNames = (names: string[]): string => {
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
};

// Helper function to get avatar color based on name
const getAvatarColor = (name: string): string => {
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

// Use a WeakMap to cache human participant checks to avoid excessive logging
// Using WeakMap to avoid memory leaks when nodes are garbage collected
const nodeHumanChecks = new WeakMap<SnippetNode, string>();

// Helper function to check if scene has human participants
const sceneHasHumanParticipants = (node: SnippetNode): boolean => {
  if (!node.attachedScene) return false;
  
  // Check localStorage for human participants
  try {
    const savedData = localStorage.getItem('aiPanelData');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
        // Check if any avatar in the scene matches a human participant
        for (const box of node.attachedScene.boxes) {
          if (box.elements) {
            for (const element of box.elements) {
              if (element.elementType === 'avatar' && element.avatarData?.name) {
                if (parsedData.humanParticipants.includes(element.avatarData.name)) {
                  // Only log when node is first loaded or when debugging
                  const lastHumanCheck = nodeHumanChecks.get(node);
                  if (!lastHumanCheck || lastHumanCheck !== element.avatarData.name) {
                    console.log(`Found human participant in localStorage: ${element.avatarData.name}`);
                    // Store last human check to avoid repeated logging
                    nodeHumanChecks.set(node, element.avatarData.name);
                  }
                  return true;
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking for human participants in localStorage:", error);
  }

  // If we get here, no human participants were found
  // Reset last human check flag
  if (nodeHumanChecks.has(node)) {
    nodeHumanChecks.delete(node);
  }

  return false;
};

const NodeDisplay: React.FC<NodeDisplayProps> = ({
  node,
  nodes,
  forceUpdate,
  hasMoved,
  connectingFrom,
  onNodeClick,
  onStartDragging,
  onDeleteNode,
  onStartConnection,
  onCompleteConnection,
  onDuplicateNode,
  activeContextMenuNode,
  onContextMenuOpen,
  isFocused = false,
  draggingNode = null,
  scale,
  playingNodeId,
  emojiStates,
}) => {
  // Track expanded/collapsed state of config section - auto-collapse by default
  const [configExpanded, setConfigExpanded] = useState(false);
  // Track expanded/collapsed state of party config section - auto-collapse by default
  const [partyConfigExpanded, setPartyConfigExpanded] = useState(false);
  // Track dropdown state
  const [activeDropdown, setActiveDropdown] = useState<DropdownType>(null);
  const [derailerMode, setDerailerMode] = useState(node.derailerMode);
  // Track human participants
  const [hasHumanParticipants, setHasHumanParticipants] = useState<boolean | null>(null);
  
  // Track hover state for node
  const [nodeHovered, setNodeHovered] = useState(false);
  // Track hover state for scene name
  const [sceneNameHovered, setSceneNameHovered] = useState(false);
  // Track context menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  // Store context menu position
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  // Add ref for the SVG group element
  const nodeRef = useRef<SVGGElement>(null);
  
  // State for dropdown functionality
  const [dropdownMenuPos, setDropdownMenuPos] = useState({ x: 0, y: 0, width: 120 });
  
  // Avatar and party information from node's attached scene
  const [sceneAvatarNames, setSceneAvatarNames] = useState<string[]>([]);
  const [sceneParties, setSceneParties] = useState<string[]>([]);

  // Turn mode options
  const turnModeOptions: DropdownOption[] = [
    { value: 'free', label: 'Free' },
    { value: 'round-robin', label: 'Round Robin' },
    { value: 'moderated', label: 'Moderated' }
  ];

  // Pattern options
  const patternOptions: DropdownOption[] = [
    { value: 'conversation', label: 'Conversation' },
    { value: 'debate', label: 'Debate' },
    { value: 'qa', label: 'Q&A' },
    { value: 'story', label: 'Story' }
  ];
  
  // Turns options
  const turnsOptions: DropdownOption[] = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5' },
  ];
  
  // Update derailer mode and human participants status when node changes or when human participants change
  useEffect(() => {
    const checkHumanParticipants = () => {
      // Check if there are human participants
      const hasHumans = sceneHasHumanParticipants(node);
      setHasHumanParticipants(hasHumans);
      
      // Only log when we initially find human participants
      if (hasHumans) {
        console.log(`Scene ${node.id}: Has human participants: ${hasHumans}`);
      }
      
      // Only keep derailer mode enabled if explicitly set to true and there are human participants
      const shouldEnableDerailer = node.derailerMode !== false && hasHumans;
      setDerailerMode(shouldEnableDerailer);
    };

    // Initial check
    checkHumanParticipants();

    // Listen for changes in human participants
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'aiPanelData') {
        // Get the latest scene data from localStorage
        try {
          const sceneKey = `scene:${node.attachedScene?.id}`;
          const sceneData = localStorage.getItem(sceneKey);
          if (sceneData) {
            const updatedScene = JSON.parse(sceneData);
            // Update the node's attachedScene with the latest data
            if (node.attachedScene && node.attachedScene.id === updatedScene.id) {
              node.attachedScene = updatedScene;
            }
          }
        } catch (error) {
          console.error('Error updating node scene data:', error);
        }
        checkHumanParticipants();
      }
    };

    // Listen for custom event for local changes
    const handleHumanParticipantsChanged = () => {
      // Get the latest scene data from localStorage
      try {
        const sceneKey = `scene:${node.attachedScene?.id}`;
        const sceneData = localStorage.getItem(sceneKey);
        if (sceneData) {
          const updatedScene = JSON.parse(sceneData);
          // Update the node's attachedScene with the latest data
          if (node.attachedScene && node.attachedScene.id === updatedScene.id) {
            node.attachedScene = updatedScene;
          }
        }
      } catch (error) {
        console.error('Error updating node scene data:', error);
      }
      checkHumanParticipants();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('humanParticipantsChanged', handleHumanParticipantsChanged);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('humanParticipantsChanged', handleHumanParticipantsChanged);
    };
  }, [node.id, node.derailerMode, node.attachedScene]);
  
  // Add new useEffect to handle conversation mode changes
  useEffect(() => {
    const handleConversationModeChange = (e: CustomEvent) => {
      if (node.type === 'scene') {
        const mode = e.detail?.mode;
        const updatedNode = { ...node };
        
        console.log(`Conversation mode changed to: ${mode}`);
        
        // Update node configuration based on the selected mode
        if (updatedNode.attachedScene) {
          // Create a copy of the scene with the new conversation mode
          const updatedScene = { 
            ...updatedNode.attachedScene,
            conversationMode: mode 
          };
          
          // Update the node with the new scene
          updatedNode.attachedScene = updatedScene;
        }
        
        if (mode === 'reactive') {
          // When reactive mode is selected, disable derailer mode
          setDerailerMode(false);
          
          // Create a properly typed MouseEvent
          const event = new MouseEvent('click', { bubbles: true }) as unknown as React.MouseEvent<SVGGElement, MouseEvent>;
          onNodeClick(updatedNode, event, 'none');
        } else if (mode === 'human-control' || mode === 'autonomous') {
          // When human control mode is selected, enable derailer mode
          setDerailerMode(true);
          
          // Create a properly typed MouseEvent
          const event = new MouseEvent('click', { bubbles: true }) as unknown as React.MouseEvent<SVGGElement, MouseEvent>;
          onNodeClick(updatedNode, event, 'none');
        }
      }
    };

    window.addEventListener('conversationModeChanged', handleConversationModeChange as EventListener);

    return () => {
      window.removeEventListener('conversationModeChanged', handleConversationModeChange as EventListener);
    };
  }, [node, onNodeClick]);
  
  // Handle derailer mode checkbox toggle
  const handleDerailerModeToggle = (e: React.MouseEvent<SVGGElement, MouseEvent>) => {
    e.stopPropagation();
    // Only allow toggling if there are human participants
    if (hasHumanParticipants) {
      const newValue = !derailerMode;
      
      // Immediately update the UI state for responsive feedback
      setDerailerMode(newValue);
      
      // Update the node with the new derailer mode - explicitly set false when off
      const updatedNode = { ...node, derailerMode: newValue ? true : false };
      console.log(`Toggling derailerMode for node ${node.id} from ${derailerMode} to ${newValue}`);
      // Use the same event but with the proper target
      onNodeClick(updatedNode, e, 'none');
    }
  };
  
  // Toggle config section expanded/collapsed state
  const toggleConfigExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfigExpanded(!configExpanded);
  };

  // Toggle party config section expanded/collapsed state
  const togglePartyConfigExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPartyConfigExpanded(!partyConfigExpanded);
  };
  
  // Extract scene data for preview
  const hasAttachedScene = !!node.attachedScene;
  
  // Function to extract avatar names from the scene
  const extractAvatarNamesFromScene = () => {
    if (!node.attachedScene) return [];
    
    const avatarNames: string[] = [];
    node.attachedScene.boxes.forEach(box => {
      if (box.elements) {
        box.elements.forEach(element => {
          if (element.elementType === 'avatar' && element.avatarData?.name) {
            avatarNames.push(element.avatarData.name);
          }
        });
      }
    });
    
    return avatarNames;
  };
  
  // Extract party names from the attached scene if available
  const extractPartiesFromScene = () => {
    if (!node.attachedScene) return [];
    
    const parties = new Set<string>();
    node.attachedScene.boxes.forEach(box => {
      if (box.party) {
        parties.add(box.party);
      }
    });
    
    return Array.from(parties);
  };
  
  // Check if any box has content elements
  const hasSceneContent = () => {
    if (!node.attachedScene) return false;
    
    for (const box of node.attachedScene.boxes) {
      if (box.elements) {
        for (const element of box.elements) {
          if (element.elementType === 'content') {
            return true;
          }
        }
      }
      
      // Also check legacy content properties using type casting
      const boxAny = box as any;
      if (boxAny.content || boxAny.contentType || boxAny.contentUrl) {
        return true;
      }
    }
    
    return false;
  };
  
  // Extract parties using the extractPartiesFromScene function
  useEffect(() => {
    const avatarNames = extractAvatarNamesFromScene();
    const parties = extractPartiesFromScene();
    
    setSceneAvatarNames(avatarNames);
    setSceneParties(parties);
  }, [node.attachedScene]);

  const hasContent = hasSceneContent();
  
  // Calculate section heights
  const baseHeight = 45; // Height of header and scene name/status
  const previewHeight = hasAttachedScene ? 70 : 0; // Preview height when scene is attached
  const configHeight = configExpanded ? 115 : 0; // Height for expanded config section - increased to accommodate pattern on new line
  
  // Dynamically calculate party config section height based on turn mode
  const hasModerator = node.attachedScene?.globalPartySettings?.partyTurnMode !== "free";
  const partyConfigBaseHeight = hasModerator ? 60 : 30; // Height for both Turn Mode and Moderator, or just Turn Mode
  const partyConfigHeight = partyConfigExpanded ? partyConfigBaseHeight : 0;
  
  const objectiveHeight = node.isScripted && node.objective ? 18 : 0; // Height for objective text
  const actionBarHeight = 30; // Height for action buttons
  const spacingAfterPreview = hasAttachedScene ? 20 : 5; // Increased spacing after preview section from 10 to 20
  const spacingBetweenSections = 25; // Increased spacing between major sections from 20 to 25
  const toggleSectionHeight = 16; // Height for section toggle controls
  
  // Calculate total node height
  const nodeHeight = baseHeight + previewHeight + 
    (configExpanded ? configHeight + toggleSectionHeight : toggleSectionHeight) + 
    (partyConfigExpanded ? partyConfigHeight + toggleSectionHeight : toggleSectionHeight) + 
    objectiveHeight + actionBarHeight + 
    (hasAttachedScene ? spacingAfterPreview : 0) + 
    spacingBetweenSections; // Always add spacing between sections
  
  // Calculate vertical positions
  const previewY = node.y + 55; // Position directly after scene name
  const objectiveY = previewY + previewHeight + spacingAfterPreview;
  const partyConfigY = objectiveY + objectiveHeight;
  const partyConfigToggleY = partyConfigY - 8; // Reduced from -10 to -8
  const configY = partyConfigY + (partyConfigExpanded ? partyConfigHeight + spacingBetweenSections : spacingBetweenSections);
  const configToggleY = configY - 8; // Reduced from -10 to -8
  const actionBarY = node.y + nodeHeight - actionBarHeight;
  
  // Calculate whether the node should be highlighted
  const shouldHighlight = isFocused || draggingNode === node.id;
  // Calculate whether the node is currently playing
  const [isActive, setIsActive] = useState(false);
  useEffect(() => {
    const newIsActive = playingNodeId === node.id;
    setIsActive(newIsActive);
    console.log(`Node ${node.id} is active: ${newIsActive} the playingNode id is ${playingNodeId} and node.id is ${node.id}`);
  }, [playingNodeId]);

  // Handle mouse over event for node
  const handleNodeMouseOver = () => {
    setNodeHovered(true);
  };
  
  // Handle mouse out event for node
  const handleNodeMouseOut = () => {
    setNodeHovered(false);
  };
  
  // Handle context menu open
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // SVG coordinates can be tricky - capture exact browser coordinates
    // without any transformations
    const menuPosition = {
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY
    };
    
    setContextMenuPos(menuPosition);
    setShowContextMenu(true);
    
    // Notify parent about this context menu opening
    if (onContextMenuOpen) {
      onContextMenuOpen(node.id);
    }
  };
  
  // Handle context menu close
  const handleCloseContextMenu = () => {
    setShowContextMenu(false);
  };
  
  // Handle duplicate node 
  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleCloseContextMenu();
    if (onDuplicateNode) {
      onDuplicateNode(node);
    }
  };
  
  // Handle delete node from context menu
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleCloseContextMenu();
    onDeleteNode(node.id);
  };

  // Use effect to close this context menu if another one is opened
  React.useEffect(() => {
    if (activeContextMenuNode !== undefined && activeContextMenuNode !== node.id && showContextMenu) {
      setShowContextMenu(false);
    }
  }, [activeContextMenuNode, node.id, showContextMenu]);
  
  // Handle document click to close context menu
  React.useEffect(() => {
    const handleDocumentClick = () => {
      if (showContextMenu) {
        setShowContextMenu(false);
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showContextMenu]);
  
  // Create a React portal for the context menu
  const renderContextMenu = () => {
    if (!showContextMenu || activeContextMenuNode !== node.id) return null;
    
    // Use createPortal to render the context menu overlay
    return ReactDOM.createPortal(
      <div
        className="absolute z-50 theme-bg-tertiary shadow-lg rounded-md overflow-hidden border theme-border w-48"
        style={{
          left: `${contextMenuPos.x}px`,
          top: `${contextMenuPos.y}px`,
        }}
      >
        <ul className="py-1 text-sm">
          <li
            className="px-4 py-2 hover:bg-opacity-80 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex items-center theme-text-primary transition-colors duration-150"
            onClick={handleDuplicate}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicate
          </li>
          
          {/* Only show Edit Description option if there's an attached scene */}
          {node.attachedScene && (
            <li
              className="px-4 py-2 hover:bg-opacity-80 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex items-center theme-text-primary transition-colors duration-150"
              onClick={handleEditDescription}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Description
            </li>
          )}
          
          <li
            className="px-4 py-2 hover:bg-opacity-80 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex items-center theme-text-primary transition-colors duration-150"
            onClick={handleDelete}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </li>
        </ul>
      </div>,
      document.body
    );
  };
  
  // Close active dropdown when clicking outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (activeDropdown) {
        setActiveDropdown(null);
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [activeDropdown]);
  
  // Handle dropdown click - opens dropdown menu
  const handleDropdownClick = (e: React.MouseEvent, dropdownType: DropdownType) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (activeDropdown === dropdownType) {
      // Toggle off if already open
      setActiveDropdown(null);
      return;
    }
    
    // Get the dropdown trigger element's bounding rect
    const target = e.currentTarget as SVGGElement;
    if (!target) return;
    
    // Use native browser API to get the exact screen coordinates
    const rect = target.getBoundingClientRect();
    
    // Calculate ideal position directly below the clicked dropdown
    const clickX = rect.left;
    const clickY = rect.bottom;
    
    // Set width based on dropdown type
    let width = 120;
    
    // Adjust width based on dropdown type
    switch (dropdownType) {
      case 'turnMode':
        width = 80;
        break;
      case 'moderator':
        width = 80;
        break;
      case 'initiator':
        width = 85;
        break;
      case 'subTopic':
        width = 85;
        break;
      case 'turns':
        width = 45; // Narrower menu for turns
        break;
      case 'pattern':
        width = 80; // Narrower menu for pattern
        break;
    }
    
    // Position dropdown below the trigger element
    setDropdownMenuPos({ 
      x: clickX, // Align with left edge of dropdown trigger
      y: clickY, // Position just below the dropdown trigger
      width
    });
    
    setActiveDropdown(dropdownType);
  };
  
  // Handle option selection from dropdown
  const handleOptionSelect = (option: DropdownOption, dropdownType: DropdownType, event: React.MouseEvent) => {
    // Create updated node with new option value
    const updatedNode = { ...node };
    
    // Update the appropriate property based on dropdown type
    switch (dropdownType) {
      case 'turnMode':
        if (!updatedNode.attachedScene) {
          // Create a minimal Scene with required properties
          updatedNode.attachedScene = { 
            boxes: [], 
            id: `scene_${Date.now()}`,
            name: "New Scene",
            hasUnsavedChanges: false,
            backgroundImage: null,
            globalPartySettings: { 
              partyTurnMode: option.value, 
              moderatorParty: "", 
              enableBackchannel: false 
            } 
          };
        } else if (!updatedNode.attachedScene.globalPartySettings) {
          updatedNode.attachedScene.globalPartySettings = { 
            partyTurnMode: option.value, 
            moderatorParty: "", 
            enableBackchannel: false 
          };
        } else {
          updatedNode.attachedScene.globalPartySettings.partyTurnMode = option.value;
          
          // If changing to "free" mode, clear the moderator
          if (option.value === "free") {
            updatedNode.attachedScene.globalPartySettings.moderatorParty = "";
          }
        }
        break;
      case 'moderator':
        if (!updatedNode.attachedScene) {
          // Create a minimal Scene with required properties
          updatedNode.attachedScene = { 
            boxes: [], 
            id: `scene_${Date.now()}`,
            name: "New Scene",
            hasUnsavedChanges: false,
            backgroundImage: null,
            globalPartySettings: { 
              partyTurnMode: "free", 
              moderatorParty: option.value, 
              enableBackchannel: false 
            } 
          };
        } else if (!updatedNode.attachedScene.globalPartySettings) {
          updatedNode.attachedScene.globalPartySettings = { 
            partyTurnMode: "free", 
            moderatorParty: option.value, 
            enableBackchannel: false 
          };
        } else {
          updatedNode.attachedScene.globalPartySettings.moderatorParty = option.value;
        }
        break;
      case 'initiator':
        // For initiator we need to set the name property
        // Using a minimal implementation that meets the requirements
        const initiatorSpeaker = { 
          name: option.value,
          id: option.value.toLowerCase().replace(/\s+/g, '_'),
          gender: "neutral", // Default value
          voice: "en-US-Neural2-F" // Default voice
        };
        updatedNode.initiator = initiatorSpeaker;
        break;
      case 'subTopic':
        updatedNode.subTopic = option.value;
        break;
      case 'turns':
        // Convert to number since turns is numeric
        updatedNode.turns = parseInt(option.value, 10);
        break;
      case 'pattern':
        updatedNode.interactionPattern = option.value;
        break;
    }
    
    // Close dropdown
    setActiveDropdown(null);
    
    // Call the onNodeClick with the updated node
    // We need to manually cast the event to the expected type
    onNodeClick(updatedNode, event as unknown as React.MouseEvent<SVGGElement, MouseEvent>, 'none');
  };
  
  // Render dropdown menu options
  const renderDropdownMenu = (dropdownType: DropdownType) => {
    if (activeDropdown !== dropdownType) return null;
    
    let options: DropdownOption[] = [];
    let title = '';
    
    // Determine which options to show based on dropdown type
    switch (dropdownType) {
      case 'turnMode':
        options = turnModeOptions;
        title = 'Turn Mode';
        break;
      case 'moderator':
        // Get parties from the scene as options
        options = sceneParties.map(party => ({ value: party, label: party }));
        if (options.length === 0) {
          options = [{ value: '', label: 'No parties available' }];
        }
        title = 'Moderator Party';
        break;
      case 'initiator':
        // Get avatars from the scene as options
        options = sceneAvatarNames.map(name => ({ value: name, label: name }));
        if (options.length === 0) {
          options = [{ value: '', label: 'No avatars available' }];
        }
        title = 'Initiator';
        break;
      case 'subTopic':
        // Example subtopics - these would normally come from a global list
        options = [
          { value: 'introduction', label: 'Introduction' },
          { value: 'main', label: 'Main Topic' },
          { value: 'conclusion', label: 'Conclusion' },
          { value: 'qa', label: 'Q&A' },
          { value: 'custom', label: 'Custom' }
        ];
        title = 'Sub Topic';
        break;
      case 'turns':
        options = turnsOptions;
        title = 'Turns';
        break;
      case 'pattern':
        options = patternOptions;
        title = 'Pattern';
        break;
    }
    
    // Get the current selected value for this dropdown
    const getCurrentValue = () => {
      switch (dropdownType) {
        case 'turnMode':
          return node.attachedScene?.globalPartySettings?.partyTurnMode || "free";
        case 'moderator':
          return node.attachedScene?.globalPartySettings?.moderatorParty || "";
        case 'initiator':
          return node.initiator?.name || "";
        case 'subTopic':
          return node.subTopic || "";
        case 'turns':
          return node.turns?.toString() || "";
        case 'pattern':
          return node.interactionPattern || "";
      }
    };
    
    const currentValue = getCurrentValue();
    
    // Calculate the maximum height based on number of options
    const maxHeight = Math.min(options.length * 24 + 40, 200); // 24px per item + header
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust position if needed to stay within viewport
    let { x, y, width } = dropdownMenuPos;
    
    // Check right edge
    if (x + width > viewportWidth - 10) {
      x = viewportWidth - width - 10; // Keep 10px margin
    }
    
    // Check bottom edge
    if (y + maxHeight > viewportHeight - 10) {
      // Position above instead of below if there's not enough space below
      const target = document.querySelector('.dropdown-container.active');
      if (target) {
        const rect = target.getBoundingClientRect();
        if (rect.top > maxHeight) {
          y = rect.top - maxHeight;
        }
      }
    }
    
    // Use createPortal to render the dropdown menu
    return ReactDOM.createPortal(
      <div
        className="fixed z-50 shadow-lg rounded-md overflow-hidden border theme-border"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          maxHeight: `${maxHeight}px`,
          backgroundColor: 'var(--bg-secondary)',
          animation: 'fadeIn 0.15s ease-in-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .dropdown-item {
              padding: 6px 8px;
              font-size: 12px;
              cursor: pointer;
              color: var(--text-primary);
              display: flex;
              align-items: center;
            }
            .dropdown-item:hover {
              background-color: var(--bg-hover);
            }
            .dropdown-item.selected {
              background-color: var(--bg-accent-light);
              color: var(--primary-accent);
              font-weight: 500;
            }
            .dropdown-item.selected::before {
              content: "✓";
              margin-right: 4px;
              font-size: 10px;
            }
          `}
        </style>
        <div className="px-2 py-1 text-xs font-semibold theme-text-secondary border-b theme-border-secondary">
          {title}
        </div>
        <ul className="py-1 overflow-y-auto" style={{ maxHeight: `${maxHeight - 30}px` }}>
          {options.map((option, index) => (
            <li
              key={`${dropdownType}-option-${index}`}
              className={`dropdown-item ${option.value === currentValue ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleOptionSelect(option, dropdownType, e);
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      </div>,
      document.body
    );
  };
  
  // Add a handler function for editing the description
  const handleEditDescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleCloseContextMenu();
    
    // Create a dialog/modal to edit the description
    const dialog = document.createElement('div');
    dialog.style.position = 'fixed';
    dialog.style.left = '0';
    dialog.style.top = '0';
    dialog.style.width = '100%';
    dialog.style.height = '100%';
    dialog.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    dialog.style.display = 'flex';
    dialog.style.alignItems = 'center';
    dialog.style.justifyContent = 'center';
    dialog.style.zIndex = '1000';
    
    // Create a modal content container
    const modal = document.createElement('div');
    modal.style.backgroundColor = 'var(--bg-secondary, #ffffff)';
    modal.style.borderRadius = '8px';
    modal.style.padding = '16px';
    modal.style.width = '400px';
    modal.style.maxWidth = '90%';
    modal.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    
    // Create title
    const title = document.createElement('h3');
    title.textContent = 'Edit Scene Description';
    title.style.fontSize = '16px';
    title.style.fontWeight = '600';
    title.style.marginBottom = '12px';
    title.style.color = 'var(--text-primary, #333333)';
    
    // Create textarea
    const textarea = document.createElement('textarea');
    textarea.value = node.description || '';
    textarea.style.width = '100%';
    textarea.style.minHeight = '120px';
    textarea.style.padding = '8px';
    textarea.style.borderRadius = '4px';
    textarea.style.border = '1px solid var(--border-color, #e2e8f0)';
    textarea.style.backgroundColor = 'var(--bg-input, #f8fafc)';
    textarea.style.marginBottom = '16px';
    textarea.style.fontSize = '14px';
    textarea.style.color = 'var(--text-primary, #333333)';
    textarea.placeholder = 'Enter a description for this scene...';
    
    // Create buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.justifyContent = 'flex-end';
    buttonsContainer.style.gap = '8px';
    
    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.padding = '6px 12px';
    cancelButton.style.borderRadius = '4px';
    cancelButton.style.border = '1px solid var(--border-color, #e2e8f0)';
    cancelButton.style.backgroundColor = 'transparent';
    cancelButton.style.color = 'var(--text-primary, #333333)';
    cancelButton.style.cursor = 'pointer';
    
    // Create save button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.style.padding = '6px 12px';
    saveButton.style.borderRadius = '4px';
    saveButton.style.border = 'none';
    saveButton.style.backgroundColor = 'var(--bg-accent)';
    saveButton.style.color = 'var(--text-inverse)';
    saveButton.style.cursor = 'pointer';
    
    // Add event listeners
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    saveButton.addEventListener('click', () => {
      // Get the updated EditorState
      const editorState = (window as any).editorStore.getState();
      
      // Update the node description
      if (editorState && typeof editorState.updateNode === 'function') {
        editorState.updateNode(node.id, { description: textarea.value });
      }
      
      document.body.removeChild(dialog);
    });
    
    // Assemble the modal
    buttonsContainer.appendChild(cancelButton);
    buttonsContainer.appendChild(saveButton);
    
    modal.appendChild(title);
    modal.appendChild(textarea);
    modal.appendChild(buttonsContainer);
    
    dialog.appendChild(modal);
    
    // Add to the body
    document.body.appendChild(dialog);
    
    // Focus the textarea
    setTimeout(() => {
      textarea.focus();
    }, 0);
  };
  
  return (
    <g 
      ref={nodeRef}
      key={`node-${node.id}-${forceUpdate}`}
      className="node" 
      onClick={(e) => {
        // Only handle node click if no dropdown is active
        if (!activeDropdown) {
          onNodeClick(node, e, 'none');
        }
      }}
      onMouseOver={handleNodeMouseOver}
      onMouseOut={handleNodeMouseOut}
      onContextMenu={handleContextMenu}
    >
      {/* Focus highlight effect */}
      {shouldHighlight && (
        <rect
          x={node.x - 5}
          y={node.y - 5}
          width="180"
          height={nodeHeight + 10}
          rx="10"
          fill="var(--bg-accent-light)"
          stroke="var(--primary-accent)"
          strokeWidth="2"
          strokeDasharray="6,3"
          filter="drop-shadow(0 2px 6px rgba(0, 0, 0, 0.2))"
          style={{
            animation: "focusPulse 1.5s ease-in-out infinite alternate"
          }}
        />
      )}
      
      {/* Active state highlight effect - pulsating animation for playing/generating */}
      {isActive && (
        <rect
          x={node.x - 5}
          y={node.y - 5}
          width="180"
          height={nodeHeight + 10}
          rx="10"
          fill={"var(--bg-success)"}
          stroke={"var(--success)"}
          strokeWidth="2"
          style={{
            animation: "pulse 1.5s infinite ease-in-out",
          }}
        />
      )}
      
      {/* Define the pulse and focus animations */}
      <defs>
        <style>
          {`
            @keyframes pulse {
              0% { opacity: 0.6; }
              50% { opacity: 0.9; }
              100% { opacity: 0.6; }
            }
            @keyframes focusPulse {
              0% { opacity: 0.4; }
              100% { opacity: 1; }
            }
          `}
        </style>
      </defs>
    
      {/* Add a strong solid background to prevent grid showing through */}
      <rect
        x={node.x}
        y={node.y}
        width="170"
        height={nodeHeight}
        fill="var(--bg-panel)"
        rx="6"
        style={{
          filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))"
        }}
      />
      
      {/* Main node rect */}
      <rect
        x={node.x}
        y={node.y}
        width="170"
        height={nodeHeight}
        fill={node.isScripted ? "var(--bg-secondary)" : "var(--bg-panel)"}
        stroke="var(--border-color)"
        strokeWidth="1.5"
        rx="6"
        onMouseDown={(e) => {
          // Only start dragging if we're not clicking on a dropdown
          const target = e.target as Element;
          if (!target.closest('.dropdown-container')) {
            onStartDragging(node.id, e, node.x, node.y);
          }
        }}
        opacity="1"
        style={{
          filter: "drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3))"
        }}
      />

      <g className="node-header">
        <rect
          x={node.x}
          y={node.y}
          width="170"
          height="30"
          rx="6"
          fill="var(--bg-secondary)"
          stroke="var(--border-color-light)"
          strokeWidth="1"
          onMouseDown={(e) => {
            // Only start dragging if we're not clicking on a dropdown
            const target = e.target as Element;
            if (!target.closest('.dropdown-container')) {
              onStartDragging(node.id, e, node.x, node.y);
            }
          }}
          opacity="1"
        />
        <text
          x={node.x + 10}
          y={node.y + 20}
          fill="var(--text-primary)"
          fontSize="14"
          fontWeight="600"
          onMouseDown={(e) => {
            // Only start dragging if we're not clicking on a dropdown
            const target = e.target as Element;
            if (!target.closest('.dropdown-container')) {
              onStartDragging(node.id, e, node.x, node.y);
            }
          }}
          style={{ pointerEvents: "none" }}
        >
          {node.title || `Snippet ${nodes.filter((n: SnippetNode) => n.type === 'snippet').findIndex((n: SnippetNode) => n.id === node.id) + 1}`}
        </text>
      </g>

      <g className="node-content">
        <rect
          x={node.x}
          y={node.y + 30}
          width="170"
          height={nodeHeight - 30}
          fill="transparent"
          onMouseDown={(e) => {
            // Only start dragging if we're not clicking on a dropdown
            const target = e.target as Element;
            if (!target.closest('.dropdown-container')) {
              onStartDragging(node.id, e, node.x, node.y);
            }
          }}
        />
        
        {/* Scene Name - now displayed where the ID was */}
        {node.attachedScene ? (
          <g>
            <rect
              x={node.x + 10}
              y={node.y + 30}
              width={Math.min(150, (node.attachedScene.name?.length || 12) * 5 + 32)}
              height="18"
              rx="4"
              fill={nodeHovered ? "#e6f0ff" : "#dbeafe"}
              stroke={nodeHovered ? "#4f8ef6" : "#3b82f6"}
              strokeWidth="1"
              style={{ 
                transition: "fill 0.2s ease, stroke 0.2s ease",
                filter: nodeHovered ? "drop-shadow(0px 1px 2px rgba(59, 130, 246, 0.2))" : "none"
              }}
            />
            {/* Scene icon with subtle animation */}
            <path
              d="M3,3 L8,3 L8,8 L3,8 L3,3 Z M10,3 L15,3 L15,8 L10,8 L10,3 Z M3,10 L8,10 L8,15 L3,15 L3,10 Z M10,10 L15,10 L15,15 L10,15 L10,10 Z"
              fill={nodeHovered ? "#4f8ef6" : "#3b82f6"}
              transform={`translate(${node.x + 13}, ${node.y + 33}) scale(${nodeHovered ? 0.68 : 0.65})`}
              style={{ transition: "fill 0.2s ease, transform 0.2s ease" }}
            />
            <text
              x={node.x + 24}
              y={node.y + 42}
              className="scene-name text-xs font-semibold"
              fill={nodeHovered ? "#4f8ef6" : "#3b82f6"}
              style={{ 
                transition: "fill 0.2s ease",
                cursor: "help" // Add cursor:help to indicate it has a tooltip
              }}
              onMouseOver={(e) => {
                e.stopPropagation();
                setSceneNameHovered(true);
              }}
              onMouseOut={(e) => {
                e.stopPropagation();
                setSceneNameHovered(false);
              }}
            >
              {node.attachedScene.name && node.attachedScene.name.length > 20 
                ? node.attachedScene.name.substring(0, 18) + "..." 
                : node.attachedScene.name || "Unnamed Scene"}
            </text>
            
            {/* Scene Description Tooltip - displayed above the node when hovering the scene name */}
            {node.description && sceneNameHovered && (
              <g>
                {(() => {
                  // Calculate a more accurate text height
                  const charCount = node.description.length;
                  const tooltipWidth = 170; // Fixed width matching node width
                  
                  // Estimate the number of characters per line based on tooltip width
                  // 11px font size with ~ 6 chars per 40px width
                  const charsPerLine = Math.floor((tooltipWidth - 20) / 6.5);
                  
                  // Calculate number of lines needed (with some buffer)
                  const lines = Math.ceil(charCount / charsPerLine) + (charCount > 100 ? 2 : 1);
                  
                  // Calculate text height: lines * line height + padding
                  const lineHeight = 10; // 11px font + 3px spacing
                  const textHeight = lines * lineHeight;
                  const tooltipHeight = textHeight + 10; // 8px padding top & bottom
                  
                  // Position tooltip above node
                  const tooltipY = node.y - tooltipHeight - 10;
                  
                  return (
                    <>
                      {/* Rectangle background */}
                      <rect
                        x={node.x}
                        y={tooltipY}
                        width={tooltipWidth}
                        height={tooltipHeight}
                        rx={6}
                        fill="rgba(45, 55, 72, 0.95)"
                        filter="drop-shadow(0 1px 3px rgba(0, 0, 0, 0.3))"
                      />
                      
                      {/* Arrow pointing to scene name */}
                      <path
                        d={`M ${node.x + 85} ${node.y + 10} 
                            L ${node.x + 75} ${tooltipY + tooltipHeight}
                            L ${node.x + 95} ${tooltipY + tooltipHeight}
                            Z`}
                        fill="rgba(45, 55, 72, 0.95)"
                      />
                      
                      {/* Text content - with precise sizing */}
                      <foreignObject
                        x={node.x + 5}
                        y={tooltipY + 5}
                        width={tooltipWidth - 10}
                        height={tooltipHeight - 10}
                        style={{
                          overflow: "visible",
                          pointerEvents: "none"
                        }}
                      >
                        <div
                          style={{
                            padding: "6px 8px",
                            color: "var(--text-inverse)",
                            fontSize: "11px",
                            lineHeight: "1.27",
                            overflow: "visible", 
                            wordBreak: "break-word"
                          }}
                        >
                          {node.description}
                        </div>
                      </foreignObject>
                    </>
                  );
                })()}
              </g>
            )}
          </g>
        ) : (
          <g>
            <rect
              x={node.x + 10}
              y={node.y + 30}
              width="100"
              height="18"
              rx="4"
              fill={nodeHovered ? "#f3f4f6" : "#e5e7eb"}
              stroke={nodeHovered ? "#9ca3af" : "#d1d5db"}
              strokeWidth="1"
              style={{ 
                transition: "fill 0.2s ease, stroke 0.2s ease",
                filter: nodeHovered ? "drop-shadow(0px 1px 2px rgba(107, 114, 128, 0.2))" : "none"
              }}
            />
            {/* Missing scene icon with subtle animation */}
            <path
              d="M6.5 1.5V5M10.5 1.5V5M1.5 8.5H15.5M4 15H13C14.1046 15 15 14.1046 15 13V4C15 2.89543 14.1046 2 13 2H4C2.89543 2 2 2.89543 2 4V13C2 14.1046 2.89543 15 4 15Z"
              stroke={nodeHovered ? "#8b95a9" : "#6b7280"}
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
              transform={`translate(${node.x + 13}, ${node.y + 33}) scale(${nodeHovered ? 0.68 : 0.65})`}
              style={{ transition: "stroke 0.2s ease, transform 0.2s ease" }}
            />
            <text
              x={node.x + 24}
              y={node.y + 42}
              className="node-status text-xs italic"
              fill={nodeHovered ? "#8b95a9" : "#6b7280"}
              style={{ 
                pointerEvents: "none",
                transition: "fill 0.2s ease"
              }}
            >
              No scene attached
            </text>
          </g>
        )}
        
        {/* Scene Preview Section */}
        {node.attachedScene && (
          <g>
            {/* Preview Background - outer shadow for depth */}
            <rect
              x={node.x + 10}
              y={previewY}
              width="150"
              height={previewHeight - 10}
              rx="4"
              fill="#f9fafb"
              stroke="#3b82f6"
              strokeWidth="1"
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))"
              }}
            />
            
            {/* Preview Background with hover effect - inner fill */}
            <rect
              x={node.x + 10}
              y={previewY}
              width="150"
              height={previewHeight - 10}
              rx="4"
              fill={nodeHovered ? "#f3f4f6" : "#f9fafb"}
              opacity="1"
              style={{ 
                pointerEvents: "none",
                transition: "fill 0.2s ease"
              }}
            />
                        
            {/* Scene Preview - Visual representation of boxes */}
            <g 
              style={{ 
                pointerEvents: "none",
                transformOrigin: `${node.x + 100}px ${previewY + previewHeight/2}px` // Center of preview
              }}
              opacity="1" // Ensure full opacity
              transform={nodeHovered ? "scale(0.98)" : "scale(1)"} // Subtle scale effect on hover
            >
              {node.attachedScene.boxes.map((box, i) => {
                // Calculate position relative to the preview area - adjusted for more compact width
                const boxX = node.x + 12 + (box.x / 100) * 146;
                const boxY = previewY + 12 + (box.y / 100) * 40;
                const boxWidth = Math.max(10, (box.width / 100) * 146);
                const boxHeight = Math.max(8, (box.height / 100) * 40);
                
                // Get avatars in this box
                const boxAvatars: string[] = [];
                const humanAvatars: string[] = [];
                let hasContentElements = false;
                
                // Extract avatars and check for content
                if (box.elements) {
                  box.elements.forEach(element => {
                    if (element.elementType === 'avatar' && element.avatarData?.name) {
                      boxAvatars.push(element.avatarData.name);
                      
                      // Check if this avatar is a human participant
                      try {
                        const savedData = localStorage.getItem('aiPanelData');
                        if (savedData) {
                          const parsedData = JSON.parse(savedData);
                          if (parsedData.humanParticipants && 
                              Array.isArray(parsedData.humanParticipants) && 
                              parsedData.humanParticipants.includes(element.avatarData.name)) {
                            humanAvatars.push(element.avatarData.name);
                          }
                        }
                      } catch (error) {
                        console.error("Error checking human participants:", error);
                      }
                    } else if (element.elementType === 'content') {
                      hasContentElements = true;
                    }
                  });
                }
                
                // Also check legacy content properties using type casting
                const boxAny = box as any;
                if (boxAny.content || boxAny.contentType || boxAny.contentUrl) {
                  hasContentElements = true;
                }
                
                // Determine box color based on content - matching SceneSetupModal style
                let boxColor = "#4b5563"; // default gray for empty boxes (matching DraggableScenes)
                
                if (box.party) {
                  boxColor = "#3b82f6"; // blue for party boxes (matching DraggableScenes)
                } else if (boxAvatars.length > 0) {
                  boxColor = "#10b981"; // green for avatar boxes (matching DraggableScenes)
                } else if (hasContentElements) {
                  boxColor = "#f59e0b"; // amber for content boxes (matching DraggableScenes)
                }
                
                return (
                  <g key={`box-preview-${i}`}>
                    <rect
                      x={boxX}
                      y={boxY}
                      width={boxWidth}
                      height={boxHeight}
                      fill={boxColor}
                      opacity="0.8"
                      stroke="white"
                      strokeWidth="0.8"
                      rx="2"
                    />
                    
                    {/* Show party label if box has a party */}
                    {box.party && boxWidth > 20 && (
                      <rect
                        x={boxX}
                        y={boxY}
                        width={boxWidth}
                        height={Math.min(boxHeight * 0.35, 12)}
                        fill="#1e3a8a"
                        opacity="0.7"
                        rx="2"
                        ry="2"
                      >
                      </rect>
                    )}
                    
                    {box.party && boxWidth > 20 && (
                      <text
                        x={boxX + boxWidth/2}
                        y={boxY + Math.min(boxHeight * 0.23, 8)}
                        textAnchor="middle"
                        fontSize="7"
                        fontWeight="bold"
                        fill="white"
                        style={{ pointerEvents: "none" }}
                      >
                        {box.party.length > 10 ? box.party.substring(0, 9) + "..." : box.party}
                      </text>
                    )}
                    
                    {/* Show avatars if box has them - matching SceneSetupModal style */}
                    {boxAvatars.length > 0 && boxWidth > 16 && (
                      <g>
                        {boxAvatars.slice(0, Math.min(3, boxAvatars.length)).map((name, idx) => {
                          // Calculate horizontal position based on number of avatars
                          const totalAvatars = Math.min(3, boxAvatars.length);
                          const spacing = boxWidth * 0.3;
                          const startX = boxX + boxWidth/2 - (spacing * (totalAvatars-1)/2);
                          const avatarX = startX + (idx * spacing);
                          
                          const isHuman = humanAvatars.includes(name);
                          return (
                            <g key={`avatar-icon-${i}-${idx}`}>
                              <circle
                                cx={avatarX}
                                cy={boxY + boxHeight/2 + 2}
                                r={Math.min(6, Math.min(boxWidth, boxHeight)/3.5)}
                                fill={getAvatarColor(name)}
                                stroke={isHuman ? "#fbbf24" : "white"}
                                strokeWidth={isHuman ? 2 : 1.2}
                                strokeOpacity={isHuman ? 1 : 0.7}
                              />
                              {/* Human participant indicator */}
                              {isHuman && boxWidth > 15 && (
                                <circle
                                  cx={avatarX + 4}
                                  cy={boxY + boxHeight/2 - 3}
                                  r={2.5}
                                  fill="#fbbf24"
                                  stroke="#ffffff"
                                  strokeWidth="0.8"
                                >
                                  <title>Human Participant</title>
                                </circle>
                              )}
                              {boxWidth > 20 && (
                                <text
                                  x={avatarX}
                                  y={boxY + boxHeight/2 + 4}
                                  textAnchor="middle"
                                  fontSize="8"
                                  fill="white"
                                  fontWeight="bold"
                                >
                                  {name.substring(0, 1).toUpperCase()}
                                </text>
                              )}
                            </g>
                          );
                        })}
                        {boxAvatars.length > 3 && boxWidth > 25 && (
                          <g>
                            <circle
                              cx={boxX + boxWidth/2 + (boxWidth * 0.3)}
                              cy={boxY + boxHeight/2 + 2}
                              r={Math.min(6, Math.min(boxWidth, boxHeight)/3.5)}
                              fill="#4b5563"
                              stroke="white"
                              strokeWidth="1.2"
                              strokeOpacity="0.7"
                            />
                            <text
                              x={boxX + boxWidth/2 + (boxWidth * 0.3)}
                              y={boxY + boxHeight/2 + 4}
                              textAnchor="middle"
                              fontSize="8"
                              fill="white"
                            >
                              +{boxAvatars.length - 2}
                            </text>
                            
                            {/* Badge indicating if any hidden avatars are human */}
                            {humanAvatars.some(name => !boxAvatars.slice(0, 3).includes(name)) && (
                              <circle
                                cx={boxX + boxWidth/2 + (boxWidth * 0.3) + 4}
                                cy={boxY + boxHeight/2 - 3}
                                r={2.5}
                                fill="#fbbf24"
                                stroke="#ffffff"
                                strokeWidth="0.8"
                              >
                                <title>Contains Human Participant(s)</title>
                              </circle>
                            )}
                          </g>
                        )}
                      </g>
                    )}
                    
                    {/* Show content indicator if box has content - matching DraggableScenes */}
                    {hasContentElements && boxWidth > 12 && (
                      <g>
                        {boxAvatars.length > 0 ? (
                          // If box has both avatars and content, show "Txt" label to the side
                          <g transform={`translate(${boxX + boxWidth - 12}, ${boxY + 6})`}>
                            <rect
                              x={-10}
                              y={-6}
                              width="20"
                              height="12"
                              fill="#f59e0b"
                              rx="3"
                              opacity="0.9"
                            />
                            <text
                              x={0}
                              y={3}
                              textAnchor="middle"
                              fontSize="8"
                              fill="white"
                              fontWeight="bold"
                            >
                              Txt
                            </text>
                          </g>
                        ) : (
                          // If box has only content, center the "Txt" label
                          <g>
                            <rect
                              x={boxX + boxWidth/2 - 10}
                              y={boxY + boxHeight/2 - 6}
                              width="20"
                              height="12"
                              fill="#f59e0b"
                              rx="3"
                              opacity="0.9"
                            />
                            <text
                              x={boxX + boxWidth/2}
                              y={boxY + boxHeight/2 + 3}
                              textAnchor="middle"
                              fontSize="8"
                              fill="white"
                              fontWeight="bold"
                            >
                              Txt
                            </text>
                          </g>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}
              
              {/* If no boxes or empty scene, show placeholder */}
              {(!node.attachedScene.boxes || node.attachedScene.boxes.length === 0) && (
                <text
                  x={node.x + 85}
                  y={previewY + 35}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="12"
                  style={{ pointerEvents: "none" }}
                >
                  Empty Scene
                </text>
              )}
            </g>
            
            {/* Metadata badges - shown only on hover */}
            <g 
              opacity={nodeHovered ? "1" : "0"} 
              style={{ 
                transition: "opacity 0.25s ease, transform 0.25s ease", 
                transform: nodeHovered ? "translateY(0)" : "translateY(3px)" 
              }}
            >
              {/* Avatars badge */}
              {sceneAvatarNames.length > 0 && (
                <g>
                  <rect
                    x={node.x + 15}
                    y={previewY + previewHeight - 25}
                    width={Math.min(120, formatNames(sceneAvatarNames).length * 5 + 20)}
                    height="15"
                    rx="7.5"
                    fill="#22c55e"
                    stroke="#16a34a"
                    strokeWidth="1.2"
                    filter="drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.3))"
                    opacity="0.9"
                  />
                  <text
                    x={node.x + 20}
                    y={previewY + previewHeight - 15}
                    fontSize="9"
                    fill="white"
                    fontWeight="600"
                  >
                    A: {formatNames(sceneAvatarNames)}
                  </text>
                </g>
              )}
              
              {/* Parties badge */}
              {sceneParties.length > 0 && (
                <g>
                  <rect
                    x={node.x + 15}
                    y={previewY + previewHeight - (sceneAvatarNames.length > 0 ? 42 : 25)}
                    width={Math.min(120, formatNames(sceneParties).length * 5 + 20)}
                    height="15"
                    rx="7.5"
                    fill="#3b82f6"
                    stroke="#2563eb"
                    strokeWidth="1.2"
                    filter="drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.3))"
                    opacity="0.9"
                  />
                  <text
                    x={node.x + 20}
                    y={previewY + previewHeight - (sceneAvatarNames.length > 0 ? 32 : 15)}
                    fontSize="9"
                    fill="white"
                    fontWeight="600"
                  >
                    P: {formatNames(sceneParties)}
                  </text>
                </g>
              )}
              
              {/* Content badge - always visible if content exists */}
              {hasContent && (
                <g>
                  <rect
                    x={node.x + 15}
                    y={previewY + previewHeight - (sceneAvatarNames.length > 0 ? (sceneParties.length > 0 ? 59 : 42) : (sceneParties.length > 0 ? 42 : 25))}
                    width="60"
                    height="15"
                    rx="7.5"
                    fill="#f97316"
                    stroke="#ea580c"
                    strokeWidth="1.2"
                    filter="drop-shadow(0px 2px 2px rgba(0, 0, 0, 0.3))"
                    opacity="0.9"
                  />
                  <text
                    x={node.x + 20}
                    y={previewY + previewHeight - (sceneAvatarNames.length > 0 ? (sceneParties.length > 0 ? 49 : 32) : (sceneParties.length > 0 ? 32 : 15))}
                    fontSize="9"
                    fill="white"
                    fontWeight="600"
                  >
                    C: Content
                  </text>
                </g>
              )}
            </g>
          </g>
        )}
        
        {/* Scripted objective */}
        {node.isScripted && node.objective && (
          <text
            x={node.x + 10}
            y={objectiveY}
                          className="node-info text-xs italic text-sky-700"
            style={{ pointerEvents: "none" }}
          >
            {node.objective.length > 25 ? node.objective.substring(0, 22) + "..." : node.objective}
          </text>
        )}
        
        {/* Party Config section separator and toggle - Show this first */}
        <g>
          <rect
            x={node.x + 10}
            y={partyConfigToggleY - 10}
            width="150"
            height="20"
            rx="4"
            fill={partyConfigExpanded ? "#e0f2fe" : "#f0f9ff"}
            stroke="#3b82f6"
            strokeWidth="1"
            strokeOpacity="0.7"
            onClick={togglePartyConfigExpanded}
            style={{ cursor: 'pointer' }}
          />
          
          {/* Party Configuration label */}
          <text
            x={node.x + 85}
            y={partyConfigToggleY + 4}
            fontSize="11"
            fontWeight="500"
            fill="#2563eb"
            textAnchor="middle"
            onClick={togglePartyConfigExpanded}
            style={{ pointerEvents: "none" }}
          >
            Party Settings {partyConfigExpanded ? "−" : "+"}
          </text>
        </g>

        {/* Party Config section - conditionally displayed based on expanded state */}
        {partyConfigExpanded && (
          <>
            {/* Turn Mode Dropdown - READ-ONLY */}
            <text x={node.x + 10} y={partyConfigY + 20} className="node-info text-xs font-medium" style={{ pointerEvents: "none" }}>
              Turn Mode
            </text>
            <g className="dropdown-container-readonly" style={{ opacity: 0.9, cursor: "default" }}>
              <rect
                x={node.x + 80}
                y={partyConfigY + 10}
                width="80"
                height="18"
                rx="3"
                className="dropdown-select"
                fill="var(--bg-input)"
                stroke="var(--border-color)"
                strokeWidth="0.5"
              />
              <text 
                x={node.x + 85} 
                y={partyConfigY + 22} 
                className="node-info text-xs"
                fill="var(--text-primary)"
                style={{ pointerEvents: "none" }}
              >
                {node.attachedScene?.globalPartySettings?.partyTurnMode || "free"}
              </text>
            </g>

            {/* Moderator Dropdown - only show when turn mode is not "free" */}
            {(node.attachedScene?.globalPartySettings?.partyTurnMode !== "free") && (
              <>
                <text x={node.x + 10} y={partyConfigY + 45} className="node-info text-xs font-medium" style={{ pointerEvents: "none" }}>
                  Moderator
                </text>
                <g 
                  className={`dropdown-container ${activeDropdown === 'moderator' ? 'active' : ''}`}
                  onClick={(e) => handleDropdownClick(e, 'moderator')}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={node.x + 85}
                    y={partyConfigY + 35}
                    width="75"
                    height="18"
                    rx="3"
                    className="dropdown-select"
                    fill="var(--bg-input)"
                    stroke="var(--border-color)"
                    strokeWidth="0.5"
                  />
                  <text 
                    x={node.x + 90} 
                    y={partyConfigY + 47}
                    className="node-info text-xs"
                    fill="var(--text-primary)"
                    style={{ pointerEvents: "none" }}
                  >
                    {node.attachedScene?.globalPartySettings?.moderatorParty
                      ? (node.attachedScene.globalPartySettings.moderatorParty.length > 9
                        ? node.attachedScene.globalPartySettings.moderatorParty.substring(0, 7) + "..."
                        : node.attachedScene.globalPartySettings.moderatorParty)
                      : "—"}
                  </text>
                  <path
                    d="M0,0 L5,5 L10,0"
                    className="dropdown-arrow"
                    transform={`translate(${node.x + 142}, ${partyConfigY + 44}) ${activeDropdown === 'moderator' ? 'rotate(180 5 2.5)' : ''}`}
                    stroke="var(--text-primary)"
                    strokeWidth="1.5"
                    fill="none"
                    style={{ transition: "transform 0.2s ease" }}
                  />
                </g>
                {renderDropdownMenu('moderator')}
              </>
            )}
          </>
        )}

        {/* Snippet Config section separator and toggle - Show this second */}
        <g>
          <rect
            x={node.x + 10}
            y={configToggleY - 10}
            width="150"
            height="20"
            rx="4"
            fill={configExpanded ? "#ecfdf5" : "#f0fdfa"}
            stroke="#10b981"
            strokeWidth="1"
            strokeOpacity="0.7"
            onClick={toggleConfigExpanded}
            style={{ cursor: 'pointer' }}
          />
          
          {/* Configuration label */}
          <text
            x={node.x + 85}
            y={configToggleY + 4}
            fontSize="11"
            fontWeight="500"
            fill="#059669"
            textAnchor="middle"
            onClick={toggleConfigExpanded}
            style={{ pointerEvents: "none" }}
          >
            Snippet Configs {configExpanded ? "−" : "+"}
          </text>
        </g>

        {/* Snippet Config section - conditionally displayed based on expanded state */}
        {configExpanded && (
          <>
            {/* Initiator Value Display - READ-ONLY */}
            <text x={node.x + 10} y={configY + 20} className="node-info text-xs font-medium" style={{ pointerEvents: "none" }}>
              Initiator
            </text>
            <g className="dropdown-container-readonly" style={{ opacity: 0.9, cursor: "default" }}>
              <rect
                x={node.x + 80}
                y={configY + 10}
                width="80"
                height="18"
                rx="3"
                className="dropdown-select"
                fill="var(--bg-input)"
                stroke="var(--border-color)"
                strokeWidth="0.5"
              />
              <text 
                x={node.x + 85} 
                y={configY + 22} 
                className="node-info text-xs"
                fill="var(--text-primary)"
                style={{ pointerEvents: "none" }}
              >
                {node.initiator?.name 
                  ? (node.initiator.name.length > 9 
                    ? node.initiator.name.substring(0, 7) + "..." 
                    : node.initiator.name)
                  : "—"}
              </text>
            </g>

            {/* SubTopic Value Display - READ-ONLY */}
            <text x={node.x + 10} y={configY + 45} className="node-info text-xs font-medium" style={{ pointerEvents: "none" }}>
              SubTopic
            </text>
            <g className="dropdown-container-readonly" style={{ opacity: 0.9, cursor: "default" }}>
              <rect
                x={node.x + 80}
                y={configY + 35}
                width="80"
                height="18"
                rx="3"
                className="dropdown-select"
                fill="var(--bg-input)"
                stroke="var(--border-color)"
                strokeWidth="0.5"
              />
              <text 
                x={node.x + 85} 
                y={configY + 47} 
                className="node-info text-xs"
                fill="var(--text-primary)"
                style={{ pointerEvents: "none" }}
              >
                {node.subTopic
                  ? (node.subTopic.length > 9
                    ? node.subTopic.substring(0, 7) + "..."
                    : node.subTopic)
                  : "—"}
              </text>
            </g>

            {/* Turns Value Display - READ-ONLY */}
            <text x={node.x + 10} y={configY + 70} className="node-info text-xs font-medium" style={{ pointerEvents: "none" }}>
              Turns
            </text>
            <g className="dropdown-container-readonly" style={{ opacity: 0.9, cursor: "default" }}>
              <rect
                x={node.x + 45}
                y={configY + 60}
                width="35"
                height="18"
                rx="3"
                className="dropdown-select"
                fill="var(--bg-input)"
                stroke="var(--border-color)"
                strokeWidth="0.5"
              />
              <text 
                x={node.x + 50} 
                y={configY + 72} 
                className="node-info text-xs"
                fill="var(--text-primary)"
                style={{ pointerEvents: "none" }}
              >
                {node.turns || "—"}
              </text>
            </g>
            
            {/* Pattern Value Display - READ-ONLY */}
            <text x={node.x + 10} y={configY + 95} className="node-info text-xs font-medium" style={{ pointerEvents: "none" }}>
              Pattern
            </text>
            <g className="dropdown-container-readonly" style={{ opacity: 0.9, cursor: "default" }}>
              <rect
                x={node.x + 60}
                y={configY + 85}
                width="100"
                height="18"
                rx="3"
                className="dropdown-select"
                fill="var(--bg-input)"
                stroke="var(--border-color)"
                strokeWidth="0.5"
              />
              <text 
                x={node.x + 62} 
                y={configY + 97} 
                className="node-info text-xs"
                fill="var(--text-primary)"
                style={{ pointerEvents: "none" }}
              >
                {node.interactionPattern 
                  ? (node.interactionPattern.length > 12
                    ? node.interactionPattern.substring(0, 10) + ".."
                    : node.interactionPattern)
                  : "—"}
              </text>
            </g>
          </>
        )}
      </g>

      {/* Single input port */}
      <circle
        className={`port input-port ${connectingFrom ? 'connecting' : ''}`}
        cx={node.x}
        cy={node.y + 60}
        r="5"
        fill="var(--success)"
        stroke="var(--border-color-light)"
        strokeWidth="2"
        onClick={(e) => {
          e.stopPropagation();
          if (connectingFrom) {
            onCompleteConnection(node.id);
          }
        }}
      />

      {/* Single output port */}
      <circle
        className="port output-port"
        cx={node.x + 170}
        cy={node.y + 60}
        r="5"
        fill="var(--primary-accent)"
        stroke="var(--border-color-light)"
        strokeWidth="2"
        onClick={(e) => {
          e.stopPropagation();
          onStartConnection(node.id);
        }}
      />

      {/* Render all dropdown menus */}
      {activeDropdown === 'moderator' && renderDropdownMenu('moderator')}
      
      {/* Render context menu */}
      {renderContextMenu()}

      {/* Action buttons at the bottom - fixed position */}
      <g className="node-controls" transform={`translate(${node.x}, ${actionBarY})`}>
        <rect
          x="0"
          y="0"
          width="170"
          height={actionBarHeight}
          fill="var(--bg-secondary)"
          rx="3"
        />
        
        {/* Derailer mode checkbox - only visible when scene has human participants */}
        {hasHumanParticipants === true ? (
          <g 
            className="derailer-checkbox" 
            transform="translate(85, 15)" 
            onClick={handleDerailerModeToggle}
            cursor="pointer"
          >
            <rect
              x="-8"
              y="-8"
              width="16"
              height="16"
              fill="var(--bg-input)"
              stroke="var(--border-color)"
              strokeWidth="1"
              rx="2"
            />
            {derailerMode && (
              <path
                d="M-4 0 L-2 2 L4 -4"
                stroke="var(--success)"
                strokeWidth="2"
                fill="none"
              />
            )}
            <title>Derailer Mode {derailerMode ? 'On' : 'Off'}</title>
          </g>
        ) : null}
        
        <g 
          className="message-btn" 
          transform="translate(115, 15)" 
          onClick={(e) => {
            e.stopPropagation();
            if (isActive) return; // Disable when active
            console.log("Message button clicked for node:", node.id);
            onNodeClick(node, e, 'text');
          }}
          opacity={isActive ? "0.5" : "1"}
          style={{ cursor: isActive ? "not-allowed" : "pointer" }}
        >
          <circle r="8" fill={isActive ? "var(--bg-accent-secondary)" : "var(--primary-accent)"} />
          <path d="M-3.5 -2 H3.5 C4.5 -2 4.5 -1 4.5 0 V2 C4.5 3 3.5 3 2.5 3 H-0.5 L-2.5 5 V3 H-3.5 C-4.5 3 -4.5 2 -4.5 1 V0 C-4.5 -1 -3.5 -2 -3.5 -2 Z" fill="var(--text-inverse)" />
          {isActive && (
            <circle r="2" fill="var(--text-inverse)" style={{ animation: "pulse 1s infinite" }}>
              <animateTransform 
                attributeName="transform" 
                type="rotate" 
                from="0 0 0" 
                to="360 0 0" 
                dur="1.5s" 
                repeatCount="indefinite" 
              />
            </circle>
          )}
        </g>
        <g 
          className="play-btn" 
          transform="translate(145, 15)" 
          onClick={(e) => {
            e.stopPropagation();
            if (isActive) return; // Disable when active
            onNodeClick(node, e, 'audio');
          }}
          opacity={isActive ? "0.5" : "1"}
          style={{ cursor: isActive ? "not-allowed" : "pointer" }}
        >
          <circle r="8" fill={isActive ? "var(--warning)" : "var(--success)"} />
          {isActive ? (
            // Show animated dots for playing state
            <g>
              <circle cx="-3" cy="0" r="1.5" fill="var(--text-inverse)">
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin="0s" />
              </circle>
              <circle cx="0" cy="0" r="1.5" fill="var(--text-inverse)">
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin="0.2s" />
              </circle>
              <circle cx="3" cy="0" r="1.5" fill="var(--text-inverse)">
                <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" begin="0.4s" />
              </circle>
            </g>
          ) : (
            // Show play triangle when idle
            <path d="M-3 -4 L-3 4 L4 0 Z" fill="var(--text-inverse)" stroke="none" />
          )}
        </g>
      </g>
    </g>
  );
};

export default NodeDisplay; 