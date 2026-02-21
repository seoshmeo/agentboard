import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { settings } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

export function getSetting(key: string): string | null {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string | null) {
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    if (value === null) {
      db.delete(settings).where(eq(settings.key, key)).run();
    } else {
      db.update(settings).set({ value }).where(eq(settings.key, key)).run();
    }
  } else if (value !== null) {
    db.insert(settings).values({ key, value }).run();
  }
}

/**
 * Resolve Anthropic API key with fallback chain:
 * 1. Project-level key (if provided)
 * 2. Global setting (settings table)
 * 3. Environment variable
 */
export function resolveAnthropicKey(projectKey?: string | null): string | null {
  if (projectKey) return projectKey;
  const globalKey = getSetting('anthropic_api_key');
  if (globalKey) return globalKey;
  return process.env.ANTHROPIC_API_KEY || null;
}

export async function settingsRoutes(app: FastifyInstance) {
  // Get all settings (masks sensitive values)
  app.get('/api/settings', { preHandler: authMiddleware }, async () => {
    const all = db.select().from(settings).all();
    const result: Record<string, string | boolean> = {};
    for (const row of all) {
      if (row.key.includes('key') || row.key.includes('secret') || row.key.includes('token')) {
        result[row.key] = row.value ? '***configured***' : '';
        result[`${row.key}_set`] = !!row.value;
      } else {
        result[row.key] = row.value || '';
      }
    }
    // Always include anthropic_api_key status
    if (!result['anthropic_api_key_set']) {
      const envKey = process.env.ANTHROPIC_API_KEY;
      result['anthropic_api_key_set'] = !!getSetting('anthropic_api_key');
      result['anthropic_api_key_env'] = !!envKey;
    }
    return result;
  });

  // Update settings (human only)
  app.patch('/api/settings', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.role !== 'human') {
      return reply.status(403).send({ error: 'Only human role can update settings' });
    }
    const body = request.body as Record<string, string | null>;
    for (const [key, value] of Object.entries(body)) {
      setSetting(key, value || null);
    }
    return { ok: true };
  });
}
