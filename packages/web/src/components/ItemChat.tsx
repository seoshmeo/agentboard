import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User } from 'lucide-react';
import { useChatMessages, useSendChatMessage } from '../api/client.js';
import { cn, ROLE_BADGE_COLORS, relativeTime } from '../lib/utils.js';
import type { Role } from '@agentboard/shared';

interface ItemChatProps {
  itemId: string;
  role?: Role;
}

const ROLE_LABELS: Record<string, string> = { pm: 'PM', dev: 'Dev', human: 'Human' };

export function ItemChat({ itemId, role }: ItemChatProps) {
  const { data: messages, isLoading } = useChatMessages(itemId);
  const sendMessage = useSendChatMessage();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    if (!input.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ itemId, content: input.trim() });
    setInput('');
  }

  return (
    <div>
      {/* Messages */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto space-y-2 mb-3">
        {isLoading && <p className="text-xs text-gray-500">Loading chat...</p>}
        {messages && messages.length === 0 && !sendMessage.isPending && (
          <p className="text-xs text-gray-600">No messages yet. Ask the AI about this item.</p>
        )}
        {messages?.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'rounded-lg p-3 text-sm',
              msg.role === 'user'
                ? 'bg-violet-900/30 border border-violet-800/30 ml-8'
                : 'bg-gray-800 border border-gray-700/50 mr-8'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {msg.role === 'assistant' ? (
                <Bot className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <User className="w-3.5 h-3.5 text-violet-400" />
              )}
              <span className="text-[10px] font-medium text-gray-500">
                {msg.role === 'assistant' ? 'AI' : (msg.authorRole ? ROLE_LABELS[msg.authorRole] || msg.authorRole : 'You')}
              </span>
              {msg.authorRole && msg.role === 'user' && (
                <span className={cn('text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border', ROLE_BADGE_COLORS[msg.authorRole] || 'text-gray-500 border-gray-700')}>
                  {ROLE_LABELS[msg.authorRole] || msg.authorRole}
                </span>
              )}
              <span className="text-[10px] text-gray-600">{relativeTime(msg.createdAt)}</span>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap">{msg.content}</p>
          </div>
        ))}
        {sendMessage.isPending && (
          <div className="bg-gray-800 border border-gray-700/50 rounded-lg p-3 mr-8">
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span className="text-xs text-gray-400">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {sendMessage.isError && (
        <p className="text-xs text-red-400 mb-2">{(sendMessage.error as Error).message}</p>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI about this item..."
          disabled={sendMessage.isPending}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sendMessage.isPending}
          className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
