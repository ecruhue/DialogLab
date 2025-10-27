import { useEffect, useState } from "react";
import VideoMetricsPlayer from "./AudioTranscript";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { AudioSegment } from "../nodeeditor/utils/NodeEditorUtils";
import { Button } from "../ui/button"; 
import { BarChart2, ChevronRight, Clock, MessageSquare, Users, Trash2, CheckCircle2, Loader2 } from "lucide-react";
import API_CONFIG from "@/config";

// Define expected data structure for the verification player
export interface VerificationData {
  title: string;
  duration: number;
  participants: {
    id: string;
    name: string;
    color: string;
  }[];
  metrics: {
    participationTime: Record<string, number>;
    turnTakingFrequency: Record<string, number>;
    speakingBalance: number;
    sentiment: Record<string, number>;
    overallSentiment: number;
    coherenceScore: number;
    interruptions: Record<string, number>;
    engagementLevel: Record<string, number>;
  };
  segments?: AudioSegment[]; // Optional raw segments data
  nodeId?: string; // Optional nodeId for reference
}

// Helper function to get all verification data from localStorage
const getAllVerificationData = (): VerificationData[] => {
  const verificationDataEntries: VerificationData[] = [];
  let parsedPlayedNodes: {nodeId: string, nodeTitle: string}[] = [];

  // Try to get the played nodes order from localStorage
  try {
    const playedNodes = localStorage.getItem('played-nodes');
    if (playedNodes) {
      parsedPlayedNodes = JSON.parse(playedNodes);
      console.log("Found played-nodes order:", parsedPlayedNodes);
      
      // Directly get verification data for each played node ID in order
      for (const {nodeId, nodeTitle} of parsedPlayedNodes) {
        const key = `verification-data-${nodeId}`;
        const savedData = localStorage.getItem(key);

        if (savedData) {
          try {
            const parsedData = JSON.parse(savedData);
            parsedData.title = `Conversation ${nodeTitle}`;
            parsedData.nodeId = nodeId;
            verificationDataEntries.push(parsedData);
          } catch (err) {
            console.error(`Error parsing verification data for ${nodeId}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error("Error parsing played-nodes from localStorage:", err);
  }

  return verificationDataEntries;
};

// Format time helper
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

export default function VerificationPlayer() {
  const [verificationData, setVerificationData] = useState<VerificationData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteSuccessMap, setDeleteSuccessMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const allVerificationData = getAllVerificationData();
      if (allVerificationData.length > 0) {
        setVerificationData(allVerificationData);
      } else {
        setError("No verification data found. Please export a conversation first.");
      }
    } catch (err) {
      console.error("Error loading verification data:", err);
      setError("Failed to load verification data. The data may be corrupted.");
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-1 max-w-full h-[calc(100vh-4rem)] overflow-y-auto">
        <Card className="w-full">
          <CardContent className="py-4">
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || verificationData.length === 0) {
    return (
      <div className="container mx-auto px-1 max-w-full h-[calc(100vh-4rem)] overflow-y-auto">
        <Card className="w-full">
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-medium mb-2">No Verification Data</h3>
              <p className="text-base text-gray-500 max-w-md">
                {error || "Please export a conversation first to view verification data."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no valid selection or out of bounds, set to first item
  if (selectedIndex >= verificationData.length) {
    setSelectedIndex(0);
  }

  const selectedData = verificationData[selectedIndex];

  const handleDeleteAudioFiles = async () => {
    if (!selectedData?.segments || !selectedData.nodeId) return;

    const nodeId = selectedData.nodeId;
    setDeleting(true);
    setDeleteSuccessMap(prev => ({ ...prev, [nodeId]: false }));

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/delete-audio-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ segments: selectedData.segments }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Deleted files:', result.deletedFiles);
        if (result.errors) {
          console.warn('Some files could not be deleted:', result.errors);
        }
        setDeleteSuccessMap(prev => ({ ...prev, [nodeId]: true }));
        // Refresh the verification data to reflect the changes
        const storedData = localStorage.getItem('verificationData');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          setVerificationData(parsedData);
        }
      } else {
        console.error('Failed to delete audio files:', result.error);
      }
    } catch (error) {
      console.error('Error deleting audio files:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container mx-auto px-1 max-w-full h-[calc(100vh-4rem)] overflow-y-auto">
      {verificationData.length > 1 && showSelector && (
        <Card className="border-primary/20">
          <CardHeader className="py-0.5 px-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Available Conversations ({verificationData.length})</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSelector(false)}
                className="h-7 px-2"
              >
                Hide Selector
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-1 px-2">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {verificationData.map((data, index) => {
                return (
                <div 
                  key={`data-${index}`}
                  className={`border rounded-lg p-1.5 cursor-pointer transition-all ${
                    selectedIndex === index 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{data.title}</h3>
                      <div className="flex items-center text-xs text-gray-600 space-x-2">
                        <div className="flex items-center gap-0.5">
                          <Clock className="w-4 h-4" />
                          <span>{formatTime(data.duration)}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Users className="w-4 h-4" />
                          <span>{data.participants.length}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <MessageSquare className="w-4 h-4" />
                          <span>{data.segments?.length || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {selectedIndex === index && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAudioFiles();
                          }}
                          disabled={!selectedData?.segments?.length || deleting}
                          className="h-7 px-2 text-sm"
                        >
                          {deleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : data.nodeId && deleteSuccessMap[data.nodeId] ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </CardContent>
        </Card>
      )}

      {!showSelector && verificationData.length > 1 && (
        <div className="mb-2 flex justify-between items-center text-sm">
          <div className="font-medium">
            Viewing: {selectedData.title}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowSelector(true)}
            className="h-7 px-2 py-0 text-sm"
          >
            Show All Conversations ({verificationData.length})
          </Button>
        </div>
      )}

      <VideoMetricsPlayer 
        videoBlobs={[selectedData]}
      />
    </div>
  );
} 