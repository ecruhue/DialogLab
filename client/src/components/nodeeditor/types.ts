import { AudioSegment } from "./utils/NodeEditorUtils";

// Party configuration interfaces
export interface PartyConfig {
  name?: string;
  description?: string;
  speakingMode?: 'random' | 'all' | 'representative' | 'subset';
  hasRepresentative?: boolean;
  enableBackchannel?: boolean;
  representativeSpeaker?: string;
  participantIds?: string[];
  partyTurnMode?: string;
  isModeratorParty?: boolean;
  subsetSize?: number;
  canInterrupt?: boolean;
  speakingProbability?: number;
  backchannelProbability?: number;
}

export interface AudioPlaybackConfig {
  scene: any;
  playAudio: boolean;
  playAnimation: boolean;
  maxTurns: number;
  agents: any[];
  participants: string[];
  initiator: string | null;
  topic: string;
  subTopic: string;
  interactionPattern: string;
  turnTakingMode: string;
  derailerMode?: boolean;
  partyMode?: boolean;
  partyCommands?: PartyCommand[];
  contentCommands?: ContentCommand[];
  derailerCommands?: SetAsDerailerCommand[];
  partyTurnMode?: string;
  moderatorParty?: string;
  globalPartySettings?: {
    partyTurnMode: string;
    moderatorParty: string;
    enableBackchannel: boolean;
    enableInterruptions: boolean;
  };
  shouldLoadPreviousConversationManager: boolean;
  conversationMode?: 'human-control' | 'autonomous' | 'reactive';
  conversationPrompt?: string | null;
}

export interface DragOffset {
  x: number;
  y: number;
}

export interface MousePosition {
  x: number;
  y: number;
}

export interface PartyCommandBase {
  command: string;
}

export interface CreatePartyCommand extends PartyCommandBase {
  command: 'createParty';
  partyName: string;
  members: string[];
  config: {
    speakingMode: string;
    representative: string | null;
    canInterrupt: boolean;
    speakingProbability: number;
    backchannelProbability: number;
    partyDescription: string;
  };
}

export interface EnablePartyModeCommand extends PartyCommandBase {
  command: 'enablePartyMode';
  turnMode: string;
}

export interface SetAsDerailerCommand extends PartyCommandBase {
  command: 'setAsDerailer';
  agentName: string;
  config: {
    enable: boolean;
    mode: "drift" | "extend" | "random";
    threshold: number;
    minTurns: number;
    maxTurns: number;
  };
}

export type PartyCommand = CreatePartyCommand | EnablePartyModeCommand | SetAsDerailerCommand;

// Content command interfaces
export interface ContentCommandBase {
  command: string;
}

export interface InitializeContentCommand extends ContentCommandBase {
  command: 'initializeContent';
  filename: string;
  owners?: string[] | string | null;
  isParty?: boolean; 
  presenter?: string | null;
  presenterIsParty?: boolean;
}

export interface SetContentAsPublicCommand extends ContentCommandBase {
  command: 'setContentAsPublic';
  contentId: string;
  presenter?: string | null;
  presenterIsParty?: boolean;
}

export type ContentCommand = InitializeContentCommand | SetContentAsPublicCommand;

// Scene box interfaces
export interface AvatarData {
  name: string;
  [key: string]: any;
}

export interface BoxElement {
  elementType: string;
  avatarData?: AvatarData;
  id: string;
  [key: string]: any;
}

export interface SceneBox {
  party: string | null;
  partyConfig?: PartyConfig;
  elements?: BoxElement[];
  [key: string]: any;
}

// Audio timeline interfaces
export interface AudioTimelineProps {
  isPlaying: boolean;
  audioSegments: AudioSegment[];
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  onAddVerificationPoint?: (segmentId: string, time: number) => void;
}

export interface AvatarElement {
  id: string;
  avatarData: AvatarData;
  elementType: string;
  [key: string]: any;
} 