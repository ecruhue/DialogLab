// Update element count in a box
export const updateElementCount = (boxId, newCount, activeSceneIndex, scenes, setScenes, avatarInstancesRef) => {
  if (activeSceneIndex === null || !boxId) return;

  const updatedScenes = [...scenes];
  const boxIndex = updatedScenes[activeSceneIndex].boxes.findIndex(
    (b) => b.id === boxId,
  );

  if (boxIndex === -1) return;

  const currentBox = updatedScenes[activeSceneIndex].boxes[boxIndex];
  const currentElements = currentBox.elements || [];
  const currentCount = currentElements.length;

  // If new count is less than current, remove elements from the end
  if (newCount < currentCount) {
    // Get IDs of elements to be removed
    const elementsToRemove = currentElements.slice(newCount);

    // Clean up avatar instances for avatar-type elements
    elementsToRemove.forEach((element) => {
      if (
        element.elementType === "avatar" &&
        element.avatarData &&
        avatarInstancesRef.current[element.id]
      ) {
        avatarInstancesRef.current[element.id].stop();
        delete avatarInstancesRef.current[element.id];
      }
    });

    // Update the box
    updatedScenes[activeSceneIndex].boxes[boxIndex].elements =
      currentElements.slice(0, newCount);
  }
  // If new count is more than current, add new elements
  else if (newCount > currentCount) {
    const newElements = Array(newCount - currentCount)
      .fill(null)
      .map((_, index) => ({
        id: `element-${Date.now()}-${currentCount + index}`,
        elementType: "avatar", // Default to avatar type
        avatarData: null,
        content: null,
        contentType: null,
        contentUrl: null,
        contentName: null,
      }));

    updatedScenes[activeSceneIndex].boxes[boxIndex].elements = [
      ...currentElements,
      ...newElements,
    ];
  }

  updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
  setScenes(updatedScenes);
};

// Update element type
export const updateElementType = (boxId, elementId, newType, activeSceneIndex, scenes, setScenes, avatarInstancesRef) => {
  if (activeSceneIndex === null || !boxId) return;

  const updatedScenes = [...scenes];
  const boxIndex = updatedScenes[activeSceneIndex].boxes.findIndex(
    (b) => b.id === boxId,
  );

  if (boxIndex === -1) return;

  const elementIndex = updatedScenes[activeSceneIndex].boxes[
    boxIndex
  ].elements.findIndex((element) => element.id === elementId);

  if (elementIndex === -1) return;

  // Get the current element to check its type
  const currentElement =
    updatedScenes[activeSceneIndex].boxes[boxIndex].elements[elementIndex];
  const oldType = currentElement.elementType;

  // If changing from avatar to content type, clean up any avatar instance
  if (oldType === "avatar" && newType === "content") {
    if (avatarInstancesRef.current[elementId]) {
      avatarInstancesRef.current[elementId].stop();
      delete avatarInstancesRef.current[elementId];
    }

    // Clean up the DOM container - remove the canvas or any other elements
    const avatarContainer = document.getElementById(
      `avatar-container-${elementId}`,
    );
    if (avatarContainer) {
      while (avatarContainer.firstChild) {
        avatarContainer.removeChild(avatarContainer.firstChild);
      }
    }

    // Clear avatar data
    updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
      elementIndex
    ].avatarData = null;
  }

  // If changing from content to avatar, clear content data
  if (oldType === "content" && newType === "avatar") {
    updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
      elementIndex
    ].content = null;
    updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
      elementIndex
    ].contentUrl = null;
    updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
      elementIndex
    ].contentType = null;
    updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
      elementIndex
    ].contentName = null;
  }

  // Update the element type
  updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
    elementIndex
  ].elementType = newType;
  updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
  setScenes(updatedScenes);
};

// Delete an element from a box
export const deleteElement = (boxId, elementId, activeSceneIndex, scenes, setScenes, avatarInstancesRef) => {
  if (activeSceneIndex === null || !boxId) return;

  const updatedScenes = [...scenes];
  const boxIndex = updatedScenes[activeSceneIndex].boxes.findIndex(
    (b) => b.id === boxId,
  );

  if (boxIndex === -1) return;

  const elements = updatedScenes[activeSceneIndex].boxes[boxIndex].elements;

  // Don't allow deletion if there's only one element left
  if (elements.length <= 1) {
    alert(
      "Cannot delete the only element in a box. You can delete the entire box instead.",
    );
    return;
  }

  // Find the element to delete
  const elementIndex = elements.findIndex(
    (element) => element.id === elementId,
  );
  if (elementIndex === -1) return;

  // Get the element to check its type
  const element = elements[elementIndex];

  // If it's an avatar, clean up any avatar instance
  if (element.elementType === "avatar" && element.avatarData) {
    if (avatarInstancesRef.current[elementId]) {
      avatarInstancesRef.current[elementId].stop();
      delete avatarInstancesRef.current[elementId];
    }

    // Clean up the DOM container
    const avatarContainer = document.getElementById(
      `avatar-container-${elementId}`,
    );
    if (avatarContainer) {
      while (avatarContainer.firstChild) {
        avatarContainer.removeChild(avatarContainer.firstChild);
      }
    }
  }

  // Remove the element from the array
  updatedScenes[activeSceneIndex].boxes[boxIndex].elements =
    elements.filter((e) => e.id !== elementId);

  // Mark scene as having unsaved changes
  updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
  setScenes(updatedScenes);
};

// Handle content drop onto an element
export const handleContentDrop = async (e, boxId, elementId, file, activeSceneIndex, scenes, setScenes, loadingBoxIds, setLoadingBoxIds) => {
  if (activeSceneIndex === null) return;

  try {
    // Find the box and element
    const updatedScenes = [...scenes];
    const boxIndex = updatedScenes[activeSceneIndex].boxes.findIndex(
      (b) => b.id === boxId,
    );

    if (boxIndex === -1) return;

    // Look for the element in the elements array
    const elementIndex = updatedScenes[activeSceneIndex].boxes[
      boxIndex
    ].elements.findIndex((element) => element.id === elementId);

    if (elementIndex === -1) return;

    // Set loading state for this element
    const loadingStates = new Set(loadingBoxIds);
    loadingStates.add(elementId);
    setLoadingBoxIds(loadingStates);

    // Check if this is a drag from the ContentLibrary
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const dragData = JSON.parse(jsonData);
        
        if (dragData.type === 'content' && dragData.content) {
          console.log('Content drop from ContentLibrary:', dragData.content);

          // Update the element with content data from ContentLibrary
          updatedScenes[activeSceneIndex].boxes[boxIndex].elements[elementIndex] = {
            ...updatedScenes[activeSceneIndex].boxes[boxIndex].elements[elementIndex],
            content: true,
            contentType: dragData.content.contentType,
            contentUrl: dragData.content.contentUrl,
            contentName: dragData.content.filename,
            contentId: dragData.content.id,
            description: dragData.content.description,
            metadata: dragData.content.metadata,
            // Make sure elementType is set to content
            elementType: "content",
          };

          updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
          setScenes(updatedScenes);

          // Remove loading state
          setTimeout(() => {
            const updatedLoadingStates = new Set(loadingBoxIds);
            updatedLoadingStates.delete(elementId);
            setLoadingBoxIds(updatedLoadingStates);
          }, 500);
          
          return;
        }
      }
    } catch (error) {
      console.error('Error processing JSON drag data:', error);
      // Continue with file processing if JSON parsing fails
    }

    // If not a ContentLibrary drop, process as a file
    if (file) {
      // Process the file based on its type
      const reader = new FileReader();

      reader.onload = (event) => {
        const contentUrl = event.target?.result;

        // Update the element with content data
        updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
          elementIndex
        ] = {
          ...updatedScenes[activeSceneIndex].boxes[boxIndex].elements[
            elementIndex
          ],
          content: true,
          contentType: file.type,
          contentUrl: contentUrl,
          contentName: file.name,
          // Make sure elementType is set to content
          elementType: "content",
        };

        updatedScenes[activeSceneIndex].hasUnsavedChanges = true;
        setScenes(updatedScenes);

        // Remove loading state
        setTimeout(() => {
          const updatedLoadingStates = new Set(loadingBoxIds);
          updatedLoadingStates.delete(elementId);
          setLoadingBoxIds(updatedLoadingStates);

          // If it's an Excel file, we need to process it
          if (
            file.type ===
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            file.type === "application/vnd.ms-excel"
          ) {
            processExcelFile(contentUrl, elementId);
          }
        }, 500);
      };

      reader.onerror = () => {
        // Remove loading state on error
        const updatedLoadingStates = new Set(loadingBoxIds);
        updatedLoadingStates.delete(elementId);
        setLoadingBoxIds(updatedLoadingStates);
        console.error("Error reading file");
      };

      reader.readAsDataURL(file);
    } else {
      // If no file and not a ContentLibrary drop, remove loading state
      const updatedLoadingStates = new Set(loadingBoxIds);
      updatedLoadingStates.delete(elementId);
      setLoadingBoxIds(updatedLoadingStates);
    }
  } catch (error) {
    console.error("Error processing content drop:", error);
    // Remove loading state on error
    const updatedLoadingStates = new Set(loadingBoxIds);
    if (elementId) updatedLoadingStates.delete(elementId);
    setLoadingBoxIds(updatedLoadingStates);
  }
};

// Process Excel file for display
export const processExcelFile = async (contentUrl, slotId) => {
  try {
    // We need to fetch the file data from the data URL
    const base64Data = contentUrl.split(",")[1];
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Load SheetJS
    const XLSX = await import("xlsx");

    // Read the workbook
    const workbook = XLSX.read(bytes, { type: "array" });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Generate HTML table from the worksheet
    const htmlTable = XLSX.utils.sheet_to_html(worksheet);

    // Insert the HTML into the container
    const container = document.getElementById(`excel-container-${slotId}`);
    if (container) {
      container.innerHTML = htmlTable;

      // Add some basic styling to the table
      const table = container.querySelector("table");
      if (table) {
        table.style.borderCollapse = "collapse";
        table.style.width = "100%";
        table.style.fontSize = "0.75rem";

        const cells = table.querySelectorAll("td, th");
        cells.forEach((cell) => {
          cell.style.border = "1px solid #e2e8f0";
          cell.style.padding = "0.25rem 0.5rem";
          cell.style.textAlign = "left";
        });

        const headers = table.querySelectorAll("th");
        headers.forEach((header) => {
          header.style.backgroundColor = "var(--bg-panel)";
          header.style.fontWeight = "bold";
        });
      }
    }
  } catch (error) {
    console.error("Error processing Excel file:", error);
    const container = document.getElementById(`excel-container-${slotId}`);
    if (container) {
      container.innerHTML =
        '<p class="text-xs text-red-500">Error loading spreadsheet data</p>';
    }
  }
};

// Handle party assignment for a box
export const handleAssignParty = (boxId, partyName, activeSceneIndex, scenes, setScenes, availableParties, setAvailableParties, setSelectedBoxId) => {
  if (activeSceneIndex === null) return;

  const updatedScenes = [...scenes];
  const boxIndex = updatedScenes[activeSceneIndex].boxes.findIndex(
    (b) => b.id === boxId,
  );

  if (boxIndex === -1) return;

  console.log(`Assigning party to box ${boxId}:`, {
    oldParty: updatedScenes[activeSceneIndex].boxes[boxIndex].party,
    newParty: partyName,
    boxIndex
  });

  // Update the box with the party value - ensure it's a string or null
  updatedScenes[activeSceneIndex].boxes[boxIndex].party = partyName ? String(partyName) : null;
  updatedScenes[activeSceneIndex].hasUnsavedChanges = true;

  // Update the scenes
  setScenes(updatedScenes);

  // If this is a new party, add it to the available parties list
  if (partyName && !availableParties.includes(partyName)) {
    setAvailableParties([...availableParties, partyName]);
  }

  // Force re-render of the hierarchy view by triggering a state update
  // This is a fallback in case the component isn't properly responding to the scenes update
  setSelectedBoxId(boxId); // Reselect the current box to force UI update
  
  // Verify the party was assigned correctly after a brief delay
  setTimeout(() => {
    const currentScenes = window.editorStore?.getState()?.scenes;
    if (currentScenes) {
      const currentScene = currentScenes[activeSceneIndex];
      const updatedBox = currentScene.boxes.find(b => b.id === boxId);
      console.log("Party assignment verification:", {
        boxId,
        partyAfterUpdate: updatedBox?.party
      });
    }
  }, 100);
}; 