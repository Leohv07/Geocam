// db/repositories/photos.ts — única capa que conoce Drizzle
import { and, desc, eq, isNotNull, like, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';

export type PhotoInput = Omit<NewPhoto, 'id'>;
export type PhotoChanges = Partial<Pick<NewPhoto, 'note' | 'favorite' | 'albumId'>>;

export interface PhotoFilters {
  search: string;
  albumId: number | null;
  onlyFavorites: boolean;
}

export const photosRepo = {
  /** Todas las fotos, la más reciente primero. Devuelve la consulta sin ejecutar (para useLiveQuery). */
  listQuery() {
    return db.select().from(photos).orderBy(desc(photos.createdAt));
  },

  /** Solo fotos con ubicación (latitud no nula). */
  withLocationQuery() {
    return db
      .select()
      .from(photos)
      .where(isNotNull(photos.latitude))
      .orderBy(desc(photos.createdAt));
  },

  /** C4: búsqueda por nota (LIKE) + filtros por álbum y favoritas, con el nombre del álbum (LEFT JOIN). */
  filteredQuery({ search, albumId, onlyFavorites }: PhotoFilters) {
    const conditions: SQL[] = [];
    const term = search.trim();
    if (term) conditions.push(like(photos.note, `%${term}%`));
    if (albumId !== null) conditions.push(eq(photos.albumId, albumId));
    if (onlyFavorites) conditions.push(eq(photos.favorite, true));

    return db
      .select({
        id: photos.id,
        uri: photos.uri,
        source: photos.source,
        note: photos.note,
        favorite: photos.favorite,
        createdAt: photos.createdAt,
        albumName: albums.name,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt));
  },

  /** C3: una foto con el nombre de su álbum. */
  findByIdQuery(id: number) {
    return db
      .select({ photo: photos, albumName: albums.name })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(eq(photos.id, id));
  },

  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },

  listAll() {
    return db.select().from(photos).all();
  },

  create(data: PhotoInput) {
    return db.insert(photos).values(data);
  },

  update(id: number, changes: PhotoChanges) {
    return db.update(photos).set(changes).where(eq(photos.id, id));
  },

  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },

  clearAll() {
    return db.delete(photos);
  },
};