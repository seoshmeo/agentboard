import { DndContext, DragOverlay, closestCenter, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { Column } from './Column.js';
import { ItemCard } from './ItemCard.js';
import { useTransition } from '../api/client.js';
import { findTransition } from '@agentboard/shared';
import type { Item, ItemStatus, Role } from '@agentboard/shared';

const COLUMNS: ItemStatus[] = ['draft', 'pending_review', 'approved', 'in_progress', 'done', 'accepted'];

interface BoardProps {
  items: Item[];
  role?: Role;
  onItemClick: (id: string) => void;
}

export function Board({ items, role, onItemClick }: BoardProps) {
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const transition = useTransition();

  function handleDragStart(event: DragStartEvent) {
    const item = items.find(i => i.id === event.active.id);
    setActiveItem(item || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const targetStatus = over.id as ItemStatus;
    const item = items.find(i => i.id === itemId);
    if (!item || item.status === targetStatus) return;

    const trans = findTransition(item.status as ItemStatus, targetStatus);
    if (!trans) return;
    if (role && !trans.roles.includes(role)) return;

    transition.mutate({ id: itemId, to: targetStatus });
  }

  const groupedItems = COLUMNS.reduce((acc, status) => {
    acc[status] = items.filter(i => i.status === status);
    return acc;
  }, {} as Record<ItemStatus, Item[]>);

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 p-4 h-full overflow-x-auto">
        {COLUMNS.map(status => (
          <Column
            key={status}
            status={status}
            items={groupedItems[status]}
            onItemClick={onItemClick}
          />
        ))}
      </div>
      <DragOverlay>
        {activeItem ? <ItemCard item={activeItem} onClick={() => {}} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
