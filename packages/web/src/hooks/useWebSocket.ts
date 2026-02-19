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
          }
          if (eventName?.startsWith('comment:')) {
            queryClient.invalidateQueries({ queryKey: ['comments'] });
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
