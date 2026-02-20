import { useState } from 'react';
import { X, Copy, Check, Key, Bot } from 'lucide-react';
import { useProject, useUpdateProject, useProjectApiKeys, setApiKey, getStoredApiKey } from '../api/client.js';
import { useQueryClient } from '@tanstack/react-query';
import type { Role } from '@agentboard/shared';

interface ProjectSettingsProps {
  projectId: string;
  role?: Role;
  onClose: () => void;
}

const ROLE_LABELS: Record<Role, string> = { pm: 'PM', dev: 'Dev', human: 'Human' };
const ROLE_COLORS: Record<Role, string> = {
  pm: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  dev: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  human: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

export function ProjectSettings({ projectId, role, onClose }: ProjectSettingsProps) {
  const { data: project } = useProject(projectId);
  const { data: apiKeys } = useProjectApiKeys(projectId, true);
  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAnthropicKey, setEditAnthropicKey] = useState('');
  const [editTgToken, setEditTgToken] = useState('');
  const [editTgChat, setEditTgChat] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!project) return null;

  function startEdit() {
    setEditName(project!.name);
    setEditDesc(project!.description || '');
    setEditAnthropicKey(project!.anthropicApiKey || '');
    setEditTgToken(project!.telegramBotToken || '');
    setEditTgChat(project!.telegramChatId || '');
    setEditing(true);
  }

  function saveEdit() {
    updateProject.mutate({
      id: projectId,
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      anthropicApiKey: editAnthropicKey.trim() || undefined,
      telegramBotToken: editTgToken.trim() || undefined,
      telegramChatId: editTgChat.trim() || undefined,
    }, { onSuccess: () => setEditing(false) });
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function switchRole(key: string) {
    setApiKey(key);
    queryClient.clear();
    window.location.reload();
  }

  const currentKey = getStoredApiKey();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-12 px-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-lg shadow-2xl mb-12" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Project Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Project Info */}
        <div className="p-5 border-b border-gray-800">
          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</label>
                <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" />
                  Anthropic API Key
                </label>
                <input
                  type="password"
                  value={editAnthropicKey}
                  onChange={e => setEditAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <p className="text-[10px] text-gray-600 mt-1">Required for AI Chat. Get one at console.anthropic.com</p>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Telegram Bot Token</label>
                  <input value={editTgToken} onChange={e => setEditTgToken(e.target.value)} placeholder="bot123:ABC..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Chat ID</label>
                  <input value={editTgChat} onChange={e => setEditTgChat(e.target.value)} placeholder="-100..." className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">Cancel</button>
                <button onClick={saveEdit} disabled={!editName.trim() || updateProject.isPending} className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white rounded-lg">
                  {updateProject.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h3 className="text-white font-semibold">{project.name}</h3>
              {project.description && <p className="text-sm text-gray-400 mt-1">{project.description}</p>}
              {project.anthropicApiKey && (
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
                  AI Chat: configured
                </p>
              )}
              {!project.anthropicApiKey && role === 'human' && (
                <p className="text-xs text-amber-400/70 mt-2 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5" />
                  AI Chat: not configured — click Edit to add Anthropic API Key
                </p>
              )}
              {(project.telegramBotToken || project.telegramChatId) && (
                <p className="text-xs text-gray-500 mt-2">Telegram: configured</p>
              )}
              {role === 'human' && (
                <button onClick={startEdit} className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Edit Settings
                </button>
              )}
            </div>
          )}
        </div>

        {/* API Keys (all roles — allows switching back) */}
        {apiKeys && (
          <div className="p-5 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              API Keys
            </h3>
            <div className="space-y-2">
              {apiKeys.map(k => (
                <div key={k.id} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${ROLE_COLORS[k.role]}`}>
                    {ROLE_LABELS[k.role]}
                  </span>
                  <code className="text-xs text-gray-400 flex-1 truncate">{k.key}</code>
                  <button
                    onClick={() => copyKey(k.key)}
                    className="text-gray-500 hover:text-white transition-colors p-1"
                    title="Copy key"
                  >
                    {copiedKey === k.key ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  {k.key !== currentKey && (
                    <button
                      onClick={() => switchRole(k.key)}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Switch
                    </button>
                  )}
                  {k.key === currentKey && (
                    <span className="text-[10px] text-gray-500">current</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project ID */}
        <div className="p-5">
          <p className="text-xs text-gray-600">Project ID: <code className="text-gray-500">{projectId}</code></p>
        </div>
      </div>
    </div>
  );
}
