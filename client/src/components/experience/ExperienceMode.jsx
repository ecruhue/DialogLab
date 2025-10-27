import React, { useState, useEffect, useRef } from 'react';
import useEditorStore from '../inspector/store';
import ExperienceSceneSetupModal from './ExperienceSceneSetupModal';
import { AudioPlaybackAdapter, dispatchSceneEvent } from '../nodeeditor/utils/AudioPlaybackAdapter';
import { API_CONFIG } from '../../config';

const ExperienceMode = () => {
  const { scenes, savedScenes, loadSavedScenes, loadSavedScene, setScenes, setActiveSceneId, activeSceneId, deleteSavedScene } = useEditorStore();
  const [showSceneSelector, setShowSceneSelector] = useState(true);
  const [selectedScene, setSelectedScene] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const fileInputRef = useRef(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(null);
  const [avatarInstances, setAvatarInstances] = useState({});
  const sceneContainerRef = useRef(null);
  const [visibleParties, setVisibleParties] = useState({});
  const [focusedParty, setFocusedParty] = useState(null);
  const initializedScenesRef = useRef(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState([]);
  const [speakingInfo, setSpeakingInfo] = useState(null);
  const eventSourceRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    loadSavedScenes();
  }, [loadSavedScenes]);

  useEffect(() => {
    const loadCurrentScene = async () => {
      if (activeSceneId && savedScenes.length > 0) {
        console.log("Found active scene ID:", activeSceneId);
        
        if (initializedScenesRef.current.has(activeSceneId)) {
          console.log("Scene already initialized, skipping:", activeSceneId);
          return;
        }
        
        setShowSceneSelector(false);
        
        try {
          const foundScene = savedScenes.find(scene => scene.id === activeSceneId);
          if (foundScene) {
            console.log("Found scene in savedScenes:", foundScene);
            initializedScenesRef.current.add(activeSceneId);
            await handleLoadSavedScene(foundScene.id);
          } else {
            console.log("Scene not found in savedScenes list");
            setShowSceneSelector(true);
          }
        } catch (error) {
          console.error("Error loading active scene:", error);
          setShowSceneSelector(true);
          initializedScenesRef.current.delete(activeSceneId);
        }
      }
    };
    
    loadCurrentScene();
  }, [activeSceneId, savedScenes]);

  const handleLoadSavedScene = async (sceneId) => {
    try {
      console.log("Loading scene with ID:", sceneId);
      
      if (selectedScene && selectedScene.id === sceneId) {
        console.log("Scene already loaded:", sceneId);
        return Promise.resolve(selectedScene);
      }
      
      const loadedScene = await loadSavedScene(sceneId);
      
      if (loadedScene) {
        console.log("Scene loaded successfully:", loadedScene);
        
        const newScenes = [...scenes, loadedScene];
        setScenes(newScenes);
        
        setActiveSceneId(loadedScene.id);
        setActiveSceneIndex(newScenes.length - 1);
        setSelectedScene(loadedScene);
        setShowSceneSelector(false);
        
        return Promise.resolve(loadedScene);
      } else {
        setErrorMessage(`Failed to load scene with ID: ${sceneId}`);
        initializedScenesRef.current.delete(sceneId);
        initializedScenesRef.current.delete(sceneId + "-avatars");
        return Promise.reject(new Error(`Failed to load scene with ID: ${sceneId}`));
      }
    } catch (error) {
      console.error("Error loading scene:", error);
      setErrorMessage(`Error loading scene: ${error.message}`);
      initializedScenesRef.current.delete(sceneId);
      initializedScenesRef.current.delete(sceneId + "-avatars");
      return Promise.reject(error);
    }
  };

  const loadBoxesForScene = async (sceneIndex, boxes) => {
    if (sceneIndex !== null && scenes[sceneIndex]) {
      const updatedScenes = [...scenes];
      updatedScenes[sceneIndex] = {
        ...updatedScenes[sceneIndex],
        boxes: boxes || []
      };
      setScenes(updatedScenes);
    }
    return Promise.resolve();
  };

  const handleDeleteScene = (sceneId) => {
    deleteSavedScene(sceneId);
  };

  useEffect(() => {
    if (!selectedScene || !selectedScene.boxes || showSceneSelector) return;
    
    const sceneId = selectedScene.id;
    if (initializedScenesRef.current.has(sceneId + "-avatars")) {
      console.log("Avatars already initialized for scene:", sceneId);
      return;
    }
    
    console.log("Initializing avatars for scene:", selectedScene.name);
    initializedScenesRef.current.add(sceneId + "-avatars");
    
    Object.values(avatarInstances).forEach(instance => {
      if (instance && typeof instance.stop === 'function') {
        try {
          instance.stop();
        } catch (err) {
          console.error("Error stopping avatar:", err);
        }
      }
    });
    
    const newAvatarInstances = {};
    
    setTimeout(() => {
      selectedScene.boxes.forEach((box) => {
        if (box.elements) {
          box.elements.forEach((element) => {
            if (element.elementType === "avatar" && element.avatarData) {
              initializeAvatar(element.id, element.avatarData, newAvatarInstances);
            }
          });
        }
        else if (box.avatarData) {
          initializeAvatar(box.id, box.avatarData, newAvatarInstances);
        }
        else if (box.avatarSlots) {
          box.avatarSlots.forEach((slot) => {
            if (slot.avatarData) {
              initializeAvatar(slot.id, slot.avatarData, newAvatarInstances);
            }
          });
        }
      });
      
      setAvatarInstances(newAvatarInstances);
    }, 500);
    
    return () => {
      Object.values(newAvatarInstances).forEach(instance => {
        if (instance && typeof instance.stop === 'function') {
          try {
            instance.stop();
          } catch (err) {
            console.error("Error stopping avatar:", err);
          }
        }
      });
    };
  }, [selectedScene, showSceneSelector]);
  
  const initializeAvatar = async (containerId, avatarConfig, instances) => {
    if (!containerId || !avatarConfig) return;
    
    try {
      if (instances && instances[containerId]) {
        console.log(`Avatar already initialized for container ${containerId}, skipping.`);
        return instances[containerId];
      }
      
      console.log(`Initializing avatar for ${containerId}:`, avatarConfig);
      
      const containerElement = document.getElementById(`avatar-container-${containerId}`);
      if (!containerElement) {
        console.error(`Container element not found for avatar ${containerId}`);
        return;
      }
      
      console.log(`Avatar container for ${containerId} found with dimensions:`, 
        containerElement.offsetWidth, 
        containerElement.offsetHeight, 
        "Parent:", containerElement.parentElement?.tagName);
      
      containerElement.style.width = "100%";
      containerElement.style.height = "100%";
      containerElement.style.position = "relative";
      containerElement.style.overflow = "hidden";
      containerElement.style.display = "block";
      
      const boxHeight = containerElement.clientHeight || 300;
      
      console.log(
        "Container dimensions after styling:",
        containerElement.offsetWidth,
        containerElement.offsetHeight,
        "Container visibility:",
        window.getComputedStyle(containerElement).display
      );
      
      try {
        const TalkingHeadModule = await import("talkinghead");
        const { TalkingHead } = TalkingHeadModule;
        
        if (!TalkingHead) {
          throw new Error("TalkingHead not found in imported module");
        }
        
        console.log("TalkingHead library imported successfully");
        console.log("Creating TalkingHead with URL:", avatarConfig.url || "/assets/avatar1.glb");
        
        const avatar = new TalkingHead(containerElement, {
          height: boxHeight,
          ttsEndpoint: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TTS}`,
          ttsApikey: localStorage.getItem('TTS_API_KEY') || null,
          lipsyncModules: ["en"],
        });
        avatar._isStopped = false;

        const originalStop = avatar.stop;
        avatar.stop = async function () {
          const result = await originalStop.apply(this, arguments);
          this._isStopped = true;
          return result;
        };
        
        if (!avatar.speakText && avatar.speak) {
          console.log("Adding speakText compatibility method");
          avatar.speakText = function(text) {
            return this.speak({
              text: text,
              emotionType: "neutral"
            });
          };
        }
        
        if (!avatar.playAudio && avatar.speak) {
          console.log("Adding playAudio compatibility method");
          avatar.playAudio = function(options) {
            return this.speak({
              text: options.text || "",
              audioBase64: options.url,
              emotionType: options.emotion || "neutral" 
            });
          };
        }
        
        avatar.avatarConfig = avatarConfig;
        
        const isMale = 
          avatarConfig.gender === "male" ||
          (avatarConfig.gender === undefined && avatarConfig.url && avatarConfig.url.includes("male-avatar"));
        
        await avatar.showAvatar({
          id: avatarConfig.name,
          name: avatarConfig.name,
          url: avatarConfig.url || "/assets/avatar1.glb",
          body: isMale ? "M" : "F",
          avatarMood: avatarConfig.settings?.mood || "neutral",
          ttsLang: avatarConfig.settings?.ttsLang || "en-GB",
          ttsVoice: avatarConfig.voice || "en-GB-Standard-A",
          lipsyncLang: avatarConfig.settings?.lipsyncLang || "en",
          transparent: true,
        });
        
        await avatar.setView(avatarConfig.settings?.cameraView || "upper", {
          cameraDistance: avatarConfig.settings?.cameraDistance || 0.5,
          cameraRotateY: avatarConfig.settings?.cameraRotateY || 0,
        });
        
        const canvasElements = containerElement.querySelectorAll("canvas");
        canvasElements.forEach((canvas) => {
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          canvas.style.display = "block";
          canvas.style.imageRendering = "auto";
        });
        
        console.log("Avatar API methods available:", {
          speak: typeof avatar.speak === 'function',
          speakText: typeof avatar.speakText === 'function',
          playAudio: typeof avatar.playAudio === 'function',
          startSpeaking: typeof avatar.startSpeaking === 'function',
          pauseSpeaking: typeof avatar.pauseSpeaking === 'function'
        });
        
        console.log("Avatar animation capabilities:", {
          animate: typeof avatar.animate === 'function',
          playGesture: typeof avatar.playGesture === 'function',
          playAnimation: typeof avatar.playAnimation === 'function'
        });
        
        if (instances) {
          instances[containerId] = avatar;
          if (avatarConfig.name) {
            instances[avatarConfig.name] = avatar;
          }
        }
        
        console.log(`Avatar ${avatarConfig.name} (${containerId}) initialized successfully`);
        return avatar;
      } catch (error) {
        console.error(`Error initializing TalkingHead library for ${avatarConfig.name}:`, error);
      }
    } catch (error) {
      console.error(`Error initializing avatar ${containerId}:`, error);
    }
    return null;
  };

  useEffect(() => {
    console.log("ExperienceMode - Current state:", { 
      savedScenes: savedScenes.length, 
      scenes: scenes.length,
      selectedScene, 
      showSceneSelector 
    });
  }, [savedScenes, scenes, selectedScene, showSceneSelector]);

  const getSceneParties = () => {
    if (!selectedScene || !selectedScene.boxes) return [];
    
    const parties = new Set();
    selectedScene.boxes.forEach(box => {
      if (box.party) {
        parties.add(box.party);
      }
    });
    
    return Array.from(parties);
  };
  
  const togglePartyVisibility = (party) => {
    setVisibleParties(prev => ({
      ...prev,
      [party]: !prev[party]
    }));
  };
  
  const handlePartyFocus = (party) => {
    setFocusedParty(focusedParty === party ? null : party);
  };
  
  useEffect(() => {
    if (selectedScene && selectedScene.boxes) {
      const parties = new Set();
      selectedScene.boxes.forEach(box => {
        if (box.party) {
          parties.add(box.party);
        }
      });
      
      const initialPartyState = {};
      Array.from(parties).forEach(party => {
        initialPartyState[party] = true;
      });
      
      setVisibleParties(initialPartyState);
      setFocusedParty(null);
    }
  }, [selectedScene]);

  const renderPartySettings = () => {
    const parties = getSceneParties();
    
    if (parties.length === 0) {
      return <p className="text-sm text-gray-400">No parties in this scene</p>;
    }
    
    const partyColors = {
      "Teaching Staff": "#3b82f6",
      "Students": "#10b981",
              "Moderators": "#0ea5e9",
      "Presenters": "#f59e0b",
      "Audience": "#6b7280",
    };
    
    return (
      <div className="flex items-center gap-2 border-l border-gray-700 pl-4 ml-4">
        <span className="text-sm text-gray-300 font-medium">Parties:</span>
        <div className="flex flex-wrap gap-2">
          {parties.map(party => {
            const isVisible = visibleParties[party];
            const isFocused = focusedParty === party;
            const bgColor = partyColors[party] || "#6b7280";
            
            return (
              <div 
                key={party}
                className="flex items-center"
              >
                <button
                  className={`px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 transition-all
                    ${isVisible 
                      ? `bg-opacity-80 text-white` 
                      : 'bg-gray-800 text-gray-400'
                    }
                    ${isFocused ? 'ring-2 ring-white' : ''}
                  `}
                  style={{ backgroundColor: isVisible ? bgColor : 'var(--bg-secondary)' }}
                  onClick={() => togglePartyVisibility(party)}
                  title={isVisible ? `Hide ${party}` : `Show ${party}`}
                >
                  <span className={`w-2 h-2 rounded-full ${isVisible ? 'bg-white' : 'bg-gray-500'}`}></span>
                  {party}
                </button>
                <button
                  className={`ml-1 px-1 text-xs rounded ${isFocused ? 'bg-white text-gray-900' : 'bg-gray-700 text-gray-300'}`}
                  onClick={() => handlePartyFocus(party)}
                  title={isFocused ? `Remove focus from ${party}` : `Focus on ${party}`}
                >
                  {isFocused ? 'Unfocus' : 'Focus'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handleAudioEvent = (event) => {
      const audioEvent = event.detail;
      console.log("Audio event received:", audioEvent);
      
      if (audioEvent && audioEvent.speaker && avatarInstances[audioEvent.speaker]) {
        const avatar = avatarInstances[audioEvent.speaker];
        
        // Set speaking info for UI indication
        setSpeakingInfo({
          speaker: audioEvent.speaker,
          text: audioEvent.text,
          duration: audioEvent.duration,
          elementId: findAvatarElementId(audioEvent.speaker),
          groupId: findAvatarGroupId(audioEvent.speaker)
        });
        
        // Play audio if available
        if (avatar) {
          try {
            if (audioEvent.audioUrl) {
              // Use playAudio if direct audio URL is provided
              if (typeof avatar.playAudio === 'function') {
                console.log("Playing audio with URL:", audioEvent.audioUrl);
                avatar.playAudio({
                  url: audioEvent.audioUrl,
                  text: audioEvent.text || "",
                  emotion: audioEvent.emotion || "neutral"
                });
              } 
              // Fallback to speakText if playAudio is not available
              else if (typeof avatar.speakText === 'function') {
                console.log("Using speakText fallback with:", audioEvent.text);
                avatar.speakText(audioEvent.text || "");
              }
              // Last resort fallback
              else if (typeof avatar.speak === 'function') {
                console.log("Using speak method with:", audioEvent.audioUrl);
                avatar.speak({
                  text: audioEvent.text || "",
                  audioBase64: audioEvent.audioUrl,
                  emotionType: audioEvent.emotion || "neutral"
                });
              }
            } 
            // If no audio URL but we have text, use speakText
            else if (audioEvent.text && typeof avatar.speakText === 'function') {
              console.log("Speaking text only:", audioEvent.text);
              avatar.speakText(audioEvent.text);
            }
            
            // Add gesture animation if applicable
            setTimeout(() => {
              if (avatar.isSpeaking && typeof avatar.playGesture === 'function') {
                const gestures = ['side', 'index', 'shrug'];
                const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
                const gestureTime = 1.0 + Math.random() * 0.5;
                console.log("Playing gesture:", randomGesture);
                avatar.playGesture(randomGesture, gestureTime, Math.random() > 0.5);
              }
            }, 500); // Small delay to let speech start first
          } catch (error) {
            console.error("Error playing audio for avatar:", error);
          }
        } else {
          console.warn("Avatar instance not found for speaker:", audioEvent.speaker);
        }
      } else {
        console.warn("Invalid audio event or missing avatar instance:", audioEvent?.speaker);
      }
    };
    
    // Find the element ID for an avatar by name
    const findAvatarElementId = (speakerName) => {
      if (!selectedScene || !selectedScene.boxes || !speakerName) return null;
      
      for (const box of selectedScene.boxes) {
        if (box.elements) {
          for (const element of box.elements) {
            if (element.elementType === 'avatar' && 
                element.avatarData && 
                element.avatarData.name === speakerName) {
              return element.id;
            }
          }
        } else if (box.avatarData && box.avatarData.name === speakerName) {
          return box.id;
        }
      }
      
      return null;
    };
    
    // Find the group ID for an avatar by name
    const findAvatarGroupId = (speakerName) => {
      if (!selectedScene || !selectedScene.boxes || !speakerName) return null;
      
      for (const box of selectedScene.boxes) {
        if (box.elements) {
          for (const element of box.elements) {
            if (element.elementType === 'avatar' && 
                element.avatarData && 
                element.avatarData.name === speakerName) {
              return box.id;
            }
          }
        } else if (box.avatarData && box.avatarData.name === speakerName) {
          return box.id;
        }
      }
      
      return null;
    };
    
    const handleAnimationEvent = (event) => {
      const animEvent = event.detail;
      console.log("Animation event received:", animEvent);
      
      if (animEvent && animEvent.speaker && avatarInstances[animEvent.speaker]) {
        const avatar = avatarInstances[animEvent.speaker];
        
        // Play animation if available
        if (avatar) {
          try {
            // For specific animation types
            if (animEvent.animationType === 'gesture' && typeof avatar.playGesture === 'function') {
              const gestureType = animEvent.gestureType || 'side';
              const duration = animEvent.duration || 1.5;
              const mirror = animEvent.mirror !== false;
              
              console.log(`Playing gesture ${gestureType} (${duration}s)`);
              avatar.playGesture(gestureType, duration, mirror);
            }
            // For general animations
            else if (typeof avatar.animate === 'function') {
              avatar.animate({
                animationType: animEvent.animationType || 'talk',
                intensity: animEvent.intensity || 0.5,
                emotionType: animEvent.emotion || 'neutral'
              });
            }
            // Fallback for general animation
            else if (typeof avatar.playAnimation === 'function') {
              avatar.playAnimation(animEvent.animationType || 'talk', {
                intensity: animEvent.intensity || 0.5,
                emotion: animEvent.emotion || 'neutral'
              });
            }
          } catch (error) {
            console.error("Error playing animation for avatar:", error);
          }
        }
      }
    };
    
    const handleConversationMessage = (event) => {
      const message = event.detail;
      console.log("Conversation message received:", message);
      
      setMessages(prevMessages => [...prevMessages, message]);
    };
    
    window.addEventListener('audio-event', handleAudioEvent);
    window.addEventListener('animation-event', handleAnimationEvent);
    window.addEventListener('conversation-message', handleConversationMessage);
    
    return () => {
      window.removeEventListener('audio-event', handleAudioEvent);
      window.removeEventListener('animation-event', handleAnimationEvent);
      window.removeEventListener('conversation-message', handleConversationMessage);
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [avatarInstances, selectedScene]);

  const createPlaybackConfig = () => {
    if (!selectedScene) return null;
    
    const avatarElements = [];
    selectedScene.boxes.forEach(box => {
      if (box.elements) {
        box.elements.forEach(element => {
          if (element.elementType === 'avatar' && element.avatarData) {
            if (box.party && visibleParties[box.party] === false) {
              return;
            }
            avatarElements.push({
              ...element.avatarData,
              id: element.id,
              elementId: element.id,
              boxId: box.id,
              party: box.party || null
            });
          }
        });
      } else if (box.avatarData) {
        if (box.party && visibleParties[box.party] === false) {
          return;
        }
        avatarElements.push({
          ...box.avatarData,
          id: box.id,
          elementId: box.id,
          boxId: box.id,
          party: box.party || null
        });
      }
    });
    
    const parties = {};
    selectedScene.boxes.forEach(box => {
      if (box.party && !parties[box.party]) {
        const partyMembers = selectedScene.boxes
          .filter(b => b.party === box.party)
          .flatMap(b => {
            if (b.elements) {
              return b.elements
                .filter(el => el.elementType === 'avatar' && el.avatarData)
                .map(el => el.avatarData.name);
            } else if (b.avatarData) {
              return [b.avatarData.name];
            }
            return [];
          });
          
        parties[box.party] = {
          name: box.party,
          members: partyMembers,
          speakingMode: 'random',
        };
      }
    });
    
    const config = {
      scene: selectedScene,
      playAudio: true,
      playAnimation: true,
      maxTurns: 5,
      agents: avatarElements.map(avatar => ({
        name: avatar.name,
        personality: avatar.personality || "friendly",
        interactionPattern: "neutral",
        isHumanProxy: false,
        customAttributes: {
          party: avatar.party || null,
          isPartyRepresentative: false
        }
      })),
      participants: avatarElements.map(avatar => avatar.name),
      initiator: avatarElements.length > 0 ? avatarElements[0].name : null,
      topic: selectedScene.topic || "general conversation",
      subTopic: selectedScene.subTopic || "",
      completeConversation: true,
      partyMode: Object.keys(parties).length > 1,
      parties: parties,
      talkingHeadOptions: {
        enableAudio: true,
        enableAnimations: true,
        voiceOptions: {
          useElevenLabs: true,
          useBrowserTTS: false
        },
        animationOptions: {
          syncWithAudio: true,
          expressiveness: "medium"
        }
      }
    };
    
    console.log("Created playback config:", config);
    return config;
  };
  
  const startConversation = async () => {
    if (isPlaying) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      setIsPlaying(false);
      setSpeakingInfo(null);
      return;
    }
    
    try {
      const config = createPlaybackConfig();
      if (!config) {
        console.error("Could not create playback configuration");
        return;
      }
      
      setMessages([]);
      setSpeakingInfo(null);
      
      abortControllerRef.current = new AbortController();
      
      console.log("Starting conversation with config:", {
        sceneId: config.scene?.id,
        agents: config.agents?.length,
        participants: config.participants,
        partyMode: config.partyMode
      });
      
      const response = await AudioPlaybackAdapter.initiateAudioPlayback(config);
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      setIsPlaying(true);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      console.log("Reading server response stream...");
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          console.log("Stream complete");
          break;
        }
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        console.log(`Received ${lines.length} events from server`);
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            console.log("Received event from server:", data.type);
            
            if (data.type === 'message') {
              console.log("Message event:", {
                sender: data.message?.sender,
                hasAudio: !!data.message?.audioData,
                messageLength: data.message?.message?.length
              });
              
              if (data.message?.audioData) {
                console.log("Audio data found in message:", {
                  duration: data.message.audioData.duration,
                  speaker: data.message.sender,
                  hasUrl: !!data.message.audioData.url
                });
                
                const audioEvent = {
                  type: 'audioEvent',
                  speaker: data.message.sender,
                  audioUrl: data.message.audioData.url,
                  duration: data.message.audioData.duration || 0,
                  text: data.message.message || '',
                  emotion: data.message.emotion || 'neutral'
                };
                
                window.dispatchEvent(new CustomEvent('audio-event', { detail: audioEvent }));
              }
              
              if (data.message?.animationData) {
                console.log("Animation data found in message:", {
                  type: data.message.animationData.type,
                  speaker: data.message.sender
                });
                
                const animationEvent = {
                  type: 'animationEvent',
                  speaker: data.message.sender,
                  animationType: data.message.animationData.type || 'talk',
                  intensity: data.message.animationData.intensity || 0.5,
                  duration: data.message.animationData.duration || 0,
                  emotion: data.message.emotion || 'neutral'
                };
                
                window.dispatchEvent(new CustomEvent('animation-event', { detail: animationEvent }));
              }
            } else if (data.type === 'audioEvent') {
              console.log("Direct audio event:", {
                speaker: data.speaker,
                hasUrl: !!data.audioUrl
              });
            } else if (data.type === 'animationEvent') {
              console.log("Direct animation event:", {
                speaker: data.speaker,
                type: data.animationType
              });
            }
            
            dispatchSceneEvent(data);
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        }
      }
      
      console.log("Conversation complete");
      setIsPlaying(false);
      
    } catch (error) {
      console.error("Error starting conversation:", error);
      setIsPlaying(false);
    }
  };

  const renderControlButtons = () => {
    return (
      <div className="flex items-center space-x-3">
        <button
          className={`px-4 py-2 rounded flex items-center space-x-2 ${
            isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          } text-white font-medium`}
          onClick={startConversation}
        >
          {isPlaying ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
              <span>Stop</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Play</span>
            </>
          )}
        </button>
      </div>
    );
  };

  const renderSpeakingIndicator = () => {
    if (!speakingInfo || !speakingInfo.speaker) return null;
    
    let speakingElement = null;
    let speakingBox = null;
    
    for (const box of selectedScene.boxes || []) {
      if (box.elements) {
        for (const element of box.elements) {
          if (element.elementType === 'avatar' && element.avatarData && element.avatarData.name === speakingInfo.speaker) {
            speakingElement = element;
            speakingBox = box;
            break;
          }
        }
      } else if (box.avatarData && box.avatarData.name === speakingInfo.speaker) {
        speakingElement = { id: box.id };
        speakingBox = box;
        break;
      }
      
      if (speakingElement) break;
    }
    
    if (!speakingElement || !speakingBox) return null;
    
    return (
      <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-70 text-white p-3 rounded-lg z-50 flex items-center">
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </div>
        <div>
          <div className="font-bold">{speakingInfo.speaker}</div>
          <div className="text-sm opacity-80">{speakingInfo.text}</div>
        </div>
      </div>
    );
  };

  const renderScene = () => {
    if (!selectedScene) return null;
    
    const backgroundStyle = selectedScene.backgroundImage ? 
      { 
        backgroundImage: `url(${selectedScene.backgroundImage})`, 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : 
      { backgroundColor: 'var(--bg-secondary)' };
    
    return (
      <div 
        className="relative w-full h-[calc(100vh-150px)] overflow-hidden"
        style={{
          ...backgroundStyle,
          aspectRatio: '16/9',
          maxWidth: '1600px',
          margin: '0 auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
        }}
        ref={sceneContainerRef}
      >
        {selectedScene.boxes && selectedScene.boxes.map((box, index) => {
          const { id, x, y, width, height, party, elements, avatarData, avatarSlots } = box;
          
          if (party && visibleParties[party] === false) return null;
          
          const isHighlighted = focusedParty && party === focusedParty;
          
          const shouldDim = focusedParty && party !== focusedParty;
          
          const hasAvatars = (elements && elements.some(el => el.elementType === 'avatar' && el.avatarData)) || 
                            avatarData || 
                            (avatarSlots && avatarSlots.some(slot => slot.avatarData));
          
          const hasContent = elements && elements.some(el => el.elementType === 'content' && el.content);
          
          const avatarCount = elements ? 
            elements.filter(el => el.elementType === 'avatar' && el.avatarData).length : 
            (avatarData ? 1 : (avatarSlots ? avatarSlots.filter(slot => slot.avatarData).length : 0));
            
          let boxStyle = {
            position: 'absolute',
            left: `${x || 0}%`,
            top: `${y || 0}%`,
            width: `${width || 33}%`,
            height: `${height || 33}%`,
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(3px)',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
            transition: 'transform 0.2s ease-in-out',
            overflow: 'hidden',
          };
          
          if (party) {
            boxStyle.borderColor = 'rgba(59, 130, 246, 0.6)';
            boxStyle.backgroundColor = 'rgba(59, 130, 246, 0.15)';
            boxStyle.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
          }
          
          if (hasContent && !hasAvatars) {
            boxStyle.backgroundColor = 'rgba(245, 158, 11, 0.15)';
            boxStyle.borderColor = 'rgba(245, 158, 11, 0.6)';
          }
          
          if (hasAvatars && !hasContent) {
            boxStyle.backgroundColor = 'rgba(16, 185, 129, 0.15)';
            boxStyle.borderColor = 'rgba(16, 185, 129, 0.6)';
          }
          
          if (isHighlighted) {
            boxStyle.boxShadow = `0 0 0 3px rgba(255, 255, 255, 0.8), 0 4px 12px rgba(0, 0, 0, 0.4)`;
            boxStyle.zIndex = 10;
          }
          
          if (shouldDim) {
            boxStyle.opacity = 0.3;
          }
          
          return (
            <div 
              key={id || `box-${index}`} 
              style={boxStyle}
              className="group hover:transform hover:scale-[1.01]"
            >
              {party && (
                <div className="absolute top-0 left-0 right-0 bg-blue-600 bg-opacity-80 text-white text-xs p-1.5 flex items-center justify-between font-medium">
                  <span>{party}</span>
                  {avatarCount > 0 && (
                    <span className="bg-blue-700 px-1.5 py-0.5 rounded text-xs">{avatarCount} {avatarCount === 1 ? 'avatar' : 'avatars'}</span>
                  )}
                </div>
              )}
              
              {elements && (
                <div className={`w-full h-full ${party ? 'pt-8' : 'p-2'} relative flex ${elements.length > 1 ? 'space-x-1' : ''}`}>
                  {elements.map((element, elementIndex) => {
                    if (element.elementType === 'avatar' && element.avatarData) {
                      return (
                        <div 
                          key={element.id || `element-${elementIndex}`}
                          className="flex-1 relative flex items-center justify-center"
                        >
                          <div
                            id={`avatar-container-${element.id}`}
                            className="w-full h-full"
                            style={{ transformOrigin: 'center center' }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                            {element.avatarData.name}
                          </div>
                        </div>
                      );
                    } else if (element.elementType === 'content' && element.content) {
                      return (
                        <div 
                          key={element.id || `element-${elementIndex}`}
                          className="flex-1 bg-yellow-500 bg-opacity-20 border border-yellow-500 border-opacity-40 rounded p-3 text-white overflow-auto"
                        >
                          {element.content}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
              
              {!elements && avatarData && (
                <div className="relative w-full h-full">
                  <div 
                    id={`avatar-container-${id}`}
                    className="w-full h-full"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                    {avatarData.name}
                  </div>
                </div>
              )}
              
              {!elements && avatarSlots && (
                <div className={`w-full h-full ${party ? 'pt-8' : 'p-2'} grid grid-cols-2 gap-2`}>
                  {avatarSlots.map((slot, slotIndex) => (
                    <div 
                      key={slot.id || `slot-${slotIndex}`}
                      className="relative"
                    >
                      <div
                        id={`avatar-container-${slot.id}`}
                        className="w-full h-full"
                        style={{ transformOrigin: 'center center' }}
                      />
                      {slot.avatarData && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center">
                          {slot.avatarData.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        
        {renderSpeakingIndicator()}
      </div>
    );
  };

  return (
    <div className="experience-mode">
      {showSceneSelector ? (
        <div className="scene-selector-container">
          <h2 className="text-xl font-semibold mb-4">Select a Scene to Experience</h2>
          
          <div className="mb-4 p-2 bg-gray-800 rounded text-xs">
            <p>Available scenes: {savedScenes.length}</p>
            <p>Click on any scene below to open it in experience mode.</p>
          </div>
          
          <ExperienceSceneSetupModal
            errorMessage={errorMessage}
            loadSavedScene={handleLoadSavedScene}
            deleteScene={handleDeleteScene}
            fileInputRef={fileInputRef}
            scenes={scenes}
            setScenes={setScenes}
            setActiveSceneIndex={setActiveSceneIndex}
            setShowInitialModal={() => setShowSceneSelector(false)}
            loadBoxesForScene={loadBoxesForScene}
            setErrorMessage={setErrorMessage}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        <div className="experience-content">
          {selectedScene ? (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center flex-grow">
                  <h2 className="text-xl font-semibold">Experiencing: {selectedScene.name}</h2>
                  {renderPartySettings()}
                </div>
                <div className="flex items-center space-x-2">
                  {renderControlButtons()}
                  <button 
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex-shrink-0"
                    onClick={() => {
                      Object.values(avatarInstances).forEach(instance => {
                        if (instance && typeof instance.stop === 'function') {
                          try {
                            instance.stop();
                          } catch (err) {
                            console.error("Error stopping avatar:", err);
                          }
                        }
                      });
                      
                      setAvatarInstances({});
                      
                      if (selectedScene) {
                        initializedScenesRef.current.delete(selectedScene.id);
                        initializedScenesRef.current.delete(selectedScene.id + "-avatars");
                      }
                      
                      setShowSceneSelector(true);
                      setSelectedScene(null);
                    }}
                  >
                    Select Different Scene
                  </button>
                </div>
              </div>
              
              {renderScene()}
            </div>
          ) : (
            <p>No scene selected. Please go back and select a scene.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ExperienceMode; 