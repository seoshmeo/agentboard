import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { apiKeys } from '../db/schema.js';
import type { Role } from '@agentboard/shared';

declare module 'fastify' {
  interface FastifyRequest {
    projectId: string;
    role: Role;
    apiKeyId: string;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const key = authHeader.slice(7);
  const found = db.select().from(apiKeys).where(eq(apiKeys.key, key)).get();

  if (!found) {
    return reply.status(401).send({ error: 'Invalid API key' });
  }

  request.projectId = found.projectId;
  request.role = found.role as Role;
  request.apiKeyId = found.id;
}
