import { eq, and, lt } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { projects, apiKeys, items, epics, dependencies, decisionLogs, comments, chatMessages, itemProgress } from '../db/schema.js';

const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const DEMO_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function startDemoCleanup() {
  setInterval(cleanupDemoProjects, CLEANUP_INTERVAL);
  console.log('Demo cleanup scheduled (every 1h, TTL 24h)');
}

function cleanupDemoProjects() {
  const cutoff = new Date(Date.now() - DEMO_TTL).toISOString();

  const demoProjects = db.select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.description, '__demo__'), lt(projects.createdAt, cutoff)))
    .all();

  if (demoProjects.length === 0) return;

  for (const proj of demoProjects) {
    // Get all item IDs for this project
    const projectItems = db.select({ id: items.id })
      .from(items)
      .where(eq(items.projectId, proj.id))
      .all();

    const itemIds = projectItems.map(i => i.id);

    // Delete item-related data
    for (const itemId of itemIds) {
      db.delete(dependencies).where(eq(dependencies.itemId, itemId)).run();
      db.delete(dependencies).where(eq(dependencies.dependsOnItemId, itemId)).run();
      db.delete(decisionLogs).where(eq(decisionLogs.itemId, itemId)).run();
      db.delete(comments).where(eq(comments.itemId, itemId)).run();
      db.delete(chatMessages).where(eq(chatMessages.itemId, itemId)).run();
      db.delete(itemProgress).where(eq(itemProgress.itemId, itemId)).run();
    }

    // Delete items, epics, api keys, then project
    db.delete(items).where(eq(items.projectId, proj.id)).run();
    db.delete(epics).where(eq(epics.projectId, proj.id)).run();
    db.delete(apiKeys).where(eq(apiKeys.projectId, proj.id)).run();
    db.delete(projects).where(eq(projects.id, proj.id)).run();
  }

  console.log(`Demo cleanup: removed ${demoProjects.length} expired demo project(s)`);
}
