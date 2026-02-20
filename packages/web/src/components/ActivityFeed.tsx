import { X, MessageSquare, BookOpen } from 'lucide-react';
import { useActivityFeed } from '../api/client.js';
import { cn, ROLE_BADGE_COLORS, relativeTime } from '../lib/utils.js';

interface ActivityFeedProps {
  onItemClick: (itemId: string) => void;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = { pm: 'PM', dev: 'Dev', human: 'Human' };

export function ActivityFeed({ onItemClick, onClose }: ActivityFeedProps) {
  const { data: entries, isLoading } = useActivityFeed(50);

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">Activity</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-sm text-gray-500">Loading...</div>
        )}
        {entries && entries.length === 0 && (
          <div className="p-4 text-sm text-gray-500">No activity yet.</div>
        )}
        {entries?.map(entry => (
          <div key={`${entry.type}-${entry.id}`} className="px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
            <div className="flex items-center gap-2 mb-1">
              {entry.type === 'comment' ? (
                <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              ) : (
                <BookOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              )}
              <button
                onClick={() => onItemClick(entry.itemId)}
                className="text-xs text-gray-300 hover:text-white truncate transition-colors font-medium"
              >
                {entry.itemTitle}
              </button>
            </div>
            <p className="text-xs text-gray-400 line-clamp-2 ml-5.5 pl-[22px]">{entry.content}</p>
            <div className="flex items-center gap-2 mt-1.5 pl-[22px]">
              {entry.role && (
                <span className={cn('text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border', ROLE_BADGE_COLORS[entry.role] || 'text-gray-500 border-gray-700')}>
                  {ROLE_LABELS[entry.role] || entry.role}
                </span>
              )}
              <span className="text-[10px] text-gray-600">{relativeTime(entry.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
