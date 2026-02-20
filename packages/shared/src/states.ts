import type { ItemStatus, Role } from './types.js';

export interface TransitionDef {
  from: ItemStatus;
  to: ItemStatus;
  roles: Role[];
  requiresComment?: boolean;
  requiresDecisionLog?: boolean;
}

export const TRANSITIONS: Record<string, TransitionDef> = {
  submit_for_review: { from: 'draft', to: 'pending_review', roles: ['pm', 'human'] },
  approve:           { from: 'pending_review', to: 'approved', roles: ['human'] },
  reject_review:     { from: 'pending_review', to: 'draft', roles: ['human'], requiresComment: true },
  start_work:        { from: 'approved', to: 'in_progress', roles: ['dev', 'human'] },
  complete:          { from: 'in_progress', to: 'done', roles: ['dev', 'human'], requiresDecisionLog: true },
  accept:            { from: 'done', to: 'accepted', roles: ['human'] },
  reject_result:     { from: 'done', to: 'draft', roles: ['human'], requiresComment: true },
};

export const ALL_STATUSES: ItemStatus[] = [
  'draft', 'pending_review', 'approved', 'in_progress', 'done', 'accepted',
];

export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  in_progress: 'In Progress',
  done: 'Done',
  accepted: 'Accepted',
};

export function findTransition(from: ItemStatus, to: ItemStatus): TransitionDef | undefined {
  return Object.values(TRANSITIONS).find(t => t.from === from && t.to === to);
}

export function getAvailableTransitions(from: ItemStatus, role: Role): TransitionDef[] {
  return Object.values(TRANSITIONS).filter(t => t.from === from && t.roles.includes(role));
}
