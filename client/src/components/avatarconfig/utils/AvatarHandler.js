import API_CONFIG from '../../../config';

// Get default voice based on gender
export const getDefaultVoiceByGender = (persona) => {
  // If a voice is already specified, use it
  if (persona.voice) return persona.voice;

  // Use gender-specific voice mapping
  switch (persona.gender) {
    case "male":
      return "en-GB-Standard-B"; // Male voice
    case "female":
      return "en-GB-Standard-A"; // Female voice
    default:
      // If gender is undefined, try to derive from the avatar name or URL
      const lowerCaseName = (
        persona.name ||
        persona.url ||
        ""
      ).toLowerCase();
      if (
        lowerCaseName.includes("female") ||
        lowerCaseName.includes("girl")
      ) {
        return "en-GB-Standard-A";
      }
      if (lowerCaseName.includes("male") || lowerCaseName.includes("boy")) {
        return "en-GB-Standard-B";
      }

      // Fallback to a neutral voice if no clear gender is detected
      return "en-GB-Standard-C";
  }
};

// Ensure the avatar container exists in the DOM
export const ensureAvatarContainer = (boxId) => {
  const containerId = `avatar-container-${boxId}`;
  if (!document.getElementById(containerId)) {
    console.log(`Creating missing container: ${containerId}`);
    // Find a suitable parent to attach the container to
    let parentElement = document.querySelector('.scene-box-content') || 
                         document.querySelector('.scene-box') || 
                         document.querySelector('.scene-container') ||
                         document.body;
    
    // Create the container
    const container = document.createElement('div');
    container.id = containerId;
    container.classList.add('avatar-container');
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    
    // Append to the parent
    parentElement.appendChild(container);
    return container;
  }
  
  // Container already exists, just return it
  return document.getElementById(containerId);
};

// Initialize a new avatar instance
export const initializeAvatar = async (boxId, persona, avatarInstancesRef) => {
  console.log(
    "Creating 3D avatar instance for element:",
    boxId,
    "with persona:",
    persona,
  );

  if (!persona || !persona.url) {
    console.error("Invalid model URL for persona:", persona);
    return false;
  }

  // Check for saved configuration
  try {
    const storageKey = `avatar-config-${persona.name || boxId}`;
    const savedConfigStr = localStorage.getItem(storageKey);

    if (savedConfigStr) {
      const savedConfig = JSON.parse(savedConfigStr);
      console.log(
        `Found saved configuration for avatar: ${persona.name || boxId}`,
      );
      console.log(
        `Saved configuration for avatar: ${persona.name} is ${savedConfig.voice}`,
      );

      // Merge saved config with persona
      persona = {
        ...persona,
        voice: savedConfig.voice || persona.voice,
        settings: {
          ...persona.settings,
          ...(savedConfig.settings || {}),
        },
      };
    }
  } catch (error) {
    console.error("Error loading saved avatar configuration:", error);
  }

  // Wait a moment to ensure DOM is ready
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Ensure container exists
  const container = ensureAvatarContainer(boxId);
  if (!container) {
    console.error("Container creation failed for:", `avatar-container-${boxId}`);
    console.log(
      "Available containers:",
      Array.from(
        document.querySelectorAll('[id^="avatar-container-"]'),
      ).map((el) => el.id),
    );
    return false;
  }

  // Check if we already have an instance and it's not stopped
  if (
    avatarInstancesRef.current[boxId] &&
    !avatarInstancesRef.current[boxId]._isStopped
  ) {
    console.log("Avatar instance already active:", boxId);
    return true;
  }

  // Clean up existing instance if it exists
  if (avatarInstancesRef.current[boxId]) {
    console.log("Cleaning up existing avatar instance");
    try {
      await avatarInstancesRef.current[boxId].stop();
    } catch (error) {
      console.warn("Error stopping avatar instance:", error);
    }
    delete avatarInstancesRef.current[boxId];

    // Clear the container's contents
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  try {
    // Ensure the container has the correct styling for containing the avatar
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.position = "relative";
    container.style.overflow = "hidden";

    // This is critical - ensure the avatar container is visible
    container.style.display = "block";

    const boxHeight = container.clientHeight || 300;

    console.log(
      "Container dimensions:",
      container.offsetWidth,
      container.offsetHeight,
      "Container visibility:",
      window.getComputedStyle(container).display,
    );

    const { TalkingHead } = await import("talkinghead");
    console.log("Creating TalkingHead with URL:", persona.url);

    const instance = new TalkingHead(container, {
      height: boxHeight,
      ttsEndpoint: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TTS}`,
      ttsApikey: localStorage.getItem('TTS_API_KEY') || null,
      lipsyncModules: ["en"],
    });

    // Track initialization state internally
    instance._isStopped = false;

    // Override stop method to track stopped state
    const originalStop = instance.stop;
    instance.stop = async function () {
      const result = await originalStop.apply(this, arguments);
      this._isStopped = true;
      return result;
    };

    const isMale =
      persona.gender === "male" ||
      (persona.gender === undefined && persona.url.includes("male-avatar"));

    await instance.showAvatar({
      url: persona.url,
      body: isMale ? "M" : "F", // Set body type based on gender
      avatarMood: persona.settings?.mood || "neutral",
      ttsLang: "en-GB",
      ttsVoice: getDefaultVoiceByGender(persona),
      lipsyncLang: "en",
      transparent: true, // Enable transparent background
    });

    // Apply the camera view from saved settings if available
    await instance.setView(persona.settings?.cameraView || "upper", {
      cameraDistance: persona.settings?.cameraDistance || 0.5,
      cameraRotateY: persona.settings?.cameraRotateY || 0,
    });

    // After initialization, ensure any created canvas is properly contained
    const canvasElements = container.querySelectorAll("canvas");
    canvasElements.forEach((canvas) => {
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
    });

    avatarInstancesRef.current[boxId] = instance;
    console.log("Avatar initialized successfully for:", boxId);
    return true;
  } catch (error) {
    console.error("Detailed error initializing avatar:", error);
    return false;
  }
};

// Handle avatar configuration request
export const handleAvatarConfigRequest = (
  avatarConfig, 
  scenes, 
  setScenes, 
  setActiveSceneIndex, 
  setConfiguredAvatar, 
  setShowInitialModal, 
  avatarInstancesRef,
  initializeAvatar
) => {
  // Check for saved configuration
  try {
    const storageKey = `avatar-config-${avatarConfig.name || avatarConfig.id}`;
    const savedConfigStr = localStorage.getItem(storageKey);

    if (savedConfigStr) {
      const savedConfig = JSON.parse(savedConfigStr);
      console.log(
        `Loading saved configuration for avatar config tab: ${avatarConfig.name || avatarConfig.id}`,
      );

      // Merge saved config with provided config
      avatarConfig = {
        ...avatarConfig,
        voice: savedConfig.voice || avatarConfig.voice,
        settings: {
          ...avatarConfig.settings,
          ...(savedConfig.settings || {}),
        },
      };
    }
  } catch (error) {
    console.error("Error loading saved avatar configuration:", error);
  }

  setConfiguredAvatar(avatarConfig);

  // Check if avatar config scene already exists
  const existingConfigIndex = scenes.findIndex(
    (scene) =>
      scene.isAvatarConfig &&
      scene.avatarConfig &&
      scene.avatarConfig.name === avatarConfig.name,
  );

  if (existingConfigIndex >= 0) {
    // Switch to existing config scene
    setActiveSceneIndex(existingConfigIndex);

    // Update the configuration in case it changed
    const updatedScenes = [...scenes];
    updatedScenes[existingConfigIndex].avatarConfig = avatarConfig;
    setScenes(updatedScenes);

    // Find and update the preview box's avatar element
    const previewBox = updatedScenes[existingConfigIndex].boxes.find(
      (box) => box.id.startsWith("config-preview-"),
    );

    if (previewBox && previewBox.elements && previewBox.elements[0]) {
      const elementId = previewBox.elements[0].id;

      // If there's an existing avatar instance, update it
      if (avatarInstancesRef.current[elementId]) {
        const instance = avatarInstancesRef.current[elementId];

        // Update mood
        if (avatarConfig.settings?.mood && instance.setMood) {
          instance.setMood(avatarConfig.settings.mood);
        }

        // Update view
        if (instance.setView) {
          instance.setView(avatarConfig.settings?.cameraView || "upper", {
            cameraDistance: avatarConfig.settings?.cameraDistance || 0.5,
            cameraRotateY: avatarConfig.settings?.cameraRotateY || 0,
          });
        }
      }
    }
  } else {
    // Create new avatar config scene with proper element structure
    const newScene = {
      id: `config-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `${avatarConfig.name} Config`,
      boxes: [],
      backgroundImage: null,
      hasUnsavedChanges: false,
      isAvatarConfig: true,
      avatarConfig: avatarConfig,
    };

    // Add the new scene and set it as active
    setScenes([...scenes, newScene]);
    setActiveSceneIndex(scenes.length);
    setShowInitialModal(false);

    // Create avatar preview box with proper elements array
    setTimeout(() => {
      // Create a box with proper element structure
      const previewBox = {
        id: `config-preview-${Date.now()}`,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        layoutMode: "vertical",
        elementRatio: 50,
        // Use the new elements array format with one avatar element
        elements: [
          {
            id: `element-${Date.now()}`,
            elementType: "avatar",
            avatarData: avatarConfig,
            content: null,
            contentType: null,
            contentUrl: null,
            contentName: null,
          },
        ],
      };

      const updatedScenes = [...scenes, newScene];
      updatedScenes[scenes.length].boxes = [previewBox];
      setScenes(updatedScenes);

      // Initialize avatar with delay to ensure DOM is ready
      setTimeout(() => {
        // Initialize the avatar for the element, not the box
        const elementId = previewBox.elements[0].id;
        initializeAvatar(elementId, avatarConfig, avatarInstancesRef);
      }, 200);
    }, 300);
  }
};

// Update current rotation values before saving
export const updateCurrentRotationValues = (activeSceneIndex, scenes, setScenes, avatarInstancesRef) => {
  if (activeSceneIndex === null) return;

  const updatedScenes = [...scenes];
  const currentBoxes = updatedScenes[activeSceneIndex].boxes;

  // For each box with an avatar, get the current rotation
  for (const box of currentBoxes) {
    if (
      box.avatarData &&
      avatarInstancesRef.current[box.id] &&
      !avatarInstancesRef.current[box.id]._isStopped
    ) {
      const instance = avatarInstancesRef.current[box.id];
      if (instance.getCameraRotation) {
        const currentRotation = instance.getCameraRotation();
        if (currentRotation !== null) {
          // Update the box's rotation value
          const boxIndex = currentBoxes.findIndex((b) => b.id === box.id);
          if (boxIndex !== -1) {
            updatedScenes[activeSceneIndex].boxes[boxIndex].cameraRotation =
              currentRotation;
          }
        }
      }
    }
  }

  setScenes(updatedScenes);
}; 