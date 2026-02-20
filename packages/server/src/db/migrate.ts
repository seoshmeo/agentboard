import { sqlite } from './connection.js';

export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      telegram_bot_token TEXT,
      telegram_chat_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      role TEXT NOT NULL CHECK(role IN ('pm', 'dev', 'human')),
      key TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pending_review', 'approved', 'in_progress', 'done', 'accepted')),
      sprint_tag TEXT,
      assigned_to TEXT,
      created_by_role TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dependencies (
      item_id TEXT NOT NULL REFERENCES items(id),
      depends_on_item_id TEXT NOT NULL REFERENCES items(id),
      PRIMARY KEY (item_id, depends_on_item_id)
    );

    CREATE TABLE IF NOT EXISTS decision_logs (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      context TEXT NOT NULL,
      decision TEXT NOT NULL,
      alternatives TEXT,
      consequences TEXT,
      created_by_role TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      content TEXT NOT NULL,
      author_role TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES items(id),
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      author_role TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add anthropic_api_key column to projects (idempotent)
  try {
    sqlite.exec(`ALTER TABLE projects ADD COLUMN anthropic_api_key TEXT`);
  } catch {
    // Column already exists
  }
}
