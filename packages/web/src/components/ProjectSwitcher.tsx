import { useState } from 'react';
import { FolderOpen, ChevronDown, Settings, Plus } from 'lucide-react';
import { useAllProjects, getSavedProjects, saveProjectKey, setApiKey } from '../api/client.js';
import { useQueryClient } from '@tanstack/react-query';

interface ProjectSwitcherProps {
  currentProjectId: string;
  currentProjectName: string;
  onSettingsClick: () => void;
}

export function ProjectSwitcher({ currentProjectId, currentProjectName, onSettingsClick }: ProjectSwitcherProps) {
  const { data: allProjects } = useAllProjects();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addingProject, setAddingProject] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');

  const savedProjects = getSavedProjects();
  const otherProjects = (allProjects || []).filter(p => p.id !== currentProjectId);

  function switchToProject(projectId: string) {
    const key = savedProjects[projectId];
    if (key) {
      setApiKey(key);
      saveProjectKey(currentProjectId, localStorage.getItem('agentboard_api_key') || '');
      queryClient.clear();
      window.location.reload();
    } else {
      setAddingProject(projectId);
      setKeyInput('');
    }
  }

  function connectProject() {
    if (!keyInput.trim() || !addingProject) return;
    saveProjectKey(addingProject, keyInput.trim());
    // Save current project key too
    saveProjectKey(currentProjectId, localStorage.getItem('agentboard_api_key') || '');
    setApiKey(keyInput.trim());
    queryClient.clear();
    window.location.reload();
  }

  // Auto-save current project key
  if (currentProjectId && !savedProjects[currentProjectId]) {
    saveProjectKey(currentProjectId, localStorage.getItem('agentboard_api_key') || '');
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors group"
      >
        <FolderOpen className="w-4 h-4 text-gray-500 group-hover:text-violet-400" />
        <span className="font-medium max-w-[150px] truncate">{currentProjectName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setAddingProject(null); }} />
          <div className="absolute top-full left-0 mt-2 w-72 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Current project */}
            <div className="px-3 py-2 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-400" />
                  <span className="text-sm text-white font-medium truncate">{currentProjectName}</span>
                </div>
                <button
                  onClick={() => { setOpen(false); onSettingsClick(); }}
                  className="text-gray-500 hover:text-violet-400 transition-colors p-1"
                  title="Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Other projects */}
            {otherProjects.length > 0 && (
              <div className="py-1">
                <p className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase">Switch to</p>
                {otherProjects.map(p => (
                  <div key={p.id}>
                    <button
                      onClick={() => switchToProject(p.id)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <div className={`w-2 h-2 rounded-full ${savedProjects[p.id] ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                      <span className="truncate">{p.name}</span>
                      {!savedProjects[p.id] && (
                        <span className="text-[10px] text-gray-600 ml-auto">needs key</span>
                      )}
                    </button>
                    {addingProject === p.id && (
                      <div className="px-3 pb-2 flex gap-1.5">
                        <input
                          value={keyInput}
                          onChange={e => setKeyInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && connectProject()}
                          placeholder="Paste API key..."
                          autoFocus
                          className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        />
                        <button
                          onClick={connectProject}
                          disabled={!keyInput.trim()}
                          className="px-2 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white text-xs rounded"
                        >
                          Go
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {otherProjects.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-500">No other projects</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
