// app/(tabs)/nube.tsx — Semana 9 (C2): feed de la nube con useInfiniteQuery
// Paginación por cursor, infinite scroll, búsqueda en vivo por nota y los cuatro estados de UI.
import { useState } from 'react';
import { View, Text, TextInput, FlatList, Image, Pressable, ActivityIndicator } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCloudPhotos, useCloudPhotosRealtime } from '@/hooks/useCloudPhotos';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIsOnline } from '@/lib/queryClient';
import { useAuth } from '@/context/AuthContext';

export default function NubeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  const isOnline = useIsOnline();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const feed = useCloudPhotos(debouncedSearch);
  // El canal de tiempo real solo está abierto mientras la pestaña está visible
  useCloudPhotosRealtime(isFocused);

  return (
    <View className="flex-1 bg-neutral-950" style={{ paddingTop: insets.top + 8 }}>
      <View className="gap-2 px-4 pb-3">
        <Text className="text-2xl font-bold text-white">☁️ Nube</Text>
        <Text className="text-xs text-neutral-400" numberOfLines={1}>
          Fotos de {session?.user.email} en Supabase
        </Text>

        {/* Estado: sin conexión (con o sin datos guardados) */}
        {!isOnline && (
          <Text className="rounded-xl bg-amber-400/90 px-3 py-2 text-center text-sm font-medium text-neutral-950">
            Sin conexión. {feed.status === 'success' ? 'Se muestran los datos guardados.' : ''}
          </Text>
        )}

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar en la nube por nota…"
          placeholderTextColor="#737373"
          className="rounded-xl bg-neutral-900 px-4 py-3 text-white"
        />
      </View>

      {/* Estado: primera carga */}
      {feed.status === 'pending' && feed.fetchStatus === 'fetching' && (
        <ActivityIndicator className="mt-10" color="#34d399" />
      )}

      {/* Estado: sin datos y sin red (nunca se pudo cargar) */}
      {feed.status === 'pending' && feed.fetchStatus === 'paused' && (
        <Text className="mt-10 px-6 text-center text-neutral-500">Conéctate a internet para cargar la nube.</Text>
      )}

      {/* Estado: error, con opción de reintentar */}
      {feed.status === 'error' && (
        <View className="mt-10 items-center gap-3 px-6">
          <Text className="text-center text-red-400">{feed.error.message}</Text>
          <Pressable onPress={() => void feed.refetch()} className="rounded-xl bg-sky-500 px-4 py-2">
            <Text className="font-semibold text-neutral-950">Reintentar</Text>
          </Pressable>
        </View>
      )}

      {feed.status === 'success' && (
        <FlatList
          data={feed.photos}
          keyExtractor={(p) => p.client_id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          // Estado: vacío (distinto según haya búsqueda o no)
          ListEmptyComponent={
            <Text className="mt-10 text-center text-neutral-500">
              {debouncedSearch ? 'Ninguna foto de la nube coincide.' : 'Aún no hay fotos en la nube.'}
            </Text>
          }
          // Deslizar hacia abajo para refrescar
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => void feed.refetch()}
          // Infinite scroll
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          // SDK 58: ListFooterComponent ya no acepta null, se usa undefined
          ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator className="m-4" color="#34d399" /> : undefined}
          renderItem={({ item }) => (
            <View className="flex-1 overflow-hidden rounded-2xl bg-neutral-900">
              {item.url ? (
                <Image source={{ uri: item.url }} className="aspect-square w-full bg-neutral-800" />
              ) : (
                <View className="aspect-square w-full items-center justify-center bg-neutral-800">
                  <Text className="text-neutral-500">Sin imagen</Text>
                </View>
              )}
              <View className="gap-0.5 p-2">
                <Text className="text-white" numberOfLines={1}>
                  {item.favorite ? '★ ' : ''}
                  {item.note || 'Sin nota'}
                </Text>
                <Text className="text-xs text-neutral-400">
                  {new Date(item.taken_at).toLocaleDateString('es-CO')}
                  {item.latitude !== null ? ' · 📍' : ''}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}