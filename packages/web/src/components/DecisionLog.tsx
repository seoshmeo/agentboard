import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useAddDecisionLog } from '../api/client.js';
import type { DecisionLog as DecisionLogType } from '@agentboard/shared';

interface DecisionLogProps {
  itemId: string;
  logs: DecisionLogType[];
  canAdd?: boolean;
}

export function DecisionLog({ itemId, logs, canAdd = true }: DecisionLogProps) {
  const [showForm, setShowForm] = useState(false);
  const [context, setContext] = useState('');
  const [decision, setDecision] = useState('');
  const [alternatives, setAlternatives] = useState('');
  const [consequences, setConsequences] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const addLog = useAddDecisionLog();

  function handleSubmit() {
    if (!context.trim() || !decision.trim()) return;
    addLog.mutate({
      itemId,
      context: context.trim(),
      decision: decision.trim(),
      alternatives: alternatives.trim() || undefined,
      consequences: consequences.trim() || undefined,
    }, {
      onSuccess: () => {
        setContext('');
        setDecision('');
        setAlternatives('');
        setConsequences('');
        setShowForm(false);
      },
    });
  }

  return (
    <div>
      {logs.length > 0 && (
        <div className="space-y-2 mb-3">
          {logs.map(log => (
            <div key={log.id} className="bg-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-violet-400">{log.decision}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{log.createdAt}</p>
                </div>
                {expandedLog === log.id
                  ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
              </button>
              {expandedLog === log.id && (
                <div className="px-3 pb-3 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-gray-400">Context: </span>
                    <span className="text-gray-300">{log.context}</span>
                  </div>
                  {log.alternatives && (
                    <div>
                      <span className="font-semibold text-gray-400">Alternatives: </span>
                      <span className="text-gray-300">{log.alternatives}</span>
                    </div>
                  )}
                  {log.consequences && (
                    <div>
                      <span className="font-semibold text-gray-400">Consequences: </span>
                      <span className="text-gray-300">{log.consequences}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {logs.length === 0 && !showForm && (
        <p className="text-xs text-gray-600 mb-2">No decision logs yet.</p>
      )}

      {canAdd && (showForm ? (
        <div className="bg-gray-800 rounded-lg p-3 space-y-2">
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Context — Why was this decision needed?"
            className="w-full px-2.5 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder="Decision — What was decided?"
            className="w-full px-2.5 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={alternatives}
            onChange={(e) => setAlternatives(e.target.value)}
            placeholder="Alternatives — What else was considered? (optional)"
            className="w-full px-2.5 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={consequences}
            onChange={(e) => setConsequences(e.target.value)}
            placeholder="Consequences — What are the implications? (optional)"
            className="w-full px-2.5 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowForm(false)}
              className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!context.trim() || !decision.trim() || addLog.isPending}
              className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded"
            >
              {addLog.isPending ? 'Saving...' : 'Save Decision'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Decision Log
        </button>
      ))}
    </div>
  );
}
