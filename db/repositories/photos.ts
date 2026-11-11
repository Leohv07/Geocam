// db/repositories/photos.ts — única capa que conoce Drizzle
// Semana 8: todas las consultas se filtran por ownerId (C5) y las ediciones escriben updatedAt (T4).
// Semana 9: las fotos borradas (deletedAt) no se muestran, pero siguen pendientes hasta subir la marca (C1).
import { and, asc, desc, eq, isNotNull, isNull, like, lt, or, type SQL } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { albums, photos, type NewPhoto } from '@/db/schema';

export type PhotoInput = Omit<
  NewPhoto,
  'id' | 'clientId' | 'updatedAt' | 'remotePath' | 'syncedAt' | 'ownerId' | 'deletedAt'
>;
export type PhotoChanges = Partial<Pick<NewPhoto, 'note' | 'favorite' | 'albumId'>>;

/** Cambios que llegan de la nube. Nunca usan la hora actual: llevan la versión remota. */
export interface RemoteChanges {
  note: string | null;
  favorite: boolean;
  updatedAt: Date;
  syncedAt: Date;
}

export interface PhotoFilters {
  search: string;
  albumId: number | null;
  onlyFavorites: boolean;
}

/** Pendiente de subir: nunca se sincronizó o se editó (o borró) después de la última sincronización. */
const isPending = or(isNull(photos.syncedAt), lt(photos.syncedAt, photos.updatedAt));
/** C1: la UI nunca muestra las fotos marcadas como borradas. */
const isVisible = isNull(photos.deletedAt);

export const photosRepo = {
  /** Todas las fotos del usuario, la más reciente primero. Devuelve la consulta sin ejecutar (para useLiveQuery). */
  listQuery(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isVisible))
      .orderBy(desc(photos.createdAt));
  },

  /** Solo fotos con ubicación (latitud no nula). */
  withLocationQuery(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isVisible, isNotNull(photos.latitude)))
      .orderBy(desc(photos.createdAt));
  },

  /** Fotos pendientes de subir, incluidas las marcas de borrado que aún no llegan a la nube. */
  pendingQuery(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isPending))
      .orderBy(asc(photos.createdAt));
  },

  /** Búsqueda por nota (LIKE) + filtros por álbum y favoritas, con el nombre del álbum (LEFT JOIN). */
  filteredQuery(ownerId: string, { search, albumId, onlyFavorites }: PhotoFilters) {
    const conditions: SQL[] = [eq(photos.ownerId, ownerId), isVisible];
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
      .where(and(eq(photos.id, id), eq(photos.ownerId, ownerId), isVisible));
  },

  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },

  listAll(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isVisible))
      .all();
  },

  listPending(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isPending))
      .orderBy(asc(photos.createdAt))
      .all();
  },

  /** Fotos bajadas de la nube cuyo archivo aún no se pudo descargar (uri vacía). */
  listMissingFiles(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isVisible, eq(photos.uri, ''), isNotNull(photos.remotePath)))
      .all();
  },

  findByClientId(ownerId: string, clientId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), eq(photos.clientId, clientId)))
      .get();
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

  /** C1: borrar es marcar. updatedAt = ahora, así la marca queda pendiente y gana a ediciones anteriores. */
  markDeleted(id: number) {
    const now = new Date();
    return db.update(photos).set({ deletedAt: now, updatedAt: now }).where(eq(photos.id, id));
  },

  /** T3: foto creada en otro teléfono. Nace sincronizada y con el dueño de la sesión (C5 de la Semana 8). */
  insertFromRemote(ownerId: string, data: Omit<NewPhoto, 'id' | 'ownerId'>) {
    return db.insert(photos).values({ ...data, ownerId });
  },

  /**
   * T3: aplica en local una versión más nueva (y no borrada) de la nube.
   * deletedAt vuelve a null: si aquí estaba borrada, la edición remota es posterior y gana.
   */
  applyRemote(id: number, changes: RemoteChanges) {
    return db
      .update(photos)
      .set({ ...changes, deletedAt: null })
      .where(eq(photos.id, id));
  },

  /** Guarda la ruta local del archivo descargado (no cambia updatedAt: no es una edición del usuario). */
  setUri(id: number, uri: string) {
    return db.update(photos).set({ uri }).where(eq(photos.id, id));
  },

  /**
   * Marca la foto como subida. syncedAt es la versión (updatedAt) que se subió, NO "ahora":
   * si el usuario la editó mientras subía, su updatedAt es posterior y sigue pendiente.
   */
  markSynced(id: number, remotePath: string, syncedAt: Date) {
    return db.update(photos).set({ remotePath, syncedAt }).where(eq(photos.id, id));
  },

  /**
   * C1: la versión local ganó a un borrado remoto, pero el archivo del bucket ya se borró.
   * Sin remotePath, push vuelve a subir el archivo.
   */
  clearRemotePath(id: number) {
    return db.update(photos).set({ remotePath: null }).where(eq(photos.id, id));
  },

  /** Elimina la fila de verdad. Solo después de que la marca de borrado está sincronizada. */
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
