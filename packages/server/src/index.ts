import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { runMigrations } from './db/migrate.js';
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';
import { itemRoutes } from './routes/items.js';
import { decisionRoutes } from './routes/decisions.js';
import { activityRoutes } from './routes/activity.js';
import { chatRoutes } from './routes/chat.js';
import { wsRoutes } from './ws/index.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(websocket);

// Run migrations on startup
runMigrations();

// Register routes
await app.register(healthRoutes);
await app.register(projectRoutes);
await app.register(itemRoutes);
await app.register(decisionRoutes);
await app.register(activityRoutes);
await app.register(chatRoutes);
await app.register(wsRoutes);

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`AgentBoard server running on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
