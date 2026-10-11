// hooks/usePhotoSearch.ts — C4: búsqueda y filtros reactivos
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo, type PhotoFilters } from '@/db/repositories/photos';

export function usePhotoSearch({ search, albumId, onlyFavorites }: PhotoFilters) {
  // Las dependencias hacen que useLiveQuery vuelva a ejecutar la consulta al cambiar un filtro
  const { data, error } = useLiveQuery(
    photosRepo.filteredQuery({ search, albumId, onlyFavorites }),
    [search, albumId, onlyFavorites]
  );
  return { results: data, error };
}