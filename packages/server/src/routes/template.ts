import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { apiKeys } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

export async function templateRoutes(app: FastifyInstance) {
  app.get('/api/projects/:id/claude-md', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.projectId !== id) return reply.status(403).send({ error: 'Access denied' });

    const keys = db.select().from(apiKeys).where(eq(apiKeys.projectId, id)).all();
    const devKey = keys.find(k => k.role === 'dev')?.key || 'YOUR_DEV_API_KEY';
    const baseUrl = `http://localhost:3000`;

    const template = `# AgentBoard Integration

## Before starting work
Get the next approved item (highest priority, unblocked):
\`\`\`bash
curl -H "Authorization: Bearer ${devKey}" ${baseUrl}/api/items/next
\`\`\`

## Get full context for an item
Includes description, dependency decision logs, and comments:
\`\`\`bash
curl -H "Authorization: Bearer ${devKey}" ${baseUrl}/api/items/{ITEM_ID}/context
\`\`\`

## Mark item as in-progress
\`\`\`bash
curl -X POST -H "Authorization: Bearer ${devKey}" -H "Content-Type: application/json" \\
  -d '{"to":"in_progress"}' ${baseUrl}/api/items/{ITEM_ID}/transition
\`\`\`

## When done, add decision log first
Document what you decided and why:
\`\`\`bash
curl -X POST -H "Authorization: Bearer ${devKey}" -H "Content-Type: application/json" \\
  -d '{"context":"...","decision":"...","alternatives":"...","consequences":"..."}' \\
  ${baseUrl}/api/items/{ITEM_ID}/decision-logs
\`\`\`

## Then mark as done
\`\`\`bash
curl -X POST -H "Authorization: Bearer ${devKey}" -H "Content-Type: application/json" \\
  -d '{"to":"done"}' ${baseUrl}/api/items/{ITEM_ID}/transition
\`\`\`

## Add a comment
\`\`\`bash
curl -X POST -H "Authorization: Bearer ${devKey}" -H "Content-Type: application/json" \\
  -d '{"content":"..."}' ${baseUrl}/api/items/{ITEM_ID}/comments
\`\`\`
`;

    reply.header('Content-Type', 'text/markdown');
    return template;
  });
}
