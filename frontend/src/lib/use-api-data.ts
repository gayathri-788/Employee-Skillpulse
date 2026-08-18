'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { useToast } from './toast-context';

/** Fetches `endpoint` on mount and whenever it changes, tracking loading/data state. */
export function useApiData<T>(endpoint: string | null) {
  const { authedFetch } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      const result = await authedFetch<T>(endpoint);
      setData(result);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch identity should only change with endpoint, not on every authedFetch/showToast recreation
  }, [endpoint]);

  // Fetch-on-mount/endpoint-change: syncing React state with the server, the standard justified use of an effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    refetch();
  }, [refetch]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { data, setData, loading, refetch };
}
