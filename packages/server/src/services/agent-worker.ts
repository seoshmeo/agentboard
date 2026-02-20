import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { projects, items, comments, decisionLogs, dependencies } from '../db/schema.js';
import { broadcast } from '../ws/index.js';

const POLL_INTERVAL = 15_000; // 15 seconds

async function callClaude(apiKey: string, system: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.filter(c => c.type === 'text').map(c => c.text).join('');
}

function addComment(itemId: string, content: string, role: string = 'dev') {
  const id = nanoid();
  db.insert(comments).values({ id, itemId, content, authorRole: role }).run();
  const comment = db.select().from(comments).where(eq(comments.id, id)).get();
  broadcast('comment:added', comment);
  return comment;
}

function addDecisionLog(itemId: string, context: string, decision: string) {
  const id = nanoid();
  db.insert(decisionLogs).values({
    id, itemId, context, decision, createdByRole: 'dev',
  }).run();
  broadcast('decision:added', { id, itemId });
}

function transitionItem(itemId: string, to: 'draft' | 'pending_review' | 'approved' | 'in_progress' | 'done' | 'accepted') {
  const item = db.select().from(items).where(eq(items.id, itemId)).get();
  if (!item) return;
  const from = item.status;
  db.update(items).set({ status: to, updatedAt: new Date().toISOString() }).where(eq(items.id, itemId)).run();
  const updated = db.select().from(items).where(eq(items.id, itemId)).get();
  broadcast('item:transitioned', { item: updated, from, to });
}

function getItemDepsContext(itemId: string): string {
  const deps = db.select().from(dependencies).where(eq(dependencies.itemId, itemId)).all();
  if (deps.length === 0) return '';

  let ctx = '\n\nDependencies:\n';
  for (const dep of deps) {
    const depItem = db.select().from(items).where(eq(items.id, dep.dependsOnItemId)).get();
    if (depItem) {
      ctx += `- ${depItem.title} (${depItem.status})\n`;
      const logs = db.select().from(decisionLogs).where(eq(decisionLogs.itemId, dep.dependsOnItemId)).all();
      for (const log of logs) {
        ctx += `  Decision: ${log.decision}\n`;
      }
    }
  }
  return ctx;
}

async function processDraftItems(projectId: string, apiKey: string) {
  const drafts = db.select().from(items)
    .where(eq(items.projectId, projectId))
    .all()
    .filter(i => i.status === 'draft');

  for (const item of drafts) {
    console.log(`[Agent] Planning draft item: "${item.title}"`);

    try {
      const depsCtx = getItemDepsContext(item.id);
      const plan = await callClaude(
        apiKey,
        `You are a senior software architect. Write a clear, actionable implementation plan for the given task. Include:
1. Approach overview (2-3 sentences)
2. Step-by-step implementation plan (numbered)
3. Key technical decisions
4. Potential risks or considerations

Be concise but thorough. Write in the same language as the task description.`,
        `Task: ${item.title}${item.description ? `\n\nDescription: ${item.description}` : ''}${depsCtx}\n\nPriority: ${item.priority}`
      );

      addComment(item.id, `**Implementation Plan**\n\n${plan}`, 'dev');
      transitionItem(item.id, 'pending_review');
      console.log(`[Agent] Item "${item.title}" → pending_review`);
    } catch (err) {
      console.error(`[Agent] Failed to plan "${item.title}":`, err);
    }
  }
}

async function processApprovedItems(projectId: string, apiKey: string) {
  const approved = db.select().from(items)
    .where(eq(items.projectId, projectId))
    .all()
    .filter(i => i.status === 'approved');

  for (const item of approved) {
    console.log(`[Agent] Starting work on: "${item.title}"`);

    // Move to in_progress
    transitionItem(item.id, 'in_progress');
    broadcast('item:transitioned', { item: db.select().from(items).where(eq(items.id, item.id)).get(), from: 'approved', to: 'in_progress' });

    try {
      // Get existing comments (including the plan)
      const itemComments = db.select().from(comments).where(eq(comments.itemId, item.id)).all();
      const planComment = itemComments.find(c => c.content.includes('Implementation Plan'));
      const depsCtx = getItemDepsContext(item.id);

      const implementation = await callClaude(
        apiKey,
        `You are a senior developer implementing a task. Based on the task description and the approved plan, write:

1. The implementation details — what files to create/modify, what code to write
2. Key decisions made during implementation and why
3. What was completed

Be specific and technical. Write in the same language as the task.`,
        `Task: ${item.title}${item.description ? `\nDescription: ${item.description}` : ''}${planComment ? `\n\nApproved plan:\n${planComment.content}` : ''}${depsCtx}`
      );

      // Add implementation as comment
      addComment(item.id, `**Implementation**\n\n${implementation}`, 'dev');

      // Add decision log (required for done transition)
      addDecisionLog(
        item.id,
        `Implementation of: ${item.title}`,
        implementation.slice(0, 500) + (implementation.length > 500 ? '...' : '')
      );

      // Move to done
      transitionItem(item.id, 'done');
      console.log(`[Agent] Item "${item.title}" → done`);
    } catch (err) {
      console.error(`[Agent] Failed to implement "${item.title}":`, err);
      // Leave in_progress, will retry next cycle
    }
  }
}

async function tick() {
  try {
    const allProjects = db.select().from(projects).all();

    for (const project of allProjects) {
      if (!project.anthropicApiKey) continue;

      await processDraftItems(project.id, project.anthropicApiKey);
      await processApprovedItems(project.id, project.anthropicApiKey);
    }
  } catch (err) {
    console.error('[Agent] Worker error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startAgentWorker() {
  console.log(`[Agent] Worker started (polling every ${POLL_INTERVAL / 1000}s)`);
  // Run first tick after a short delay
  setTimeout(tick, 5000);
  intervalId = setInterval(tick, POLL_INTERVAL);
}

export function stopAgentWorker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Agent] Worker stopped');
  }
}
