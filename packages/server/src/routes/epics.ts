import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { epics, items } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { broadcast } from '../ws/index.js';

export async function epicRoutes(app: FastifyInstance) {
  // List epics for project (with item counts per status)
  app.get('/api/epics', { preHandler: authMiddleware }, async (request) => {
    const projectEpics = db.select().from(epics)
      .where(eq(epics.projectId, request.projectId))
      .all();

    // Sort by sortOrder
    projectEpics.sort((a, b) => a.sortOrder - b.sortOrder);

    // Attach item counts per epic
    return projectEpics.map(epic => {
      const epicItems = db.select().from(items)
        .where(and(eq(items.projectId, request.projectId), eq(items.epicId, epic.id)))
        .all();

      const counts: Record<string, number> = {};
      for (const item of epicItems) {
        counts[item.status] = (counts[item.status] || 0) + 1;
      }

      return {
        ...epic,
        itemCounts: counts,
        totalItems: epicItems.length,
      };
    });
  });

  // Create epic
  app.post('/api/epics', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'pm' && request.role !== 'human') {
      return reply.status(403).send({ error: 'Only PM or human role can create epics' });
    }

    const body = request.body as {
      title: string;
      description?: string;
      status?: string;
      sortOrder?: number;
    };

    if (!body.title) return reply.status(400).send({ error: 'title is required' });

    // Get max sort_order for the project
    const existing = db.select().from(epics)
      .where(eq(epics.projectId, request.projectId))
      .all();
    const maxOrder = existing.reduce((max, e) => Math.max(max, e.sortOrder), -1);

    const id = nanoid();
    db.insert(epics).values({
      id,
      projectId: request.projectId,
      title: body.title,
      description: body.description ?? null,
      status: (body.status as any) ?? 'planned',
      sortOrder: body.sortOrder ?? maxOrder + 1,
    }).run();

    const epic = db.select().from(epics).where(eq(epics.id, id)).get();
    broadcast('epic:created', epic);
    return reply.status(201).send(epic);
  });

  // Update epic
  app.patch('/api/epics/:id', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'pm' && request.role !== 'human') {
      return reply.status(403).send({ error: 'Only PM or human role can update epics' });
    }

    const { id } = request.params as { id: string };
    const epic = db.select().from(epics).where(
      and(eq(epics.id, id), eq(epics.projectId, request.projectId))
    ).get();

    if (!epic) return reply.status(404).send({ error: 'Epic not found' });

    const body = request.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.status !== undefined) updates.status = body.status;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    db.update(epics).set(updates).where(eq(epics.id, id)).run();
    const updated = db.select().from(epics).where(eq(epics.id, id)).get();
    broadcast('epic:updated', updated);
    return updated;
  });

  // Delete epic (unlinks items)
  app.delete('/api/epics/:id', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'human') {
      return reply.status(403).send({ error: 'Only human role can delete epics' });
    }

    const { id } = request.params as { id: string };
    const epic = db.select().from(epics).where(
      and(eq(epics.id, id), eq(epics.projectId, request.projectId))
    ).get();

    if (!epic) return reply.status(404).send({ error: 'Epic not found' });

    // Unlink items from this epic
    db.update(items).set({ epicId: null }).where(eq(items.epicId, id)).run();

    db.delete(epics).where(eq(epics.id, id)).run();

    broadcast('epic:deleted', { id });
    return { ok: true };
  });

  // Roadmap text summary for bot
  app.get('/api/epics/roadmap-text', { preHandler: authMiddleware }, async (request) => {
    const projectEpics = db.select().from(epics)
      .where(eq(epics.projectId, request.projectId))
      .all();

    projectEpics.sort((a, b) => a.sortOrder - b.sortOrder);

    let text = '';
    for (const epic of projectEpics) {
      text += `## Epic: ${epic.title} (${epic.status})\n`;
      if (epic.description) text += `${epic.description}\n`;

      const epicItems = db.select().from(items)
        .where(and(eq(items.projectId, request.projectId), eq(items.epicId, epic.id)))
        .all();

      for (const item of epicItems) {
        text += `  - [${item.status}] ${item.title}\n`;
      }
      text += '\n';
    }

    // Unassigned items
    const unassigned = db.select().from(items)
      .where(eq(items.projectId, request.projectId))
      .all()
      .filter(i => !i.epicId);

    if (unassigned.length > 0) {
      text += `## Unassigned Items\n`;
      for (const item of unassigned) {
        text += `  - [${item.status}] ${item.title}\n`;
      }
    }

    return { text: text.trim() };
  });
}
