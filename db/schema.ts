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
});

export type Album = typeof albums.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;