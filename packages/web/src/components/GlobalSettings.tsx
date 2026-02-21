import { useState, useEffect } from 'react';
import { X, Bot, Check } from 'lucide-react';
import { useSettings, useUpdateSettings } from '../api/client.js';

interface GlobalSettingsProps {
  onClose: () => void;
}

export function GlobalSettings({ onClose }: GlobalSettingsProps) {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [anthropicKey, setAnthropicKey] = useState('');
  const [saved, setSaved] = useState(false);

  const isKeySet = settings?.['anthropic_api_key_set'] === true;
  const isEnvSet = settings?.['anthropic_api_key_env'] === true;

  function handleSave() {
    const updates: Record<string, string | null> = {};
    if (anthropicKey.trim()) {
      updates.anthropic_api_key = anthropicKey.trim();
    }
    updateSettings.mutate(updates, {
      onSuccess: () => {
        setSaved(true);
        setAnthropicKey('');
        setTimeout(() => setSaved(false), 2000);
      },
    });
  }

  function handleClear() {
    updateSettings.mutate({ anthropic_api_key: null }, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Global Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" />
              Anthropic API Key
            </label>
            <p className="text-[10px] text-gray-600 mb-2">
              Used by all projects unless overridden in Project Settings.
              Fallback chain: Project key → Global key → Environment variable.
            </p>

            {/* Status */}
            <div className="flex flex-col gap-1 mb-3">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${isKeySet ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                <span className="text-gray-400">Global key: {isKeySet ? 'configured' : 'not set'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${isEnvSet ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                <span className="text-gray-400">Env var (ANTHROPIC_API_KEY): {isEnvSet ? 'detected' : 'not set'}</span>
              </div>
            </div>

            <input
              type="password"
              value={anthropicKey}
              onChange={e => setAnthropicKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder={isKeySet ? 'Enter new key to replace...' : 'sk-ant-...'}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {updateSettings.isError && (
            <p className="text-xs text-red-400">{(updateSettings.error as Error).message}</p>
          )}
        </div>

        <div className="flex items-center justify-between p-5 pt-0">
          {isKeySet ? (
            <button
              onClick={handleClear}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Clear global key
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={!anthropicKey.trim() || updateSettings.isPending}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {updateSettings.isPending ? 'Saving...' : 'Save Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
