// services/cloudPhotos.ts — única capa que conoce Supabase para las fotos (lectura y archivos)
// La subida y la bajada viven en services/sync.ts.
import { supabase } from '@/lib/supabase';

export const BUCKET = 'geocam';

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
  updated_at: string; // reloj del teléfono: decide conflictos
  server_updated_at: string; // reloj del servidor: cursor de bajada (Semana 9)
  deleted_at: string | null; // borrado lógico (Semana 9, C1)
  created_at: string;
}

export type CloudPhotoWithUrl = CloudPhoto & { url: string | null };

const PAGE_SIZE = 10;

export interface CloudPhotosPage {
  items: CloudPhotoWithUrl[];
  nextCursor: string | null;
}

/**
 * C2: una página de la pestaña Nube, con paginación por cursor ("las 10 anteriores a la última
 * que ya tengo") y búsqueda por nota. RLS solo devuelve las filas del usuario de la sesión.
 */
export async function listCloudPhotosPage(params: { cursor: string | null; search: string }): Promise<CloudPhotosPage> {
  let query = supabase
    .from('photos')
    .select('*')
    .is('deleted_at', null)
    .order('taken_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (params.cursor) query = query.lt('taken_at', params.cursor);

  const term = params.search.trim();
  if (term) query = query.ilike('note', `%${term}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = data as CloudPhoto[];
  const urls = await signedUrls(rows.map((r) => r.storage_path));
  return {
    items: rows.map((r) => ({ ...r, url: urls[r.storage_path] ?? null })),
    nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].taken_at : null,
  };
}

/** URL temporal (1 hora) para ver o descargar un archivo de un bucket privado. */
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

/** Suscripción de tiempo real a las filas del usuario. Devuelve la función que la cancela. */
export function subscribeToCloudPhotos(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`nube-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${userId}` }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
