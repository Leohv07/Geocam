// hooks/useSync.ts — C1: botón "Sincronizar" con avance y resumen final
import { useCallback, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { syncPending, type SyncResult } from '@/services/cloudPhotos';
import { useUserId } from '@/hooks/useUserId';

export function useSync() {
  const userId = useUserId();
  const { data: pending } = useLiveQuery(photosRepo.pendingQuery(userId), [userId]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const sync = useCallback(async (): Promise<SyncResult> => {
    setProgress({ done: 0, total: 0 });
    try {
      return await syncPending(userId, (done, total) => setProgress({ done, total }));
    } finally {
      setProgress(null);
    }
  }, [userId]);

  return { pendingCount: pending.length, isSyncing: progress !== null, progress, sync };
}
