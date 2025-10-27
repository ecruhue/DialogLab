import React, { useState, useEffect } from 'react';
import { cn } from '../../libs/utils';
import { Message } from '../nodeeditor/utils/NodeEditorUtils';

interface ImpromptuApprovalPanelProps {
  message: Message;
  onApprove: (editedContent?: string) => void;
  onReject: () => void;
  onEdit?: (messageContent: string) => void;
  onRegenerateWithMode?: (mode: string) => void;
}

const ImpromptuApprovalPanel: React.FC<ImpromptuApprovalPanelProps> = ({ 
  message, 
  onApprove, 
  onReject,
  onEdit,
  onRegenerateWithMode
}) => {
  const participant = message.participant || message.sender || '';
  const content = message.content || message.message || '';
  const originalDerailMode = message.derailMode || 'extend';
  
  const [isBlinking, setIsBlinking] = useState(false);
  const [isConsiderHovered, setIsConsiderHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [selectedDerailMode, setSelectedDerailMode] = useState(originalDerailMode);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  
  const derailModeOptions = [
    { value: 'drift', label: 'TOPIC SHIFT', description: 'Subtly shift to a new topic' },
    { value: 'extend', label: 'NEW PERSPECTIVE', description: 'Add a novel perspective to the current topic' },
    { value: 'question', label: 'PROBING QUESTION', description: 'Ask a question that shifts focus' },
    { value: 'emotional', label: 'EMOTIONAL RESPONSE', description: 'Respond to emotional subtext' }
  ];
  
  const currentDerailModeOption = derailModeOptions.find(option => option.value === selectedDerailMode) || derailModeOptions[0];
  
  // Update editedContent when message content changes from parent
  useEffect(() => {
    const newContent = message.content || message.message || '';
    setEditedContent(newContent);
    setHasEdited(false); // Reset edit state when message changes
  }, [message.content, message.message]);
  
  // Reset selected mode when message changes
  useEffect(() => {
    setSelectedDerailMode(message.derailMode || 'extend');
    // Also reset regeneration state when message changes
    setIsRegenerating(false);
  }, [message.derailMode, message.content, message.message]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsBlinking(prev => !prev);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const handleEditSave = () => {
    if (editedContent.trim() !== '') {
      if (onEdit) {
        onEdit(editedContent);
      }
      setHasEdited(true);
      setIsEditing(false);
    }
  };

  const handleEditCancel = () => {
    const currentContent = message.content || message.message || '';
    setEditedContent(currentContent);
    setHasEdited(false);
    setIsEditing(false);
  };
  
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDerailMode(e.target.value);
  };
  
  const handleRegenerate = () => {
    if (onRegenerateWithMode && selectedDerailMode !== originalDerailMode) {
      setIsRegenerating(true);
      onRegenerateWithMode(selectedDerailMode);
      // Note: We don't reset isRegenerating here because it's cleared in the useEffect above
      // when the message changes, or in the parent's completion callback
    }
  };

  // Handle the consider button click - pass edited content if it was changed
  const handleConsiderClick = () => {
    // If the message was edited, pass the edited content to onApprove
    if (hasEdited || editedContent !== (message.content || message.message || '')) {
      onApprove(editedContent);
    } else {
      onApprove();
    }
  };

  // Get derail mode icon based on selected mode
  const getDerailModeIcon = (mode: string) => {
    switch (mode) {
      case 'drift':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={cn(
            "h-5 w-5 transition-colors duration-700",
            isBlinking ? "text-gray-500 dark:text-gray-400" : "text-gray-500 dark:text-gray-400"
          )} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
            <path d="m16 12-4-4" />
            <path d="m8 12 4 4" />
            <path d="M12 8v8" />
          </svg>
        );
      case 'question':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={cn(
            "h-5 w-5 transition-colors duration-700",
            isBlinking ? "text-gray-500 dark:text-gray-400" : "text-gray-500 dark:text-gray-400"
          )} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        );
      case 'emotional':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={cn(
            "h-5 w-5 transition-colors duration-700",
            isBlinking ? "text-gray-500 dark:text-gray-400" : "text-gray-500 dark:text-gray-400"
          )} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        );
      case 'extend':
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className={cn(
            "h-5 w-5 transition-colors duration-700",
            isBlinking ? "text-gray-500 dark:text-gray-400" : "text-gray-500 dark:text-gray-400"
          )} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        );
    }
  };

  // Get current message content directly from prop each time
  const currentContent = message.content || message.message || '';

  return (
    <div className="fixed bottom-15 z-50 p-1 flex justify-start pointer-events-none" style={{ width: '300px' }}>
      <style>
        {`
        @keyframes loadingProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
        
        .loading-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 2px;
          background: rgba(255, 255, 255, 0.7);
          animation: loadingProgress 1.5s ease-in-out infinite;
        }
        
        .consider-active {
          position: relative;
          overflow: hidden;
        }
        
        .consider-active .loading-indicator {
          display: inline-block;
          margin-left: 4px;
          animation: pulse 1.5s infinite;
        }
        
        .spin {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        `}
      </style>
      <div className={cn(
        "w-full border rounded-lg bg-white dark:bg-gray-800 shadow-lg pointer-events-auto max-h-[400px] overflow-hidden",
        "border-blue-200 dark:border-blue-700"
      )}>
        <div className="p-1.5 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className={cn(
                "rounded-full p-0.5 flex-shrink-0 transition-colors duration-700",
                isBlinking ? "bg-gray-100 dark:bg-gray-700" : "bg-gray-100 dark:bg-gray-700"
              )}>
                {getDerailModeIcon(selectedDerailMode)}
              </div>
              <h3 className={cn(
                "text-sm font-medium tracking-wide",
                "text-blue-700 dark:text-blue-300"
              )}>
                {participant}
              </h3>
              <div className="flex-grow"></div>
              <select 
                value={selectedDerailMode}
                onChange={handleModeChange}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs text-gray-500 dark:text-gray-400 border-none focus:ring-1 focus:ring-blue-400"
              >
                {derailModeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Description of selected mode */}
            <div className="text-[10px] text-gray-500 dark:text-gray-400">
              {currentDerailModeOption.description}
            </div>
            
            {isEditing ? (
              <div className="flex flex-col gap-1">
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="text-xs w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 min-h-[60px] max-h-[200px] overflow-y-auto"
                />
                <div className="flex justify-end gap-1">
                  <button
                    onClick={handleEditCancel}
                    className="inline-flex items-center justify-center h-6 px-2 text-xs font-medium rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    className="inline-flex items-center justify-center h-6 px-2 text-xs font-medium rounded-md bg-green-500 hover:bg-green-600 text-white transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className={cn(
                "text-sm text-gray-600 bg-gray-100 dark:bg-gray-700 rounded-lg p-2 dark:text-gray-300 relative group transition-opacity duration-700 max-h-[200px] overflow-y-auto",
                isBlinking ? "opacity-70" : "opacity-100",
                hasEdited ? "border-l-2 border-green-400 dark:border-green-600" : ""
              )}>
                {editedContent}
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded-full bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 text-gray-500 dark:text-gray-300 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    <path d="m15 5 4 4"/>
                  </svg>
                </button>
              </p>
            )}
            
            {/* Regenerate button - only show if mode has changed */}
            {selectedDerailMode !== originalDerailMode && (
              <div className="flex justify-end">
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className={cn(
                    "inline-flex items-center justify-center h-6 px-2 text-xs font-medium rounded-md transition-colors",
                    isRegenerating 
                      ? "bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-400" 
                      : "bg-sky-500 hover:bg-sky-600 text-white"
                  )}
                >
                  {isRegenerating ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0 1 15-6.7l3-3" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 12a9 9 0 0 1-15 6.7l-3 3" />
                      </svg>
                      Regenerate with {currentDerailModeOption.label}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="px-3 pb-1.5 pt-0 flex justify-end gap-1">
          <button
            onClick={onReject}
            className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            Dismiss
          </button>
          <button
            onClick={handleConsiderClick}
            onMouseEnter={() => setIsConsiderHovered(true)}
            onMouseLeave={() => setIsConsiderHovered(false)}
            className={cn(
              "inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md text-white transition-colors duration-700",
              isBlinking ? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 opacity-90" : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
              isConsiderHovered && "consider-active"
            )}
          >
            {isConsiderHovered && <div className="loading-bar"></div>}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Consider
            {hasEdited && <span className="ml-1 text-[9px] bg-white text-blue-600 px-1 rounded-full">Edited</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImpromptuApprovalPanel; 