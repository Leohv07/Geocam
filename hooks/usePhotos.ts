// hooks/usePhotos.ts — une las consultas reactivas con las acciones del repositorio
import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { deletePhotoFile, persistPhoto } from '@/services/photoFiles';
import { deleteRemotePhoto } from '@/services/cloudPhotos';
import { useUserId } from '@/hooks/useUserId';
import type { Coords, PhotoSource } from '@/types/geo';

export type { Photo } from '@/db/schema';

export interface AddPhotoInput {
  uri: string;
  coords: Coords | null;
  source: PhotoSource;
}

export function usePhotos() {
  const userId = useUserId();
  // C5: solo las fotos del usuario de la sesión. deps [userId]: se recalcula al cambiar de cuenta
  const { data: photos, error } = useLiveQuery(photosRepo.listQuery(userId), [userId]);
  const { data: photosWithLocation } = useLiveQuery(photosRepo.withLocationQuery(userId), [userId]);

  const addPhoto = useCallback(
    async ({ uri, coords, source }: AddPhotoInput) => {
      // Semana 7 (C5): primero se copia el archivo a documentos y se guarda la ruta permanente
      const permanentUri = await persistPhoto(uri);
      await photosRepo.create(userId, {
        uri: permanentUri,
        source,
        // Coords | null → columnas planas
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        accuracy: coords?.accuracy ?? null,
      });
    },
    [userId]
  );

  /**
   * Semana 8 (C3): si la foto está en la nube, primero se borra allá.
   * Si eso falla (sin conexión), se lanza el error y NO se borra nada local.
   */
  const removePhoto = useCallback(async (id: number) => {
    const photo = await photosRepo.findById(id);
    if (!photo) return;
    await deleteRemotePhoto(photo);
    await photosRepo.remove(id);
    deletePhotoFile(photo.uri);
  }, []);

  /** Borra todas las fotos del usuario. Las que no se pudieron borrar de la nube se conservan. */
  const clearAll = useCallback(async (): Promise<number> => {
    const all = await photosRepo.listAll(userId);
    let kept = 0;
    for (const photo of all) {
      try {
        await deleteRemotePhoto(photo);
        await photosRepo.remove(photo.id);
        deletePhotoFile(photo.uri);
      } catch {
        kept++;
      }
    }
    return kept;
  }, [userId]);

  return { photos, photosWithLocation, error, addPhoto, removePhoto, clearAll };
}