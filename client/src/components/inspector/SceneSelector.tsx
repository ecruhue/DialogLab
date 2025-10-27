import React, { useState, useEffect } from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Eye, EyeOff, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import useEditorStore, { EditorState, Scene } from "./store";
import API_CONFIG from "../../config";

interface SceneSelectorProps {
  snippetNode: any;
  onSceneChange: (scene: any | null) => void;
  onDescriptionGenerated?: () => void;
}

// Define types for party information
interface PartyMember {
  id: string;
  name: string;
  party?: string;
}

interface PartyInfo {
  parties: Array<{
    name: string;
    members: string[];
  }>;
  moderatorParty: string | null;
  turnMode: string | null;
}

const SceneSelector: React.FC<SceneSelectorProps> = ({ snippetNode, onSceneChange, onDescriptionGenerated }) => {
  const { scenes, activeSceneId, setActiveSceneId, updateNode, updateSelectedItem, updateSnippetNode } = useEditorStore() as EditorState;
  const [description, setDescription] = useState<string>("");
  const [isGeneratingDescription, setIsGeneratingDescription] = useState<boolean>(false);
  const [isEditingDescription, setIsEditingDescription] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  
  // When the scene changes, update the description
  useEffect(() => {
    if (snippetNode.description) {
      setDescription(snippetNode.description);
    } else if (snippetNode.attachedScene) {
      // Generate a description if none exists
      generateDescription();
    } else {
      setDescription("");
    }
  }, [snippetNode.attachedScene?.id]);
  
  const handleSceneChange = (sceneId: string | null) => {
    if (sceneId === null || sceneId === "none") {
      onSceneChange(null);
      setDescription("");
    } else {
      const selectedScene = scenes.find(scene => scene.id === sceneId);
      if (selectedScene) {
        onSceneChange(selectedScene);
        // Description will be generated via the effect
      } else {
        onSceneChange(null);
        setDescription("");
      }
    }
  };
  
  // Generate a description using the API
  const generateDescription = async () => {
    if (!snippetNode.attachedScene || isGeneratingDescription) return;
    
    setIsGeneratingDescription(true);
    setDescription("Generating description...");
    
    try {
      // Extract party information from the scene
      const partyInfo: PartyInfo = {
        parties: [],
        moderatorParty: null,
        turnMode: null
      };
      
      // Add party configuration if available
      if (snippetNode.attachedScene.globalPartySettings) {
        partyInfo.moderatorParty = snippetNode.attachedScene.globalPartySettings.moderatorParty;
        partyInfo.turnMode = snippetNode.attachedScene.globalPartySettings.partyTurnMode;
      }
      
      // Group speakers by party
      if (snippetNode.speakers && snippetNode.speakers.length > 0) {
        const speakersByParty: Record<string, string[]> = {};
        
        // Group speakers by their party
        snippetNode.speakers.forEach((speaker: PartyMember) => {
          if (speaker.party) {
            if (!speakersByParty[speaker.party]) {
              speakersByParty[speaker.party] = [];
            }
            speakersByParty[speaker.party].push(speaker.name);
          }
        });
        
        // Convert to array format for API
        partyInfo.parties = Object.entries(speakersByParty).map(([name, members]) => ({
          name,
          members
        }));
      }
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/generate-scene-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sceneName: snippetNode.attachedScene.name,
          speakers: snippetNode.speakers,
          partyInfo: partyInfo.parties.length > 0 ? partyInfo : undefined
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate description: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.description) {
        const newDescription = data.description;
        setDescription(newDescription);
        
        // Update the node with the generated description
        if (snippetNode.id) {
          updateNode(snippetNode.id, { description: newDescription });
          
          // Only call the callback without automatically generating a prompt
          if (onDescriptionGenerated) {
            onDescriptionGenerated();
          }
        }
      }

      //update the converation prompt
      
    } catch (error) {
      console.error('Error fetching scene description:', error);
      setDescription(`A conversation about ${snippetNode.attachedScene.name}`);
      
      // Set a fallback description
      if (snippetNode.id) {
        updateNode(snippetNode.id, { 
          description: `A conversation about ${snippetNode.attachedScene.name}` 
        });
        
        // Call the callback even with fallback description
        if (onDescriptionGenerated) {
          onDescriptionGenerated();
        }
      }
    } finally {
      setIsGeneratingDescription(false);
    }
  };
  
  // Save the description when edited
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };
  
  // Update the node when the description is saved
  const handleDescriptionSave = () => {
    if (snippetNode.id) {
      updateNode(snippetNode.id, { description });
    }
    setIsEditingDescription(false);
  };
  
  // Check if the attached scene is currently active in the scene panel
  const isSceneActive = snippetNode.attachedScene && snippetNode.attachedScene.id === activeSceneId;
  
  // Toggle the active scene in the scene panel
  const toggleSceneInPanel = () => {
    if (isSceneActive) {
      setActiveSceneId(null);
    } else if (snippetNode.attachedScene) {
      setActiveSceneId(snippetNode.attachedScene.id);
    }
  };
  
  return (
    <div className="theme-bg-secondary rounded-md border theme-border overflow-hidden mb-3">
      <div 
        className="theme-bg-panel px-3 py-1.5 border-b theme-border flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 theme-text-tertiary" />
          ) : (
            <ChevronRight className="w-4 h-4 theme-text-tertiary" />
          )}
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium theme-text-primary">Scene</h3>
            {snippetNode.attachedScene && (
              <>
                <span className="theme-text-tertiary text-xs">•</span>
                <span className="text-xs theme-text-accent font-medium">
                  {snippetNode.attachedScene.name || "Unknown"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-2 space-y-3">
          {/* Scene description section */}
          {snippetNode.attachedScene && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium theme-text-primary">Description</label>
                <div className="flex items-center gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 theme-text-tertiary hover:theme-text-accent hover:theme-bg-accent-light rounded-full transition-colors"
                    onClick={() => setIsEditingDescription(!isEditingDescription)}
                    disabled={isGeneratingDescription}
                  >
                    <Pencil size={12} />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-6 p-1 theme-text-tertiary hover:theme-text-accent hover:theme-bg-accent-light rounded transition-colors text-xs"
                    onClick={generateDescription}
                    disabled={isGeneratingDescription}
                  >
                    {isGeneratingDescription ? "Generating..." : "Regenerate"}
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Textarea
                  value={description}
                  placeholder="Scene description will appear here..."
                  onChange={handleDescriptionChange}
                  onBlur={handleDescriptionSave}
                  className="w-full p-1.5 theme-bg-input theme-border theme-text-primary resize-y min-h-[60px] text-xs"
                  readOnly={!isEditingDescription}
                  rows={3}
                />
                {isGeneratingDescription && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-md">
                    <div className="w-4 h-4 border-2 theme-border-accent border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SceneSelector;