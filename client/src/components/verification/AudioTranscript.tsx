import React, { useState, useRef, useEffect, createContext } from "react"
import { createPortal } from "react-dom"
import {
  BarChart2,
  Users,
  MessageSquare,
  Send,
  RotateCcw,
  MessageCircle,
  Pause,
  Play,
  Loader2,
  HelpCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import {
  formatTime,
  getParticipant as getParticipantUtil,
  getSegmentStyle as getSegmentStyleUtil,
  getSegmentEmojis,
  playSegmentAudio as playSegmentAudioUtil,
  EMOJI_INTERRUPTION,
  EMOJI_QUESTION,
  detectEmotion,
  EMOJI_IMPROMPTU_START,
  EMOJI_SYSTEM,
} from "./verificationUtils"
import { toast } from "react-hot-toast"
import ConversationMetricsDashboard from './ConversationMetricsDashboard'
import { AudioSegment } from "../nodeeditor/utils/NodeEditorUtils"
import { VerificationData } from "./VerificationPlayer"
import { Textarea } from "../ui/textarea"
import API_CONFIG from "@/config"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"

// Helper function to safely get properties from segment or segment.message
const getProp = (segment: any, propName: string): any => {
  if (segment[propName] !== undefined) {
    return segment[propName];
  }
  if (segment.message && propName in segment.message) {
    return segment.message[propName];
  }
  return undefined;
};

// Simple Avatar implementation
const Avatar = ({ className, style, children }: { className?: string, style?: React.CSSProperties, children?: React.ReactNode }) => (
  <div className={`relative flex items-center justify-center rounded-full overflow-hidden ${className || ''}`} style={style}>
    {children}
  </div>
);

const AvatarFallback = ({ children }: { children?: React.ReactNode }) => (
  <div className="flex h-full w-full items-center justify-center text-center font-medium">
    {children}
  </div>
);

// Create context for video metrics data sharing
interface VideoMetricsContextType {
  videoBlobs: VerificationData[];
  currentVideoIndex: number;
  segmentsWithVerificationPoints: any[];
  setSegmentsWithVerificationPoints: (segments: any[]) => void;
}

// Create the context with default values
const VideoMetricsContext = createContext<VideoMetricsContextType>({
  videoBlobs: [],
  currentVideoIndex: 0,
  segmentsWithVerificationPoints: [],
  setSegmentsWithVerificationPoints: () => {}
});

// Extract reusable components
const TimelineLegend = () => (
  <div className="p-2 mb-2 border rounded-lg text-sm">
    <h3 className="font-medium mb-1">Timeline Indicators</h3>
    <div className="grid grid-cols-4 gap-2">
      {[
        { emoji: EMOJI_QUESTION, label: "Question" },
        { emoji: EMOJI_INTERRUPTION, label: "Interruption" },
        { emoji: EMOJI_IMPROMPTU_START, label: "Impromptu" },
        { emoji: EMOJI_SYSTEM, label: "System" }
      ].map(({ emoji, label }) => (
        <div key={label} className="flex items-center gap-1">
          <span>{emoji}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  </div>
);

const AudioControls = ({ 
  currentTime, 
  duration 
}: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}) => (
  <div className="flex items-center justify-between text-sm mt-1">
    <div className="flex items-center gap-1">
      <span className="text-sm font-medium">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  </div>
);

const SegmentTooltip = ({ segment }: { segment: any }) => (
  <div className="hidden group-hover:block absolute bg-black/90 text-white text-sm rounded py-1 px-2 w-56 shadow-lg z-20 bottom-full left-1/2 transform -translate-x-1/2 mb-1 pointer-events-none border border-white/10">
    <div className="font-bold mb-1 flex items-center justify-between">
      <span>{segment.avatarName}</span>
      <span className="text-sm opacity-80">{formatTime(segment.start)}</span>
    </div>
    <div className="flex flex-wrap gap-1 mb-1">
      <span className="px-1 text-[10px] bg-gray-600/70 rounded">
        {getSegmentEmojis(segment)}
      </span>
    </div>
    <p className="leading-relaxed text-opacity-90 line-clamp-3 text-sm">
      {segment.message?.message}
    </p>
  </div>
);

const BackchannelIndicator = ({ 
  backchannel, 
  senderIdx,
  position = 'top' // Add position prop with default value 'top'
}: { 
  backchannel: any; 
  senderIdx: number;
  position?: 'top' | 'left';
}) => {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const vibeColor = backchannel.vibe === 'positive' ? 'rgba(34, 197, 94, 0.2)' :
                   backchannel.vibe === 'negative' ? 'rgba(239, 68, 68, 0.2)' :
                   'rgba(59, 130, 246, 0.2)';

  const updateTooltipPosition = () => {
    if (indicatorRef.current) {
      const rect = indicatorRef.current.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current?.offsetHeight || 0;
      const tooltipWidth = tooltipRef.current?.offsetWidth || 0;
      
      if (position === 'left') {
        setTooltipPosition({
          top: rect.top + (rect.height / 2) - (tooltipHeight / 2), // Center vertically
          left: rect.left - tooltipWidth - 12 // Position to the left with 12px gap
        });
      } else {
        setTooltipPosition({
          top: rect.top - tooltipHeight - 12,
          left: rect.left + (rect.width / 2)
        });
      }
    }
  };

  useEffect(() => {
    let rafId: number;
    
    const updatePosition = () => {
      updateTooltipPosition();
      rafId = requestAnimationFrame(updatePosition);
    };

    if (showTooltip) {
      rafId = requestAnimationFrame(updatePosition);
      window.addEventListener('scroll', updateTooltipPosition);
      window.addEventListener('resize', updateTooltipPosition);
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('scroll', updateTooltipPosition);
      window.removeEventListener('resize', updateTooltipPosition);
    };
  }, [showTooltip, position]);

  return (
    <>
      <div 
        ref={indicatorRef}
        className="relative group cursor-help"
        style={{ marginRight: senderIdx === 0 ? '-8px' : '-4px', marginBottom: '-8px' }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span 
          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-lg shadow-md border border-[rgba(255,255,255,0.1)]"
          style={{ backgroundColor: vibeColor }}
        >
          {backchannel.emoji}
        </span>
      </div>

      {showTooltip && createPortal(
        <div 
          ref={tooltipRef}
          className="fixed z-50 transition-opacity duration-200"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: position === 'top' ? 'translateX(-50%)' : 'none',
            opacity: showTooltip ? 1 : 0,
            pointerEvents: 'none'
          }}
        >
          <div className="bg-black text-white text-sm rounded p-1.5 min-w-[120px] max-w-[200px] shadow-lg">
            <div className="font-bold">{backchannel.sender}</div>
            <div className="text-sm text-gray-300 italic">{backchannel.message}</div>
            {backchannel.vibe && (
              <div className="text-sm mt-1 px-1.5 py-0.5 rounded bg-gray-700">
                Vibe: {backchannel.vibe}
              </div>
            )}
          </div>
          <div 
            className={`w-2 h-2 bg-black transform rotate-45 absolute ${
              position === 'left' 
                ? '-right-1 top-1/2 -translate-y-1/2' 
                : '-bottom-1 left-1/2 -translate-x-1/2'
            }`}
          />
        </div>,
        document.body
      )}
    </>
  );
};

const TranscriptSegment = ({ 
  segment, 
  activeSegment, 
  onPlaySegment, 
  getParticipant 
}: { 
  segment: AudioSegment; 
  activeSegment: any; 
  onPlaySegment: (segment: any) => void; 
  getParticipant: (id: string) => any; 
}) => {
  const participant = getParticipant(segment.avatarId);
  const participantColor = participant?.color || '#6b7280';

  const formatSystemMessage = (text: string) => {
    if (getProp(segment, 'isSystemMessage')) {
      if (text.includes("raised their hand")) {
        return text.replace(/has raised their hand|raised their hand/, `✋ raised hand`);
      }
      if (text.includes("approved") && text.includes("to speak")) {
        return text.replace(/has been approved|was approved/, `✓ approved`);
      }
      if (text.includes("started an impromptu discussion phase")) {
        const mode = getProp(segment, 'derailMode') || (text.includes("different topic") ? "drift" : "extend");
        const modeIcon = mode === "drift" ? "🔄" : "🔍";
        const modeText = mode === "drift" ? "TOPIC SHIFT" : "NEW PERSPECTIVE";
        return `${modeIcon}  ★ ${text.replace(/has started an impromptu discussion phase/, `STARTED IMPROMPTU PHASE (${modeText})`)} ★`;
      }
      if (text.includes("The impromptu discussion phase has ended")) {
        return `✓  ★ ${text.replace(/The impromptu discussion phase has ended. Returning to the regular conversation./, 'IMPROMPTU PHASE ENDED')} ★`;
      }
    }
    return text;
  };

  const getSegmentClassName = () => {
    const baseClasses = "relative p-3 rounded-md cursor-pointer text-base shadow-sm";
    const typeClasses = getProp(segment, 'isSystemMessage')
      ? 'bg-gray-100 text-gray-700 border border-gray-300'
      : getProp(segment, 'isBackchannel')
        ? 'bg-green-50 border border-green-200 text-gray-600 italic'
        : getProp(segment, 'isHuman')
          ? 'border-2 border-blue-300 bg-blue-50 text-gray-800'
          : getProp(segment, 'isDerailing')
            ? 'border border-pink-300 bg-pink-50 text-gray-800'
            : 'bg-gray-50 border border-gray-200 text-gray-700';

    const phaseClasses = getProp(segment, 'derailMode') === 'drift' ? 'impromptu-phase-drift' : 
                        getProp(segment, 'derailMode') === 'extend' ? 'impromptu-phase-extend' : 
                        getProp(segment, 'isSystemMessage') ? 'impromptu-phase-system-message' : '';

    const activeClass = activeSegment === segment ? "ring-2 ring-primary ring-offset-1" : "";

    // Add pink hint for impromptu phase messages
    const impromptuClass = segment.message?.impromptuPhase ? 'bg-pink-50/50 border-pink-200/50' : '';

    return `${baseClasses} ${typeClasses} ${phaseClasses} ${activeClass} ${impromptuClass}`;
  };

  return (
    <div className="flex my-2">
      <div className={`max-w-full w-full transcript-message ${
        getProp(segment, 'isHuman') ? 'transcript-message-human' : 
        getProp(segment, 'isDerailing') ? 'transcript-message-derailer' : ''
      }`}>
        {segment.avatarName && !getProp(segment, 'isBackchannel') && !getProp(segment, 'isSystemMessage') && (
          <div className="flex items-center mb-0.5">
            <div 
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium shadow-sm ${
                getProp(segment, 'isHuman') ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-400' : 
                getProp(segment, 'isDerailing') ? 'bg-pink-100 text-pink-800 ring-1 ring-pink-400' :
                'border border-opacity-40'
              }`}
              style={!getProp(segment, 'isHuman') && !getProp(segment, 'isDerailing') ? {
                backgroundColor: `${participantColor}20`,
                color: participantColor,
                borderColor: participantColor
              } : {}}
            >
              {getProp(segment, 'isHuman') && (
                <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full mr-1"></span>
              )}
              {getProp(segment, 'isDerailing') && (
                <span className="inline-block w-1.5 h-1.5 bg-pink-500 rounded-full mr-1 animate-pulse"></span>
              )}
              {segment.avatarName}
              {getProp(segment, 'isHuman') && (
                <span className="ml-1 text-[10px] bg-blue-700 text-white px-1 rounded">
                  HUMAN
                </span>
              )}
              {getProp(segment, 'isDerailing') && (
                <span className="ml-1 text-[10px] bg-pink-700 text-white px-1 rounded">
                  {getProp(segment, 'derailMode') === 'drift' ? 'TOPIC SHIFT' : 'PERSPECTIVE SHIFT'}
                </span>
              )}
            </div>
            <div className="ml-2 text-sm">
              {getSegmentEmojis(segment)}
            </div>
          </div>
        )}
        
        <div 
          className={getSegmentClassName()}
          onClick={() => onPlaySegment(segment)}
        >
          {!getProp(segment, 'isBackchannel') && !getProp(segment, 'isSystemMessage') && (
            getProp(segment, 'isHuman') ? (
              <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-1.5 bg-blue-500 h-[80%] rounded shadow-sm"/>
            ) : getProp(segment, 'isDerailing') ? (
              <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1.5 bg-pink-500 h-[90%] rounded animate-pulse shadow-sm"/>
            ) : (
              <div 
                className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-[80%] rounded opacity-70 shadow-sm"
                style={{ backgroundColor: participantColor }}
              />
            )
          )}
          
          <div className={`whitespace-pre-wrap break-words ${
            getProp(segment, 'isSystemMessage') ? 'text-sm italic opacity-80' : 
            getProp(segment, 'isBackchannel') ? 'italic text-sm' : 
            'text-sm'
          } pl-2 leading-relaxed`}>
            {getProp(segment, 'isSystemMessage') ? formatSystemMessage(segment.message?.message || '') : segment.message?.message}
          </div>
          
          {segment.message?.backchannels && segment.message.backchannels.length > 0 && (
            <div className="absolute bottom-0 right-0 flex flex-row-reverse">
              {Array.from(new Set(segment.message.backchannels.map(b => b.sender))).map((sender, senderIdx) => {
                const backchannel = segment.message?.backchannels!.find(b => b.sender === sender);
                if (!backchannel) return null;
                return <BackchannelIndicator key={`${sender}-${segment.start}-${senderIdx}`} backchannel={backchannel} senderIdx={senderIdx} position="left" />;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ActiveSegmentDisplay = ({ 
  activeSegment, 
  getParticipant,
  isPlaying,
  onPause,
  onPlay
}: { 
  activeSegment: any; 
  getParticipant: (id: string) => any;
  isPlaying: boolean;
  onPause: () => void;
  onPlay: (segment: any) => void;
}) => {
  if (!activeSegment) return null;

  const getSegmentClassName = () => {
    const baseClasses = "mb-2 p-2 border rounded-lg"; 
    const pulseClass = isPlaying ? "animate-pulse" : "";
    return `${baseClasses} ${pulseClass} ${
      getProp(activeSegment, 'isSystemMessage') ? "bg-blue-50/50 border-blue-200" : 
      getProp(activeSegment, 'isBackchannel') ? "bg-green-50/50 border-green-200" : 
      getProp(activeSegment, 'isDerailing') ? "bg-pink-50/50 border-pink-200" : 
      getProp(activeSegment, 'isHuman') ? "bg-indigo-50/50 border-indigo-200" : 
      "bg-muted/10"
    }`;
  };

  return (
    <div className={getSegmentClassName()}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Avatar
            className="h-6 w-6 border"
            style={{ borderColor: getParticipant(activeSegment.avatarId)?.color }}
          >
            <AvatarFallback>{activeSegment.avatarName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold text-base flex items-center">
              {activeSegment.avatarName}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  isPlaying ? onPause() : onPlay(activeSegment);
                }}
                className="ml-2 h-6 w-6 p-0 text-primary hover:bg-primary/10"
              >
                {isPlaying ? 
                  <Pause className="h-3.5 w-3.5" /> : 
                  <Play className="h-3.5 w-3.5" />
                }
              </button>
            </div>
            <div className="text-sm text-muted-foreground">
              {formatTime(activeSegment.start)} - {formatTime(activeSegment.start + activeSegment.duration)}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-0.5">
          {getProp(activeSegment, 'isSystemMessage') && (
            <span className="px-1 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded-full">System</span>
          )}
          {getProp(activeSegment, 'isBackchannel') && (
            <span className="px-1 py-0.5 text-[10px] bg-green-100 text-green-800 rounded-full">Backchannel</span>
          )}
          {getProp(activeSegment, 'isInterruption') && (
            <span className="px-1 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded-full">Interruption</span>
          )}
          {getProp(activeSegment, 'isDerailing') && (
            <span className="px-1 py-0.5 text-[10px] bg-rose-100 text-rose-800 rounded-full">
              {getProp(activeSegment, 'derailMode') === 'drift' ? 'Topic Shift' : 'New Perspective'}
            </span>
          )}
          {getProp(activeSegment, 'isHuman') && (
            <span className="px-1 py-0.5 text-[10px] bg-indigo-100 text-indigo-800 rounded-full">Human</span>
          )}
        </div>
      </div>
      
      {!activeSegment.emotion && activeSegment.message?.message && (() => {
        activeSegment.emotion = detectEmotion(activeSegment.message.message);
        return null;
      })()}
      
      <div className="relative">
        <p className={`text-base ${activeSegment.emotion ? "pl-4" : ""}`}>{activeSegment.message?.message}</p>
        
        {activeSegment.emotion && (
          <div className="mt-1 text-sm text-muted-foreground">
            Detected emotion: <span className="font-medium capitalize">{activeSegment.emotion}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// For timestamp display in responses
const getTimeAgo = (timestamp: number) => {
  const now = Date.now();
  const diff = Math.floor((now - timestamp) / 1000); // diff in seconds
  
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

// Agent Questions Panel Component
const AgentQuestionsPanel = ({ verificationData }: { verificationData: VerificationData }) => {
  const [question, setQuestion] = useState("")
  const [answers, setAnswers] = useState<Array<{text: string, timestamp: number, question: string}>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const askQuestion = async () => {
    if (!question.trim()) {
      toast.error("Please enter a question")
      return
    }

    setLoading(true)
    setError("")
    
    try {
      const provider = localStorage.getItem('LLM_PROVIDER') || 'gemini'
      const key = provider === 'openai' ? localStorage.getItem('OPENAI_API_KEY') : localStorage.getItem('GEMINI_API_KEY')
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VERIFICATION_ASK_AGENT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-llm-provider': provider,
          'x-llm-key': key || ''
        },
        body: JSON.stringify({
          question,
          verificationData,
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setAnswers([
          { 
            text: data.answer, 
            timestamp: Date.now(), 
            question: question
          },
          ...answers
        ])
        setQuestion("") // Clear the question after successful submission
      } else {
        setError(data.error || "Failed to get an answer")
        toast.error("Failed to get an answer")
      }
    } catch (error) {
      console.error("Error asking question:", error)
      setError("An error occurred while trying to get an answer")
      toast.error("An error occurred while trying to get an answer")
    } finally {
      setLoading(false)
    }
  }

  const clearConversation = () => {
    setQuestion("")
    setAnswers([])
    setError("")
  }

  return (
    <div className="flex h-full">
      {/* Question Input Column - Fixed */}
      <div className="flex flex-col h-full w-[280px] flex-shrink-0 mr-6">
        <h3 className="text-sm font-medium flex items-center mb-3">
          <MessageCircle className="h-4 w-4 mr-2" />
          Ask a Question
        </h3>
        <div className="flex flex-col h-[calc(100%-2rem)]">
          <div className="flex-grow">
            <Textarea
              placeholder="Ask about turn-taking patterns, sentiment analysis, topic coherence, etc."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="h-full w-full text-sm p-4 rounded-lg border border-gray-200 shadow-sm resize-none"
              disabled={loading}
            />
          </div>
          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={clearConversation}
              disabled={loading}
              className="text-sm h-9 px-4"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button
              onClick={askQuestion}
              disabled={loading || !question.trim()}
              className="text-sm h-9 px-4"
              size="sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Ask AI
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Response Column - Scrollable */}
      <div className="flex flex-col h-full flex-grow">
        <h3 className="text-sm font-medium flex items-center mb-3">
          <MessageSquare className="h-4 w-4 mr-2" />
          AI Responses
        </h3>
        <div className="overflow-y-auto border rounded-lg p-1 bg-gray-50/50 h-[calc(100%-2rem)] flex-grow">
          {answers.length > 0 ? (
            <div className="space-y-4">
              {answers.map((answer, index) => (
                <div key={index} className="p-3">
                  {/* Question display with different styling */}
                  <div className="bg-gray-100 rounded-lg p-2 mb-2 border-l-4 border-primary shadow-sm">
                    <div className="flex items-center mb-1">
                      <MessageCircle className="h-3 w-3 mr-1 text-primary" />
                      <span className="text-sm font-medium text-primary">Your Question</span>
                    </div>
                    <p className="text-sm font-medium">{answer.question}</p>
                  </div>
                  
                  {/* Answer display */}
                  <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                    <div className="text-sm text-gray-500 mb-2 flex items-center justify-between">
                      <div className="flex items-center">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        <span className="font-medium">AI Response</span>
                      </div>
                      <span>{getTimeAgo(answer.timestamp)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{answer.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center text-gray-500 py-4">
              {error ? (
                <span className="text-red-500">{error}</span>
              ) : (
                <span className="text-sm">Ask a question about the conversation to get insights from an AI agent</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VideoMetricsPlayer({
  videoBlobs,
}: {
  videoBlobs: VerificationData[]
}) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number | null>(null)
  const [activeSegment, setActiveSegment] = useState<any | null>(null)
  const [segmentsWithVerificationPoints, setSegmentsWithVerificationPoints] = useState<any[]>([]);
  const [showQuestions, setShowQuestions] = useState(false)
  const [rerunsAvailable, setRerunsAvailable] = useState(10)
  const [isRerunning, setIsRerunning] = useState(false)

  // Add audio playback state and refs
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Create a context value object
  const contextValue = {
    videoBlobs,
    currentVideoIndex,
    segmentsWithVerificationPoints,
    setSegmentsWithVerificationPoints
  };
  
  const currentVideo = videoBlobs[currentVideoIndex]

  // Load reruns available from localStorage on component mount
  useEffect(() => {
    if (currentVideo?.nodeId) {
      const storageKey = `rerun-count-${currentVideo.nodeId}`;
      const savedCount = localStorage.getItem(storageKey);
      if (savedCount !== null) {
        setRerunsAvailable(parseInt(savedCount, 10));
      } else {
        // Initialize with default value if not found
        localStorage.setItem(storageKey, "3");
      }
    }
  }, [currentVideo?.nodeId]);

  // Save reruns available to localStorage when it changes
  useEffect(() => {
    if (currentVideo?.nodeId) {
      const storageKey = `rerun-count-${currentVideo.nodeId}`;
      localStorage.setItem(storageKey, rerunsAvailable.toString());
    }
  }, [rerunsAvailable, currentVideo?.nodeId]);

  // Find the active segment based on current time
  useEffect(() => {
    if (currentVideo.segments) {
      const segment = currentVideo.segments.find(
        (seg) => currentTime >= seg.start && currentTime < seg.start + seg.duration,
      )
      setActiveSegment(segment || null)
    }
  }, [currentTime, currentVideo.segments])

  // Handle playback animation
  useEffect(() => {
    if (isPlaying) {
      // Use requestAnimationFrame for smoother playback when no video
      const startTime = Date.now() - currentTime * 1000;

      const updateTime = () => {
        const newTime = (Date.now() - startTime) / 1000;
        if (newTime < currentVideo.duration) {
          setCurrentTime(newTime);
          animationRef.current = requestAnimationFrame(updateTime);
        } else {
          setCurrentTime(currentVideo.duration);
          setIsPlaying(false); // Stop playing at the end
        }
      };

      animationRef.current = requestAnimationFrame(updateTime);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, currentVideo.duration]);

  // Function to handle pausing the audio
  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  };

  // Handle seeking
  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    handlePause(); // Pause audio on seek
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const clickPosition = (e.clientX - rect.left) / rect.width;
      const newTime = clickPosition * currentVideo.duration;
      setCurrentTime(Math.max(0, Math.min(newTime, currentVideo.duration)));
      handlePause(); // Pause audio on timeline click
    }
  };

  // Wrapper for the utility function to play audio
  const playSegmentAudio = (segment: any) => {
    handlePause(); // Stop any currently playing audio first
    
    // Detect emotion if not already set
    if (!segment.emotion && segment.message?.message) {
      segment.emotion = detectEmotion(segment.message.message);
    }
    
    playSegmentAudioUtil(
      segment,
      audioRef,
      { setCurrentTime, setIsPlaying }
    );
  };

  // Get participant by ID - wrapper for the utility function
  const getParticipant = (id: string) => {
    return getParticipantUtil(currentVideo.participants, id);
  };

  // Calculate percentage for timeline visualization - wrapper for the utility function
  const getSegmentStyle = (segment: any) => {
    const participant = getParticipant(segment.avatarId);
    return getSegmentStyleUtil(segment, currentVideo.duration, participant?.color);
  };

  // Get color for message type
  const getSegmentTypeColor = (segment: any) => {
    if (getProp(segment, 'isSystemMessage')) return "bg-blue-400/80";
    if (getProp(segment, 'isBackchannel')) return "bg-green-400/80";
    if (getProp(segment, 'isDerailing')) return "bg-pink-400/80";
    if (getProp(segment, 'isHuman')) return "bg-indigo-400/80";
    if (getProp(segment, 'isProactive')) return "bg-amber-400/80";
    if (getProp(segment, 'isInterruption')) return "bg-orange-400/80";
    
    // Default color based on speaker
    const participant = getParticipant(segment.avatarId);
    if (participant?.color) {
      return "bg-opacity-80";
    }
    return "bg-gray-400/80";
  };

  // Get current progress percentage
  const progressPercentage = (currentTime / currentVideo.duration) * 100;

  // Add debug logging for segments
  useEffect(() => {
    if (currentVideo?.segments) {
      console.log('Current video segments:', currentVideo.segments);
    }
  }, [currentVideo]);

  // Function to handle rerunning analytics
  const handleRerunAnalytics = () => {
    if (rerunsAvailable <= 0) {
      toast.error("No reruns available");
      return;
    }
    
    setIsRerunning(true);
    
    // Simulate rerunning analytics - typically you would call an API here
    setTimeout(() => {
      setRerunsAvailable(prev => prev - 1);
      setIsRerunning(false);
      toast.success("Analytics rerun complete!");
    }, 1500);
  };

  return (
    <VideoMetricsContext.Provider value={contextValue}>
      <Card className="border-0 shadow-none">
        <CardHeader className="px-2 py-1">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl font-bold">{currentVideo.title}</CardTitle>
              <CardDescription className="text-sm">
                Duration: {formatTime(currentVideo.duration)} • {currentVideo.participants.length} participants
              </CardDescription>
            </div>
            <Badge variant="outline" className="flex items-center gap-1 text-sm">
              <Users className="h-4 w-4" /> {currentVideo.participants.length} Speakers
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-1">
          <div className="grid grid-cols-12 gap-4">
            {/* Left Column - Timeline Indicators */}
            <div className="col-span-6">
              <TimelineLegend />

              {/* Audio Player Controls */}
              <div className="mb-2">
                {currentVideo.segments && currentVideo.segments.length > 0 && (
                  <div
                    ref={timelineRef}
                    className="relative h-14 bg-muted/30 rounded-md mb-1 cursor-pointer overflow-hidden"
                    onClick={handleTimelineClick}
                  >
                    {/* Timeline segments */}
                    {currentVideo.segments.map((segment, idx) => (
                      <div
                        key={`${segment.avatarId}-${segment.start}-${idx}`}
                        className={`absolute h-full rounded-sm ${getSegmentTypeColor(segment)} hover:opacity-100 group transition-all hover:z-10`}
                        style={getSegmentStyle(segment)}
                        onClick={(e) => {
                          e.stopPropagation();
                          playSegmentAudio(segment);
                        }}
                      >
                        <div className="h-full w-full relative">
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-bold text-sm">
                            {getSegmentEmojis(segment)}
                          </div>
                          
                          {segment.message?.backchannels && segment.message.backchannels.length > 0 && (
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex items-center gap-0.5">
                              {Array.from(new Set(segment.message.backchannels.map(b => b.sender))).map((sender, senderIdx) => {
                                const backchannel = segment.message?.backchannels!.find(b => b.sender === sender);
                                if (!backchannel) return null;
                                return <BackchannelIndicator 
                                  key={`${sender}-${segment.start}-${senderIdx}`} 
                                  backchannel={backchannel} 
                                  senderIdx={senderIdx} 
                                  position="top" 
                                />;
                              })}
                            </div>
                          )}
                          
                          <SegmentTooltip segment={segment} />
                        </div>
                      </div>
                    ))}

                    <div 
                      className="absolute h-full w-0.5 bg-primary z-10" 
                      style={{ left: `${progressPercentage}%` }}
                    />

                    <div className="absolute left-1 top-0.5 flex gap-1">
                      {currentVideo.participants.map((participant) => (
                        <div key={participant.id} className="flex items-center gap-0.5">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: participant.color }}
                          />
                          <span className="text-sm font-medium">{participant.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <AudioControls
                  isPlaying={isPlaying}
                  currentTime={currentTime}
                  duration={currentVideo.duration}
                />
              </div>

              {/* Active Segment - Current Message */}
              <ActiveSegmentDisplay 
                activeSegment={activeSegment} 
                getParticipant={getParticipant} 
                isPlaying={isPlaying} 
                onPause={handlePause} 
                onPlay={playSegmentAudio}
              />
            </div>

            {/* Right Column - Transcript or Questions with tabs */}
            <div className="col-span-6 pl-4">
              <div className="flex justify-between mb-4">
                <div className="flex shadow-sm rounded-md overflow-hidden">
                  <Button 
                    variant={showQuestions ? "default" : "outline"} 
                    className="rounded-r-none px-5 py-2 h-10 text-sm font-medium"
                    onClick={() => setShowQuestions(true)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Questions
                  </Button>
                  <Button 
                    variant={!showQuestions ? "default" : "outline"} 
                    className="rounded-l-none px-5 py-2 h-10 text-sm font-medium"
                    onClick={() => setShowQuestions(false)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Transcript
                  </Button>
                </div>
              </div>

              <div className="h-[300px] min-h-[300px] border rounded-lg overflow-y-auto pr-2">
                  {showQuestions ? (
                    <AgentQuestionsPanel verificationData={currentVideo} />
                  ) : (
                  <div className="h-full space-y-2 p-4 bg-gray-50/50">
                    {!currentVideo?.segments?.length ? (
                      <div className="text-center text-gray-500 py-4">
                        No transcript segments available
                      </div>
                    ) : (
                      currentVideo.segments.map((segment: AudioSegment, idx: number) => (
                        <TranscriptSegment
                          key={`${segment.avatarId}-${segment.start}-${idx}`}
                          segment={segment}
                          activeSegment={activeSegment}
                          onPlaySegment={playSegmentAudio}
                          getParticipant={getParticipant}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Section */}
          <div className="mt-4">
            <div className="flex items-center mb-2">
              <h2 className="text-lg font-bold flex items-center">
                <BarChart2 className="h-5 w-5 mr-2" />
                Conversation Analytics
              </h2>
              <div className="flex items-center ml-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-1 text-xs"
                  onClick={handleRerunAnalytics}
                  disabled={rerunsAvailable <= 0 || isRerunning}
                >
                  {isRerunning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Rerun Analytics
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {rerunsAvailable} left
                  </Badge>
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Rerunning analytics may improve metrics accuracy or detect additional patterns. Limited to {rerunsAvailable} reruns per conversation.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            
            <ConversationMetricsDashboard data={currentVideo} />
          </div>
        </CardContent>
      </Card>
    </VideoMetricsContext.Provider>
  )
}