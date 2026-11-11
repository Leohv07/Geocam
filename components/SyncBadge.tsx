// components/SyncBadge.tsx — Semana 9 (T6): estado de la sincronización. Al tocarlo abre la pantalla de estado (C4).
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import { useSync } from '@/hooks/useSync';

export function SyncBadge() {
  const { isOnline, isSyncing, pendingCount, error } = useSync();
  const plural = pendingCount === 1 ? '' : 's';

  let label = '✅ Al día';
  let color = 'text-emerald-400';
  if (!isOnline) {
    label = pendingCount > 0 ? `📴 Sin conexión · ${pendingCount} pendiente${plural}` : '📴 Sin conexión';
    color = 'text-amber-300';
  } else if (isSyncing) {
    label = '🔄 Sincronizando…';
    color = 'text-sky-400';
  } else if (error) {
    label = '⚠️ Error al sincronizar';
    color = 'text-red-400';
  } else if (pendingCount > 0) {
    label = `⏳ ${pendingCount} pendiente${plural}`;
    color = 'text-amber-300';
  }

  return (
    <Pressable
      onPress={() => router.push('/sincronizacion')}
      className="self-start rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel={`Estado de sincronización: ${label}. Toca para ver el detalle.`}
    >
      <Text className={`text-xs font-medium ${color}`}>{label}</Text>
    </Pressable>
  );
}
