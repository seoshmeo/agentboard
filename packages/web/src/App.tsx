import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Board } from './components/Board.js';
import { ItemDetail } from './components/ItemDetail.js';
import { SprintFilter } from './components/SprintFilter.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useItems, setApiKey, getStoredApiKey, clearApiKey, createProject } from './api/client.js';
import { LogOut, Plus, Zap, KeyRound } from 'lucide-react';

export default function App() {
  const [apiKey, setKey] = useState(getStoredApiKey());
  const [keyInput, setKeyInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string>('');
  const [showSetup, setShowSetup] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [setupResult, setSetupResult] = useState<any>(null);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();
  useWebSocket();

  const { data: items, isError } = useItems(sprintFilter ? { sprintTag: sprintFilter } : undefined);

  useEffect(() => {
    if (isError && apiKey) {
      setError('Invalid API key or server error');
    }
  }, [isError, apiKey]);

  function handleLogin() {
    if (!keyInput.trim()) return;
    setApiKey(keyInput.trim());
    setKey(keyInput.trim());
    setError('');
    queryClient.invalidateQueries();
  }

  function handleLogout() {
    clearApiKey();
    setKey('');
    setKeyInput('');
    setError('');
    queryClient.clear();
  }

  async function handleCreateProject() {
    if (!projectName.trim()) return;
    try {
      const result = await createProject({ name: projectName.trim() });
      setSetupResult(result);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <Zap className="w-8 h-8 text-violet-400" />
              <h1 className="text-3xl font-bold text-white tracking-tight">AgentBoard</h1>
            </div>
            <p className="text-gray-400 text-sm">Acceptance-driven development for AI agents</p>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-2xl">
            {!showSetup ? (
              <>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <KeyRound className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  API Key
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Paste your API key..."
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                />
                {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                <button
                  onClick={handleLogin}
                  className="w-full mt-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Connect
                </button>
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => setShowSetup(true)}
                    className="w-full py-2 text-gray-400 hover:text-white text-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Project
                  </button>
                </div>
              </>
            ) : setupResult ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Project Created!</h3>
                <p className="text-sm text-gray-400">Save these API keys — they won't be shown again.</p>
                <div className="space-y-2">
                  {setupResult.apiKeys.map((k: any) => (
                    <div key={k.id} className="bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-400 uppercase">{k.role}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(k.key)}
                          className="text-xs text-violet-400 hover:text-violet-300"
                        >
                          Copy
                        </button>
                      </div>
                      <code className="text-xs text-gray-300 break-all">{k.key}</code>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const humanKey = setupResult.apiKeys.find((k: any) => k.role === 'human')?.key;
                    if (humanKey) {
                      setApiKey(humanKey);
                      setKey(humanKey);
                    }
                    setShowSetup(false);
                    setSetupResult(null);
                    setProjectName('');
                    queryClient.invalidateQueries();
                  }}
                  className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Continue as Human
                </button>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  placeholder="My Awesome Project"
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
                />
                {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => { setShowSetup(false); setError(''); }}
                    className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium text-sm transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreateProject}
                    className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    Create
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const sprints = [...new Set((items || []).map(i => i.sprintTag).filter(Boolean))] as string[];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-violet-400" />
          <h1 className="text-lg font-bold text-white tracking-tight">AgentBoard</h1>
        </div>
        <div className="flex items-center gap-3">
          <SprintFilter sprints={sprints} value={sprintFilter} onChange={setSprintFilter} />
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Board
          items={items || []}
          onItemClick={(id) => setSelectedItemId(id)}
        />
      </main>

      {selectedItemId && (
        <ItemDetail
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </div>
  );
}
