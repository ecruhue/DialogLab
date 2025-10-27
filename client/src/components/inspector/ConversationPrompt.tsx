import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, Edit, Save, X, HelpCircle } from "lucide-react";
import API_CONFIG from "../../config";
import useEditorStore, { AvatarConfig, EditorState, SnippetNode } from "./store";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConversationPromptProps {
  generalContext: string;
  sceneDescription: string;
  subTopic: string;
  speakers: AvatarConfig[];
  interactionPattern: string;
  nodeId?: string;
  initialPrompt?: string;
  forceRegenerate?: boolean;
  onRegenerated?: () => void;
}

// Tooltip Icon component
export const TooltipIcon = ({ text }: { text: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle size={14} className="text-gray-400 hover:text-gray-500 cursor-help ml-1" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const ConversationPrompt: React.FC<ConversationPromptProps> = ({
  generalContext,
  sceneDescription,
  subTopic,
  speakers,
  interactionPattern,
  nodeId,
  initialPrompt = "",
  forceRegenerate = false,
  onRegenerated
}) => {
  const { updateSnippetNode, nodes } = useEditorStore() as EditorState;
  const [prompt, setPrompt] = useState<string>(initialPrompt);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedPrompt, setEditedPrompt] = useState<string>(initialPrompt);
  
  // Initialize with existing prompt from the node - only runs once per node
  useEffect(() => {
    if (!hasInitialized) {
      if (nodeId) {
        const node = nodes.find(n => n.id === nodeId) as SnippetNode;
        if (node && node.conversationPrompt) {
          setPrompt(node.conversationPrompt);
          setEditedPrompt(node.conversationPrompt);
        }
        // Remove automatic generation on first load
      }
      setHasInitialized(true);
    }
  }, [nodeId, nodes, hasInitialized]);
  
  // Only regenerate when explicitly requested via forceRegenerate
  useEffect(() => {
    // If forceRegenerate is true and we have a scene description, generate a new prompt
    if (forceRegenerate && sceneDescription) {
      console.log("Force regenerating prompt");
      generatePrompt().then(() => {
        // Notify parent component that regeneration is complete
        if (onRegenerated) {
          onRegenerated();
        }
      });
    }
  }, [forceRegenerate, sceneDescription]); // Include sceneDescription as a dependency

  // Update editedPrompt when prompt changes
  useEffect(() => {
    setEditedPrompt(prompt);
  }, [prompt]);
  
  // Function to generate a conversation prompt using the API
  const generatePrompt = async () => {
    if (isGenerating || !sceneDescription) return;
    
    setIsGenerating(true);
    setPrompt("Generating conversation prompt...");
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GENERATE_CONVERSATION_PROMPT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          generalContext,
          sceneDescription,
          subTopic,
          speakers,
          interactionPattern
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate prompt: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.prompt) {
        const newPrompt = data.prompt;
        setPrompt(newPrompt);
        setEditedPrompt(newPrompt);
        
        // Save the prompt to the node data if we have a node ID
        if (nodeId) {
          updateSnippetNode(nodeId, { conversationPrompt: newPrompt });
        }
      }
    } catch (error) {
      console.error('Error fetching conversation prompt:', error);
      setPrompt(`Failed to generate a conversation prompt. Please try again.`);
      setEditedPrompt(`Failed to generate a conversation prompt. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Function to handle saving edited prompt
  const saveEditedPrompt = () => {
    setPrompt(editedPrompt);
    
    // Save the edited prompt to the node data if we have a node ID
    if (nodeId) {
      updateSnippetNode(nodeId, { conversationPrompt: editedPrompt });
    }
    
    setIsEditing(false);
  };

  // Function to handle canceling edits
  const handleEditCancel = () => {
    setEditedPrompt(prompt);
    setIsEditing(false);
  };

  // Function to handle editing prompt
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedPrompt(e.target.value);
  };
  
  return (
    <div className="w-full conversation-prompt-component">
      {/* <div className="flex items-center justify-between mb-1">
        <div className="flex items-center">
          <span className="text-xs theme-text-secondary">Prompt</span>
        </div>
      </div> */}
      <div className="relative">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editedPrompt}
              onChange={handlePromptChange}
              placeholder="Edit conversation prompt..."
              className="w-full p-1.5 theme-bg-input theme-border theme-text-primary resize-y min-h-[80px] text-xs focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              rows={4}
              autoFocus
            />
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs theme-bg-secondary hover:bg-gray-300 text-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 transition-colors"
                onClick={handleEditCancel}
              >
                <X size={12} className="mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs bg-green-500/20 hover:bg-green-500 border-green-500/50 text-green-600 hover:text-white transition-colors"
                onClick={saveEditedPrompt}
              >
                <Save size={12} className="mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative group">
            <Textarea
              value={prompt}
              placeholder="Conversation prompt will appear here..."
              readOnly
              className="w-full p-1.5 pr-8 theme-bg-input theme-border theme-text-primary resize-y min-h-[80px] text-xs"
              rows={4}
              style={{ paddingRight: '2.5rem' }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded-full hover:theme-bg-hover theme-text-tertiary hover:theme-text-primary transition-opacity"
              onClick={() => setIsEditing(true)}
            >
              <Edit size={12} />
            </Button>
          </div>
        )}
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationPrompt; 