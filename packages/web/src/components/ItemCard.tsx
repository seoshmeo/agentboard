import { useDraggable } from '@dnd-kit/core';
import { cn, PRIORITY_COLORS } from '../lib/utils.js';
import { useItemProgress } from '../api/client.js';
import { GripVertical, GitBranch, Tag } from 'lucide-react';
import type { Item } from '@agentboard/shared';

interface ItemCardProps {
  item: Item;
  onClick: () => void;
  isDragOverlay?: boolean;
}

export function ItemCard({ item, onClick, isDragOverlay }: ItemCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
  });
  const { data: progress } = useItemProgress(item.status === 'in_progress' ? item.id : '');

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      className={cn(
        'group bg-gray-800 rounded-lg border border-gray-700/50 p-3 cursor-pointer transition-all hover:border-gray-600',
        isDragging && 'opacity-40',
        isDragOverlay && 'shadow-xl shadow-black/40 rotate-2 border-violet-500/50'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-0.5 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-100 leading-snug truncate">{item.title}</h3>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn('text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border', PRIORITY_COLORS[item.priority])}>
              {item.priority}
            </span>
            {item.sprintTag && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                <Tag className="w-3 h-3" />
                {item.sprintTag}
              </span>
            )}
            {item.assignedTo && (
              <span className="text-[10px] text-gray-500 truncate ml-auto">{item.assignedTo}</span>
            )}
          </div>
          {progress && item.status === 'in_progress' && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-gray-500 truncate">{progress.step}</span>
                <span className="text-[10px] text-gray-600">{progress.percent}%</span>
              </div>
              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
