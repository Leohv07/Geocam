// services/cloudPhotos.ts — única capa que conoce Supabase para las fotos
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';

const BUCKET = 'geocam';

/** Fila de la tabla public.photos en Supabase. */
export interface CloudPhoto {
  id: number;
  user_id: string;
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  taken_at: string;
  updated_at: string;
  created_at: string;
}

/** Metadatos que se suben (user_id lo pone la base con default auth.uid()). */
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
  };
}

/**
 * T5 + C2: sube una foto sin crear duplicados ni archivos huérfanos.
 * - La ruta es <userId>/<clientId>.jpg: la misma foto siempre va a la misma ruta.
 * - Si la fila remota ya existe (foto ya subida y luego editada), solo se actualizan los metadatos.
 * - Si el archivo sube pero la fila falla, el archivo se borra del bucket antes de reportar el error.
 */
export async function uploadPhoto(photo: Photo, userId: string): Promise<void> {
  if (!photo.clientId) throw new Error('La foto no tiene clientId: ejecuta ensureSyncFields()');
  const path = `${userId}/${photo.clientId}.jpg`;

  // ¿Ya existe en la nube? (client_id es único)
  const { data: existing, error: findError } = await supabase
    .from('photos')
    .select('id')
    .eq('client_id', photo.clientId)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    // Re-sincronización: el archivo no cambia, solo la nota, la favorita, etc.
    const { error } = await supabase.from('photos').update(toRow(photo, path)).eq('client_id', photo.clientId);
    if (error) throw error;
    await photosRepo.markSynced(photo.id, path);
    return;
  }

  // 1. Archivo local -> ArrayBuffer (un Blob o FormData sube archivos de 0 bytes en React Native)
  const file = new File(photo.uri);
  if (!file.exists) throw new Error('El archivo de la foto ya no existe en el teléfono');
  const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
  if (arrayBuffer.byteLength === 0) throw new Error('El archivo pesa 0 bytes');

  // 2. Subir a la carpeta del usuario. upsert: true reemplaza un archivo huérfano de un intento anterior.
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  // 3. Fila remota con los metadatos
  const { error: insertError } = await supabase.from('photos').insert(toRow(photo, path));
  if (insertError) {
    // C2: no dejar archivos huérfanos en el bucket
    await supabase.storage.from(BUCKET).remove([path]);
    throw insertError;
  }

  // 4. Marcar la foto local como sincronizada (sin tocar updatedAt)
  await photosRepo.markSynced(photo.id, path);
}

/**
 * C3: borra la fila remota y su archivo. Si algo falla (por ejemplo, sin conexión) lanza el error
 * y quien llama NO debe borrar la foto local. Repetirlo es seguro: si la fila ya no existe, no pasa nada.
 */
export async function deleteRemotePhoto(photo: Photo): Promise<void> {
  if (!photo.remotePath || !photo.clientId) return;
  const { error: rowError } = await supabase.from('photos').delete().eq('client_id', photo.clientId);
  if (rowError) throw rowError;
  const { error: fileError } = await supabase.storage.from(BUCKET).remove([photo.remotePath]);
  if (fileError) throw fileError;
}

/** C4: fotos del usuario guardadas en Supabase (RLS solo devuelve las propias). */
export async function listCloudPhotos(): Promise<CloudPhoto[]> {
  const { data, error } = await supabase.from('photos').select('*').order('taken_at', { ascending: false });
  if (error) throw error;
  return data as CloudPhoto[];
}

/** URL temporal (1 hora) para ver un archivo de un bucket privado. */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Varias URL firmadas en una sola petición: { ruta: url }. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  return map;
}

export interface SyncResult {
  total: number;
  uploaded: number;
  failed: number;
  errors: string[];
}

/** C1: sube una por una las fotos pendientes. Si una falla, las demás continúan. */
export async function syncPending(
  userId: string,
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const pending = await photosRepo.listPending(userId);
  const result: SyncResult = { total: pending.length, uploaded: 0, failed: 0, errors: [] };
  for (let i = 0; i < pending.length; i++) {
    onProgress?.(i + 1, pending.length);
    try {
      await uploadPhoto(pending[i], userId);
      result.uploaded++;
    } catch (e) {
      result.failed++;
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return result;
}