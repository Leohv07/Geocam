// app/foto/[id].tsx — ver, editar nota, favorita, mover de álbum, subir a la nube y eliminar
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { usePhoto } from '@/hooks/usePhoto';
import { useAlbums } from '@/hooks/useAlbums';

export default function FotoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const photoId = Number(id);
  const {
    photo,
    albumName,
    isSynced,
    isPending,
    isUploading,
    saveNote,
    setFavorite,
    moveToAlbum,
    upload,
    remove,
  } = usePhoto(photoId);
  const { albums, createAlbum } = useAlbums();

  const [note, setNote] = useState('');
  const [newAlbum, setNewAlbum] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Cargar la nota guardada cuando llega la foto
  useEffect(() => {
    setNote(photo?.note ?? '');
  }, [photo?.note]);

  if (!photo) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-950">
        <Stack.Screen options={{ headerShown: true, title: 'Foto' }} />
        <Text className="text-neutral-400">Foto no encontrada.</Text>
      </View>
    );
  }

  const handleSaveNote = async () => {
    await saveNote(note);
    setMessage('Nota guardada ✓');
  };

  const handleCreateAlbum = async () => {
    const error = await createAlbum(newAlbum);
    setMessage(error ?? `Álbum "${newAlbum.trim()}" creado ✓`);
    if (!error) setNewAlbum('');
  };

  // T5: subir esta foto a Supabase
  const handleUpload = async () => {
    const error = await upload();
    if (error) Alert.alert('No se pudo subir', error);
    else setMessage('Foto guardada en la nube ☁️');
  };

  // C3: si la foto está en la nube, se borra allá primero; sin conexión no se borra nada
  const confirmDelete = () =>
    Alert.alert(
      'Eliminar foto',
      isSynced
        ? 'Se borrará del teléfono y de la nube (registro y archivo). ¿Continuar?'
        : 'Se borrará el registro y el archivo. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await remove();
              router.back();
            } catch {
              Alert.alert('Sin conexión', 'No se pudo borrar la foto de la nube. No se borró nada; inténtalo de nuevo.');
            }
          },
        },
      ]
    );

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 ${active ? 'border-sky-400 bg-sky-400' : 'border-neutral-700'}`;
  const chipText = (active: boolean) => (active ? 'font-semibold text-neutral-950' : 'text-neutral-300');

  const cloudLabel = !isSynced
    ? '☁️ Subir a la nube'
    : isPending
      ? '☁️ Actualizar en la nube'
      : '✅ Guardada en la nube';

  return (
    <ScrollView className="flex-1 bg-neutral-950" contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Detalle de foto',
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#fff',
        }}
      />

      <Image source={{ uri: photo.uri }} className="aspect-square w-full rounded-2xl bg-neutral-900" />

      <View className="gap-1">
        <Text className="text-neutral-400">
          {photo.source === 'gallery' ? 'Galería' : 'Cámara'} · {photo.createdAt.toLocaleString('es-CO')}
        </Text>
        <Text className="font-mono text-xs text-neutral-500">
          {photo.latitude !== null && photo.longitude !== null
            ? `${photo.latitude.toFixed(5)}, ${photo.longitude.toFixed(5)}`
            : 'Sin ubicación'}
        </Text>
      </View>

      {/* T5: subir a la nube */}
      <Pressable
        onPress={handleUpload}
        disabled={isUploading || (isSynced && !isPending)}
        className={`flex-row items-center justify-center gap-2 rounded-xl p-3 ${isSynced && !isPending ? 'border border-emerald-500' : 'bg-sky-500'}`}
      >
        {isUploading ? (
          <ActivityIndicator color="#0a0a0a" />
        ) : (
          <Text className={isSynced && !isPending ? 'font-semibold text-emerald-400' : 'font-semibold text-neutral-950'}>
            {cloudLabel}
          </Text>
        )}
      </Pressable>

      {/* Favorita */}
      <Pressable
        onPress={() => void setFavorite(!photo.favorite)}
        className={`flex-row items-center justify-center gap-2 rounded-xl p-3 ${photo.favorite ? 'bg-amber-400' : 'bg-neutral-900'}`}
      >
        <Text className={photo.favorite ? 'font-semibold text-neutral-950' : 'text-white'}>
          {photo.favorite ? '★ Favorita' : '☆ Marcar como favorita'}
        </Text>
      </Pressable>

      {/* Nota */}
      <View className="gap-2">
        <Text className="font-semibold text-white">Nota</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Escribe una nota…"
          placeholderTextColor="#737373"
          multiline
          className="min-h-20 rounded-xl bg-neutral-900 p-3 text-white"
        />
        <Pressable onPress={handleSaveNote} className="items-center rounded-xl bg-emerald-500 p-3">
          <Text className="font-semibold text-neutral-950">Guardar nota</Text>
        </Pressable>
      </View>

      {/* Álbum */}
      <View className="gap-2">
        <Text className="font-semibold text-white">Álbum: {albumName ?? 'Sin álbum'}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Pressable onPress={() => void moveToAlbum(null)} className={chip(photo.albumId === null)}>
            <Text className={chipText(photo.albumId === null)}>Sin álbum</Text>
          </Pressable>
          {albums.map((a) => (
            <Pressable key={a.id} onPress={() => void moveToAlbum(a.id)} className={chip(photo.albumId === a.id)}>
              <Text className={chipText(photo.albumId === a.id)}>{a.name}</Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row gap-2">
          <TextInput
            value={newAlbum}
            onChangeText={setNewAlbum}
            placeholder="Nuevo álbum"
            placeholderTextColor="#737373"
            className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-white"
          />
          <Pressable onPress={handleCreateAlbum} className="justify-center rounded-xl bg-sky-500 px-4">
            <Text className="font-semibold text-neutral-950">Crear</Text>
          </Pressable>
        </View>
      </View>

      {message && <Text className="text-center text-emerald-300">{message}</Text>}

      <Pressable onPress={confirmDelete} className="items-center rounded-xl border border-red-500 p-3">
        <Text className="font-semibold text-red-400">Eliminar foto</Text>
      </Pressable>
    </ScrollView>
  );
}