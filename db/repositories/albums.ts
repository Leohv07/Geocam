// db/repositories/albums.ts
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos } from '@/db/schema';

export const albumsRepo = {
  listQuery() {
    return db.select().from(albums).orderBy(asc(albums.name));
  },

  create(name: string) {
    return db.insert(albums).values({ name: name.trim() });
  },

  /**
   * C1: al borrar un álbum sus fotos quedan sin álbum.
   * drizzle-kit generó `ALTER TABLE photos ADD album_id ... REFERENCES albums(id)` SIN `ON DELETE SET NULL`,
   * así que el SET NULL se aplica aquí, dentro de una transacción.
   */
  remove(id: number) {
    // El driver de expo-sqlite es síncrono: la transacción usa .run() sin async/await,
    // así las dos sentencias quedan dentro del mismo BEGIN/COMMIT.
    db.transaction((tx) => {
      tx.update(photos).set({ albumId: null }).where(eq(photos.albumId, id)).run();
      tx.delete(albums).where(eq(albums.id, id)).run();
    });
  },
};