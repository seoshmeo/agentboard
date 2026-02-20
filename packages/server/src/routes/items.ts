import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { items, dependencies, comments, decisionLogs } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateTransition, executeTransition } from '../services/state-machine.js';
import { assembleContext } from '../services/context.js';
import { notifyTransition } from '../services/telegram.js';
import { broadcast } from '../ws/index.js';
import type { ItemStatus, TransitionRequest } from '@agentboard/shared';

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const DEV_VISIBLE_STATUSES: ItemStatus[] = ['approved', 'in_progress', 'done', 'accepted'];

export async function itemRoutes(app: FastifyInstance) {
  // List items
  app.get('/api/items', { preHandler: authMiddleware }, async (request) => {
    const query = request.query as { status?: string; sprintTag?: string; priority?: string };
    let result = db.select().from(items).where(eq(items.projectId, request.projectId)).all();

    // Dev role can only see approved+
    if (request.role === 'dev') {
      result = result.filter(i => DEV_VISIBLE_STATUSES.includes(i.status as ItemStatus));
    }

    if (query.status) result = result.filter(i => i.status === query.status);
    if (query.sprintTag) result = result.filter(i => i.sprintTag === query.sprintTag);
    if (query.priority) result = result.filter(i => i.priority === query.priority);

    return result;
  });

  // Get next approved item for dev (MUST be before /:id to avoid route conflict)
  app.get('/api/items/next', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'dev') {
      return reply.status(403).send({ error: 'Only dev role can use /items/next' });
    }

    const approved = db.select().from(items).where(
      and(eq(items.projectId, request.projectId), eq(items.status, 'approved'))
    ).all();

    approved.sort((a, b) =>
      (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 2) -
      (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 2)
    );

    for (const item of approved) {
      const deps = db.select().from(dependencies).where(eq(dependencies.itemId, item.id)).all();
      if (deps.length === 0) return item;

      const allMet = deps.every(d => {
        const dep = db.select().from(items).where(eq(items.id, d.dependsOnItemId)).get();
        return dep && (dep.status === 'done' || dep.status === 'accepted');
      });

      if (allMet) return item;
    }

    return reply.status(404).send({ error: 'No approved unblocked items available' });
  });

  // Create item
  app.post('/api/items', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'pm') {
      return reply.status(403).send({ error: 'Only PM role can create items' });
    }

    const body = request.body as {
      title: string;
      description?: string;
      priority?: string;
      sprintTag?: string;
      projectId?: string;
    };

    if (!body.title) return reply.status(400).send({ error: 'title is required' });

    const id = nanoid();
    db.insert(items).values({
      id,
      projectId: request.projectId,
      title: body.title,
      description: body.description ?? null,
      priority: (body.priority as any) ?? 'medium',
      status: 'draft',
      sprintTag: body.sprintTag ?? null,
      createdByRole: request.role,
    }).run();

    const item = db.select().from(items).where(eq(items.id, id)).get();
    broadcast('item:created', item);
    return reply.status(201).send(item);
  });

  // Get item
  app.get('/api/items/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const item = db.select().from(items).where(
      and(eq(items.id, id), eq(items.projectId, request.projectId))
    ).get();

    if (!item) return reply.status(404).send({ error: 'Item not found' });

    if (request.role === 'dev' && !DEV_VISIBLE_STATUSES.includes(item.status as ItemStatus)) {
      return reply.status(403).send({ error: 'Item not visible to dev role' });
    }

    return item;
  });

  // Update item
  app.patch('/api/items/:id', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'pm' && request.role !== 'human') {
      return reply.status(403).send({ error: 'Only PM or human role can update items' });
    }

    const { id } = request.params as { id: string };
    const item = db.select().from(items).where(
      and(eq(items.id, id), eq(items.projectId, request.projectId))
    ).get();

    if (!item) return reply.status(404).send({ error: 'Item not found' });

    const body = request.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.sprintTag !== undefined) updates.sprintTag = body.sprintTag;
    if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;

    db.update(items).set(updates).where(eq(items.id, id)).run();
    const updated = db.select().from(items).where(eq(items.id, id)).get();
    broadcast('item:updated', updated);
    return updated;
  });

  // Delete item
  app.delete('/api/items/:id', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'human') {
      return reply.status(403).send({ error: 'Only human role can delete items' });
    }

    const { id } = request.params as { id: string };
    const item = db.select().from(items).where(
      and(eq(items.id, id), eq(items.projectId, request.projectId))
    ).get();

    if (!item) return reply.status(404).send({ error: 'Item not found' });
    if (item.status !== 'draft') {
      return reply.status(400).send({ error: 'Can only delete items in draft status' });
    }

    // Delete related records first
    db.delete(decisionLogs).where(eq(decisionLogs.itemId, id)).run();
    db.delete(dependencies).where(eq(dependencies.itemId, id)).run();
    db.delete(dependencies).where(eq(dependencies.dependsOnItemId, id)).run();
    db.delete(comments).where(eq(comments.itemId, id)).run();
    db.delete(items).where(eq(items.id, id)).run();

    broadcast('item:deleted', { id });
    return { ok: true };
  });

  // Transition item
  app.post('/api/items/:id/transition', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as TransitionRequest;

    const item = db.select().from(items).where(
      and(eq(items.id, id), eq(items.projectId, request.projectId))
    ).get();

    if (!item) return reply.status(404).send({ error: 'Item not found' });

    const result = validateTransition(
      item.status as ItemStatus,
      body.to,
      request.role,
      { comment: body.comment, force: body.force, itemId: id }
    );

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    executeTransition(id, body.to);

    // Add rejection comment
    if (body.comment) {
      db.insert(comments).values({
        id: nanoid(),
        itemId: id,
        content: body.comment,
        authorRole: request.role,
      }).run();
    }

    const updated = db.select().from(items).where(eq(items.id, id)).get();
    broadcast('item:transitioned', { item: updated, from: item.status, to: body.to });

    // Telegram notification (fire and forget)
    notifyTransition(updated as any, body.to, body.comment).catch(() => {});

    return updated;
  });

  // Get item context
  app.get('/api/items/:id/context', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const context = assembleContext(id);
    if (!context) return reply.status(404).send({ error: 'Item not found' });
    if (context.item.projectId !== request.projectId) {
      return reply.status(403).send({ error: 'Access denied' });
    }
    return context;
  });

  // Add dependency
  app.post('/api/items/:id/dependencies', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'pm') {
      return reply.status(403).send({ error: 'Only PM role can add dependencies' });
    }

    const { id } = request.params as { id: string };
    const { dependsOnItemId } = request.body as { dependsOnItemId: string };

    if (!dependsOnItemId) return reply.status(400).send({ error: 'dependsOnItemId is required' });
    if (id === dependsOnItemId) return reply.status(400).send({ error: 'Item cannot depend on itself' });

    // Verify both items exist and belong to same project
    const item = db.select().from(items).where(and(eq(items.id, id), eq(items.projectId, request.projectId))).get();
    const depItem = db.select().from(items).where(and(eq(items.id, dependsOnItemId), eq(items.projectId, request.projectId))).get();

    if (!item || !depItem) return reply.status(404).send({ error: 'Item not found' });

    db.insert(dependencies).values({ itemId: id, dependsOnItemId }).run();
    broadcast('dependency:added', { itemId: id, dependsOnItemId });
    return { ok: true };
  });

  // Remove dependency
  app.delete('/api/items/:id/dependencies/:depId', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'pm' && request.role !== 'human') {
      return reply.status(403).send({ error: 'Only PM or human role can remove dependencies' });
    }

    const { id, depId } = request.params as { id: string; depId: string };
    db.delete(dependencies).where(
      and(eq(dependencies.itemId, id), eq(dependencies.dependsOnItemId, depId))
    ).run();

    broadcast('dependency:removed', { itemId: id, dependsOnItemId: depId });
    return { ok: true };
  });

  // List comments
  app.get('/api/items/:id/comments', { preHandler: authMiddleware }, async (request) => {
    const { id } = request.params as { id: string };
    return db.select().from(comments).where(eq(comments.itemId, id)).all();
  });

  // Add comment
  app.post('/api/items/:id/comments', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    if (!content) return reply.status(400).send({ error: 'content is required' });

    const item = db.select().from(items).where(
      and(eq(items.id, id), eq(items.projectId, request.projectId))
    ).get();
    if (!item) return reply.status(404).send({ error: 'Item not found' });

    const commentId = nanoid();
    db.insert(comments).values({
      id: commentId,
      itemId: id,
      content,
      authorRole: request.role,
    }).run();

    const comment = db.select().from(comments).where(eq(comments.id, commentId)).get();
    broadcast('comment:added', comment);
    return reply.status(201).send(comment);
  });
}
