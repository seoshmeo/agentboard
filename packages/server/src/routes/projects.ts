import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { projects, apiKeys } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Role } from '@agentboard/shared';

export async function projectRoutes(app: FastifyInstance) {
  // Create project — no auth required (bootstrapping)
  app.post('/api/projects', async (request, reply) => {
    const { name, description } = request.body as { name: string; description?: string };
    if (!name) return reply.status(400).send({ error: 'name is required' });

    const projectId = nanoid();
    db.insert(projects).values({ id: projectId, name, description: description ?? null }).run();

    const roles: Role[] = ['pm', 'dev', 'human'];
    const keys = roles.map(role => ({
      id: nanoid(),
      projectId,
      role,
      key: crypto.randomUUID(),
      name: `${role} key`,
    }));

    for (const key of keys) {
      db.insert(apiKeys).values(key).run();
    }

    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    return { project, apiKeys: keys };
  });

  // Get project
  app.get('/api/projects/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.projectId !== id) return reply.status(403).send({ error: 'Access denied' });

    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return project;
  });

  // Update project
  app.patch('/api/projects/:id', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.projectId !== id) return reply.status(403).send({ error: 'Access denied' });
    if (request.role !== 'human') return reply.status(403).send({ error: 'Only human role can update projects' });

    const body = request.body as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.telegramBotToken !== undefined) updates.telegramBotToken = body.telegramBotToken;
    if (body.telegramChatId !== undefined) updates.telegramChatId = body.telegramChatId;

    db.update(projects).set(updates).where(eq(projects.id, id)).run();
    return db.select().from(projects).where(eq(projects.id, id)).get();
  });

  // List API keys for project
  app.get('/api/projects/:id/api-keys', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.projectId !== id) return reply.status(403).send({ error: 'Access denied' });
    if (request.role !== 'human') return reply.status(403).send({ error: 'Only human role can view API keys' });

    return db.select().from(apiKeys).where(eq(apiKeys.projectId, id)).all();
  });

  // CLAUDE.md template
  app.get('/api/projects/:id/claude-md', { preHandler: authMiddleware }, async (request, reply) => {
    const { id } = request.params as { id: string };
    if (request.projectId !== id) return reply.status(403).send({ error: 'Access denied' });

    const keys = db.select().from(apiKeys).where(eq(apiKeys.projectId, id)).all();
    const devKey = keys.find(k => k.role === 'dev')?.key || 'YOUR_DEV_API_KEY';
    const baseUrl = 'http://localhost:3000';

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
