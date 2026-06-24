import { useEffect } from 'react';
import { useOfflineStore } from '../store/offline.store';
import { useHymns } from './useHymns';
import { toast } from 'sonner';

export function useOfflineSync() {
  const { isSyncing, lastSynced, initDB, saveSongs } = useOfflineStore();
  const { data, refetch } = useHymns({ limit: 5000 }); // fetch all for offline

  useEffect(() => {
    initDB();
  }, [initDB]);

  const syncNow = async () => {
    try {
      const res = await refetch();
      if (res.data?.data) {
        await saveSongs(res.data.data as any);
        toast.success('Offline sync complete');
      }
    } catch (error) {
      toast.error('Failed to sync offline data');
    }
  };

  return {
    isSyncing,
    lastSynced,
    syncNow,
  };
}
