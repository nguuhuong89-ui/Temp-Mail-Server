import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetInboxQueryKey, getListAllEmailsQueryKey } from '@workspace/api-client-react';

export function useInboxStream(address: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!address) return;

    const url = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/inbox/${address}/stream`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'email_received') {
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey(address) });
          queryClient.invalidateQueries({ queryKey: getListAllEmailsQueryKey() });
        }
      } catch (err) {
        console.error('Error parsing SSE message', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [address, queryClient]);
}
