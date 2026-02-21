import { useState } from 'react';
import { X, ArrowRight, MessageSquare, GitBranch, BookOpen, AlertTriangle, Pencil, Trash2, Plus, Unlink, Bot } from 'lucide-react';
import { useItemContext, useTransition, useAddComment, useComments, useUpdateItem, useDeleteItem, useAddDependency, useRemoveDependency, useEpics, useItemProgress } from '../api/client.js';
import { DecisionLog } from './DecisionLog.js';
import { ItemChat } from './ItemChat.js';
import { Markdown } from './Markdown.js';
import { cn, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, ROLE_BADGE_COLORS, relativeTime } from '../lib/utils.js';
import { getAvailableTransitions } from '@agentboard/shared';
import type { Role, ItemStatus, Item } from '@agentboard/shared';

interface ItemDetailProps {
  itemId: string;
  role?: Role;
  allItems: Item[];
  onClose: () => void;
}

const TRANSITION_COLORS: Record<string, string> = {
  pending_review: 'bg-amber-600 hover:bg-amber-500',
  approved: 'bg-blue-600 hover:bg-blue-500',
  in_progress: 'bg-violet-600 hover:bg-violet-500',
  done: 'bg-emerald-600 hover:bg-emerald-500',
  accepted: 'bg-green-700 hover:bg-green-600',
  draft: 'bg-gray-600 hover:bg-gray-500',
};

export function ItemDetail({ itemId, role, allItems, onClose }: ItemDetailProps) {
  const { data: context, isLoading } = useItemContext(itemId);
  const { data: commentsList } = useComments(itemId);
  const transition = useTransition();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const addDep = useAddDependency();
  const removeDep = useRemoveDependency();
  const addComment = useAddComment();
  const { data: epics } = useEpics();
  const { data: progress } = useItemProgress(itemId);

  const [commentText, setCommentText] = useState('');
  const [transitionComment, setTransitionComment] = useState('');
  const [showTransitionComment, setShowTransitionComment] = useState(false);
  const [pendingTo, setPendingTo] = useState<ItemStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editSprint, setEditSprint] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editEpicId, setEditEpicId] = useState('');
  const [showAddDep, setShowAddDep] = useState(false);
  const [depItemId, setDepItemId] = useState('');

  if (isLoading || !context) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-gray-900 rounded-xl p-8 text-gray-400">Loading...</div>
      </div>
    );
  }

  const item = context.item;
  const transitions = role ? getAvailableTransitions(item.status as ItemStatus, role) : [];

  function startEdit() {
    setEditTitle(item.title);
    setEditDesc(item.description || '');
    setEditPriority(item.priority);
    setEditSprint(item.sprintTag || '');
    setEditEpicId(item.epicId || '');
    setEditAssignee(item.assignedTo || '');
    setEditing(true);
  }

  function saveEdit() {
    updateItem.mutate({
      id: itemId,
      title: editTitle.trim(),
      description: editDesc.trim(),
      priority: editPriority,
      sprintTag: editSprint.trim() || undefined,
      epicId: editEpicId || null,
      assignedTo: editAssignee.trim() || undefined,
    }, { onSuccess: () => setEditing(false) });
  }

  function handleDelete() {
    if (!confirm('Delete this item?')) return;
    deleteItem.mutate(itemId, { onSuccess: onClose });
  }

  function handleTransition(to: ItemStatus) {
    const needsComment = to === 'draft' && (item.status === 'pending_review' || item.status === 'done');
    if (needsComment) {
      setPendingTo(to);
      setShowTransitionComment(true);
      return;
    }
    transition.mutate({ id: itemId, to });
  }

  function submitTransitionWithComment() {
    if (!pendingTo || !transitionComment.trim()) return;
    transition.mutate({ id: itemId, to: pendingTo, comment: transitionComment.trim() });
    setShowTransitionComment(false);
    setPendingTo(null);
    setTransitionComment('');
  }

  function handleAddComment() {
    if (!commentText.trim()) return;
    addComment.mutate({ itemId, content: commentText.trim() });
    setCommentText('');
  }

  function handleAddDep() {
    if (!depItemId) return;
    addDep.mutate({ itemId, dependsOnItemId: depItemId }, { onSuccess: () => { setShowAddDep(false); setDepItemId(''); } });
  }

  const canEdit = role === 'pm' || role === 'human';
  const canDelete = role === 'human' && item.status === 'draft';

  // Items available as dependencies (same project, not self, not already a dep)
  const existingDepIds = new Set(context.dependencies.map(d => d.item.id));
  const availableDeps = allItems.filter(i => i.id !== itemId && !existingDepIds.has(i.id));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-12 px-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl shadow-2xl mb-12" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800">
          <div className="flex-1 min-w-0 mr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('w-2.5 h-2.5 rounded-full', STATUS_COLORS[item.status])} />
              <span className="text-xs font-medium text-gray-400">{STATUS_LABELS[item.status]}</span>
              <span className={cn('text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ml-1', PRIORITY_COLORS[item.priority])}>
                {item.priority}
              </span>
              {item.sprintTag && (
                <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">{item.sprintTag}</span>
              )}
              {item.epicId && epics && (() => {
                const epic = epics.find(e => e.id === item.epicId);
                return epic ? (
                  <span className="text-[10px] font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">{epic.title}</span>
                ) : null;
              })()}
            </div>
            {editing ? (
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full text-lg font-semibold bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
            ) : (
              <h2 className="text-lg font-semibold text-white">{item.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-1">
            {canEdit && !editing && (
              <button onClick={startEdit} className="text-gray-500 hover:text-violet-400 transition-colors p-1" title="Edit">
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button onClick={handleDelete} className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Delete">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Transitions */}
        {transitions.length > 0 && !editing && (
          <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 mr-1">Actions:</span>
            {transitions.map((t, i) => (
              <button
                key={i}
                onClick={() => handleTransition(t.to)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-lg text-white font-medium transition-colors flex items-center gap-1',
                  TRANSITION_COLORS[t.to] || 'bg-gray-700 hover:bg-gray-600'
                )}
                disabled={transition.isPending}
              >
                <ArrowRight className="w-3 h-3" />
                {STATUS_LABELS[t.to]}
              </button>
            ))}
          </div>
        )}

        {/* Progress */}
        {progress && item.status === 'in_progress' && (
          <div className="px-5 py-3 border-b border-gray-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-400">{progress.step}</span>
              <span className="text-xs text-gray-500">{progress.percent}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            {progress.log && (
              <p className="text-[10px] text-gray-600 mt-1 truncate">{progress.log}</p>
            )}
          </div>
        )}

        {/* Transition comment dialog */}
        {showTransitionComment && (
          <div className="px-5 py-3 border-b border-gray-800 bg-gray-800/50">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-400 font-medium">Rejection reason required</span>
            </div>
            <textarea
              value={transitionComment}
              onChange={(e) => setTransitionComment(e.target.value)}
              placeholder="Explain why this is being rejected..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              rows={2}
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setShowTransitionComment(false); setPendingTo(null); }} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">Cancel</button>
              <button onClick={submitTransitionWithComment} className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg" disabled={!transitionComment.trim()}>Reject</button>
            </div>
          </div>
        )}

        {transition.isError && (
          <div className="px-5 py-2 bg-red-900/30 border-b border-red-800/50">
            <p className="text-xs text-red-400">{(transition.error as Error).message}</p>
          </div>
        )}

        {/* Description */}
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
          {editing ? (
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" placeholder="Description..." />
          ) : item.description ? (
            <Markdown content={item.description} />
          ) : (
            <p className="text-gray-600 italic text-sm">No description</p>
          )}
        </div>

        {/* Edit: priority, sprint, assignee */}
        {editing && (
          <div className="px-5 py-4 border-b border-gray-800 flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Priority</label>
              <select value={editPriority} onChange={e => setEditPriority(e.target.value)} className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Sprint</label>
              <input value={editSprint} onChange={e => setEditSprint(e.target.value)} placeholder="sprint-1" className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Assignee</label>
              <input value={editAssignee} onChange={e => setEditAssignee(e.target.value)} placeholder="Name" className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500" />
            </div>
            {epics && epics.length > 0 && (
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Epic</label>
                <select value={editEpicId} onChange={e => setEditEpicId(e.target.value)} className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500">
                  <option value="">No epic</option>
                  {epics.map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Edit save/cancel buttons */}
        {editing && (
          <div className="px-5 py-3 border-b border-gray-800 flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg">Cancel</button>
            <button onClick={saveEdit} disabled={!editTitle.trim() || updateItem.isPending} className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white rounded-lg">
              {updateItem.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Dependencies */}
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            Dependencies ({context.dependencies.length})
          </h3>
          {context.dependencies.length > 0 && (
            <div className="space-y-2 mb-3">
              {context.dependencies.map(dep => (
                <div key={dep.item.id} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', STATUS_COLORS[dep.item.status])} />
                    <span className="text-sm text-gray-200 flex-1">{dep.item.title}</span>
                    <span className="text-xs text-gray-500">{STATUS_LABELS[dep.item.status]}</span>
                    {(role === 'pm' || role === 'human') && (
                      <button
                        onClick={() => removeDep.mutate({ itemId, dependsOnItemId: dep.item.id })}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                        title="Remove dependency"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {dep.decisionLogs.length > 0 && (
                    <div className="mt-2 pl-4 border-l-2 border-gray-700 space-y-1">
                      {dep.decisionLogs.map(log => (
                        <p key={log.id} className="text-xs text-gray-400">
                          <span className="text-violet-400 font-medium">Decision:</span> {log.decision}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {context.dependencies.length === 0 && !showAddDep && (
            <p className="text-xs text-gray-600 mb-2">No dependencies.</p>
          )}
          {showAddDep ? (
            <div className="flex gap-2 items-end">
              <select value={depItemId} onChange={e => setDepItemId(e.target.value)} className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500">
                <option value="">Select item...</option>
                {availableDeps.map(i => (
                  <option key={i.id} value={i.id}>{i.title} ({STATUS_LABELS[i.status]})</option>
                ))}
              </select>
              <button onClick={handleAddDep} disabled={!depItemId} className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white rounded">Add</button>
              <button onClick={() => { setShowAddDep(false); setDepItemId(''); }} className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">Cancel</button>
            </div>
          ) : role === 'pm' && (
            <button onClick={() => setShowAddDep(true)} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Add Dependency
            </button>
          )}
        </div>

        {/* Decision Logs */}
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Decision Logs
          </h3>
          <DecisionLog itemId={itemId} logs={context.decisionLogs} canAdd={role === 'dev'} />
        </div>

        {/* Comments */}
        <div className="px-5 py-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({commentsList?.length || 0})
          </h3>
          {commentsList && commentsList.length > 0 && (
            <div className="space-y-2 mb-3">
              {commentsList.map(c => (
                <div key={c.id} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    {c.authorRole && (
                      <span className={cn('text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border', ROLE_BADGE_COLORS[c.authorRole] || 'text-gray-500 border-gray-700')}>
                        {c.authorRole === 'pm' ? 'PM' : c.authorRole === 'dev' ? 'Dev' : c.authorRole === 'human' ? 'Human' : c.authorRole}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-600">{relativeTime(c.createdAt)}</span>
                  </div>
                  <Markdown content={c.content} />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              placeholder="Add a comment..."
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors"
            >
              Send
            </button>
          </div>
        </div>

        {/* AI Chat */}
        <div className="px-5 py-4 border-t border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5" />
            Chat with AI
          </h3>
          <ItemChat itemId={itemId} role={role} />
        </div>
      </div>
    </div>
  );
}
