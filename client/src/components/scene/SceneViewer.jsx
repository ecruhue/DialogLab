import React, { useRef } from 'react';

const SceneViewer = ({ currentScene }) => {
  const sceneContainerRef = useRef(null);

  if (!currentScene) {
    return <div className="text-center p-4 text-gray-400">No scene selected</div>;
  }
  
  const backgroundStyle = currentScene.backgroundImage ? {
    backgroundImage: `url(${currentScene.backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  } : {
    backgroundColor: 'var(--bg-secondary)'
  };
  
  return (
    <div className="w-full h-full overflow-auto p-4">
      <h3 className="text-lg font-semibold mb-2">{currentScene.name}</h3>
      
      {/* Scene preview */}
      <div 
        className="relative w-full h-[calc(100vh-250px)] overflow-hidden rounded-lg border border-gray-700"
        style={{
          ...backgroundStyle,
          maxWidth: '100%',
          margin: '0 auto'
        }}
        ref={sceneContainerRef}
      >
        {/* Render boxes */}
        {currentScene.boxes && currentScene.boxes.map((box, index) => {
          const { id, x, y, width, height, party, elements, avatarData } = box;
          
          // Calculate absolute position based on percentages
          const boxStyle = {
            position: 'absolute',
            left: `${x || 0}%`,
            top: `${y || 0}%`,
            width: `${width || 33}%`,
            height: `${height || 33}%`,
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(3px)'
          };
          
          // Add party styling if present
          if (party) {
            boxStyle.borderColor = 'rgba(59, 130, 246, 0.6)';
            boxStyle.backgroundColor = 'rgba(59, 130, 246, 0.15)';
          }
          
          return (
            <div 
              key={id || `box-${index}`}
              style={boxStyle}
            >
              {/* Box content */}
              {party && (
                <div className="absolute top-0 left-0 right-0 bg-blue-600 bg-opacity-80 text-white text-xs p-1">
                  {party}
                </div>
              )}
              
              {/* Render elements */}
              {elements && (
                <div className={`w-full h-full ${party ? 'pt-6' : ''} p-2`}>
                  {elements.map((element, eIndex) => {
                    if (element.elementType === 'avatar' && element.avatarData) {
                      return (
                        <div 
                          key={`element-${eIndex}`}
                          className="text-xs text-white bg-black bg-opacity-30 p-1 rounded mb-1"
                        >
                          Avatar: {element.avatarData.name}
                        </div>
                      );
                    } else if (element.elementType === 'content' && element.content) {
                      return (
                        <div 
                          key={`element-${eIndex}`}
                          className="text-xs text-white bg-yellow-500 bg-opacity-20 p-1 rounded mb-1"
                        >
                          {element.content}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
              
              {/* Legacy avatar data display */}
              {!elements && avatarData && (
                <div className="w-full h-full p-2 flex items-center justify-center">
                  <span className="text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
                    Avatar: {avatarData.name}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 text-sm text-gray-300">
        <p>Scene ID: {currentScene.id}</p>
        <p>Total boxes: {currentScene.boxes?.length || 0}</p>
        <p>Click the Edit button above to modify this scene</p>
      </div>
    </div>
  );
};

export default SceneViewer; 