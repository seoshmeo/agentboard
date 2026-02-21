import { describe, it, expect } from 'vitest';
import { TRANSITIONS, ALL_STATUSES, findTransition, getAvailableTransitions } from './states.js';
import type { ItemStatus, Role } from './types.js';

describe('TRANSITIONS', () => {
  it('defines 7 transitions', () => {
    expect(Object.keys(TRANSITIONS)).toHaveLength(7);
  });

  it('every transition has valid from/to statuses', () => {
    for (const [name, t] of Object.entries(TRANSITIONS)) {
      expect(ALL_STATUSES, `${name}.from`).toContain(t.from);
      expect(ALL_STATUSES, `${name}.to`).toContain(t.to);
    }
  });

  it('every transition has at least one role', () => {
    for (const [name, t] of Object.entries(TRANSITIONS)) {
      expect(t.roles.length, name).toBeGreaterThan(0);
    }
  });

  it('covers the expected status flow', () => {
    const flow: [string, ItemStatus, ItemStatus][] = [
      ['submit_for_review', 'draft', 'pending_review'],
      ['approve', 'pending_review', 'approved'],
      ['start_work', 'approved', 'in_progress'],
      ['complete', 'in_progress', 'done'],
      ['accept', 'done', 'accepted'],
    ];
    for (const [name, from, to] of flow) {
      expect(TRANSITIONS[name].from).toBe(from);
      expect(TRANSITIONS[name].to).toBe(to);
    }
  });

  it('reject_review requires a comment', () => {
    expect(TRANSITIONS.reject_review.requiresComment).toBe(true);
  });

  it('reject_result requires a comment', () => {
    expect(TRANSITIONS.reject_result.requiresComment).toBe(true);
  });

  it('complete requires a decision log', () => {
    expect(TRANSITIONS.complete.requiresDecisionLog).toBe(true);
  });
});

describe('ALL_STATUSES', () => {
  it('has 6 statuses', () => {
    expect(ALL_STATUSES).toHaveLength(6);
  });

  it('contains all expected statuses', () => {
    const expected: ItemStatus[] = ['draft', 'pending_review', 'approved', 'in_progress', 'done', 'accepted'];
    expect(ALL_STATUSES).toEqual(expected);
  });
});

describe('findTransition', () => {
  it('finds draft → pending_review', () => {
    const t = findTransition('draft', 'pending_review');
    expect(t).toBeDefined();
    expect(t!.roles).toContain('pm');
  });

  it('finds done → draft (reject_result)', () => {
    const t = findTransition('done', 'draft');
    expect(t).toBeDefined();
    expect(t!.requiresComment).toBe(true);
    expect(t!.roles).toContain('human');
  });

  it('returns undefined for invalid transition', () => {
    expect(findTransition('draft', 'done')).toBeUndefined();
    expect(findTransition('accepted', 'draft')).toBeUndefined();
    expect(findTransition('in_progress', 'approved')).toBeUndefined();
  });
});

describe('getAvailableTransitions', () => {
  it('pm can submit draft for review', () => {
    const transitions = getAvailableTransitions('draft', 'pm');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe('pending_review');
  });

  it('human can approve or reject pending_review', () => {
    const transitions = getAvailableTransitions('pending_review', 'human');
    expect(transitions).toHaveLength(2);
    const targets = transitions.map(t => t.to).sort();
    expect(targets).toEqual(['approved', 'draft']);
  });

  it('dev can start work on approved items', () => {
    const transitions = getAvailableTransitions('approved', 'dev');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe('in_progress');
  });

  it('dev can complete in_progress items', () => {
    const transitions = getAvailableTransitions('in_progress', 'dev');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to).toBe('done');
  });

  it('human can accept or reject done items', () => {
    const transitions = getAvailableTransitions('done', 'human');
    expect(transitions).toHaveLength(2);
    const targets = transitions.map(t => t.to).sort();
    expect(targets).toEqual(['accepted', 'draft']);
  });

  it('dev cannot transition from draft', () => {
    expect(getAvailableTransitions('draft', 'dev')).toHaveLength(0);
  });

  it('pm cannot approve pending_review', () => {
    const transitions = getAvailableTransitions('pending_review', 'pm');
    expect(transitions).toHaveLength(0);
  });

  it('no transitions available from accepted', () => {
    const roles: Role[] = ['pm', 'dev', 'human'];
    for (const role of roles) {
      expect(getAvailableTransitions('accepted', role)).toHaveLength(0);
    }
  });
});
