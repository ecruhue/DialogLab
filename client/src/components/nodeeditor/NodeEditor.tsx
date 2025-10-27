import React, { useState, useRef, useEffect, useMemo, useCallback, WheelEvent } from "react"
import useEditorStore, {Connection, EditorState, SnippetNode, Scene } from "../inspector/store"
import "./NodeEditor.css"
import { toast } from "react-hot-toast"
import { AudioPlaybackAdapter, createAudioPlaybackConfig, dispatchSceneEvent } from "./utils/AudioPlaybackAdapter"
import { initializeAvatarsForScene } from "../avatarconfig/utils/AvatarInitializer"
// Import PreviewPanel component
import PreviewPanel from "../preview/PreviewPanel"
// Import utility functions from NodeEditorUtils
import { 
  validateScene, 
  handleAvatarSpeaking, 
  formatTime, 
  createNodeFromScene,
} from "./utils/NodeEditorUtils"
// Import NodeDisplay component
import NodeDisplay from "./NodeDisplay"
// Import NodeConnection component
import NodeConnection, { 
  startConnection as startConnectionUtil, 
  completeConnection as completeConnectionUtil,
  handleCanvasClick as handleCanvasClickUtil,
} from "./NodeConnection"
// Import types
import {
  AudioPlaybackConfig,
  DragOffset,
  MousePosition,
  PartyCommand,
  SceneBox,
  AvatarElement,
  BoxElement,
  ContentCommand,
  SetAsDerailerCommand
} from './types'
import { AudioSegment } from './utils/NodeEditorUtils';
import API_CONFIG from '../../config';

// Add SpeakingHighlight component for visualizing the active speaker
const SpeakingHighlight = ({ speakingElement, currentScene }: { 
  speakingElement: AvatarElement | null, 
  currentScene: any 
}) => {
  if (!speakingElement || !currentScene) return null;

  const { id: elementId } = speakingElement;

  useEffect(() => {
    // Get the avatar container directly
    const avatarContainer = document.getElementById(`avatar-container-${elementId}`);
    if (avatarContainer) {
      // Add speaking highlight using CSS variables
      avatarContainer.classList.add('ring-2');
      // Use accent color from theme instead of hardcoded yellow
      avatarContainer.style.boxShadow = '0 0 0 3px #FFD700';
      avatarContainer.style.borderRadius = '6px';
      
      // Clean up when component unmounts or speaker changes
      return () => {
        avatarContainer.classList.remove('ring-2');
        avatarContainer.style.boxShadow = 'none';
        avatarContainer.style.borderRadius = '0';
      };
    }
  }, [elementId]);

  // This component doesn't render any visible UI elements directly
  // It just manipulates the DOM elements that already exist
  return null;
};

// Add these interfaces at the top of the file with other imports
interface RaisedHandParticipant {
  name: string;
  party: string | null;
  status: 'raised' | 'approved';
}

interface ParticipantInfo {
  name: string;
  party: string | null;
}

// Add type definitions at the top of the file
interface Participant {
  name: string;
  party: string | null;
}

interface AvatarData {
  name: string;
  characterName?: string;
  gender: string;
  settings: {
    body: string;
    cameraDistance: number;
    cameraRotateY: number;
    cameraView: string;
    lipsyncLang: string;
    mood: string;
    ttsLang: string;
    url: string;
    voice: string;
    content: null;
    contentName: null;
    contentType: null;
    contentUrl: null;
  };
  elementType: string;
  id: string;
}

const NodeEditor: React.FC<{ 
  messages: any[]; 
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  avatarInstancesRef?: React.MutableRefObject<any>;
  setShowExportDialog?: (show: boolean) => void;
}> = ({ 
  messages, 
  setMessages,
  avatarInstancesRef,
  setShowExportDialog
}) => {
  const { nodes, connections, addNode, updateNode, deleteNode, addConnection, setSelectedItem, getCachedDefaultSpeakers, speakers, emojiStates, updateEmojiState, conversationMode } =
    useEditorStore() as EditorState

  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [hasMoved, setHasMoved] = useState<boolean>(false)
  const [mousePos, setMousePos] = useState<MousePosition>({ x: 0, y: 0 })
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [nextConnectionId, setNextConnectionId] = useState<number>(1)
  const canvasRef = useRef<SVGSVGElement | null>(null)
  const dragOffsetRef = useRef<DragOffset>({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<SnippetNode | null>(null)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [isDragOver, setIsDragOver] = useState<boolean>(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [playingNodeId, setPlayingNodeId] = useState<string | null>(null)
  // Add state to track the currently speaking avatar
  const [speakingElement, setSpeakingElement] = useState<AvatarElement | null>(null)
  // Add state to track the currently active scene for playback
  const [activePlaybackScene, setActivePlaybackScene] = useState<any>(null)
  // Add state to track the current speaker's name
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null)
  
  // Add state for audio visualization
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([])
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const playbackTimerRef = useRef<number | null>(null)
  const playbackStartTimeRef = useRef<number>(0)
  // Add state to track if we're playing all nodes
  const [playingAllNodes, setPlayingAllNodes] = useState(false)
  const playAllNodesQueueRef = useRef<{nodeId: string, nodeTitle: string}[]>([])
  
  // Get cached speakers once, but re-compute when speakers change in the store
  const defaultSpeakers = useMemo(() => getCachedDefaultSpeakers(), [getCachedDefaultSpeakers, speakers]);

  const [activeContextMenuNode, setActiveContextMenuNode] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  // Add zoom state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Add state to track active connections
  const [activeConnectionIds, setActiveConnectionIds] = useState<string[]>([]);
  
  // Add state for audio option
  const [useAudio, setUseAudio] = useState(true);
  
  // Add state to track if button should be disabled
  const [buttonDisabled, setButtonDisabled] = useState(false);

  // Add these state declarations inside the NodeEditor component
  const [raisedHandParticipants, setRaisedHandParticipants] = useState<RaisedHandParticipant[]>([]);

  // Reset export dialog on unmount
  useEffect(() => {
    return () => {
      if (setShowExportDialog) {
        setShowExportDialog(false);
      }
    };
  }, [setShowExportDialog]);

  // Reset export dialog when messages change
  useEffect(() => {
    if (messages.length === 0) {
      if (setShowExportDialog) {
        setShowExportDialog(false);
      }
    }
  }, [messages, setShowExportDialog]);
  
  // Handle zoom with mouse wheel
  const handleWheel = (e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault(); // Prevent default scroll
    const delta = e.deltaY;
    const zoomSpeed = 0.1; // Adjust this value to control zoom sensitivity
    const newScale = Math.min(Math.max(0.1, scale - (delta * zoomSpeed) / 100), 3);
    setScale(newScale);
  };

  // Add a non-passive wheel event listener
  useEffect(() => {
    const currentCanvas = canvasRef.current;
    if (currentCanvas) {
      // Use native wheel event instead of React's onWheel
      const wheelHandler = (e: globalThis.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY;
        const zoomSpeed = 0.1;
        const newScale = Math.min(Math.max(0.1, scale - (delta * zoomSpeed) / 100), 3);
        setScale(newScale);
      };

      currentCanvas.addEventListener('wheel', wheelHandler, { passive: false });
      
      return () => {
        currentCanvas.removeEventListener('wheel', wheelHandler);
      };
    }
  }, [scale]);

  // Handle canvas panning
  const handleCanvasDragStart = (e: React.MouseEvent<SVGSVGElement>) => {
    // Allow dragging with left click by default, unless we're dragging a node
    if (e.button === 0 && !draggingNode) {
      e.preventDefault();
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleCanvasDrag = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDraggingCanvas) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleCanvasDragEnd = () => {
    setIsDraggingCanvas(false);
  };

  // Add event listeners for canvas dragging
  useEffect(() => {
    document.addEventListener('mouseup', handleCanvasDragEnd);
    return () => {
      document.removeEventListener('mouseup', handleCanvasDragEnd);
    };
  }, []);

  // Modify handleMouseMove to properly handle scaled and translated coordinates
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>): void => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Account for scale and translation in the mouse position calculation
    const x = (e.clientX - rect.left - position.x) / scale;
    const y = (e.clientY - rect.top - position.y) / scale;

    setMousePos({ x, y });

    if (draggingNode) {
      const node = nodes.find((n) => n.id === draggingNode);
      if (node) {
        // Update the node's position
        updateNode(node.id, {
          x: x - dragOffsetRef.current.x,
          y: y - dragOffsetRef.current.y,
        } as Partial<SnippetNode>);
        setHasMoved(true);
      }
    }

    if (isDraggingCanvas) {
      handleCanvasDrag(e);
    }
  };

  // Function to update existing nodes' speakers when the global speakers change
  useEffect(() => {
    if (nodes.length > 0) {
      let hasChanges = false;
      const speakerMap = new Map(speakers.map(s => [s.id, s]));
      
      const updatedNodes = nodes.map(node => {
        if (node.type !== 'snippet') return node;
        
        const snippetNode = node as SnippetNode;
        if (!snippetNode.speakers) return node;

        // Update speakers
        const updatedSpeakers = snippetNode.speakers
          .filter(speaker => speakerMap.has(speaker.id))
          .map(speaker => speakerMap.get(speaker.id) || speaker);

        // Update initiator if it exists
        let updatedInitiator = snippetNode.initiator;
        if (updatedInitiator) {
          if (!speakerMap.has(updatedInitiator.id)) {
            updatedInitiator = updatedSpeakers.length > 0 ? updatedSpeakers[0] : undefined;
          } else {
            const newInitiator = speakerMap.get(updatedInitiator.id);
            if (newInitiator) {
              updatedInitiator = newInitiator;
            }
          }
        }

        // Filter interruption rules to remove references to deleted speakers
        const updatedInterruptionRules = (snippetNode.interruptionRules || [])
          .filter(rule => 
            speakerMap.has(rule.fromSpeaker?.id) && 
            speakerMap.has(rule.toSpeaker?.id)
          )
          .map(rule => ({
            ...rule,
            fromSpeaker: speakerMap.get(rule.fromSpeaker.id) || rule.fromSpeaker,
            toSpeaker: speakerMap.get(rule.toSpeaker.id) || rule.toSpeaker
          }));

        // Filter backchannel rules to remove references to deleted speakers
        const updatedBackChannelRules = (snippetNode.backChannelRules || [])
          .filter(rule => 
            speakerMap.has(rule.fromSpeaker?.id) && 
            speakerMap.has(rule.toSpeaker?.id)
          )
          .map(rule => ({
            ...rule,
            fromSpeaker: speakerMap.get(rule.fromSpeaker.id) || rule.fromSpeaker,
            toSpeaker: speakerMap.get(rule.toSpeaker.id) || rule.toSpeaker
          }));

        // Check if any speaker data has changed that would affect display
        const hasNameChanges = JSON.stringify(updatedSpeakers.map(s => s.name)) !== 
                               JSON.stringify(snippetNode.speakers.map(s => s.name));
        
        // Check if speakers were removed
        const hasRemovedSpeakers = updatedSpeakers.length !== snippetNode.speakers.length;
        
        const hasInitiatorChange = updatedInitiator !== snippetNode.initiator ||
                                  (updatedInitiator && snippetNode.initiator && 
                                   updatedInitiator.name !== snippetNode.initiator.name);
                                   
        const hasRuleChanges = 
          JSON.stringify(updatedInterruptionRules) !== JSON.stringify(snippetNode.interruptionRules) ||
          JSON.stringify(updatedBackChannelRules) !== JSON.stringify(snippetNode.backChannelRules);

        // Update node if speaker data has changed
        if (hasNameChanges || hasRemovedSpeakers || hasInitiatorChange || hasRuleChanges ||
            JSON.stringify(updatedSpeakers) !== JSON.stringify(snippetNode.speakers)) {
          hasChanges = true;
          return {
            ...snippetNode,
            speakers: updatedSpeakers,
            initiator: updatedInitiator,
            interruptionRules: updatedInterruptionRules,
            backChannelRules: updatedBackChannelRules
          };
        }

        return node;
      });

      // Update any nodes that changed
      if (hasChanges) {
        updatedNodes.forEach((node, index) => {
          if (node !== nodes[index]) {
            updateNode(node.id, node as Partial<SnippetNode>);
          }
        });
      }
    }
  }, [speakers, nodes, updateNode]);

  // Listen for store updates that might affect node display
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      // Only update if nodes have actually changed
      const currentNodes = useEditorStore.getState().nodes;
      if (JSON.stringify(currentNodes) !== JSON.stringify(nodes)) {
        setForceUpdate(prev => prev + 1);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [nodes]);

  // Add listener for scene updates to keep attached scenes in sync
  useEffect(() => {
    const handleSceneUpdates = (event: any) => {
      console.log('Scene update event received:', event.type, 'from source:', event.detail?.source);
      
      if (!event.detail || !event.detail.scenes || event.detail.scenes.length === 0) {
        console.log('No valid scenes in event detail, skipping update');
        return;
      }

      // Accept scene updates from any source
      console.log(`Processing ${event.detail.scenes.length} scene updates from: ${event.detail.source || 'unknown'}`);
      
      const updatedScenes = event.detail.scenes;
      let hasNodeUpdates = false;

      // Check all nodes with attached scenes
      nodes.forEach(node => {
        if (node.type === 'snippet' && (node as SnippetNode).attachedScene) {
          const snippetNode = node as SnippetNode;
          console.log(`Checking node ${node.id} with attached scene ${snippetNode.attachedScene?.id}`);
        }
      });

      // Find nodes with attached scenes that match the updated scenes
      const updatedNodes = nodes.map(node => {
        if (node.type === 'snippet' && (node as SnippetNode).attachedScene) {
          const snippetNode = node as SnippetNode;
          // Find a matching scene by ID
          const matchingScene = updatedScenes.find((scene: Scene) => scene.id === snippetNode.attachedScene?.id);
          
          if (matchingScene) {
            console.log(`Found update for node ${node.id} with scene ${matchingScene.id}`);
            hasNodeUpdates = true;
            // Return updated node with new scene data
            return {
              ...node,
              attachedScene: matchingScene
            };
          }
        }
        return node;
      });

      // Update nodes in store if needed
      if (hasNodeUpdates) {
        console.log('Applying updates to nodes with new scene data');
        updatedNodes.forEach(node => {
          const originalNode = nodes.find(n => n.id === node.id);
          if (originalNode && 
              originalNode.type === 'snippet' && 
              JSON.stringify((originalNode as SnippetNode).attachedScene) !== 
              JSON.stringify((node as SnippetNode).attachedScene)) {
            console.log(`Updating node in store: ${node.id}`);
            updateNode(node.id, node as Partial<SnippetNode>);
          }
        });
        
        // Refresh the UI
        setForceUpdate(prev => prev + 1);
        
        console.log('Nodes with attached scenes have been updated after scene changes');
      } else {
        console.log('No nodes need updating - no matching scenes found');
      }
    };

    window.addEventListener('editor-scenes-updated', handleSceneUpdates);

    return () => {
      window.removeEventListener('editor-scenes-updated', handleSceneUpdates);
    };
  }, [nodes, updateNode]);

  useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  useEffect(() => {
    const selectedItem = useEditorStore.getState().selectedItem
    if (selectedItem && 'type' in selectedItem && selectedItem.type === 'snippet') {
      setSelectedNode(selectedItem as SnippetNode)
    }
  }, [])

  useEffect(() => {
    if (selectedNode) {
      // Only update selectedNode if it's actually different
      const updatedNode = nodes.find(node => node.id === selectedNode.id);
      if (updatedNode && JSON.stringify(updatedNode) !== JSON.stringify(selectedNode)) {
        setSelectedNode(updatedNode);
      }
    }
  }, [nodes]);

  const startDragging = (nodeId: string, e: React.MouseEvent, nodeX: number, nodeY: number): void => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Account for scale and translation in the initial mouse position
    const mouseX = (e.clientX - rect.left - position.x) / scale;
    const mouseY = (e.clientY - rect.top - position.y) / scale;

    dragOffsetRef.current = {
      x: mouseX - nodeX,
      y: mouseY - nodeY,
    };

    setDraggingNode(nodeId);
    setHasMoved(false);
    setFocusedNodeId(nodeId);
    e.stopPropagation();
  };

  const handleMouseUp = (): void => {
    setDraggingNode(null)
    
    setTimeout(() => {
      setHasMoved(false)
    }, 10)
    
    // Note: We're not clearing focusedNodeId here, so the node stays focused after dragging
  }

  const handleDeleteNode = (nodeId: string): void => {
    deleteNode(nodeId)
  }

  const handleDuplicateNode = (node: SnippetNode): void => {
    // Create a new ID for the duplicate node
    const newNodeId = `snippet-${Date.now()}`
    
    // Create a deep copy of the node with a new ID
    const duplicatedNode = {
      ...JSON.parse(JSON.stringify(node)),
      id: newNodeId,
      title: "", // Remove title to use default index-based title
      x: node.x + 20, // Offset position a bit to make it visible
      y: node.y + 20
    }
    
    // Add the new node
    addNode(duplicatedNode)
    
    // Select the new node
    setSelectedItem(duplicatedNode)
    setSelectedNode(duplicatedNode as SnippetNode)
  }

  const handleNodeClick = (node: SnippetNode, event: React.MouseEvent<SVGGElement, MouseEvent>, type: 'none' | 'text' | 'audio' = 'none') => {
    event.stopPropagation();
    if (!hasMoved) {
      // Check if this node has different derailerMode than what's in the store
      const storedNode = useEditorStore.getState().nodes.find(n => n.id === node.id) as SnippetNode;
      if (storedNode && storedNode.derailerMode !== node.derailerMode) {
        // Update the node in the store to persist derailerMode change
        updateNode(node.id, { derailerMode: node.derailerMode } as Partial<SnippetNode>);
      }
      console.log("node", node);

      // Always update the node in store and local state
      setSelectedItem(node);
      setSelectedNode(node);
      setFocusedNodeId(node.id);

      // Now call the appropriate action with the populated node
      if (type === 'text') {
        console.log("Generating text for node:", node.id);
        generateTextFromNode(node);
      } else if (type === 'audio') {
        console.log("Playing audio for node:", node.id);
        playSceneAudio(node);
      }
    }
    setHasMoved(false);
  }

  // Will check if node exist and if node has an scene.
  // If isGeneratingText is true, it will set isGenerating to true and set playingNodeId to node.id
  // Otherwise, it will update the playing state to the node
  const handleNodeLoad = (node: SnippetNode, isPartOfSequence: boolean = false, isFirstNode: boolean = false, isGeneratingText: boolean = false) => {
    if (!node || !node.attachedScene) return
    // Set node as the selected node to ensure highlight works properly
    setSelectedNode(node);

    if (isGeneratingText) {
      setIsGenerating(true)
      setPlayingNodeId(node.id)
    } else {
      updatePlayingState(true, node.id);
    }

    if (!isPartOfSequence) {
      localStorage.setItem('played-nodes', JSON.stringify([{nodeId: node.id, nodeTitle: node.title}]))
    }

    if (!isPartOfSequence || isFirstNode) {
      console.log("clearing messages");
      setMessages([]);
      if (setShowExportDialog) {
        setShowExportDialog(false);
      }
    } else if (!isFirstNode) {
      setMessages((prev: any[]) => [...prev, {
        content: ` ${node.title || 'Untitled'}`,
        type: 'snippet_switch',
        isSystemMessage: true, // Keep this for backward compatibility
        timestamp: new Date().toISOString()
      }]);
    }

    // Check current active scene
    const { activeSceneId } = useEditorStore.getState();
    const isSceneChange = activeSceneId && activeSceneId !== node.attachedScene.id;

    // If we're switching scenes, let the user know
    if (isSceneChange) {
      // Reset any existing states that could interfere
      setSpeakingElement(null);
      setMessages((prev: any[]) => [...prev, {
        content: ` ${node.attachedScene?.name || 'Untitled'}`,
        type: 'scene_switch',
        isSystemMessage: true, // Keep this for backward compatibility
        timestamp: new Date().toISOString()
      }]);
    }
    setActivePlaybackScene(node.attachedScene);

    // Reset audio visualization data
    setAudioSegments([]);
    setCurrentPlaybackTime(0);
    setTotalDuration(0);

    // Check if node has a scene but no speakers, and populate them
    if (node.attachedScene && node.attachedScene.boxes && 
      (!node.speakers || node.speakers.length === 0)) {
      console.log("Node has no speakers, extracting from scene...", node.attachedScene.boxes);

      // Get avatar elements from scene boxes
      const extractedSpeakers: any[] = [];
      const speakerIds = new Set<string>();
      const speakerNames = new Set<string>();
      
      node.attachedScene.boxes.forEach(box => {
        if (box.elements) {
          box.elements.forEach(element => {
            if (element.elementType === 'avatar' && element.avatarData) {
              const avatarData = element.avatarData;
              
              // Generate a unique identifier - use ID if available, otherwise use name
              const avatarIdentifier = avatarData.id || avatarData.name;
              
              // Avoid duplicate speakers (by ID or name)
              if (!speakerIds.has(avatarIdentifier) && !speakerNames.has(avatarData.name)) {
                speakerIds.add(avatarIdentifier);
                speakerNames.add(avatarData.name);
                
                // Create a speaker object from the avatar data
                const speaker = {
                  id: avatarData.id || avatarData.name.toLowerCase().replace(/\s+/g, '_'),
                  name: avatarData.name,
                  gender: avatarData.gender || "neutral",
                  personality: (avatarData as any).personality || "friendly",
                  voice: avatarData.settings?.voice || "en-US-Neural2-F",
                  roleDescription: (avatarData as any).roleDescription || "",
                  isHuman: Boolean((avatarData as any).isHuman) || false,
                  party: box.party || null
                };
                
                extractedSpeakers.push(speaker);
              }
            }
          });
        }
      });
      
      // Set speakers on the node
      if (extractedSpeakers.length > 0) {
        console.log(`Extracted ${extractedSpeakers.length} speakers from scene:`, extractedSpeakers.map(s => s.name));
        node.speakers = extractedSpeakers;
        
        // Also set a default initiator if missing
        if (!node.initiator && extractedSpeakers.length > 0) {
          node.initiator = extractedSpeakers[0];
        }
        
        // Update the node in the store
        updateNode(node.id, { 
          speakers: extractedSpeakers,
          initiator: node.initiator
        } as Partial<SnippetNode>);
      } else {
        console.warn("No speakers found in scene boxes");
      }
    }
  }

  const generateTextFromNode = async (node: SnippetNode, isPartOfSequence: boolean = false, isLastNode: boolean = false, isFirstNode: boolean = false) => {
    handleNodeLoad(node, isPartOfSequence, isFirstNode, true)
    try {
      // Ensure we're using the correct number of turns from the node config
      const maxTurns = node.turns || 3;
      // Get party configurations from the scene
      const scenePartyConfigs: { [key: string]: any } = {};
      const sceneGlobalPartySettings: {
        partyTurnMode: string;
        moderatorParty: string;
        enableBackchannel: boolean;
        enableInterruptions?: boolean;
      } = node.attachedScene?.globalPartySettings || {
        partyTurnMode: 'free',
        moderatorParty: '',
        enableBackchannel: false,
        enableInterruptions: false
      };
      console.log("Global party settings:", Object.values(sceneGlobalPartySettings))  

      // Load party configurations and members from scene boxes
      const speakersByParty: { [key: string]: any[] } = {};
      // Check if the scene has human participants
      const hasHumanParticipants = node.speakers.some(speaker => speaker.isHuman);
      // Get derailer mode setting - default to true unless explicitly set to false
      const derailerMode = node.derailerMode !== false;
      
      console.log(`Scene has human participants: ${hasHumanParticipants}, Derailer mode: ${derailerMode}`);
      
      if (node.attachedScene?.boxes) {
        (node.attachedScene.boxes as SceneBox[]).forEach(box => {
          const partyName = box.party;
          if (partyName && typeof partyName === 'string') {
            // Get party config if exists
            if (box.partyConfig && typeof box.partyConfig === 'object') {
              // Find the representative's name if one is set
              let representativeSpeaker = null;
              if (box.partyConfig.speakingMode === 'representative' && box.partyConfig.representativeSpeaker) {
                // Find the avatar element with this ID
                const representativeElement = box.elements?.find(el => 
                  el.id === box.partyConfig?.representativeSpeaker && 
                  el.elementType === 'avatar' && 
                  el.avatarData?.name
                );
                if (representativeElement?.avatarData?.name) {
                  representativeSpeaker = representativeElement.avatarData.name;
                }
              }
            
              // Store the config with the resolved representative name
              scenePartyConfigs[partyName] = {
                ...box.partyConfig,
                representativeSpeaker
              };
            }
            
            // Get party members from the box
            if (!speakersByParty[partyName]) {
              speakersByParty[partyName] = [];
            }
            
            // Add all speakers from this box to the party
            if (box.elements) {
              box.elements.forEach(element => {
                const avatarName = element.avatarData?.name;
                if (element.elementType === 'avatar' && avatarName) {
                  const matchingSpeaker = node.speakers.find(s => s.name === avatarName);
                  if (matchingSpeaker) {
                    speakersByParty[partyName].push(matchingSpeaker);
                  }
                }
              });
            }
          }
        });
      }

      console.log("Speakers by party keys:", Object.values(speakersByParty));
      
      // Prepare party commands for the config using scene configurations
      const partyCommands: PartyCommand[] = Object.keys(speakersByParty).map(partyName => {
        const partySpeakers = speakersByParty[partyName];
        const partyConfig = scenePartyConfigs[partyName] || {};
        
        // Create merged config from party config
        const mergedConfig: {
          speakingMode: string;
          representative: string | null;
          canInterrupt: boolean;
          speakingProbability: number;
          backchannelProbability: number;
          partyDescription: string;
          subsetSize?: number;
        } = {
          speakingMode: partyConfig.speakingMode || 'random',
          representative: partyConfig.representativeSpeaker || null,
          canInterrupt: sceneGlobalPartySettings.enableInterruptions ?? true,
          speakingProbability: partyConfig.speakingProbability || 1.0,
          backchannelProbability: sceneGlobalPartySettings.enableBackchannel ? 
            (partyConfig.backchannelProbability || 0.3) : 0,
          partyDescription: partyConfig.description || 
            `${partyName} - ${partySpeakers.map(s => s.roleDescription || s.personality).join(', ')}`
        };
        
        // Add subsetSize if speaking mode is subset
        if (partyConfig.speakingMode === 'subset' && partyConfig.subsetSize) {
          mergedConfig.subsetSize = partyConfig.subsetSize;
        }
        
                  return {
          command: 'createParty',
          partyName: partyName,
          members: partySpeakers.map(s => s.name),
          config: mergedConfig,
          partyDescription: partyConfig.description || ""
        };
      });
      
      // Add enablePartyMode command if partyMode is enabled and there are parties
      // if (node.partyMode) {/
        partyCommands.push({
          command: 'enablePartyMode',
          turnMode: sceneGlobalPartySettings.partyTurnMode || 'free'
        });
      // }
      
      // Prepare content commands for PDFs in the scene
      const contentCommands: ContentCommand[] = [];
      const contentByBox: { [boxId: string]: any[] } = {};
      const publicContent: any[] = [];

      // Extract PDF content elements from the scene
      if (node.attachedScene?.boxes) {
        (node.attachedScene.boxes as SceneBox[]).forEach(box => {
          if (!box.elements) return;
          
          // Collect all content elements in this box
          const contentElements = box.elements.filter(element => 
            element.elementType === 'content' && 
            element.contentType === 'application/pdf'
          );
          
          if (contentElements.length > 0) {
            // Check if the box has any avatar elements
            const hasAvatars = box.elements.some(element => 
              element.elementType === 'avatar' && element.avatarData
            );
            
            if (hasAvatars) {
              // Content in a box with avatars - owned by the avatars/party
              contentByBox[box.id] = contentElements;
            } else {
              // Content in a box without avatars - public content
              publicContent.push(...contentElements);
            }
          }
        });
      }
      console.log("node scene boxes", node.attachedScene?.boxes);

      // For each box with content and avatars, create a content command
      Object.entries(contentByBox).forEach(([boxId, contentElements]) => {
        const box = node.attachedScene?.boxes.find(b => b.id === boxId);
        if (!box) return;

        // Get avatars/party information for this box
        const avatarElements = box.elements?.filter(element => 
          element.elementType === 'avatar' && element.avatarData
        ) || [];
        
        const partyName = box.party;
        const avatarNames = avatarElements.map(element => element.avatarData?.name).filter(Boolean) as string[];
        console.log("contentElements", contentElements);
        
        // For each PDF in the box, create a content command
        contentElements.forEach(content => {
          if (!content.contentName) return;
          
          contentCommands.push({
            command: 'initializeContent',
            filename: content.contentName,
            // Always set content as public
            owners: null,
            isParty: false,
            // Still use the party or avatar in the box as presenter
            presenter: partyName || (avatarNames.length > 0 ? avatarNames[0] : null),
            presenterIsParty: !!partyName
          });
        });
      });
      
      // For public content (in boxes without avatars), create public content commands
      publicContent.forEach(content => {
        if (!content.contentName) return;
        
        contentCommands.push({
          command: 'initializeContent',
          filename: content.contentName,
          // No owners for public content
          owners: null,
          isParty: false,
          // No presenter for public content
          presenter: null,
          presenterIsParty: false
        });
      });

      // Initialize config object before the derailer logic
      const config = {
        maxTurns: maxTurns,
        agents: node.speakers.map(speaker => ({
          name: speaker.name,
          personality: speaker.personality || "friendly",
          interactionPattern: node.interactionPattern || "neutral",
          isHumanProxy: false,
          isHuman: speaker.isHuman || false,
          isProactive: speaker.isProactive || false,
          proactiveThreshold: speaker.proactiveThreshold || 0.3,
          customAttributes: {
            ...(speaker.customAttributes || {}),
            // party: speaker.party || null,
            // isPartyRepresentative: speaker.party && 
            //   scenePartyConfigs[speaker.party]?.representativeSpeaker === speaker.name,
            // isModeratorParty: speaker.party === sceneGlobalPartySettings.moderatorParty
          },
          fillerWordsFrequency: "low",
          roleDescription: speaker.roleDescription || "",
          sceneDescription: node.description || "",
          conversationPrompt: node.conversationPrompt || ""
        })),
        partyTurnMode: sceneGlobalPartySettings.partyTurnMode || "free",
        moderatorParty: sceneGlobalPartySettings.moderatorParty || "",
        initiator: node.initiator?.name || node.speakers[0]?.name,
        topic: node.topic || node.objective || "general conversation",
        subTopic: node.subTopic || "",
        description: node.description || "",
        conversationPrompt: node.conversationPrompt || "",
        interactionPattern: node.interactionPattern || "neutral",
        turnTakingMode: node.turnTakingMode || "round-robin",
        interruptionRules: sceneGlobalPartySettings.enableInterruptions ? 
          (node.interruptionRules?.map(rule => ({
            interrupter: rule.fromSpeaker.name,
            interrupted: rule.toSpeaker.name,
            probability: 0.3,
            vibe: rule.emotion || "neutral"
          })) || []) : [],
        backChannelRules: sceneGlobalPartySettings.enableBackchannel ? 
          (node.backChannelRules?.map(rule => ({
            fromPeople: rule.fromSpeaker.name,
            toPeople: rule.toSpeaker.name,
            frequency: "medium",
            vibe: rule.emotion || "neutral",
            probability: 0.2
          })) || []) : [],
        completeConversation: true,
        partyMode: Object.keys(speakersByParty).length > 0,
        partyCommands: partyCommands,
        contentCommands: contentCommands.length > 0 ? contentCommands : undefined,
        scene: node.attachedScene?.name || "",
        derailerMode: node.derailerMode !== false,
        globalPartySettings: {
          ...sceneGlobalPartySettings,
          moderatorParty: sceneGlobalPartySettings.moderatorParty || "",
          partyTurnMode: sceneGlobalPartySettings.partyTurnMode || "free",
          enableBackchannel: sceneGlobalPartySettings.enableBackchannel || false,
          enableInterruptions: sceneGlobalPartySettings.enableInterruptions || false
        },
        derailerCommands: [] as SetAsDerailerCommand[],
        shouldLoadPreviousConversationManager: isPartOfSequence && !isFirstNode,
        conversationMode: useEditorStore.getState().conversationMode
      }
      console.log("initiating conversation with config: ", config);

      // Check if derailer mode is enabled
      if (derailerMode && hasHumanParticipants) {
        console.log("Derailer mode is enabled and human participants are present");
        
        // Find human agents in the scene
        const humanAgents: any[] = [];
        
        // Get human participants from localStorage
        try {
          const topicDataStr = localStorage.getItem('topicData');
          if (topicDataStr) {
            const parsedData = JSON.parse(topicDataStr);
            if (parsedData.humanParticipants && parsedData.humanParticipants.length) {
              // Add speakers with names matching human participants
              node.speakers.forEach(speaker => {
                if (parsedData.humanParticipants.includes(speaker.name)) {
                  humanAgents.push(speaker);
                }
              });
            }
          }
        } catch (e) {
          console.error("Error checking for human participants in localStorage:", e);
        }
        
        // Also directly check each avatar element for isHuman flag
        if (node.attachedScene) {
          for (const box of node.attachedScene.boxes) {
            for (const element of box.elements || []) {
              if (element.elementType === 'avatar' && element.avatarData) {
                if (element.avatarData.hasOwnProperty('isHuman') && (element.avatarData as any).isHuman) {
                  const avatarName = element.avatarData.name;
                  const matchingSpeaker = node.speakers.find(s => s.name === avatarName);
                  if (matchingSpeaker && !humanAgents.find(a => a.name === avatarName)) {
                    humanAgents.push(matchingSpeaker);
                  }
                }
              }
            }
          }
        }
        
        // Add setAsDerailer commands for human agents to the separate derailerCommands array
        if (humanAgents.length > 0) {
          console.log(`Adding derailer commands for ${humanAgents.length} human agents`);
          
          humanAgents.forEach(humanAgent => {
            config.derailerCommands.push({
              command: 'setAsDerailer',
              agentName: humanAgent.name,
              config: {
                enable: true,
                mode: "random", // Use random mode (drift/extend)
                threshold: 0, // 50% chance to derail when not their turn
                minTurns: 3,    // Minimum 3 turns for impromptu phase
                maxTurns: 5    // Maximum 6 turns for impromptu phase
              }
            });
            
            console.log(`Added setAsDerailer command for human agent: ${humanAgent.name}`);
          });
        } else {
          console.log("No human agents found to enable as derailers");
        }
      }

      console.log("Sending config to server:", config);

      // Block start if Gemini key missing
      try {
        const statusResp = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LLM_STATUS}`);
        if (statusResp.ok) {
          const status = await statusResp.json();
          if (!status.geminiConfigured) {
            alert('Please set your Gemini API key first.');
            return;
          }
        }
      } catch (e) {
        console.warn('Could not verify LLM status before node start:', e);
      }
      
      const provider = localStorage.getItem('LLM_PROVIDER') || 'gemini';
      const key = provider === 'openai' ? localStorage.getItem('OPENAI_API_KEY') : localStorage.getItem('GEMINI_API_KEY');
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.START_CONVERSATION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-llm-provider': provider,
          'x-llm-key': key || ''
        },
        body: JSON.stringify(config)
      })
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      const reader = response.body?.getReader()
      if (!reader) throw new Error("Failed to get response reader")
      
      const processStream = async () => {
        let done = false
        let messageCount = 0;
        let currentTime = 0;
        let tempAudioSegments: AudioSegment[] = [];
        let tempTotalDuration = 0;
        
        console.log("Starting to process stream response");
        
        while (!done) {
          const { value, done: streamDone } = await reader.read()
          done = streamDone
          
          if (value) {
            const chunk = new TextDecoder().decode(value)
            const lines = chunk.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line)
                if (data.type === 'message') {
                  // Check if this is a backchannel message
                  const isBackchannel = data.message.isBackchannel || 
                    (data.message.message && 
                     // Check for the specific format: "{name} is {action}" pattern
                     // This matches how backchannels are generated in the server's generateBackchannel function
                     (data.message.message.startsWith(data.message.sender + " is ") && 
                      !data.message.message.includes('"') && 
                      !data.message.message.includes(':')));

                  if (isBackchannel) {
                    // For backchannels, attach to the last regular message instead of creating a new message
                    setMessages((prev: any[]) => {
                      if (prev.length === 0) return prev; // No messages to attach to
                      
                      const lastMessage = prev[prev.length - 1] as MessageWithBackchannels;
                      
                      // Get the vibe from the backchannel message if available
                      const vibe = data.message.backchannelVibe || undefined;
                      console.log(`Processing backchannel with vibe: ${vibe || 'none'}`);
                      
                      const emoji = getBackchannelEmoji(data.message.message, vibe);
                      
                      // Check if this backchannel already exists
                      const existingBackchannelIndex = lastMessage.backchannels?.findIndex(bc => 
                        bc.sender === data.message.sender
                      ) ?? -1;
                      
                      // If already exists, update it; otherwise add new
                      let updatedBackchannels = [...(lastMessage.backchannels || [])];
                      
                      if (existingBackchannelIndex >= 0) {
                        // Update existing backchannel
                        updatedBackchannels[existingBackchannelIndex] = {
                          sender: data.message.sender,
                          message: data.message.message,
                          emoji: emoji,
                          vibe: vibe
                        };
                      } else {
                        // Add new backchannel
                        updatedBackchannels.push({
                          sender: data.message.sender,
                          message: data.message.message,
                          emoji: emoji,
                          vibe: vibe
                        });
                      }

                      const lastAudioSegment = tempAudioSegments[tempAudioSegments.length - 1];
                      if (lastAudioSegment) {
                        lastAudioSegment.message = {
                          ...lastMessage,
                          backchannels: updatedBackchannels
                        }
                        console.log("lastAudioSegment", lastAudioSegment);
                        console.log("tempAudioSegments", tempAudioSegments);
                      }

                      // Create a new array with the updated last message
                      return [
                        ...prev.slice(0, prev.length - 1),
                        {
                          ...lastMessage,
                          backchannels: updatedBackchannels
                        }
                      ];
                    });
                  } else {
                    // Regular message - add to messages as before
                    messageCount++;
                    console.log(`Received message ${messageCount} from ${data.message.sender}`);
                    setMessages((prev: any[]) => [...prev, {
                      ...data.message,
                      backchannels: [] // Initialize empty backchannels array
                    }]);

                    // Calculate estimated duration based on message length
                    const estimatedDuration = Math.max(2, data.message.message.length / 15);
                    
                    const newSegment: AudioSegment = {
                      avatarId: data.message.sender,
                      avatarName: data.message.sender,
                      start: currentTime,
                      duration: estimatedDuration,
                      message: data.message
                    };

                    tempAudioSegments.push(newSegment);
                    tempTotalDuration = currentTime + estimatedDuration;
                    currentTime += estimatedDuration + 0.5; // Add small gap between messages
                  }
                } else if (data.type === 'completion') {
                  console.log("Conversation completed signal received");
                  // Update audio visualization data
                  setAudioSegments(tempAudioSegments);
                  setTotalDuration(tempTotalDuration);
                }
              } catch (e) {
                console.error('Error parsing JSON from stream:', e, 'Raw line:', line);
              }
            }
          }
        }
        
        console.log(`Stream processing complete. Received ${messageCount} messages.`);
        if (messageCount < maxTurns) {
          console.warn(`Warning: Expected ${maxTurns} turns but only received ${messageCount} messages.`);
        }

        try {
          const { updateNodeAudioSegmentsAndTotalDuration } = useEditorStore.getState();
          updateNodeAudioSegmentsAndTotalDuration(node.id, tempAudioSegments, tempTotalDuration);
          console.log(`Stored ${tempAudioSegments.length} audio segments and total duration ${tempTotalDuration} in node ${node.id}`);
        } catch (err) {
          console.error('Error storing audio segments in node:', err);
        }
      }

      await processStream()
      console.log("Full conversation generation completed");
      // Process next node in the queue if this is part of a sequence
      playNextNodeInQueue(false, "text");
      } catch (error) {
      console.error('Error generating text:', error)
    } finally {
      // Show export dialog after generation completes only if this is not part of a sequence
      // or if it's the last node in the sequence
      if (!isPartOfSequence || isLastNode) {
        setIsGenerating(false)
        updatePlayingState(false, null);
        if (setShowExportDialog) {
          if (conversationMode !== 'human-control') {
            setShowExportDialog(true);
          }
        }
      }
    }
  }

  const updatePlayingState = (isPlaying: boolean, playingNodeId: string | null) => {
    setIsPlaying(isPlaying);
    setPlayingNodeId(playingNodeId);
  }

  // Update the playSceneAudio function to show export dialog after playback ends
  const playSceneAudio = async (node: SnippetNode, isPartOfSequence: boolean = false, isLastNode: boolean = false, isFirstNode: boolean = false) => {
    handleNodeLoad(node, isPartOfSequence, isFirstNode);
    // Start the playback timer
    const startTime = Date.now();
    playbackStartTimeRef.current = startTime;
    
    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
    }

    playbackTimerRef.current = window.setInterval(() => {
      if (isPlaying) {
        const elapsedTime = (Date.now() - startTime) / 1000;
        setCurrentPlaybackTime(elapsedTime);
      }
    }, 100);

    // Clear speaker state
    setCurrentSpeaker(null);
    
    // Temp storage for calculating total duration
    let tempTotalDuration = 0;
    const tempAudioSegments: AudioSegment[] = [];
    const attachedScene = node.attachedScene!!;
    
    try {
      console.log("Starting scene audio playback with scene:", attachedScene.name || attachedScene.id);
      // First activate the scene in the SceneEditor
      // Let AudioPlaybackAdapter handle the scene switching and cleanup
      console.log("Activating scene in editor...");
      const sceneActivated = await AudioPlaybackAdapter.activateSceneInEditor(
        attachedScene, 
        { skipAvatarInit: true }
      );

      if (!sceneActivated) {
        console.error("Failed to activate scene in editor. Please try again.");
        updatePlayingState(false, null);
        return;
      }

      // Make sure we have a proper reference for avatar instances
      if (!avatarInstancesRef) {
        throw new Error("Avatar instances reference is not available in this context");
      }

      // After scene activation, wait a moment for everything to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
      let validElements: AvatarElement[] = [];
      let needInitialization = true;

      console.log("avatarInstancesRef", avatarInstancesRef);  
      
      // Try to use the existing avatar instances first - similar to SceneConversation approach
      if (avatarInstancesRef.current) {
        try {
          console.log("Attempting to use existing avatar instances");
          // This is the key part - directly validate using existing instances without reinitializing
          validElements = validateScene(attachedScene, avatarInstancesRef);

          if (validElements.length >= 1) {
            console.log(`Successfully found ${validElements.length} valid avatar instances, using existing avatars`);
            needInitialization = false;
          } else {
            console.log("No valid avatars found in existing instances");
          }
        } catch (error) {
          console.warn("Error validating existing avatars:", error);
        }
      }

      // Only initialize if validation failed or no valid avatars were found
      if (needInitialization) {
        console.log("Initializing new avatar instances");
        const initResult = await initializeAvatarsForScene(attachedScene, avatarInstancesRef) as {
          success: boolean;
          count: number;
          validElements: AvatarElement[];
          total: number;
        };
        
        if (!initResult.success) {
          throw new Error(`Failed to initialize any avatars in the scene. Please refresh the page and try again.`);
        }
        validElements = initResult.validElements;
        // Give the avatars a moment to fully load
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (validElements.length < 1) {
        console.error("No valid avatars found in the scene. Make sure avatars are properly loaded.");
        updatePlayingState(false, null);
        return;
      }

      // Get party configurations from the scene
      const scenePartyConfigs: { [key: string]: any } = {};
      const sceneGlobalPartySettings: {
        partyTurnMode: string;
        moderatorParty: string;
        enableBackchannel: boolean;
        enableInterruptions?: boolean;
      } = node.attachedScene?.globalPartySettings || {
        partyTurnMode: 'free',
        moderatorParty: '',
        enableBackchannel: false,
        enableInterruptions: false
      };

      console.log("Global party settings:", Object.keys(sceneGlobalPartySettings));

      // Load party configurations and members from scene boxes
      const speakersByParty: { [key: string]: any[] } = {};
      
      if (node.attachedScene?.boxes) {
        (node.attachedScene.boxes as SceneBox[]).forEach(box => {
          const partyName = box.party;
          if (partyName && typeof partyName === 'string') {
            // Get party config if exists
            if (box.partyConfig && typeof box.partyConfig === 'object') {
              // Find the representative's name if one is set
              let representativeSpeaker = null;
              if (box.partyConfig.speakingMode === 'representative' && box.partyConfig.representativeSpeaker) {
                // Find the avatar element with this ID
                const representativeElement = box.elements?.find(el => 
                  el.id === box.partyConfig?.representativeSpeaker && 
                  el.elementType === 'avatar' && 
                  el.avatarData?.name
                );
                if (representativeElement?.avatarData?.name) {
                  representativeSpeaker = representativeElement.avatarData.name;
                }
              }
              
              // Store the config with the resolved representative name
              scenePartyConfigs[partyName] = {
                ...box.partyConfig,
                representativeSpeaker
              };
            }
            
            // Get party members from the box
            if (!speakersByParty[partyName]) {
              speakersByParty[partyName] = [];
            }
            
            // Add all speakers from this box to the party
            if (box.elements) {
              box.elements.forEach(element => {
                const avatarName = element.avatarData?.name;
                if (element.elementType === 'avatar' && avatarName) {
                  const matchingSpeaker = node.speakers.find(s => s.name === avatarName);
                  if (matchingSpeaker) {
                    speakersByParty[partyName].push(matchingSpeaker);
                  }
                }
              });
            }
          }
        });
      }

      console.log("Speakers by party keys:", Object.keys(speakersByParty));
      
      // Prepare party commands for the config using scene configurations
      const partyCommands: PartyCommand[] = Object.keys(speakersByParty).map(partyName => {
        const partySpeakers = speakersByParty[partyName];
        const partyConfig = scenePartyConfigs[partyName] || {};
        
        // Create merged config from party config
        const mergedConfig: {
          speakingMode: string;
          representative: string | null;
          canInterrupt: boolean;
          speakingProbability: number;
          backchannelProbability: number;
          partyDescription: string;
          subsetSize?: number;
        } = {
          speakingMode: partyConfig.speakingMode || 'random',
          representative: partyConfig.representativeSpeaker || null,
          canInterrupt: sceneGlobalPartySettings.enableInterruptions ?? true,
          speakingProbability: partyConfig.speakingProbability || 1.0,
          backchannelProbability: sceneGlobalPartySettings.enableBackchannel ? 
            (partyConfig.backchannelProbability || 0.3) : 0,
          partyDescription: partyConfig.description || 
            `${partyName} - ${partySpeakers.map(s => s.roleDescription || s.personality).join(', ')}`
        };
        
        // Add subsetSize if speaking mode is subset
        if (partyConfig.speakingMode === 'subset' && partyConfig.subsetSize) {
          mergedConfig.subsetSize = partyConfig.subsetSize;
        }
        
        return {
          command: 'createParty',
          partyName: partyName,
          members: partySpeakers.map(s => s.name),
          config: mergedConfig,
          partyDescription: partyConfig.description || ""
        };
      });

      // Add enablePartyMode command if we have parties
      if (Object.keys(speakersByParty).length > 0) {
        partyCommands.push({
          command: 'enablePartyMode',
          turnMode: sceneGlobalPartySettings.partyTurnMode || 'free'
        });
      }

      // Prepare content commands for PDFs in the scene
      const contentCommands: ContentCommand[] = [];
      const contentByBox: { [boxId: string]: any[] } = {};
      const publicContent: any[] = [];

      // Extract PDF content elements from the scene
      if (node.attachedScene?.boxes) {
        (node.attachedScene.boxes as SceneBox[]).forEach(box => {
          if (!box.elements) return;
          
          // Collect all content elements in this box
          const contentElements = box.elements.filter(element => 
            element.elementType === 'content' && 
            element.contentType === 'application/pdf'
          );
          
          if (contentElements.length > 0) {
            // Check if the box has any avatar elements
            const hasAvatars = box.elements.some(element => 
              element.elementType === 'avatar' && element.avatarData
            );
            
            if (hasAvatars) {
              // Content in a box with avatars - owned by the avatars/party
              contentByBox[box.id] = contentElements;
            } else {
              // Content in a box without avatars - public content
              publicContent.push(...contentElements);
            }
          }
        });
      }

      // For each box with content and avatars, create a content command
      Object.entries(contentByBox).forEach(([boxId, contentElements]) => {
        const box = node.attachedScene?.boxes.find(b => b.id === boxId);
        if (!box) return;
        
        // Get avatars/party information for this box
        const avatarElements = box.elements?.filter(element => 
          element.elementType === 'avatar' && element.avatarData
        ) || [];
        
        const partyName = box.party;
        const avatarNames = avatarElements.map(element => element.avatarData?.name).filter(Boolean) as string[];
        
        // For each PDF in the box, create a content command
        contentElements.forEach(content => {
          if (!content.contentName) return;
          
          contentCommands.push({
            command: 'initializeContent',
            filename: content.contentName,
            // Always set content as public
            owners: null,
            isParty: false,
            // Still use the party or avatar in the box as presenter
            presenter: partyName || (avatarNames.length > 0 ? avatarNames[0] : null),
            presenterIsParty: !!partyName
          });
        });
      });
      
      // For public content (in boxes without avatars), create public content commands
      publicContent.forEach(content => {
        if (!content.contentName) return;
        
        contentCommands.push({
          command: 'initializeContent',
          filename: content.contentName,
          // No owners for public content
          owners: null,
          isParty: false,
          // No presenter for public content
          presenter: null,
          presenterIsParty: false
        });
      });

      // Create configuration using the utility function
      const config = createAudioPlaybackConfig(node) as AudioPlaybackConfig;
      
      if (!config) {
        throw new Error("Could not create playback configuration");
      }

      // Add party mode configuration
      config.partyMode = Object.keys(speakersByParty).length > 0;
      config.partyCommands = partyCommands;
      config.partyTurnMode = node.attachedScene?.globalPartySettings?.partyTurnMode || "free";
      config.moderatorParty = node.attachedScene?.globalPartySettings?.moderatorParty || "";
      config.globalPartySettings = {
        ...sceneGlobalPartySettings,
        moderatorParty: sceneGlobalPartySettings.moderatorParty || "",
        partyTurnMode: sceneGlobalPartySettings.partyTurnMode || "free",
        enableBackchannel: sceneGlobalPartySettings.enableBackchannel || false,
        enableInterruptions: sceneGlobalPartySettings.enableInterruptions || false
      };

      config.derailerCommands = [] as SetAsDerailerCommand[];
      config.shouldLoadPreviousConversationManager = isPartOfSequence && !isFirstNode;

      // Add content commands to the config if there are any
      if (contentCommands.length > 0) {
        config.contentCommands = contentCommands;
        console.log(`Added ${contentCommands.length} content commands for PDFs in the scene`);
      }
      
      // Check if derailer mode is enabled
      const hasHumanParticipants = node.speakers.some(speaker => speaker.isHuman);
      // Get derailer mode setting - default to true unless explicitly set to false
      const derailerMode = node.derailerMode !== false;
      
      console.log(`Scene has human participants: ${hasHumanParticipants}, Derailer mode: ${derailerMode}`);
      
      if (derailerMode && hasHumanParticipants) {
        console.log("Derailer mode is enabled and human participants are present");
        
        // Find human agents in the scene
        const humanAgents: any[] = [];
        
        // Get human participants from localStorage
        try {
          const topicDataStr = localStorage.getItem('topicData');
          if (topicDataStr) {
            const parsedData = JSON.parse(topicDataStr);
            if (parsedData.humanParticipants && parsedData.humanParticipants.length) {
              // Add speakers with names matching human participants
              node.speakers.forEach(speaker => {
                if (parsedData.humanParticipants.includes(speaker.name)) {
                  humanAgents.push(speaker);
                }
              });
            }
          }
        } catch (e) {
          console.error("Error checking for human participants in localStorage:", e);
        }
        
        // Also directly check each avatar element for isHuman flag
        if (node.attachedScene) {
          for (const box of node.attachedScene.boxes) {
            for (const element of box.elements || []) {
              if (element.elementType === 'avatar' && element.avatarData) {
                if (element.avatarData.hasOwnProperty('isHuman') && (element.avatarData as any).isHuman) {
                  const avatarName = element.avatarData.name;
                  const matchingSpeaker = node.speakers.find(s => s.name === avatarName);
                  if (matchingSpeaker && !humanAgents.find(a => a.name === avatarName)) {
                    humanAgents.push(matchingSpeaker);
                  }
                }
              }
            }
          }
        }
        
        // Add setAsDerailer commands for human agents to the separate derailerCommands array
        if (humanAgents.length > 0) {
          console.log(`Adding derailer commands for ${humanAgents.length} human agents`);
          
          humanAgents.forEach(humanAgent => {
            config.derailerCommands?.push({
              command: 'setAsDerailer',
              agentName: humanAgent.name,
              config: {
                enable: true,
                mode: "random", // Use random mode (drift/extend)
                threshold: 0.5, // 50% chance to derail when not their turn
                minTurns: 3,    // Minimum 3 turns for impromptu phase
                maxTurns: 6     // Maximum 6 turns for impromptu phase
              }
            });
            
            console.log(`Added setAsDerailer command for human agent: ${humanAgent.name}`);
          });
        } else {
          console.log("No human agents found to enable as derailers");
        }
      }

      // Add logging before initiating audio playback
      console.log('Conversation configuration:', {
        partyMode: config.partyMode,
        partyTurnMode: config.partyTurnMode,
        moderatorParty: config.moderatorParty,
        globalSettings: config.globalPartySettings
      });

      // Add logging when creating party commands
      console.log('Party commands being created:', {
        parties: Object.keys(speakersByParty),
        partyConfigs: scenePartyConfigs,
        globalSettings: sceneGlobalPartySettings
      });

      const response = await AudioPlaybackAdapter.initiateAudioPlayback(config, { skipAvatarInit: true });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }
      
      // Handle the stream of animation/audio events
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Failed to get response reader");
      
      const processStream = async () => {
        let done = false
        let tempAudioSegments: AudioSegment[] = [];
        let tempTotalDuration = 0;
        
        console.log("Starting to process stream response");
        
        while (!done) {
          const { value, done: streamDone } = await reader.read()
          done = streamDone
          
          if (value) {
            const chunk = new TextDecoder().decode(value)
            const lines = chunk.split('\n').filter(line => line.trim())
            
            for (const line of lines) {
              try {
                const data = JSON.parse(line)
                console.log("processStream data: ", data);
                if (data.type === 'message') {
                  // Check if this is a backchannel message
                  const isBackchannel = data.message.isBackchannel || 
                    (data.message.message && 
                     // Check for the specific format: "{name} is {action}" pattern
                     // This matches how backchannels are generated in the server's generateBackchannel function
                     (data.message.message.startsWith(data.message.sender + " is ") && 
                      !data.message.message.includes('"') && 
                      !data.message.message.includes(':')));

                  if (isBackchannel) {
                    // For backchannels, attach to the last regular message instead of creating a new message
                    setMessages((prev: any[]) => {
                      if (prev.length === 0) return prev; // No messages to attach to
                      
                      const lastMessage = prev[prev.length - 1] as MessageWithBackchannels;
                      
                      // Get the vibe from the backchannel message if available
                      const vibe = data.message.backchannelVibe || undefined;
                      console.log(`Processing backchannel with vibe: ${vibe || 'none'}`);
                      
                      const emoji = getBackchannelEmoji(data.message.message, vibe);
                      
                      // Check if this backchannel already exists
                      const existingBackchannelIndex = lastMessage.backchannels?.findIndex(bc => 
                        bc.sender === data.message.sender
                      ) ?? -1;
                      
                      // If already exists, update it; otherwise add new
                      let updatedBackchannels = [...(lastMessage.backchannels || [])];
                      
                      if (existingBackchannelIndex >= 0) {
                        // Update existing backchannel
                        updatedBackchannels[existingBackchannelIndex] = {
                          sender: data.message.sender,
                          message: data.message.message,
                          emoji: emoji,
                          vibe: vibe
                        };
                      } else {
                        // Add new backchannel
                        updatedBackchannels.push({
                          sender: data.message.sender,
                          message: data.message.message,
                          emoji: emoji,
                          vibe: vibe
                        });
                      }

                      const lastAudioSegment = audioSegments[audioSegments.length - 1];
                      if (lastAudioSegment) {
                        lastAudioSegment.message = {
                          ...lastMessage,
                          backchannels: updatedBackchannels
                        };
                      }

                      // Create a new array with the updated last message
                      return [
                        ...prev.slice(0, prev.length - 1),
                        {
                          ...lastMessage,
                          backchannels: updatedBackchannels
                        }
                      ];
                    });
                  } else {
                    // Regular message - add to messages as before
                    setMessages((prev: any[]) => [...prev, {
                      ...data.message,
                      backchannels: [] // Initialize empty backchannels array
                    }]);
                  }
                  
                  // Then find the avatar corresponding to the speaker
                  const speakingElement = validElements.find(element => 
                    element.avatarData.name === data.message.sender ||
                    `Avatar${element.id}` === data.message.sender
                  );
                  
                  if (speakingElement) {
                    const instance = avatarInstancesRef.current[speakingElement.id];
                    
                    if (instance && instance.speakText) {
                      console.log(`Avatar will ${isBackchannel ? 'show backchannel' : 'speak'}: ${speakingElement.id} ${isBackchannel ? 'reacting' : 'saying'} "${data.message.message.substring(0, 30)}..."`);
                      setSpeakingElement(speakingElement);
                      setCurrentSpeaker(speakingElement.avatarData?.name || `Avatar ${speakingElement.id}`);

                      try {
                        // Estimate the duration based on text length (rough approximation)
                        const estimatedDuration = Math.max(2, data.message.message.length / 15);
                        const currentTime = (Date.now() - playbackStartTimeRef.current) / 1000;
                        
                        // Add to audio segments
                        const newSegment: AudioSegment = {
                          avatarId: speakingElement.id,
                          avatarName: speakingElement.avatarData?.name || `Avatar ${speakingElement.id}`,
                          start: currentTime,
                          duration: estimatedDuration,
                          message: data.message
                        };
                        
                        tempAudioSegments.push(newSegment);
                        setAudioSegments(prev => [...prev, newSegment]);
                        
                        // Update total duration estimation
                        tempTotalDuration = Math.max(tempTotalDuration, currentTime + estimatedDuration);
                        setTotalDuration(tempTotalDuration);
                        
                        // Skip speaking for backchannel messages
                        if (!isBackchannel) {
                          // Use the handleAvatarSpeaking function to manage speaking and gestures
                          await handleAvatarSpeaking(instance, data.message.message);
                        } else {
                          // For backchannels, just show the non-verbal reaction without speech
                          // and wait a bit to simulate the reaction time
                          await new Promise(resolve => setTimeout(resolve, estimatedDuration * 1000));
                        }
                      } catch (speakError) {
                        console.error(`Error during avatar speaking:`, speakError);
                      } finally {
                        setSpeakingElement(null);
                        setCurrentSpeaker(null);
                      }
                    } else {
                      console.warn(`No valid instance found for avatar ${speakingElement.id}`);
                    }
                  } else {
                    console.warn(`No matching avatar found for speaker: ${data.message.sender}`);
                  }
                } else if (data.type === 'audioEvent') {
                  // For direct audio events, also show text first if available
                  if (data.text) {
                    // Create a message-like object for the UI
                    const audioMessage = {
                      sender: data.speaker,
                      message: data.text,
                      timestamp: new Date().toISOString()
                    };
                    setMessages((prev: any[]) => [...prev, audioMessage]);
                  }
                  
                  // Handle direct audio events
                  const speaker = data.speaker;
                  const elementWithSpeaker = validElements.find(element => 
                    element.avatarData.name === speaker || 
                    `Avatar${element.id}` === speaker
                  );
                  
                  if (elementWithSpeaker) {
                    const instance = avatarInstancesRef.current[elementWithSpeaker.id];
                    if (instance && instance.speakText) {
                      console.log(`Playing audio for ${speaker} via avatar instance`);
                      try {
                        setSpeakingElement(elementWithSpeaker);
                        // Update the current speaker name
                        setCurrentSpeaker(elementWithSpeaker.avatarData?.name || `Avatar ${elementWithSpeaker.id}`);
                        
                        // Estimate duration and add to timeline
                        const estimatedDuration = Math.max(2, (data.text?.length || 20) / 15);
                        const currentTime = (Date.now() - playbackStartTimeRef.current) / 1000;
                        
                        // Add to audio segments
                        const newSegment: AudioSegment = {
                          avatarId: elementWithSpeaker.id,
                          avatarName: elementWithSpeaker.avatarData?.name || `Avatar ${elementWithSpeaker.id}`,
                          start: currentTime,
                          duration: estimatedDuration,
                          message: data.message
                        };

                        tempAudioSegments.push(newSegment);
                        setAudioSegments(prev => [...prev, newSegment]);
                        
                        // Update total duration estimation
                        tempTotalDuration = Math.max(tempTotalDuration, currentTime + estimatedDuration);
                        setTotalDuration(tempTotalDuration);
                        
                        // Handle the text via avatar instance
                        await handleAvatarSpeaking(instance, data.text || "");
                      } catch (audioError) {
                        console.error(`Error playing audio for ${speaker}:`, audioError);
                      } finally {
                        setSpeakingElement(null);
                        setCurrentSpeaker(null);
                      }
                    }
                  } else {
                    console.warn(`No matching avatar for audio event from: ${speaker}`);
                  }
                }
                else {
                  // Use the utility function to dispatch other event types
                  dispatchSceneEvent(data);
                }
                
                // Show errors in the UI
                if (data.type === 'error') {
                  toast.error(`Error: ${data.error}`, {
                    duration: 3000,
                    position: "bottom-center",
                  });
                }

                // Inside the processStream function, in the message handling section
                if (data.type === 'message' && data.message.isSystemMessage) {
                  console.log('System message received:', data.message);
                  
                  const message = data.message.message;
                  
                  // Handle hand raising
                  if (message.includes('raised their hands')) {
                    const match = message.match(/Members who raised their hands: (.*?)\.$/);
                    if (match) {
                      const participants: Participant[] = match[1].split(', ').map((p: string) => {
                        const namePartyMatch = p.match(/(.*?)(?: \((.*?)\))?$/);
                        return {
                          name: namePartyMatch?.[1] || p,
                          party: namePartyMatch?.[2] || null
                        };
                      });
                      
                      console.log('Hand raising participants:', participants);
                      
                      // Update emoji states for each participant
                      if (node?.attachedScene) {
                        // Clear any existing raised hands first to avoid duplicates
                        setRaisedHandParticipants([]);
                        
                        participants.forEach(participant => {
                          node.attachedScene?.boxes.forEach(box => {
                            if (box.elements) {
                              box.elements.forEach(element => {
                                if (element.elementType === 'avatar' && element.avatarData) {
                                  const avatarData = element.avatarData as AvatarData;
                                  if (avatarData.name === participant.name || 
                                      avatarData.characterName === participant.name) {
                                    // Add to raised hand participants
                                    setRaisedHandParticipants(prev => [
                                      ...prev.filter(p => p.name !== participant.name), // Remove any existing entry
                                      {
                                        name: participant.name,
                                        party: participant.party,
                                        status: 'raised'
                                      }
                                    ]);
                                    updateEmojiState(element.id, 'raiseHand');
                                    console.log(`Set raised hand emoji for participant: ${participant.name}`);
                                  }
                                }
                              });
                            }
                          });
                        });
                        console.log('Updated emoji states for hand raising:', emojiStates);
                      }
                    }
                  }
                  
                  // Handle approval
                  else if (message.includes('approved') && message.includes('to speak')) {
                    const approvalMatch = message.match(/approves\s+([^"]+?)\s+from party/) || 
                                         message.match(/approves\s+"([^"]+?)"\s+from/) ||
                                         message.match(/approves\s+([^,\s]+)\s+to speak/) ||
                                         message.match(/approved\s+([^"]+?)\s+from party/) ||
                                         message.match(/approved\s+"([^"]+?)"\s+from/) ||
                                         message.match(/has approved\s+([^"]+?)\s+from party/) ||
                                         message.match(/moderator has approved\s+([^"]+?)\s+from/);
                                         
                    if (approvalMatch && approvalMatch[1]) {
                      const approvedName = approvalMatch[1].trim();
                      console.log('Approved participant:', approvedName);
                      
                      // Update raised hand participants state
                      setRaisedHandParticipants(prev => {
                        const updated = prev.map(p => 
                          p.name === approvedName 
                            ? { ...p, status: 'approved' as const }
                            : p
                        );
                        console.log('Updated raised hand participants:', updated);
                        return updated;
                      });
                      
                      // Clear emoji state for approved participant
                      if (node?.attachedScene) {
                        let foundAvatar = false;
                        node.attachedScene.boxes.forEach(box => {
                          if (box.elements) {
                            box.elements.forEach(element => {
                              if (element.elementType === 'avatar' && element.avatarData) {
                                const avatarData = element.avatarData as AvatarData;
                                if (avatarData.name === approvedName || 
                                    avatarData.characterName === approvedName) {
                                  foundAvatar = true;
                                  // Clear the emoji state for this avatar
                                  updateEmojiState(element.id, null);
                                  console.log(`Cleared emoji state for approved participant: ${approvedName}, element ID: ${element.id}`);
                                }
                              }
                            });
                          }
                        });
                        if (!foundAvatar) {
                          console.warn(`Could not find avatar element for approved participant: ${approvedName}`);
                        }
                        console.log('Updated emoji states after approval:', emojiStates);
                      }
                    }
                  }
                }
              } catch (e) {
                console.error('Error parsing JSON from stream:', e, 'Raw line:', line);
              }
            }
          }
        }

        try {
          const { updateNodeAudioSegmentsAndTotalDuration } = useEditorStore.getState();
          updateNodeAudioSegmentsAndTotalDuration(node.id, tempAudioSegments, tempTotalDuration);
          console.log(`Stored ${tempAudioSegments.length} audio segments and total duration ${tempTotalDuration} in node ${node.id}`);
        } catch (err) {
          console.error('Error storing audio segments in node:', err);
        }
      };

      await processStream();
      console.log("Full scene audio playback completed");

      playNextNodeInQueue();
    } catch (error: any) {
      console.error('Error playing scene audio:', error);
    } finally {
      // Clear the playback timer
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      
      if (!isPartOfSequence || isLastNode) {
        updatePlayingState(false, null);
        // Reset UI elements
        setSpeakingElement(null);
        setActivePlaybackScene(null);
        setCurrentSpeaker(null);
        if (setShowExportDialog) {
          if (conversationMode !== 'human-control') {
            setShowExportDialog(true);
          }
        }
      }
    }
  };
  
  // Create a ref to expose methods to TalkingHeadComponent
  const nodeEditorRef = useRef<{
    handleSeek: (time: number) => void;
  }>({
    handleSeek: (time: number) => {
      // Implementation will be assigned below
      console.log("handleSeek not implemented yet");
    }
  });

  // Add this helper function to update the speaking element based on current time
  const updateSpeakingElement = useCallback((time: number) => {
    // Find which avatar should be speaking at this time
    const speakingSegment = audioSegments.find(segment => 
      time >= segment.start && time < segment.start + segment.duration
    );
    
    if (speakingSegment) {
      // Find the speaking avatar element
      const scene = activePlaybackScene;
      if (scene) {
        const speakingAvatar = scene.boxes.flatMap((box: any) => 
          (box.elements || []).filter((el: any) => el.id === speakingSegment.avatarId)
        )[0];
        
        if (speakingAvatar) {
          setSpeakingElement(speakingAvatar);
          setCurrentSpeaker(speakingSegment.avatarName);
          
          // If avatar instance exists, we could control its state/sound here
          if (avatarInstancesRef?.current) {
            const instance = avatarInstancesRef.current[speakingAvatar.id];
            if (instance) {
              // Here we could implement exact seeking in the audio
              console.log(`Seeking to ${formatTime(time)}, avatar ${speakingSegment.avatarName} should be speaking`);
            }
          }
        }
      }
    } else {
      // No one is speaking at this time
      setSpeakingElement(null);
      setCurrentSpeaker(null);
    }
  }, [audioSegments, activePlaybackScene, avatarInstancesRef]);

  // Modified handleSeek to be called from TalkingHeadComponent
  const handleSeek = useCallback((time: number) => {
    if (time < 0) time = 0;
    if (time > totalDuration) time = totalDuration;
    
    setCurrentPlaybackTime(time);
    
    // Pause existing audio elements
    document.querySelectorAll('audio').forEach(audio => {
      audio.pause();
    });
    
    // Update speaking elements based on the current time
    updateSpeakingElement(time);
  }, [totalDuration, updateSpeakingElement]);

  // Assign the handleSeek method to the ref
  useEffect(() => {
    nodeEditorRef.current.handleSeek = handleSeek;
    
    // Expose nodeEditorRef globally for TalkingHeadComponent to access
    (window as any).nodeEditorRef = nodeEditorRef;

    return () => {
      // Clean up when component unmounts
      (window as any).nodeEditorRef = null;
    };
  }, [handleSeek]);

  // Send audio timeline data to TalkingHeadComponent whenever it changes
  useEffect(() => {
    if ((window as any).talkingHeadRef && (window as any).talkingHeadRef.updateAudioTimelineData) {
      (window as any).talkingHeadRef.updateAudioTimelineData({
        segments: audioSegments,
        playbackTime: currentPlaybackTime,
        playing: isPlaying,
        duration: totalDuration
      });
    }
  }, [audioSegments, currentPlaybackTime, isPlaying, totalDuration]);

  const handleDragOver = (e: React.DragEvent<SVGSVGElement>): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  };

  const handleDragLeave = (): void => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<SVGSVGElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Calculate drop position accounting for scale and translation
    // First get the position relative to the canvas
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;
    
    // Then remove the canvas translation and scale to get the actual position in scene coordinates
    // Also offset by half the node width/height to center the node on the drop position
    const nodeWidth = 170; // Standard node width
    const nodeHeight = 140; // Approximate minimum node height
    const x = (dropX - position.x) / scale - (nodeWidth / 2);
    const y = (dropY - position.y) / scale - (nodeHeight / 2);
    
    try {
      const jsonData = e.dataTransfer.getData("application/json");
      if (!jsonData) {
        console.warn("No valid JSON data in drop event");
        return;
      }
      
      const data = JSON.parse(jsonData);
      
      // Check if this is a scene drop
      if (data.type === "scene" && data.scene) {
        createNodeFromScene(
          data.scene, 
          x, 
          y, 
          speakers, 
          getCachedDefaultSpeakers, 
          addNode, 
          setSelectedItem
        );
      }
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  const handleStartConnection = (nodeId: string): void => {
    setConnectingFrom(nodeId);
  }

  const handleCompleteConnection = (toNodeId: string): void => {
    if (connectingFrom && connectingFrom !== toNodeId) {
      const newConnection: Connection = {
        id: nextConnectionId.toString(),
        from: connectingFrom,
        to: toNodeId,
        condition: ""
      };
      
      addConnection(newConnection);
      setNextConnectionId(prev => prev + 1);
      setConnectingFrom(null);
    }
  }

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>): void => {
    handleCanvasClickUtil(e, connectingFrom, setConnectingFrom);
    // Clear focused node when clicking on canvas
    setFocusedNodeId(null);
  }

  const handleContextMenuOpen = (nodeId: string) => {
    // Close any other open context menu before opening a new one
    setActiveContextMenuNode(nodeId);
  };

  // Add a function to play all snippet nodes sequentially
  const playAllNodes = (type: "audio" | "text") => {
    if (isPlaying || isGenerating || playingAllNodes) return;

    // Reset active connections at the start
    setActiveConnectionIds([]);

    const snippetNodes = nodes.filter(node => node.type === "snippet");
    if (snippetNodes.length === 0) return;

    const nodeMap = new Map<string, SnippetNode>();
    const incomingConnections = new Map<string, string[]>();
    const outgoingConnections = new Map<string, string[]>();
    const connectionMap = new Map<string, Connection>();
    
    snippetNodes.forEach(node => {
      nodeMap.set(node.id, node);
      incomingConnections.set(node.id, []);
      outgoingConnections.set(node.id, []);
    });
    
    connections.forEach(conn => {
      const fromNode = nodeMap.get(conn.from);
      const toNode = nodeMap.get(conn.to);

      if (fromNode && toNode) {
        const outgoing = outgoingConnections.get(conn.from) || [];
        if (!outgoing.includes(conn.to)) {
          outgoing.push(conn.to);
          outgoingConnections.set(conn.from, outgoing);
        }

        const incoming = incomingConnections.get(conn.to) || [];
        if (!incoming.includes(conn.from)) {
          incoming.push(conn.from);
          incomingConnections.set(conn.to, incoming);
        }
        
        // Store the actual connection object by a compound key
        connectionMap.set(`${conn.from}:${conn.to}`, conn);
      }
    });
    
    // If there are no connections at all, check if there's a selected node
    if (connections.length === 0) {
      // If we have a selected node or a focused node, play just that node
      if (selectedNode || focusedNodeId) {
        const nodeIdToPlay = selectedNode ? selectedNode.id : focusedNodeId;
        const nodeToPlay = nodes.find(node => node.id === nodeIdToPlay) as SnippetNode;
        
        if (nodeToPlay && nodeToPlay.type === "snippet") {
          console.log("No connections found. Playing selected node:", nodeToPlay.id);
          
          // Create a queue with just the selected node
          const nodeQueue = [{nodeId: nodeToPlay.id, nodeTitle: nodeToPlay.title}];
          localStorage.setItem('played-nodes', JSON.stringify(nodeQueue));
          
          playAllNodesQueueRef.current = nodeQueue;
          setPlayingAllNodes(true);
          
          // Play the selected node
          playNextNodeInQueue(true, type);
          return;
        }
      }
    }
    
    // Get all root nodes (nodes with no incoming connections)
    const rootNodes = Array.from(nodeMap.keys()).filter(nodeId => 
      (incomingConnections.get(nodeId)?.length || 0) === 0
    );
    
    // If no root nodes but we have nodes, use the first one as root
    if (rootNodes.length === 0 && snippetNodes.length > 0) {
      rootNodes.push(snippetNodes[0].id);
    }
    
    const selectedOrFocusedNodeId = selectedNode ? selectedNode.id : focusedNodeId;
    let orderedRootNodes = [...rootNodes];
    if (selectedOrFocusedNodeId) {
      // If the selected/focused node is a root node, make it the first root node
      if (rootNodes.includes(selectedOrFocusedNodeId)) {
        orderedRootNodes = [
          selectedOrFocusedNodeId,
          ...rootNodes.filter(id => id !== selectedOrFocusedNodeId)
        ];
      }
    }
    
    const visited = new Set<string>();
    const nodeQueue: {nodeId: string, nodeTitle: string}[] = [];
    const pathConnections: string[] = [];

    const buildPlayQueue = (startNodeId: string) => {
      const queue = [startNodeId];
      let lastNodeId: string | null = null;

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        
        if (!visited.has(nodeId)) {
          visited.add(nodeId);
          nodeQueue.push({nodeId: nodeId, nodeTitle: nodeMap.get(nodeId)?.title || ''});
          
          // If we have a previous node, find the connection between them
          if (lastNodeId !== null) {
            const connectionKey = `${lastNodeId}:${nodeId}`;
            const connection = connectionMap.get(connectionKey);
            if (connection) {
              pathConnections.push(connection.id);
            }
          }
          
          const outgoing = outgoingConnections.get(nodeId) || [];
          if (outgoing.length > 0) {
            // Choose a random outgoing connection instead of always the first one
            const randomIndex = Math.floor(Math.random() * outgoing.length);
            const nextNodeId = outgoing[randomIndex];
            queue.push(nextNodeId);
            
            // Record this node as the last node for the next iteration
            lastNodeId = nodeId;
          } else {
            lastNodeId = null;
          }
        }
      }
    };

    // only play the first root node as it will be either the selected node or the first node
    buildPlayQueue(orderedRootNodes[0]);
    if (nodeQueue.length === 0) return;
    console.log("nodeQueue: ", nodeQueue);
    localStorage.setItem('played-nodes', JSON.stringify(nodeQueue));
    // Set active connections
    setActiveConnectionIds(pathConnections);

    playAllNodesQueueRef.current = nodeQueue;
    setPlayingAllNodes(true);

    // Now we can safely proceed with playing the next node
    playNextNodeInQueue(true, type);
  }

  const playNextNodeInQueue = (isFirstNode: boolean = false, type: "audio" | "text" = "audio") => {
    const nodeQueue = playAllNodesQueueRef.current;
    const nextNodeId = nodeQueue.shift()?.nodeId;
    const nextNode = nodes.find(node => node.id === nextNodeId);
    if (!nextNode) {
      setPlayingAllNodes(false);
      updatePlayingState(false, null);
      setButtonDisabled(false);
      // Reset active connections
      setActiveConnectionIds([]);
      // Reset UI elements
      setSpeakingElement(null);
      setActivePlaybackScene(null);
      setCurrentSpeaker(null);
      return;
    }

    try {
      const isLastNode = nodeQueue.length === 0;
      console.log("playing next node in queue, playingAllNodes: ", playingAllNodes, "isLastNode:", isLastNode, "isFirstNode:", isFirstNode);
      if (type === "audio") {
        playSceneAudio(nextNode, true, isLastNode, isFirstNode);
      } else {
        generateTextFromNode(nextNode, true, isLastNode, isFirstNode);
      }
    } catch (error) {
      console.error("Error playing node:", error);
      // Continue with the next node even if there's an error
      setTimeout(() => {
        playNextNodeInQueue();
      }, 1000);
    }
  };
  
  // Add function to cancel playing all nodes
  const cancelPlayAllNodes = () => {
    console.log("cancelling play all nodes");
    if (playingAllNodes) {
      playAllNodesQueueRef.current = [];
      setPlayingAllNodes(false);
      updatePlayingState(false, null);
      setButtonDisabled(false); // Make sure button is re-enabled
      // Clear active connections
      setActiveConnectionIds([]);
      // Reset UI elements
      setSpeakingElement(null);
      setActivePlaybackScene(null);
      setCurrentSpeaker(null);

      // Clear audio
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
      
      // Stop any playing audio
      document.querySelectorAll('audio').forEach(audio => {
        try {
          audio.pause();
          audio.remove();
        } catch (e) {
          console.warn("Error cleaning up audio element:", e);
        }
      });
    }
  };

  // Helper function to check if scene has human participants
  const sceneHasHumanParticipants = (node: SnippetNode): boolean => {
    if (!node.attachedScene) return false;

    // Check if any scene avatar elements have isHuman flag directly
    for (const box of node.attachedScene.boxes) {
      if (box.elements) {
        for (const element of box.elements) {
          if (element.elementType === 'avatar' && element.avatarData) {
            // Check if the avatar data has isHuman flag using safer property access
            if (element.avatarData.hasOwnProperty('isHuman') && (element.avatarData as any).isHuman) {
              return true;
            }
          }
        }
      }
    }

    // Also check localStorage for human participants
    try {
      const topicDataStr = localStorage.getItem('topicData');
      if (topicDataStr) {
        const parsedData = JSON.parse(topicDataStr);
        if (parsedData.humanParticipants && parsedData.humanParticipants.length) {
          // Check if any speakers match human participants
          if (node.speakers && node.speakers.some(speaker => 
            parsedData.humanParticipants.includes(speaker.name)
          )) {
            return true;
          }
        }
      }
    } catch (e) {
      console.error("Error checking for human participants in localStorage:", e);
    }

    return false;
  };

  // Modify the handlePlayAllClick function to handle both types
  const handlePlayAllClick = (e: React.MouseEvent) => {
    // Don't do anything if button is disabled or already playing
    if (buttonDisabled || playingAllNodes) return;
    
    // Start playback
    setButtonDisabled(true);
    playAllNodes(useAudio ? "audio" : "text");
  };

  // Add helper function to classify backchannel vibes into emojis
  const getBackchannelEmoji = (message: string, vibe?: string): string => {
    // First try to use the vibe if available
    if (vibe) {
      // Map vibes to emojis based on chatutils.js vibeExamples
      const normalizedVibe = vibe.toLowerCase();
      
      switch (normalizedVibe) {
        case 'amused': return '😏';
        case 'skeptical': return '🤨';
        case 'excited': return '😃';
        case 'supportive': return '👍';
        case 'curious': return '🤔';
        case 'concerned': return '😟';
        case 'empathetic': return '🫂';
        case 'bored': return '😴';
        case 'surprised': return '😲';
        case 'confused': return '😕';
        case 'impressed': return '🙌';
        case 'agreeable': return '😊';
        case 'neutral': return '👁️';
        case 'nodding': return '👍';
        default: break; // Fall through to content analysis
      }
    }
    
    // Extract vibe/emotion from the backchannel message
    const messageText = message.toLowerCase();
    
    // Map different emotions/reactions to appropriate emojis
    if (messageText.includes('nodding') || messageText.includes('agreeing')) return '👍';
    if (messageText.includes('smiling') || messageText.includes('grinning')) return '😊';
    if (messageText.includes('skeptical') || messageText.includes('doubting') || messageText.includes('eyebrow')) return '🤨';
    if (messageText.includes('shocked') || messageText.includes('surprised')) return '😲';
    if (messageText.includes('concerned') || messageText.includes('worried') || messageText.includes('furrowing')) return '😟';
    if (messageText.includes('confused') || messageText.includes('puzzled')) return '😕';
    if (messageText.includes('laughing') || messageText.includes('chuckling')) return '😄';
    if (messageText.includes('leaning forward') || messageText.includes('interested')) return '👀';
    if (messageText.includes('impressed')) return '🙌';
    if (messageText.includes('thinking')) return '🤔';
    
    // Default emoji for other backchannels
    return '👁️';
  };

  // Add interface for message with backchannels
  interface MessageWithBackchannels {
    sender: string;
    message: string;
    timestamp: string;
    party?: string;
    avatarConfig?: any;
    backchannels?: Array<{
      sender: string;
      message: string;
      emoji: string;
      vibe?: string;
    }>;
    [key: string]: any; // Allow for other properties
  }

  // Add effect to handle human participant changes
  useEffect(() => {
    const handleHumanParticipantsChanged = () => {
      // Get current human participants from localStorage
      try {
        const savedData = localStorage.getItem('aiPanelData');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
            // Update all nodes with attached scenes
            const updatedNodes = nodes.map(node => {
              if (node.type === 'snippet' && (node as SnippetNode).attachedScene) {
                const snippetNode = node as SnippetNode;
                // Add null check for attachedScene
                if (snippetNode.attachedScene && snippetNode.attachedScene.id) {
                  let sceneKey: string | null = null;
                  let sceneData: string | null = null;
                  
                  try {
                    sceneKey = `scene:${snippetNode.attachedScene.id}`;
                    sceneData = localStorage.getItem(sceneKey);
                    
                    if (sceneData) {
                      const updatedScene = JSON.parse(sceneData);
                      return {
                        ...node,
                        attachedScene: updatedScene
                      };
                    }
                  } catch (error) {
                    console.error('Error updating scene data:', error);
                  }
                }
              }
              return node;
            });
            
            // Update nodes in store
            updatedNodes.forEach((updatedNode) => {
              if (!updatedNode) return;
              
              const originalNode = nodes.find(n => n.id === updatedNode.id);
              if (originalNode && 
                  originalNode.type === 'snippet' && 
                  JSON.stringify((originalNode as SnippetNode).attachedScene) !== 
                  JSON.stringify((updatedNode as SnippetNode).attachedScene)) {
                updateNode(updatedNode.id, updatedNode as Partial<SnippetNode>);
              }
            });
            
            // Refresh the UI
            setForceUpdate(prev => prev + 1);
          }
        }
      } catch (error) {
        console.error('Error handling human participants change:', error);
      }
    };

    window.addEventListener('humanParticipantsChanged', handleHumanParticipantsChanged);
    window.addEventListener('storage', (e) => {
      if (e.key === 'aiPanelData') {
        handleHumanParticipantsChanged();
      }
    });

    return () => {
      window.removeEventListener('humanParticipantsChanged', handleHumanParticipantsChanged);
      window.removeEventListener('storage', handleHumanParticipantsChanged);
    };
  }, [nodes, updateNode]);

  // Listen for topic changes and update nodes with new topic
  useEffect(() => {
    const handleTopicChanged = () => {
      // Get the updated topic from localStorage
      try {
        const savedData = localStorage.getItem('aiPanelData');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          const newTopic = parsedData.discussionTopic || '';
          
          // Update all nodes with the new topic
          const { nodes, updateSnippetNode } = useEditorStore.getState();
          if (nodes.length > 0) {
            // Update each node individually with the new topic
            nodes.forEach(node => {
              updateSnippetNode(node.id, {
                topic: newTopic // Only update the main conversation topic
              });
            });
            
            console.log('Updated all nodes with new topic:', newTopic);
          }
        }
      } catch (error) {
        console.error('Error updating nodes with new topic:', error);
      }
    };
    
    // Listen for the topicChanged event
    window.addEventListener('topicChanged', handleTopicChanged);
    
    return () => {
      window.removeEventListener('topicChanged', handleTopicChanged);
    };
  }, []);

  return (
    <div className="node-editor-container theme-bg-primary">
      {/* Add the background element that moves with panning */}
      <div 
        className="canvas-background" 
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: '0 0',
          opacity: 1,
          display: 'block',
          zIndex: 0,
          pointerEvents: 'none'
        }} 
      />

      {/* Add Play All button */}
      <div className="absolute top-[10px] right-[10px] z-10 flex items-center gap-2">
        <div 
          className={`px-2.5 py-1.5 
            ${playingAllNodes || isPlaying || isGenerating ? 'bg-gray-500 cursor-not-allowed' : 
              buttonDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600'} 
            text-white rounded flex items-center gap-1.5 text-sm shadow transition-colors duration-300`}
          onClick={(e) => {
            if (buttonDisabled || playingAllNodes || isPlaying || isGenerating) return; // Prevent clicks when disabled or playing
            handlePlayAllClick(e);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 2L12 8L4 14V2Z" fill="white" />
          </svg>
          <span>{playingAllNodes || isPlaying || isGenerating ? "Playing..." : "Play All"}</span>
        </div>

        {/* Checkbox as a separate element */}
        <label 
          className={`flex items-center px-2 py-1 bg-white border border-gray-300 rounded ${playingAllNodes || isPlaying || isGenerating ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          onClick={(e) => e.stopPropagation()} // Prevent any click events from bubbling
        >
          <input
            type="checkbox"
            className="form-checkbox h-3 w-3 rounded"
            checked={useAudio}
            onChange={(e) => {
              if (!playingAllNodes) {
                setUseAudio(e.target.checked);
              }
            }}
            disabled={playingAllNodes || isPlaying || isGenerating}
          />
          <span className="ml-1 text-xs text-gray-700">Audio</span>
        </label>
      </div>

      <svg
        ref={canvasRef}
        className={`canvas ${isDragOver ? 'drag-over' : ''}`}
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseDown={handleCanvasDragStart}
        style={{ cursor: isDraggingCanvas ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${position.x}, ${position.y}) scale(${scale})`}>
          <NodeConnection
            nodes={nodes}
            mousePos={mousePos}
            nextId={nextConnectionId}
            activeConnectionIds={activeConnectionIds}
            onConnectionComplete={(connection) => {
              addConnection(connection);
              setNextConnectionId(prev => prev + 1);
            }}
          />

          {nodes.map((node) => (
            <NodeDisplay
              key={`node-${node.id}`}
              node={node as SnippetNode}
              nodes={nodes as SnippetNode[]}
              forceUpdate={forceUpdate}
              hasMoved={hasMoved}
              connectingFrom={connectingFrom}
              onNodeClick={handleNodeClick}
              onStartDragging={startDragging}
              onDeleteNode={handleDeleteNode}
              onDuplicateNode={handleDuplicateNode}
              onStartConnection={handleStartConnection}
              onCompleteConnection={handleCompleteConnection}
              activeContextMenuNode={activeContextMenuNode}
              onContextMenuOpen={handleContextMenuOpen}
              isFocused={focusedNodeId === node.id}
              draggingNode={draggingNode}
              scale={scale}
              playingNodeId={playingNodeId}
              emojiStates={emojiStates}
            />
          ))}
        </g>
      </svg>

      {/* Add zoom controls */}
      <div className="zoom-controls">
        <button onClick={() => setScale(s => Math.min(s + 0.1, 3))}>+</button>
        <button onClick={() => setScale(1)}>Reset</button>
        <button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))}>-</button>
      </div>

      {(isGenerating || isPlaying) && (
        <div className="generating-overlay">
          <div className="generating-spinner"></div>
          <div>{isGenerating ? "Generating conversation..." : "Playing scene audio..."}</div>
        </div>
      )}
      
      {/* Add the speaking highlight overlay */}
      {isPlaying && speakingElement && activePlaybackScene && (
        <SpeakingHighlight
          speakingElement={speakingElement}
          currentScene={activePlaybackScene}
        />
      )}

      {/* Add PreviewPanel with export dialog */}
      {messages.length > 0 && (
        <PreviewPanel
          messages={messages.map(m => ({
            content: m.message,
            sender: m.sender,
            isProactive: false,
            party: m.party,
            avatarConfig: m.avatarConfig
          }))}
          onClose={() => setMessages([])}
          audioSegments={audioSegments}
          currentPlaybackTime={currentPlaybackTime}
          isPlaying={isPlaying}
          totalDuration={totalDuration}
          onSeek={handleSeek}
          avatarInstancesRef={avatarInstancesRef}
          showExportDialog={!!setShowExportDialog}
        />
      )}
    </div>
  )
}

export default NodeEditor
