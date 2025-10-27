import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { AudioSegment, getAvatarColor, exportToVerificationWithTTS, collectAudioSegmentsFromNodes } from "./NodeEditorUtils";
import useEditorStore from "../../inspector/store";

interface AudioTimelineProps {
  isPlaying: boolean;
  audioSegments: AudioSegment[];
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  onAddVerificationPoint?: (segmentId: string, time: number) => void;
  avatarInstancesRef?: React.MutableRefObject<any>;
}

const AudioTimeline: React.FC<AudioTimelineProps> = ({
  isPlaying,
  audioSegments,
  currentTime,
  duration,
  onSeek,
  onAddVerificationPoint,
  avatarInstancesRef
}) => {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isTtsGenerating, setIsTtsGenerating] = useState<boolean>(false);
  
  const uniqueAvatars = React.useMemo(() => {
    // Get unique avatars from segments
    const avatarMap = new Map<string, string>();
    audioSegments.forEach(segment => {
      avatarMap.set(segment.avatarId, segment.avatarName);
    });
    return Array.from(avatarMap.entries()).map(([id, name]) => ({ 
      id, 
      name,
      color: getAvatarColor(id)
    }));
  }, [audioSegments]);

  // Calculate progress percentage
  const progressPercent = (currentTime / (duration || 1)) * 100;
  
  // Handle export to verification mode with optional TTS
  const handleExport = async () => {
    // Ask user if they want to generate TTS audio
    const shouldGenerateTTS = window.confirm(
      "Do you want to generate TTS audio for this conversation? " +
      "This will create audio files based on each avatar's voice settings. " +
      "\n\nClick OK to generate audio, or Cancel to export without audio."
    );
    
    if (shouldGenerateTTS) {
      await handleExportWithTTS();
    } else {
      handleExportWithoutTTS();
    }
  };
  
  // Handle export with TTS generation
  const handleExportWithTTS = async () => {
    if (isTtsGenerating) return;
    
    setIsTtsGenerating(true);
    setExportStatus('processing');
    
    try {
      // Get all nodes from store that might have audio segments
      const { nodes } = useEditorStore.getState();
      
      // Collect audio segments from all nodes that have played
      const storedAudioSegments = collectAudioSegmentsFromNodes(nodes);
      
      // Use the collected segments if available, otherwise fall back to current segments
      const segmentsToExport = storedAudioSegments.length > 0 ? storedAudioSegments : audioSegments;
      
      if (segmentsToExport.length === 0) {
        console.log(`[AudioTimeline] No segments to export`);
        setIsTtsGenerating(false);
        setExportStatus(null);
        return;
      }
      
      // Collect voice settings from avatar instances
      const avatarVoicesMap = collectAvatarVoiceSettings();
      console.log(`[AudioTimeline] Starting export with TTS for ${segmentsToExport.length} segments`);
      
      const result = await exportToVerificationWithTTS(
        segmentsToExport,
        duration,
        avatarVoicesMap
      );

      if (result.success) {
        // Store in localStorage
        localStorage.setItem('verification-data', JSON.stringify(result.data));
        setExportStatus('success');
        console.log(`[AudioTimeline] Successfully stored verification data in localStorage`);
        toast.success(result.message, {
          duration: 3000,
          position: "bottom-center"
        });
      } else {
        // Show warning but still store data
        if (result.data) {
          localStorage.setItem('verification-data', JSON.stringify(result.data));
          setExportStatus('partial');
          console.log(`[AudioTimeline] Partially successful - stored data with some missing audio`);
          toast(result.message, {
            duration: 3000,
            position: "bottom-center",
            icon: "⚠️"
          });
        } else {
          setExportStatus('error');
          console.error(`[AudioTimeline] Export failed - no data returned`);
          toast.error(result.message, {
            duration: 3000,
            position: "bottom-center"
          });
        }
      }
    } catch (error) {
      console.error('[AudioTimeline] Error during TTS export:', error);
      setExportStatus('error');
      toast.error("Error exporting timeline with TTS", {
        duration: 3000,
        position: "bottom-center"
      });
    } finally {
      setIsTtsGenerating(false);
      console.log(`[AudioTimeline] TTS export process completed`);
      // Clear status after a delay
      setTimeout(() => setExportStatus(null), 3000);
    }
  };
  
  // Original export function (without TTS)
  const handleExportWithoutTTS = () => {
    // Get all nodes from store that might have audio segments
    const { nodes } = useEditorStore.getState();
    const storedAudioSegments = collectAudioSegmentsFromNodes(nodes);
    
    // Use the collected segments if available, otherwise fall back to current segments
    const segmentsToExport = storedAudioSegments.length > 0 ? storedAudioSegments : audioSegments;
    
    if (segmentsToExport.length === 0) {
      toast.error("No audio segments available to export", {
        duration: 3000,
        position: "bottom-center"
      });
      return;
    }
    
    console.log(`[AudioTimeline] Exporting ${segmentsToExport.length} segments without TTS`);
    
    setExportStatus('processing');
    
    // Build participant data from segments
    const avatarMap = new Map<string, { name: string, color: string }>();
    segmentsToExport.forEach((segment: AudioSegment) => {
      if (!avatarMap.has(segment.avatarId)) {
        avatarMap.set(segment.avatarId, {
          name: segment.avatarName,
          color: getAvatarColor(segment.avatarId)
        });
      }
    });
    
    // Calculate participation time from segments
    const participationTime: Record<string, number> = {};
    segmentsToExport.forEach((segment: AudioSegment) => {
      const avatarId = segment.avatarId;
      participationTime[avatarId] = (participationTime[avatarId] || 0) + segment.duration;
    });
    
    // Count turn-taking frequency
    const turnTakingFrequency: Record<string, number> = {};
    let lastSpeakerId = '';
    segmentsToExport.forEach((segment: AudioSegment) => {
      const avatarId = segment.avatarId;
      if (avatarId !== lastSpeakerId) {
        turnTakingFrequency[avatarId] = (turnTakingFrequency[avatarId] || 0) + 1;
        lastSpeakerId = avatarId;
      }
    });
    
    // Calculate speaking balance (how evenly distributed the speaking time is)
    const speakerCount = avatarMap.size;
    const idealSpeakingTime = duration / speakerCount;
    const participationValues = Object.values(participationTime);
    
    // Calculate average deviation from ideal speaking time (0-1, where 1 is perfect balance)
    let totalDeviation = 0;
    participationValues.forEach(time => {
      totalDeviation += Math.abs(time - idealSpeakingTime);
    });
    
    const speakingBalance = Math.max(0, 1 - (totalDeviation / (duration * 2)));
    
    // Create the VideoMetricsPlayer compatible data structure
    const verificationData = {
      url: '', // This would normally be a video URL
      title: "Conversation Export",
      duration: duration,
      participants: Array.from(avatarMap.entries()).map(([id, details]) => ({
        id,
        name: details.name,
        color: details.color
      })),
      metrics: {
        participationTime,
        turnTakingFrequency,
        speakingBalance,
        responseLatency: 1.0, // Default values for metrics we can't derive
        vocabularyDiversity: Object.fromEntries(
          Array.from(avatarMap.keys()).map(id => [id, 0.7])
        ),
        sentiment: Object.fromEntries(
          Array.from(avatarMap.keys()).map(id => [id, 0.5])
        ),
        coherenceScore: 0.8,
        interruptions: Object.fromEntries(
          Array.from(avatarMap.keys()).map(id => [id, 0])
        ),
        speechRate: Object.fromEntries(
          Array.from(avatarMap.keys()).map(id => [id, 120])
        ),
        engagementLevel: Object.fromEntries(
          Array.from(avatarMap.keys()).map(id => [id, 0.8])
        ),
      },
      // Add the raw segments data for timeline visualization in verification mode
      segments: segmentsToExport.map((segment: AudioSegment) => ({
        ...segment,
        // Ensure verification points exist
        verificationPoints: segment.verificationPoints || [
          segment.start,
          segment.start + segment.duration / 2,
          segment.start + segment.duration - 0.5
        ]
      }))
    };
    
    try {
      // Store in localStorage with the key that VideoMetricsPlayer will look for
      localStorage.setItem('verification-data', JSON.stringify(verificationData));
      
      // Update status with success message
      setExportStatus('success');
      
      // Notify user
      toast("Timeline exported to verification mode", {
        duration: 2000,
        position: "bottom-center"
      });
      
      // Clear status after a delay
      setTimeout(() => setExportStatus(null), 2000);
    } catch (error) {
      setExportStatus('error');
      toast.error("Error exporting timeline", {
        duration: 2000,
        position: "bottom-center"
      });
      setTimeout(() => setExportStatus(null), 2000);
    }
  };
  
  // Helper function to collect voice settings from avatar instances
  const collectAvatarVoiceSettings = (): Map<string, any> => {
    const voiceSettingsMap = new Map<string, any>();
    console.log(`[AudioTimeline] Starting collection of voice settings from avatars`);
    
    // If no avatar instances are available, return empty map
    if (!avatarInstancesRef || !avatarInstancesRef.current) {
      console.warn(`[AudioTimeline] No avatarInstancesRef available`);
      return voiceSettingsMap;
    }
    
    console.log(`[AudioTimeline] Avatar instances available: ${Object.keys(avatarInstancesRef.current).length}`);
    
    // Extract voice settings from avatar instances
    audioSegments.forEach(segment => {
      // Skip if already processed this avatar
      if (voiceSettingsMap.has(segment.avatarId)) {
        return;
      }
      
      // Get avatar instance
      const instance = avatarInstancesRef.current[segment.avatarId];
      
      if (!instance) {
        console.warn(`[AudioTimeline] No instance found for avatar ${segment.avatarId} (${segment.avatarName})`);
        return;
      }
      
      // Log available properties for debugging
      console.log(`[AudioTimeline] Avatar ${segment.avatarId} (${segment.avatarName}) instance properties:`, 
        {
          hasAvatar: !!instance.avatar,
          hasOpt: !!instance.opt,
          voiceFromAvatar: instance.avatar?.ttsVoice,
          voiceFromOpt: instance.opt?.ttsVoice
        }
      );
      
      // Extract voice settings
      const voiceSettings = {
        name: instance.avatar?.ttsVoice || instance.opt?.ttsVoice || "en-US-Neural2-F",
        languageCode: instance.avatar?.ttsLang || instance.opt?.ttsLang || "en-US",
        rate: instance.avatar?.ttsRate || instance.opt?.ttsRate || 1.5,
        pitch: instance.avatar?.ttsPitch || instance.opt?.ttsPitch || 0
      };
      
      console.log(`[AudioTimeline] Extracted voice settings for ${segment.avatarName}:`, voiceSettings);
      
      voiceSettingsMap.set(segment.avatarId, voiceSettings);
    });
    
    console.log(`[AudioTimeline] Collected voice settings for ${voiceSettingsMap.size} avatars`);
    return voiceSettingsMap;
  };
  

  return (
    <div className="audio-timeline">

    </div>
  );
};

export default AudioTimeline; 