// hooks/useCloudPhotos.ts — C4: fotos guardadas en Supabase, con URL firmadas y tiempo real
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { listCloudPhotos, signedUrls, type CloudPhoto } from '@/services/cloudPhotos';
import { useUserId } from '@/hooks/useUserId';

export type CloudPhotoWithUrl = CloudPhoto & { url: string | null };

export function useCloudPhotos(enabled = true) {
  const userId = useUserId();
  const [photos, setPhotos] = useState<CloudPhotoWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await listCloudPhotos();
      const urls = await signedUrls(rows.map((r) => r.storage_path));
      setPhotos(rows.map((r) => ({ ...r, url: urls[r.storage_path] ?? null })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar la nube');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void reload();
    // Tiempo real: ante cualquier cambio en mis filas, se vuelve a consultar
    const channel = supabase
      .channel(`nube-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${userId}` },
        () => void reload()
      )
      .subscribe();
    // Misma regla de la Semana 6: toda suscripción se limpia
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId, reload]);

  return { photos, isLoading, error, reload };
}