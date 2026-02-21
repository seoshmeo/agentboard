import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/connection.js';
import { items, chatMessages, comments, decisionLogs, dependencies, projects, epics } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { broadcast } from '../ws/index.js';
import { resolveAnthropicKey } from './settings.js';

function buildSystemPrompt(context: {
  item: { title: string; description: string | null; status: string; priority: string };
  decisionLogs: { decision: string; context: string }[];
  comments: { content: string; authorRole: string | null }[];
  deps: { title: string; status: string; decisions: string[] }[];
  roadmapText?: string;
}): string {
  let prompt = `You are an AI assistant helping with a development task on AgentBoard.

## Current Item
**Title**: ${context.item.title}
**Status**: ${context.item.status}
**Priority**: ${context.item.priority}
${context.item.description ? `**Description**: ${context.item.description}` : ''}`;

  if (context.deps.length > 0) {
    prompt += '\n\n## Dependencies';
    for (const dep of context.deps) {
      prompt += `\n- **${dep.title}** (${dep.status})`;
      for (const d of dep.decisions) {
        prompt += `\n  - Decision: ${d}`;
      }
    }
  }

  if (context.decisionLogs.length > 0) {
    prompt += '\n\n## Decision Logs';
    for (const log of context.decisionLogs) {
      prompt += `\n- **Context**: ${log.context}\n  **Decision**: ${log.decision}`;
    }
  }

  if (context.comments.length > 0) {
    prompt += '\n\n## Recent Comments';
    for (const c of context.comments.slice(-10)) {
      prompt += `\n- [${c.authorRole || 'unknown'}]: ${c.content}`;
    }
  }

  if (context.roadmapText) {
    prompt += '\n\n## Project Roadmap\n' + context.roadmapText;
  }

  prompt += '\n\nHelp the user with questions about this item. Be concise and actionable.';
  return prompt;
}

export async function chatRoutes(app: FastifyInstance) {
  // List chat messages
  app.get('/api/items/:id/chat', { preHandler: authMiddleware }, async (request) => {
    const { id } = request.params as { id: string };
    return db.select().from(chatMessages).where(eq(chatMessages.itemId, id)).all();
  });

  // Send chat message
  app.post('/api/items/:id/chat', { preHandler: authMiddleware }, async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.projectId)).get();
    const apiKey = resolveAnthropicKey(project?.anthropicApiKey);
    if (!apiKey) {
      return reply.status(503).send({ error: 'AI chat not available — set Anthropic API Key in Global Settings or Project Settings' });
    }

    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    if (!content) return reply.status(400).send({ error: 'content is required' });

    const item = db.select().from(items).where(
      and(eq(items.id, id), eq(items.projectId, request.projectId))
    ).get();
    if (!item) return reply.status(404).send({ error: 'Item not found' });

    // Save user message
    const userMsgId = nanoid();
    db.insert(chatMessages).values({
      id: userMsgId,
      itemId: id,
      role: 'user',
      content,
      authorRole: request.role,
    }).run();

    broadcast('chat:message', { itemId: id, id: userMsgId, role: 'user' });

    // Build context
    const itemDecisions = db.select().from(decisionLogs).where(eq(decisionLogs.itemId, id)).all();
    const itemComments = db.select().from(comments).where(eq(comments.itemId, id)).all();
    const itemDeps = db.select().from(dependencies).where(eq(dependencies.itemId, id)).all();

    const deps = itemDeps.map(d => {
      const depItem = db.select().from(items).where(eq(items.id, d.dependsOnItemId)).get();
      const depDecisions = db.select().from(decisionLogs).where(eq(decisionLogs.itemId, d.dependsOnItemId)).all();
      return {
        title: depItem?.title || 'Unknown',
        status: depItem?.status || 'unknown',
        decisions: depDecisions.map(dl => dl.decision),
      };
    });

    // Build roadmap text
    const projectEpics = db.select().from(epics)
      .where(eq(epics.projectId, request.projectId))
      .all();
    projectEpics.sort((a, b) => a.sortOrder - b.sortOrder);
    let roadmapText = '';
    for (const epic of projectEpics) {
      roadmapText += `## Epic: ${epic.title} (${epic.status})\n`;
      const epicItems = db.select().from(items)
        .where(and(eq(items.projectId, request.projectId), eq(items.epicId, epic.id)))
        .all();
      for (const ei of epicItems) {
        roadmapText += `  - [${ei.status}] ${ei.title}\n`;
      }
    }

    const systemPrompt = buildSystemPrompt({
      item: { title: item.title, description: item.description, status: item.status, priority: item.priority },
      decisionLogs: itemDecisions.map(d => ({ decision: d.decision, context: d.context })),
      comments: itemComments.map(c => ({ content: c.content, authorRole: c.authorRole })),
      deps,
      roadmapText: roadmapText || undefined,
    });

    // Get chat history
    const history = db.select().from(chatMessages).where(eq(chatMessages.itemId, id)).all();
    const messages = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Call Claude API
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        app.log.error(`Claude API error: ${response.status} ${err}`);
        return reply.status(502).send({ error: 'AI service error' });
      }

      const data = await response.json() as { content: { type: string; text: string }[] };
      const assistantContent = data.content
        .filter((c: { type: string }) => c.type === 'text')
        .map((c: { text: string }) => c.text)
        .join('');

      // Save assistant message
      const asstMsgId = nanoid();
      db.insert(chatMessages).values({
        id: asstMsgId,
        itemId: id,
        role: 'assistant',
        content: assistantContent,
        authorRole: null,
      }).run();

      broadcast('chat:message', { itemId: id, id: asstMsgId, role: 'assistant' });

      return {
        userMessage: db.select().from(chatMessages).where(eq(chatMessages.id, userMsgId)).get(),
        assistantMessage: db.select().from(chatMessages).where(eq(chatMessages.id, asstMsgId)).get(),
      };
    } catch (err) {
      app.log.error(err);
      return reply.status(502).send({ error: 'Failed to reach AI service' });
    }
  });
}
