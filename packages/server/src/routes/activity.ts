import type { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { items, comments, decisionLogs } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { ActivityEntry } from '@agentboard/shared';

export async function activityRoutes(app: FastifyInstance) {
  app.get('/api/activity', { preHandler: authMiddleware }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);

    // Get all item IDs for this project
    const projectItems = db.select({ id: items.id, title: items.title })
      .from(items)
      .where(eq(items.projectId, request.projectId))
      .all();

    if (projectItems.length === 0) return [];

    const itemIds = projectItems.map(i => i.id);
    const titleMap = new Map(projectItems.map(i => [i.id, i.title]));

    // Fetch comments and decision logs
    const allComments = db.select().from(comments)
      .where(inArray(comments.itemId, itemIds))
      .all();

    const allDecisions = db.select().from(decisionLogs)
      .where(inArray(decisionLogs.itemId, itemIds))
      .all();

    // Merge into activity entries
    const entries: ActivityEntry[] = [
      ...allComments.map(c => ({
        type: 'comment' as const,
        id: c.id,
        itemId: c.itemId,
        itemTitle: titleMap.get(c.itemId) || '',
        content: c.content,
        role: c.authorRole,
        createdAt: c.createdAt,
      })),
      ...allDecisions.map(d => ({
        type: 'decision' as const,
        id: d.id,
        itemId: d.itemId,
        itemTitle: titleMap.get(d.itemId) || '',
        content: d.decision,
        role: d.createdByRole,
        createdAt: d.createdAt,
      })),
    ];

    // Sort by createdAt desc
    entries.sort((a, b) => {
      const ta = a.createdAt || '';
      const tb = b.createdAt || '';
      return tb.localeCompare(ta);
    });

    return entries.slice(0, limit);
  });
}
