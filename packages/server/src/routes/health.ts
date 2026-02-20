import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/api/auth/me', { preHandler: authMiddleware }, async (request) => {
    return { role: request.role, projectId: request.projectId };
  });
}
