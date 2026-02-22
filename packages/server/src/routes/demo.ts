import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { projects, apiKeys, epics, items, dependencies, decisionLogs, comments, itemProgress } from '../db/schema.js';
import type { Role } from '@agentboard/shared';

export async function demoRoutes(app: FastifyInstance) {
  app.post('/api/demo', async (_request, reply) => {
    const suffix = nanoid(6);
    const projectId = nanoid();
    const now = new Date().toISOString();

    // Create project with __demo__ marker in description
    db.insert(projects).values({
      id: projectId,
      name: `Demo Project ${suffix}`,
      description: '__demo__',
      createdAt: now,
      updatedAt: now,
    }).run();

    // Create API keys
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

    const humanKey = keys.find(k => k.role === 'human')!.key;

    // Create epics
    const epicAuth = nanoid();
    const epicDash = nanoid();

    db.insert(epics).values({
      id: epicAuth,
      projectId,
      title: 'User Authentication',
      description: 'Complete authentication system with JWT, OAuth, and security hardening.',
      status: 'active',
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    }).run();

    db.insert(epics).values({
      id: epicDash,
      projectId,
      title: 'Dashboard & Analytics',
      description: 'Real-time analytics dashboard with charts, data pipeline, and export capabilities.',
      status: 'planned',
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    }).run();

    // Create items across all 6 statuses
    const itemIds = Array.from({ length: 10 }, () => nanoid());

    const itemData = [
      {
        id: itemIds[0],
        projectId,
        title: 'Design login page mockups',
        description: 'Create Figma mockups for the login, registration, and password reset pages. Include responsive layouts for mobile and desktop.',
        priority: 'medium' as const,
        status: 'accepted' as const,
        epicId: epicAuth,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[1],
        projectId,
        title: 'Implement JWT authentication',
        description: 'Set up JWT-based auth with access/refresh token flow. Include token rotation, secure cookie storage, and middleware for protected routes.',
        priority: 'high' as const,
        status: 'done' as const,
        epicId: epicAuth,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[2],
        projectId,
        title: 'Add password reset flow',
        description: 'Implement forgot password → email verification → reset password flow. Use time-limited tokens and rate limiting on the reset endpoint.',
        priority: 'high' as const,
        status: 'in_progress' as const,
        epicId: epicAuth,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[3],
        projectId,
        title: 'Set up OAuth providers',
        description: 'Integrate Google and GitHub OAuth2 login. Map external accounts to internal user records. Handle account linking for existing users.',
        priority: 'medium' as const,
        status: 'approved' as const,
        epicId: epicAuth,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[4],
        projectId,
        title: 'Add rate limiting to auth endpoints',
        description: 'Implement sliding-window rate limiting on login, register, and password reset endpoints. Use Redis for distributed counting. Return Retry-After headers.',
        priority: 'high' as const,
        status: 'pending_review' as const,
        epicId: epicAuth,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[5],
        projectId,
        title: 'Write auth integration tests',
        description: 'End-to-end tests for login, registration, JWT refresh, OAuth flows, and rate limiting. Use Vitest + Supertest. Target 90% coverage on auth module.',
        priority: 'medium' as const,
        status: 'draft' as const,
        epicId: epicAuth,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[6],
        projectId,
        title: 'Design analytics dashboard',
        description: 'Create dashboard layout with key metrics cards, time-series charts, and filterable data tables. Include dark mode support.',
        priority: 'high' as const,
        status: 'pending_review' as const,
        epicId: epicDash,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[7],
        projectId,
        title: 'Set up data pipeline',
        description: 'Build ETL pipeline: ingest raw events → transform/aggregate → store in analytics tables. Support backfill and incremental updates.',
        priority: 'critical' as const,
        status: 'draft' as const,
        epicId: epicDash,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[8],
        projectId,
        title: 'Create chart components',
        description: 'Reusable chart components (line, bar, pie, area) using Recharts. Support responsive sizing, tooltips, and theme integration.',
        priority: 'medium' as const,
        status: 'draft' as const,
        epicId: epicDash,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: itemIds[9],
        projectId,
        title: 'Add export to CSV',
        description: 'Export any data table or chart data to CSV format. Support filtered exports and scheduled email reports.',
        priority: 'low' as const,
        status: 'draft' as const,
        epicId: epicDash,
        createdByRole: 'pm',
        createdAt: now,
        updatedAt: now,
      },
    ];

    for (const item of itemData) {
      db.insert(items).values(item).run();
    }

    // Dependency: OAuth providers (#4) depends on JWT authentication (#2)
    db.insert(dependencies).values({
      itemId: itemIds[3],
      dependsOnItemId: itemIds[1],
    }).run();

    // Decision logs on accepted/done items
    db.insert(decisionLogs).values({
      id: nanoid(),
      itemId: itemIds[0],
      context: 'Needed to choose between custom design vs. using a UI kit for the login pages.',
      decision: 'Used Tailwind UI components as a base and customized to match brand guidelines. Saves ~2 days of design work while maintaining visual consistency.',
      alternatives: 'Fully custom design from scratch; shadcn/ui components; Material UI templates',
      consequences: 'Faster delivery but slightly less unique visual identity. Easy to customize later.',
      createdByRole: 'dev',
      createdAt: now,
    }).run();

    db.insert(decisionLogs).values({
      id: nanoid(),
      itemId: itemIds[1],
      context: 'Choosing between session-based auth and JWT tokens for the API.',
      decision: 'Implemented JWT with short-lived access tokens (15min) and long-lived refresh tokens (7d). Access tokens in memory, refresh tokens in httpOnly cookies.',
      alternatives: 'Session-based auth with Redis store; Passport.js with sessions; Auth0 hosted auth',
      consequences: 'Stateless API scales well horizontally. Refresh token rotation prevents token theft. Slightly more complex client-side logic for token refresh.',
      createdByRole: 'dev',
      createdAt: now,
    }).run();

    // Comments on pending_review items (simulating agent plans)
    db.insert(comments).values({
      id: nanoid(),
      itemId: itemIds[4],
      content: '**Implementation Plan:**\n\n1. Add `rate-limiter-flexible` package with Redis adapter\n2. Create middleware factory: `createRateLimiter(points, duration)`\n3. Apply to `/auth/login` (5 req/min), `/auth/register` (3 req/min), `/auth/reset` (2 req/min)\n4. Return `429 Too Many Requests` with `Retry-After` header\n5. Add bypass for internal service-to-service calls\n\nEstimated: ~4 hours',
      authorRole: 'dev',
      createdAt: now,
    }).run();

    db.insert(comments).values({
      id: nanoid(),
      itemId: itemIds[1],
      content: 'JWT implementation looks solid. Verified token rotation works correctly in staging. Ready for acceptance.',
      authorRole: 'human',
      createdAt: now,
    }).run();

    db.insert(comments).values({
      id: nanoid(),
      itemId: itemIds[6],
      content: '**Implementation Plan:**\n\n1. Create `DashboardLayout` component with responsive grid\n2. Build `MetricCard` (value, trend arrow, sparkline)\n3. Add `TimeSeriesChart` with date range selector\n4. Build `DataTable` with sort, filter, and pagination\n5. Wire up to analytics API endpoints\n\nWill use Recharts for charts and TanStack Table for data grids.',
      authorRole: 'dev',
      createdAt: now,
    }).run();

    // Progress on in_progress item
    db.insert(itemProgress).values({
      itemId: itemIds[2],
      percent: 40,
      step: 'Building email verification service',
      log: 'Completed: reset token generation, email template. Next: verification endpoint, rate limiting.',
      updatedAt: now,
    }).run();

    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();

    return {
      project,
      apiKeys: keys,
      humanKey,
    };
  });
}
