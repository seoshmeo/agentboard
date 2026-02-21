# AgentBoard

Acceptance-driven development board for AI agents. Monorepo with pnpm workspaces.

## Architecture

```
packages/
├── shared/          # TypeScript types + state machine (ItemStatus, Role, transitions)
│   └── src/
│       ├── types.ts     # Item, Project, Epic, DecisionLog, Comment, ItemContext, ItemProgress, FileEntry, etc.
│       ├── states.ts    # 7 transitions, findTransition(), getAvailableTransitions()
│       └── index.ts     # Barrel export
├── server/          # Fastify API + SQLite (Drizzle ORM) + WebSocket + Telegram + Agent Worker
│   └── src/
│       ├── index.ts              # Entry point (port 3000)
│       ├── db/schema.ts          # 10 tables: projects, api_keys, items, dependencies, decision_logs, comments, chat_messages, epics, settings, item_progress
│       ├── db/connection.ts      # better-sqlite3 + Drizzle, WAL mode
│       ├── db/migrate.ts         # CREATE TABLE IF NOT EXISTS (runs on startup)
│       ├── middleware/auth.ts     # Bearer token → role extraction
│       ├── routes/projects.ts    # CRUD + API key gen + CLAUDE.md template
│       ├── routes/items.ts       # CRUD + transitions + /next + dependencies + comments + progress
│       ├── routes/decisions.ts   # Decision log CRUD
│       ├── routes/epics.ts       # Epic CRUD + roadmap-text endpoint
│       ├── routes/chat.ts        # AI chat per item (Claude Haiku 4.5)
│       ├── routes/files.ts       # File browser (tree + content, path traversal protection)
│       ├── routes/settings.ts    # Global settings key-value store + resolveAnthropicKey()
│       ├── routes/health.ts      # GET /api/health + GET /api/auth/me
│       ├── services/state-machine.ts  # Transition validation + execution
│       ├── services/context.ts        # Context assembly (item + deps + logs)
│       ├── services/agent-worker.ts   # Auto-plans drafts, auto-implements approved items (Claude Haiku 4.5)
│       ├── services/telegram.ts       # Notifications on pending_review/done/rejected
│       └── ws/index.ts                # WebSocket broadcast to all connected clients
└── web/             # React 19 + Vite + Tailwind v4 + TanStack Query + dnd-kit
    └── src/
        ├── main.tsx              # React entry point + QueryClient
        ├── App.tsx               # Auth screen + Board layout + header with toggles
        ├── api/client.ts         # fetch wrapper + all React Query hooks
        ├── hooks/useWebSocket.ts # Auto-reconnecting WS, invalidates queries
        ├── lib/utils.ts          # cn(), color maps, status labels
        └── components/
            ├── Board.tsx          # DnD context + 6 columns
            ├── Column.tsx         # Droppable column with status header
            ├── ItemCard.tsx       # Draggable card (title, priority, sprint, progress bar)
            ├── ItemDetail.tsx     # Modal: transitions, edit/delete, deps, logs, comments, epic, progress, AI chat
            ├── CreateItemForm.tsx # Create item modal with epic selector
            ├── DecisionLog.tsx    # Expandable log list with markdown rendering
            ├── SprintFilter.tsx   # Sprint dropdown filter
            ├── ProjectSwitcher.tsx  # Multi-project switcher dropdown
            ├── ProjectSettings.tsx  # Project settings modal (name, description, API keys, Telegram, localPath)
            ├── ActivityFeed.tsx   # Real-time activity feed sidebar
            ├── Roadmap.tsx        # Epics/roadmap sidebar with progress bars
            ├── FileBrowser.tsx    # File tree + code viewer modal
            ├── GlobalSettings.tsx # Global Anthropic API key settings modal
            ├── ItemChat.tsx       # AI chat panel within ItemDetail
            └── Markdown.tsx       # Reusable markdown renderer (marked + DOMPurify)
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

All endpoints except `POST /api/projects`, `GET /api/health`, and settings require `Authorization: Bearer <api-key>`.

### Auth
- `GET /api/auth/me` — Returns `{role, projectId}` for current API key

### Projects
- `POST /api/projects` — Create project (no auth, returns project + 3 API keys)
- `GET /api/projects` — List all projects
- `GET /api/projects/:id` — Get project
- `PATCH /api/projects/:id` — Update project (human only, supports name, description, anthropicApiKey, telegramBotToken, telegramChatId, localPath)
- `GET /api/projects/:id/api-keys` — List API keys (human only)
- `GET /api/projects/:id/claude-md` — Generate CLAUDE.md template for agents

### Items
- `GET /api/items?status=&sprintTag=&priority=` — List items (dev sees only approved+)
- `POST /api/items` — Create item (pm only, supports epicId)
- `GET /api/items/:id` — Get item detail
- `PATCH /api/items/:id` — Update fields (pm/human, supports epicId)
- `DELETE /api/items/:id` — Delete item (human, draft only, cascades deps/logs/comments/chat/progress)
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

### Chat (AI)
- `GET /api/items/:id/chat` — List chat messages
- `POST /api/items/:id/chat` — Send message, get Claude response (uses item context + roadmap)

### Progress
- `POST /api/items/:id/progress` — Update progress `{percent, step, log?}` (dev only)
- `GET /api/items/:id/progress` — Get current progress

### Epics
- `GET /api/epics` — List epics with item counts per status
- `POST /api/epics` — Create epic (human/pm)
- `PATCH /api/epics/:id` — Update epic (human/pm)
- `DELETE /api/epics/:id` — Delete epic (human, unlinks items)
- `GET /api/epics/roadmap-text` — Text summary for bot context

### Files
- `GET /api/projects/:id/files?path=` — File tree (requires localPath on project)
- `GET /api/projects/:id/files/content?path=` — File content (text only, max 512KB)

### Settings
- `GET /api/settings` — Get global settings (returns key_set/env booleans, not raw keys)
- `PATCH /api/settings` — Update settings (set key to null to clear)

## Key Concepts

- **Decision Logs** — Required before marking items as done. Flow into dependent items' context via the Context API. This is the connective tissue between features.
- **Context API** — `GET /api/items/:id/context` returns item + all dependency items with their decision logs + own comments + own logs.
- **Roles** — `pm` (creates/manages items), `dev` (works items, adds decision logs), `human` (approves/accepts/rejects).
- **API Keys** — Auto-generated per project (one per role). Stored in `api_keys` table. Used as Bearer tokens.
- **WebSocket** — All mutations broadcast events. Frontend auto-invalidates React Query cache.
- **Telegram** — Per-project bot token + chat ID. Notifies on pending_review, done, and rejections.
- **Agent Worker** — Polls every 15s. Auto-plans draft items (→ pending_review) and auto-implements approved items (→ done) using Claude Haiku 4.5. Injects roadmap context into prompts.
- **Epics/Roadmap** — Group items into epics. Progress bars show completion. Roadmap text is injected into agent and chat system prompts.
- **API Key Fallback** — `resolveAnthropicKey()`: project key → global settings key → `ANTHROPIC_API_KEY` env var.
- **File Browser** — Browse project files when `localPath` is set. Path traversal protection, ignore lists, text-only, 512KB max.
- **Markdown Rendering** — Uses `marked` + `DOMPurify` for descriptions, comments, decision logs, and chat messages.

## Database

SQLite at `packages/server/agentboard.db`. Auto-created and migrated on server startup.
10 tables: `projects`, `api_keys`, `items`, `dependencies`, `decision_logs`, `comments`, `chat_messages`, `epics`, `settings`, `item_progress`.
WAL mode enabled. Foreign keys enforced.

## Known Issues

### Security
- Settings endpoints (`GET/PATCH /api/settings`) have NO auth middleware — anyone can read/write global settings

### Missing Infrastructure
- No input validation (no Zod/JSON Schema on request bodies)
- No error boundaries in React
- No tests
- No CI/CD
- No pagination on list endpoints
- `@dnd-kit/sortable` is a dependency but unused (no within-column sorting)
- `ProjectSelector.tsx` component exists but unused (superseded by ProjectSwitcher)
