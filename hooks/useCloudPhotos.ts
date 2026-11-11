// hooks/useCloudPhotos.ts — Semana 9 (C2): feed de la nube con useInfiniteQuery (antes era estado manual)
import { useEffect, useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { listCloudPhotosPage, subscribeToCloudPhotos } from '@/services/cloudPhotos';
import { PERSISTED_GC_TIME } from '@/lib/queryClient';
import { useUserId } from '@/hooks/useUserId';

export type { CloudPhotoWithUrl } from '@/services/cloudPhotos';

export function useCloudPhotos(search: string) {
  const userId = useUserId();
  const query = useInfiniteQuery({
    // userId en la llave: la caché persistida (C3) nunca mezcla cuentas
    queryKey: ['cloud', userId, { search }],
    queryFn: ({ pageParam }) => listCloudPhotosPage({ cursor: pageParam, search }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData, // al escribir, se conserva la lista anterior en vez de parpadear
    gcTime: PERSISTED_GC_TIME, // C3: debe durar tanto como la caché guardada
  });

  // Las páginas se aplanan en una sola lista para FlatList
  const photos = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  return { ...query, photos };
}

/** Tiempo real: ya no recarga a mano, solo le avisa a la caché que quedó desactualizada. */
export function useCloudPhotosRealtime(enabled: boolean) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    // Misma regla de la Semana 6: toda suscripción se limpia
    return subscribeToCloudPhotos(userId, () => {
      void queryClient.invalidateQueries({ queryKey: ['cloud', userId] });
    });
  }, [enabled, userId, queryClient]);
}
