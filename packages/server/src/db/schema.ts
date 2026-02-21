import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  anthropicApiKey: text('anthropic_api_key'),
  telegramBotToken: text('telegram_bot_token'),
  telegramChatId: text('telegram_chat_id'),
  localPath: text('local_path'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  role: text('role', { enum: ['pm', 'dev', 'human'] }).notNull(),
  key: text('key').notNull().unique(),
  name: text('name'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const epics = sqliteTable('epics', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['planned', 'active', 'completed'] }).default('planned').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority', { enum: ['critical', 'high', 'medium', 'low'] }).default('medium').notNull(),
  status: text('status', {
    enum: ['draft', 'pending_review', 'approved', 'in_progress', 'done', 'accepted'],
  }).default('draft').notNull(),
  sprintTag: text('sprint_tag'),
  epicId: text('epic_id').references(() => epics.id),
  assignedTo: text('assigned_to'),
  createdByRole: text('created_by_role'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const dependencies = sqliteTable('dependencies', {
  itemId: text('item_id').notNull().references(() => items.id),
  dependsOnItemId: text('depends_on_item_id').notNull().references(() => items.id),
}, (table) => [
  primaryKey({ columns: [table.itemId, table.dependsOnItemId] }),
]);

export const decisionLogs = sqliteTable('decision_logs', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id),
  context: text('context').notNull(),
  decision: text('decision').notNull(),
  alternatives: text('alternatives'),
  consequences: text('consequences'),
  createdByRole: text('created_by_role'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id),
  content: text('content').notNull(),
  authorRole: text('author_role'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const itemProgress = sqliteTable('item_progress', {
  itemId: text('item_id').primaryKey().references(() => items.id),
  percent: integer('percent').default(0).notNull(),
  step: text('step').notNull(),
  log: text('log'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => items.id),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  authorRole: text('author_role'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});
