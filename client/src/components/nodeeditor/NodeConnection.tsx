import React, { useState } from "react";
import ReactDOM from "react-dom";
import useEditorStore, { Connection, SnippetNode } from "../inspector/store";

interface MousePosition {
  x: number;
  y: number;
}

interface NodeConnectionProps {
  nodes: SnippetNode[];
  mousePos: MousePosition;
  nextId?: number;
  activeConnectionIds?: string[];
  onConnectionComplete?: (connection: Connection) => void;
}

const NodeConnection: React.FC<NodeConnectionProps> = ({
  nodes,
  mousePos,
  activeConnectionIds = [],
}) => {
  const { connections, setSelectedItem, deleteConnection } = useEditorStore();
  const [connectingFrom, setConnectingFrom] = useState<string>();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent, connectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuPosition = {
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY
    };
    
    setContextMenuPos(menuPosition);
    setShowContextMenu(true);
    setActiveConnectionId(connectionId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowContextMenu(false);
    if (activeConnectionId) {
      deleteConnection(activeConnectionId);
      
      try {
        localStorage.removeItem('played-nodes');
      } catch (error) {
        console.error("Error clearing played-nodes from localStorage:", error);
      }
    }
  };

  React.useEffect(() => {
    const handleDocumentClick = () => {
      if (showContextMenu) {
        setShowContextMenu(false);
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [showContextMenu]);

  const renderContextMenu = () => {
    if (!showContextMenu) return null;
    
    return ReactDOM.createPortal(
      <div
        className="absolute z-50 theme-bg-tertiary shadow-lg rounded-md overflow-hidden border theme-border w-48"
        style={{
          left: `${contextMenuPos.x}px`,
          top: `${contextMenuPos.y}px`,
        }}
      >
        <ul className="py-1 text-sm">
          <li
            className="px-4 py-2 hover:bg-opacity-80 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer flex items-center theme-text-primary transition-colors duration-150"
            onClick={handleDelete}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </li>
        </ul>
      </div>,
      document.body
    );
  };

  const renderConnections = (): React.ReactElement => {
    return (
      <>
        {connections.map((conn, i) => {
          const fromNode = nodes.find((n) => n.id === conn.from);
          const toNode = nodes.find((n) => n.id === conn.to);
          if (!fromNode || !toNode) return null;

          const start = {
            x: fromNode.x + 170,
            y: fromNode.y + 60,
          };
          const end = {
            x: toNode.x,
            y: toNode.y + 60,
          };

          const pathMidX = (start.x + end.x) / 2;
          const pathMidY = (start.y + end.y) / 2;

          const isActive = activeConnectionIds.includes(conn.id);

          return (
            <g
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedItem({ ...conn, type: "connection" });
              }}
            >
              <path
                className={`connection ${isActive ? 'active-connection' : ''}`}
                stroke={isActive ? "#4CAF50" : "white"}
                strokeWidth={isActive ? "6" : "4"}
                d={`M ${start.x} ${start.y} C ${start.x + 50} ${start.y}, ${end.x - 50} ${end.y}, ${end.x} ${end.y}`}
              />

              <circle
                cx={pathMidX}
                cy={pathMidY}
                r="10"
                fill={isActive ? "#4CAF50" : "white"}
                stroke="black"
                strokeWidth="1"
                className="cursor-pointer"
                onContextMenu={(e) => handleContextMenu(e, conn.id)}
              />
            </g>
          );
        })}
        {connectingFrom &&
          (() => {
            const fromNode = nodes.find((n) => n.id === connectingFrom);
            if (!fromNode) return null;

            return (
              <path
                className="connection-preview"
                d={`M ${fromNode.x + 170} ${fromNode.y + 60} 
                  C ${fromNode.x + 220} ${fromNode.y + 60}, 
                    ${mousePos.x - 50} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
              />
            );
          })()}
          
        {renderContextMenu()}
      </>
    );
  };

  return renderConnections();
};

// Export utility functions that can be used by NodeEditor
export const startConnection = (
  nodeId: string,
  setConnectingFrom: React.Dispatch<React.SetStateAction<string | null>>
): void => {
  setConnectingFrom(nodeId);
};

export const completeConnection = (
  toNodeId: string,
  connectingFrom: string | null,
  nextId: number,
  addConnection: (connection: Connection) => void,
  setConnectingFrom: React.Dispatch<React.SetStateAction<string | null>>
): void => {
  if (connectingFrom && connectingFrom !== toNodeId) {
    const newConnection: Connection = {
      id: nextId.toString(),
      from: connectingFrom,
      to: toNodeId,
      condition: ""
    };
    addConnection(newConnection);
  }
  setConnectingFrom(null);
};

export const handleCanvasClick = (
  e: React.MouseEvent<SVGSVGElement>,
  connectingFrom: string | null,
  setConnectingFrom: React.Dispatch<React.SetStateAction<string | null>>
): void => {
  if (connectingFrom) {
    setConnectingFrom(null);
  }
};

export default NodeConnection; 