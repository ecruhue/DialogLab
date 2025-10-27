import { useEffect, useState } from 'react';
import Home from './components/Home';
import { ThemeProvider } from './components/theme/ThemeContext';
import './components/theme/theme.css';
import './components/theme/theme-utils.css';
import './App.css';
import ApiKeyModal from './components/ApiKeyModal';

function App() {
  const [missingKeys, setMissingKeys] = useState({ openai: false, gemini: false, tts: false });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [provider, setProvider] = useState('gemini');

  const refreshStatus = async () => {
    // Compute missing keys locally (per-user)
    const p = localStorage.getItem('LLM_PROVIDER') || provider || 'gemini';
    setProvider(p);
    const nextMissing = {
      openai: p === 'openai' ? !(localStorage.getItem('OPENAI_API_KEY')) : false,
      gemini: p === 'gemini' ? !(localStorage.getItem('GEMINI_API_KEY')) : false,
      tts: !(localStorage.getItem('TTS_API_KEY')),
    };
    setMissingKeys(nextMissing);
    setShowKeyModal(nextMissing.openai || nextMissing.gemini || nextMissing.tts);
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  useEffect(() => {
    const handler = () => setShowKeyModal(true);
    window.addEventListener('open-api-key-modal', handler);
    return () => window.removeEventListener('open-api-key-modal', handler);
  }, []);
  return (
    <ThemeProvider>
      <div className="App">
        <Home />
        {showKeyModal && (
          <ApiKeyModal
            missing={missingKeys}
            provider={provider}
            onSelectProvider={(p) => {
              localStorage.setItem('LLM_PROVIDER', p);
              setProvider(p); // keep modal open; don't refresh/close here
            }}
            onClose={() => setShowKeyModal(false)}
            onSaved={refreshStatus}
          />
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;