import { useState, useEffect, useMemo } from "react"
import useEditorStore, { EditorState, SnippetNode, InterruptionRule, BackChannelRule, interactionPatterns, emotionOptions, Scene } from "./store"
import { Card, CardContent} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusCircle, X, ChevronDown, ChevronRight, Pencil, RefreshCw } from "lucide-react"
import SceneSelector from "./SceneSelector"
import React from "react"
import ConversationPrompt, { TooltipIcon } from "./ConversationPrompt"

const SnippetInspector: React.FC<{ currentTopic: string }> = ({ currentTopic }) => {
  const { selectedItem, updateSelectedItem, getCachedDefaultSpeakers, speakers, nodes, closeInspector, updateSnippetNode } = useEditorStore() as EditorState;
  const [localNode, setLocalNode] = useState<SnippetNode | undefined>(undefined);
  const [isAvatarSectionExpanded, setIsAvatarSectionExpanded] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [activeTab, setActiveTab] = useState('basic');
  const [isLoading, setIsLoading] = useState(true);
  const [forcePromptRegenerate, setForcePromptRegenerate] = useState(false);
  const [promptKey, setPromptKey] = useState(0);
  const [isPromptExpanded, setIsPromptExpanded] = useState(true);
  const [isGeneralContextExpanded, setIsGeneralContextExpanded] = useState(true);
  const [isSnippetDetailsExpanded, setIsSnippetDetailsExpanded] = useState(true);
  
  // Get cached speakers once, but re-compute when speakers change in the store
  const defaultSpeakers = useMemo(() => getCachedDefaultSpeakers(), [getCachedDefaultSpeakers, speakers]);

  // Function to generate default title with index
  const getNodeTitle = (node: SnippetNode) => {
    if (!node || !node.id) return "Snippet";
    const snippetNodes = nodes.filter(n => n.type === 'snippet');
    const index = snippetNodes.findIndex(n => n.id === node.id) + 1;
    return `Snippet ${index}`;
  };

  // Effect to update the node when it's first selected
  useEffect(() => {
    if (selectedItem) {
      setIsLoading(true);
      const nodeData = selectedItem as SnippetNode;
      
      // If the node has no speakers or less than 3 speakers, add the default speakers
      if (!nodeData.speakers || nodeData.speakers.length === 0) {
        // No speakers at all, add all three default speakers
        const updatedNodeData = {
          ...nodeData,
          speakers: [...defaultSpeakers],
          // Also set Alice (first speaker) as the initiator if not already set
          initiator: nodeData.initiator || defaultSpeakers[0],
          // Initialize topic with currentTopic if it's not set
          topic: nodeData.topic || currentTopic
        };

        setLocalNode(updatedNodeData);
        updateSelectedItem(updatedNodeData);
        // Don't update the store here - it will trigger another render cycle
      } else {
        // If node already has speakers but no topic, set the topic
        const updatedNodeData = {
          ...nodeData,
          topic: nodeData.topic || currentTopic
        };
        setLocalNode(updatedNodeData);
        // Only update the store if the topic actually changed
        if (nodeData.topic !== updatedNodeData.topic) {
          updateSelectedItem(updatedNodeData);
        }
      }
      setTitleInput(getNodeTitle(nodeData));
      setIsLoading(false);
    }
  }, [selectedItem, updateSelectedItem, defaultSpeakers, nodes, currentTopic]);

  // Function to handle title update
  const handleTitleUpdate = () => {
    if (!localNode) return;
    // Use the trimmed title if it's not empty, otherwise use default
    const newTitle = titleInput.trim() || localNode.title;

    const updatedNode = {
      ...localNode,
      title: newTitle
    };

    setLocalNode(updatedNode);
    updateSelectedItem(updatedNode);
    updateSnippetNode(localNode.id, { title: newTitle });
    setIsEditingTitle(false);
  };

  // Function to handle title input key press
  const handleTitleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleUpdate();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTitleInput(localNode?.title || "");
    }
  };

  // Effect to update the node's speakers when global speakers change
  useEffect(() => {
    if (localNode && speakers.length >= 0) {
      // Create a map of all existing speakers by ID
      const speakerMap = new Map(speakers.map(s => [s.id, s]));
      
      // Filter out speakers that no longer exist and update the remaining ones
      const updatedSpeakers = localNode.speakers
        .filter(speaker => speakerMap.has(speaker.id))
        .map(speaker => {
          const updatedSpeaker = speakerMap.get(speaker.id);
          return updatedSpeaker || speaker;
        });

      // Update the initiator if it exists
      let updatedInitiator = localNode.initiator;
      if (updatedInitiator) {
        // If initiator no longer exists in the speakers list, use the first available speaker or undefined
        if (!speakerMap.has(updatedInitiator.id)) {
          updatedInitiator = updatedSpeakers.length > 0 ? updatedSpeakers[0] : undefined;
        } else {
          const newInitiator = speakerMap.get(updatedInitiator.id);
          if (newInitiator) {
            updatedInitiator = newInitiator;
          }
        }
      }
      
      // Update interruption rules to remove references to deleted speakers
      const updatedInterruptionRules = (localNode.interruptionRules || [])
        .filter(rule => 
          speakerMap.has(rule.fromSpeaker?.id) && 
          speakerMap.has(rule.toSpeaker?.id)
        )
        .map(rule => ({
          ...rule,
          fromSpeaker: speakerMap.get(rule.fromSpeaker.id) || rule.fromSpeaker,
          toSpeaker: speakerMap.get(rule.toSpeaker.id) || rule.toSpeaker
        }));
        
      // Update backchannel rules to remove references to deleted speakers
      const updatedBackChannelRules = (localNode.backChannelRules || [])
        .filter(rule => 
          speakerMap.has(rule.fromSpeaker?.id) && 
          speakerMap.has(rule.toSpeaker?.id)
        )
        .map(rule => ({
          ...rule,
          fromSpeaker: speakerMap.get(rule.fromSpeaker.id) || rule.fromSpeaker,
          toSpeaker: speakerMap.get(rule.toSpeaker.id) || rule.toSpeaker
        }));

      // Check if any speaker was removed or data changed
      const hasRemovedSpeakers = updatedSpeakers.length !== localNode.speakers.length;
      const hasDataChanges = 
        JSON.stringify(updatedSpeakers) !== JSON.stringify(localNode.speakers) ||
        updatedInitiator !== localNode.initiator;
      const hasRuleChanges = 
        JSON.stringify(updatedInterruptionRules) !== JSON.stringify(localNode.interruptionRules) ||
        JSON.stringify(updatedBackChannelRules) !== JSON.stringify(localNode.backChannelRules);
      
      // Only update if something changed
      if (hasRemovedSpeakers || hasDataChanges || hasRuleChanges) {
        const updatedNode = {
          ...localNode,
          speakers: updatedSpeakers,
          initiator: updatedInitiator,
          interruptionRules: updatedInterruptionRules,
          backChannelRules: updatedBackChannelRules
        };

        setLocalNode(updatedNode);
        updateSelectedItem(updatedNode);
        updateSnippetNode(localNode.id, updatedNode);
      }
    }
  }, [speakers, localNode, updateSelectedItem, updateSnippetNode]);

  const handleChange = (field: keyof SnippetNode, value: any): void => {
    if (!localNode) return;

    // Get the latest node state from the store to ensure we have the most recent position
    const currentStoreNode = nodes.find(n => n.id === localNode.id);
    if (!currentStoreNode) return;

    // Create a new node object with the latest position and the changed field
    const updated: SnippetNode = {
      ...currentStoreNode, // Use the current store state as base
      [field]: value
    };

    setLocalNode(updated);
    updateSelectedItem(updated);
    
    // Don't update the conversationPrompt when the topic field changes
    if (field === "topic") {
      const snippetNode = currentStoreNode as SnippetNode;
      const { conversationPrompt, ...nodeWithoutPrompt } = snippetNode;
      updateSnippetNode(localNode.id, { 
        ...nodeWithoutPrompt,
        topic: value 
      });
    } else {
      updateSnippetNode(localNode.id, updated);
    }
  };

  const handleSpeakerChange = (speakerId: string): void => {
    if (!localNode) return;
    
    // Get the latest node state from the store
    const currentStoreNode = nodes.find(n => n.id === localNode.id);
    if (!currentStoreNode) return;

    const updatedSpeakers = currentStoreNode.speakers ? [...currentStoreNode.speakers] : [];
    const existingSpeakerIndex = updatedSpeakers.findIndex((speaker) => speaker.id === speakerId);

    if (existingSpeakerIndex !== -1) {
      // Remove the speaker if it exists
      updatedSpeakers.splice(existingSpeakerIndex, 1);
    } else {
      // Find speaker in the available speakers array
      const speakerToAdd = defaultSpeakers.find((speaker) => speaker.id === speakerId);
      if (speakerToAdd) {
        updatedSpeakers.push(speakerToAdd);
      }
    }

    const updated: SnippetNode = { 
      ...currentStoreNode,
      speakers: updatedSpeakers,
    };
    
    setLocalNode(updated);
    updateSelectedItem(updated);
    updateSnippetNode(localNode.id, updated);
  };

  // Add a new interruption rule to the fixed rules list
  const addInterruptionRule = (): void => {
    if (!localNode || !localNode.interruptionFromSpeaker || !localNode.interruptionToSpeaker || !localNode.interruptionEmotion) {
      return;
    }

    // Get the latest node state from the store
    const currentStoreNode = nodes.find(n => n.id === localNode.id);
    if (!currentStoreNode) return;

    const fromSpeaker = currentStoreNode.speakers.find((s) => s.id === localNode.interruptionFromSpeaker);
    const toSpeaker = currentStoreNode.speakers.find((s) => s.id === localNode.interruptionToSpeaker);

    if (!fromSpeaker || !toSpeaker) return;

    const newRule: InterruptionRule = {
      id: Date.now().toString(),
      fromSpeaker: fromSpeaker,
      toSpeaker: toSpeaker,
      emotion: localNode.interruptionEmotion,
    };

    const currentRules = (currentStoreNode as SnippetNode).interruptionRules || [];
    
    const updated: SnippetNode = {
      ...currentStoreNode,
      interruptionRules: [...currentRules, newRule],
      interruptionFromSpeaker: "",
      interruptionToSpeaker: "",
      interruptionEmotion: "",
    };

    setLocalNode(updated);
    updateSelectedItem(updated);
    updateSnippetNode(localNode.id, updated);
  };

  // Remove an interruption rule from the fixed rules list
  const removeInterruptionRule = (ruleId: string): void => {
    if (!localNode) return;
    
    // Get the latest node state from the store
    const currentStoreNode = nodes.find(n => n.id === localNode.id);
    if (!currentStoreNode) return;
    
    const currentRules = (currentStoreNode as SnippetNode).interruptionRules || [];
    
    const updated: SnippetNode = {
      ...currentStoreNode,
      interruptionRules: currentRules.filter((rule: InterruptionRule) => rule.id !== ruleId),
    };

    setLocalNode(updated);
    updateSelectedItem(updated);
    updateSnippetNode(localNode.id, updated);
  };

  // Add a new backchannel rule to the fixed rules list
  const addBackChannelRule = (): void => {
    if (!localNode || !localNode.backChannelFromSpeaker || !localNode.backChannelToSpeaker || !localNode.backChannelEmotion) {
      return;
    }

    // Get the latest node state from the store
    const currentStoreNode = nodes.find(n => n.id === localNode.id);
    if (!currentStoreNode) return;

    const fromSpeaker = currentStoreNode.speakers.find((s) => s.id === localNode.backChannelFromSpeaker);
    const toSpeaker = currentStoreNode.speakers.find((s) => s.id === localNode.backChannelToSpeaker);

    if (!fromSpeaker || !toSpeaker) return;

    const newRule: BackChannelRule = {
      id: Date.now().toString(),
      fromSpeaker: fromSpeaker,
      toSpeaker: toSpeaker,
      emotion: localNode.backChannelEmotion,
    };

    const currentRules = (currentStoreNode as SnippetNode).backChannelRules || [];
    
    const updated: SnippetNode = {
      ...currentStoreNode,
      backChannelRules: [...currentRules, newRule],
      backChannelFromSpeaker: "",
      backChannelToSpeaker: "",
      backChannelEmotion: "",
    };

    setLocalNode(updated);
    updateSelectedItem(updated);
    updateSnippetNode(localNode.id, updated);
  };

  // Remove a backchannel rule from the fixed rules list
  const removeBackChannelRule = (ruleId: string): void => {
    if (!localNode) return;
    
    // Get the latest node state from the store
    const currentStoreNode = nodes.find(n => n.id === localNode.id);
    if (!currentStoreNode) return;
    
    const currentRules = (currentStoreNode as SnippetNode).backChannelRules || [];
    
    const updated: SnippetNode = {
      ...currentStoreNode,
      backChannelRules: currentRules.filter((rule: BackChannelRule) => rule.id !== ruleId),
    };

    setLocalNode(updated);
    updateSelectedItem(updated);
    updateSnippetNode(localNode.id, updated);
  };

  // Handle attaching a scene to the current snippet
  const handleSceneAttachment = (scene: Scene | null): void => {
    if (!localNode) return;

    // Get the latest node state from the store
    const currentStoreNode = nodes.find(n => n.id === localNode.id);
    if (!currentStoreNode) return;
    
    const updated: SnippetNode = { 
      ...currentStoreNode,
      attachedScene: scene || undefined,
      // Update partyMode based on whether any boxes have parties
      partyMode: scene?.boxes?.some(box => box.party) || false,
    };
    
    setLocalNode(updated);
    updateSelectedItem(updated);
    updateSnippetNode(localNode.id, updated);
  };

  // Function to extract avatars from the attached scene
  const getSceneAvatars = () => {
    if (!localNode?.attachedScene?.boxes) return [];
    
    // Extract all avatars from all boxes in the scene
    const avatars = localNode.attachedScene.boxes.flatMap(box => 
      (box.elements || [])
        .filter(element => element.elementType === 'avatar' && element.avatarData)
        .map(element => {
          // Map to a format compatible with AvatarConfig
          const avatarData = element.avatarData;
          return {
            id: element.id,
            name: avatarData?.name || "Unknown",
            gender: avatarData?.gender || "unknown",
            voice: avatarData?.settings?.voice || "",
            party: box.party,
          };
        })
    );
    
    return avatars;
  };

  if (isLoading) {
    return (
      <Card className="w-full bg-background text-foreground">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!localNode) {
    return (
      <Card className="w-full bg-background text-foreground">
        <CardContent className="p-6">
          <p className="text-destructive">No snippet data available.</p>
        </CardContent>
      </Card>
    );
  }

  // Get IDs of all currently selected speakers
  const selectedSpeakerIds = localNode.speakers.map((speaker) => speaker.id);

  // Get avatars from the attached scene instead of using allSpeakers
  const sceneAvatars = getSceneAvatars();
  
  // If no scene is attached or no avatars in the scene, fall back to default speakers
  const availableSpeakers = sceneAvatars.length > 0 ? sceneAvatars : defaultSpeakers;

  // Create filtered speaker lists for "To" dropdowns
  const toSpeakers = localNode.speakers.filter((speaker) => speaker.id !== localNode.interruptionFromSpeaker);
  const backChannelToSpeakers = localNode.speakers.filter((speaker) => speaker.id !== localNode.backChannelFromSpeaker);

  return (
    <div className="p-0 overflow-y-auto max-h-[calc(100vh-5rem)] theme-bg-primary theme-text-primary">
      <div className="sticky top-0 theme-bg-secondary theme-border-b theme-border p-2 shadow-sm z-10">
        <div className="flex items-center justify-between mb-0">
          {isEditingTitle ? (
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleUpdate}
              onKeyDown={handleTitleKeyPress}
              className="h-7 text-sm font-medium theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400"
              placeholder={getNodeTitle(localNode)}
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="text-sm font-medium theme-text-primary">
                {localNode.title}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-95 group-hover:opacity-100 transition-opacity hover:theme-bg-hover"
                onClick={() => {
                  setTitleInput(localNode.title);
                  setIsEditingTitle(true);
                }}
              >
                <Pencil className="h-3 w-3 theme-text-tertiary group-hover:theme-text-secondary" />
              </Button>
            </div>
          )}
          
          {/* <Button
            variant="ghost"
            size="sm"
            className="p-1 rounded-full hover:theme-bg-tertiary theme-text-tertiary hover:theme-text-primary"
            onClick={closeInspector}
          >
            <X className="h-4 w-4" />
          </Button> */}
        </div>
      </div>
      
      <div className="px-2 pt-2 pb-0">
        {/* Topic Input Section */}
        <div className="mb-3 p-2 theme-bg-secondary rounded-lg border theme-border">
          <div 
            className="flex items-center gap-2 cursor-pointer mb-1"
            onClick={() => setIsGeneralContextExpanded(!isGeneralContextExpanded)}
          >
            {isGeneralContextExpanded ? (
              <ChevronDown className="w-4 h-4 theme-text-tertiary" />
            ) : (
              <ChevronRight className="w-4 h-4 theme-text-tertiary" />
            )}
            <span className="text-xs font-medium theme-text-primary">
              General Context
            </span>
          </div>
          
          {isGeneralContextExpanded && (
            <div className="space-y-1 mt-2">
              <Input
                id="topic"
                value={localNode.topic || ""}
                onChange={(e) => handleChange("topic", e.target.value)}
                className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs"
                placeholder="Enter general context..."
              />
            </div>
          )}
        </div>

        {/* Avatar Selection Section */}
        <div className="mb-3 p-2 theme-bg-secondary rounded-lg border theme-border">
          <div 
            className="flex items-center gap-2 cursor-pointer mb-1"
            onClick={() => setIsAvatarSectionExpanded(!isAvatarSectionExpanded)}
          >
            {isAvatarSectionExpanded ? (
              <ChevronDown className="w-4 h-4 theme-text-tertiary" />
            ) : (
              <ChevronRight className="w-4 h-4 theme-text-tertiary" />
            )}
            <span className="text-xs font-medium theme-text-primary">
              Avatars in Scene
            </span>
          </div>
          
          {isAvatarSectionExpanded && (
            <div className="space-y-1.5 mt-2">
              {availableSpeakers.map((speaker) => {
                const isSelected = selectedSpeakerIds.includes(speaker.id);
                const isFromScene = sceneAvatars.some(avatar => avatar.id === speaker.id);

                let partyInfo = null;
                
                if (isSelected && localNode.attachedScene?.boxes) {
                  if (speaker.party) {
                    const matchingBox = localNode.attachedScene.boxes.find(box => 
                      box.party === speaker.party
                    );
                    
                    if (matchingBox) {
                      const avatarCount = matchingBox.elements?.filter(
                        element => element.elementType === 'avatar' && element.avatarData
                      ).length || 0;
                      
                      partyInfo = {
                        party: speaker.party,
                        avatarCount
                      };
                    } else {
                      partyInfo = {
                        party: speaker.party,
                        avatarCount: 1
                      };
                    }
                  } else {
                    const matchingBox = localNode.attachedScene.boxes.find(box => 
                      box.party && 
                      box.elements?.some(element => 
                        element.elementType === 'avatar' && 
                        element.avatarData?.name?.toLowerCase() === speaker.name.toLowerCase()
                      )
                    );
                    
                    if (matchingBox) {
                      const avatarCount = matchingBox.elements?.filter(
                        element => element.elementType === 'avatar' && element.avatarData
                      ).length || 0;
                      
                      partyInfo = {
                        party: matchingBox.party,
                        avatarCount
                      };
                    }
                  }
                }

                // console.log("speaker", speaker.party)
                // console.log("localNode", localNode.attachedScene?.globalPartySettings?.partyTurnMode)

                // console.log("moderatorParty", localNode.attachedScene?.globalPartySettings?.moderatorParty)

                return (
                  <div 
                    key={`speaker-${speaker.id}`} 
                    className="flex items-center justify-between text-xs theme-bg-secondary p-1.5 rounded border theme-border"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer transition-all px-2 py-0.5 text-xs ${
                          isSelected
                            ? isFromScene 
                              ? "bg-sky-600 text-white font-medium shadow-sm" 
                              : "bg-blue-600 text-white font-medium shadow-sm"
                            : "bg-black/30 text-white/70 border-white/20 hover:bg-black/50"
                        }`}
                        onClick={() => handleSpeakerChange(speaker.id)}
                      >
                        {speaker.name}
                        {isFromScene && (
                          <span className="ml-1 text-xs">⚡</span>
                        )}
                      </Badge>

                      {speaker.party && (
                        <div className="px-1.5 py-0.5 rounded text-xs whitespace-nowrap bg-green-500/20 border border-green-500/30 text-green-300">
                          <span className="font-medium">{speaker.party}</span>
                        </div>
                      )}

                      {localNode.attachedScene?.globalPartySettings?.partyTurnMode === "moderated" && 
                           localNode.attachedScene?.globalPartySettings?.moderatorParty && 
                           speaker.party === localNode.attachedScene?.globalPartySettings?.moderatorParty && (
                            <div className="px-2 py-0.5 rounded text-xs whitespace-nowrap bg-yellow-500/20 border border-yellow-500/30 text-yellow-300">
                              <span className="font-medium">Moderator</span>
                            </div>
                      )}

                      {isSelected && partyInfo && (
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-0.5 rounded text-xs whitespace-nowrap bg-blue-500/20 border border-blue-500/30 text-blue-300">
                            <span className="font-medium">Party: {partyInfo.party}</span>
                            {partyInfo.avatarCount > 1 && (
                              <span className="ml-1 text-blue-400/60">({partyInfo.avatarCount})</span>
                            )}
                          </div>
                          
                         
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {selectedSpeakerIds.length === 0 && (
                <p className="text-xs text-yellow-400 mt-2">No avatars selected. Default speakers will be used.</p>
              )}
              {sceneAvatars.length === 0 && (
                <p className="text-xs text-yellow-400 mt-2">No scene attached or no avatars in the scene. Showing default speakers.</p>
              )}
            </div>
          )}
        </div>

        {/* Scene Selector */}
        {localNode && (
          <SceneSelector 
            snippetNode={localNode} 
            onSceneChange={handleSceneAttachment} 
            onDescriptionGenerated={() => {
              // Trigger conversation prompt generation after scene description is generated
              setPromptKey(prev => prev + 1); // Increment key to force remount
              setForcePromptRegenerate(true); // Set flag to true to trigger regeneration
            }}
          />
        )}

        {/* Main Tabbed Interface */}
        <div className="mb-2">
          <nav className="flex border-b theme-border">
            <button 
              type="button"
              className={`px-2 py-1 border-b-2 text-xs font-medium ${activeTab === 'basic' ? 'theme-border-accent theme-text-accent' : 'border-transparent theme-text-tertiary hover:theme-text-secondary hover:theme-border-tertiary'}`}
              onClick={() => setActiveTab('basic')}
            >
              Basic Configuration
            </button>
            <button 
              type="button"
              className={`px-2 py-1 border-b-2 text-xs font-medium ${activeTab === 'advanced' ? 'theme-border-accent theme-text-accent' : 'border-transparent theme-text-tertiary hover:theme-text-secondary hover:theme-border-tertiary'}`}
              onClick={() => setActiveTab('advanced')}
            >
              Advanced Settings
            </button>
          </nav>
          
          <div className="pt-2 space-y-2">
            {/* Basic Configuration Tab Content */}
            {activeTab === 'basic' && (
              <>
                {/* Snippet Details */}
                <div className="theme-bg-secondary rounded-md border theme-border overflow-hidden">
                  <div 
                    className="theme-bg-panel px-3 py-1.5 border-b theme-border flex items-center cursor-pointer"
                    onClick={() => setIsSnippetDetailsExpanded(!isSnippetDetailsExpanded)}
                  >
                    {isSnippetDetailsExpanded ? (
                      <ChevronDown className="w-4 h-4 theme-text-tertiary mr-1" />
                    ) : (
                      <ChevronRight className="w-4 h-4 theme-text-tertiary mr-1" />
                    )}
                    <h3 className="text-xs font-medium theme-text-primary">Snippet Details</h3>
                  </div>
                  
                  {isSnippetDetailsExpanded && (
                    <div className="p-2 space-y-3">
                      <div className="space-y-1">
                        <label htmlFor="subTopic" className="block text-xs font-medium theme-text-primary">
                          Topic
                        </label>
                        <Textarea
                          id="subTopic"
                          value={localNode.subTopic || ""}
                          onChange={(e) => handleChange("subTopic", e.target.value)}
                          className="w-full p-1.5 theme-bg-input theme-border theme-text-primary resize-y min-h-[30px] text-xs"
                          placeholder="Enter sub topic..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label htmlFor="turns" className="block text-xs font-medium theme-text-primary">
                            Turns
                          </label>
                          <Input
                            id="turns"
                            type="number"
                            min="1"
                            step="1"
                            className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs"
                            value={localNode.turns || ""}
                            onChange={(e) => {
                              const value = e.target.value === "" ? "" : Math.floor(Number.parseInt(e.target.value, 10));
                              handleChange("turns", value);
                            }}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                handleChange("turns", "");
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label htmlFor="snippetInitiation" className="block text-xs font-medium theme-text-primary">
                            Initiator
                          </label>
                          <Select 
                            value={localNode.initiator?.id || ""}
                            onValueChange={(value) => {
                              const speaker = localNode.speakers.find(speaker => speaker.id === value);
                              handleChange("initiator", speaker);
                            }}
                          >
                            <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                              <SelectValue placeholder="Initiator" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                              {(localNode.speakers || []).map((speaker) => (
                                <SelectItem key={`initiator-speaker-${speaker.id}`} value={speaker.id} className="text-xs">
                                  {speaker.name}
                                </SelectItem>
                              ))}
                              
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label htmlFor="interactionPattern" className="block text-xs font-medium theme-text-primary">
                            Interaction Pattern
                          </label>
                          <Select
                            value={localNode.interactionPattern || "neutral"}
                            onValueChange={(value) => handleChange("interactionPattern", value)}
                          >
                            <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                              <SelectValue placeholder="Select pattern" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                              {interactionPatterns.map((pattern) => (
                                <SelectItem key={`pattern-${pattern}`} value={pattern} className="text-xs">
                                  {pattern}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Temporarily commented out turn-taking mode
                        <div className="space-y-1">
                          <label htmlFor="turnTakingMode" className="block text-xs font-medium theme-text-primary">
                            Turn-Taking Mode
                          </label>
                          <Select
                            value={localNode.turnTakingMode || "round-robin"}
                            onValueChange={(value) => handleChange("turnTakingMode", value)}
                          >
                            <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                              <SelectValue placeholder="Select mode" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                              {turnTakingModes.map((mode) => (
                                <SelectItem key={`mode-${mode}`} value={mode} className="text-xs">
                                  {mode}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        */}
                      </div>
                    </div>
                  )}
                </div>

                {/* Conversation Prompt Section */}
                {localNode && localNode.attachedScene && (
                  <div className="theme-bg-secondary rounded-md border theme-border overflow-hidden">
                    <div 
                      className="theme-bg-panel px-3 py-1.5 border-b theme-border flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2" onClick={() => setIsPromptExpanded(prev => !prev)}>
                        {isPromptExpanded ? (
                          <ChevronDown className="w-4 h-4 theme-text-tertiary" />
                        ) : (
                          <ChevronRight className="w-4 h-4 theme-text-tertiary" />
                        )}
                        <h3 className="text-xs font-medium theme-text-primary">Conversation Prompt</h3>
                        <TooltipIcon text="This prompt is used to guide the conversation generation" />
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-6 px-2 border-blue-500/50 text-blue-500 hover:text-white hover:bg-blue-500 rounded transition-colors text-xs flex items-center gap-1"
                        onClick={() => {
                          // Force regeneration of the conversation prompt
                          console.log("Regenerate button clicked");
                          setPromptKey(prev => prev + 1); // Increment key to force remount
                          setForcePromptRegenerate(true); // Set flag to true to trigger regeneration
                        }}
                      >
                        <RefreshCw size={12} />
                        Regenerate
                      </Button>
                    </div>

                    {isPromptExpanded && (
                      <div className="p-2 space-y-3">
                        <div className="space-y-1">
                          <ConversationPrompt 
                            key={`prompt-${localNode.id}-${promptKey}`}
                            generalContext={localNode.topic || currentTopic || ""} 
                            sceneDescription={localNode.description || ""}
                            subTopic={localNode.subTopic || ""}
                            speakers={localNode.speakers || []}
                            interactionPattern={localNode.interactionPattern || "neutral"}
                            nodeId={localNode.id}
                            initialPrompt={localNode.conversationPrompt || ""}
                            forceRegenerate={forcePromptRegenerate}
                            onRegenerated={() => setForcePromptRegenerate(false)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Advanced Settings Tab Content */}
            {activeTab === 'advanced' && (
              <>
                {/* Interruption Rules */}
                <div className="theme-bg-secondary rounded-md border theme-border overflow-hidden">
                  <div className="theme-bg-panel px-3 py-1.5 border-b theme-border">
                    <h3 className="text-xs font-medium theme-text-primary">Interruption Rules</h3>
                  </div>
                  <div className="p-2 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs theme-text-secondary">Add new rule</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 gap-1 text-xs px-2 theme-bg-accent-light theme-text-accent theme-border-accent-light hover:theme-bg-accent-secondary transition-colors"
                        onClick={addInterruptionRule}
                        disabled={
                          !localNode.interruptionFromSpeaker ||
                          !localNode.interruptionToSpeaker ||
                          !localNode.interruptionEmotion
                        }
                      >
                        <PlusCircle size={12} />
                        <span>Add Rule</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium theme-text-primary">From</label>
                        <Select
                          value={localNode.interruptionFromSpeaker || ""}
                          onValueChange={(value) => handleChange("interruptionFromSpeaker", value)}
                        >
                          <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                            <SelectValue placeholder="From" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                            {(localNode.speakers || []).map((speaker) => (
                              <SelectItem key={`from-speaker-${speaker.id}`} value={speaker.id} className="text-xs">
                                {speaker.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium theme-text-primary">To</label>
                        <Select
                          value={localNode.interruptionToSpeaker || ""}
                          onValueChange={(value) => handleChange("interruptionToSpeaker", value)}
                        >
                          <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                            <SelectValue placeholder="To" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                            {toSpeakers.map((speaker) => (
                              <SelectItem key={`to-speaker-${speaker.id}`} value={speaker.id} className="text-xs">
                                {speaker.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium theme-text-primary">Emotion</label>
                        <Select
                          value={localNode.interruptionEmotion || ""}
                          onValueChange={(value) => handleChange("interruptionEmotion", value)}
                        >
                          <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                            <SelectValue placeholder="Emotion" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                            {emotionOptions.map((emotion) => (
                              <SelectItem key={`emotion-${emotion}`} value={emotion} className="text-xs">
                                {emotion}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Display saved interruption rules */}
                    {localNode.interruptionRules && localNode.interruptionRules.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {localNode.interruptionRules.map((rule) => (
                          <div
                            key={rule.id}
                            className="flex items-center justify-between text-xs theme-bg-secondary p-1.5 rounded border theme-border"
                          >
                            <div className="flex-1">
                              <span className="text-xs">
                                <span className="theme-text-accent font-medium">{rule.fromSpeaker.name}</span>
                                <span className="mx-1 theme-text-tertiary">→</span>
                                <span className="theme-text-accent font-medium">{rule.toSpeaker.name}</span>
                                <span className="mx-1 theme-text-tertiary">with</span>
                                <span className="theme-text-warning font-medium">{rule.emotion}</span>
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 theme-text-tertiary hover:theme-text-error hover:theme-bg-error-light rounded-full transition-colors"
                              onClick={() => removeInterruptionRule(rule.id)}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Back Channel Rules */}
                <div className="theme-bg-secondary rounded-md border theme-border overflow-hidden">
                  <div className="theme-bg-panel px-3 py-1.5 border-b theme-border">
                    <h3 className="text-xs font-medium theme-text-primary">Back Channel Rules</h3>
                  </div>
                  <div className="p-2 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs theme-text-secondary">Add new rule</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 gap-1 text-xs px-2 theme-bg-accent-light theme-text-accent theme-border-accent-light hover:theme-bg-accent-secondary transition-colors"
                        onClick={addBackChannelRule}
                        disabled={
                          !localNode.backChannelFromSpeaker || !localNode.backChannelToSpeaker || !localNode.backChannelEmotion
                        }
                      >
                        <PlusCircle size={12} />
                        <span>Add Rule</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="block text-xs font-medium theme-text-primary">From</label>
                        <Select
                          value={localNode.backChannelFromSpeaker || ""}
                          onValueChange={(value) => handleChange("backChannelFromSpeaker", value)}
                        >
                          <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                            <SelectValue placeholder="From" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                            {(localNode.speakers || []).map((speaker) => (
                              <SelectItem key={`from-speaker-${speaker.id}`} value={speaker.id} className="text-xs">
                                {speaker.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium theme-text-primary">To</label>
                        <Select
                          value={localNode.backChannelToSpeaker || ""}
                          onValueChange={(value) => handleChange("backChannelToSpeaker", value)}
                        >
                          <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                            <SelectValue placeholder="To" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                            {backChannelToSpeakers.map((speaker) => (
                              <SelectItem key={`to-speaker-${speaker.id}`} value={speaker.id} className="text-xs">
                                {speaker.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-medium theme-text-primary">Emotion</label>
                        <Select
                          value={localNode.backChannelEmotion || ""}
                          onValueChange={(value) => handleChange("backChannelEmotion", value)}
                        >
                          <SelectTrigger className="w-full p-1.5 theme-bg-input theme-border theme-text-primary focus:ring-0 focus:border-gray-400 h-7 text-xs">
                            <SelectValue placeholder="Emotion" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[150px] overflow-y-auto theme-bg-secondary theme-border theme-text-primary">
                            {emotionOptions.map((emotion) => (
                              <SelectItem key={`emotion-${emotion}`} value={emotion} className="text-xs">
                                {emotion}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Display saved backchannel rules */}
                    {localNode.backChannelRules && localNode.backChannelRules.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {localNode.backChannelRules.map((rule) => (
                          <div
                            key={rule.id}
                            className="flex items-center justify-between text-xs theme-bg-secondary p-1.5 rounded border theme-border"
                          >
                            <div className="flex-1">
                              <span className="text-xs">
                                <span className="theme-text-accent font-medium">{rule.fromSpeaker.name}</span>
                                <span className="mx-1 theme-text-tertiary">→</span>
                                <span className="theme-text-accent font-medium">{rule.toSpeaker.name}</span>
                                <span className="mx-1 theme-text-tertiary">with</span>
                                <span className="theme-text-warning font-medium">{rule.emotion}</span>
                              </span>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 theme-text-tertiary hover:theme-text-error hover:theme-bg-error-light rounded-full transition-colors"
                              onClick={() => removeBackChannelRule(rule.id)}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SnippetInspector;