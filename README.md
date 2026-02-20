# AgentBoard

Acceptance-driven development board for AI agents. Create tasks, let an AI agent plan and implement them, review results — all through a Kanban UI with real-time updates.

## How It Works

```
You create a task (draft)
        ↓
Agent writes implementation plan → pending_review
        ↓
You review and approve → approved
        ↓
Agent implements the task → in_progress → done
        ↓
You accept the result → accepted
```

Three roles control the flow:
- **Human** — creates tasks, approves/rejects plans and results, manages project settings
- **PM** — can create and submit tasks for review
- **Dev** — works on tasks, writes decision logs (used by the autonomous agent)

Each role gets its own API key. The built-in agent worker polls every 15 seconds: picks up drafts, generates plans via Claude API, and implements approved items automatically.

## Features

- 6-status Kanban board with drag-and-drop transitions
- Autonomous AI agent (plans drafts, implements approved items)
- AI Chat per item (contextual — knows about the item, dependencies, decision logs)
- Role-based auth with per-role API keys
- Decision logs as connective tissue between dependent features
- Activity feed (comments + decisions chronologically)
- Real-time WebSocket updates
- Multi-project support with project switcher
- Telegram notifications (pending_review, done, rejected)
- Sprint filtering

## Tech Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm workspaces |
| Server | Fastify, Node.js |
| Database | SQLite (better-sqlite3 + Drizzle ORM, WAL mode) |
| Frontend | React 19, Vite 6, Tailwind CSS v4 |
| State | TanStack Query, WebSocket |
| Drag & Drop | dnd-kit |
| AI | Claude API (raw fetch, no SDK) |

## Quick Start

```bash
git clone https://github.com/seoshmeo/agentboard.git
cd agentboard
pnpm install
pnpm build:shared
```

Start both in separate terminals:

```bash
pnpm dev:server    # Fastify API on :3000
pnpm dev:web       # Vite dev server on :5173
```

Open http://localhost:5173, create a project, and you'll get 3 API keys (PM, Dev, Human). Use the Human key to log in — it has full access.

## AI Agent Setup

1. Log in with the **Human** key
2. Open **Project Settings** (click project name in header)
3. Enter your **Anthropic API Key** (`sk-ant-...`)
4. Save

The agent worker starts automatically with the server. It will:
- Pick up `draft` items → call Claude to write a plan → move to `pending_review`
- Pick up `approved` items → call Claude for implementation → add decision log → move to `done`

## State Machine

```
draft → pending_review → approved → in_progress → done → accepted
  ↑         |                                       |
  └── reject_review                          reject_result ──→ draft
```

| Transition | From | To | Roles |
|------------|------|----|-------|
| submit_for_review | draft | pending_review | pm, human |
| approve | pending_review | approved | human |
| reject_review | pending_review | draft | human |
| start_work | approved | in_progress | dev, human |
| complete | in_progress | done | dev, human |
| accept | done | accepted | human |
| reject_result | done | draft | human |

## API

All endpoints (except `POST /api/projects` and `GET /api/health`) require `Authorization: Bearer <api-key>`.

### Projects
```
POST   /api/projects              # Create project (no auth, returns project + 3 keys)
GET    /api/projects              # List all projects
GET    /api/projects/:id          # Get project
PATCH  /api/projects/:id          # Update project (human)
GET    /api/projects/:id/api-keys # List API keys
GET    /api/projects/:id/claude-md # CLAUDE.md template for agents
```

### Items
```
GET    /api/items                 # List items (?status=&sprintTag=&priority=)
POST   /api/items                 # Create item (any role, starts as draft)
GET    /api/items/:id             # Get item
PATCH  /api/items/:id             # Update item (pm/human)
DELETE /api/items/:id             # Delete item (human, draft only)
POST   /api/items/:id/transition  # {to, comment?, force?}
GET    /api/items/:id/context     # Item + deps + decision logs + comments
GET    /api/items/next            # Next approved unblocked item (dev)
```

### Decision Logs
```
GET    /api/items/:id/decision-logs  # List
POST   /api/items/:id/decision-logs  # {context, decision, alternatives?, consequences?}
```

### Comments
```
GET    /api/items/:id/comments    # List
POST   /api/items/:id/comments    # {content}
```

### AI Chat
```
GET    /api/items/:id/chat        # List messages
POST   /api/items/:id/chat        # {content} → saves + calls Claude → returns response
```

### Activity
```
GET    /api/activity?limit=50     # Aggregated comments + decisions feed
```

### Other
```
GET    /api/health                # {status: "ok"}
GET    /api/auth/me               # {role, projectId}
```

## Project Structure

```
packages/
├── shared/     # TypeScript types + state machine
├── server/     # Fastify API + SQLite + WebSocket + agent worker
└── web/        # React Kanban board UI
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `DB_PATH` | `./agentboard.db` | SQLite database path |
| `ANTHROPIC_API_KEY` | — | Fallback API key (per-project keys preferred) |

## CLAUDE.md for Agents

Each project can generate a `CLAUDE.md` template at `GET /api/projects/:id/claude-md`. It includes curl commands with the Dev API key for:
- Getting the next approved item
- Fetching full context (deps + decision logs)
- Transitioning items
- Adding decision logs and comments

Paste it into your agent's project root so it knows how to interact with the board.

## License

MIT
