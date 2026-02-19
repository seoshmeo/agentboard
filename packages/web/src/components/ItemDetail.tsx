import { useState } from 'react';
import { X, ArrowRight, MessageSquare, GitBranch, BookOpen, AlertTriangle } from 'lucide-react';
import { useItemContext, useTransition, useAddComment, useComments } from '../api/client.js';
import { DecisionLog } from './DecisionLog.js';
import { cn, STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from '../lib/utils.js';
import { getAvailableTransitions } from '@agentboard/shared';
import type { Role, ItemStatus } from '@agentboard/shared';

interface ItemDetailProps {
  itemId: string;
  onClose: () => void;
}

export function ItemDetail({ itemId, onClose }: ItemDetailProps) {
  const { data: context, isLoading } = useItemContext(itemId);
  const { data: commentsList } = useComments(itemId);
  const transition = useTransition();
  const addComment = useAddComment();
  const [commentText, setCommentText] = useState('');
  const [transitionComment, setTransitionComment] = useState('');
  const [showTransitionComment, setShowTransitionComment] = useState(false);
  const [pendingTo, setPendingTo] = useState<ItemStatus | null>(null);

  if (isLoading || !context) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-gray-900 rounded-xl p-8 text-gray-400">Loading...</div>
      </div>
    );
  }

  const item = context.item;
  // We don't know the user's role client-side easily, so show all possible transitions
  const allRoles: Role[] = ['pm', 'dev', 'human'];
  const transitions = allRoles.flatMap(role =>
    getAvailableTransitions(item.status as ItemStatus, role).map(t => ({ ...t, forRole: role }))
  );

  function handleTransition(to: ItemStatus) {
    // Check if this transition requires a comment (rejections)
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

  const TRANSITION_COLORS: Record<string, string> = {
    pending_review: 'bg-amber-600 hover:bg-amber-500',
    approved: 'bg-blue-600 hover:bg-blue-500',
    in_progress: 'bg-violet-600 hover:bg-violet-500',
    done: 'bg-emerald-600 hover:bg-emerald-500',
    accepted: 'bg-green-700 hover:bg-green-600',
    draft: 'bg-gray-600 hover:bg-gray-500',
  };

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
            </div>
            <h2 className="text-lg font-semibold text-white">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transitions */}
        {transitions.length > 0 && (
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
                <span className="text-white/60 text-[10px]">({t.forRole})</span>
              </button>
            ))}
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
              <button
                onClick={() => { setShowTransitionComment(false); setPendingTo(null); }}
                className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={submitTransitionWithComment}
                className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg"
                disabled={!transitionComment.trim()}
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {transition.isError && (
          <div className="px-5 py-2 bg-red-900/30 border-b border-red-800/50">
            <p className="text-xs text-red-400">{(transition.error as Error).message}</p>
          </div>
        )}

        {/* Description */}
        {item.description && (
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
            <div className="prose prose-invert prose-sm max-w-none text-gray-300">
              <p className="whitespace-pre-wrap">{item.description}</p>
            </div>
          </div>
        )}

        {/* Dependencies */}
        {context.dependencies.length > 0 && (
          <div className="px-5 py-4 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" />
              Dependencies
            </h3>
            <div className="space-y-2">
              {context.dependencies.map(dep => (
                <div key={dep.item.id} className="bg-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', STATUS_COLORS[dep.item.status])} />
                    <span className="text-sm text-gray-200">{dep.item.title}</span>
                    <span className="text-xs text-gray-500">{STATUS_LABELS[dep.item.status]}</span>
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
          </div>
        )}

        {/* Decision Logs */}
        <div className="px-5 py-4 border-b border-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Decision Logs
          </h3>
          <DecisionLog itemId={itemId} logs={context.decisionLogs} />
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
                    <span className="text-[10px] font-semibold uppercase text-gray-500">{c.authorRole}</span>
                    <span className="text-[10px] text-gray-600">{c.createdAt}</span>
                  </div>
                  <p className="text-sm text-gray-300">{c.content}</p>
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
      </div>
    </div>
  );
}
