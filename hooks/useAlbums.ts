// hooks/useAlbums.ts — C1
import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { albumsRepo } from '@/db/repositories/albums';

export type { Album } from '@/db/schema';

export function useAlbums() {
  const { data: albums } = useLiveQuery(albumsRepo.listQuery());

  const createAlbum = useCallback(async (name: string): Promise<string | null> => {
    const clean = name.trim();
    if (!clean) return 'Escribe un nombre para el álbum.';
    try {
      await albumsRepo.create(clean);
      return null;
    } catch {
      return `Ya existe un álbum llamado "${clean}".`; // name es UNIQUE
    }
  }, []);

  const removeAlbum = useCallback((id: number) => albumsRepo.remove(id), []);

  return { albums, createAlbum, removeAlbum };
}