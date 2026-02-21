import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X, Loader2, Unplug } from 'lucide-react';
import {
  useAllProjects,
  validateApiKey,
  setApiKey,
  createProject,
  getSavedProjects,
  saveProjectKey,
  removeProjectKey,
  getStoredApiKey,
} from '../api/client.js';
import { cn } from '../lib/utils.js';
import { relativeTime } from '../lib/utils.js';

interface ProjectsPageProps {
  currentProjectId?: string;
}

export function ProjectsPage({ currentProjectId }: ProjectsPageProps) {
  const { data: allProjects, isLoading } = useAllProjects();
  const queryClient = useQueryClient();
  const savedProjects = getSavedProjects();

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');

  // Create project state
  const [showCreate, setShowCreate] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [creating, setCreating] = useState(false);
  const [setupResult, setSetupResult] = useState<any>(null);

  async function handleConnect(projectId: string) {
    if (!keyInput.trim()) return;
    setValidating(true);
    setError('');

    const result = await validateApiKey(keyInput.trim());
    setValidating(false);

    if (!result) {
      setError('Invalid API key');
      return;
    }
    if (result.projectId !== projectId) {
      setError('This key belongs to a different project');
      return;
    }

    // Save current project key before switching
    if (currentProjectId) {
      saveProjectKey(currentProjectId, getStoredApiKey());
    }
    saveProjectKey(projectId, keyInput.trim());
    setApiKey(keyInput.trim());
    queryClient.clear();
    window.location.reload();
  }

  async function handleSwitch(projectId: string) {
    const key = savedProjects[projectId];
    if (!key) {
      setConnectingId(projectId);
      setKeyInput('');
      setError('');
      return;
    }

    setValidating(true);
    setError('');

    const result = await validateApiKey(key);
    setValidating(false);

    if (!result || result.projectId !== projectId) {
      removeProjectKey(projectId);
      setError('Saved key is no longer valid. Please enter a new key.');
      setConnectingId(projectId);
      setKeyInput('');
      return;
    }

    // Save current project key before switching
    if (currentProjectId) {
      saveProjectKey(currentProjectId, getStoredApiKey());
    }
    setApiKey(key);
    queryClient.clear();
    window.location.reload();
  }

  function handleDisconnect(projectId: string) {
    removeProjectKey(projectId);
    // Force re-render
    setConnectingId(null);
    setKeyInput('');
    setError('');
  }

  async function handleCreateProject() {
    if (!projectName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const result = await createProject({
        name: projectName.trim(),
        localPath: projectPath.trim() || undefined,
      });
      setSetupResult(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  function handleUseCreatedProject() {
    if (!setupResult) return;
    const humanKey = setupResult.apiKeys.find((k: any) => k.role === 'human')?.key;
    if (humanKey) {
      if (currentProjectId) {
        saveProjectKey(currentProjectId, getStoredApiKey());
      }
      setApiKey(humanKey);
      queryClient.clear();
      window.location.reload();
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Projects</h1>
          {!showCreate && !setupResult && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project
            </button>
          )}
        </div>

        {/* Project list */}
        {isLoading && <p className="text-sm text-gray-500">Loading projects...</p>}

        <div className="space-y-2 mb-8">
          {allProjects?.map(project => {
            const isCurrent = project.id === currentProjectId;
            const isConnected = !!savedProjects[project.id];
            const isConnecting = connectingId === project.id;

            return (
              <div
                key={project.id}
                className={cn(
                  'bg-gray-900 rounded-xl border p-4',
                  isCurrent ? 'border-violet-500/50' : 'border-gray-800'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-2.5 h-2.5 rounded-full shrink-0',
                        isCurrent ? 'bg-violet-400' : isConnected ? 'bg-emerald-400' : 'bg-gray-600'
                      )}
                      title={isCurrent ? 'Current' : isConnected ? 'Connected' : 'Not connected'}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">{project.name}</h3>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full border bg-violet-500/20 text-violet-400 border-violet-500/30">
                            Current
                          </span>
                        )}
                      </div>
                      {project.createdAt && (
                        <p className="text-[10px] text-gray-600">Created {relativeTime(project.createdAt)}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!isCurrent && isConnected && (
                      <>
                        <button
                          onClick={() => handleSwitch(project.id)}
                          disabled={validating}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors disabled:opacity-50"
                        >
                          {validating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Switch'}
                        </button>
                        <button
                          onClick={() => handleDisconnect(project.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-gray-800"
                          title="Disconnect"
                        >
                          <Unplug className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {!isCurrent && !isConnected && !isConnecting && (
                      <button
                        onClick={() => {
                          setConnectingId(project.id);
                          setKeyInput('');
                          setError('');
                        }}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>

                {isConnecting && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <div className="flex gap-2">
                      <input
                        value={keyInput}
                        onChange={e => setKeyInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConnect(project.id)}
                        placeholder="Paste API key for this project..."
                        autoFocus
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        onClick={() => handleConnect(project.id)}
                        disabled={!keyInput.trim() || validating}
                        className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {validating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        {validating ? 'Validating...' : 'Connect'}
                      </button>
                      <button
                        onClick={() => { setConnectingId(null); setError(''); }}
                        className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {error && connectingId === project.id && (
                      <p className="text-red-400 text-xs mt-2">{error}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {allProjects && allProjects.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-2">No projects yet</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Create your first project
              </button>
            </div>
          )}
        </div>

        {/* Create project form */}
        {showCreate && !setupResult && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Create New Project</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Project Name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                  placeholder="My Awesome Project"
                  autoFocus
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Local Path (optional)</label>
                <input
                  type="text"
                  value={projectPath}
                  onChange={e => setProjectPath(e.target.value)}
                  placeholder="/Users/you/projects/myapp"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => { setShowCreate(false); setError(''); setProjectName(''); setProjectPath(''); }}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!projectName.trim() || creating}
                  className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Setup result — show API keys */}
        {setupResult && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Project Created!</h2>
            <p className="text-sm text-gray-400 mb-4">Save these API keys — they won't be shown again.</p>
            <div className="space-y-2 mb-4">
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
              onClick={handleUseCreatedProject}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium text-sm transition-colors"
            >
              Continue as Human
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
