// hooks/usePhoto.ts — una foto (reactiva), sus acciones de edición y la subida a la nube
import { useCallback, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { deletePhotoFile } from '@/services/photoFiles';
import { deleteRemotePhoto, uploadPhoto } from '@/services/cloudPhotos';
import { useUserId } from '@/hooks/useUserId';

export function usePhoto(id: number) {
  const userId = useUserId();
  // deps: la consulta se recalcula si cambia el id de la ruta o el usuario
  const { data, error } = useLiveQuery(photosRepo.findByIdQuery(id, userId), [id, userId]);
  const row = data[0];
  const photo = row?.photo ?? null;
  const [isUploading, setIsUploading] = useState(false);

  // Las consultas de Drizzle son "perezosas": solo se ejecutan al hacer await (o .run()).
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

  /** T5: sube esta foto a Supabase. Devuelve el mensaje de error, o null si salió bien. */
  const upload = useCallback(async (): Promise<string | null> => {
    if (!photo) return 'La foto no existe';
    setIsUploading(true);
    try {
      await uploadPhoto(photo, userId);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'No se pudo subir la foto';
    } finally {
      setIsUploading(false);
    }
  }, [photo, userId]);

  /** C3: borra de la nube y después del teléfono. Si la nube falla, lanza el error y no borra nada. */
  const remove = useCallback(async () => {
    if (!photo) return;
    await deleteRemotePhoto(photo);
    await photosRepo.remove(id);
    deletePhotoFile(photo.uri);
  }, [id, photo]);

  const isSynced = !!photo?.syncedAt;
  const isPending = !!photo && (!photo.syncedAt || (!!photo.updatedAt && photo.syncedAt < photo.updatedAt));

  return {
    photo,
    albumName: row?.albumName ?? null,
    error,
    isSynced,
    isPending,
    isUploading,
    saveNote,
    setFavorite,
    moveToAlbum,
    upload,
    remove,
  };
}