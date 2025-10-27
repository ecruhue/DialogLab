import useEditorStore from "./store";
import "./Inspector.css";
import SnippetInspector from "./SnippetInspector";
import ConnectionInspector from "./ConnectionInspector";
import AvatarInspector from "./AvatarInspector";
import PartyInspector from "./PartyInspector";
import GlobalPartyInspector from "./GlobalPartyInspector";
import { useState, useEffect } from "react";

export default function Inspector() {
  const { selectedItem, closeInspector } = useEditorStore();
  const [currentTopic, setCurrentTopic] = useState('');

  // Load topic from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('aiPanelData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        if (parsedData.discussionTopic) {
          setCurrentTopic(parsedData.discussionTopic);
        }
      } catch (error) {
        console.error('Error loading topic from localStorage:', error);
      }
    }
  }, []);

  // Listen for topic changes
  useEffect(() => {
    const handleStorageChange = () => {
      const savedData = localStorage.getItem('aiPanelData');
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          if (parsedData.discussionTopic) {
            setCurrentTopic(parsedData.discussionTopic);
          }
        } catch (error) {
          console.error('Error syncing topic from localStorage:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('topicChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('topicChanged', handleStorageChange);
    };
  }, []);

  if (!selectedItem) return null; // Hide when nothing is selected

  // Determine which inspector to render based on the type
  const renderInspector = () => {
    // Check if the selectedItem has the required properties for each inspector type
    if (selectedItem.type === "avatar") {
      return <AvatarInspector avatar={selectedItem} />;
    } else if (selectedItem.type === "connection") {
      return <ConnectionInspector connection={selectedItem} />;
    } else if (selectedItem.type === "party") {
      return <PartyInspector party={selectedItem} />;
    } else if (selectedItem.type === "globalParty") {
      return <GlobalPartyInspector global={true} />;
    } else {
      // Check if the selectedItem has required properties for SnippetInspector
      // This helps prevent undefined errors
      if (!selectedItem.speakers) {
        return <div className="p-4">Selected item doesn't have required properties</div>;
      }
      return <SnippetInspector conversation={selectedItem} currentTopic={currentTopic} />;
    }
  };

  return (
    <div className="inspector">
      <div className="preview-header">
        Inspector Panel
        <button
          onClick={closeInspector}
          className="absolute p-1.5 theme-text-tertiary hover:theme-text-primary hover:cursor-pointer transition-colors duration-150 right-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {renderInspector()}
    </div>
  );
}