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
import { epicRoutes } from './routes/epics.js';
import { fileRoutes } from './routes/files.js';
import { settingsRoutes } from './routes/settings.js';
import { wsRoutes } from './ws/index.js';
import { startAgentWorker } from './services/agent-worker.js';

const app = Fastify({ logger: true });

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(o => o.trim());

await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, server-to-server, mobile apps)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
});
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
await app.register(epicRoutes);
await app.register(fileRoutes);
await app.register(settingsRoutes);
await app.register(wsRoutes);

const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`AgentBoard server running on http://${host}:${port}`);
  startAgentWorker();
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
