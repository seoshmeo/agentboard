import TelegramBot from 'node-telegram-bot-api';
import { eq } from 'drizzle-orm';
import { db } from '../db/connection.js';
import { projects, decisionLogs } from '../db/schema.js';
import type { Item } from '@agentboard/shared';

// Cache bots per project to avoid re-creating
const botCache = new Map<string, TelegramBot>();

function getBot(token: string): TelegramBot {
  if (!botCache.has(token)) {
    botCache.set(token, new TelegramBot(token));
  }
  return botCache.get(token)!;
}

export async function notifyTransition(item: Item, newStatus: string, comment?: string) {
  const project = db.select().from(projects).where(eq(projects.id, item.projectId)).get();
  if (!project?.telegramBotToken || !project?.telegramChatId) return;

  let message = '';
  const bot = getBot(project.telegramBotToken);

  switch (newStatus) {
    case 'pending_review':
      message = `📋 *New item ready for review*\n\n*${escapeMarkdown(item.title)}* \\[${item.priority}\\]`;
      break;
    case 'done': {
      const logs = db.select().from(decisionLogs).where(eq(decisionLogs.itemId, item.id)).all();
      const latestDecision = logs[logs.length - 1];
      message = `✅ *Item completed, needs acceptance*\n\n*${escapeMarkdown(item.title)}*`;
      if (latestDecision) {
        message += `\n\nDecision: ${escapeMarkdown(latestDecision.decision)}`;
      }
      break;
    }
    case 'draft':
      if (comment) {
        message = `❌ *Item rejected*\n\n*${escapeMarkdown(item.title)}*\nReason: ${escapeMarkdown(comment)}`;
      }
      break;
    default:
      return;
  }

  if (!message) return;

  try {
    await bot.sendMessage(project.telegramChatId, message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.error('Telegram notification failed:', err);
  }
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
