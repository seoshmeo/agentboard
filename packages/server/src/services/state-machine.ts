import { eq } from 'drizzle-orm';
import { findTransition, type Role, type ItemStatus } from '@agentboard/shared';
import { db } from '../db/connection.js';
import { items, dependencies, decisionLogs } from '../db/schema.js';

interface TransitionResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

export function validateTransition(
  currentStatus: ItemStatus,
  targetStatus: ItemStatus,
  role: Role,
  opts: { comment?: string; force?: boolean; itemId: string }
): TransitionResult {
  const transition = findTransition(currentStatus, targetStatus);

  if (!transition) {
    return { ok: false, error: `Invalid transition from ${currentStatus} to ${targetStatus}` };
  }

  if (!transition.roles.includes(role)) {
    return { ok: false, error: `Role '${role}' cannot perform this transition` };
  }

  if (transition.requiresComment && !opts.comment) {
    return { ok: false, error: 'A comment is required for this transition' };
  }

  if (transition.requiresDecisionLog && role !== 'human') {
    const logs = db.select().from(decisionLogs).where(eq(decisionLogs.itemId, opts.itemId)).all();
    if (logs.length === 0) {
      return { ok: false, error: 'At least one decision log is required before marking as done' };
    }
  }

  // Check dependencies when moving to in_progress
  if (targetStatus === 'in_progress') {
    const deps = db.select().from(dependencies).where(eq(dependencies.itemId, opts.itemId)).all();
    if (deps.length > 0) {
      const depItems = deps.map(d =>
        db.select().from(items).where(eq(items.id, d.dependsOnItemId)).get()
      ).filter(Boolean);
      const unfinished = depItems.filter(d => d!.status !== 'done' && d!.status !== 'accepted');
      if (unfinished.length > 0 && !opts.force) {
        const names = unfinished.map(d => `"${d!.title}" (${d!.status})`).join(', ');
        return {
          ok: false,
          warning: `Blocked by unfinished dependencies: ${names}. Use force=true to override.`,
          error: `Blocked by unfinished dependencies: ${names}. Use force=true to override.`,
        };
      }
    }
  }

  return { ok: true };
}

export function executeTransition(itemId: string, targetStatus: ItemStatus) {
  db.update(items)
    .set({ status: targetStatus, updatedAt: new Date().toISOString() })
    .where(eq(items.id, itemId))
    .run();
}
