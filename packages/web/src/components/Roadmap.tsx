import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useEpics, useCreateEpic, useUpdateEpic, useDeleteEpic, useItems, type EpicWithCounts } from '../api/client.js';
import { cn, STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS } from '../lib/utils.js';
import type { Role, Item } from '@agentboard/shared';

interface RoadmapProps {
  role?: Role;
  onItemClick: (id: string) => void;
}

const EPIC_STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

function EpicCard({
  epic,
  items,
  role,
  onItemClick,
  onEdit,
  onDelete,
}: {
  epic: EpicWithCounts;
  items: Item[];
  role?: Role;
  onItemClick: (id: string) => void;
  onEdit: (epic: EpicWithCounts) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const epicItems = items.filter(i => i.epicId === epic.id);
  const doneCount = epicItems.filter(i => i.status === 'done' || i.status === 'accepted').length;
  const progress = epicItems.length > 0 ? (doneCount / epicItems.length) * 100 : 0;
  const canManage = role === 'pm' || role === 'human';

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-white transition-colors">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white truncate">{epic.title}</h3>
            <span className={cn('text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full border', EPIC_STATUS_COLORS[epic.status])}>
              {epic.status}
            </span>
          </div>
          {epic.description && (
            <p className="text-xs text-gray-500 truncate">{epic.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500">{doneCount}/{epicItems.length}</span>
          <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {canManage && (
            <>
              <button onClick={() => onEdit(epic)} className="text-gray-600 hover:text-violet-400 transition-colors p-1" title="Edit epic">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(epic.id)} className="text-gray-600 hover:text-red-400 transition-colors p-1" title="Delete epic">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && epicItems.length > 0 && (
        <div className="border-t border-gray-800">
          {epicItems.map(item => (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/50 transition-colors text-left border-b border-gray-800/50 last:border-b-0"
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLORS[item.status])} />
              <span className="text-sm text-gray-300 flex-1 truncate">{item.title}</span>
              <span className={cn('text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border shrink-0', PRIORITY_COLORS[item.priority])}>
                {item.priority}
              </span>
              <span className="text-[10px] text-gray-600 shrink-0">{STATUS_LABELS[item.status]}</span>
            </button>
          ))}
        </div>
      )}

      {expanded && epicItems.length === 0 && (
        <div className="border-t border-gray-800 px-4 py-3">
          <p className="text-xs text-gray-600 italic">No items in this epic</p>
        </div>
      )}
    </div>
  );
}

function EpicForm({
  initial,
  onSubmit,
  onCancel,
  isPending,
}: {
  initial?: { title: string; description: string; status: string };
  onSubmit: (data: { title: string; description?: string; status?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [status, setStatus] = useState(initial?.status || 'planned');

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      status,
    });
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="Epic title"
        autoFocus
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
      />
      <select
        value={status}
        onChange={e => setStatus(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        <option value="planned">Planned</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || isPending}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isPending ? 'Saving...' : initial ? 'Save' : 'Create Epic'}
        </button>
      </div>
    </div>
  );
}

export function Roadmap({ role, onItemClick }: RoadmapProps) {
  const { data: epics, isLoading } = useEpics();
  const { data: items } = useItems();
  const createEpic = useCreateEpic();
  const updateEpic = useUpdateEpic();
  const deleteEpic = useDeleteEpic();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEpic, setEditingEpic] = useState<EpicWithCounts | null>(null);

  const canManage = role === 'pm' || role === 'human';
  const allItems = items || [];
  const unassignedItems = allItems.filter(i => !i.epicId);

  function handleCreate(data: { title: string; description?: string; status?: string }) {
    createEpic.mutate(data, { onSuccess: () => setShowCreateForm(false) });
  }

  function handleUpdate(data: { title: string; description?: string; status?: string }) {
    if (!editingEpic) return;
    updateEpic.mutate({ id: editingEpic.id, ...data }, { onSuccess: () => setEditingEpic(null) });
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this epic? Items will be unlinked but not deleted.')) return;
    deleteEpic.mutate(id);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white">Roadmap</h2>
        {canManage && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Epic
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3 max-w-4xl mx-auto w-full">
        {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

        {showCreateForm && (
          <EpicForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreateForm(false)}
            isPending={createEpic.isPending}
          />
        )}

        {editingEpic && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-24 px-4" onClick={() => setEditingEpic(null)}>
            <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
              <EpicForm
                initial={{ title: editingEpic.title, description: editingEpic.description || '', status: editingEpic.status }}
                onSubmit={handleUpdate}
                onCancel={() => setEditingEpic(null)}
                isPending={updateEpic.isPending}
              />
            </div>
          </div>
        )}

        {epics && epics.map(epic => (
          <EpicCard
            key={epic.id}
            epic={epic}
            items={allItems}
            role={role}
            onItemClick={onItemClick}
            onEdit={setEditingEpic}
            onDelete={handleDelete}
          />
        ))}

        {epics && epics.length === 0 && !showCreateForm && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-2">No epics yet</p>
            {canManage && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Create your first epic
              </button>
            )}
          </div>
        )}

        {unassignedItems.length > 0 && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-400">Unassigned Items</h3>
              <p className="text-[10px] text-gray-600">{unassignedItems.length} items not in any epic</p>
            </div>
            <div className="border-t border-gray-800">
              {unassignedItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => onItemClick(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/50 transition-colors text-left border-b border-gray-800/50 last:border-b-0"
                >
                  <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_COLORS[item.status])} />
                  <span className="text-sm text-gray-300 flex-1 truncate">{item.title}</span>
                  <span className="text-[10px] text-gray-600 shrink-0">{STATUS_LABELS[item.status]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
