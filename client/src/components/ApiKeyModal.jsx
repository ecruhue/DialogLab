import React, { useState, useEffect } from 'react';
import API_CONFIG from '../config';

const ApiKeyModal = ({ missing, provider = 'gemini', onSelectProvider, onClose, onSaved }) => {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [ttsKey, setTtsKey] = useState('');
  const [saving, setSaving] = useState(false);

  const saveLocal = (provider, key) => {
    const cleaned = (key || '').trim();
    if (!cleaned) return;
    if (provider === 'openai') localStorage.setItem('OPENAI_API_KEY', cleaned);
    if (provider === 'gemini') localStorage.setItem('GEMINI_API_KEY', cleaned);
    if (provider === 'tts') localStorage.setItem('TTS_API_KEY', cleaned);
  };

  const saveToServer = async (provider, key) => {
    const response = await fetch(`${API_CONFIG.BASE_URL}/api/llm-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider, apiKey: key }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to save API key to server');
    }
    
    return response.json();
  };

  const handleSaveAll = async () => {
    try {
      setSaving(true);
      const tasks = [];
      
      // Save to server first, then to localStorage
      if (provider === 'openai' && openaiKey) {
        tasks.push(saveToServer('openai', openaiKey));
        tasks.push(Promise.resolve(saveLocal('openai', openaiKey)));
      }
      if (provider === 'gemini' && geminiKey) {
        tasks.push(saveToServer('gemini', geminiKey));
        tasks.push(Promise.resolve(saveLocal('gemini', geminiKey)));
      }
      if (ttsKey) {
        tasks.push(saveToServer('tts', ttsKey));
        tasks.push(Promise.resolve(saveLocal('tts', ttsKey)));
      }
      
      await Promise.all(tasks);
      
      // Set the provider on the server
      if (provider && (openaiKey || geminiKey)) {
        try {
          await fetch(`${API_CONFIG.BASE_URL}/api/llm-provider`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ provider }),
          });
          // Notify the app that provider changed so dropdown can refresh immediately
          try {
            window.dispatchEvent(new CustomEvent('llm-provider-changed', { detail: { provider } }));
          } catch {}
        } catch (error) {
          console.error('Failed to set provider:', error);
        }
      }
      
      onSaved?.();
      onClose?.();
    } catch (e) {
      alert(e.message || 'Failed to save keys');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const storedOpenAI = localStorage.getItem('OPENAI_API_KEY') || '';
    const storedGemini = localStorage.getItem('GEMINI_API_KEY') || '';
    const storedTts = localStorage.getItem('TTS_API_KEY') || '';
    setOpenaiKey(storedOpenAI);
    setGeminiKey(storedGemini);
    setTtsKey(storedTts);
  }, [provider]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white rounded-lg p-6 w-[460px] shadow-xl">
        <h2 className="text-lg font-semibold mb-1">Select provider and enter keys</h2>
        <p className="text-sm text-gray-600 mb-4">Choose the default LLM provider, then enter the required keys.</p>

        <div className="mb-4">
          <label className="block text-xs text-gray-600 mb-1">Default LLM Provider</label>
          <div className="flex gap-2">
            <button
              className={`px-3 py-1.5 rounded-md border ${provider === 'gemini' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              onClick={() => onSelectProvider?.('gemini')}
            >Gemini</button>
            <button
              className={`px-3 py-1.5 rounded-md border ${provider === 'openai' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
              onClick={() => onSelectProvider?.('openai')}
            >OpenAI</button>
          </div>
        </div>

        <div className="space-y-3">
          {provider === 'openai' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">OpenAI API Key</label>
              <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="sk-..." value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} />
            </div>
          )}
          {provider === 'gemini' && (
            <div>
              <label className="block text-xs text-gray-600 mb-1">Gemini API Key</label>
              <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="AIza..." value={geminiKey} onChange={e => setGeminiKey(e.target.value)} />
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-600 mb-1">TTS API Key</label>
            <input type="password" className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="Google TTS key" value={ttsKey} onChange={e => setTtsKey(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button className="px-4 py-2 border border-gray-300 rounded-md" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50" onClick={handleSaveAll} disabled={saving}> {saving ? 'Saving...' : 'Save'} </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;


