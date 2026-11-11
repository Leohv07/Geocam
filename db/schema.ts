// db/schema.ts
import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

// C1: álbumes
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uri: text('uri').notNull(),
  // Coordenadas opcionales: la foto puede no tener ubicación.
  // real es correcto aquí: las coordenadas sí son decimales (a diferencia del dinero).
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  source: text('source', { enum: ['camera', 'gallery'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  // C1: llave foránea opcional; al borrar el álbum, la foto queda sin álbum (no se borra)
  albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),
  // C2: nota opcional y favorita con valor por defecto false
  note: text('note'),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  // Semana 8 (T4): identidad compartida con la nube. El id autoincremental solo vale en este teléfono.
  // El UUID se genera en photosRepo.create(): importar expo-crypto aquí rompe drizzle-kit (corre en Node).
  clientId: text('client_id').unique(),
  // Última modificación hecha por el usuario
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  // Ruta del archivo en el bucket y momento de la última sincronización
  remotePath: text('remote_path'),
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  // Semana 8 (C5): id del usuario de Supabase dueño de la foto en este teléfono
  ownerId: text('owner_id'),
  // Semana 9 (C1): borrado lógico. Una foto borrada se marca, se sincroniza y solo después se elimina.
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
});

// Semana 9 (T3): pares clave-valor de la sincronización (cursor de bajada, último resultado)
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Album = typeof albums.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;