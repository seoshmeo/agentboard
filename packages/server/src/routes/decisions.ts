import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { items, decisionLogs } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { broadcast } from '../ws/index.js';

export async function decisionRoutes(app: FastifyInstance) {
  // List decision logs for an item
  app.get('/api/items/:id/decision-logs', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const item = db.select().from(items).where(
      and(eq(items.id, id), eq(items.projectId, request.projectId))
    ).get();
    if (!item) return reply.status(404).send({ error: 'Item not found' });

    return db.select().from(decisionLogs).where(eq(decisionLogs.itemId, id)).all();
  });

  // Add decision log
  app.post('/api/items/:id/decision-logs', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'dev') {
      return reply.status(403).send({ error: 'Only dev role can add decision logs' });
    }

    const { id } = request.params as { id: string };
    const body = request.body as {
      context: string;
      decision: string;
      alternatives?: string;
      consequences?: string;
    };

    if (!body.context || !body.decision) {
      return reply.status(400).send({ error: 'context and decision are required' });
    }

    const item = db.select().from(items).where(
      and(eq(items.id, id), eq(items.projectId, request.projectId))
    ).get();
    if (!item) return reply.status(404).send({ error: 'Item not found' });

    const logId = nanoid();
    db.insert(decisionLogs).values({
      id: logId,
      itemId: id,
      context: body.context,
      decision: body.decision,
      alternatives: body.alternatives ?? null,
      consequences: body.consequences ?? null,
      createdByRole: request.role,
    }).run();

    const log = db.select().from(decisionLogs).where(eq(decisionLogs.id, logId)).get();
    broadcast('decision:added', log);
    return reply.status(201).send(log);
  });
}
