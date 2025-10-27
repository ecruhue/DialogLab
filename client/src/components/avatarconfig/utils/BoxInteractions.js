// Handle adding a new box to the current scene
export const handleAddBox = (activeSceneIndex, scenes, setScenes, setSelectedBoxId, syncScenesToStore) => {
  if (activeSceneIndex === null) return;

  // Default position for new box
  const defaultPosition = {
    x: 5,
    y: 5,
    width: 50,
    height: 80,
  };

  // Create new box with elements array instead of separate avatarSlots/contentSlots
  const newBox = {
    id: `box-${Date.now()}`,
    x: defaultPosition.x,
    y: defaultPosition.y,
    width: defaultPosition.width,
    height: defaultPosition.height,
    view: "upper", // Default view
    layoutMode: "vertical",
    elementRatio: 50,
    // Add a default element (replaces participantCount and avatarSlots)
    elements: [
      {
        id: `element-${Date.now()}-0`,
        elementType: "avatar", // Default to avatar type
        avatarData: null,
        content: null,
        contentType: null,
        contentUrl: null,
        contentName: null,
      },
    ],
  };

  const updatedScenes = [...scenes];
  updatedScenes[activeSceneIndex].boxes = [
    ...updatedScenes[activeSceneIndex].boxes,
    newBox,
  ];
  updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
  setScenes(updatedScenes);
  
  // Sync to store if provided
  if (syncScenesToStore) {
    setTimeout(() => syncScenesToStore(), 0);
  }

  // Select the newly created box
  setSelectedBoxId(newBox.id);
  
  return newBox;
};

// Handle deleting a box
export const handleDeleteBox = (
  boxId, 
  e, 
  activeSceneIndex, 
  scenes, 
  setScenes, 
  setSelectedBoxId, 
  avatarInstancesRef,
  syncScenesToStore
) => {
  e.stopPropagation(); // Prevent box selection when clicking delete

  if (activeSceneIndex === null) return;

  // Confirm deletion
  if (window.confirm("Are you sure you want to delete this box?")) {
    // Remove any avatar instance
    if (avatarInstancesRef.current[boxId]) {
      avatarInstancesRef.current[boxId].stop();
      delete avatarInstancesRef.current[boxId];
    }

    // Also remove party configuration for this box if it exists
    try {
      const savedPartyConfigs = JSON.parse(localStorage.getItem('partyConfigs') || '{}');
      if (savedPartyConfigs[boxId]) {
        delete savedPartyConfigs[boxId];
        localStorage.setItem('partyConfigs', JSON.stringify(savedPartyConfigs));
        console.log(`Removed party configuration for box ${boxId}`);
        
        // Trigger storage event for immediate detection by other components
        window.dispatchEvent(new Event('storage'));
      }
    } catch (error) {
      console.error('Error removing party configuration for box:', error);
    }

    // Remove the box from the scene
    const updatedScenes = [...scenes];
    updatedScenes[activeSceneIndex].boxes = updatedScenes[
      activeSceneIndex
    ].boxes.filter((b) => b.id !== boxId);
    updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
    setScenes(updatedScenes);
    
    // Sync to store if provided
    if (syncScenesToStore) {
      setTimeout(() => syncScenesToStore(), 0);
    }

    // If this was the selected box, clear selection
    if (setSelectedBoxId && selectedBoxId === boxId) {
      setSelectedBoxId(null);
    }
  }
};

// Handle background image upload
export const handleBackgroundUpload = (e, activeSceneIndex, scenes, setScenes) => {
  if (activeSceneIndex === null) return;

  const file = e.target.files?.[0];
  if (file) {
    console.log("File selected:", file);
    const reader = new FileReader();
    reader.onload = (event) => {
      console.log("File loaded:", event.target?.result);
      const updatedScenes = [...scenes];
      updatedScenes[activeSceneIndex].backgroundImage =
        event.target?.result;
      updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
      setScenes(updatedScenes);
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
    };
    reader.readAsDataURL(file);
  }
};

// Handle dropping an avatar onto a box
export const handleDrop = async (
  e, 
  boxId, 
  elementId, 
  activeSceneIndex, 
  scenes, 
  setScenes, 
  avatarInstancesRef, 
  initializeAvatar
) => {
  if (activeSceneIndex === null) return;

  e.preventDefault();
  e.stopPropagation();

  try {
    let data;
    try {
      const jsonData = e.dataTransfer.getData("application/json");
      data = JSON.parse(jsonData);
    } catch (parseError) {
      data = e.dataTransfer.getData("text");
    }

    if (data && data.type === "avatar" && data.persona) {
      // ALWAYS check for the latest human status directly from localStorage
      try {
        const savedData = localStorage.getItem('aiPanelData');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (parsedData.humanParticipants) {
            // Update isHuman flag based on current localStorage state
            const isHuman = parsedData.humanParticipants.includes(data.persona.name);
            console.log(`Setting human status for ${data.persona.name} to ${isHuman}`);
            data.persona.isHuman = isHuman;
          }
        }
      } catch (error) {
        console.error('Error reading human participants data:', error);
      }
      
      // Find the box and element
      const updatedScenes = [...scenes];
      const boxIndex = updatedScenes[activeSceneIndex].boxes.findIndex(
        (b) => b.id === boxId,
      );

      if (boxIndex === -1) return;

      const elementIndex = updatedScenes[activeSceneIndex].boxes[
        boxIndex
      ].elements.findIndex((element) => element.id === elementId);

      if (elementIndex === -1) return;

      // Clean up existing avatar instance if it exists
      if (avatarInstancesRef.current[elementId]) {
        await avatarInstancesRef.current[elementId].stop();
        delete avatarInstancesRef.current[elementId];

        // Clear the container's contents
        const container = document.getElementById(
          `avatar-container-${elementId}`,
        );
        if (container) {
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }
        }
      }

      // Update the element with new avatar data
      updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
        elementIndex
      ].avatarData = data.persona;
      // Make sure elementType is set to avatar
      updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
        elementIndex
      ].elementType = "avatar";

      updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
      setScenes(updatedScenes);

      // Initialize the avatar
      await new Promise((resolve) => setTimeout(resolve, 100));
      await initializeAvatar(
        elementId,
        data.persona,
        avatarInstancesRef,
        updatedScenes[activeSceneIndex].boxes[boxIndex].view,
      );
      
      // Notify other components about the change after a brief delay
      setTimeout(() => {
        window.dispatchEvent(new Event('humanParticipantsChanged'));
      }, 100);
    }
  } catch (error) {
    console.error("Error processing drop:", error);
  }
};

// Handle dropping an avatar directly onto the scene background
export const handleBackgroundDrop = async (
  e, 
  activeSceneIndex, 
  scenes, 
  setScenes, 
  setSelectedBoxId, 
  sceneContainerRef, 
  avatarInstancesRef, 
  initializeAvatar
) => {
  if (activeSceneIndex === null) return;

  e.preventDefault();
  e.stopPropagation();

  try {
    let data;
    try {
      const jsonData = e.dataTransfer.getData("application/json");
      data = JSON.parse(jsonData);
    } catch (parseError) {
      data = e.dataTransfer.getData("text");
    }

    if (data && data.type === "avatar" && data.persona) {
      // ALWAYS check for the latest human status directly from localStorage
      try {
        const savedData = localStorage.getItem('aiPanelData');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (parsedData.humanParticipants) {
            // Update isHuman flag based on current localStorage state
            const isHuman = parsedData.humanParticipants.includes(data.persona.name);
            console.log(`Setting human status for ${data.persona.name} to ${isHuman}`);
            data.persona.isHuman = isHuman;
          }
        }
      } catch (error) {
        console.error('Error reading human participants data:', error);
      }
      
      // Calculate drop position relative to the scene container
      const sceneContainer = sceneContainerRef.current;
      if (!sceneContainer) return;

      const containerRect = sceneContainer.getBoundingClientRect();
      
      // Calculate position as percentage of container dimensions
      const relativeX = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      const relativeY = ((e.clientY - containerRect.top) / containerRect.height) * 100;
      
      // Default box size (percentage of container)
      const boxWidth = 30;
      const boxHeight = 80;
      
      // Create a new element ID for the avatar
      const elementId = `element-${Date.now()}-0`;
      
      // Create a new box at the drop position with the avatar
      const newBox = {
        id: `box-${Date.now()}`,
        x: Math.max(0, Math.min(relativeX - boxWidth/2, 100 - boxWidth)),
        y: Math.max(0, Math.min(relativeY - boxHeight/2, 100 - boxHeight)),
        width: boxWidth,
        height: boxHeight,
        view: "upper", // Default view
        layoutMode: "vertical",
        elementRatio: 50,
        elements: [
          {
            id: elementId,
            elementType: "avatar",
            avatarData: data.persona,
            content: null,
            contentType: null,
            contentUrl: null,
            contentName: null,
          },
        ],
      };

      // Add the new box to the scene
      const updatedScenes = [...scenes];
      updatedScenes[activeSceneIndex].boxes = [
        ...updatedScenes[activeSceneIndex].boxes,
        newBox,
      ];
      updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
      setScenes(updatedScenes);

      // Select the newly created box
      setSelectedBoxId(newBox.id);

      // Initialize the avatar after a short delay to allow the DOM to update
      await new Promise((resolve) => setTimeout(resolve, 100));
      await initializeAvatar(elementId, data.persona, avatarInstancesRef, "upper");
      
      // Notify other components about the change after a brief delay
      setTimeout(() => {
        window.dispatchEvent(new Event('humanParticipantsChanged'));
      }, 100);
    }
  } catch (error) {
    console.error("Error processing background drop:", error);
  }
};

// Handle dropping content directly onto the scene background
export const handleContentBackgroundDrop = async (
  e, 
  activeSceneIndex, 
  scenes, 
  setScenes, 
  setSelectedBoxId, 
  sceneContainerRef,
  loadingBoxIds,
  setLoadingBoxIds
) => {
  if (activeSceneIndex === null) return;

  e.preventDefault();
  e.stopPropagation();

  try {
    // First check if this is a content drop from ContentLibrary
    let contentData;
    try {
      const jsonData = e.dataTransfer.getData("application/json");
      if (jsonData) {
        contentData = JSON.parse(jsonData);
      }
    } catch (parseError) {
      console.error("Error parsing JSON data:", parseError);
    }

    // Check if we have valid content data or files
    const hasContentData = contentData && contentData.type === "content" && contentData.content;
    const hasFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
    
    if (!hasContentData && !hasFiles) {
      console.log("No valid content found in the drop");
      return;
    }

    // Calculate drop position relative to the scene container
    const sceneContainer = sceneContainerRef.current;
    if (!sceneContainer) return;

    const containerRect = sceneContainer.getBoundingClientRect();
    
    // Calculate position as percentage of container dimensions
    const relativeX = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    const relativeY = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    
    // Default box size (percentage of container)
    const boxWidth = 20; // Wider for content
    const boxHeight = 80; // Shorter than avatar boxes
    
    // Create a new element ID for the content
    const elementId = `element-${Date.now()}-0`;
    
    // Set loading state for this element
    if (setLoadingBoxIds) {
      const loadingStates = new Set(loadingBoxIds || []);
      loadingStates.add(elementId);
      setLoadingBoxIds(loadingStates);
    }

    // Create an element based on the content data or file
    let element = {
      id: elementId,
      elementType: "content",
      avatarData: null,
    };

    // Process ContentLibrary drag
    if (hasContentData) {
      console.log('Content drop from ContentLibrary:', contentData.content);
      element = {
        ...element,
        content: true,
        contentType: contentData.content.contentType,
        contentUrl: contentData.content.contentUrl,
        contentName: contentData.content.filename,
        contentId: contentData.content.id,
        description: contentData.content.description,
        metadata: contentData.content.metadata,
      };
    } 
    // Process file drop
    else if (hasFiles) {
      const file = e.dataTransfer.files[0]; // Only process first file for now
      console.log('File drop detected:', file.name, file.type);
      
      // Expanded content type detection
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
      
      // Check for avatar file types by extension
      const isAvatar = file.name.endsWith('.glb') || 
                      file.name.endsWith('.gltf') || 
                      file.name.endsWith('.fbx') ||
                      file.name.endsWith('.vrm') ||
                      file.type.includes('model') ||
                      file.type.includes('avatar');
      
      if (isContent) {
        // Create local object URL for the file
        const objectUrl = URL.createObjectURL(file);
        
        element = {
          ...element,
          content: true,
          contentType: file.type,
          contentUrl: objectUrl,
          contentName: file.name,
          description: `Dropped file: ${file.name}`,
          metadata: {
            author: 'User Upload',
            year: new Date().getFullYear().toString(),
            subject: file.type.includes('pdf') ? 'Document' : 
                    file.type.includes('image') ? 'Image' : 
                    file.type.includes('video') ? 'Video' :
                    file.type.includes('audio') ? 'Audio' :
                    file.type.includes('spreadsheet') || file.type.includes('excel') ? 'Spreadsheet' : 
                    file.type.includes('wordprocessing') || file.type.includes('document') ? 'Document' :
                    'Document'
          }
        };
      } else if (isAvatar) {
        // This is an avatar file, we should handle it differently
        console.warn('Avatar file type detected but dropped on content handler. Treating as content.');
        
        // Still try to treat it as content
        const objectUrl = URL.createObjectURL(file);
        
        element = {
          ...element,
          content: true,
          contentType: file.type || 'model/gltf-binary',
          contentUrl: objectUrl,
          contentName: file.name,
          description: `Dropped file: ${file.name}`,
          metadata: {
            author: 'User Upload',
            year: new Date().getFullYear().toString(),
            subject: 'Model'
          }
        };
      } else {
        console.warn('Unknown file type:', file.type, 'Treating as generic content.');
        // Try to handle unknown file types as generic content
        const objectUrl = URL.createObjectURL(file);
        
        element = {
          ...element,
          content: true,
          contentType: file.type || 'application/octet-stream',
          contentUrl: objectUrl,
          contentName: file.name,
          description: `Dropped file: ${file.name}`,
          metadata: {
            author: 'User Upload',
            year: new Date().getFullYear().toString(),
            subject: 'File'
          }
        };
      }
    }
    
    // Create a new box at the drop position with the content
    const newBox = {
      id: `box-${Date.now()}`,
      x: Math.max(0, Math.min(relativeX - boxWidth/2, 100 - boxWidth)),
      y: Math.max(0, Math.min(relativeY - boxHeight/2, 100 - boxHeight)),
      width: boxWidth,
      height: boxHeight,
      view: "content", // View type for content
      layoutMode: "vertical",
      elementRatio: 100,
      elements: [element],
    };

    // Add the new box to the scene
    const updatedScenes = [...scenes];
    updatedScenes[activeSceneIndex].boxes = [
      ...updatedScenes[activeSceneIndex].boxes,
      newBox,
    ];
    updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
    setScenes(updatedScenes);

    // Select the newly created box
    setSelectedBoxId(newBox.id);
    
    // Remove loading state after a brief delay
    setTimeout(() => {
      if (setLoadingBoxIds) {
        const updatedLoadingStates = new Set(loadingBoxIds || []);
        updatedLoadingStates.delete(elementId);
        setLoadingBoxIds(updatedLoadingStates);
      }
    }, 500);
  } catch (error) {
    console.error("Error processing content background drop:", error);
  }
};

// Drag functionality
export const handleMouseDown = (e, boxId, dragRef, setIsDragging) => {
  // Check for the drag handle in box header or the header itself
  if (!e.target.closest('.box-header') && !e.target.classList.contains('box-header')) return;
  if (e.target.classList.contains('resize-handle')) return;
  
  e.stopPropagation();
  e.preventDefault(); // Prevent text selection during drag
  setIsDragging(true);

  // Apply cursor-move to document body during dragging
  document.body.style.cursor = 'move';

  const sceneContainer = e.currentTarget.closest('.scene-background');
  if (!sceneContainer) return;

  const containerRect = sceneContainer.getBoundingClientRect();
  const box = sceneContainer.querySelector(`[data-box-id="${boxId}"]`) || e.currentTarget;
  if (!box) return;
  
  const boxRect = box.getBoundingClientRect();

  // Store all necessary information for accurate dragging
  dragRef.current = {
    boxId,
    // Calculate mouse offset from the box's top-left corner
    offsetX: e.clientX - boxRect.left,
    offsetY: e.clientY - boxRect.top,
    // Store container dimensions for percentage calculation
    containerWidth: containerRect.width,
    containerHeight: containerRect.height
  };
};

// Handle mouse movement for dragging and resizing
export const handleMouseMove = (e, isDragging, isResizing, dragRef, resizeRef, activeSceneIndex, currentScene, scenes, setScenes, sceneContainerRef) => {
  if (activeSceneIndex === null) return;

  if (isDragging && dragRef.current.boxId) {
    const sceneContainer = sceneContainerRef.current;
    if (!sceneContainer) return;

    const containerRect = sceneContainer.getBoundingClientRect();
    const box = currentScene.boxes.find(
      (b) => b.id === dragRef.current.boxId,
    );
    if (!box) return;

    // Calculate new position in pixels first
    const newLeftPx = e.clientX - dragRef.current.offsetX;
    const newTopPx = e.clientY - dragRef.current.offsetY;
    
    // Convert to percentages using the current container dimensions
    const newX = (newLeftPx - containerRect.left) / containerRect.width * 100;
    const newY = (newTopPx - containerRect.top) / containerRect.height * 100;

    // Apply boundaries to keep box within container
    const boundedX = Math.max(0, Math.min(newX, 100 - box.width));
    const boundedY = Math.max(0, Math.min(newY, 100 - box.height));

    // Update box position
    const updatedScenes = [...scenes];
    updatedScenes[activeSceneIndex].boxes = updatedScenes[
      activeSceneIndex
    ].boxes.map((b) =>
      b.id === dragRef.current.boxId ? { ...b, x: boundedX, y: boundedY } : b,
    );
    updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
    setScenes(updatedScenes);
  }

  // Similar updates for resizing...
  if (isResizing && resizeRef.current.boxId) {
    const sceneContainer = sceneContainerRef.current;
    if (!sceneContainer) return;

    const containerRect = sceneContainer.getBoundingClientRect();
    const box = currentScene.boxes.find(
      (b) => b.id === resizeRef.current.boxId,
    );
    if (!box) return;

    const deltaX = e.clientX - resizeRef.current.startX;
    const deltaY = e.clientY - resizeRef.current.startY;

    let newWidth = resizeRef.current.startWidth;
    let newHeight = resizeRef.current.startHeight;

    switch (resizeRef.current.handle) {
      case "e":
        newWidth = Math.max(
          10,
          Math.min(
            resizeRef.current.startWidth +
              (deltaX / containerRect.width) * 100,
            100 - box.x, // Ensure box doesn't exceed right boundary
          ),
        );
        break;
      case "s":
        newHeight = Math.max(
          10,
          Math.min(
            resizeRef.current.startHeight +
              (deltaY / containerRect.height) * 100,
            100 - box.y, // Ensure box doesn't exceed bottom boundary
          ),
        );
        break;
      case "se":
        newWidth = Math.max(
          10,
          Math.min(
            resizeRef.current.startWidth +
              (deltaX / containerRect.width) * 100,
            100 - box.x,
          ),
        );
        newHeight = Math.max(
          10,
          Math.min(
            resizeRef.current.startHeight +
              (deltaY / containerRect.height) * 100,
            100 - box.y,
          ),
        );
        break;
    }

    const updatedScenes = [...scenes];
    updatedScenes[activeSceneIndex].boxes = updatedScenes[
      activeSceneIndex
    ].boxes.map((b) =>
      b.id === resizeRef.current.boxId
        ? { ...b, width: newWidth, height: newHeight }
        : b,
    );
    updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
    setScenes(updatedScenes);
  }
};

// Handle mouse up to end dragging/resizing
export const handleMouseUp = (setIsDragging, setIsResizing, dragRef, resizeRef) => {
  setIsDragging(false);
  setIsResizing(false);
  
  // Reset cursor style
  document.body.style.cursor = 'default';
  
  dragRef.current = { 
    boxId: null, 
    offsetX: 0, 
    offsetY: 0, 
    containerWidth: 0, 
    containerHeight: 0 
  };
  resizeRef.current = {
    boxId: null,
    handle: null,
    startWidth: 0,
    startHeight: 0,
    startX: 0,
    startY: 0,
  };
};

// Handle background click
export const handleBackgroundClick = (e, isDragging, setSelectedBoxId) => {
  // Only deselect if clicking directly on the background
  if (e.target.classList.contains("scene-background")) {
    if (!isDragging) {
      // Don't deselect while dragging
      setSelectedBoxId(null);
    }
  }
};

// Handle resize start
export const handleResizeStart = (e, boxId, handle, setIsResizing, setSelectedBoxId, resizeRef, currentScene) => {
  e.stopPropagation();
  setIsResizing(true);
  setSelectedBoxId(boxId);
  const box = currentScene.boxes.find((b) => b.id === boxId);

  resizeRef.current = {
    boxId,
    handle,
    startWidth: box.width,
    startHeight: box.height,
    startX: e.clientX,
    startY: e.clientY,
  };
}; 