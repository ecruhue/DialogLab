import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Users, User, ArrowUpToLine, Square, Image, CircleUser, Settings } from 'lucide-react';
import useEditorStore from '../inspector/store';

const SceneHierarchyView = ({ 
  currentScene, 
  activeSceneIndex,
  selectedBoxId,
  onSelectBox,
  onMoveBoxToTop
}) => {
  const [expandedParties, setExpandedParties] = useState({});
  const [organizedElements, setOrganizedElements] = useState({
    byParty: {},
    unassigned: []
  });
  const [selectedElementId, setSelectedElementId] = useState(null);
  const { openGlobalPartyInspector } = useEditorStore();

  // Process scene data to organize by party
  useEffect(() => {
    if (!currentScene || activeSceneIndex === null) {
      setOrganizedElements({ byParty: {}, unassigned: [] });
      return;
    }
    
    // Clear selected element when scene changes
    setSelectedElementId(null);
    
    // Only log when we have valid scene data to avoid console spam
    if (currentScene.boxes && currentScene.boxes.length > 0) {
      // Generate a unique key for this scene data to help with comparisons
      const boxIdentifiers = currentScene.boxes.map(b => b.id).join(',');
      const partyIdentifiers = currentScene.boxes.map(b => `${b.id}:${b.party || 'none'}`).join(',');
      
      console.log("Updating hierarchy with boxes:", currentScene.boxes.length, 
                  "Box IDs:", boxIdentifiers.substring(0, 30) + (boxIdentifiers.length > 30 ? '...' : ''),
                  "Party assignments:", partyIdentifiers.substring(0, 30) + (partyIdentifiers.length > 30 ? '...' : ''));
    }
  
    // Debug log to check box contents
    if (currentScene.boxes) {
      console.log(`Total boxes in scene: ${currentScene.boxes.length}`);
      currentScene.boxes.forEach(box => {
        // Enhanced party assignment logging
        const partyValue = box.party || 'none';
        console.log(`Box ${box.id} party assignment: "${partyValue}" (type: ${typeof box.party})`);
        
        if (box.elements) {
          console.log(`Box ${box.id} has ${box.elements.length} elements:`);
          box.elements.forEach(el => {
            console.log(`- Element ${el.id}, type: ${el.elementType}, content: ${Boolean(el.content)}, contentType: ${el.contentType || 'none'}, contentName: ${el.contentName || 'none'}`);
          });
        } else {
          console.log(`Box ${box.id} has no elements array`);
          if (box.avatarData) {
            console.log(`- Has direct avatarData: ${Boolean(box.avatarData)}`);
          }
          if (box.avatarSlots) {
            console.log(`- Has ${box.avatarSlots.length} avatarSlots`);
          }
        }
      });
    }
  
    const byParty = {};
    const unassigned = [];
  
    // Process boxes in the scene
    currentScene.boxes.forEach(box => {
      // If box has party assignment - ensure we're checking for non-empty strings
      if (box.party && typeof box.party === 'string' && box.party.trim() !== '') {
        const partyName = box.party.trim();
        if (!byParty[partyName]) {
          byParty[partyName] = [];
        }
        byParty[partyName].push(box);
        console.log(`Assigned box ${box.id} to party "${partyName}"`);
      } else {
        // Always include boxes without a party in the unassigned section,
        // even if they don't have avatars yet
        unassigned.push(box);
        console.log(`Box ${box.id} remains unassigned (party value: ${JSON.stringify(box.party)})`);
      }
    });
  
    setOrganizedElements({ byParty, unassigned });
    
    // Ensure all parties start expanded
    const initialExpandState = {};
    Object.keys(byParty).forEach(party => {
      initialExpandState[party] = true;
    });
    setExpandedParties(prev => ({...prev, ...initialExpandState}));
    
  }, [currentScene, activeSceneIndex, currentScene?.boxes, 
      // Add dependencies to trigger re-render when party assignments change
      currentScene?.boxes?.map(b => b.party).join(',')]);

  const toggleParty = (party) => {
    setExpandedParties(prev => ({
      ...prev,
      [party]: !prev[party]
    }));
  };

  // Determine element type from its properties
  const determineElementType = (element) => {
    // First check if there's an explicit elementType property
    if (element.elementType) {
      return element.elementType;
    }
    
    // If no explicit type, check for properties that would indicate type
    if (element.avatarData) {
      return 'avatar';
    }
    
    if (element.content || element.contentUrl || element.contentType || element.contentName) {
      return 'content';
    }
    
    return 'unknown';
  };

  // Get avatar name from avatar data
  const getAvatarName = (avatarData) => {
    return avatarData?.name || 'Unnamed Avatar';
  };

  // Get content type name from content type
  const getContentTypeName = (contentType) => {
    if (!contentType) return 'Unknown';
    
    if (contentType.startsWith('image/')) return 'Image';
    if (contentType === 'application/pdf') return 'PDF';
    if (contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        contentType === 'application/vnd.ms-excel') return 'Excel';
    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        contentType === 'application/msword') return 'Word';
    if (contentType === 'text/plain') return 'Text';
    if (contentType === 'text/csv') return 'CSV';
    if (contentType.startsWith('video/')) return 'Video';
    if (contentType.startsWith('audio/')) return 'Audio';
    
    return contentType.split('/')[1] || contentType;
  };

  // Get content name with appropriate file extension
  const getContentNameWithExtension = (element) => {
    // Get content name
    const name = element.contentName || getContentTypeName(element.contentType) || 'Content';
    
    // Extract file extension if not already part of the displayed name
    if (element.contentType) {
      // For PDFs, add .pdf if not already present
      if (element.contentType === 'application/pdf' && !name.toLowerCase().endsWith('.pdf')) {
        return `${name}.pdf`;
      }
      
      // For images
      if (element.contentType.startsWith('image/') && 
          !name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
        const imgExt = element.contentType.split('/')[1] || 'img';
        return `${name}.${imgExt}`;
      }
      
      // For other types
      if (element.contentType === 'text/plain' && !name.toLowerCase().endsWith('.txt')) {
        return `${name}.txt`;
      }
      if (element.contentType === 'text/csv' && !name.toLowerCase().endsWith('.csv')) {
        return `${name}.csv`;
      }
      if ((element.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
           element.contentType === 'application/vnd.ms-excel') && 
          !name.match(/\.(xls|xlsx)$/i)) {
        return `${name}.xlsx`;
      }
      if ((element.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
           element.contentType === 'application/msword') && 
          !name.match(/\.(doc|docx)$/i)) {
        return `${name}.docx`;
      }
    }
    
    return name;
  };

  // Handle element selection
  // Update the handleElementClick function in the SceneHierarchyView component
const handleElementClick = (e, boxId, elementId) => {
  e.stopPropagation(); // Prevent the click from bubbling to the box
  console.log("Element clicked:", elementId, "in box:", boxId);
  
  // First select the box
  onSelectBox(boxId);
  
  // Then highlight the element
  setSelectedElementId(elementId);
  
  try {
    // Find the element in the DOM
    const elementContainer = document.getElementById(`avatar-container-${elementId}`);
    console.log("Looking for element:", `avatar-container-${elementId}`);
    
    if (elementContainer) {
      console.log("Element found, scrolling to it");
      // Store original dimensions and positioning
      const originalWidth = elementContainer.style.width;
      const originalHeight = elementContainer.style.height;
      const computedStyle = window.getComputedStyle(elementContainer);
      const originalPosition = elementContainer.style.position;
      
      // Add an enhanced highlight with padding and rounded corners while preserving dimensions
      elementContainer.style.outline = 'none'; // Remove default outline
      elementContainer.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)'; // Blue shadow as outline
      elementContainer.style.borderRadius = '6px'; // Rounded corners
      elementContainer.style.transition = 'all 0.3s ease'; // Smooth transition for the highlight
      
      // Use a wrapper approach instead of direct margin/padding which would affect dimensions
      if (elementContainer.parentElement) {
        elementContainer.parentElement.style.padding = '2px';
      }
      
      // Scroll to it
      elementContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Remove highlight after delay
      setTimeout(() => {
        if (elementContainer) {
          // Restore original properties
          elementContainer.style.outline = '';
          elementContainer.style.boxShadow = '';
          elementContainer.style.borderRadius = '';
          elementContainer.style.transition = '';
          
          // Restore parent padding if we modified it
          if (elementContainer.parentElement) {
            elementContainer.parentElement.style.padding = '';
          }
        }
      }, 2000);
    } else {
      console.log("Element container not found in DOM");
    }
  } catch (error) {
    console.error("Error highlighting element:", error);
  }
};

  // Get box number based on z-index or array position
  const getBoxNumber = (boxId) => {
    const boxes = currentScene?.boxes || [];
    // First check if box has explicit z-index
    const box = boxes.find(b => b.id === boxId);
    if (box && typeof box.zIndex === 'number') {
      return boxes.length - box.zIndex;
    }
    // If no z-index, use array position (last = top)
    const index = boxes.findIndex(b => b.id === boxId);
    return boxes.length - index;
  };

  // Add function to handle bringing box to front
  const handleBringToFront = (e, boxId) => {
    e.stopPropagation(); // Prevent box selection
    if (onMoveBoxToTop) {
      // Calculate new z-index for the box being moved to top
      const boxes = currentScene?.boxes || [];
      const highestZIndex = Math.max(...boxes.map(b => b.zIndex || 0));
      const newZIndex = highestZIndex + 1;
      
      // Call parent handler with z-index information
      onMoveBoxToTop(boxId, newZIndex);
    }
  };

  // Update the box rendering sections (both in party and unassigned sections)
  const renderBoxContent = (box) => (
    <div className="flex flex-col w-full">
      <div className="flex items-center justify-between group">
        <div className="flex items-center overflow-hidden">
          <Square className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 theme-text-accent-light" />
          <span className="theme-text-primary font-medium truncate">Box {getBoxNumber(box.id)}</span>
        </div>
        <button
          onClick={(e) => handleBringToFront(e, box.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:theme-bg-hover rounded flex-shrink-0"
          title="Bring to front"
        >
          <ArrowUpToLine className="w-3.5 h-3.5 theme-text-tertiary hover:theme-text-primary" />
        </button>
      </div>
      
      {/* Show avatars and content in this box */}
      <div className="ml-5 mt-1 space-y-1.5 overflow-hidden">
        {/* Show avatar elements */}
        {box.elements?.filter(el => el.elementType === 'avatar' && el.avatarData)
          .map((element) => (
            <div key={element.id} className="flex items-center group overflow-hidden">
              <CircleUser className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 theme-text-accent" />
              <span 
                className={`theme-text-secondary group-hover:theme-text-primary transition-all duration-200 truncate ${
                  selectedElementId === element.id ? 
                  'theme-bg-selected px-2.5 py-1 rounded-md font-medium ring-1 ring-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : ''
                }`}
                onClick={(e) => handleElementClick(e, box.id, element.id)}
                title={getAvatarName(element.avatarData)}
              >
                {getAvatarName(element.avatarData)}
              </span>
            </div>
          ))
        }
        
        {/* Show content elements */}
        {box.elements?.filter(el => el.elementType === 'content' && (el.content || el.contentUrl))
          .map((element) => (
            <div key={element.id} className="flex items-center group overflow-hidden">
              <Image className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 theme-text-accent-light" />
              <span 
                className={`theme-text-secondary group-hover:theme-text-primary transition-all duration-200 truncate ${
                  selectedElementId === element.id ? 
                  'theme-bg-selected px-2.5 py-1 rounded-md font-medium ring-1 ring-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : ''
                }`}
                onClick={(e) => handleElementClick(e, box.id, element.id)}
                title={getContentNameWithExtension(element)}
              >
                {getContentNameWithExtension(element)}
              </span>
            </div>
          ))
        }
      </div>
    </div>
  );

  // Update the legacy support rendering
  const renderLegacyContent = (box) => {
    if (box.avatarSlots && !box.elements) {
      return (
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between group">
            <div className="flex items-center overflow-hidden">
              <Square className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 theme-text-accent-light" />
              <span className="theme-text-secondary truncate">Box {getBoxNumber(box.id)}</span>
            </div>
            <button
              onClick={(e) => handleBringToFront(e, box.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:theme-bg-hover rounded flex-shrink-0"
              title="Bring to front"
            >
              <ArrowUpToLine className="w-3.5 h-3.5 theme-text-tertiary hover:theme-text-primary" />
            </button>
          </div>
          
          <div className="ml-5 mt-1 space-y-1.5 overflow-hidden">
            {box.avatarSlots
              .filter(slot => slot.avatarData)
              .map((slot) => (
                <div key={slot.id} className="flex items-center overflow-hidden">
                  <CircleUser className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 theme-text-accent" />
                  <span className="theme-text-tertiary truncate" title={getAvatarName(slot.avatarData)}>
                    {getAvatarName(slot.avatarData)}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      );
    }
    
    if (box.avatarData && !box.elements && !box.avatarSlots) {
      return (
        <div className="flex items-center justify-between group">
          <div className="flex items-center overflow-hidden">
            <Square className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 text-blue-400/70" />
            <span className="theme-text-secondary truncate" title={getAvatarName(box.avatarData)}>
              {getAvatarName(box.avatarData)}
            </span>
          </div>
          <button
            onClick={(e) => handleBringToFront(e, box.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:theme-bg-hover rounded flex-shrink-0"
            title="Bring to front"
          >
            <ArrowUpToLine className="w-3.5 h-3.5 theme-text-tertiary hover:theme-text-primary" />
          </button>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-between group">
        <div className="flex items-center text-xs overflow-hidden">
          <Square className="w-3.5 h-3.5 mr-1.5 flex-shrink-0 theme-text-tertiary" />
          <span className="theme-text-tertiary truncate">Empty Box {getBoxNumber(box.id)}</span>
        </div>
        <button
          onClick={(e) => handleBringToFront(e, box.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:theme-bg-hover rounded flex-shrink-0"
          title="Bring to front"
        >
          <ArrowUpToLine className="w-3.5 h-3.5 theme-text-tertiary hover:theme-text-primary" />
        </button>
      </div>
    );
  };

  if (!currentScene) {
    // Handle case when no scene is selected or scene is still loading
    return (
      <div className="p-4 theme-text-tertiary text-center theme-bg-secondary rounded-lg theme-border">
        <Users className="w-8 h-8 mx-auto mb-2 theme-text-tertiary opacity-50" />
        <p>Waiting for scene to load...</p>
        <p className="text-xs mt-2 theme-text-tertiary">
          No active scene is currently selected
        </p>
      </div>
    );
  }

  return (
    <div className="scene-hierarchy-view flex flex-col h-[340px] overflow-y-auto theme-bg-secondary p-3 rounded-lg theme-border text-sm theme-text-primary shadow-xl" style={{ width: '250px', maxWidth: '250px', flexShrink: 0 }}>
      <h3 className="font-semibold mb-3 px-3 py-2 theme-bg-tertiary rounded-lg theme-text-primary flex items-center justify-between">
        <div className="flex items-center">
          <Users className="w-4 h-4 mr-2 theme-text-accent" />
          <span>Hierarchy</span>
        </div>
        <button 
          onClick={openGlobalPartyInspector}
          className="px-2 py-1.5 text-white rounded-md transition-all duration-200 flex items-center text-xs font-medium shadow-sm hover:shadow-md focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-neutral-900 focus:ring-white/30 bg-gradient-to-br from-sky-600 to-blue-700 hover:from-sky-500 hover:to-sky-600 transform hover:scale-105 active:scale-95"
          title="Manage Party Settings"
        >
          <Settings className="w-3.5 h-3.5 mr-1" />
          <span>Settings</span>
        </button>
      </h3>
      
      {/* Organized by Party */}
      {Object.keys(organizedElements.byParty).length > 0 && (
        <div className="mb-4 space-y-2">
          {Object.entries(organizedElements.byParty).map(([party, boxes]) => (
            <div key={party} className="rounded-md theme-bg-tertiary theme-border-light">
              {/* Party Header */}
              <div 
                className="flex items-center cursor-pointer hover:theme-bg-hover p-2 rounded-md transition-colors duration-200"
                onClick={() => toggleParty(party)}
              >
                {expandedParties[party] ? 
                  <ChevronDown className="w-4 h-4 mr-1.5 theme-text-tertiary" /> : 
                  <ChevronRight className="w-4 h-4 mr-1.5 theme-text-tertiary" />
                }
                <Users className="w-4 h-4 mr-1.5 theme-text-secondary" />
                <span className="font-medium theme-text-primary truncate max-w-[120px]">{party}</span>
                <span className="ml-2 text-xs px-2 py-0.5 theme-bg-tertiary theme-border-light rounded-full theme-text-tertiary">
                  {boxes.length}
                </span>
              </div>
              
              {/* Party Members */}
              {expandedParties[party] && (
                <div className="ml-6 pl-2 border-l theme-border-light py-1 space-y-1">
                  {boxes.map(box => (
                    <div 
                      key={box.id} 
                      className={`p-2 cursor-pointer rounded-md transition-all duration-200 ${
                        box.id === selectedBoxId ? 'theme-bg-selected ring-2 ring-blue-500/40' : 'hover:theme-bg-hover'
                      }`}
                      onClick={() => onSelectBox(box.id)}
                    >
                      {box.elements ? renderBoxContent(box) : renderLegacyContent(box)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Unassigned boxes section */}
      {organizedElements.unassigned.length > 0 && (
        <div className="rounded-md theme-bg-tertiary theme-border-light">
          <div className="mb-1 p-2 font-medium theme-text-primary flex items-center overflow-hidden">
            <User className="w-4 h-4 mr-1.5 flex-shrink-0 theme-text-tertiary" />
            <span className="truncate">Unassigned Participants</span>
            <span className="ml-2 text-xs px-2 py-0.5 theme-bg-tertiary theme-border-light rounded-full theme-text-tertiary flex-shrink-0">
              {organizedElements.unassigned.length}
            </span>
          </div>
          
          <div className="ml-2 space-y-1 p-2">
            {organizedElements.unassigned.map(box => (
              <div 
                key={box.id} 
                className={`p-2 cursor-pointer rounded-md transition-all duration-200 ${
                  box.id === selectedBoxId ? 'theme-bg-selected ring-2 ring-blue-500/40' : 'hover:theme-bg-hover'
                }`}
                onClick={() => onSelectBox(box.id)}
              >
                {box.elements ? renderBoxContent(box) : renderLegacyContent(box)}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Empty state with updated styling */}
      {Object.keys(organizedElements.byParty).length === 0 && 
       organizedElements.unassigned.length === 0 && (
        <div className="p-6 theme-text-tertiary text-center theme-bg-tertiary theme-border-light">
          <Users className="w-8 h-8 mx-auto mb-2 theme-text-tertiary" />
          <p>No avatars in the scene</p>
        </div>
      )}
    </div>
  );
};

export default SceneHierarchyView;