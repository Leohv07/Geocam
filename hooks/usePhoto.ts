// hooks/usePhoto.ts — una foto (reactiva) y sus acciones de edición
// Semana 9: ya no hay subida manual; cada cambio pide una sincronización.
import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { isPending as photoIsPending, requestSync } from '@/hooks/useSync';
import { useUserId } from '@/hooks/useUserId';

export function usePhoto(id: number) {
  const userId = useUserId();
  // deps: la consulta se recalcula si cambia el id de la ruta o el usuario
  const { data, error } = useLiveQuery(photosRepo.findByIdQuery(id, userId), [id, userId]);
  const row = data[0];
  const photo = row?.photo ?? null;

  // Las consultas de Drizzle son "perezosas": solo se ejecutan al hacer await (o .run()).
  const saveNote = useCallback(
    async (note: string) => {
      await photosRepo.update(id, { note: note.trim() || null });
      requestSync();
    },
    [id]
  );
  const setFavorite = useCallback(
    async (favorite: boolean) => {
      await photosRepo.update(id, { favorite });
      requestSync();
    },
    [id]
  );
  const moveToAlbum = useCallback(
    async (albumId: number | null) => {
      await photosRepo.update(id, { albumId });
      requestSync();
    },
    [id]
  );

  /** C1: borrado lógico; funciona sin conexión. */
  const remove = useCallback(async () => {
    await photosRepo.markDeleted(id);
    requestSync();
  }, [id]);

  return {
    photo,
    albumName: row?.albumName ?? null,
    error,
    isSynced: !!photo?.remotePath,
    isPending: !!photo && photoIsPending(photo),
    saveNote,
    setFavorite,
    moveToAlbum,
    remove,
  };
}
