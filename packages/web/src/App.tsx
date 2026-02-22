import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Board } from './components/Board.js';
import { ItemDetail } from './components/ItemDetail.js';
import { CreateItemForm } from './components/CreateItemForm.js';
import { SprintFilter } from './components/SprintFilter.js';
import { ProjectSettings } from './components/ProjectSettings.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { Roadmap } from './components/Roadmap.js';
import { FileBrowser } from './components/FileBrowser.js';
import { GlobalSettings } from './components/GlobalSettings.js';
import { Sidebar, type Page } from './components/Sidebar.js';
import { ProjectsPage } from './components/ProjectsPage.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useItems, useAuthMe, useProject, setApiKey, getStoredApiKey, clearApiKey, createProject, createDemoProject, saveProjectKey } from './api/client.js';
import { Plus, Zap, KeyRound, Sun, Moon, Play, FolderOpen } from 'lucide-react';
import { relativeTime } from './lib/utils.js';
import { useTheme } from './hooks/useTheme.js';
import type { Role } from '@agentboard/shared';

const ROLE_LABELS: Record<Role, string> = { pm: 'PM', dev: 'Dev', human: 'Human' };
const ROLE_COLORS: Record<Role, string> = {
  pm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  dev: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  human: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export default function App() {
  const [apiKey, setKey] = useState(getStoredApiKey());
  const [keyInput, setKeyInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string>('');
  const [showSetup, setShowSetup] = useState(false);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [setupResult, setSetupResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [demoLoading, setDemoLoading] = useState(false);
  const [activePage, setActivePage] = useState<Page>('board');
  const [existingProjects, setExistingProjects] = useState<{ id: string; name: string; humanKey: string | null; createdAt: string | null }[]>([]);

  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  useWebSocket();

  const { data: authMe } = useAuthMe();
  const role = authMe?.role;
  const { data: projectData } = useProject(authMe?.projectId || '');
  const { data: items, isError } = useItems(sprintFilter ? { sprintTag: sprintFilter } : undefined);

  useEffect(() => {
    if (isError && apiKey) {
      setError('Invalid API key or server error');
    }
  }, [isError, apiKey]);

  // Fetch existing projects for login screen (no auth needed)
  useEffect(() => {
    if (!apiKey) {
      fetch('/api/projects').then(r => r.ok ? r.json() : []).then(setExistingProjects).catch(() => {});
    }
  }, [apiKey]);

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
      const result = await createProject({
        name: projectName.trim(),
        localPath: projectPath.trim() || undefined,
      });
      setSetupResult(result);
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleOpenProject(humanKey: string | null) {
    if (!humanKey) {
      setError('No API key found for this project');
      return;
    }
    saveProjectKey('_last', humanKey);
    setApiKey(humanKey);
    setKey(humanKey);
    queryClient.invalidateQueries();
  }

  async function handleTryDemo() {
    setDemoLoading(true);
    setError('');
    try {
      const { humanKey } = await createDemoProject();
      setApiKey(humanKey);
      setKey(humanKey);
      queryClient.invalidateQueries();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDemoLoading(false);
    }
  }

  function handleNavigate(page: Page) {
    if (page === 'files') {
      setShowFiles(true);
      return;
    }
    if (page === 'settings') {
      setShowGlobalSettings(true);
      return;
    }
    setActivePage(page);
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative">
        <button
          onClick={toggleTheme}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
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
                {existingProjects.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                      <FolderOpen className="w-3.5 h-3.5" />
                      Your Projects
                    </p>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {existingProjects.map(proj => (
                        <button
                          key={proj.id}
                          onClick={() => handleOpenProject(proj.humanKey)}
                          className="w-full bg-gray-800 hover:bg-gray-750 hover:border-violet-500/40 border border-gray-700 rounded-lg p-3 flex items-center justify-between transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm text-white truncate block">{proj.name}</span>
                            {proj.createdAt && (
                              <p className="text-[10px] text-gray-500">{relativeTime(proj.createdAt)}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-violet-400 font-medium">Open →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <button
                    onClick={handleTryDemo}
                    disabled={demoLoading}
                    className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {demoLoading ? 'Creating demo...' : 'Try Demo'}
                  </button>
                  <p className="text-center text-gray-500 text-xs mt-1.5">Explore with sample data, no signup needed</p>
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
                <label className="block text-sm font-medium text-gray-300 mb-2 mt-3">Local Path (optional)</label>
                <input
                  type="text"
                  value={projectPath}
                  onChange={(e) => setProjectPath(e.target.value)}
                  placeholder="/Users/you/projects/myapp"
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm font-mono"
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
          {projectData && (
            <span className="text-sm text-gray-400 font-medium max-w-[200px] truncate">
              {projectData.name}
            </span>
          )}
          {role && (
            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${ROLE_COLORS[role]}`}>
              {ROLE_LABELS[role]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activePage === 'board' && (
            <SprintFilter sprints={sprints} value={sprintFilter} onChange={setSprintFilter} />
          )}
          {role && (
            <button
              onClick={() => setShowCreateItem(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Item
            </button>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          hasLocalPath={!!projectData?.localPath}
          role={role}
          onLogout={handleLogout}
        />

        {activePage === 'board' && (
          <main className="flex-1 overflow-hidden">
            <Board
              items={items || []}
              role={role}
              onItemClick={(id) => setSelectedItemId(id)}
            />
          </main>
        )}

        {activePage === 'projects' && (
          <ProjectsPage currentProjectId={authMe?.projectId} />
        )}

        {activePage === 'roadmap' && (
          <Roadmap
            role={role}
            onItemClick={(id) => setSelectedItemId(id)}
          />
        )}

        {activePage === 'activity' && (
          <ActivityFeed
            onItemClick={(id) => setSelectedItemId(id)}
          />
        )}
      </div>

      {selectedItemId && (
        <ItemDetail
          itemId={selectedItemId}
          role={role}
          allItems={items || []}
          onClose={() => setSelectedItemId(null)}
        />
      )}

      {showCreateItem && (
        <CreateItemForm onClose={() => setShowCreateItem(false)} />
      )}

      {showFiles && authMe?.projectId && (
        <FileBrowser
          projectId={authMe.projectId}
          onClose={() => setShowFiles(false)}
        />
      )}

      {showGlobalSettings && (
        <GlobalSettings onClose={() => setShowGlobalSettings(false)} />
      )}

      {showProjectSettings && authMe?.projectId && (
        <ProjectSettings
          projectId={authMe.projectId}
          role={role}
          onClose={() => setShowProjectSettings(false)}
        />
      )}
    </div>
  );
}
