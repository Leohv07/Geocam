// app/(tabs)/nube.tsx — C4: fotos del usuario guardadas en Supabase (URL firmadas + tiempo real)
import { View, Text, FlatList, Image, ActivityIndicator } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCloudPhotos } from '@/hooks/useCloudPhotos';
import { useAuth } from '@/context/AuthContext';

export default function NubeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { session } = useAuth();
  // El canal de tiempo real solo está abierto mientras la pestaña está visible
  const { photos, isLoading, error, reload } = useCloudPhotos(isFocused);

  return (
    <View className="flex-1 bg-neutral-950" style={{ paddingTop: insets.top + 8 }}>
      <View className="gap-1 px-4 pb-3">
        <Text className="text-2xl font-bold text-white">☁️ Nube</Text>
        <Text className="text-xs text-neutral-400" numberOfLines={1}>
          {photos.length} foto(s) de {session?.user.email} en Supabase
        </Text>
        {error && <Text className="text-sm text-red-400">{error}</Text>}
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-10" color="#34d399" />
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.client_id}
          numColumns={2}
          refreshing={isLoading}
          onRefresh={reload}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          ListEmptyComponent={
            <Text className="mt-10 text-center text-neutral-500">
              Aún no hay fotos en la nube. Súbelas desde la pestaña Fotos.
            </Text>
          }
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