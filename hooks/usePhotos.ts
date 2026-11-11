// hooks/usePhotos.ts — une las consultas reactivas con las acciones del repositorio
import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { persistPhoto } from '@/services/photoFiles';
import { requestSync } from '@/hooks/useSync';
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
      requestSync(); // Semana 9: la foto nueva queda pendiente y se pide subirla
    },
    [userId]
  );

  /**
   * Semana 9 (C1): borrar es marcar. Funciona sin conexión: la marca se sube en la próxima
   * sincronización y recién entonces se borran el archivo del bucket y el local.
   */
  const removePhoto = useCallback(async (id: number) => {
    await photosRepo.markDeleted(id);
    requestSync();
  }, []);

  /** Marca como borradas todas las fotos del usuario. */
  const clearAll = useCallback(async () => {
    const all = await photosRepo.listAll(userId);
    for (const photo of all) await photosRepo.markDeleted(photo.id);
    requestSync();
  }, [userId]);

  return { photos, photosWithLocation, error, addPhoto, removePhoto, clearAll };
}
