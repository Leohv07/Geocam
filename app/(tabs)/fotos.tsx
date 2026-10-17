// app/(tabs)/fotos.tsx — lista con búsqueda y filtros (Semana 7) + sincronizar con la nube (Semana 8, C1)
import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoSearch } from '@/hooks/usePhotoSearch';
import { useAlbums } from '@/hooks/useAlbums';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/hooks/useSync';

export default function FotosScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const { results } = usePhotoSearch({ search, albumId, onlyFavorites });
  const { albums, removeAlbum } = useAlbums();
  const { session, signOut } = useAuth();
  const { pendingCount, isSyncing, progress, sync } = useSync();

  // C1: sube una por una las pendientes; si una falla, las demás continúan
  const handleSync = async () => {
    const r = await sync();
    if (r.total === 0) return Alert.alert('Todo al día', 'No hay fotos pendientes de subir.');
    Alert.alert(
      r.failed === 0 ? 'Sincronización completa' : 'Sincronización con errores',
      `Subidas: ${r.uploaded} de ${r.total}.` +
        (r.failed > 0 ? `\nQuedaron pendientes: ${r.failed}.\n\n${r.errors[0]}` : '')
    );
  };

  // T2: al cerrar sesión, Stack.Protected lleva al login sin navegar a mano
  const confirmSignOut = () =>
    Alert.alert('Cerrar sesión', `¿Salir de ${session?.user.email ?? 'tu cuenta'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void signOut() },
    ]);

  // C1: al borrar un álbum, sus fotos quedan sin álbum (no se borran)
  const confirmRemoveAlbum = (id: number, name: string) =>
    Alert.alert('Eliminar álbum', `¿Eliminar "${name}"? Sus fotos no se borran, quedan sin álbum.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          if (albumId === id) setAlbumId(null);
          removeAlbum(id);
        },
      },
    ]);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 ${active ? 'border-emerald-400 bg-emerald-400' : 'border-neutral-700'}`;
  const chipText = (active: boolean) => (active ? 'font-semibold text-neutral-950' : 'text-neutral-300');

  return (
    <View className="flex-1 bg-neutral-950" style={{ paddingTop: insets.top + 8 }}>
      <View className="gap-3 px-4 pb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">Mis fotos</Text>
            <Text className="text-xs text-neutral-400" numberOfLines={1}>
              {session?.user.email}
            </Text>
          </View>
          <Pressable onPress={confirmSignOut} className="rounded-full border border-neutral-700 px-3 py-1.5">
            <Text className="text-sm text-red-400">Cerrar sesión</Text>
          </Pressable>
        </View>
        {/* C1: botón Sincronizar con avance "3 de 7" */}
        <Pressable
          onPress={handleSync}
          disabled={isSyncing}
          className={`flex-row items-center justify-center gap-2 rounded-xl p-3 ${pendingCount > 0 ? 'bg-sky-500' : 'border border-neutral-700'}`}
        >
          {isSyncing && <ActivityIndicator color="#0a0a0a" />}
          <Text className={pendingCount > 0 ? 'font-semibold text-neutral-950' : 'text-neutral-400'}>
            {isSyncing
              ? `Subiendo ${progress?.done ?? 0} de ${progress?.total ?? 0}…`
              : pendingCount > 0
                ? `☁️ Sincronizar (${pendingCount} pendiente${pendingCount === 1 ? '' : 's'})`
                : '✅ Todo sincronizado'}
          </Text>
        </Pressable>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nota…"
          placeholderTextColor="#737373"
          className="rounded-xl bg-neutral-900 px-4 py-3 text-white"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable onPress={() => setOnlyFavorites((v) => !v)} className={chip(onlyFavorites)}>
            <Text className={chipText(onlyFavorites)}>★ Favoritas</Text>
          </Pressable>
          <Pressable onPress={() => setAlbumId(null)} className={chip(albumId === null)}>
            <Text className={chipText(albumId === null)}>Todos los álbumes</Text>
          </Pressable>
          {albums.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAlbumId(a.id)}
              onLongPress={() => confirmRemoveAlbum(a.id, a.name)}
              className={chip(albumId === a.id)}
            >
              <Text className={chipText(albumId === a.id)}>{a.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {albums.length > 0 && (
          <Text className="text-xs text-neutral-500">Mantén presionado un álbum para eliminarlo.</Text>
        )}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        ListEmptyComponent={
          <Text className="mt-10 text-center text-neutral-500">No hay fotos con esos filtros.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/foto/[id]', params: { id: String(item.id) } })}
            className="flex-row items-center gap-3 rounded-2xl bg-neutral-900 p-2 active:opacity-80"
          >
            <Image source={{ uri: item.uri }} className="h-16 w-16 rounded-xl bg-neutral-800" />
            <View className="flex-1 gap-0.5">
              <Text className="text-white" numberOfLines={1}>
                {item.note || 'Sin nota'}
              </Text>
              <Text className="text-xs text-neutral-400">
                {item.albumName ?? 'Sin álbum'} · {item.createdAt.toLocaleDateString('es-CO')}
              </Text>
            </View>
            {item.favorite && <Text className="text-lg text-amber-400">★</Text>}
            {/* Ícono de nube: subida y sin cambios pendientes */}
            <Text className="pr-2 text-lg">
              {item.syncedAt && (!item.updatedAt || item.syncedAt >= item.updatedAt) ? '☁️' : ' '}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}