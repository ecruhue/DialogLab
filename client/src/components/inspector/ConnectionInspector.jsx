import React, { useState, useEffect } from "react";
import useEditorStore from './store';

const ConnectionInspector = () => {
  const { selectedItem, updateSelectedItem, updateConnection, deleteConnection } = useEditorStore();
  const [localConnection, setLocalConnection] = useState(undefined);

  useEffect(() => {
    if (selectedItem) {
      setLocalConnection(selectedItem);
    }
  }, [selectedItem]);

  const handleChange = (field, value) => {
    const updated = { ...localConnection, [field]: value };
    setLocalConnection(updated);
    updateSelectedItem(updated); 
  };
  
  const handleDelete = () => {
    deleteConnection(selectedItem.id);
  };

  if (!localConnection) {
    return <p className="theme-text-error">No connection data available.</p>;
  }

  return (
    <div className="connection-inspector p-4">
      <h3 className="text-lg font-semibold mb-3 theme-text-accent">
        Connection: {localConnection.id ?? "UNDEFINED"}
      </h3>
      
      <div className="space-y-4">
        {/* <div>
          <label className="block text-sm font-medium mb-1">ID</label>
          <p className="p-2 bg-gray-50 border border-gray-300 text-black rounded-md">
            {localConnection.id}
          </p>
        </div> */}
        
        <div>
          <label className="block text-sm font-medium mb-1">Transition</label>
          <input
            type="text"
            className="w-full px-2 py-1 border theme-border theme-bg-input theme-text-primary rounded-md"
            value={localConnection.transition || ""}
            onChange={(e) => handleChange("transition", e.target.value)}
          />
        </div>
        
        <button 
          onClick={handleDelete} 
          className="mt-4 px-4 py-2 theme-bg-error hover:theme-bg-error-hover theme-text-inverse rounded-md transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default ConnectionInspector;