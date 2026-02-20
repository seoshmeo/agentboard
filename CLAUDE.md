# AgentBoard

Acceptance-driven development board for AI agents. Monorepo with pnpm workspaces.

## Architecture

```
packages/
├── shared/          # TypeScript types + state machine (ItemStatus, Role, transitions)
│   └── src/
│       ├── types.ts     # Item, Project, DecisionLog, Comment, ItemContext, etc.
│       ├── states.ts    # 7 transitions, findTransition(), getAvailableTransitions()
│       └── index.ts     # Barrel export
├── server/          # Fastify API + SQLite (Drizzle ORM) + WebSocket + Telegram
│   └── src/
│       ├── index.ts              # Entry point (port 3000)
│       ├── db/schema.ts          # 6 tables: projects, api_keys, items, dependencies, decision_logs, comments
│       ├── db/connection.ts      # better-sqlite3 + Drizzle, WAL mode
│       ├── db/migrate.ts         # CREATE TABLE IF NOT EXISTS (runs on startup)
│       ├── middleware/auth.ts     # Bearer token → role extraction
│       ├── routes/projects.ts    # CRUD + API key gen + CLAUDE.md template
│       ├── routes/items.ts       # CRUD + transitions + /next + dependencies + comments
│       ├── routes/decisions.ts   # Decision log CRUD
│       ├── routes/health.ts      # GET /api/health + GET /api/auth/me
│       ├── services/state-machine.ts  # Transition validation + execution
│       ├── services/context.ts        # Context assembly (item + deps + logs)
│       ├── services/telegram.ts       # Notifications on pending_review/done/rejected
│       └── ws/index.ts                # WebSocket broadcast to all connected clients
└── web/             # React + Vite + Tailwind v4 + TanStack Query + dnd-kit
    └── src/
        ├── main.tsx              # React entry point + QueryClient
        ├── App.tsx               # Auth screen + Board layout + role badge + Sprint filter
        ├── api/client.ts         # fetch wrapper + all React Query hooks
        ├── hooks/useWebSocket.ts # Auto-reconnecting WS, invalidates queries
        ├── lib/utils.ts          # cn(), color maps, status labels
        └── components/
            ├── Board.tsx         # DnD context + 6 columns
            ├── Column.tsx        # Droppable column with status header
            ├── ItemCard.tsx      # Draggable card (title, priority, sprint)
            ├── ItemDetail.tsx    # Modal: role-aware transitions, edit/delete, deps management, logs, comments
            ├── CreateItemForm.tsx # Create item modal (PM only)
            ├── DecisionLog.tsx   # Expandable log list + role-gated add form
            ├── SprintFilter.tsx  # Sprint dropdown filter
            └── ProjectSelector.tsx  # (unused) Project name display
```

## Development

```bash
pnpm install              # Install dependencies
pnpm build:shared         # Build shared types (required once before server/web)
pnpm dev:server           # Start Fastify server on port 3000
pnpm dev:web              # Start Vite dev server on port 5173 (proxies /api → :3000)
```

Both server and web must be running simultaneously. Start server first.

## State Machine

```
draft → pending_review → approved → in_progress → done → accepted
  ↑         ↓                                       ↓
  └─── reject_review                          reject_result ──→ draft
```

| Transition | From | To | Roles | Requires |
|------------|------|----|-------|----------|
| submit_for_review | draft | pending_review | pm | — |
| approve | pending_review | approved | human | — |
| reject_review | pending_review | draft | human | comment |
| start_work | approved | in_progress | dev | deps met (or force) |
| complete | in_progress | done | dev | ≥1 decision log |
| accept | done | accepted | human | — |
| reject_result | done | draft | human | comment |

## API Endpoints

All endpoints except `POST /api/projects` and `GET /api/health` require `Authorization: Bearer <api-key>`.

### Auth
- `GET /api/auth/me` — Returns `{role, projectId}` for current API key

### Projects
- `POST /api/projects` — Create project (no auth, returns project + 3 API keys)
- `GET /api/projects/:id` — Get project
- `PATCH /api/projects/:id` — Update project (human only)
- `GET /api/projects/:id/api-keys` — List API keys (human only)
- `GET /api/projects/:id/claude-md` — Generate CLAUDE.md template for agents

### Items
- `GET /api/items?status=&sprintTag=&priority=` — List items (dev sees only approved+)
- `POST /api/items` — Create item (pm only, status=draft)
- `GET /api/items/:id` — Get item detail
- `PATCH /api/items/:id` — Update fields (pm/human)
- `DELETE /api/items/:id` — Delete item (human, draft only)
- `POST /api/items/:id/transition` — `{to, comment?, force?}`
- `GET /api/items/:id/context` — Item + dependency decision logs + comments
- `GET /api/items/next` — Next approved unblocked item by priority (dev only)

### Dependencies
- `POST /api/items/:id/dependencies` — `{dependsOnItemId}` (pm only)
- `DELETE /api/items/:id/dependencies/:depId` — (pm/human)

### Decision Logs
- `GET /api/items/:id/decision-logs` — List
- `POST /api/items/:id/decision-logs` — `{context, decision, alternatives?, consequences?}` (dev only)

### Comments
- `GET /api/items/:id/comments` — List
- `POST /api/items/:id/comments` — `{content}` (any role)

## Key Concepts

- **Decision Logs** — Required before marking items as done. Flow into dependent items' context via the Context API. This is the connective tissue between features.
- **Context API** — `GET /api/items/:id/context` returns item + all dependency items with their decision logs + own comments + own logs. Dev agents use this to get full upstream context.
- **Roles** — `pm` (creates/manages items), `dev` (works items, adds decision logs), `human` (approves/accepts/rejects).
- **API Keys** — Auto-generated per project (one per role). Stored in `api_keys` table. Used as Bearer tokens.
- **WebSocket** — All mutations broadcast events. Frontend auto-invalidates React Query cache.
- **Telegram** — Per-project bot token + chat ID. Notifies on pending_review, done, and rejections.

## Database

SQLite at `packages/server/agentboard.db`. Auto-created and migrated on server startup.
6 tables: `projects`, `api_keys`, `items`, `dependencies`, `decision_logs`, `comments`.
WAL mode enabled. Foreign keys enforced.

## Known Issues & TODOs

### Remaining UI
- **Project Selector** — `ProjectSelector.tsx` component exists but unused

### Missing Infrastructure
- No input validation (no Zod/JSON Schema on request bodies)
- No error boundaries in React
- No `.env.example` file
- No tests
- No CI/CD
- No pagination on list endpoints
- No markdown rendering (react-markdown removed due to React 19 incompatibility)
- `@dnd-kit/sortable` is a dependency but unused (no within-column sorting)
