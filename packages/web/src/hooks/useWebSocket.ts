import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const { event: eventName } = JSON.parse(event.data);
          if (eventName?.startsWith('item:') || eventName?.startsWith('dependency:')) {
            queryClient.invalidateQueries({ queryKey: ['items'] });
            queryClient.invalidateQueries({ queryKey: ['item'] });
            queryClient.invalidateQueries({ queryKey: ['itemContext'] });
          }
          if (eventName?.startsWith('decision:')) {
            queryClient.invalidateQueries({ queryKey: ['decisionLogs'] });
            queryClient.invalidateQueries({ queryKey: ['activity'] });
          }
          if (eventName?.startsWith('comment:')) {
            queryClient.invalidateQueries({ queryKey: ['comments'] });
            queryClient.invalidateQueries({ queryKey: ['activity'] });
          }
          if (eventName?.startsWith('chat:')) {
            queryClient.invalidateQueries({ queryKey: ['chat'] });
          }
          if (eventName?.startsWith('progress:')) {
            queryClient.invalidateQueries({ queryKey: ['progress'] });
          }
          if (eventName?.startsWith('epic:')) {
            queryClient.invalidateQueries({ queryKey: ['epics'] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
          }
        } catch {}
      };

      ws.onclose = () => {
        setTimeout(connect, 3000);
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, [queryClient]);
}
