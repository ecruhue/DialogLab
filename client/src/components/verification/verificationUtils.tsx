import { toast } from "react-hot-toast";
import { AudioSegment, Message } from "../nodeeditor/utils/NodeEditorUtils";

export const EMOJI_INTERRUPTION = "⚡"; 
export const EMOJI_QUESTION = "❓";
export const EMOJI_SYSTEM = "🔧";
export const EMOJI_HUMAN = "👤";
export const EMOJI_IMPROMPTU_START = "💡";
export const EMOJI_IMPROMPTU_END = "✅";
export const EMOJI_SUPPORTIVE = "👍";
export const EMOJI_EXCITED = "🎉";
export const EMOJI_CONCERNED = "⚠️";

// Common emotional markers and their emoji representations
export const EMOTION_EMOJIS: Record<string, string> = {
  // Positive emotions
  "happy": "😊",
  "excited": EMOJI_EXCITED,
  "amused": "😄",
  "supportive": EMOJI_SUPPORTIVE,
  "impressed": "👏",
  "empathetic": "💗",
  
  // Neutral emotions
  "curious": "🤔",
  "neutral": "😐",
  
  // Negative emotions
  "skeptical": "🤨",
  "concerned": EMOJI_CONCERNED,
  "confused": "😕",
  "bored": "😴",
  "surprised": "😲",
  
  // Special states
  "moderated": "📢",
  "interruption": EMOJI_INTERRUPTION,
  "question": EMOJI_QUESTION,
}

export interface Participant {
  id: string;
  name: string;
  color: string;
}

export interface ConversationMetrics {
  participationTime: Record<string, number>; // participant id -> seconds
  turnTakingFrequency: Record<string, number>; // participant id -> count
  speakingBalance: number; // 0-1 where 1 is perfectly balanced
  responseLatency: number; // average in seconds
  vocabularyDiversity: Record<string, number>; // participant id -> score
  sentiment: Record<string, number>; // participant id -> score (-1 to 1)
  coherenceScore: number; // 0-1
  interruptions: Record<string, number>; // participant id -> count
  speechRate: Record<string, number>; // participant id -> words per minute
  engagementLevel: Record<string, number>; // participant id -> score (0-1)
}

/**
 * Format time (seconds -> MM:SS)
 */
export const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Get participant by ID
 */
export const getParticipant = (participants: Participant[], id: string): Participant | undefined => {
  return participants.find((p) => p.id === id);
};

/**
 * Calculate percentage for timeline visualization
 */
export const getSegmentStyle = (segment: any, totalDuration: number, participantColor: string | undefined): React.CSSProperties => {
  const startPercent = (segment.start / totalDuration) * 100;
  const widthPercent = (segment.duration / totalDuration) * 100;

  return {
    left: `${startPercent}%`,
    width: `${widthPercent}%`,
    backgroundColor: participantColor || "#ccc",
  };
};

/**
 * Detect emotion from text based on common patterns and keywords
 */
export const detectEmotion = (text: string): string | null => {
  // Skip if no text
  if (!text) return null;
  
  const lowerText = text.toLowerCase();
  
  // Check for explicit emotion markers
  if (text.includes("emotion:")) {
    const match = text.match(/emotion:\s*([a-zA-Z]+)/i);
    if (match && match[1]) {
      const emotion = match[1].toLowerCase();
      if (EMOTION_EMOJIS[emotion]) {
        return emotion;
      }
    }
  }
  
  // Check for question patterns
  if (lowerText.includes("?") || 
      /^(what|how|why|when|where|which|who|whose|whom|can you|could you)/i.test(lowerText)) {
    return "question";
  }
  
  // Detect other emotions based on keywords
  const emotionPatterns = {
    "excited": /(wow|amazing|incredible|excited|exciting|awesome|fantastic|!{2,})/i,
    "happy": /(happy|glad|pleased|joy|smile|delighted|yay)/i,
    "amused": /(haha|lol|funny|amusing|laugh|hehe)/i,
    "supportive": /(support|agree|exactly|right|correct|good point)/i,
    "impressed": /(impressive|great job|well done|excellent|brilliant)/i,
    "empathetic": /(understand|feel for you|sorry to hear|that must be)/i,
    "curious": /(wonder|curious|interesting|tell me more|would like to know)/i,
    "skeptical": /(skeptical|not sure|doubtful|really\?|hard to believe)/i,
    "concerned": /(concerned|worried|concerning|alarming|problematic)/i,
    "confused": /(confused|confusing|don't understand|unclear|lost)/i,
    "bored": /(bored|boring|uninteresting|anyway|moving on)/i,
    "surprised": /(surprised|surprising|unexpected|can't believe|what\?|oh!)/i,
  };
  
  for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
    if (pattern.test(lowerText)) {
      return emotion;
    }
  }
  
  // Default to null if no emotion detected
  return null;
}

/**
 * Get emojis for a segment based on its characteristics
 */
export const getSegmentEmojis = (segment: AudioSegment): string => {
  const emojis = [];

  // Helper to safely get properties from segment or segment.message
  const getProp = (propName: string): any => {
    if (segment[propName as keyof AudioSegment] !== undefined) {
      return segment[propName as keyof AudioSegment];
    }
    if (segment.message && propName in segment.message) {
      return segment.message[propName as keyof Message];
    }
    return undefined;
  };

  // Check for system messages
  if (getProp('isSystemMessage')) {
    emojis.push(EMOJI_SYSTEM);
  } else if (getProp('impromptuPhase') || getProp('isImpromptuPhaseStart')) {
    emojis.push(EMOJI_IMPROMPTU_START);
    // // Check for derail mode
    // const derailMode = getProp('derailMode');
    // if (derailMode === "drift") {
    //   emojis.push(EMOJI_TOPIC_SHIFT);
    // } else if (derailMode === "extend") {
    //   emojis.push(EMOJI_PERSPECTIVE);
    // }
  }

  if (segment.message?.message && (
      segment.message?.message.includes("?") || 
      /^(what|how|why|when|where|which|who|whose|whom|can you|could you)/i.test(segment.message?.message)
  )) {
    emojis.push(EMOJI_QUESTION);
  }

  // Check for interruptions
  if (getProp('isInterruption')) {
    emojis.push(EMOJI_INTERRUPTION);
  }

  // Check for human messages
  if (getProp('isHuman')) {
    emojis.push(EMOJI_HUMAN);
  }
  
  return emojis.join(" ");
};

/**
 * Play a segment's audio
 */
export const playSegmentAudio = (
  segment: AudioSegment,
  audioRef: React.RefObject<HTMLAudioElement | null>,
  callbacks: {
    setCurrentTime: (time: number) => void,
    setIsPlaying: (isPlaying: boolean) => void
  }
): void => {
  const { setCurrentTime, setIsPlaying } = callbacks;
  
  // Check if segment has audio
  if (!segment.audioUrl) {
    console.log("No audio available for segment:", segment);
    return;
  }
  
  // Create audio element if it doesn't exist
  if (!audioRef.current) {
    console.log("Creating new audio element");
    audioRef.current = new Audio();
  }
  
  // Stop any currently playing audio
  audioRef.current.pause();
  audioRef.current.currentTime = 0;
  
  // Set source and play
  audioRef.current.src = segment.audioUrl;
  audioRef.current.onended = () => {
    setIsPlaying(false);
  };
  audioRef.current.onerror = (e) => {
    console.error("Error playing audio:", e);
    setIsPlaying(false);
    toast.error("Failed to play audio segment");
  };
  
  // Set playback position to segment start
  setCurrentTime(segment.start);
  
  // Play audio
  audioRef.current.play()
    .then(() => {
      setIsPlaying(true);
      toast.success("Playing segment audio");
    })
    .catch(err => {
      console.error("Failed to play audio:", err);
      setIsPlaying(false);
      toast.error("Failed to play audio: " + (err.message || "Unknown error"));
    });
};

/**
 * Play all segments sequentially with proper timing
 */
export const playAllSegments = (
  segments: AudioSegment[],
  audioRef: React.RefObject<HTMLAudioElement | null>,
  callbacks: {
    setIsPlaying: (isPlaying: boolean) => void,
    setCurrentTime: (time: number) => void,
  }
): void => {
  const { setIsPlaying, setCurrentTime } = callbacks;
  
  if (!segments?.length) {
    console.log("No segments available to play");
    return;
  }
  
  // Create audio element if it doesn't exist
  if (!audioRef.current) {
    console.log("Creating new audio element for playback");
    audioRef.current = new Audio();
  } else {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }

  setIsPlaying(true);
  
  // Sort segments by start time to ensure correct playback order
  const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
  
  let currentSegmentIndex = 0;
  let lastSegmentEnd = 0;
  
  const playNextSegment = () => {
    if (currentSegmentIndex >= sortedSegments.length) {
      setIsPlaying(false);
      return;
    }
    
    const segment = sortedSegments[currentSegmentIndex];
    if (!segment) return;
    
    // Check if segment has audio
    if (!segment.audioUrl) {
      console.log(`No audio for segment ${currentSegmentIndex}, skipping`);
      currentSegmentIndex++;
      playNextSegment();
      return;
    }
    
    // Handle timing - respect the actual start time of the segment
    const silenceDelay = segment.start - lastSegmentEnd;
    
    console.log(`Segment ${currentSegmentIndex}: start=${segment.start}, last end=${lastSegmentEnd}, delay=${silenceDelay}`);
    
    if (silenceDelay > 0) {
      // Update timeline position during the silence
      setCurrentTime(lastSegmentEnd);
      
      // Create a visual timer that updates the timeline position during silence
      let elapsedSilence = 0;
      const silenceStep = 100; // Update every 100ms
      
      const updateSilenceTimer = () => {
        elapsedSilence += silenceStep;
        const currentPosition = lastSegmentEnd + (elapsedSilence / 1000);
        setCurrentTime(currentPosition);
        
        if (elapsedSilence < silenceDelay * 1000) {
          setTimeout(updateSilenceTimer, silenceStep);
        } else {
          // Silence ended, play the segment
          playSegmentAudio(
            segment,
            audioRef, 
            { setCurrentTime,  setIsPlaying }
          );

          // Update for next segment
          lastSegmentEnd = segment.start + segment.duration;
          currentSegmentIndex++;
          
          // Set up listener for when audio ends
          if (audioRef.current) {
            audioRef.current.onended = () => {
              playNextSegment();
            };
          }
        }
      };
      
      // Start the silence timer
      setTimeout(updateSilenceTimer, silenceStep);
    } else {
      // No delay needed, play immediately
      playSegmentAudio(
        segment,
        audioRef, 
        { setCurrentTime, setIsPlaying }
      );
      
      // Update for next segment
      lastSegmentEnd = segment.start + segment.duration;
      currentSegmentIndex++;
      
      // Set up listener for when audio ends
      if (audioRef.current) {
        audioRef.current.onended = () => {
          playNextSegment();
        };
      }
    }
  };
  
  // Start with the first segment
  playNextSegment();
};

/**
 * Get color for audio type
 */
export const getAudioTypeColor = (segment: AudioSegment) => {
  // Helper to safely get properties from segment or segment.message
  const getProp = (propName: string): any => {
    if (segment[propName as keyof AudioSegment] !== undefined) {
      return segment[propName as keyof AudioSegment];
    }
    if (segment.message && propName in segment.message) {
      return segment.message[propName as keyof Message];
    }
    return undefined;
  };

  if (getProp('isSystemMessage')) return "bg-blue-400/80";
  if (getProp('isBackchannel')) return "bg-green-400/80";
  if (getProp('isDerailing')) return "bg-pink-400/80";
  if (getProp('isHuman')) return "bg-indigo-400/80";
  if (getProp('isProactive')) return "bg-amber-400/80";
  if (getProp('isInterruption')) return "bg-orange-400/80";

  if (segment.avatarId) {
    return "bg-opacity-80";
  }
  return "bg-gray-400/80";
};

/**
 * Get tooltip text for segment type
 */
export const getAudioTypeTooltip = (segment: any) => {
  // Helper to safely get properties from segment or segment.message
  const getProp = (propName: string): any => {
    if (segment[propName as keyof typeof segment] !== undefined) {
      return segment[propName as keyof typeof segment];
    }
    if (segment.message && propName in segment.message) {
      return segment.message[propName as keyof Message];
    }
    return undefined;
  };

  if (getProp('isSystemMessage')) return "System Message";
  if (getProp('isBackchannel')) return "Backchannel";
  if (getProp('isDerailing')) {
    return getProp('derailMode') === 'drift' ? "Topic Shift" : "Perspective Shift";
  }
  if (getProp('isHuman')) return "Human";
  if (getProp('isProactive')) return "Proactive";
  if (getProp('isInterruption')) return "Interruption";
  if (getProp('isImpromptuPhaseStart')) return "Impromptu Start";
  return "Message";
};

// Helper function to filter out system messages
export const filterNonSystemSegments = (segments: AudioSegment[]): AudioSegment[] => {
  return segments.filter(segment => segment.avatarName !== 'System');
};
