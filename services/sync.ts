// services/sync.ts — Semana 9: sincronización en dos sentidos entre SQLite y Supabase
// Diseño propio (TanStack Query solo lo ejecuta, lo reintenta y lo dispara):
// 1) SQLite es la fuente de verdad.  2) Identidad compartida: clientId (UUID del teléfono).
// 3) Pendiente: syncedAt vacío o anterior a updatedAt.  4) Cursor de bajada: server_updated_at.
// 5) Conflictos: gana el último cambio (updated_at, reloj del teléfono que editó).
// Cada ciclo: bajar → descargar archivos faltantes → subir. Nunca al revés.
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { BUCKET, signedUrls, type CloudPhoto } from '@/services/cloudPhotos';
import { deletePhotoFile, downloadPhotoFile } from '@/services/photoFiles';
import type { Photo } from '@/db/schema';

const PULL_PAGE = 200;

export interface SyncResult {
  pulled: number; // cambios de la nube aplicados en este teléfono
  pushed: number; // fotos (o borrados) subidos
  downloaded: number; // archivos descargados para fotos de otros teléfonos
  failed: number; // fotos que fallaron y quedan pendientes (C5)
  errors: string[];
  finishedAt: number;
}

export interface SyncError {
  message: string;
  at: number;
}

export const lastResultKey = (userId: string) => `lastResult:${userId}`;
export const lastErrorKey = (userId: string) => `lastError:${userId}`;
const cursorKey = (userId: string) => `lastPulledAt:${userId}`;

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Regla de conflicto (función pura): gana el último cambio. Con fechas iguales no gana nadie. */
export function remoteWins(localUpdatedAt: Date | null, remoteUpdatedAt: string): boolean {
  return new Date(remoteUpdatedAt).getTime() > (localUpdatedAt?.getTime() ?? 0);
}

/** Una foto está pendiente si nunca se subió o si cambió después de la última subida. */
export function isPending(photo: { syncedAt: Date | null; updatedAt: Date | null }): boolean {
  if (!photo.syncedAt) return true;
  return (photo.updatedAt?.getTime() ?? 0) > photo.syncedAt.getTime();
}

/** Bajar (T4): solo lo que llegó al servidor después del cursor, en páginas de 200. */
async function pull(userId: string): Promise<number> {
  let applied = 0;
  for (;;) {
    const since = (await syncMetaRepo.get(cursorKey(userId))) ?? '1970-01-01T00:00:00Z';
    const { data, error } = await supabase
      .from('photos')
      .select('*')
      .gt('server_updated_at', since)
      .order('server_updated_at', { ascending: true })
      .limit(PULL_PAGE);
    if (error) throw error;
    const rows = data as CloudPhoto[];

    for (const remote of rows) {
      const local = await photosRepo.findByClientId(userId, remote.client_id);
      const remoteUpdatedAt = new Date(remote.updated_at);

      if (!local) {
        // Foto creada en otro teléfono. Si ya viene borrada, no hay nada que crear.
        if (!remote.deleted_at) {
          // uri vacía: el archivo se descarga en downloadMissing(), que se reintenta cada ciclo
          await photosRepo.insertFromRemote(userId, {
            clientId: remote.client_id,
            uri: '',
            latitude: remote.latitude,
            longitude: remote.longitude,
            note: remote.note,
            favorite: remote.favorite,
            source: remote.source,
            createdAt: new Date(remote.taken_at),
            updatedAt: remoteUpdatedAt,
            remotePath: remote.storage_path,
            syncedAt: remoteUpdatedAt, // nace sincronizada
          });
          applied++;
        }
      } else if (remoteWins(local.updatedAt, remote.updated_at)) {
        if (remote.deleted_at) {
          // C1: el borrado es el último cambio. La marca ya está en la nube: se elimina aquí de verdad.
          await photosRepo.remove(local.id);
          deletePhotoFile(local.uri);
        } else {
          await photosRepo.applyRemote(local.id, {
            note: remote.note,
            favorite: remote.favorite,
            updatedAt: remoteUpdatedAt,
            syncedAt: remoteUpdatedAt,
          });
        }
        applied++;
      } else if (remote.deleted_at && !local.deletedAt) {
        // C1: la edición local es posterior al borrado remoto y gana, pero el archivo del bucket
        // ya se borró. Sin remotePath, push lo vuelve a subir.
        await photosRepo.clearRemotePath(local.id);
      }
      // Si la versión local es más nueva no se toca: push la subirá enseguida

      // El cursor avanza fila por fila: si algo falla, el siguiente intento continúa desde aquí
      await syncMetaRepo.set(cursorKey(userId), remote.server_updated_at);
    }

    if (rows.length < PULL_PAGE) return applied;
  }
}

/**
 * Pedido adicional: las fotos bajadas sin archivo se descargan a documents/photos para verse
 * sin conexión. Un fallo no rompe la sincronización: la foto sigue con uri vacía y se reintenta.
 */
async function downloadMissing(userId: string, errors: string[]): Promise<number> {
  const missing = await photosRepo.listMissingFiles(userId);
  if (missing.length === 0) return 0;

  let urls: Record<string, string>;
  try {
    urls = await signedUrls(missing.map((p) => p.remotePath!));
  } catch (e) {
    errors.push(`No se pudieron pedir las URL firmadas: ${messageOf(e)}`);
    return 0;
  }

  let downloaded = 0;
  for (const photo of missing) {
    const url = urls[photo.remotePath!];
    try {
      if (!url) throw new Error('el archivo no está en el bucket');
      const uri = await downloadPhotoFile(url, photo.clientId!);
      await photosRepo.setUri(photo.id, uri);
      downloaded++;
    } catch (e) {
      errors.push(`Descarga de ${photo.clientId?.slice(0, 8)}: ${messageOf(e)}`);
    }
  }
  return downloaded;
}

/** Metadatos de la fila remota (user_id lo pone la base con default auth.uid()). */
function toRow(photo: Photo, path: string) {
  return {
    client_id: photo.clientId!,
    storage_path: path,
    latitude: photo.latitude,
    longitude: photo.longitude,
    note: photo.note,
    favorite: photo.favorite,
    source: photo.source,
    taken_at: photo.createdAt.toISOString(),
    updated_at: (photo.updatedAt ?? photo.createdAt).toISOString(),
    deleted_at: photo.deletedAt?.toISOString() ?? null,
  };
}

/** Sube una foto (o su marca de borrado). Idempotente: repetirla no duplica filas ni archivos. */
async function pushOne(photo: Photo, userId: string): Promise<void> {
  const updatedAt = photo.updatedAt ?? photo.createdAt;

  // C1: marca de borrado
  if (photo.deletedAt) {
    if (photo.remotePath) {
      // 1. La marca llega a la nube (los demás teléfonos la bajarán)
      const { error } = await supabase.from('photos').upsert(toRow(photo, photo.remotePath), { onConflict: 'client_id' });
      if (error) throw error;
      // 2. Con la marca ya sincronizada, se borra el archivo del bucket (borrar dos veces no falla)
      const { error: fileError } = await supabase.storage.from(BUCKET).remove([photo.remotePath]);
      if (fileError) throw fileError;
    }
    // 3. Y por último la fila y el archivo locales
    await photosRepo.remove(photo.id);
    deletePhotoFile(photo.uri);
    return;
  }

  // La misma foto siempre va a la misma ruta: <userId>/<clientId>.jpg
  const path = photo.remotePath ?? `${userId}/${photo.clientId}.jpg`;
  let uploadedNow = false;

  // 1. El archivo solo se sube si aún no está en el bucket
  if (!photo.remotePath) {
    if (!photo.uri || !new File(photo.uri).exists) throw new Error('El archivo de la foto ya no existe en el teléfono');
    // ArrayBuffer: un Blob o FormData sube archivos de 0 bytes en React Native
    const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
    if (arrayBuffer.byteLength === 0) throw new Error('El archivo pesa 0 bytes');
    // upsert: true reemplaza un archivo de un intento anterior que no alcanzó a guardar la fila
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    uploadedNow = true;
  }

  // 2. upsert por client_id: crea la fila o la actualiza, nunca la duplica
  const { error } = await supabase.from('photos').upsert(toRow(photo, path), { onConflict: 'client_id' });
  if (error) {
    // C2 (Semana 8): no dejar archivos huérfanos en el bucket
    if (uploadedNow) await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }

  // 3. syncedAt = la versión que se subió, no "ahora"
  await photosRepo.markSynced(photo.id, path, updatedAt);
}

/** Subir (T5 + C5): todo lo pendiente. Si una foto falla, las demás continúan y ella queda pendiente. */
async function push(userId: string, errors: string[]): Promise<{ pushed: number; failed: number }> {
  const pending = await photosRepo.listPending(userId);
  let pushed = 0;
  let failed = 0;
  for (const photo of pending) {
    if (!photo.clientId) continue; // ensureSyncFields() lo rellena al iniciar sesión
    try {
      await pushOne(photo, userId);
      pushed++;
    } catch (e) {
      failed++;
      errors.push(`Foto ${photo.clientId.slice(0, 8)}: ${messageOf(e)}`);
    }
  }
  return { pushed, failed };
}

async function runSync(userId: string): Promise<SyncResult> {
  const errors: string[] = [];
  let pulled = 0;
  let pushed = 0;
  let downloaded = 0;
  let failed = 0;
  try {
    // Si hubo ediciones durante el ciclo, se repite (máximo 3 vueltas) para no dejarlas esperando
    for (let round = 0; round < 3; round++) {
      pulled += await pull(userId); // primero bajar...
      downloaded += await downloadMissing(userId, errors);
      const r = await push(userId, errors); // ...después subir
      pushed += r.pushed;
      failed = r.failed;
      const stillPending = (await photosRepo.listPending(userId)).length;
      if (r.pushed === 0 || stillPending <= r.failed) break;
    }
  } catch (e) {
    // Falló la bajada (por ejemplo, sin red): se guarda para la pantalla de estado y TanStack Query reintenta
    await syncMetaRepo.set(lastErrorKey(userId), JSON.stringify({ message: messageOf(e), at: Date.now() } satisfies SyncError));
    throw e;
  }

  const result: SyncResult = { pulled, pushed, downloaded, failed, errors, finishedAt: Date.now() };
  // C4: el último resultado sobrevive al cierre de la app
  await syncMetaRepo.set(lastResultKey(userId), JSON.stringify(result));
  if (errors.length > 0) {
    await syncMetaRepo.set(lastErrorKey(userId), JSON.stringify({ message: errors[0], at: result.finishedAt } satisfies SyncError));
  } else {
    await syncMetaRepo.remove(lastErrorKey(userId)); // ciclo limpio: ya no hay error que mostrar
  }
  return result;
}

// Un solo ciclo a la vez por usuario: si llega otra petición mientras hay uno en curso, se reutiliza
const running = new Map<string, Promise<SyncResult>>();

/** Un ciclo completo de sincronización. Seguro de llamar varias veces seguidas. */
export function syncAll(userId: string): Promise<SyncResult> {
  let current = running.get(userId);
  if (!current) {
    current = runSync(userId).finally(() => running.delete(userId));
    running.set(userId, current);
  }
  return current;
}
