// app/(tabs)/mapa.tsx — R3
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, FlatList, Image, StyleSheet, Alert } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { PhotoThumb } from '@/components/PhotoThumb';
import type { Coords, GeoPhoto } from '@/types/geo';

const DELTA = { latitudeDelta: 0.02, longitudeDelta: 0.02 };
// Solo se usa si no hay ubicación ni fotos con coordenadas
const FALLBACK_REGION: Region = { latitude: 4.711, longitude: -74.0721, latitudeDelta: 8, longitudeDelta: 8 };

function toRegion(c: Coords): Region {
  return { latitude: c.latitude, longitude: c.longitude, ...DELTA };
}

export default function MapaScreen() {
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const geo = useGeoLocation({ watch: false }); // en el mapa basta una lectura al enfocar
  const { photos, removePhoto } = useGeoPhotos();
  const [selected, setSelected] = useState<GeoPhoto | null>(null);

  const withCoords = useMemo(() => photos.filter((p) => p.coords !== null), [photos]);
  const withoutCoords = useMemo(() => photos.filter((p) => p.coords === null), [photos]);

  // Si la foto seleccionada se borró (p. ej. al agitar), se cierra la tarjeta
  useEffect(() => {
    if (selected && !photos.some((p) => p.id === selected.id)) setSelected(null);
  }, [photos, selected]);

  // Lectura única de la ubicación cada vez que se entra a la pestaña
  const { permission, getCurrent } = geo;
  useEffect(() => {
    if (isFocused && permission === 'granted') void getCurrent();
  }, [isFocused, permission, getCurrent]);

  // Centro: tu ubicación; sin permiso, la última foto con coordenadas
  const center: Coords | null =
    (geo.permission === 'granted' ? geo.coords : null) ?? withCoords[0]?.coords ?? null;

  useEffect(() => {
    if (center && isFocused) mapRef.current?.animateToRegion(toRegion(center), 500);
    // Solo re-centrar cuando cambian las coordenadas del centro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.latitude, center?.longitude, isFocused]);

  const confirmRemove = (photo: GeoPhoto) =>
    Alert.alert('¿Eliminar foto?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removePhoto(photo.id) },
    ]);

  return (
    <View className="flex-1 bg-neutral-950">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={center ? toRegion(center) : FALLBACK_REGION}
        showsUserLocation={geo.permission === 'granted'}
        onPress={() => setSelected(null)}
      >
        {withCoords.map((photo) =>
          photo.coords ? (
            <Marker
              key={photo.id}
              coordinate={{ latitude: photo.coords.latitude, longitude: photo.coords.longitude }}
              // Cámara = verde, galería = azul
              pinColor={photo.source === 'gallery' ? '#38bdf8' : '#34d399'}
              onPress={(e) => {
                e.stopPropagation();
                setSelected(photo);
              }}
            />
          ) : null
        )}
      </MapView>

      {/* Encabezado */}
      <View className="absolute left-4 right-4 rounded-xl bg-black/70 px-4 py-2" style={{ top: insets.top + 8 }}>
        <Text className="font-semibold text-white">
          {withCoords.length} en el mapa · {withoutCoords.length} sin ubicación
        </Text>
        {geo.permission !== 'granted' && geo.permission !== 'checking' && (
          <Text className="text-xs text-amber-300">
            Sin permiso de ubicación: el mapa se centra en tu última foto.
          </Text>
        )}
      </View>

      {/* Miniatura de la foto seleccionada */}
      {selected && selected.coords && (
        <View className="absolute left-4 right-4 flex-row items-center gap-3 rounded-2xl bg-neutral-900 p-3" style={{ bottom: withoutCoords.length > 0 ? 150 : 16 }}>
          <Image source={{ uri: selected.uri }} className="h-24 w-24 rounded-xl" />
          <View className="flex-1 gap-1">
            <Text className={`text-xs font-bold ${selected.source === 'gallery' ? 'text-sky-400' : 'text-emerald-400'}`}>
              {selected.source === 'gallery' ? 'GALERÍA' : 'CÁMARA'}
              {selected.coordsOrigin === 'exif' ? ' · coords EXIF' : ''}
            </Text>
            <Text className="font-mono text-xs text-neutral-300">
              {selected.coords.latitude.toFixed(5)}, {selected.coords.longitude.toFixed(5)}
            </Text>
            <Text className="text-xs text-neutral-500">{new Date(selected.createdAt).toLocaleString()}</Text>
            <Pressable onPress={() => confirmRemove(selected)} accessibilityRole="button">
              <Text className="text-sm font-semibold text-red-400">Eliminar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Fotos sin coordenadas, listadas aparte */}
      {withoutCoords.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 bg-neutral-950/95 pb-3 pt-2">
          <Text className="px-4 pb-2 font-semibold text-white">Sin ubicación ({withoutCoords.length})</Text>
          <FlatList
            horizontal
            data={withoutCoords}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable onLongPress={() => confirmRemove(item)} accessibilityHint="Mantén presionado para eliminar">
                <PhotoThumb photo={item} />
              </Pressable>
            )}
          />
        </View>
      )}
    </View>
  );
}
