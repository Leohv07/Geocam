// hooks/usePhoto.ts — C3: una foto (reactiva) y sus acciones de edición
import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { deletePhotoFile } from '@/services/photoFiles';

export function usePhoto(id: number) {
  // deps [id]: la consulta se recalcula si cambia el id de la ruta
  const { data, error } = useLiveQuery(photosRepo.findByIdQuery(id), [id]);
  const row = data[0];

  // Las consultas de Drizzle son "perezosas": solo se ejecutan al hacer await (o .run()).
  // Por eso cada acción es async y hace await; si la pantalla las llama con `void` igual se ejecutan.
  const saveNote = useCallback(
    async (note: string) => {
      await photosRepo.update(id, { note: note.trim() || null });
    },
    [id]
  );
  const setFavorite = useCallback(
    async (favorite: boolean) => {
      await photosRepo.update(id, { favorite });
    },
    [id]
  );
  const moveToAlbum = useCallback(
    async (albumId: number | null) => {
      await photosRepo.update(id, { albumId });
    },
    [id]
  );

  const remove = useCallback(async () => {
    const uri = row?.photo.uri;
    await photosRepo.remove(id);
    if (uri) deletePhotoFile(uri);
  }, [id, row?.photo.uri]);

  return {
    photo: row?.photo ?? null,
    albumName: row?.albumName ?? null,
    error,
    saveNote,
    setFavorite,
    moveToAlbum,
    remove,
  };
}