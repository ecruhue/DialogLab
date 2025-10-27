import React, { useState, useEffect, useRef } from 'react';
import ThemeToggle from './ui/ThemeToggle';
import '../components/ui/ThemeToggle.css';
import API_CONFIG from '../config';
import { ChevronDown } from 'lucide-react';

const Header = ({ mode, setMode, onOpenKeys }) => {
  const [models, setModels] = useState({});
  const [currentProvider, setCurrentProvider] = useState('gemini');
  const [currentModel, setCurrentModel] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [showKeys, setShowKeys] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const clearLocalStorage = () => {
    if (window.confirm('Are you sure you want to clear all storage data? This will remove all saved scenes, verification data, and settings.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // Identify the provider from the model name
  const getProviderForModel = (modelName) => {
    if (!modelName) return currentProvider;
    // Check if it's a Gemini model
    if (modelName.includes('gemini') || modelName.includes('flash') || modelName.includes('pro')) {
      return 'gemini';
    }
    // Check if it's an OpenAI model
    if (modelName.includes('gpt') || modelName.includes('openai')) {
      return 'openai';
    }
    // Default to current provider
    return currentProvider;
  };

  // Fetch available models from server
  const fetchModels = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.LLM_MODELS}`);
      if (response.ok) {
        const data = await response.json();
        setModels(data.availableModels);
        setCurrentProvider(data.currentProvider);
        setCurrentModel(data.currentModel);
      } else {
        console.error('Failed to fetch models');
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
  };

  // Fetch available models on component mount
  useEffect(() => {
    fetchModels();
  }, []);

  // Refresh models when provider changes elsewhere (e.g., from Keys modal)
  useEffect(() => {
    const onProviderChanged = async () => {
      await fetchModels();
    };
    window.addEventListener('llm-provider-changed', onProviderChanged);
    return () => window.removeEventListener('llm-provider-changed', onProviderChanged);
  }, []);

  // Update the model when selected
  const handleModelChange = async (model) => {
    try {
      // Use the current provider from state
      const provider = currentProvider;
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_MODEL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider,
          model
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Model updated to ${model} using provider ${provider}`);
        setCurrentModel(model);
        setCurrentProvider(provider);
        setShowModelDropdown(false);
      } else {
        console.error('Failed to update model');
      }
    } catch (error) {
      console.error('Error updating model:', error);
    }
  };

  // Function to get a formatted model name for display
  const getDisplayModelName = (modelName) => {
    if (!modelName) return 'Select Model';
    
    // Determine provider for prefixing
    const provider = getProviderForModel(modelName);
    const prefix = provider === 'gemini' ? '🌀 ' : '🔄 ';
    
    // Return the full model name with appropriate prefix
    return `${prefix}${modelName}`;
  };

  // Models for the active provider
  const getProviderModels = () => {
    // Server already scopes models by current provider
    return Object.values(models || {});
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const providerModels = getProviderModels();

  const saveApiKey = async (provider, apiKey) => {
    if (!apiKey) return;
    // Trim and strip whitespace characters before sending
    const cleaned = apiKey.trim().replace(/\s+/g, '');
    setSavingKey(true);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SET_LLM_KEYS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: cleaned })
      });
      if (!response.ok) throw new Error('Failed to save API key');
      // Close keys panel after successful save
      setShowKeys(false);
      if (provider === 'gemini') {
        setGeminiKey('');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save API key');
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full h-10 bg-white border-b border-gray-200 z-[1000]">
      <div className="flex h-full px-5 relative">
        {/* Left section */}
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-gray-900">DialogLab</span>
          <span className="text-gray-400">|</span>
          <span className="text-sm text-gray-500">v1.0.0</span>
        </div>

        {/* Center section with mode toggles - positioned absolutely to center it */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex">
          <button
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'authoring' 
                ? 'bg-sky-100 text-sky-800' 
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setMode('authoring')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-sky-600">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
            <span>Authoring</span>
          </button>
          {/* <button
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'experience' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setMode('experience')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-600">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Experience</span>
          </button> */}
          <button
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'verification' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setMode('verification')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-green-600">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            <span>Verification</span>
          </button>
        </div>

        {/* Right section - ml-auto pushes it to the right */}
        <div className="flex gap-2 items-center ml-auto">
          <ThemeToggle buttonClassName="flex items-center justify-center p-1.5 w-8 h-8 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200" />
          {/* <button className="px-4 py-1.5 rounded-md text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors">
            Save Project
          </button> */}
          <button 
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            onClick={clearLocalStorage}
            title="Clear all local storage data"
          >
            Clear Storage
          </button>

          {/* API Key toggle */}
          <button
            className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            onClick={() => (onOpenKeys ? onOpenKeys() : setShowKeys(!showKeys))}
            title="Set API keys"
          >
            Keys
          </button>
          
          {/* Model selection dropdown */}
          <div className="relative inline-flex" ref={dropdownRef}>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              onClick={async () => {
                if (!showModelDropdown) {
                  await fetchModels();
                }
                setShowModelDropdown(!showModelDropdown);
              }}
              title="Select LLM Model"
            >
              <span className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${currentProvider === 'gemini' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                <span>{currentModel}</span>
              </span>
              <ChevronDown size={14} className="opacity-70" />
            </button>
            
            {showModelDropdown && (
              <div className="absolute top-full right-0 w-[250px] bg-white border border-gray-200 rounded-md shadow-lg z-[1000] mt-1 overflow-hidden">
                <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-medium">
                  {currentProvider === 'gemini' ? 'Gemini Models' : 'OpenAI Models'}
                </div>
                {providerModels.map((model) => (
                  <div 
                    key={model} 
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors whitespace-nowrap overflow-hidden text-ellipsis ${
                      model === currentModel 
                        ? 'bg-blue-50 text-blue-600 relative' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => handleModelChange(model)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${currentProvider === 'gemini' ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                      {model}
                    </div>
                    {model === currentModel && <span className="absolute right-3">✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keys panel */}
      {!onOpenKeys && showKeys && (
        <div className="absolute top-10 right-5 w-[360px] bg-white border border-gray-200 rounded-md shadow-lg z-[1000] p-3">
          <div className="text-sm font-medium text-gray-700 mb-2">Provider API Keys</div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Gemini API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                  placeholder="AIza..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <button
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white disabled:opacity-50"
                  disabled={savingKey || !geminiKey}
                  onClick={() => saveApiKey('gemini', geminiKey)}
                >
                  {savingKey ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;