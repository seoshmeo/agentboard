import { eq } from 'drizzle-orm';
import type { ItemContext } from '@agentboard/shared';
import { db } from '../db/connection.js';
import { items, dependencies, decisionLogs, comments } from '../db/schema.js';

export function assembleContext(itemId: string): ItemContext | null {
  const item = db.select().from(items).where(eq(items.id, itemId)).get();
  if (!item) return null;

  const deps = db.select().from(dependencies).where(eq(dependencies.itemId, itemId)).all();

  const depContexts = deps.map(dep => {
    const depItem = db.select().from(items).where(eq(items.id, dep.dependsOnItemId)).get();
    const depLogs = db.select().from(decisionLogs).where(eq(decisionLogs.itemId, dep.dependsOnItemId)).all();
    return {
      item: depItem ? { id: depItem.id, title: depItem.title, status: depItem.status } : { id: dep.dependsOnItemId, title: 'Unknown', status: 'draft' as const },
      decisionLogs: depLogs,
    };
  });

  const itemComments = db.select().from(comments).where(eq(comments.itemId, itemId)).all();
  const itemDecisionLogs = db.select().from(decisionLogs).where(eq(decisionLogs.itemId, itemId)).all();

  return {
    item: item as ItemContext['item'],
    dependencies: depContexts,
    comments: itemComments,
    decisionLogs: itemDecisionLogs,
  };
}
