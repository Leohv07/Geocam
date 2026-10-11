// hooks/usePhotos.ts — une las consultas reactivas con las acciones del repositorio
import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import type { Coords, PhotoSource } from '@/types/geo';

export type { Photo } from '@/db/schema';

export interface AddPhotoInput {
  uri: string;
  coords: Coords | null;
  source: PhotoSource;
}

export function usePhotos() {
  const { data: photos, error } = useLiveQuery(photosRepo.listQuery());
  const { data: photosWithLocation } = useLiveQuery(photosRepo.withLocationQuery());

  // Convierte el objeto Coords | null en columnas planas
  const addPhoto = useCallback(async ({ uri, coords, source }: AddPhotoInput) => {
    await photosRepo.create({
      uri,
      source,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      accuracy: coords?.accuracy ?? null,
    });
  }, []);

  const removePhoto = useCallback(async (id: number) => {
    await photosRepo.remove(id);
  }, []);

  const clearAll = useCallback(async () => {
    await photosRepo.clearAll();
  }, []);

  return { photos, photosWithLocation, error, addPhoto, removePhoto, clearAll };
}