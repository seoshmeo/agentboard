import { useDroppable } from '@dnd-kit/core';
import { ItemCard } from './ItemCard.js';
import { STATUS_LABELS, STATUS_COLORS, cn } from '../lib/utils.js';
import type { Item, ItemStatus } from '@agentboard/shared';

interface ColumnProps {
  status: ItemStatus;
  items: Item[];
  onItemClick: (id: string) => void;
}

export function Column({ status, items, onItemClick }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-72 min-w-72 rounded-xl transition-colors',
        isOver ? 'bg-gray-800/60' : 'bg-gray-900/40'
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 shrink-0">
        <div className={cn('w-2.5 h-2.5 rounded-full', STATUS_COLORS[status])} />
        <h2 className="text-sm font-semibold text-gray-200">{STATUS_LABELS[status]}</h2>
        <span className="ml-auto text-xs text-gray-500 font-medium bg-gray-800 px-1.5 py-0.5 rounded">
          {items.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {items.map(item => (
          <ItemCard key={item.id} item={item} onClick={() => onItemClick(item.id)} />
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-xs">No items</div>
        )}
      </div>
    </div>
  );
}
