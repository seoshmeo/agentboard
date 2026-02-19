# AgentBoard

Acceptance-driven development board for AI agents. Monorepo with pnpm workspaces.

## Architecture

- `packages/shared` — TypeScript types and state machine (ItemStatus, Role, transitions)
- `packages/server` — Fastify API + SQLite (Drizzle ORM) + WebSocket + Telegram notifications
- `packages/web` — React + Vite + Tailwind v4 + TanStack Query + dnd-kit Kanban board

## Development

```bash
# Install dependencies
pnpm install

# Build shared types (required before server/web)
pnpm build:shared

# Start server (port 3000)
pnpm dev:server

# Start frontend (port 5173, proxies API to :3000)
pnpm dev:web
```

## State Machine

Items flow: draft -> pending_review -> approved -> in_progress -> done -> accepted
- PM creates items (draft), submits for review
- Human approves/rejects
- Dev starts work on approved items, completes with decision logs
- Human accepts/rejects results

## Key Concepts

- **Decision Logs**: Required before marking items as done. Flow into dependent items' context.
- **Context API**: `GET /api/items/:id/context` returns item + dependency decision logs + comments.
- **Roles**: pm (creates/manages items), dev (works items), human (approves/accepts).
- **API Keys**: Generated per project (one per role). Used as Bearer tokens.

## Database

SQLite file at `packages/server/agentboard.db`. Auto-migrated on server startup.
