// db/repositories/syncMeta.ts — Semana 9: pares clave-valor de la sincronización
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { syncMeta } from '@/db/schema';

export const syncMetaRepo = {
  async get(key: string): Promise<string | null> {
    const row = await db.select().from(syncMeta).where(eq(syncMeta.key, key)).get();
    return row?.value ?? null;
  },

  /** Consulta reactiva (para useLiveQuery): la pantalla de estado se actualiza sola. */
  byKeyQuery(key: string) {
    return db.select().from(syncMeta).where(eq(syncMeta.key, key));
  },

  async set(key: string, value: string) {
    await db.insert(syncMeta).values({ key, value }).onConflictDoUpdate({ target: syncMeta.key, set: { value } });
  },

  async remove(key: string) {
    await db.delete(syncMeta).where(eq(syncMeta.key, key));
  },
};
