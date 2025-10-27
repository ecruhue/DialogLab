import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PartyCommand } from '../nodeeditor/types';
import { AudioSegment } from '../nodeeditor/utils/NodeEditorUtils';

export interface AvatarConfig {
  id: string
  name: string
  gender: string
  voice: string
  personality?: string
  roleDescription?: string
  customAttributes?: Record<string, any>
  party?: string
  isPartyRepresentative?: boolean
  [key: string]: any
}

export interface Party {
  id: string;
  type: 'party';
  name: string;
  description: string;
  speakingMode: 'representative' | 'all' | 'subset' | 'random';
  hasRepresentative: boolean;
  enableBackchannel: boolean;
  representativeSpeaker?: string;
  participantIds: string[];
}

export interface GlobalParty {
  id: string;
  type: 'globalParty';
  name: string;
}

interface Node {
  id: string
  type: string
  title: string
  x: number
  y: number
  isScripted: boolean
  objective?: string
  speakers: AvatarConfig[]
  initiator?: AvatarConfig
  subTopic?: string
  turns?: number
  interactionPattern?: string
  description?: string
}

export interface InterruptionRule {
  id: string;
  fromSpeaker: AvatarConfig;
  toSpeaker: AvatarConfig;
  emotion: string;
}

export interface BackChannelRule {
  id: string;
  fromSpeaker: AvatarConfig;
  toSpeaker: AvatarConfig;
  emotion: string;
}

export interface SnippetNode extends Node {
  subTopic?: string;
  topic?: string;
  turns?: number;
  interactionPattern?: string;
  turnTakingMode?: string;
  snippetThoughts?: string;
  interruptionRules?: InterruptionRule[];
  backChannelRules?: BackChannelRule[];
  partyMode?: boolean;
  partyTurnMode?: 'free' | 'round-robin' | 'moderated';
  attachedScene?: Scene;
  party?: string;
  partyVariables?: Record<string, any>;
  partyState?: string;
  derailerMode?: boolean;
  audioSegments?: AudioSegment[];
  totalDuration?: number;
  description?: string;
  conversationPrompt?: string;

  // Temporary form state for creating interruption rules
  interruptionFromSpeaker?: string;
  interruptionToSpeaker?: string;
  interruptionEmotion?: string;

  // Temporary form state for creating backchannel rules
  backChannelFromSpeaker?: string;
  backChannelToSpeaker?: string;
  backChannelEmotion?: string;
}

interface Element {
  avatarData?: {
    gender: string;
    name: string;
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
  };
  elementType: string;
  id: string;
}

export interface Box {
  elementRatio: number;
  elements: Element[];
  height: number;
  id: string;
  layoutMode: string;
  party: string | null;
  partyConfig?: {
    name: string;
    description: string;
    speakingMode: 'representative' | 'all' | 'subset' | 'random';
    hasRepresentative: boolean;
    enableBackchannel: boolean;
    representativeSpeaker?: string;
    participantIds: string[];
    partyTurnMode?: string;
    isModeratorParty?: boolean;
    subsetSize?: number;
  };
  view: string;
  width: number;
  x: number;
  y: number;
}

export interface Scene {
  id: string;
  name: string;
  boxes: Box[];
  backgroundImage: string | null;
  hasUnsavedChanges: boolean;
  globalPartySettings?: GlobalPartySettings;
}

export interface SavedScene {
  id: string;
  name: string;
  boxes: Box[];
  backgroundImage: string | null;
  hasUnsavedChanges: boolean;
  preview?: ScenePreview;
  isFileReference?: boolean;
  isSaved?: boolean;
  isActive?: boolean;
  globalPartySettings?: GlobalPartySettings;
}

export interface ScenePreview {
  backgroundImage: string | null;
  boxCount: number;
  hasAvatars: boolean;
  hasContent: boolean;
  parties: string[];
  boxPositions: {
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  avatarNames: string[];
  boxContents?: Array<{
    avatarNames: string[];
    hasContent: boolean;
    party: string | null;
  }>;
  timestamp?: number;
  size?: string;
}

export interface Connection {
  id: string
  condition: string
  from: string
  to: string
}

// Available options for dropdown menus
export const interactionPatterns = ["neutral", "positive", "negative", "questioning"];
export const turnTakingModes = ["round-robin", "free-form", "directed"];
export const interruptionRules = ["none", "allowed", "frequent"];
export const voiceOptions = ["normal", "whisper", "loud", "excited"];
export const emotionOptions = ["Amused", "Skeptical", "Excited", "Supportive", "Curious", "Concerned", "Empathetic", "Bored", "Surprised", "Confused", "Impressed"];

// Default parties for quick setup
export const getDefaultParties = (): Party[] => [
  {
    name: "Teaching Staff", 
    description: "Your role is to teach, guide discussions, provide explanations, and help students understand difficult concepts.",
    speakingMode: "random",
    hasRepresentative: true,
    enableBackchannel: false,
    participantIds: [],
    id: '1',
    type: 'party'
  },
  {
    name: "Students",
    description: "Your role is to learn, ask questions when you don't understand, and seek clarification on complex topics.",
    speakingMode: "random",
    hasRepresentative: false,
    enableBackchannel: true,
    participantIds: [],
    id: '2',
    type: 'party'
  },
  {
    name: "Moderators",
    description: "Your role is to facilitate discussions, ensure balanced participation, maintain order, and guide the conversation flow towards productive outcomes.",
    speakingMode: "random",
    hasRepresentative: true,
    enableBackchannel: false,
    participantIds: [],
    id: '3',
    type: 'party'
  },
  {
    name: "Presenters",
    description: "Your role is to share knowledge, deliver prepared content, engage with the audience, and respond to questions about your presentation material.",
    speakingMode: "random",
    hasRepresentative: false,
    enableBackchannel: false,
    participantIds: [],
    id: '4',
    type: 'party'
  },
  {
    name: "Audience",
    description: "Your role is to actively listen, provide feedback during Q&A when appropriate, and engage with the presented content through questions and comments.",
    speakingMode: "random",
    hasRepresentative: false,
    enableBackchannel: true,
    participantIds: [],
    id: '5',
    type: 'party'
  }
];

export interface PartyConfig {
  name: string;
  description: string;
  speakingMode: 'random' | 'representative' | 'all' | 'subset';
  hasRepresentative: boolean;
  enableBackchannel: boolean;
  representativeSpeaker?: string;
  participantIds: string[];
  partyTurnMode?: string;
  isModeratorParty?: boolean;
  subsetSize?: number;
}

export interface GlobalPartySettings {
  partyTurnMode: string;
  moderatorParty: string;
  enableBackchannel: boolean;
}

// Extend Window interface to include our custom properties
declare global {
  interface Window {
    _storeHumanParticipantsSyncInitialized?: boolean;
    _humanParticipantsSyncInitialized?: boolean;
    editorStore?: any;
  }
}

// Editor state definition
export interface EditorState {
  selectedItem: Node | Connection | Party | GlobalParty | null;
  nodes: Node[];
  connections: Connection[];
  scenes: Scene[];
  activeSceneId: string | null;
  speakers: AvatarConfig[];
  savedScenes: Scene[];
  conversationMode: 'human-control' | 'autonomous' | 'reactive';
  
  // Core actions
  setSelectedItem: (item: Node | Connection | Party | GlobalParty | null) => void;
  updateSelectedItem: (updatedItem: Node | Connection | Party) => void;
  closeInspector: () => void;
  
  // Global party management
  openGlobalPartyInspector: () => void;
  
  // Node and connection management
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  updateSnippetNode: (nodeId: string, updates: Partial<SnippetNode>) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeAudioSegmentsAndTotalDuration: (nodeId: string, audioSegments: AudioSegment[], totalDuration: number) => void;
  addConnection: (connection: Connection) => void;
  updateConnection: (connectionId: string, updates: Partial<Connection>) => void;
  deleteConnection: (connectionId: string) => void;
  
  // Scene management
  setScenes: (scenes: Scene[]) => void;
  updateScene: (sceneIndex: number, updates: Partial<Scene>) => void;
  setActiveSceneId: (sceneId: string | null) => void;
  
  // Saved scenes management
  setSavedScenes: (scenes: Scene[]) => void;
  loadSavedScene: (sceneId: string) => Promise<Scene | null>;
  loadSavedScenes: () => void;
  deleteSavedScene: (sceneId: string) => void;
  
  // Party and avatar management
  updatePartyForBox: (boxId: string, partyName: string | null) => void;
  setSpeakers: (speakers: AvatarConfig[]) => void;
  applyAvatarConfigChanges: (id: string, config: AvatarConfig) => void;
  getCachedDefaultSpeakers: () => AvatarConfig[];
  
  // Party state
  partyConfigs: Record<string, PartyConfig>;
  globalPartySettings: GlobalPartySettings;
  
  // Party actions
  setPartyConfigs: (configs: Record<string, PartyConfig>) => void;
  setGlobalPartySettings: (settings: GlobalPartySettings) => void;
  getPartyCommands: () => PartyCommand[];
  
  // Listen for changes in human participants and update scenes
  listenForHumanParticipantsChanges: () => void;
  
  // New emoji states
  emojiStates: Record<string, string>;
  setEmojiStates: (states: Record<string, string>) => void;
  updateEmojiState: (elementId: string, emojiType: string | null) => void;
  
  // Conversation mode
  setConversationMode: (mode: 'human-control' | 'autonomous' | 'reactive') => void;
}

// Create the Zustand store with persistence
const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedItem: null,
      nodes: [],
      connections: [],
      scenes: [],
      activeSceneId: null,
      speakers: [],
      savedScenes: [],
      conversationMode: 'reactive',
      
      // Simple setters
      setSelectedItem: (item) => set({ selectedItem: item }),
      closeInspector: () => set({ selectedItem: null }),
      
      // Open global party inspector
      openGlobalPartyInspector: () => {
        set({ 
          selectedItem: { 
            id: 'global-party-manager', 
            type: 'globalParty',
            name: 'Global Party Manager'
          } 
        });
      },
      
      // Update the selected item and its corresponding array entry
      updateSelectedItem: (updatedItem) => {
        const { nodes, connections } = get();
        const updatedNodes = nodes.map(node =>
          node.id === updatedItem.id ? { ...node, ...updatedItem } : node
        );
        
        const updatedConnections = connections.map(conn =>
          conn.id === updatedItem.id ? { ...conn, ...updatedItem } : conn
        );
        
        set({
          selectedItem: updatedItem,
          nodes: updatedNodes as Node[],
          connections: updatedConnections as Connection[]
        });
      },
      
      // Node operations
      addNode: (node) => set(state => ({ nodes: [...state.nodes, node] })),
      updateNode: (nodeId, updates) => set(state => ({
        nodes: state.nodes.map(node => node.id === nodeId ? { ...node, ...updates } : node)
      })),
      updateSnippetNode: (nodeId: string, updates: Partial<SnippetNode>) => set(state => ({
        nodes: state.nodes.map(node => 
          node.id === nodeId && node.type === 'snippet' ? { ...node, ...updates } : node
        )
      })),
      deleteNode: (nodeId) => set(state => ({
        nodes: state.nodes.filter(node => node.id !== nodeId),
        connections: state.connections.filter(conn => conn.from !== nodeId && conn.to !== nodeId),
        selectedItem: state.selectedItem?.id === nodeId ? null : state.selectedItem
      })),
      updateNodeAudioSegmentsAndTotalDuration: (nodeId, audioSegments, totalDuration) => set(state => {
        // Update the node's audioSegments field
        const updatedNodes = state.nodes.map(node => {
          if (node.id === nodeId) {
            // Check if the node is a SnippetNode by checking for type property
            if (node.type === 'snippet') {
              return { ...node, audioSegments, totalDuration } as SnippetNode;
            }
          }
          return node;
        });
        
        // Also update selectedItem if it's the same node
        let selectedItem = state.selectedItem;
        if (selectedItem && selectedItem.id === nodeId && 'type' in selectedItem && selectedItem.type === 'snippet') {
          selectedItem = { ...selectedItem, audioSegments, totalDuration } as SnippetNode;
        }
        return { nodes: updatedNodes, selectedItem };
      }),
      
      // Connection operations
      addConnection: (connection) => set(state => ({ connections: [...state.connections, connection] })),
      updateConnection: (connectionId, updates) => {
        set(state => ({
          connections: state.connections.map(conn => 
            conn.id === connectionId ? { ...conn, ...updates } : conn
          ),
          selectedItem: state.selectedItem?.id === connectionId ? 
            { ...state.selectedItem, ...updates } : state.selectedItem
        }));
      },
      deleteConnection: (connectionId) => set(state => ({
        connections: state.connections.filter(conn => conn.id !== connectionId),
        selectedItem: state.selectedItem?.id === connectionId ? null : state.selectedItem
      })),
      
      // Scene operations
      setScenes: (scenes) => {
        // Ensure each scene has globalPartySettings
        const scenesWithSettings = scenes.map(scene => ({
          ...scene,
          globalPartySettings: scene.globalPartySettings || {
            partyTurnMode: 'free',
            moderatorParty: '',
            enableBackchannel: false
          }
        }));

        // Update savedScenes with the new scene data
        set(state => {
          const updatedSavedScenes = [...state.savedScenes];
          scenesWithSettings.forEach(scene => {
            const savedSceneIndex = updatedSavedScenes.findIndex(s => s.id === scene.id);
            if (savedSceneIndex !== -1) {
              updatedSavedScenes[savedSceneIndex] = { ...updatedSavedScenes[savedSceneIndex], ...scene };
            }
          });

          return {
            scenes: scenesWithSettings,
            savedScenes: updatedSavedScenes
          };
        });
      },
      updateScene: (sceneIndex, updates) => set(state => {
        if (sceneIndex < 0 || sceneIndex >= state.scenes.length) return state;
        
        const updatedScenes = [...state.scenes];
        const sceneToUpdate = updatedScenes[sceneIndex];
        
        // Apply updates
        updatedScenes[sceneIndex] = { ...sceneToUpdate, ...updates };
        
        // Get current human participants from localStorage
        let humanParticipants: string[] = [];
        try {
          const savedData = localStorage.getItem('aiPanelData');
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
              humanParticipants = parsedData.humanParticipants;
            }
          }
        } catch (error) {
          console.error('Error loading human participants:', error);
        }
        
        // Update all boxes to ensure isHuman flag is correct
        updatedScenes[sceneIndex].boxes = updatedScenes[sceneIndex].boxes.map(box => {
          const updatedBox = { ...box } as any; // Use 'any' to allow legacy properties
          
          // Update all avatar elements with current isHuman status
          if (updatedBox.elements) {
            updatedBox.elements = updatedBox.elements.map((element: any) => {
              if (element.elementType === 'avatar' && element.avatarData) {
                return {
                  ...element,
                  avatarData: {
                    ...element.avatarData,
                    isHuman: humanParticipants.includes(element.avatarData.name)
                  }
                };
              }
              return element;
            });
          }
          
          // Handle legacy format with avatarSlots
          if (updatedBox.avatarSlots) {
            updatedBox.avatarSlots = updatedBox.avatarSlots.map((slot: any) => {
              if (slot.avatarData) {
                return {
                  ...slot,
                  avatarData: {
                    ...slot.avatarData,
                    isHuman: humanParticipants.includes(slot.avatarData.name)
                  }
                };
              }
              return slot;
            });
          }
          
          // Handle legacy format with direct avatarData
          if (updatedBox.avatarData) {
            updatedBox.avatarData = {
              ...updatedBox.avatarData,
              isHuman: humanParticipants.includes(updatedBox.avatarData.name)
            };
          }
          
          return updatedBox as Box; // Cast back to Box type
        });

        // Also update the scene in savedScenes if it exists there
        const updatedSavedScenes = [...state.savedScenes];
        const savedSceneIndex = updatedSavedScenes.findIndex(s => s.id === sceneToUpdate.id);
        if (savedSceneIndex !== -1) {
          updatedSavedScenes[savedSceneIndex] = { ...updatedSavedScenes[savedSceneIndex], ...updates };
          
          // Also update the boxes in the saved scene
          updatedSavedScenes[savedSceneIndex].boxes = updatedScenes[sceneIndex].boxes;
        }

        // Save the updated scene to localStorage
        try {
          const storageKey = `scene:${sceneToUpdate.id}`;
          localStorage.setItem(storageKey, JSON.stringify(updatedScenes[sceneIndex]));
        } catch (error) {
          console.error('Error saving scene to localStorage:', error);
        }

        return { 
          scenes: updatedScenes,
          savedScenes: updatedSavedScenes
        };
      }),
      setActiveSceneId: (sceneId) => set(state => {
        if (sceneId === null) {
          // When closing all scenes, only clear the active scenes array, not saved scenes
          return { activeSceneId: null, scenes: [] };
        }
        // Otherwise, just set the active scene ID
        return { activeSceneId: sceneId };
      }),
      
      // Saved scenes management
      setSavedScenes: (scenes) => set({ savedScenes: scenes }),
      
      // Listen for changes in human participants and update scenes
      listenForHumanParticipantsChanges: () => {
        // Only initialize once
        if (window._storeHumanParticipantsSyncInitialized) {
          return;
        }
        
        window._storeHumanParticipantsSyncInitialized = true;
        
        // Function to update active scenes with human participants
        const updateScenesWithHumanParticipants = (humanParticipants: string[]) => {
          if (!humanParticipants || !Array.isArray(humanParticipants)) {
            return;
          }
          
          console.log('Editor store: Updating scenes with human participants:', humanParticipants);
          
          const state = get();
          if (!state.scenes || state.scenes.length === 0) {
            return;
          }
          
          const updatedScenes = state.scenes.map(scene => {
            // Create a deep copy to avoid reference issues
            const sceneToUpdate = JSON.parse(JSON.stringify(scene));
            
            // Update boxes with human participants
            sceneToUpdate.boxes = sceneToUpdate.boxes.map((box: any) => {
              const updatedBox = { ...box };
              
              // Update all avatar elements with current isHuman status
              if (updatedBox.elements) {
                updatedBox.elements = updatedBox.elements.map((element: any) => {
                  if (element.elementType === 'avatar' && element.avatarData) {
                    return {
                      ...element,
                      avatarData: {
                        ...element.avatarData,
                        isHuman: humanParticipants.includes(element.avatarData.name)
                      }
                    };
                  }
                  return element;
                });
              }
              
              // Handle legacy format with avatarSlots
              if (updatedBox.avatarSlots) {
                updatedBox.avatarSlots = updatedBox.avatarSlots.map((slot: any) => {
                  if (slot.avatarData) {
                    return {
                      ...slot,
                      avatarData: {
                        ...slot.avatarData,
                        isHuman: humanParticipants.includes(slot.avatarData.name)
                      }
                    };
                  }
                  return slot;
                });
              }
              
              // Handle legacy format with direct avatarData
              if (updatedBox.avatarData) {
                updatedBox.avatarData = {
                  ...updatedBox.avatarData,
                  isHuman: humanParticipants.includes(updatedBox.avatarData.name)
                };
              }
              
              return updatedBox;
            });
            
            return sceneToUpdate;
          });
          
          // Update store state
          set({ scenes: updatedScenes });
          
          console.log('Editor store: Updated scenes with human participants');
        };
        
        // Listen for storage events (changes from other tabs)
        window.addEventListener('storage', (e) => {
          if (e.key === 'aiPanelData') {
            try {
              const parsedData = JSON.parse(e.newValue || '{}');
              if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
                updateScenesWithHumanParticipants(parsedData.humanParticipants);
              }
            } catch (error) {
              console.error('Error handling aiPanelData storage event in editor store:', error);
            }
          }
        });
        
        // Listen for custom event (changes from current tab)
        window.addEventListener('humanParticipantsChanged', () => {
          try {
            const savedData = localStorage.getItem('aiPanelData');
            if (savedData) {
              const parsedData = JSON.parse(savedData);
              if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
                updateScenesWithHumanParticipants(parsedData.humanParticipants);
              }
            }
          } catch (error) {
            console.error('Error handling humanParticipantsChanged event in editor store:', error);
          }
        });
        
        // Listen for scene updates after human participants have been updated
        window.addEventListener('scenesUpdatedWithHumanParticipants', () => {
          // Reload saved scenes from localStorage to ensure they stay in sync
          const { loadSavedScenes } = get();
          loadSavedScenes();
        });
        
        console.log('Editor store: Human participants change listeners initialized');
      },
      
      loadSavedScene: async (sceneId) => {
        try {
          // Try to load the scene directly using the ID as the key
          let sceneStr = localStorage.getItem(`scene:${sceneId}`);
          
          // If not found, search for a scene with this ID in the data
          if (!sceneStr) {
            const allSceneKeys = Object.keys(localStorage).filter(key => key.startsWith("scene:"));
            for (const key of allSceneKeys) {
              try {
                const data = JSON.parse(localStorage.getItem(key) || '{}');
                if (data.id === sceneId) {
                  sceneStr = JSON.stringify(data);
                  break;
                }
              } catch (error) {
                console.error(`Error parsing scene data for key ${key}:`, error);
              }
            }
          }
          
          if (!sceneStr) {
            console.error(`Scene with ID "${sceneId}" not found in local storage.`);
            return null;
          }

          const sceneData = JSON.parse(sceneStr);
          console.log("Loading scene data:", sceneData);

          // Check if this is a file reference metadata entry
          if (sceneData.isFileReference && sceneData.fileUrl) {
            console.log("Loading scene from file URL:", sceneData.fileUrl);
            try {
              // Fetch the scene data from the file URL
              const response = await fetch(sceneData.fileUrl);
              if (!response.ok) {
                throw new Error(`Failed to fetch scene file: ${response.status} ${response.statusText}`);
              }
              const fileData = await response.json();
              
              // Replace sceneData with the full data from the file
              Object.assign(sceneData, fileData);
            } catch (fileError) {
              console.error("Error loading scene from file URL:", fileError);
              return null;
            }
          }

          // Get current human participants from localStorage
          let humanParticipants: string[] = [];
          try {
            const savedData = localStorage.getItem('aiPanelData');
            if (savedData) {
              const parsedData = JSON.parse(savedData);
              if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
                humanParticipants = parsedData.humanParticipants;
                console.log("Found human participants when loading scene:", humanParticipants);
              }
            }
          } catch (error) {
            console.error('Error loading human participants:', error);
          }

          // Find existing scene to preserve settings
          const { savedScenes } = get();
          const existingScene = savedScenes.find(s => s.id === sceneId);

          // Process boxes to update isHuman flag for all avatar elements
          const processedBoxes = (sceneData.boxes || []).map((box: Box) => {
            const updatedBox = { ...box } as any; // Use 'any' to allow legacy properties
            
            // Update all avatar elements with current isHuman status
            if (updatedBox.elements) {
              updatedBox.elements = updatedBox.elements.map((element: any) => {
                if (element.elementType === 'avatar' && element.avatarData) {
                  return {
                    ...element,
                    avatarData: {
                      ...element.avatarData,
                      isHuman: humanParticipants.includes(element.avatarData.name)
                    }
                  };
                }
                return element;
              });
            }
            
            // Handle legacy format with avatarSlots
            if (updatedBox.avatarSlots) {
              updatedBox.avatarSlots = updatedBox.avatarSlots.map((slot: any) => {
                if (slot.avatarData) {
                  return {
                    ...slot,
                    avatarData: {
                      ...slot.avatarData,
                      isHuman: humanParticipants.includes(slot.avatarData.name)
                    }
                  };
                }
                return slot;
              });
            }
            
            // Handle legacy format with direct avatarData
            if (updatedBox.avatarData) {
              updatedBox.avatarData = {
                ...updatedBox.avatarData,
                isHuman: humanParticipants.includes(updatedBox.avatarData.name)
              };
            }
            
            // Preserve existing party config if it exists
            if (existingScene) {
              const existingBox = existingScene.boxes.find(b => b.id === box.id);
              if (existingBox && existingBox.partyConfig) {
                updatedBox.partyConfig = existingBox.partyConfig;
              }
            }
            
            return updatedBox as Box; // Cast back to Box type
          });

          // Create a properly formatted scene object with preserved settings
          const loadedScene: Scene = {
            id: sceneData.id || `scene-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: sceneData.name || 'Unnamed Scene',
            boxes: processedBoxes,
            backgroundImage: sceneData.backgroundImage || null,
            hasUnsavedChanges: false,
            // Preserve existing global party settings if they exist
            globalPartySettings: sceneData.globalPartySettings || existingScene?.globalPartySettings || {
              partyTurnMode: 'free',
              moderatorParty: '',
              enableBackchannel: false
            }
          };

          return loadedScene;
        } catch (error) {
          console.error("Error loading saved scene:", error);
          return null;
        }
      },
      loadSavedScenes: () => {
        try {
          // Get current human participants from localStorage
          let humanParticipants: string[] = [];
          try {
            const savedData = localStorage.getItem('aiPanelData');
            if (savedData) {
              const parsedData = JSON.parse(savedData);
              if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants) && parsedData.humanParticipants.length > 0) {
                humanParticipants = parsedData.humanParticipants;
                console.log("Found human participants when loading scenes:", humanParticipants);
              }
            }
          } catch (error) {
            console.error('Error loading human participants:', error);
          }
          
          const sceneKeys = Object.keys(localStorage).filter((key) =>
            key.startsWith("scene:")
          );
          
          const loadedScenes = sceneKeys.map((key) => {
            try {
              const sceneData = JSON.parse(localStorage.getItem(key) || '{}');
              
              // Preserve existing party configs and global settings if they exist
              const existingScene = get().savedScenes.find(s => s.id === sceneData.id);
              
              // Process boxes to update isHuman flag for all avatar elements
              const processedBoxes = (sceneData.boxes || []).map((box: any) => {
                const updatedBox = { ...box } as any;
                
                // Update all avatar elements with current isHuman status
                if (updatedBox.elements) {
                  updatedBox.elements = updatedBox.elements.map((element: any) => {
                    if (element.elementType === 'avatar' && element.avatarData) {
                      return {
                        ...element,
                        avatarData: {
                          ...element.avatarData,
                          isHuman: humanParticipants.includes(element.avatarData.name)
                        }
                      };
                    }
                    return element;
                  });
                }
                
                // Handle legacy format with avatarSlots
                if (updatedBox.avatarSlots) {
                  updatedBox.avatarSlots = updatedBox.avatarSlots.map((slot: any) => {
                    if (slot.avatarData) {
                      return {
                        ...slot,
                        avatarData: {
                          ...slot.avatarData,
                          isHuman: humanParticipants.includes(slot.avatarData.name)
                        }
                      };
                    }
                    return slot;
                  });
                }
                
                // Handle legacy format with direct avatarData
                if (updatedBox.avatarData) {
                  updatedBox.avatarData = {
                    ...updatedBox.avatarData,
                    isHuman: humanParticipants.includes(updatedBox.avatarData.name)
                  };
                }
                
                // Preserve existing party config if it exists
                if (existingScene) {
                  const existingBox = existingScene.boxes.find(b => b.id === box.id);
                  if (existingBox && existingBox.partyConfig) {
                    updatedBox.partyConfig = existingBox.partyConfig;
                  }
                }
                
                return updatedBox;
              });
              
              return {
                id: sceneData.id || key.replace("scene:", ""),
                name: sceneData.name || "Unnamed Scene",
                timestamp: sceneData.timestamp || Date.now(),
                backgroundImage: sceneData.backgroundImage || null,
                boxes: processedBoxes || [],
                hasUnsavedChanges: false,
                // Preserve existing global party settings if they exist, otherwise use saved or default
                globalPartySettings: sceneData.globalPartySettings || existingScene?.globalPartySettings || {
                  partyTurnMode: 'free',
                  moderatorParty: '',
                  enableBackchannel: false
                }
              };
            } catch (error) {
              console.error(`Error parsing scene data for key ${key}:`, error);
              return null;
            }
          }).filter(scene => scene !== null) as Scene[];
          
          // Sort scenes by timestamp (newest first) if available
          const sortedScenes = loadedScenes.sort((a: any, b: any) => 
            (b.timestamp || 0) - (a.timestamp || 0)
          );
          
          set({ savedScenes: sortedScenes });
          return sortedScenes;
        } catch (error) {
          console.error("Error loading saved scenes:", error);
          set({ savedScenes: [] });
          return [];
        }
      },
      deleteSavedScene: (sceneId) => {
        try {
          // Remove from localStorage
          localStorage.removeItem(`scene:${sceneId}`);
          
          // Also search for and remove any scene with this ID
          const sceneKeys = Object.keys(localStorage).filter(key => key.startsWith("scene:"));
          for (const key of sceneKeys) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              if (data.id === sceneId) {
                localStorage.removeItem(key);
                break;
              }
            } catch (error) {
              console.error(`Error parsing scene data for key ${key}:`, error);
            }
          }
          
          // Update the savedScenes array in the store
          const { savedScenes } = get();
          const updatedScenes = savedScenes.filter(scene => scene.id !== sceneId);
          set({ savedScenes: updatedScenes });
          
          console.log(`Scene with ID "${sceneId}" successfully deleted.`);
        } catch (error) {
          console.error(`Error deleting scene with ID "${sceneId}":`, error);
        }
      },
      
      // Party management
      updatePartyForBox: (boxId, partyName) => {
        const { scenes, activeSceneId, selectedItem, partyConfigs } = get();
        
        if (!scenes || !activeSceneId) return;
        
        const activeSceneIndex = scenes.findIndex(scene => scene.id === activeSceneId);
        if (activeSceneIndex === -1) return;
        
        const updatedScenes = [...scenes];
        const activeScene = updatedScenes[activeSceneIndex];
        
        const boxIndex = activeScene.boxes.findIndex(box => box.id === boxId);
        if (boxIndex === -1) return;
        
        // Update the box's party property
        activeScene.boxes[boxIndex].party = partyName;
        activeScene.hasUnsavedChanges = true;
        
        // Apply global party settings if available when assigning a party
        if (partyName) {
          try {
            // Get global party settings
            const globalSettings = JSON.parse(localStorage.getItem('globalPartySettings') || '{}');
            
            // Initialize scene's global party settings if not present
            if (!activeScene.globalPartySettings) {
              activeScene.globalPartySettings = {
                partyTurnMode: globalSettings.partyTurnMode || 'free',
                moderatorParty: globalSettings.moderatorParty || '',
                enableBackchannel: globalSettings.enableBackchannel || false
              };
            }
            
            // Get saved party configs
            const savedParties = JSON.parse(localStorage.getItem('savedParties') || '[]');
            
            // Find the party config from global party configs or saved parties
            const existingPartyConfig = partyConfigs[partyName] || null;
            const savedPartyConfig = savedParties.find((p: { name: string; description?: string; speakingMode?: string; hasRepresentative?: boolean; enableBackchannel?: boolean }) => p.name === partyName);
            const defaultPartyConfig = getDefaultParties().find((p: { name: string; description?: string; speakingMode?: string; hasRepresentative?: boolean; enableBackchannel?: boolean }) => p.name === partyName);
            
            // Get the party description using the same priority as getPartyDescription in GlobalPartyInspector
            const description = existingPartyConfig?.description || 
                                savedPartyConfig?.description || 
                                defaultPartyConfig?.description || 
                                `Default description for ${partyName}. Edit this to provide context about this party's role and behavior.`;
            
            // Initialize or update box's party config
            activeScene.boxes[boxIndex].partyConfig = {
              name: partyName,
              description,
              speakingMode: existingPartyConfig?.speakingMode || savedPartyConfig?.speakingMode || 'random',
              hasRepresentative: existingPartyConfig?.hasRepresentative || savedPartyConfig?.hasRepresentative || false,
              enableBackchannel: existingPartyConfig?.enableBackchannel || globalSettings.enableBackchannel || false,
              partyTurnMode: existingPartyConfig?.partyTurnMode || globalSettings.partyTurnMode || 'free',
              isModeratorParty: globalSettings.moderatorParty === partyName,
              representativeSpeaker: existingPartyConfig?.representativeSpeaker || savedPartyConfig?.representativeSpeaker || '',
              participantIds: existingPartyConfig?.participantIds || []
            };
            
            // Also update the global partyConfigs if it doesn't exist yet
            if (!existingPartyConfig) {
              const updatedPartyConfigs = { ...partyConfigs };
              updatedPartyConfigs[partyName] = {
                name: partyName,
                description,
                speakingMode: savedPartyConfig?.speakingMode || 'random',
                hasRepresentative: savedPartyConfig?.hasRepresentative || false,
                enableBackchannel: globalSettings.enableBackchannel || false,
                representativeSpeaker: savedPartyConfig?.representativeSpeaker || '',
                participantIds: []
              };
              set({ partyConfigs: updatedPartyConfigs });
            }
            
            // Save updated scene to localStorage
            const storageKey = `scene:${activeSceneId}`;
            localStorage.setItem(storageKey, JSON.stringify(activeScene));
          } catch (error) {
            console.error('Error applying party settings:', error);
          }
        } else {
          // If removing party assignment, clean up party config
          if (activeScene.boxes[boxIndex].partyConfig) {
            delete activeScene.boxes[boxIndex].partyConfig;
          }
          
          // Save updated scene to localStorage
          try {
            const storageKey = `scene:${activeSceneId}`;
            localStorage.setItem(storageKey, JSON.stringify(activeScene));
          } catch (error) {
            console.error('Error cleaning up party config:', error);
          }
        }
        
        set({ scenes: updatedScenes });
      },
      
      // Avatar management
      setSpeakers: (newSpeakers) => {
        set({ speakers: newSpeakers });
        try {
          localStorage.setItem('topicPanel-participants', JSON.stringify(newSpeakers));
        } catch (error) {
          console.error('Failed to save speakers to localStorage:', error);
        }
      },
      
      applyAvatarConfigChanges: (id, config) => {
        const event = new CustomEvent('applyAvatarChanges', {
          detail: { id, config }
        });
        document.dispatchEvent(event);
      },
      
      getCachedDefaultSpeakers: () => {
        const { speakers } = get();
        
        if (speakers && speakers.length > 0) {
          return speakers;
        }
        
        return getDefaultSpeakers();
      },
      
      // Party state initialization
      partyConfigs: {},
      globalPartySettings: {
        partyTurnMode: 'free',
        moderatorParty: '',
        enableBackchannel: false
      },
      
      // Party actions
      setPartyConfigs: (configs) => set({ partyConfigs: configs }),
      setGlobalPartySettings: (settings) => set({ globalPartySettings: settings }),
      
      getPartyCommands: () => {
        const { partyConfigs, globalPartySettings } = get();
        const commands: PartyCommand[] = [];
        
        // Create party commands for each configured party
        Object.entries(partyConfigs).forEach(([_, config]) => {
          commands.push({
            command: 'createParty',
            partyName: config.name,
            members: config.participantIds,
            config: {
              speakingMode: config.speakingMode,
              representative: config.representativeSpeaker || null,
              canInterrupt: true,
              speakingProbability: 1.0,
              backchannelProbability: config.enableBackchannel ? 0.3 : 0,
              partyDescription: config.description
            }
          });
        });
        
        // Add enable party mode command if we have any parties
        if (Object.keys(partyConfigs).length > 0) {
          commands.push({
            command: 'enablePartyMode',
            turnMode: globalPartySettings.partyTurnMode
          });
        }
        
        return commands;
      },
      
      // New emoji states
      emojiStates: {},
      setEmojiStates: (states) => set({ emojiStates: states }),
      updateEmojiState: (elementId, emojiType) => 
        set((state) => {
          const newStates = { ...state.emojiStates };
          if (emojiType === null) {
            // Add 500ms delay when removing emoji state (handoff)
            setTimeout(() => {
              set((state) => {
                const updatedStates = { ...state.emojiStates };
                delete updatedStates[elementId];
                return { emojiStates: updatedStates };
              });
            }, 500);
            // Return current state unchanged for now
            return { emojiStates: newStates };
          } else {
            newStates[elementId] = emojiType;
            return { emojiStates: newStates };
          }
        }),
      
      // Conversation mode
      setConversationMode: (mode) => set({ conversationMode: mode }),
    }),
    {
      name: 'editor-storage',
      
      // Only persist these state properties
      partialize: (state) => ({
        nodes: state.nodes,
        connections: state.connections,
        scenes: state.scenes,
        activeSceneId: state.activeSceneId,
        speakers: state.speakers,
        savedScenes: state.savedScenes,
        partyConfigs: state.partyConfigs,
        globalPartySettings: state.globalPartySettings,
        conversationMode: state.conversationMode
      }),
    }
  )
);

// Make store globally accessible
if (typeof window !== 'undefined') {
  (window as any).editorStore = useEditorStore;
}

// Default speakers with caching mechanism
export const getDefaultSpeakers = (() => {
  let cachedSpeakers: AvatarConfig[] | null = null;
  let lastUpdateTime = 0;
  const CACHE_TTL = 2000; // 2 seconds cache time
  
  // Initialize store with speakers from localStorage if available
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      try {
        const { speakers } = useEditorStore.getState();
        if (!speakers || speakers.length === 0) {
          const savedParticipants = localStorage.getItem('topicPanel-participants');
          if (savedParticipants) {
            const participants = JSON.parse(savedParticipants) as AvatarConfig[];
            if (Array.isArray(participants) && participants.length > 0) {
              useEditorStore.getState().setSpeakers(participants);
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize speakers:', error);
      }
    }, 100);
  }

  return (): AvatarConfig[] => {
    const now = Date.now();
    
    // Return cached speakers if available and not expired
    if (cachedSpeakers && (now - lastUpdateTime) < CACHE_TTL) {
      return cachedSpeakers;
    }
    
    // Get human participants from localStorage
    let humanParticipants: string[] = [];
    try {
      const aiPanelData = localStorage.getItem('aiPanelData');
      if (aiPanelData) {
        const parsedData = JSON.parse(aiPanelData);
        if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants) && parsedData.humanParticipants.length > 0) {
          humanParticipants = parsedData.humanParticipants;
          console.log("Found human participants in getDefaultSpeakers:", humanParticipants);
        }
      }
    } catch (error) {
      console.error('Error loading human participants in getDefaultSpeakers:', error);
    }
    
    // Check store first
    const { speakers } = useEditorStore.getState();
    if (speakers && speakers.length > 0) {
      // Make sure speakers have correct isHuman flag
      const updatedSpeakers = speakers.map(speaker => ({
        ...speaker,
        isHuman: humanParticipants.includes(speaker.name)
      }));
      
      cachedSpeakers = updatedSpeakers;
      lastUpdateTime = now;
      return updatedSpeakers;
    }

    try {
      const savedParticipants = localStorage.getItem('topicPanel-participants');
      if (savedParticipants) {
        const participants = JSON.parse(savedParticipants) as AvatarConfig[];
        if (Array.isArray(participants) && participants.length > 0) {
          // Make sure participants have correct isHuman flag
          const updatedParticipants = participants.map(participant => ({
            ...participant,
            isHuman: humanParticipants.includes(participant.name)
          }));
          
          cachedSpeakers = updatedParticipants;
          lastUpdateTime = now;
          useEditorStore.getState().setSpeakers(updatedParticipants);
          return updatedParticipants;
        }
      }

      // Default fallback speakers with isHuman flag
      const defaultSpeakers = [
        {
          id: "1",
          gender: "female",
          name: "Alice",
          settings: {
            body: "F",
            cameraDistance: 0.2,
            cameraRotateY: 0,
            cameraView: "upper",
            lipsyncLang: "en",
            mood: "neutral",
            ttsLang: "en-GB"
          },
          url: "/assets/female-avatar1.glb",
          voice: "en-GB-Standard-A",
          isHuman: humanParticipants.includes("Alice")
        },
        {
          id: "2",
          gender: "male",
          name: "Bob",
          settings: {
            body: "M",
            cameraDistance: 1.2,
            cameraRotateY: 0,
            cameraView: "upper",
            lipsyncLang: "en",
            mood: "neutral",
            ttsLang: "en-GB"
          },
          url: "/assets/male-avatar1.glb",
          voice: "en-GB-Standard-B",
          isHuman: humanParticipants.includes("Bob")
        },
        {
          id: "3",
          gender: "male",
          name: "Charlie",
          settings: {
            body: "M",
            cameraDistance: 1.2,
            cameraRotateY: 0,
            cameraView: "upper",
            lipsyncLang: "en",
            mood: "neutral",
            ttsLang: "en-GB"
          },
          url: "/assets/male-avatar2.glb",
          voice: "en-GB-Standard-D",
          isHuman: humanParticipants.includes("Charlie")
        }
      ];
      
      cachedSpeakers = defaultSpeakers;
      lastUpdateTime = now;
      return defaultSpeakers;
    } catch (error) {
      console.error('Failed to load participants:', error);
      return [];
    }
  };
})();

export default useEditorStore;

// Initialize human participants change listeners
useEditorStore.getState().listenForHumanParticipantsChanges();
