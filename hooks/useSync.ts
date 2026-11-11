// hooks/useSync.ts — Semana 9 (T6): la sincronización tratada como una consulta de TanStack Query.
// Se dispara al iniciar sesión (o abrir la app), al recuperar la red y al volver a primer plano, y se reintenta si falla.
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { queryClient, useIsOnline } from '@/lib/queryClient';
import { lastErrorKey, lastResultKey, syncAll, type SyncError, type SyncResult } from '@/services/sync';
import { useUserId } from '@/hooks/useUserId';

export { isPending } from '@/services/sync';

/** Pide un ciclo de sincronización. Sin red queda en pausa y TanStack Query lo reanuda al reconectar. */
export function requestSync() {
  void queryClient.invalidateQueries({ queryKey: ['sync'] });
}

function parse<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function useSync() {
  const userId = useUserId();
  const isOnline = useIsOnline();
  // deps [userId]: al cambiar de cuenta se cuentan las pendientes del nuevo usuario (C5 de la Semana 8)
  const { data: pending } = useLiveQuery(photosRepo.pendingQuery(userId), [userId]);
  // C4: último resultado y último error guardados en sync_meta (sobreviven al cierre)
  const { data: resultRow } = useLiveQuery(syncMetaRepo.byKeyQuery(lastResultKey(userId)), [userId]);
  const { data: errorRow } = useLiveQuery(syncMetaRepo.byKeyQuery(lastErrorKey(userId)), [userId]);

  const sync = useQuery({
    queryKey: ['sync', userId],
    queryFn: () => syncAll(userId),
    staleTime: 0,
    gcTime: 0, // nunca se persiste ni se reutiliza: siempre se vuelve a ejecutar
    retry: 2,
    refetchOnMount: false, // varias pantallas usan este hook: montar otra no dispara un ciclo nuevo
    refetchOnReconnect: 'always', // volvió la red
    refetchOnWindowFocus: 'always', // la app volvió a primer plano
  });

  return {
    isOnline,
    pendingCount: pending.length,
    isSyncing: sync.fetchStatus === 'fetching',
    lastResult: parse<SyncResult>(resultRow[0]?.value),
    lastError: parse<SyncError>(errorRow[0]?.value),
    error: sync.error,
    syncNow: () => sync.refetch(),
  };
}
