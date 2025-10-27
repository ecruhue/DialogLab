import { SnippetNode } from '@/components/inspector/store';
import API_CONFIG from '../../../config';
import { VerificationData } from '@/components/verification/VerificationPlayer';

export interface Message {
  content?: string;
  message?: string;
  participant?: string;
  sender?: string;
  isProactive?: boolean;
  isBackchannel?: boolean;
  isSystemMessage?: boolean;
  party?: string;
  isDerailing?: boolean;
  impromptuPhase?: boolean;
  derailMode?: string;
  isEndingPhase?: boolean;
  isImpromptuPhaseStart?: boolean;
  isHuman?: boolean;
  isInterruption?: boolean;
  avatarConfig?: {
    voice: string;
    [key: string]: any;
  };
  backchannels?: Array<{
    sender: string;
    message: string;
    emoji: string;
    vibe?: string;
  }>;
  type?: string;
  needsApproval?: boolean;
}

export interface AudioSegment {
  avatarId: string;
  avatarName: string;
  start: number;
  duration: number;
  audioUrl?: string;
  message?: Message;
  avatarColor?: string;
}

export interface AvatarElement {
  id: string;
  elementType: string;
  groupId: string;
  avatarData: {
    id?: string;
    name: string;
    url?: string;
    gender?: string;
    voice?: string;
    settings?: any;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface AvatarInstance {
  speakText: (text: string) => Promise<void>;
  playGesture: (gesture: string, duration: number, mirror: boolean, transitionTime: number) => void;
  isSpeaking: boolean;
  pauseSpeaking: () => void;
  startSpeaking: (forceResume?: boolean) => void;
  estimatedRemainingTime: number;
  name?: string;
  [key: string]: any;
}

/**
 * Validate the scene and return valid avatar elements
 */
export const validateScene = (currentScene: any, avatarInstancesRef: React.MutableRefObject<any>): AvatarElement[] => {
  if (!currentScene || !currentScene.boxes?.length) {
    console.error('No valid scene or conversation groups found');
    throw new Error('No valid scene or conversation groups found');
  }

  if (avatarInstancesRef?.current) {
    console.log('Available avatar instances:', Object.keys(avatarInstancesRef.current));
  } else {
    console.warn('No avatar instances in reference');
  }

  // Collect all valid avatar elements from all groups
  const validElements = currentScene.boxes.flatMap((box: any) => {
    console.log(`Processing box ${box.id} with ${box.elements?.length || 0} elements`);
    
    return (box.elements || [])
      .filter((element: any) => {
        // Only check avatar-type elements
        if (element.elementType !== 'avatar') {
          console.log(`Element ${element.id} is not an avatar (${element.elementType})`);
          return false;
        }
        
        const instance = avatarInstancesRef.current[element.id];
        const hasValidInstance = instance && typeof instance.speakText === 'function';
        
        console.log(`Avatar element ${element.id} validation:`, {
          hasAvatarData: !!element.avatarData,
          hasName: element.avatarData?.name,
          instanceExists: !!instance,
          hasSpeakMethod: instance ? typeof instance.speakText === 'function' : false,
          isValid: element.avatarData && hasValidInstance
        });
        
        return element.avatarData && hasValidInstance;
      })
      .map((element: any) => ({
        ...element,
        groupId: box.id
      }));
  });

  console.log(`Found ${validElements.length} valid avatar elements in scene out of ${
    currentScene.boxes.reduce((count: number, box: any) => 
      count + (box.elements?.filter((e: any) => e.elementType === 'avatar')?.length || 0), 0)
  } total avatar elements`);
  
  return validElements;
};

/**
 * Handle avatar speaking with gestures
 */
export const handleAvatarSpeaking = async (instance: AvatarInstance, text: string) => {
  try {
    console.log(`Avatar is speaking: ${instance.name || 'Unknown'}`);

    const speakingPromise = instance.speakText(text);
    
    // Add a small buffer before audio ends to prevent final gesture
    const bufferTime = 500; // 500ms buffer
    
    // Gesture loop
    const gestureLoop = async () => {
      const gestures = ['side', 'shrug'];
      
      while (instance.isSpeaking) {
        const nextGestureDuration = Math.random() * 1.5 + 0.5;
        const nextTransitionTime = Math.floor(Math.random() * 400) + 300;
        const waitMultiplier = 0.8 + Math.random() * 0.2;
        const totalNextGestureTime = (nextGestureDuration * 1000 + nextTransitionTime) * waitMultiplier;

        if (!instance.isSpeaking || 
            instance.estimatedRemainingTime < (totalNextGestureTime + bufferTime)) {
          break;
        }

        if (instance.playGesture) {
          if (Math.random() < 0.3) {
            await new Promise(resolve => setTimeout(resolve, 
              Math.random() * 1000 + 500
            ));
            continue;
          }
          
          const randomGesture = gestures[Math.floor(Math.random() * gestures.length)];
          const mirror = Math.random() < 0.6;
          
          instance.playGesture(randomGesture, nextGestureDuration, mirror, nextTransitionTime);
          await new Promise(resolve => setTimeout(resolve, totalNextGestureTime));
        }
      }
    };

    await Promise.all([
      speakingPromise,
      gestureLoop()
    ]);
    
  } catch (error) {
    console.error(`Error with avatar speaking:`, error);
    throw error;
  }
};

/**
 * Format time as MM:SS
 */
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Generate a unique color for each avatar with a more muted, professional palette
 */
export const getAvatarColor = (id: string): string => {
  // Handle undefined or null id values
  if (!id) {
    return 'hsl(210, 40%, 48%)'; // Default to a muted blue
  }
  
  // Use a hash of the avatar ID to generate the base hue
  const hash = id.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  // Define professional color ranges
  const hueRanges = [
    [200, 240],  // Blues
    [170, 190],  // Blue-greens
    [120, 150],  // Greens
    [20, 40],    // Warm oranges
    [330, 350],  // Muted reds
    [280, 300],  // Muted sky blues
    [60, 80]     // Muted golds
  ];
  
  // Select a hue range based on the hash
  const rangeIndex = Math.abs(hash) % hueRanges.length;
  const [minHue, maxHue] = hueRanges[rangeIndex];
  
  // Generate a hue within the selected range
  const hue = minHue + (Math.abs(hash) % (maxHue - minHue));
  
  // Use the hash to vary saturation and lightness slightly
  // but keep them within a professional range
  const saturation = 35 + (Math.abs(hash) % 15); // 35-50%
  const lightness = 45 + (Math.abs(hash) % 10);  // 45-55%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Helper function to filter out system messages
const filterNonSystemSegments = (segments: AudioSegment[]): AudioSegment[] => {
  return segments.filter(segment => segment.avatarName !== 'System');
};

// Helper function to calculate participation time
const calculateParticipationTime = (segments: AudioSegment[]): Record<string, number> => {
  const participationTime: Record<string, number> = {};
  const nonSystemSegments = filterNonSystemSegments(segments);
  
  nonSystemSegments.forEach(segment => {
    if (segment.avatarId) {
      participationTime[segment.avatarId] = (participationTime[segment.avatarId] || 0) + segment.duration;
    }
  });
  
  return participationTime;
};

// Helper function to calculate turn taking frequency
const calculateTurnTakingFrequency = (segments: AudioSegment[]): Record<string, number> => {
  const turnFrequency: Record<string, number> = {};
  const nonSystemSegments = filterNonSystemSegments(segments);
  
  nonSystemSegments.forEach(segment => {
    if (segment.avatarId) {
      turnFrequency[segment.avatarId] = (turnFrequency[segment.avatarId] || 0) + 1;
    }
  });
  
  return turnFrequency;
};

// Using mean-based calculations with standard deviations to calculate the coefficient of variation
// and then converting that to a balance score (0-1) using exponential decay function
const calculateSpeakingBalance = (participationTime: Record<string, number>): number => {
  const times = Object.values(participationTime);
  if (times.length === 0) return 0;
  
  // Simple case: only one participant
  if (times.length === 1) return 1;
  
  // Calculate mean speaking time
  const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
  
  if (mean === 0) return 0; // No one spoke
  
  // Calculate standard deviation
  const squaredDiffs = times.map(time => Math.pow(time - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / times.length;
  const stdDev = Math.sqrt(variance);
  
  // Calculate coefficient of variation (normalized standard deviation)
  const cv = stdDev / mean;
  
  // Convert to balance score (0-1)
  // Using an exponential decay function to map CV to balance score
  // As CV approaches 0, balance approaches 1 (perfect balance)
  // As CV increases, balance decreases toward 0
  return Math.max(0, Math.min(1, Math.exp(-2 * cv)));
};

// Helper function to calculate interruptions
const calculateInterruptions = (segments: AudioSegment[]): Record<string, number> => {
  const interruptions: Record<string, number> = {};
  const nonSystemSegments = filterNonSystemSegments(segments);

  nonSystemSegments.forEach(segment => {
    if (segment.avatarId && segment.message?.isInterruption === true) {
      interruptions[segment.avatarId] = (interruptions[segment.avatarId] || 0) + 1;
    }
  });

  return interruptions;
};

// Helper function to calculate engagement level
const calculateEngagementLevel = (segments: AudioSegment[]): Record<string, number> => {
  const engagement: Record<string, number> = {};
  const participantTurns: Record<string, number> = {};
  const nonSystemSegments = filterNonSystemSegments(segments);
  
  // Define weights for different engagement factors
  const weights = {
    baseScore: 0.3,         // Base engagement level
    questions: 0.15,        // Questions indicate active engagement
    backchannels: 0.1,      // Backchannels show active listening
    impromptu: 0.15,        // Impromptu content shows high engagement
    proactive: 0.15,        // Proactive contributions show initiative
    interruption: 0.05,     // Interruptions can show engagement (though potentially negative)
    contentLength: 0.1,     // Longer contributions may indicate higher engagement
    wordVariety: 0.1,       // Rich language indicates engagement
    referencesOthers: 0.15, // Referencing others' points shows active listening
    emotionalContent: 0.1   // Emotional content shows investment
  };

  // Track total segments per participant for averaging later
  nonSystemSegments.forEach(segment => {
    if (segment.avatarId) {
      participantTurns[segment.avatarId] = (participantTurns[segment.avatarId] || 0) + 1;
    }
  });
  
  // Initialize engagement scores
  Object.keys(participantTurns).forEach(id => {
    engagement[id] = 0;
  });
  
  // First pass: calculate raw engagement scores for each segment
  nonSystemSegments.forEach(segment => {
    if (!segment.avatarId || !segment.message) return;
    
    const message = segment.message;
    let segmentScore = 0;
    
    // Base score
    segmentScore += weights.baseScore;
    
    // Questions analysis (more sophisticated than just checking for '?')
    const hasQuestion = message.message?.includes('?') || 
                       /^(what|how|why|when|where|which|who|whose|whom|can you|could you)/i.test(message.message || '');
    if (hasQuestion) {
      segmentScore += weights.questions;
    }
    
    // Backchannels (both giving and receiving)
    if (message.isBackchannel) {
      segmentScore += weights.backchannels * 0.5; // Giving backchannels
    }
    if (message.backchannels && message.backchannels.length > 0) {
      // Receiving backchannels - more backchannels indicates higher engagement from others
      const backchannnelFactor = Math.min(1, message.backchannels.length / 3); // Cap at 3 backchannels
      segmentScore += weights.backchannels * backchannnelFactor;
    }
    
    // Impromptu discussion participation
    if (message.impromptuPhase || message.isImpromptuPhaseStart) {
      segmentScore += weights.impromptu;
    }
    
    // Proactive contributions
    if (message.isProactive) {
      segmentScore += weights.proactive;
    }
    
    // Interruptions - can indicate engagement but potentially negative
    if (message.isInterruption) {
      segmentScore += weights.interruption;
    }
    
    // Content length analysis
    if (message.message) {
      const wordCount = message.message.split(/\s+/).length;
      // Scale based on word count: 0.5 at 5 words, 1.0 at 20+ words
      const lengthFactor = Math.min(1, (wordCount - 5) / 15);
      if (lengthFactor > 0) {
        segmentScore += weights.contentLength * lengthFactor;
      }
    }
    
    // Word variety/complexity
    if (message.message) {
      const words = message.message.toLowerCase().split(/\s+/);
      const uniqueWords = new Set(words);
      // Ratio of unique words to total words is a simple measure of vocabulary diversity
      const varietyFactor = words.length > 0 ? uniqueWords.size / words.length : 0;
      segmentScore += weights.wordVariety * varietyFactor;
    }
    
    // References to others' points
    if (message.message) {
      const referencesPatterns = [
        /as you (said|mentioned|pointed out)/i,
        /to (your|their) point/i,
        /agree with/i,
        /like you said/i,
        /building on/i,
        /adding to/i,
        /referring to/i
      ];
      
      const hasReferences = referencesPatterns.some(pattern => pattern.test(message.message || ''));
      if (hasReferences) {
        segmentScore += weights.referencesOthers;
      }
    }
    
    // Emotional content analysis
    if (message.message) {
      const emotionalPatterns = [
        /(excited|exciting|amazing|wonderful|love|great|excellent)/i, // Positive
        /(concerned|worried|trouble|problem|issue|challenge)/i,      // Concerned
        /(disagree|wrong|incorrect|mistaken|error)/i,               // Disagreement
        /(surprised|surprising|unexpected|shocked|astonished)/i,    // Surprise
        /(think|believe|opinion|perspective|view)/i                 // Personal viewpoint
      ];
      
      const emotionCount = emotionalPatterns.filter(pattern => 
        pattern.test(message.message || '')).length;
      const emotionFactor = Math.min(1, emotionCount / 2); // Cap at 2 emotion types
      segmentScore += weights.emotionalContent * emotionFactor;
    }
    
    // Normalize the segment score to a maximum of 1.0
    const normalizedScore = Math.min(1, segmentScore);
    
    // Add to the participant's total engagement
    engagement[segment.avatarId] = (engagement[segment.avatarId] || 0) + normalizedScore;
  });
  
  // Second pass: normalize the engagement scores
  Object.keys(engagement).forEach(id => {
    if (participantTurns[id]) {
      // Average the engagement score
      engagement[id] = engagement[id] / participantTurns[id];
      
      // Apply a sigmoid function to create more differentiation in the middle range
      // This transforms scores to be more meaningful between 0.3 and 0.7
      engagement[id] = 1 / (1 + Math.exp(-10 * (engagement[id] - 0.5)));
    }
  });

  return engagement;
};

interface CoherenceAndSentimentScore {
  coherenceScore: number;
  overallSentiment: number;
  sentiment: Record<string, number>;
}

// Helper function to calculate coherence score using LLM
const calculateCoherenceAndSentimentScoreWithLLM = async (segments: AudioSegment[]): Promise<CoherenceAndSentimentScore> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VERIFICATION_CALCULATE_COHERENCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ segments })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      coherenceScore: data.coherenceScore,
      overallSentiment: data.overallSentiment,
      sentiment: data.sentiment
    };
  } catch (error) {
    console.error('Error calculating coherence score with LLM:', error);
    return {
      coherenceScore: 0,
      overallSentiment: 0,
      sentiment: {},
    };
  }
};

// Update the exportToVerificationData function to use the new LLM-based coherence calculation
export const exportToVerificationData = async (segments: AudioSegment[], totalDuration: number): Promise<VerificationData> => {
  const participationTime = calculateParticipationTime(segments);
  const turnTakingFrequency = calculateTurnTakingFrequency(segments);
  const speakingBalance = calculateSpeakingBalance(participationTime);
  const coherenceAndSentimentScore = await calculateCoherenceAndSentimentScoreWithLLM(segments);
  const coherenceScore = coherenceAndSentimentScore.coherenceScore;
  const overallSentiment = coherenceAndSentimentScore.overallSentiment;
  const sentiment = coherenceAndSentimentScore.sentiment;
  const interruptions = calculateInterruptions(segments);
  const engagementLevel = calculateEngagementLevel(segments);

  // Create a map of participant colors
  const participantColors = new Map<string, string>();
  segments.forEach(segment => {
    if (segment.avatarId && !participantColors.has(segment.avatarId)) {
      participantColors.set(segment.avatarId, segment.avatarColor || getAvatarColor(segment.avatarId));
    }
  });

  // Create participants array with colors
  const participants = Array.from(new Set(segments.map(segment => segment.avatarId)))
    .filter(id => id) // Filter out undefined/null
    .map(id => ({
      id,
      name: segments.find(s => s.avatarId === id)?.avatarName || '',
      color: participantColors.get(id) || '#6b7280'
    }));

  // Ensure each segment has an avatarColor
  const segmentsWithColors = segments.map(segment => ({
    ...segment,
    avatarColor: segment.avatarColor || participantColors.get(segment.avatarId) || getAvatarColor(segment.avatarId)
  }));

  return {
    title: "Conversation",
    duration: totalDuration,
    participants,
    metrics: {
      participationTime,
      turnTakingFrequency,
      speakingBalance,
      sentiment,
      coherenceScore,
      overallSentiment,
      interruptions,
      engagementLevel
    },
    segments: segmentsWithColors
  };
};

/**
 * Export audio data to verification format with TTS audio
 * This function sends segment data to server for TTS generation and 
 * then prepares the verification data with audio URLs
 */
export const exportToVerificationWithTTS = async (audioSegments: AudioSegment[], totalDuration: number, avatarVoicesMap: Map<string, any>): Promise<{data: any, success: boolean, message: string}> => {
  if (!audioSegments || audioSegments.length === 0) {
    console.warn('exportToVerificationWithTTS: No audio segments provided');
    return {
      data: null,
      success: false,
      message: "No audio segments to export"
    };
  }
  
  // Filter out segments with invalid avatarId
  const validSegments = audioSegments.filter(segment => segment && segment.avatarId);
  
  if (validSegments.length === 0) {
    console.warn('exportToVerificationWithTTS: No valid segments after filtering');
    return {
      data: null,
      success: false,
      message: "No valid audio segments found to export"
    };
  }
  
  if (validSegments.length !== audioSegments.length) {
    console.warn(`exportToVerificationWithTTS: Filtered out ${audioSegments.length - validSegments.length} invalid segments`);
  }

  try {
    // Prepare segments for TTS processing
    const segmentsForTTS = validSegments.map(segment => {
      // Get voice settings for this avatar
      const voiceSettings = avatarVoicesMap.get(segment.avatarId) || {
        name: "en-US-Neural2-F", // Default voice
        languageCode: "en-US",
        rate: 1.0,
        pitch: 0
      };
      
      return {
        segmentId: segment.avatarId + "-" + segment.start.toFixed(2),
        text: segment.message?.message,
        voiceSettings
      };
    });

    // Send to server for batch processing
    const startTime = Date.now();
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BATCH_SYNTHESIZE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ segments: segmentsForTTS })
    });
    
    const requestDuration = Date.now() - startTime;
    console.log(`[TTS Export] Server responded in ${requestDuration}ms with status ${response.status}`);

    if (!response.ok) {
      throw new Error(`Server returned error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`[TTS Export] Received ${result.results.length} results from server`);
    console.log(`[TTS Export] Summary: Success=${result.totalSuccess}, Failed=${result.totalFailed}`);
    
    // Map audio URLs back to the original segments
    console.log(`[TTS Export] Mapping audio URLs back to segments...`);
    const segmentsWithAudio = validSegments.map(segment => {
      const segmentId = segment.avatarId + "-" + segment.start.toFixed(2);
      const ttsResult = result.results.find((r: { segmentId: string, success: boolean, audioUrl?: string }) => r.segmentId === segmentId);
      
      if (ttsResult && ttsResult.success) {
        console.log(`[TTS Export] Segment ${segmentId} has audio: ${ttsResult.audioUrl.substring(0, 50)}...`);
        return {
          ...segment,
          audioUrl: ttsResult.audioUrl
        };
      }
      
      if (ttsResult) {
        console.warn(`[TTS Export] Failed to generate audio for segment ${segmentId}: ${ttsResult.error || 'Unknown error'}`);
      } else {
        console.warn(`[TTS Export] No result found for segment ${segmentId}`);
      }
      
      return segment;
    });
    
    // Count segments with audio
    const segmentsWithAudioCount = segmentsWithAudio.filter(segment => segment.audioUrl).length;
    console.log(`[TTS Export] ${segmentsWithAudioCount} out of ${segmentsWithAudio.length} segments have audio URLs`);
    
    // Generate the verification data using the segments with audio
    console.log(`[TTS Export] Generating final verification data...`);
    const verificationData = await exportToVerificationData(segmentsWithAudio, totalDuration);
    
    console.log(`[TTS Export] Export completed successfully`);
    return {
      data: verificationData,
      success: true,
      message: `Successfully generated audio for ${result.totalSuccess} out of ${result.totalSuccess + result.totalFailed} segments`
    };
  } catch (error: unknown) {
    console.error('[TTS Export] Error exporting with TTS:', error);
    
    // Log the specific error details
    if (error instanceof Error) {
      console.error('[TTS Export] Error message:', error.message);
      console.error('[TTS Export] Error stack:', error.stack);
    } else {
      console.error('[TTS Export] Unknown error type:', typeof error);
    }
    
    console.log('[TTS Export] Falling back to regular export without audio');
    return {
      data: await exportToVerificationData(audioSegments, totalDuration),
      success: false,
      message: `Error generating TTS audio: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Functions that were defined but not used - maintained for reference
 */

/**
 * Encode audio from URL to base64 string
 */
export const encodeAudioToBase64 = async (audioUrl: string): Promise<string | null> => {
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Remove the data URL prefix to get just the base64 content
        const base64Content = base64data.split(',')[1];
        resolve(base64Content);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error encoding audio to base64:', error);
    return null;
  }
};

/**
 * Capture audio data from an avatar instance
 */
export const captureAudioFromAvatar = async (
  avatarInstance: AvatarInstance,
  text: string
): Promise<{ audioBase64: string | null; duration: number }> => {
  try {
    // This is a placeholder implementation
    // In a real implementation, this would use the avatar API to capture audio
    
    // Mock audio capture process
    console.log(`Capturing audio for text: "${text}"`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock data
    return {
      audioBase64: null, // In a real implementation, this would be the base64-encoded audio
      duration: text.length / 10 // Rough estimate of duration based on text length
    };
  } catch (error) {
    console.error('Error capturing audio from avatar:', error);
    return {
      audioBase64: null,
      duration: 0
    };
  }
};

/**
 * Create a snippet node from a dragged scene
 */
export const createNodeFromScene = (
  scene: any, 
  x: number, 
  y: number, 
  speakers: any[], 
  getCachedDefaultSpeakers: Function, 
  addNode: Function,
  setSelectedItem: Function
): void => {
  // Generate a unique ID for the new node
  const nodeId = `snippet-${Date.now()}`;
  
  // Extract speakers from the scene's box elements
  const extractedSpeakers: any[] = [];
  const speakerIds = new Set<string>();
  
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
  
  // Process all boxes in the scene to find avatar elements
  console.log("SPEAKER EXTRACTION - Processing scene:", scene);
  console.log("SPEAKER EXTRACTION - Original speakers list:", speakers.length, speakers.map(s => s.name));
  console.log("SPEAKER EXTRACTION - Boxes count:", scene.boxes?.length);
  
  // Debug the box structure
  if (scene.boxes && scene.boxes.length > 0) {
    scene.boxes.forEach((box: any, index: number) => {
      console.log(`SPEAKER EXTRACTION - Box ${index}:`, box.id, box.party);
      console.log(`SPEAKER EXTRACTION - Box ${index} elements:`, box.elements?.length || 0);
      
      if (box.elements) {
        const avatarElements = box.elements.filter((e: any) => e.elementType === 'avatar');
        console.log(`SPEAKER EXTRACTION - Box ${index} avatar elements:`, avatarElements.length);
        
        avatarElements.forEach((avatar: any, avatarIndex: number) => {
          console.log(`SPEAKER EXTRACTION - Box ${index} avatar ${avatarIndex}:`, 
            avatar.avatarData?.name, avatar.avatarData?.id);
        });
      }
    });
  }
  
  // Track by name instead of ID since avatars may not have IDs
  const speakerNames = new Set<string>();
  
  scene.boxes.forEach((box: any) => {
    if (box.elements) {
      box.elements.forEach((element: any) => {
        // Check if the element has avatarData
        if (element.elementType === 'avatar' && element.avatarData) {
          const avatarData = element.avatarData;
          
          // Debug the element being processed
          // console.log(`SPEAKER EXTRACTION - Processing avatar:`, avatarData.name, avatarData.id);
          
          // Generate a unique identifier - use ID if available, otherwise use name
          const avatarIdentifier = avatarData.id || avatarData.name;
          // console.log(`SPEAKER EXTRACTION - Using identifier:`, avatarIdentifier);
          // console.log(`SPEAKER EXTRACTION - In speakerIds already?`, speakerIds.has(avatarIdentifier) || speakerNames.has(avatarData.name));
          
          // Avoid duplicate speakers (by ID or name)
          if (!speakerIds.has(avatarIdentifier) && !speakerNames.has(avatarData.name)) {
            if (avatarIdentifier) speakerIds.add(avatarIdentifier);
            if (avatarData.name) speakerNames.add(avatarData.name);
            
            // Look up the full speaker data from the global speakers list
            const fullSpeaker = speakers.find(s => s.id === avatarData.id || s.name === avatarData.name);
            // console.log(`SPEAKER EXTRACTION - Found in global speakers?`, !!fullSpeaker);
            
            // If found in global speakers, use that data, otherwise create minimal speaker data
            if (fullSpeaker) {
              // Update isHuman flag based on current human participants
              const updatedSpeaker = {
                ...fullSpeaker,
                isHuman: humanParticipants.includes(avatarData.name),
                party: box.party || fullSpeaker.party || 'default'
              };
              // console.log(`SPEAKER EXTRACTION - Adding full speaker:`, updatedSpeaker.name, updatedSpeaker.party);
              extractedSpeakers.push(updatedSpeaker);
            } else {
              const newSpeaker = {
                id: avatarData.id || `generated-${Date.now()}-${avatarData.name}`,
                name: avatarData.name,
                gender: avatarData.gender,
                voice: avatarData.settings?.voice || "",
                isHuman: humanParticipants.includes(avatarData.name),
                party: box.party || 'default'
              };
              // console.log(`SPEAKER EXTRACTION - Adding new speaker:`, newSpeaker.name, newSpeaker.party);
              extractedSpeakers.push(newSpeaker);
            }
          } else {
            console.log(`SPEAKER EXTRACTION - Skipping duplicate avatar:`, avatarData.name);
          }
        }
      });
    }
  });
  
  console.log("SPEAKER EXTRACTION - Final extracted speakers:", extractedSpeakers.length, extractedSpeakers.map((s: any) => s.name));
  
  // Get default speakers if no speakers were found
  const nodeSpeakers = extractedSpeakers.length > 0 ? 
    extractedSpeakers : 
    getCachedDefaultSpeakers();
    
  console.log("SPEAKER EXTRACTION - Final node speakers:", nodeSpeakers.length, nodeSpeakers.map((s: any) => s.name));
  
  // Create a new snippet node
  const newNode = {
    id: nodeId,
    type: "snippet",
    title: "", // Let the default title be set by the SnippetInspector
    x,
    y,
    isScripted: false,
    speakers: nodeSpeakers,
    initiator: selectInitiator(nodeSpeakers, scene),
    subTopic: scene.name, // Use scene name as initial subtopic
    turns: 3, // Default number of turns
    interactionPattern: "neutral", // Default interaction pattern
    turnTakingMode: "round-robin", // Default turn-taking mode
    attachedScene: scene // Attach the dragged scene
  };

  console.log("newNode", newNode) 
  
  // Add the new node to the editor
  addNode(newNode);
  console.log(`Created new snippet node from scene: ${scene.name}`);
  
  // Select the new node
  setSelectedItem(newNode);
};

/**
 * Select an appropriate initiator based on mode and parties
 */
export const selectInitiator = (speakers: any[], scene: any): any => {
  // Default to first speaker if available
  if (!speakers || !speakers.length) {
    console.log("INITIATOR SELECTION - No speakers available");
    return undefined;
  }
  
  console.log("INITIATOR SELECTION - Available speakers:", 
    speakers.map(s => ({name: s.name, id: s.id, party: s.party})));
  
  // Check if scene has moderated mode
  const isModerated = scene?.globalPartySettings?.partyTurnMode === "moderated";
  console.log("INITIATOR SELECTION - Moderated mode:", isModerated);
  console.log("INITIATOR SELECTION - Global party settings:", scene?.globalPartySettings);
  
  if (isModerated) {
    // Get the moderator party from scene settings
    const moderatorParty = scene?.globalPartySettings?.moderatorParty;
    console.log("INITIATOR SELECTION - Moderator party:", moderatorParty);
    
    if (moderatorParty) {
      // Find a speaker from the moderator party
      const speakersWithParties = speakers.filter(s => s.party);
      console.log("INITIATOR SELECTION - Speakers with parties:", 
        speakersWithParties.map(s => ({name: s.name, party: s.party})));
      
      const moderator = speakers.find(s => {
        if (!s.party) return false;
        
        const hasParty = !!s.party;
        const partyMatches = hasParty && 
          s.party.toLowerCase() === moderatorParty.toLowerCase();
        
        console.log(`INITIATOR SELECTION - Checking speaker ${s.name}: hasParty=${hasParty}, partyMatches=${partyMatches}`);
        return partyMatches;
      });
      
      console.log("INITIATOR SELECTION - Found moderator:", moderator?.name);
      if (moderator) return moderator;
    }
  
  }else{

  // If no exact moderator party match found, check for presenters or teaching staff
  const presenterKeywords = ['presenters', 'teaching staff', 'teacher', 'moderators', 'host'];
  const presenter = speakers.find(s => {
    if (!s.party) return false;
    
    const lowerParty = s.party.toLowerCase();
    console.log('lowerParty', lowerParty)
    const isPresenter = presenterKeywords.some(keyword => lowerParty.includes(keyword));
    
    // console.log(`INITIATOR SELECTION - Checking if ${s.name} (${s.party}) is a presenter: ${isPresenter}`);
    return isPresenter;
  });
  
  console.log("INITIATOR SELECTION - Found presenter:", presenter?.name);
  if (presenter) return presenter;
}
  
  // If we couldn't find a suitable initiator, use the first speaker
  console.log("INITIATOR SELECTION - Using first speaker:", speakers[0]?.name);
  return speakers[0];
};

/**
 * Collect all audio segments from played nodes
 * This combines audio segments from multiple nodes into a single timeline
 */
export const collectAudioSegmentsFromNodes = (nodes: SnippetNode[]): AudioSegment[] => {
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    console.warn('collectAudioSegmentsFromNodes: No nodes provided');
    return [];
  }

  // Filter to only include snippet nodes with audio segments
  const snippetNodes = nodes.filter(node => 
    node && node.type === 'snippet' && 
    node.audioSegments && 
    Array.isArray(node.audioSegments) && 
    node.audioSegments.length > 0
  );
  
  if (snippetNodes.length === 0) {
    console.warn('No nodes with audio segments found');
    return [];
  }
  
  console.log(`Found ${snippetNodes.length} nodes with audio segments`);
  
  // For each node, validate and filter segments with invalid avatarId
  const validatedNodes = snippetNodes.map(node => {
    const validSegments = node.audioSegments!!.filter(segment => 
      segment && segment.avatarId
    );
    
    if (validSegments.length !== node.audioSegments!!.length) {
      console.warn(`Filtered out ${node.audioSegments!!.length - validSegments.length} invalid segments from node ${node.id}`);
    }
    
    return {
      ...node,
      audioSegments: validSegments
    };
  }).filter(node => node.audioSegments!!.length > 0);
  
  if (validatedNodes.length === 0) {
    console.warn('No nodes with valid audio segments found after validation');
    return [];
  }
  
  // If there's only one node, just return its segments
  if (validatedNodes.length === 1) {
    return validatedNodes[0].audioSegments!!;
  }
  
  // For multiple nodes, we need to normalize the timestamps
  // so segments appear sequentially without overlap
  let allSegments: AudioSegment[] = [];
  let currentTime = 0;
  
  // Process each node's segments in order
  validatedNodes.forEach(node => {
    // Sort segments by start time within each node
    const nodeSegments = [...node.audioSegments!!].sort((a, b) => a.start - b.start);
    
    if (nodeSegments.length === 0) return;
    
    // Find the earliest segment start time in this node
    const nodeStartTime = nodeSegments[0].start;
    
    // Calculate offset to apply to all segments in this node
    // This shifts segments so they start immediately after the previous node's segments
    const timeOffset = currentTime - nodeStartTime;
    
    // Apply the offset to all segments in this node
    const adjustedSegments = nodeSegments.map(segment => ({
      ...segment,
      start: segment.start + timeOffset
    }));
    
    // Add to combined segments
    allSegments = [...allSegments, ...adjustedSegments];
    
    // Update currentTime to be after the last segment in this node
    const lastSegment = adjustedSegments[adjustedSegments.length - 1];
    currentTime = lastSegment.start + lastSegment.duration + 0.5; // Add a small gap between nodes
  });
  
  // Ensure segments are sorted by start time
  return allSegments.sort((a, b) => a.start - b.start);
}; 