import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from '../routes/health.js';
import { projectRoutes } from '../routes/projects.js';
import { itemRoutes } from '../routes/items.js';
import { settingsRoutes } from '../routes/settings.js';
import { epicRoutes } from '../routes/epics.js';
import { decisionRoutes } from '../routes/decisions.js';

let app: FastifyInstance;
let projectId: string;
let keys: { pm: string; dev: string; human: string };

beforeAll(async () => {
  app = Fastify();
  await app.register(healthRoutes);
  await app.register(projectRoutes);
  await app.register(itemRoutes);
  await app.register(settingsRoutes);
  await app.register(epicRoutes);
  await app.register(decisionRoutes);
  await app.ready();

  // Create a test project
  const res = await app.inject({
    method: 'POST',
    url: '/api/projects',
    payload: { name: 'Test Project' },
  });
  const body = res.json();
  projectId = body.project.id;
  keys = {
    pm: body.apiKeys.find((k: any) => k.role === 'pm').key,
    dev: body.apiKeys.find((k: any) => k.role === 'dev').key,
    human: body.apiKeys.find((k: any) => k.role === 'human').key,
  };
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('status', 'ok');
    expect(res.json()).toHaveProperty('timestamp');
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with invalid key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer invalid-key' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns role and projectId with valid key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${keys.human}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.role).toBe('human');
    expect(body.projectId).toBe(projectId);
  });

  it('returns correct role for each key', async () => {
    for (const [role, key] of Object.entries(keys)) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${key}` },
      });
      expect(res.json().role).toBe(role);
    }
  });
});

describe('Projects API', () => {
  it('POST /api/projects creates project with 3 API keys', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Another Project', description: 'desc', localPath: '/tmp/test' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.project.name).toBe('Another Project');
    expect(body.apiKeys).toHaveLength(3);
    const roles = body.apiKeys.map((k: any) => k.role).sort();
    expect(roles).toEqual(['dev', 'human', 'pm']);
  });

  it('POST /api/projects rejects missing name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/projects lists all projects', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { authorization: `Bearer ${keys.human}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Items API', () => {
  let itemId: string;

  it('POST /api/items creates item (pm)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { authorization: `Bearer ${keys.pm}` },
      payload: { title: 'Test Item', description: 'A test', priority: 'high' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Test Item');
    expect(body.status).toBe('draft');
    expect(body.priority).toBe('high');
    itemId = body.id;
  });

  it('GET /api/items lists items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/items',
      headers: { authorization: `Bearer ${keys.pm}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });

  it('dev cannot see draft items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/items',
      headers: { authorization: `Bearer ${keys.dev}` },
    });
    expect(res.statusCode).toBe(200);
    const drafts = res.json().filter((i: any) => i.status === 'draft');
    expect(drafts).toHaveLength(0);
  });

  it('transition draft → pending_review (pm)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.pm}` },
      payload: { to: 'pending_review' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('pending_review');
  });

  it('transition pending_review → approved (human)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.human}` },
      payload: { to: 'approved' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('approved');
  });

  it('transition approved → in_progress (dev)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.dev}` },
      payload: { to: 'in_progress' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('in_progress');
  });

  it('complete requires decision log', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.dev}` },
      payload: { to: 'done' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('decision log');
  });

  it('add decision log then complete', async () => {
    // Add decision log
    const logRes = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/decision-logs`,
      headers: { authorization: `Bearer ${keys.dev}` },
      payload: { context: 'Test context', decision: 'Test decision' },
    });
    expect(logRes.statusCode).toBe(201);

    // Now complete
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.dev}` },
      payload: { to: 'done' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('done');
  });

  it('transition done → accepted (human)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.human}` },
      payload: { to: 'accepted' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('accepted');
  });

  it('invalid transition returns 400', async () => {
    // Create another item for this test
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { authorization: `Bearer ${keys.pm}` },
      payload: { title: 'Invalid Transition Test' },
    });
    const newItemId = createRes.json().id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${newItemId}/transition`,
      headers: { authorization: `Bearer ${keys.pm}` },
      payload: { to: 'done' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('wrong role cannot transition', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { authorization: `Bearer ${keys.pm}` },
      payload: { title: 'Role Test' },
    });
    const newItemId = createRes.json().id;

    // Dev cannot submit_for_review (only pm can)
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${newItemId}/transition`,
      headers: { authorization: `Bearer ${keys.dev}` },
      payload: { to: 'pending_review' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('Settings API', () => {
  it('GET /api/settings requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(401);
  });

  it('PATCH /api/settings requires human role', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { authorization: `Bearer ${keys.dev}` },
      payload: { some_key: 'value' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('PATCH /api/settings works for human', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { authorization: `Bearer ${keys.human}` },
      payload: { test_setting: 'hello' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('GET /api/settings returns settings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${keys.human}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('test_setting', 'hello');
  });
});

describe('Reject flow', () => {
  let itemId: string;

  it('reject_review requires comment', async () => {
    // Create and submit item
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { authorization: `Bearer ${keys.pm}` },
      payload: { title: 'Reject Test' },
    });
    itemId = createRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.pm}` },
      payload: { to: 'pending_review' },
    });

    // Reject without comment
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.human}` },
      payload: { to: 'draft' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('comment');
  });

  it('reject_review with comment succeeds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/transition`,
      headers: { authorization: `Bearer ${keys.human}` },
      payload: { to: 'draft', comment: 'Needs more detail' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('draft');
  });
});

describe('Comments API', () => {
  let itemId: string;

  beforeAll(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/items',
      headers: { authorization: `Bearer ${keys.pm}` },
      payload: { title: 'Comment Test Item' },
    });
    itemId = res.json().id;
  });

  it('POST comment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/items/${itemId}/comments`,
      headers: { authorization: `Bearer ${keys.human}` },
      payload: { content: 'Test comment' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().content).toBe('Test comment');
    expect(res.json().authorRole).toBe('human');
  });

  it('GET comments', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/items/${itemId}/comments`,
      headers: { authorization: `Bearer ${keys.human}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].content).toBe('Test comment');
  });
});
