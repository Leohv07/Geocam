// hooks/usePhotoSearch.ts — búsqueda y filtros reactivos (solo fotos del usuario de la sesión)
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo, type PhotoFilters } from '@/db/repositories/photos';
import { useUserId } from '@/hooks/useUserId';

export function usePhotoSearch({ search, albumId, onlyFavorites }: PhotoFilters) {
  const userId = useUserId();
  // Las dependencias hacen que useLiveQuery vuelva a ejecutar la consulta al cambiar un filtro o el usuario
  const { data, error } = useLiveQuery(
    photosRepo.filteredQuery(userId, { search, albumId, onlyFavorites }),
    [userId, search, albumId, onlyFavorites]
  );
  return { results: data, error };
}