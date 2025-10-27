import React, { useState, useEffect, useRef } from 'react';
import { Trash, ChevronDown, ChevronUp, GripHorizontal, Users, File, Plus, FilePlus, Maximize2, Minimize2, Pencil } from 'lucide-react';
// import PartyInspector from '../inspector/PartyInspector';
import useEditorStore from '../inspector/store';


const ConversationGroup = ({
  box,
  selectedBoxId,
  onSelectBox,
  onDeleteBox,
  onUpdateElementCount,
  onMouseDown,
  onResizeStart,
  avatarInstancesRef,
  loadingBoxIds,
  onDrop,
  onContentDrop,
  onUpdateElementType,
  onDeleteElement,
  availableParties,
  onAssignParty,
  party, 
  currentScene,
  speakingInfo = null,
  messages = []
}) => {
  // State for managing element widths
  const [elementWidths, setElementWidths] = useState(
    box.elements?.map(() => 100 / (box.elements.length || 1)) || []
  );
  
  // State to track which element is enlarged
  const [enlargedElementId, setEnlargedElementId] = useState(null);
  
  // State to store original widths before enlarging
  const [preEnlargeWidths, setPreEnlargeWidths] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const { setSelectedItem, updatePartyForBox, emojiStates, updateEmojiState } = useEditorStore();

  const containerRef = useRef(null);
  
  // State to track drag operation
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({
    dividerIndex: -1,
    startX: 0,
    containerWidth: 0,
    originalWidths: [],
    animationFrameId: null
  });

  // State for party menu visibility
  const [showPartyMenu, setShowPartyMenu] = useState(false);

  const isAvatarConfigBox = currentScene?.isAvatarConfig === true;

  // Close party menu when clicking outside
  useEffect(() => {
    if (!showPartyMenu) return;
    
    const handleClickOutside = (event) => {
      const menuButton = document.getElementById(`party-menu-button-${box.id}`);
      const isClickInsideMenu = event.target.closest(`[aria-labelledby="party-menu-button-${box.id}"]`);
      
      if (menuButton && !menuButton.contains(event.target) && !isClickInsideMenu) {
        setShowPartyMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPartyMenu, box.id]);

  // Reset party menu when box changes
  useEffect(() => {
    setShowPartyMenu(false);
    
    // Also hide all element menus when box changes
    document.querySelectorAll('[id^="element-menu-"]').forEach(menu => {
      menu.classList.remove('block');
      menu.classList.add('hidden');
    });
  }, [box.id]);

  // Handle clicks outside element menus
  useEffect(() => {
    const handleClickOutside = (event) => {
      const openMenus = document.querySelectorAll('[id^="element-menu-"].block');
      if (openMenus.length === 0) return;
      
      const isClickInsideAnyButton = !!event.target.closest('[id^="element-menu-button-"]');
      if (isClickInsideAnyButton) return;
      
      const isClickInsideAnyMenu = !!event.target.closest('[id^="element-menu-"].block');
      if (!isClickInsideAnyMenu) {
        openMenus.forEach(menu => {
          menu.classList.remove('block');
          menu.classList.add('hidden');
        });
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // const handleEditClick = (id, e) => {
  //   e.stopPropagation();
    
  //   // Get global party settings if available
  //   try {
  //     const globalSettings = JSON.parse(localStorage.getItem('globalPartySettings') || '{}');
      
  //     // Get current box
  //     const box = currentScene?.boxes.find(b => b.id === id);
  //     if (box && box.party) {
  //       // Apply global party communication settings to the party
  //       const partyConfigs = JSON.parse(localStorage.getItem('partyConfigs') || '{}');
        
  //       // If we have party config for this box and the box has a party assigned
  //       if (partyConfigs[id] && box.party) {
  //         // Update with global settings
  //         partyConfigs[id] = {
  //           ...partyConfigs[id],
  //           enableBackchannel: globalSettings.enableBackchannel || partyConfigs[id].enableBackchannel || false,
  //           partyTurnMode: globalSettings.partyTurnMode || partyConfigs[id].partyTurnMode || 'free',
  //           isModeratorParty: globalSettings.moderatorParty === box.party
  //         };
          
  //         // Save back to localStorage
  //         localStorage.setItem('partyConfigs', JSON.stringify(partyConfigs));
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Error applying global party settings:', error);
  //   }
    
  //   // Open party inspector
  //   setSelectedItem({type: "party", id: id });
  //   setIsEditing(true);
  // };



  
  // Initialize element widths when elements change
  
  useEffect(() => {
    if (box.elements) {
      // Set equal widths for all elements initially
      setElementWidths(box.elements.map(() => 100 / box.elements.length));
      // Reset enlarged state when elements change
      setEnlargedElementId(null);
    }
  }, [box.elements?.length]);
  
  // Function to toggle element enlargement
  const toggleEnlarge = (elementId) => {
    if (enlargedElementId === elementId) {
      // If already enlarged, restore original widths
      setElementWidths([...preEnlargeWidths]);
      setEnlargedElementId(null);
      
      // Fix for avatar disappearing - give time for DOM to update before re-rendering avatars
      setTimeout(() => {
        // Trigger avatar re-rendering if there are avatar elements
        if (avatarInstancesRef && typeof avatarInstancesRef.current === 'object') {
          box.elements.forEach(element => {
            if (element.elementType === 'avatar' && element.avatarData) {
              const containerId = `avatar-container-${element.id}`;
              const container = document.getElementById(containerId);
              if (container && avatarInstancesRef.current[element.id]) {
                // Re-initialize avatar in the container
                const avatarInstance = avatarInstancesRef.current[element.id];
                if (typeof avatarInstance.reattach === 'function') {
                  avatarInstance.reattach(container);
                }
              }
            }
          });
        }
      }, 50);
    } else {
      // Store current widths for later restoration
      setPreEnlargeWidths([...elementWidths]);
      
      // Calculate new widths with the selected element taking 80%
      const newWidths = [...elementWidths];
      const elementIndex = box.elements.findIndex(el => el.id === elementId);
      
      if (elementIndex !== -1) {
        // Set all elements to equal portions of the remaining 20%
        const otherElementsCount = box.elements.length - 1;
        const smallWidth = otherElementsCount > 0 ? 20 / otherElementsCount : 0;
        
        for (let i = 0; i < newWidths.length; i++) {
          newWidths[i] = i === elementIndex ? 80 : smallWidth;
        }
        
        setElementWidths(newWidths);
        setEnlargedElementId(elementId);
        
        // Same fix for avatar disappearing on enlarge
        setTimeout(() => {
          // Trigger avatar re-rendering
          if (avatarInstancesRef && typeof avatarInstancesRef.current === 'object') {
            box.elements.forEach(element => {
              if (element.elementType === 'avatar' && element.avatarData) {
                const containerId = `avatar-container-${element.id}`;
                const container = document.getElementById(containerId);
                if (container && avatarInstancesRef.current[element.id]) {
                  // Re-initialize avatar in the container
                  const avatarInstance = avatarInstancesRef.current[element.id];
                  if (typeof avatarInstance.reattach === 'function') {
                    avatarInstance.reattach(container);
                  }
                }
              }
            });
          }
        }, 50);
      }
    }
  };
  
  // Custom drag handler using requestAnimationFrame for smoother performance
  const handleDividerDrag = (index) => {
    // Capture initial state before any movement
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const originalWidths = [...elementWidths];
    
    // Set up drag information
    dragInfo.current = {
      dividerIndex: index,
      startX: null, // Will be set on first move
      containerWidth,
      originalWidths,
      animationFrameId: null
    };
    
    // Start dragging state
    setIsDragging(true);
    
    // Add overlay to prevent content from interfering with drag operations
    const overlay = document.createElement('div');
    overlay.id = 'drag-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '9999';
    overlay.style.cursor = 'col-resize';
    document.body.appendChild(overlay);
    
    // Set up event handlers
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
    
    // Change UI for dragging
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  
  const handleDragMove = (e) => {
    e.preventDefault();
    
    // Get client X from mouse or touch event
    const clientX = e.clientX;
    
    // Store event data for animation frame processing
    if (dragInfo.current.startX === null) {
      dragInfo.current.startX = clientX;
      return;
    }
    
    // Use requestAnimationFrame for smoother updates
    if (dragInfo.current.animationFrameId === null) {
      dragInfo.current.animationFrameId = requestAnimationFrame(() => {
        updateDragPosition(clientX);
        dragInfo.current.animationFrameId = null;
      });
    }
  };
  
  const handleTouchMove = (e) => {
    e.preventDefault();
    
    // Get client X from touch event
    if (e.touches.length > 0) {
      const clientX = e.touches[0].clientX;
      
      // Store event data for animation frame processing
      if (dragInfo.current.startX === null) {
        dragInfo.current.startX = clientX;
        return;
      }
      
      // Use requestAnimationFrame for smoother updates
      if (dragInfo.current.animationFrameId === null) {
        dragInfo.current.animationFrameId = requestAnimationFrame(() => {
          updateDragPosition(clientX);
          dragInfo.current.animationFrameId = null;
        });
      }
    }
  };
  
  const updateDragPosition = (clientX) => {
    const { dividerIndex, startX, containerWidth, originalWidths } = dragInfo.current;
    
    // Calculate the delta and percentage
    const deltaX = clientX - startX;
    const deltaPercentage = (deltaX / containerWidth) * 100;
    
    // Apply to the elements on both sides of the divider
    const leftIndex = dividerIndex;
    const rightIndex = dividerIndex + 1;
    
    // Calculate potential new widths
    const leftNewWidth = originalWidths[leftIndex] + deltaPercentage;
    const rightNewWidth = originalWidths[rightIndex] - deltaPercentage;
    
    // Minimum width constraint (10%)
    const MIN_WIDTH = 10;
    const newWidths = [...originalWidths];
    
    if (leftNewWidth < MIN_WIDTH) {
      // Left element hit minimum width
      newWidths[leftIndex] = MIN_WIDTH;
      newWidths[rightIndex] = originalWidths[leftIndex] + originalWidths[rightIndex] - MIN_WIDTH;
    } else if (rightNewWidth < MIN_WIDTH) {
      // Right element hit minimum width
      newWidths[rightIndex] = MIN_WIDTH;
      newWidths[leftIndex] = originalWidths[leftIndex] + originalWidths[rightIndex] - MIN_WIDTH;
    } else {
      // Both elements have enough space
      newWidths[leftIndex] = leftNewWidth;
      newWidths[rightIndex] = rightNewWidth;
    }
    
    // Update state
    setElementWidths(newWidths);
  };
  
  const handleDragEnd = () => {
    // Cancel any pending animation frame
    if (dragInfo.current.animationFrameId !== null) {
      cancelAnimationFrame(dragInfo.current.animationFrameId);
    }
    
    // Remove overlay
    const overlay = document.getElementById('drag-overlay');
    if (overlay) {
      document.body.removeChild(overlay);
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleDragEnd);
    
    // Reset UI
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
    
    // Reset dragging state
    setIsDragging(false);
  };
  
  // Clean up event listeners when component unmounts
  useEffect(() => {
    return () => {
      if (isDragging) {
        handleDragEnd();
      }
    };
  }, [isDragging]);

  // Handle dropping content onto an element box
  const handleElementDrop = async (e, boxId, elementId) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // Check if element exists
      const element = box.elements.find(el => el.id === elementId);
      if (!element) return;
      
      // First, check if it's an avatar drop from ContentLibrary
      let avatarData;
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          const data = JSON.parse(jsonData);
          if (data && data.type === 'avatar' && data.persona) {
            avatarData = data;
          }
        }
      } catch (parseError) {
        // Not JSON data or not avatar data, continue with other checks
      }
      
      if (avatarData) {
        // It's an avatar drop, set element type to avatar
        if (element.elementType !== 'avatar') {
          onUpdateElementType(box.id, element.id, 'avatar');
        }
        
        if (onDrop) {
          // Handle the avatar drop
          onDrop(e, boxId, elementId);
        } else {
          console.warn('onDrop prop is not provided to ConversationGroup');
        }
        return;
      }
      
      // Check for content drop from ContentLibrary
      let contentData;
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          const data = JSON.parse(jsonData);
          if (data && data.type === 'content' && data.content) {
            contentData = data;
          }
        }
      } catch (parseError) {
        // Not JSON data or not content data, continue with file handling
      }
      
      if (contentData) {
        // It's a content drop from ContentLibrary, set element type to content
        if (element.elementType !== 'content') {
          onUpdateElementType(box.id, element.id, 'content');
        }
        
        if (onContentDrop) {
          // Pass the event to the parent's onContentDrop handler
          onContentDrop(e, boxId, elementId, null); // no file, the handler will extract JSON data
        } else {
          console.warn('onContentDrop prop is not provided to ConversationGroup');
        }
        return;
      }
      
      // Handle files
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        
        // Log the dropped file information
        console.log('File drop detected:', {
          filename: file.name,
          type: file.type,
          size: file.size
        });
        
        // Determine if this is an avatar or content based on file type
        const isContent = file.type === 'application/pdf' || 
                         file.type.startsWith('image/') ||
                         file.type.includes('spreadsheet') || 
                         file.type.includes('excel') ||
                         file.type === 'text/plain' || 
                         file.type === 'text/csv' ||
                         file.type.startsWith('video/') ||
                         file.type.startsWith('audio/') ||
                         file.type.includes('wordprocessing') ||
                         file.type.includes('document');
                         
        // Avatar files could be GLB/GLTF models, FBX, or special avatar formats
        const isAvatar = file.name.endsWith('.glb') || 
                        file.name.endsWith('.gltf') || 
                        file.name.endsWith('.fbx') ||
                        file.name.endsWith('.vrm') ||
                        file.type.includes('model') ||
                        file.type.includes('avatar');
        
        if (isContent) {
          // Set element type to content if needed
          if (element.elementType !== 'content') {
            onUpdateElementType(box.id, element.id, 'content');
          }
          
          if (onContentDrop) {
            onContentDrop(e, boxId, elementId, file);
          } else {
            console.warn('onContentDrop prop is not provided to ConversationGroup');
          }
        } else if (isAvatar) {
          // Set element type to avatar if needed
          if (element.elementType !== 'avatar') {
            onUpdateElementType(box.id, element.id, 'avatar');
          }
          
          if (onDrop) {
            onDrop(e, boxId, elementId);
          } else {
            console.warn('onDrop prop is not provided to ConversationGroup');
          }
        } else {
          // Default to content for unknown file types
          if (element.elementType !== 'content') {
            onUpdateElementType(box.id, element.id, 'content');
          }
          
          if (onContentDrop) {
            onContentDrop(e, boxId, elementId, file);
          } else {
            console.warn('onContentDrop prop is not provided to ConversationGroup');
          }
        }
      }
    } catch (error) {
      console.error('Error processing drop:', error);
    }
  };

  // Helper function to check if an element is the current speaker
  const isElementSpeaking = (elementId, groupId) => {
    return speakingInfo && 
           speakingInfo.elementId === elementId && 
           speakingInfo.groupId === groupId;
  };

  // Render generic element slot that can be either avatar or content
  const renderElementSlot = (element, box) => {
    const isEnlarged = enlargedElementId === element.id;
    const emojiType = emojiStates[element.id];

    const isSpeaking = isElementSpeaking(element.id, box.id);

    // console.log("Element:", element.id, "Emoji type:", emojiType, "All emoji states:", emojiStates);
    
    return (
      <div
        key={element.id}
        className="h-full relative flex-shrink-0 group/element box-border"
        style={{ 
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden' // Add overflow hidden to prevent content from exceeding boundaries
        }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => handleElementDrop(e, box.id, element.id)}
      >
        {/* Emoji display position - top right corner */}
        {element.elementType === 'avatar' && emojiType && (
          <div className="absolute top-1 right-1 z-20 text-2xl" style={{ pointerEvents: 'none' }}>
            {emojiType === 'raiseHand' && '✋'}
            {emojiType === 'agree' && '👍'}
            {emojiType === 'disagree' && '👎'}
            {emojiType === 'thinking' && '🤔'}
            {emojiType === 'confused' && '😕'}
          </div>
        )}
        
        {/* Element type dropdown menu - visible only on element hover */}
        <div className={`absolute top-1.5 left-1.5 z-10 ${
          selectedBoxId === box.id ? 'opacity-0 group-hover/element:opacity-100' : 'opacity-0 group-hover:opacity-0 group-hover/element:opacity-100'
        } transition-opacity`}>
          <div className="relative inline-block text-left">
            <button
              type="button"
              className="inline-flex justify-center items-center p-1 text-xs font-medium rounded-md border theme-border-secondary shadow-sm theme-bg-secondary theme-text-tertiary hover:theme-bg-hover focus:outline-none transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // Delete element
                if (typeof onDeleteElement === 'function') {
                  if (window.confirm("Are you sure you want to delete this element?")) {
                    onDeleteElement(box.id, element.id);
                  }
                }
              }}
              title="Delete Element"
              aria-label="Delete this element"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {/* Element content based on type - adjusted for proper sizing */}
        <div className="w-full h-full relative select-none box-border overflow-hidden" style={{ userSelect: 'none' }}>
        {element.elementType === 'avatar' ? (
          // Avatar element
          element.avatarData ? (
            <div className="h-full w-full relative overflow-hidden">
              {/* Avatar container - Add speaking highlight here */}
              <div 
                id={`avatar-container-${element.id}`} 
                className={`absolute inset-0 bg-transparent select-none ${
                  isSpeaking ? 'ring-2 ring-yellow-400 ring-opacity-75' : ''
                }`}
                style={{ 
                  userSelect: 'none',
                  transform: 'scale(0.9)',
                  transition: 'box-shadow 0.3s ease-in-out, height 0.3s ease-in-out',
                  boxShadow: isSpeaking ? '0 0 0 3px rgba(250, 204, 21, 0.7)' : 'none',
                  borderRadius: isSpeaking ? '6px' : '0',
                  minHeight: '100%', // Ensure minimum height
                  height: '100%', // Force full height
                  overflow: 'visible', // Allow 3D content to be visible
                  zIndex: 1 // Ensure proper stacking
                }}
              />
              {loadingBoxIds.has(element.id) && (
                <div className="absolute inset-0 flex items-center justify-center theme-bg-primary theme-bg-opacity-75">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 theme-border-accent border-t-transparent rounded-full animate-spin"></div>
                    <span className="mt-2 text-sm theme-text-secondary">Loading avatar...</span>
                  </div>
                </div>
              )}
              {/* Avatar name label - positioned at the bottom right as an overlay */}
              <div 
                className="absolute bottom-2 right-2 z-10 theme-bg-tooltip theme-bg-opacity-70 theme-text-inverse text-xs px-1.5 py-0.5 rounded text-right backdrop-blur-sm transform transition-transform duration-200 hover:scale-105"
                style={{ 
                  maxWidth: '70%', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  maxHeight: '20px', // Strict height limit
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                {element.avatarData.name || 'Unnamed Avatar'}
                {element.avatarData.isHuman && (
                  <span className="ml-1 theme-text-success font-medium">(Human)</span>
                )}
              </div>
            </div>
          ) : (
            // Empty avatar placeholder
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed theme-border-secondary mx-1 my-1 rounded-md hover:theme-border-accent hover:theme-bg-secondary transition-colors overflow-hidden">
              <Plus className="w-5 h-5 theme-text-secondary group-hover/element:theme-text-accent transition-colors" />
              <span className="text-xs theme-text-tertiary mt-1 text-center px-2 truncate w-full">Drag avatar and content here</span>
            </div>
          )
        ) : (
            // Content element
            element.content ? (
              <div className="w-full h-full p-0.5 overflow-auto theme-bg-primary border theme-border-primary text-xs">
                {/* Handle different file types */}
                {element.contentType?.startsWith('image/') && (
                  <img 
                    src={element.contentUrl} 
                    alt="Content" 
                    className="w-full h-full object-contain"
                  />
                )}
                
                {element.contentType === 'application/pdf' && (
                  <div className="w-full h-full flex flex-col">
                    <div className="text-xs theme-text-secondary p-1 theme-bg-tertiary border-b flex justify-between items-center">
                      <span className="truncate">{element.contentName || "PDF Document"}</span>
                      <a 
                        href={element.contentUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="theme-text-accent hover:underline ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </a>
                    </div>
                    <iframe 
                      src={`${element.contentUrl}#toolbar=0&navpanes=0`}
                      className="w-full flex-grow border-0" 
                      title={element.contentName || "PDF Viewer"}
                    />
                  </div>
                )}
                
                {/* Excel files */}
                {(element.contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                  element.contentType === 'application/vnd.ms-excel') && (
                  <div 
                    id={`excel-container-${element.id}`} 
                    className="w-full h-full overflow-auto bg-white p-0.5 text-xs"
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <File className="w-8 h-8 theme-text-success" />
                      <span className="text-sm mt-2">{element.contentName || "Excel Document"}</span>
                    </div>
                  </div>
                )}
                
                {/* Word documents */}
                {(element.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                  element.contentType === 'application/msword') && (
                  <div className="w-full h-full flex flex-col items-center justify-center theme-bg-tertiary">
                    <File className="w-8 h-8 theme-text-accent" />
                    <span className="text-sm mt-2 max-w-full truncate">
                      {element.contentName || "Word Document"}
                    </span>
                  </div>
                )}
                
                {/* Text files */}
                {element.contentType === 'text/plain' && (
                  <div className="w-full h-full p-0.5 overflow-auto theme-bg-primary border theme-border-primary text-xs">
                    <pre className="whitespace-pre-wrap">{element.content}</pre>
                  </div>
                )}
                
                {/* CSV files */}
                {element.contentType === 'text/csv' && (
                  <div className="w-full h-full p-0.5 overflow-auto bg-white border border-gray-200 text-xs">
                    <div className="flex flex-col items-center justify-center h-full">
                      <File className="w-8 h-8 theme-text-secondary" />
                      <span className="text-sm mt-2">{element.contentName || "CSV File"}</span>
                    </div>
                  </div>
                )}
                
                {/* Video files */}
                {element.contentType?.startsWith('video/') && (
                  <video 
                    src={element.contentUrl} 
                    controls 
                    className="w-full h-full object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                )}
                
                {/* Audio files */}
                {element.contentType?.startsWith('audio/') && (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <audio 
                      src={element.contentUrl} 
                      controls 
                      className="w-full max-w-full"
                    >
                      Your browser does not support the audio tag.
                    </audio>
                    <span className="text-sm mt-2 max-w-full truncate">
                      {element.contentName || "Audio File"}
                    </span>
                  </div>
                )}
                
                {/* Fallback for other file types */}
                {(!element.contentType?.startsWith('image/') &&
                  !element.contentType?.startsWith('video/') &&
                  !element.contentType?.startsWith('audio/') &&
                  element.contentType !== 'application/pdf' &&
                  element.contentType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
                  element.contentType !== 'application/vnd.ms-excel' &&
                  element.contentType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
                  element.contentType !== 'application/msword' &&
                  element.contentType !== 'text/plain' &&
                  element.contentType !== 'text/csv') && (
                  <div className="w-full h-full flex flex-col items-center justify-center theme-bg-tertiary">
                    <File className="w-8 h-8 theme-text-secondary" />
                    <span className="text-sm mt-2 max-w-full truncate">
                      {element.contentName || "Unknown file type"}
                    </span>
                    <span className="text-xs theme-text-secondary mt-1">
                      {element.contentType || ""}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              // Empty content placeholder
              <div className="flex flex-col items-center justify-center h-full border-2 border-dashed theme-border-secondary mx-1 my-1 rounded-md hover:theme-border-success hover:theme-bg-secondary transition-colors overflow-hidden">
                <FilePlus className="w-5 h-5 theme-text-secondary group-hover/element:theme-text-success transition-colors" />
                <span className="text-xs theme-text-tertiary mt-1 text-center px-2 truncate w-full">Drag file here</span>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  // Add useEffect to handle emoji states based on messages
  useEffect(() => {
    if (!messages || !messages.length || !currentScene) return;

    messages.forEach(message => {
      if (message.isSystemMessage) {
        const content = message.content || message.message;
        
        // Handle hand raising
        if (content && (content.includes("raised their hand") || content.includes("raised their hands"))) {
          const partyMatch = content.match(/From party "(.*?)":/) || [];
          const party = partyMatch[1];
          
          const participantsMatch = content.match(/: (.*?) (?:has|have) raised their hand/);
          if (participantsMatch && participantsMatch[1]) {
            const names = participantsMatch[1].split(', ');
            names.forEach(name => {
              // Find the avatar element for this participant
              currentScene.boxes.forEach(box => {
                if (box.elements) {
                  box.elements.forEach(element => {
                    if (element.elementType === 'avatar' && 
                        element.avatarData && 
                        (element.avatarData.name === name.trim() || 
                         element.avatarData.characterName === name.trim())) {
                      // Update the emoji state
                      updateEmojiState(element.id, 'raiseHand');
                      console.log(`Set raised hand emoji for participant: ${name}`);
                    }
                  });
                }
              });
            });
          }
        }
        
        // Handle approvals
        if (content && content.includes("approved to speak") || content.includes("approves") && content.includes("speak")) {
          // Updated regex to handle different approval message formats:
          // "The moderator has approved X from party Y to speak"
          // "The moderator approves X from party Y to speak next"
          const approvedMatch = content.match(/(?:has approved|approves) (?:participant )?(?:")?([^"]+?)(?:")?(?: from| to)/);
          if (approvedMatch && approvedMatch[1]) {
            const name = approvedMatch[1].trim();
            console.log("Approved participant:", name);
            
            // Clear the emoji state for the approved speaker
            currentScene.boxes.forEach(box => {
              if (box.elements) {
                box.elements.forEach(element => {
                  if (element.elementType === 'avatar' && 
                      element.avatarData && 
                      (element.avatarData.name === name || 
                       element.avatarData.characterName === name)) {
                      console.log("Found matching avatar element for approved speaker:", element.id);
                      // Remove emoji state
                      updateEmojiState(element.id, null);
                      console.log(`Cleared raised hand emoji for approved participant: ${name}`);
                  }
                });
              }
            });
          }
        }
      }
    });
  }, [messages, currentScene, updateEmojiState]);

  return (
    <div
      className={`absolute group select-none ${
        selectedBoxId === box.id 
          ? 'border-2 shadow-md ring-4 ring-blue-500/20 ring-opacity-50' 
          : 'border theme-border-secondary hover:theme-border-accent'
      } rounded-md overflow-hidden bg-transparent`}
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
        userSelect: 'none', // Disable text selection
        WebkitUserSelect: 'none', // For Safari support
        MozUserSelect: 'none', // For Firefox support
        msUserSelect: 'none', // For IE/Edge support
        transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out, ring 0.2s ease-in-out'
      }}
      data-box-id={box.id}
      onMouseDown={(e) => onMouseDown(e, box.id)}
      onClick={() => onSelectBox(box.id)}
      role="region"
      aria-label={`Conversation box ${box.id}`}
      tabIndex="0"
      onKeyDown={(e) => {
        // Basic keyboard navigation for accessibility
        if (e.key === 'Enter') {
          onSelectBox(box.id);
        }
      }}
    >
      {/* Box header */}
      <div className={`box-header p-1.5 flex justify-between items-center border-b theme-border-primary ${
        selectedBoxId === box.id ? 'bg-transparent' : 'group-hover:bg-transparent'
      } transition-colors cursor-move`}
           style={{ height: '32px', cursor: 'move' }}>
        <div className="flex items-center">
          {/* Party Assignment Button with Tooltip */}
          <div className="relative group/party">
            <button
              id={`party-menu-button-${box.id}`}
              aria-expanded="true"
              aria-haspopup="true"
              className={`inline-flex items-center gap-1 ${
                box.party 
                  ? 'px-2.5 py-1 bg-gradient-to-r from-sky-600 to-sky-500 text-white shadow-sm' 
                  : 'px-2.5 py-1 bg-white text-sky-600 hover:bg-sky-50'
              } rounded-md text-xs font-medium transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95`}
              onClick={(e) => {
                e.stopPropagation();
                setShowPartyMenu(!showPartyMenu);
              }}
              title="Assign to Party"
              aria-label={box.party ? `Party: ${box.party}` : "Assign to Party"}
            >
              <Users className="w-4 h-4" />
              {box.party ? (
                <span className="ml-1">
                  {box.party}
                </span>
              ) : (
                <span className="ml-1">Party</span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            
            {/* Dynamic tooltip based on whether party is assigned */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover/party:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
              {box.party ? 'Change Party' : 'Assign Party'}
            </div>
            
            {/* Party menu dropdown - positioned with fixed positioning */}
            {showPartyMenu && (
              <div 
                className="w-48 origin-top-left rounded-md theme-bg-secondary py-1 shadow-lg ring-1 theme-ring theme-ring-opacity-5 focus:outline-none" 
                role="menu" 
                aria-orientation="vertical" 
                aria-labelledby={`party-menu-button-${box.id}`}
                style={{ 
                  position: 'fixed',
                  zIndex: 9999,
                  top: (() => {
                    // Get the button element
                    const button = document.getElementById(`party-menu-button-${box.id}`);
                    if (button) {
                      const rect = button.getBoundingClientRect();
                      return `${rect.bottom + 5}px`;
                    }
                    return '0px';
                  })(),
                  left: (() => {
                    // Get the button element
                    const button = document.getElementById(`party-menu-button-${box.id}`);
                    if (button) {
                      const rect = button.getBoundingClientRect();
                      return `${rect.left}px`;
                    }
                    return '0px';
                  })()
                }}
              >
                {/* Menu Header */}
                <div className="px-3 py-2 text-xs font-medium theme-text-tertiary border-b theme-border-primary">
                  Assign to Party
                </div>
                
                {/* Party List with Proper Ternary Structure */}
                {availableParties && availableParties.length > 0 ? (
                  <div className="py-1 max-h-[200px] overflow-y-auto">
                    {availableParties.map(partyName => (
                      <button
                        key={partyName}
                        className={`block w-full text-left px-3 py-1.5 text-xs ${
                          box.party === partyName 
                            ? 'theme-bg-accent-secondary theme-text-accent-contrast' 
                            : 'theme-text-tertiary hover:bg-sky-100 dark:hover:bg-sky-900 hover:theme-text-primary transition-all duration-150'
                        }`}
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          updatePartyForBox(box.id, partyName);
                          
                          const savedPartyConfigs = JSON.parse(localStorage.getItem('partyConfigs') || '{}');
                          const savedParties = JSON.parse(localStorage.getItem('savedParties') || '[]');
                          const partyConfig = savedParties.find(p => p.name === partyName);
                          
                          savedPartyConfigs[box.id] = {
                            name: partyName,
                            description: partyConfig?.description || '',
                            speakingMode: partyConfig?.speakingMode || 'random',
                            hasRepresentative: partyConfig?.hasRepresentative || false,
                            enableBackchannel: partyConfig?.enableBackchannel || false,
                            representativeSpeaker: '',
                            participantIds: []
                          };
                          
                          localStorage.setItem('partyConfigs', JSON.stringify(savedPartyConfigs));
                          window.dispatchEvent(new Event('storage'));
                          
                          if (onAssignParty) {
                            onAssignParty(box.id, partyName);
                          }
                          
                          setShowPartyMenu(false);
                        }}
                      >
                        {partyName}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-2 text-xs theme-text-tertiary italic">
                    No parties available
                  </div>
                )}
                
                {/* Remove From Party Option */}
                {box.party && (
                  <button
                    className="block w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-200 dark:hover:bg-red-800 hover:text-red-800 dark:hover:text-red-200 transition-all duration-150 border-t theme-border-primary"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePartyForBox(box.id, null);
                      
                      const savedPartyConfigs = JSON.parse(localStorage.getItem('partyConfigs') || '{}');
                      delete savedPartyConfigs[box.id];
                      localStorage.setItem('partyConfigs', JSON.stringify(savedPartyConfigs));
                      window.dispatchEvent(new Event('storage'));
                      
                      if (onAssignParty) {
                        onAssignParty(box.id, null);
                      }
                      
                      setShowPartyMenu(false);
                    }}
                  >
                    Remove from party
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Element count controls */}
          <div className={`text-sm flex items-center gap-2 ${
            selectedBoxId === box.id ? 'theme-text-tertiary' : 'text-transparent group-hover:theme-text-tertiary'
          }`}>
            <div className="inline-flex items-center theme-bg-secondary rounded border theme-border-primary">
              <span className="px-2 text-xs font-medium">{box.elements?.length || 0}</span>
              <div className="flex flex-col">
                <button 
                  className="p-0.5 hover:theme-bg-accent-secondary rounded-tr transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentCount = box.elements?.length || 0;
                    if (currentCount < 6) {
                      onUpdateElementCount(box.id, currentCount + 1);
                    }
                  }}
                  disabled={(box.elements?.length || 0) >= 6}
                  title="Add element"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button 
                  className="p-0.5 hover:theme-bg-accent-secondary rounded-br transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentCount = box.elements?.length || 0;
                    if (currentCount > 1) {
                      onUpdateElementCount(box.id, currentCount - 1);
                    }
                  }}
                  disabled={(box.elements?.length || 0) <= 1}
                  title="Remove element"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Delete button - hidden for avatar config boxes */}
          {!isAvatarConfigBox && (
            <button
              onClick={(e) => onDeleteBox(box.id, e)}
              className={`p-1 rounded-full hover:theme-bg-error ${
                selectedBoxId === box.id ? 'theme-text-error' : 'text-transparent group-hover:theme-text-error'
              } transition-colors cursor-pointer`}
              title="Delete Box"
              aria-label="Delete this box"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Elements layout - Dynamic based on whether an element is enlarged */}
      <div 
        className="w-full h-[calc(100%-32px)] flex relative box-border overflow-hidden"
        aria-label={`Contains ${box.elements?.length || 0} elements`}
        role="group"
      >
        <div 
          ref={containerRef}
          className={`flex ${enlargedElementId ? 'flex-row' : 'flex-row'} ${isDragging ? 'select-none' : ''} grow h-full`}
          style={{ touchAction: 'none' }}
          role="region"
          aria-label="Element container"
        >
          {/* If an element is enlarged, we'll render all other elements in a column on the left (20% width) */}
          {enlargedElementId ? (
            <>
              {/* Left column with stacked non-enlarged elements */}
              <div className="h-full box-border" style={{ width: '20%' }}>
                <div className="flex flex-col h-full overflow-y-auto">
                  {box.elements.filter(element => element.id !== enlargedElementId).map((element) => (
                    <div 
                      key={element.id}
                      className="relative border-b theme-border-primary last:border-b-0 box-border"
                      style={{ 
                        height: `${100 / (box.elements.length - 1)}%`
                      }}
                    >
                      {renderElementSlot(element, box)}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Draggable divider */}
              <div 
                className="h-full w-6 flex items-center justify-center cursor-col-resize relative z-20 touch-manipulation"
                style={{ 
                  margin: '0 -10px',
                  touchAction: 'none'
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Special drag handler for enlarged mode with improved performance
                  if (!containerRef.current) return;
                  
                  const containerWidth = containerRef.current.getBoundingClientRect().width;
                  
                  // Capture starting point
                  const startX = e.clientX;
                  const startLeftWidth = containerWidth * 0.2; // Initially 20%
                  
                  // Add overlay to prevent content from interfering with drag operations
                  const overlay = document.createElement('div');
                  overlay.id = 'drag-overlay-enlarged';
                  overlay.style.position = 'fixed';
                  overlay.style.top = '0';
                  overlay.style.left = '0';
                  overlay.style.width = '100%';
                  overlay.style.height = '100%';
                  overlay.style.zIndex = '9999';
                  overlay.style.cursor = 'col-resize';
                  document.body.appendChild(overlay);
                  
                  // Use requestAnimationFrame for smoother animations
                  let animationFrameId = null;
                  let lastX = startX;
                  
                  const updateDragPosition = () => {
                    const leftColumn = containerRef.current.children[0];
                    const rightColumn = containerRef.current.children[2];
                    
                    // Calculate new percentage based on latest mouse position
                    const deltaX = lastX - startX;
                    let newLeftPercentage = Math.min(Math.max((startLeftWidth + deltaX) / containerWidth * 100, 10), 50);
                    
                    // Update column widths
                    leftColumn.style.width = `${newLeftPercentage}%`;
                    rightColumn.style.width = `${100 - newLeftPercentage}%`;
                    
                    animationFrameId = null;
                  };
                  
                  const handleMouseMove = (moveEvent) => {
                    moveEvent.preventDefault();
                    lastX = moveEvent.clientX;
                    
                    // Use requestAnimationFrame for smoother updates
                    if (animationFrameId === null) {
                      animationFrameId = requestAnimationFrame(updateDragPosition);
                    }
                  };
                  
                  const handleMouseUp = () => {
                    // Cancel any pending animation frame
                    if (animationFrameId !== null) {
                      cancelAnimationFrame(animationFrameId);
                    }
                    
                    // Remove overlay
                    const overlay = document.getElementById('drag-overlay-enlarged');
                    if (overlay) {
                      document.body.removeChild(overlay);
                    }
                    
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.body.style.cursor = 'default';
                    document.body.style.userSelect = 'auto';
                    
                    // Re-render avatars after resize is complete
                    setTimeout(() => {
                      if (avatarInstancesRef && typeof avatarInstancesRef.current === 'object') {
                        box.elements.forEach(element => {
                          if (element.elementType === 'avatar' && element.avatarData) {
                            const containerId = `avatar-container-${element.id}`;
                            const container = document.getElementById(containerId);
                            if (container && avatarInstancesRef.current[element.id]) {
                              const avatarInstance = avatarInstancesRef.current[element.id];
                              if (typeof avatarInstance.reattach === 'function') {
                                avatarInstance.reattach(container);
                              }
                            }
                          }
                        });
                      }
                    }, 50);
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                }}
              >
                <div className="h-24 w-1.5 theme-bg-tertiary rounded-full absolute opacity-70 group-hover:opacity-100 transition-opacity"></div>
                <div className="h-full w-full opacity-0"></div>
              </div>
              
              {/* Right area with enlarged element */}
              <div className="h-full box-border" style={{ width: '80%' }}>
                {renderElementSlot(box.elements.find(element => element.id === enlargedElementId), box)}
              </div>
            </>
          ) : (
            // Regular horizontal layout when no element is enlarged
            box.elements && box.elements.map((element, index) => (
              <React.Fragment key={element.id}>
                <div 
                  className="h-full box-border"
                  style={{ 
                    width: `${elementWidths[index] || 100 / box.elements.length}%`
                  }}
                >
                  {renderElementSlot(element, box)}
                </div>
                
                {/* Draggable divider between elements - enhanced with better touch area */}
                {index < box.elements.length - 1 && (
                  <div 
                    className={`h-full w-6 flex items-center justify-center cursor-col-resize relative z-20 touch-manipulation ${isDragging ? 'pointer-events-none' : ''}`}
                    style={{ 
                      margin: '0 -10px',  // Wider negative margin for a larger hit area
                      touchAction: 'none' // Prevent default touch actions for better control
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDividerDrag(index);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDividerDrag(index);
                    }}
                    title="Drag to resize elements"
                    aria-label="Resize divider between elements"
                    role="separator"
                  >
                    <div className="h-24 w-1.5 theme-bg-tertiary rounded-full absolute opacity-70 group-hover:opacity-100 transition-opacity"></div>
                    {/* Invisible wider hit area */}
                    <div className="h-full w-full opacity-0"></div>
                  </div>
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      {/* Only render resize handles when box is selected and not being dragged */}
      {selectedBoxId === box.id && !isDragging && (
        <>
          {/* Right resize handle - starts below header */}
          <div 
            className="resize-handle absolute w-5 h-[calc(100%-32px)] right-0 top-[32px] cursor-e-resize transition-colors flex items-center justify-center"
            onMouseDown={(e) => onResizeStart(e, box.id, 'e')}
            title="Resize horizontally"
            aria-label="Resize box horizontally"
          >
            <div className="w-1 h-12 theme-bg-accent rounded-full opacity-0 group-hover:opacity-60"></div>
          </div>
          
          {/* Bottom resize handle */}
          <div 
            className="resize-handle absolute h-5 w-full left-0 bottom-0 cursor-s-resize transition-colors flex items-center justify-center"
            onMouseDown={(e) => onResizeStart(e, box.id, 's')}
            title="Resize vertically"
            aria-label="Resize box vertically"
          >
            <div className="h-1 w-12 theme-bg-accent rounded-full opacity-0 group-hover:opacity-60"></div>
          </div>
          
          {/* Corner resize handle */}
          <div 
            className="resize-handle absolute w-8 h-8 right-0 bottom-0 cursor-se-resize transition-colors flex items-center justify-center overflow-hidden"
            onMouseDown={(e) => onResizeStart(e, box.id, 'se')}
            title="Resize diagonally"
            aria-label="Resize box diagonally"
          >
            <div className="w-6 h-6 rotate-45 opacity-0 group-hover:opacity-40 theme-bg-accent-secondary theme-bg-opacity-60 flex flex-col justify-center">
              <div className="border-b theme-border-accent mb-0.5 opacity-70"></div>
              <div className="border-b theme-border-accent opacity-70"></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ConversationGroup;