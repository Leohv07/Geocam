// app/sincronizacion.tsx — Semana 9 (C4): estado de la sincronización
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { useSync } from '@/hooks/useSync';

const formatDate = (ms: number) => new Date(ms).toLocaleString('es-CO');

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View className="flex-row justify-between border-b border-neutral-800 py-2">
      <Text className="text-neutral-400">{label}</Text>
      <Text className="font-semibold text-white">{value}</Text>
    </View>
  );
}

export default function SincronizacionScreen() {
  const { isOnline, isSyncing, pendingCount, lastResult, lastError, syncNow } = useSync();

  return (
    <ScrollView className="flex-1 bg-neutral-950" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Sincronización',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#fff',
        }}
      />

      <View className="rounded-2xl bg-neutral-900 p-4">
        <Row label="Conexión" value={isOnline ? 'En línea' : 'Sin conexión'} />
        <Row label="Fotos pendientes" value={pendingCount} />
        <Row label="Estado" value={isSyncing ? 'Sincronizando…' : pendingCount > 0 ? 'Con pendientes' : 'Al día'} />
      </View>

      <View className="gap-1 rounded-2xl bg-neutral-900 p-4">
        <Text className="mb-1 font-semibold text-white">Última sincronización</Text>
        {lastResult ? (
          <>
            <Row label="Fecha" value={formatDate(lastResult.finishedAt)} />
            <Row label="Subidas" value={lastResult.pushed} />
            <Row label="Bajadas (cambios aplicados)" value={lastResult.pulled} />
            <Row label="Imágenes descargadas" value={lastResult.downloaded} />
            <Row label="Fallidas (se reintentan)" value={lastResult.failed} />
          </>
        ) : (
          <Text className="text-neutral-500">Todavía no se ha completado ninguna sincronización.</Text>
        )}
      </View>

      <View className="gap-1 rounded-2xl bg-neutral-900 p-4">
        <Text className="mb-1 font-semibold text-white">Último error</Text>
        {lastError ? (
          <>
            <Text className="text-red-400">{lastError.message}</Text>
            <Text className="text-xs text-neutral-500">{formatDate(lastError.at)}</Text>
          </>
        ) : (
          <Text className="text-neutral-500">Sin errores en el último ciclo.</Text>
        )}
      </View>

      <Pressable
        onPress={() => void syncNow()}
        disabled={isSyncing || !isOnline}
        className={`flex-row items-center justify-center gap-2 rounded-xl p-3 ${isSyncing || !isOnline ? 'bg-neutral-800' : 'bg-sky-500'}`}
      >
        {isSyncing && <ActivityIndicator color="#fff" />}
        <Text className={isSyncing || !isOnline ? 'text-neutral-400' : 'font-semibold text-neutral-950'}>
          {!isOnline ? 'Sin conexión: se sincroniza al volver la red' : isSyncing ? 'Sincronizando…' : '🔄 Sincronizar ahora'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
