import React, { useState, useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { AudioSegment } from '../nodeeditor/utils/NodeEditorUtils';
import useEditorStore from '../inspector/store';
import ImpromptuApprovalPanel from './ImpromptuApprovalPanel';
import { Message } from '../nodeeditor/utils/NodeEditorUtils';
import API_CONFIG from '@/config';

interface PartyColor {
  bg: string;
  text: string;
  accent: string;
}

interface MessageDisplayProps {
  messages: Message[];
  showExportDialog?: boolean;
  onExport?: () => void;
  onDeclineExport?: () => void;
  onApproveImpromptu?: (message: Message, editedContent?: string) => void;
  onRejectImpromptu?: (message: Message) => void;
  onEditImpromptu?: (messageContent: string) => void;
}

interface PreviewPanelProps {
  onClose: () => void;
  messages: Message[];
  audioSegments?: AudioSegment[];
  currentPlaybackTime?: number;
  isPlaying?: boolean;
  totalDuration?: number;
  onSeek?: (time: number) => void;
  avatarInstancesRef?: React.MutableRefObject<any>;
  showExportDialog?: boolean;
  onExport?: () => void;
  onDeclineExport?: () => void;
  onApproveImpromptu?: (message: Message, editedContent?: string) => void;
  onRejectImpromptu?: (message: Message) => void;
  onEditImpromptu?: (messageContent: string) => void;
  onRegenerateImpromptuWithMode?: (mode: string) => void;
}

// Helper function to check if a participant is a human user
const isHumanUser = (participant: string | undefined): boolean => {
  if (!participant) return false;
  
  try {
    const savedData = localStorage.getItem('aiPanelData');
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
        return parsedData.humanParticipants.includes(participant);
      }
    }
  } catch (error) {
    console.error('Error checking if participant is a human user:', error);
  }
  
  return false;
};

// Generate consistent colors based on party name
const getPartyColor = (partyName: string | undefined): PartyColor => {
  if (!partyName) return { bg: '#f1f5f9', text: '#1e293b', accent: '#64748b' };
  
  // Generate a deterministic color based on the party name
  let hash = 0;
  for (let i = 0; i < partyName.length; i++) {
    hash = partyName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Pre-defined color schemes for better UX - medium tone colors
  const colorSchemes = [
    { bg: '#c7d2fe', text: '#1e3a8a', accent: '#4f46e5' }, // Medium Indigo
    { bg: '#bbf7d0', text: '#166534', accent: '#10b981' }, // Medium Emerald
    { bg: '#fef08a', text: '#854d0e', accent: '#facc15' }, // Medium Amber
    { bg: '#fecaca', text: '#991b1b', accent: '#f87171' }, // Medium Red
          { bg: '#bae6fd', text: '#0c4a6e', accent: '#38bdf8' }, // Medium Sky Blue
    { bg: '#bae6fd', text: '#0c4a6e', accent: '#0ea5e9' }, // Medium Sky
  ];
  
  // Use the hash to select a color scheme
  const index = Math.abs(hash) % colorSchemes.length;
  return colorSchemes[index];
};

// Add this function to determine background color based on the vibe
const getVibeColor = (vibe?: string): string => {
      if (!vibe) return '#0c4a6e'; // Default sky blue for unknown vibes
  
  // Normalize vibe to lowercase
  const normalizedVibe = vibe.toLowerCase();
  
  // Map vibes to colors
  switch (normalizedVibe) {
          case 'amused': return '#0ea5e9'; // Sky blue
    case 'skeptical': return '#6B7280'; // Gray
    case 'excited': return '#F59E0B'; // Amber
    case 'supportive': return '#10B981'; // Emerald
    case 'curious': return '#3B82F6'; // Blue
    case 'concerned': return '#EF4444'; // Red
    case 'empathetic': return '#EC4899'; // Pink
    case 'bored': return '#4B5563'; // Gray
    case 'surprised': return '#F97316'; // Orange
          case 'confused': return '#0ea5e9'; // Sky blue
    case 'impressed': return '#059669'; // Green
    case 'agreeable': return '#10B981'; // Emerald
    case 'neutral': return '#6B7280'; // Gray
    case 'nodding': return '#10B981'; // Emerald
          default: return '#0c4a6e'; // Default sky blue
  }
};

const MessageDisplay: React.FC<MessageDisplayProps> = ({ 
  messages, 
  showExportDialog, 
  onExport, 
  onDeclineExport,
  onApproveImpromptu,
  onRejectImpromptu,
  onEditImpromptu
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // State to store human participants
  const [humanParticipants, setHumanParticipants] = useState<string[]>([]);
  // State to track messages that have been displayed
  const [displayedMessageIds, setDisplayedMessageIds] = useState<Set<string>>(new Set());
  // Store the latest messages to track new ones
  const [processedMessages, setProcessedMessages] = useState<string[]>([]);
  // Get the current conversation mode from store
  const { conversationMode } = useEditorStore();
  
  // Filter for valid messages - In human-control mode, exclude messages needing approval
  const validMessages = messages.filter(message => 
    (message.content || message.message) && 
    !(conversationMode === 'human-control' && message.needsApproval)
  );
  
  // Generate a unique ID for each message
  const getMessageId = (message: Message, index: number) => {
    const participant = message.participant || message.sender || '';
    const content = message.content || message.message || '';
    return `${participant}-${index}-${content.substring(0, 20)}`;
  };

  // Process new messages and mark them as displayed after animation completes
  useEffect(() => {
    // Get IDs for all current messages
    const currentMessageIds = validMessages.map((message, index) => getMessageId(message, index));
    
    // Find new messages (not in displayedMessageIds)
    const newMessageIds = currentMessageIds.filter(id => !displayedMessageIds.has(id));
    
    // If there are new messages, update the state and schedule them to be marked as displayed
    if (newMessageIds.length > 0) {
      // Set timeout to mark messages as displayed after animation completes
      const timer = setTimeout(() => {
        setDisplayedMessageIds(prev => {
          const updated = new Set(prev);
          newMessageIds.forEach(id => updated.add(id));
          return updated;
        });
      }, 800); // Reduced from 1500ms to 800ms to match shorter animation duration
      
      return () => clearTimeout(timer);
    }
  }, [validMessages, displayedMessageIds]);

  // Load human participants from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('aiPanelData');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
          setHumanParticipants(parsedData.humanParticipants);
        }
      }
    } catch (error) {
      console.error('Error loading human participants:', error);
    }
  }, []);

  // Listen for changes to human participants in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'aiPanelData') {
        try {
          const parsedData = JSON.parse(e.newValue || '{}');
          if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
            setHumanParticipants(parsedData.humanParticipants);
          }
        } catch (error) {
          console.error('Error handling aiPanelData storage event:', error);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('humanParticipantsChanged', () => {
      try {
        const savedData = localStorage.getItem('aiPanelData');
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (parsedData.humanParticipants && Array.isArray(parsedData.humanParticipants)) {
            setHumanParticipants(parsedData.humanParticipants);
          }
        }
      } catch (error) {
        console.error('Error handling humanParticipantsChanged event:', error);
      }
    });
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('humanParticipantsChanged', () => {});
    };
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.closest('.overflow-y-auto') as HTMLElement;
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (showExportDialog) {
      scrollToBottom();
    }
  }, [showExportDialog]);

  // Find the initiator's party
  const initiatorMessage = messages.find(m => !m.isProactive && (m.content || m.message));
  const initiatorParty = initiatorMessage?.party;

  // Check if a message belongs to the initiator's party
  const isInitiatorParty = (messageParty: string | undefined): boolean => {
    return Boolean(initiatorParty && messageParty === initiatorParty);
  };

  // Function to check if a message is part of an impromptu phase
  const isInImpromptuPhase = (index: number): {isInPhase: boolean, isDerailing: boolean, isStartMessage: boolean, isEndMessage: boolean, derailMode?: string} => {
    // Check if the message has flags from the server
    const message = messages[index];
    if (message.impromptuPhase) {
      // Debug log to check for isImpromptuPhaseStart flag (can be removed in production)
      if (message.isImpromptuPhaseStart) {
        console.log(`Found message with isImpromptuPhaseStart flag at index ${index}:`, message);
      }
      
      const result = {
        isInPhase: true,
        isDerailing: Boolean(message.isDerailing),
        isStartMessage: Boolean((message.isSystemMessage && !message.isEndingPhase && message.content?.includes("started an impromptu discussion phase")) || message.isImpromptuPhaseStart),
        isEndMessage: Boolean(message.isEndingPhase),
        derailMode: message.derailMode
      };
      
      if (result.isDerailing || result.isStartMessage || result.isEndMessage) {
        console.log(`Special impromptu message at index ${index}:`, 
          result.isDerailing ? "DERAILING" : 
          result.isStartMessage ? "START MESSAGE" : 
          "END MESSAGE"
        );
      }
      
      return result;
    }
    
    return {isInPhase: false, isDerailing: false, isStartMessage: false, isEndMessage: false};
  };

  // Function to check if a message is new (not yet displayed)
  const isMessageNew = (messageId: string): boolean => {
    return !displayedMessageIds.has(messageId);
  };

  // Function to handle editing impromptu messages
  const handleEditImpromptuMessage = (messageContent: string) => {
    try {
      if (onEditImpromptu) {
        onEditImpromptu(messageContent);
      }
    } catch (error) {
      console.error('Error editing impromptu message:', error);
    }
  };

  if (validMessages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 p-1.5 relative">
      <style>
        {`
         @keyframes messageFadeIn {
           0% {
             opacity: 0;
             transform: translateY(5px);
           }
           100% {
             opacity: 1;
             transform: translateY(0);
           }
         }
         
         @keyframes messageSpinBorder {
           0% {
             border-color: rgba(79, 70, 229, 0.3);
             border-top-color: rgba(79, 70, 229, 0);
             transform: scale(0.98);
           }
           50% {
             border-color: rgba(79, 70, 229, 0.5);
             border-top-color: rgba(79, 70, 229, 0);
             transform: scale(1);
           }
           100% {
             border-color: rgba(79, 70, 229, 0.3);
             border-top-color: rgba(79, 70, 229, 0);
             transform: scale(0.98);
           }
         }
         
         .message-new {
           animation: messageFadeIn 0.3s ease-out, messageSpinBorder 1s ease-in-out;
           will-change: transform, opacity;
         }
         
         .message-new-human {
           animation: messageFadeIn 0.3s ease-out, messageSpinBorder 1s ease-in-out;
           border-color: rgba(37, 99, 235, 0.5) !important;
           border-top-color: rgba(37, 99, 235, 0) !important;
           will-change: transform, opacity;
         }
         
         .message-new-derailer {
           animation: messageFadeIn 0.3s ease-out, messageSpinBorder 1s ease-in-out;
           border-color: rgba(219, 39, 119, 0.5) !important;
           border-top-color: rgba(219, 39, 119, 0) !important;
           will-change: transform, opacity;
         }
         
         .in-impromptu-phase {
           background: transparent;
           position: relative;
           padding-left: 2px;
           margin-left: 2px;
           border-left: 1px solid rgba(236, 72, 153, 0.15);
         }
         
         .impromptu-phase-derailer {
           position: relative;
           border-left: 1px solid rgba(236, 72, 153, 0.4);
         }
         
         .impromptu-phase-derailer::before {
           content: "";
           position: absolute;
           left: -3px;
           top: 50%;
           transform: translateY(-50%);
           width: 5px;
           height: 5px;
           border-radius: 50%;
           background-color: rgba(236, 72, 153, 0.6);
           animation: impromptuPulse 2s infinite;
           will-change: transform, opacity;
         }
         
         .impromptu-phase-derailer::after {
           content: "";
           position: absolute;
           top: -12px;
           left: -1px;
           height: 12px;
           width: 0;
           border-left: 1px dotted rgba(236, 72, 153, 0.4);
         }
         
         .impromptu-phase-start {
           position: relative;
           margin-top: 6px;
           padding-top: 2px;
         }
         
         .impromptu-phase-start::before {
           content: "";
           position: absolute;
           top: -3px;
           left: 0;
           right: 0;
           height: 2px;
           border-top: 2px dashed rgba(236, 72, 153, 0.6);
         }
         
         .impromptu-phase-start::after {
           content: "•••";
           position: absolute;
           top: -14px;
           left: 50%;
           transform: translateX(-50%);
           font-size: 10px;
           color: rgba(236, 72, 153, 0.8);
           letter-spacing: 2px;
         }
         
         .impromptu-phase-system-message {
           position: relative;
           border: 1px dashed rgba(236, 72, 153, 0.6) !important;
           background: linear-gradient(to right, rgba(236, 72, 153, 0.1), rgba(147, 51, 234, 0.1)) !important;
           box-shadow: 0 2px 8px rgba(236, 72, 153, 0.25) !important;
           z-index: 2;
         }
         
         /* Top dash line for system start message */
         .impromptu-phase-start-message {
           margin-top: 20px !important;
           position: relative;
         }
         
         .impromptu-phase-start-message::before {
           content: "";
           position: absolute;
           top: -12px;
           left: 20%;
           right: 20%;
           height: 0;
           border-top: 2px dashed rgba(236, 72, 153, 0.4);
           background: none;
         }
         
         .impromptu-phase-start-message::after {
           content: "○";
           position: absolute;
           top: -17px;
           left: 50%;
           transform: translateX(-50%);
           font-size: 12px;
           color: rgba(236, 72, 153, 0.8);
         }

         /* Add decorative elements for start message */
         .impromptu-phase-start-message-drift::before {
           border-top-color: rgba(244, 63, 94, 0.4) !important;
         }
         
         .impromptu-phase-start-message-drift::after {
           color: rgba(244, 63, 94, 0.8) !important;
         }
         
         .impromptu-phase-start-message-extend::before {
           border-top-color: rgba(168, 85, 247, 0.4) !important;
         }
         
         .impromptu-phase-start-message-extend::after {
           color: rgba(168, 85, 247, 0.8) !important;
         }
         
         /* Special styling for drift mode (topic change) */
         .impromptu-phase-drift {
           border: 1px dashed rgba(244, 63, 94, 0.7) !important;
           background: linear-gradient(to right, rgba(244, 63, 94, 0.15), rgba(236, 72, 153, 0.1)) !important;
           box-shadow: 0 2px 8px rgba(244, 63, 94, 0.3) !important;
         }
         
         /* Special styling for extend mode (perspective change) */
         .impromptu-phase-extend {
           border: 1px dashed rgba(168, 85, 247, 0.7) !important;
           background: linear-gradient(to right, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.1)) !important;
           box-shadow: 0 2px 8px rgba(168, 85, 247, 0.3) !important;
         }
         
         .impromptu-phase-system-message::before,
         .impromptu-phase-system-message::after {
           display: none; /* Remove the side dash lines */
         }
         
         /* Extended dash lines for impromptu phase */
         .impromptu-phase-system-line {
           position: relative;
           overflow: visible !important;
         }
         
         .impromptu-phase-system-line::before {
           content: "";
           position: absolute;
           left: 0;
           right: 0;
           top: 50%;
           width: 100%;
           height: 0;
           border-top: 2px dotted rgba(236, 72, 153, 0.3);
           z-index: -1;
           pointer-events: none;
           animation: dashPulse 3s infinite;
         }
         
         .impromptu-phase-system-line-drift::before {
           border-top: 2px dotted rgba(244, 63, 94, 0.3) !important;
         }
         
         .impromptu-phase-system-line-extend::before {
           border-top: 2px dotted rgba(168, 85, 247, 0.3) !important;
         }
         
         @keyframes dashPulse {
           0% {
             opacity: 0.3;
           }
           50% {
             opacity: 0.7;
           }
           100% {
             opacity: 0.3;
           }
         }
         
         .impromptu-phase-end {
           position: relative;
           margin-bottom: 20px !important;
           padding-bottom: 2px;
         }
         
         .impromptu-phase-end::after {
           content: "";
           position: absolute;
           bottom: -12px;
           left: 20%;
           right: 20%;
           height: 0;
           border-bottom: 2px dashed rgba(236, 72, 153, 0.4);
           background: none;
         }
         
         .impromptu-phase-end::before {
           content: "○";
           position: absolute;
           bottom: -17px;
           left: 50%;
           transform: translateX(-50%);
           font-size: 12px;
           color: rgba(236, 72, 153, 0.8);
         }
         
         @keyframes impromptuPulse {
           0% {
             transform: translateY(-50%) scale(0.8);
             opacity: 0.8;
           }
           50% {
             transform: translateY(-50%) scale(1.1);
             opacity: 1;
           }
           100% {
             transform: translateY(-50%) scale(0.8);
             opacity: 0.8;
           }
         }
        `}
      </style>
      
      {validMessages.map((message, index) => {
        // Destructure the message properties
        const content = message.content || message.message || '';
        const participant = message.participant || message.sender || '';
        const isSystemMessage = Boolean(message.isSystemMessage);
        const isBackchannel = Boolean(message.isBackchannel);
        const isProactive = Boolean(message.isProactive);
        const party = message.party;
        const messageParty = party || (isSystemMessage ? undefined : participant);
        const partyColor = getPartyColor(messageParty);
        
        // Check if message is from a human user
        const isFromHumanUser = isHumanUser(participant);
        
        // Find initiator info from valid messages within the MessageDisplay component
        const startingMsg = validMessages.find(m => !m.isProactive && (m.content || m.message));
        const initiatorName = startingMsg?.participant || startingMsg?.sender;
        const belongsToInitiator = participant === initiatorName;
        
        // Check if this message is in an impromptu phase
        const phaseInfo = isInImpromptuPhase(index);
        const { isInPhase, isDerailing, isStartMessage, isEndMessage, derailMode } = phaseInfo;
        
        // Check if this is a new message (not yet displayed)
        const messageId = getMessageId(message, index);
        const isNewMessage = isMessageNew(messageId);
        
        if (!content) return null;
        
        // Function to format system messages specially
        const formatSystemMessage = (text: string) => {
          // Special handling for our custom system message types
          if (message.isSystemMessage) {
            if (message.type === 'snippet_switch') {
              return (
                <div className="flex items-center gap-2 py-1 border-l-2 border-blue-400 pl-2">
                  <span className="text-blue-400 text-xs font-medium">New Snippet</span>
                  <span className="flex-1"></span>
                  <span className="text-[10px] text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded">
                    {text.trim()}
                  </span>
                </div>
              );
            } else if (message.type === 'scene_switch') {
              return (
                <div className="flex items-center gap-2 py-1 border-l-2 border-green-400 pl-2">
                  <span className="text-green-400 text-xs font-medium">New Scene</span>
                  <span className="flex-1"></span>
                  <span className="text-[10px] text-green-500 bg-green-100 px-1.5 py-0.5 rounded">
                    {text.trim()}
                  </span>
                </div>
              );
            }
          }
          
          // Original code for other system messages
          if (isSystemMessage && text.includes("raised their hand")) {
            const partyMention = messageParty ? ` (${messageParty})` : '';
            return text.replace(/has raised their hand|raised their hand/, `✋ raised hand${partyMention}`);
          }
          if (isSystemMessage && text.includes("approved") && text.includes("to speak")) {
            const partyMention = messageParty ? ` (${messageParty})` : '';
            return text.replace(/has been approved|was approved/, `✓ approved${partyMention}`);
          }
          if (isSystemMessage && (text.includes("started an impromptu discussion phase") || message.isImpromptuPhaseStart)) {
            // Use the message's derailMode property directly
            const mode = message.derailMode || (text.includes("different topic") ? "drift" : "extend");
            console.log(`System message has derailMode: ${message.derailMode}, content derailMode: ${text.includes("different topic") ? "drift" : "extend"}, using: ${mode}, isImpromptuPhaseStart: ${message.isImpromptuPhaseStart}`);
            const modeIcon = mode === "drift" ? "🔄" : mode === "extend" ? "🔍" : mode === "question" ? "💭" : mode === "emotional" ? "😢" : mode;
            const modeText = mode === "drift" ? "TOPIC SHIFT" : mode === "extend" ? "PERSPECTIVE SHIFT" : mode === "question" ? "QUESTION" : mode === "emotional" ? "EMOTIONAL" : mode;
            return `${modeIcon}  ★ ${text.replace(/has started an impromptu discussion phase/, `STARTED IMPROMPTU PHASE (${modeText})`)} ★`;
          }
          if (isSystemMessage && text.includes("The impromptu discussion phase has ended")) {
            return `✓  ★ ${text.replace(/The impromptu discussion phase has ended. Returning to the regular conversation./, 'IMPROMPTU PHASE ENDED')} ★`;
          }
          
          // For non-system messages, just return the text
          return isSystemMessage ? text : text;
        };

        // Determine if we need to add spacers for impromptu phases
        const showTopSpacer = ((isStartMessage || message.isImpromptuPhaseStart) || (isInPhase && index > 0 && !isInImpromptuPhase(index - 1).isInPhase)) && !isSystemMessage;
        const showBottomSpacer = isEndMessage || (isInPhase && index < validMessages.length - 1 && !isInImpromptuPhase(index + 1).isInPhase);

        return (
          <div key={`msg-${index}`}>
            {showTopSpacer && <div className="h-6"/>}
            <div 
              className={`flex ${isProactive || isFromHumanUser ? 'justify-end' : 'justify-start'} my-2 ${
                isInPhase ? 'in-impromptu-phase' : ''
              } ${
                isDerailing ? 'impromptu-phase-derailer' : ''
              } ${
                isStartMessage ? 'impromptu-phase-start' : ''
              } ${
                isEndMessage ? 'impromptu-phase-end' : ''
              }`}
            >
              {/* Message content */}
              <div className={`max-w-[85%] ${isStartMessage || message.isImpromptuPhaseStart ? `impromptu-phase-system-line ${(message.derailMode || derailMode) === 'drift' ? 'impromptu-phase-system-line-drift' : 'impromptu-phase-system-line-extend'}` : ''}`}>
                {messageParty && !isBackchannel && !isSystemMessage && (
                  <div className={`flex items-center mb-0.5 ${
                    isProactive || isFromHumanUser ? 'justify-end' : 'justify-start'
                  }`}>
                    <div 
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isFromHumanUser ? 'theme-bg-human-light theme-text-human theme-border theme-border-human ring-1 ring-blue-400' : 
                        isDerailing ? 'theme-bg-derailing-light theme-text-derailing theme-border theme-border-derailing' :
                        'theme-border theme-border-opacity-40 shadow-sm'
                      }`}
                      style={!isFromHumanUser && !isDerailing ? {
                        backgroundColor: partyColor.bg,
                        color: partyColor.text,
                        borderColor: partyColor.accent
                      } : {}}
                    >
                      {isFromHumanUser && (
                        <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mr-1"></span>
                      )}
                      {isDerailing && (
                        <span className="inline-block w-1.5 h-1.5 bg-pink-500 rounded-full mr-1 animate-pulse"></span>
                      )}
                      {participant}
                      {isFromHumanUser && (
                        <span className="ml-1 text-[9px] bg-blue-700 text-white px-1 rounded">
                          HUMAN
                        </span>
                      )}
                      {isDerailing && (
                        <span className="ml-1 text-[9px] bg-pink-700 text-white px-1 rounded">
                          {derailMode === 'drift' ? 'TOPIC SHIFT' : 
                          derailMode === 'extend' ? 'PERSPECTIVE SHIFT' :
                          derailMode === 'question' ? 'QUESTION' :
                          derailMode === 'emotional' ? 'EMOTIONAL' :
                          derailMode}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div 
                  className={`relative p-1.5 min-h-[20px] rounded text-[11px] ${
                    isSystemMessage 
                      ? isStartMessage || isEndMessage
                        ? 'theme-bg-system-message theme-text-system-message theme-border theme-border-system-message shadow-md'
                        : `theme-bg-tertiary theme-text-primary theme-border theme-border shadow-sm`
                      : isBackchannel
                        ? 'theme-border theme-bg-tertiary theme-text-tertiary italic shadow-sm'
                        : isProactive
                          ? 'theme-border theme-border-proactive theme-bg-proactive theme-text-proactive shadow-md'
                          : isFromHumanUser
                            ? 'theme-border theme-border-human border-2 theme-bg-human theme-text-human shadow-md'
                            : isDerailing
                              ? 'theme-border theme-border-derailing theme-bg-light theme-text-primary shadow-md'
                              : 'theme-border theme-border theme-bg-light theme-text-primary shadow-sm'
                  } ${belongsToInitiator ? 'ring-1 ring-indigo-300' : ''} ${
                    isNewMessage && !isSystemMessage && !isBackchannel
                      ? isFromHumanUser 
                        ? 'message-new-human' 
                        : isDerailing 
                          ? 'message-new-derailer' 
                          : 'message-new' 
                      : ''
                  } ${isStartMessage || message.isImpromptuPhaseStart ? `impromptu-phase-system-message impromptu-phase-start-message ${(message.derailMode || derailMode) === 'drift' ? 'impromptu-phase-drift impromptu-phase-start-message-drift' : 'impromptu-phase-extend impromptu-phase-start-message-extend'}` : ''}
                   ${isEndMessage ? 'impromptu-phase-system-message' : ''}`}
                  style={messageParty && !isBackchannel && !isSystemMessage && !isDerailing && !isFromHumanUser ? {
                    borderColor: `${partyColor.accent}${belongsToInitiator ? '60' : '40'}`
                  } : {}}
                >
                  {!isBackchannel && !isSystemMessage && (
                    isProactive ? (
                      <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1 theme-bg-proactive-indicator h-[80%] rounded shadow-sm"/>
                    ) : isFromHumanUser ? (
                      <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 theme-bg-human-indicator h-[80%] rounded shadow-sm"/>
                    ) : isDerailing ? (
                      <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1.5 theme-bg-derailing-indicator h-[90%] rounded animate-pulse shadow-sm"/>
                    ) : (
                      <div 
                        className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-[80%] rounded opacity-70 shadow-sm theme-bg-standard-indicator"
                      />
                    )
                  )}
                  <div className={`whitespace-pre-wrap break-words ${
                    isSystemMessage ? 'text-[10px] italic opacity-80' : 
                    isBackchannel ? 'italic text-[10px]' : 
                    'text-xs'
                  } ${
                    isProactive ? 
                      'pl-2'
                    : isFromHumanUser ? 
                      'pl-2'
                    : isDerailing ?
                      'pl-2'
                    : 
                      'pl-2'
                    } leading-relaxed`}>
                    {isSystemMessage ? formatSystemMessage(content) : content}
                  </div>
                  
                  {/* Backchannel emojis display */}
                  {message.backchannels && message.backchannels.length > 0 && (
                    <div className="absolute bottom-0 right-0 flex flex-row-reverse">
                      {Array.from(new Set(message.backchannels.map(b => b.sender))).map((sender, senderIdx) => {
                        // Get the most recent backchannel from this sender
                        const backchannel = message.backchannels!.find(b => b.sender === sender);
                        if (!backchannel) return null;
                        
                        // Use vibe information to style the emoji background
                        const vibeColor = getVibeColor(backchannel.vibe);
                        
                        return (
                          <div 
                            key={`backchannel-${index}-${sender}`}
                            className="relative group cursor-help"
                            style={{ marginRight: senderIdx === 0 ? '-8px' : '-4px', marginBottom: '-8px' }}
                          >
                            <span 
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-lg shadow-md border border-[rgba(255,255,255,0.1)]"
                              style={{ 
                                backgroundColor: vibeColor,
                                transition: 'transform 0.2s ease-in-out',
                              }}
                              onMouseOver={(e) => {
                                const target = e.currentTarget;
                                target.style.transform = 'scale(1.2)';
                              }}
                              onMouseOut={(e) => {
                                const target = e.currentTarget;
                                target.style.transform = 'scale(1)';
                              }}
                            >
                              {backchannel.emoji}
                            </span>
                            <div className="absolute bottom-full right-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-200 z-10">
                              <div className="bg-black text-white text-xs rounded p-1.5 min-w-[120px] max-w-[200px] shadow-lg">
                                <div className="font-bold">{backchannel.sender}</div>
                                <div className="text-xs text-gray-300 italic">{backchannel.message}</div>
                                {backchannel.vibe && (
                                  <div className="text-xs mt-1 px-1.5 py-0.5 rounded bg-gray-700">
                                    Vibe: {backchannel.vibe}
                                  </div>
                                )}
                              </div>
                              <div className="w-2 h-2 bg-black transform rotate-45 absolute -bottom-1 right-2"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {showBottomSpacer && <div className="h-6"/>}
          </div>
        );
      })}

      {/* Only show export dialog when not in human-control mode */}
      {showExportDialog && conversationMode !== 'human-control' && (
        <div className="flex flex-col gap-2 p-4 theme-bg-secondary rounded-lg theme-border theme-border mx-2 mb-2 max-h-[200px]">
          <div className="text-sm font-medium theme-text-primary">Export Conversation</div>
          <p className="text-xs theme-text-secondary">
            This will save your conversation for review in the verification panel.
          </p>
          <p className="text-xs theme-text-tertiary">
            You'll have the option to generate TTS audio in the next step.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={onExport}
              className="px-3 py-1.5 theme-bg-accent hover:theme-bg-accent-hover theme-text-inverse rounded text-xs font-medium transition-colors"
            >
              Export
            </button>
            <button
              onClick={onDeclineExport}
              className="px-3 py-1.5 theme-bg-tertiary hover:theme-bg-hover theme-text-primary rounded text-xs font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  onClose, 
  messages, 
  audioSegments = [], 
  currentPlaybackTime = 0, 
  isPlaying = false, 
  totalDuration = 0, 
  onSeek, 
  avatarInstancesRef,
  showExportDialog = false,
  onExport,
  onDeclineExport,
  onApproveImpromptu,
  onRejectImpromptu,
  onEditImpromptu,
  onRegenerateImpromptuWithMode
}) => {
  const { conversationMode, setConversationMode } = useEditorStore();
  const [regeneratingMessage, setRegeneratingMessage] = useState(false);

  const handleModeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value as 'human-control' | 'autonomous' | 'reactive';
    try {
      // Update store
      setConversationMode(newMode);
      
      // Send mode change to server
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONVERSATION_MODE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: newMode })
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation mode');
      }

      // If switching to autonomous mode, automatically approve any pending impromptu phases
      if (newMode === 'autonomous' && messages.some(m => m.needsApproval)) {
        onApproveImpromptu?.(messages.find(m => m.needsApproval)!);
      }
    } catch (error) {
      console.error('Error changing conversation mode:', error);
      // Revert to previous mode on error
      setConversationMode(conversationMode);
    }
  };

  // Find the starting message (first non-proactive message)
  const startingMessage = messages.find(m => !m.isProactive && (m.content || m.message));
  const initiatorName = startingMessage?.participant || startingMessage?.sender;
  const initiatorParty = startingMessage?.party;
  const initiatorColor = getPartyColor(initiatorParty);

  // Count parties for display
  const partyCount = new Set(messages.filter(m => m.party).map(m => m.party)).size;

  // Get all unique parties for the legend
  const uniqueParties = Array.from(new Set(messages
    .filter(m => m.party)
    .map(m => m.party)))
    .sort();

  // Check if there are any valid messages
  const hasValidMessages = messages.some(message => message.content || message.message);

  // Add a function to handle regeneration with a specific mode
  const handleRegenerateWithMode = async (mode: string) => {
    if (!onRegenerateImpromptuWithMode) return;
    
    try {
      setRegeneratingMessage(true);
      await onRegenerateImpromptuWithMode(mode);
    } catch (error) {
      console.error('Error regenerating message with mode:', mode, error);
    } finally {
      setRegeneratingMessage(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-150px)] theme-bg-primary theme-text-primary">
      {/* Mode selector */}
      <div className="flex items-center justify-between p-2 theme-bg-secondary theme-border-b">
        <select
          value={conversationMode}
          onChange={handleModeChange}
          className="theme-bg-tertiary theme-text-primary p-1 rounded text-sm"
        >
          <option value="human-control">Human Control</option>
          <option value="autonomous">Autonomous</option>
          <option value="reactive">Reactive</option>
        </select>
      </div>

      {/* Content area */}
      <div className={`overflow-y-auto p-4 ${
        conversationMode === 'human-control' && messages.some(m => m.needsApproval && m.isDerailing)
          ? 'flex-none h-[calc(100vh-450px)]' // Shorter height when showing approval panel
          : 'flex-1' // Full height otherwise
      }`}>
        {hasValidMessages ? (
          <>
            <MessageDisplay
              messages={messages}
              showExportDialog={showExportDialog}
              onExport={onExport}
              onDeclineExport={onDeclineExport}
              onApproveImpromptu={onApproveImpromptu}
              onRejectImpromptu={onRejectImpromptu}
              onEditImpromptu={onEditImpromptu}
            />
            {/* Show impromptu approval panel when in human control mode and there's a message needing approval */}
            {(() => {
              // Find message needing approval
              const messageNeedingApproval = messages.find(m => m.needsApproval && m.isDerailing);
              
              // Debug log - check all messages for needsApproval flag
              const needsApprovalMessages = messages.filter(m => m.needsApproval === true);
              if (needsApprovalMessages.length > 0) {
                console.log(`Found ${needsApprovalMessages.length} messages needing approval:`, needsApprovalMessages);
              }
              
              return conversationMode === 'human-control' && messageNeedingApproval && onApproveImpromptu && onRejectImpromptu && (
                <ImpromptuApprovalPanel
                  message={messageNeedingApproval}
                  onApprove={(editedContent) => onApproveImpromptu(messageNeedingApproval, editedContent)}
                  onReject={() => onRejectImpromptu(messageNeedingApproval)}
                  onEdit={onEditImpromptu}
                  onRegenerateWithMode={handleRegenerateWithMode}
                />
              );
            })()}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500">No conversation running. Select a mode above to begin.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;