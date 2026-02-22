import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';

const eventCounts: Record<string, number> = {};

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/api/auth/me', { preHandler: authMiddleware }, async (request) => {
    return { role: request.role, projectId: request.projectId };
  });

  app.post<{ Body: { event: string } }>('/api/track', async (request, reply) => {
    const { event } = request.body || {};
    if (!event || typeof event !== 'string') return reply.status(400).send({ error: 'event required' });
    const allowed = ['page_view', 'connect_click', 'try_demo_click', 'open_project_click', 'create_project_click'];
    if (!allowed.includes(event)) return reply.status(400).send({ error: 'unknown event' });
    eventCounts[event] = (eventCounts[event] || 0) + 1;
    const ip = request.headers['x-forwarded-for'] || request.ip;
    console.log(`[TRACK] ${event} | ip=${ip} | total=${eventCounts[event]} | ${new Date().toISOString()}`);
    return { ok: true };
  });

  app.get('/api/stats', async () => {
    return { counts: eventCounts, since: process.uptime() };
  });
}
