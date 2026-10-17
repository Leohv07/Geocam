// db/repositories/photos.ts — única capa que conoce Drizzle
// Semana 8: todas las consultas se filtran por ownerId (C5) y las ediciones escriben updatedAt (T4).
import { and, desc, eq, isNotNull, isNull, like, lt, or, type SQL } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';

export type PhotoInput = Omit<NewPhoto, 'id' | 'clientId' | 'updatedAt' | 'remotePath' | 'syncedAt' | 'ownerId'>;
export type PhotoChanges = Partial<Pick<NewPhoto, 'note' | 'favorite' | 'albumId'>>;

export interface PhotoFilters {
  search: string;
  albumId: number | null;
  onlyFavorites: boolean;
}

/** Pendiente de subir: nunca se sincronizó o se editó después de la última sincronización. */
const isPending = or(isNull(photos.syncedAt), lt(photos.syncedAt, photos.updatedAt));

export const photosRepo = {
  /** Todas las fotos del usuario, la más reciente primero. Devuelve la consulta sin ejecutar (para useLiveQuery). */
  listQuery(ownerId: string) {
    return db.select().from(photos).where(eq(photos.ownerId, ownerId)).orderBy(desc(photos.createdAt));
  },

  /** Solo fotos con ubicación (latitud no nula). */
  withLocationQuery(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isNotNull(photos.latitude)))
      .orderBy(desc(photos.createdAt));
  },

  /** C1 (Semana 8): fotos pendientes de subir a la nube. */
  pendingQuery(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isPending))
      .orderBy(desc(photos.createdAt));
  },

  /** Búsqueda por nota (LIKE) + filtros por álbum y favoritas, con el nombre del álbum (LEFT JOIN). */
  filteredQuery(ownerId: string, { search, albumId, onlyFavorites }: PhotoFilters) {
    const conditions: SQL[] = [eq(photos.ownerId, ownerId)];
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
        updatedAt: photos.updatedAt,
        syncedAt: photos.syncedAt,
        albumName: albums.name,
      })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt));
  },

  /** Una foto del usuario con el nombre de su álbum. */
  findByIdQuery(id: number, ownerId: string) {
    return db
      .select({ photo: photos, albumName: albums.name })
      .from(photos)
      .leftJoin(albums, eq(photos.albumId, albums.id))
      .where(and(eq(photos.id, id), eq(photos.ownerId, ownerId)));
  },

  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },

  listAll(ownerId: string) {
    return db.select().from(photos).where(eq(photos.ownerId, ownerId)).all();
  },

  listPending(ownerId: string) {
    return db.select().from(photos).where(and(eq(photos.ownerId, ownerId), isPending)).all();
  },

  create(ownerId: string, data: PhotoInput) {
    const now = new Date();
    return db.insert(photos).values({ ...data, ownerId, clientId: Crypto.randomUUID(), updatedAt: now });
  },

  /** Regla desde la Semana 8: toda edición del usuario escribe updatedAt. */
  update(id: number, changes: PhotoChanges) {
    return db
      .update(photos)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(photos.id, id));
  },

  /** Marca la foto como subida. NO toca updatedAt, o volvería a quedar pendiente. */
  markSynced(id: number, remotePath: string) {
    return db.update(photos).set({ remotePath, syncedAt: new Date() }).where(eq(photos.id, id));
  },

  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },

  /**
   * T4 + C5: se ejecuta al iniciar sesión, después de las migraciones.
   * - Las fotos anteriores a la migración 0002 reciben clientId y updatedAt.
   * - Las fotos sin dueño (anteriores a la migración 0003) pasan al primer usuario que inicia sesión.
   */
  async ensureSyncFields(ownerId: string) {
    const rows = await db.select().from(photos).where(or(isNull(photos.clientId), isNull(photos.ownerId)));
    for (const row of rows) {
      await db
        .update(photos)
        .set({
          clientId: row.clientId ?? Crypto.randomUUID(),
          updatedAt: row.updatedAt ?? row.createdAt,
          ownerId: row.ownerId ?? ownerId,
        })
        .where(eq(photos.id, row.id));
    }
  },
};