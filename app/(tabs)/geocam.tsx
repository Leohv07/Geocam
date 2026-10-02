// app/(tabs)/geocam.tsx
import { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from 'expo-router';
import { useCamera } from '@/hooks/useCamera';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useShake } from '@/hooks/useShake';
import { useLevel } from '@/hooks/useLevel';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { PhotoThumb } from '@/components/PhotoThumb';
import { useGeoPhotos, createPhotoId } from '@/context/GeoPhotosContext';
import { coordsFromExif, gpsKeys } from '@/lib/exif';
import type { Coords } from '@/types/geo';

export default function GeoCamScreen() {
  // Las pestañas NO se desmontan al cambiar de tab: sin esto el GPS y los sensores seguirían activos.
  const isFocused = useIsFocused();

  const cam = useCamera();
  const geo = useGeoLocation({ watch: isFocused });
  const level = useLevel(isFocused);
  const { photos, addPhoto, clearAll } = useGeoPhotos();
  const [isImporting, setIsImporting] = useState(false);

  // R4: agitar el teléfono pregunta si se borran todas las fotos
  const handleShake = useCallback(() => {
    if (photos.length === 0) return;
    Alert.alert('¿Borrar todas las fotos?', `Se eliminarán ${photos.length} foto(s).`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: clearAll },
    ]);
  }, [photos.length, clearAll]);
  useShake(handleShake, { threshold: 1.8, cooldownMs: 1500, enabled: isFocused });

  // Coordenadas actuales, o null si no hay permiso (degradación elegante)
  const currentCoords = useCallback(async (): Promise<Coords | null> => {
    if (geo.permission !== 'granted') return null;
    return geo.coords ?? (await geo.getCurrent());
  }, [geo]);

  const handleCapture = async () => {
    const photo = await cam.takePhoto();
    if (!photo) return;
    const coords = await currentCoords();
    addPhoto({
      id: createPhotoId(),
      uri: photo.uri,
      coords,
      coordsOrigin: coords ? 'device' : undefined,
      source: 'camera',
      createdAt: Date.now(),
    });
  };

  // R2: importar desde galería (el selector del sistema no requiere permiso de galería)
  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        exif: true, // reto opcional: coordenadas originales de la foto
      });
      if (result.canceled) return;
      const asset = result.assets[0];

      if (__DEV__) console.log('[EXIF] claves GPS:', gpsKeys(asset.exif));
      const exifCoords = coordsFromExif(asset.exif);
      const coords = exifCoords ?? (await currentCoords());

      addPhoto({
        id: createPhotoId(),
        uri: asset.uri,
        coords,
        coordsOrigin: exifCoords ? 'exif' : coords ? 'device' : undefined,
        source: 'gallery',
        createdAt: Date.now(),
      });
    } catch (e) {
      Alert.alert('No se pudo importar', e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setIsImporting(false);
    }
  };

  if (cam.permissionState === 'checking') {
    return <View className="flex-1 bg-neutral-950" />;
  }

  if (cam.permissionState !== 'granted') {
    return (
      <PermissionPrimer
        title="GeoCam necesita tu cámara"
        description="La usamos solo para tomar fotos que tú decidas guardar."
        state={cam.permissionState}
        onRequest={cam.requestPermission}
        onOpenSettings={cam.openSettings}
      />
    );
  }

  const lastPhoto = photos[0] ?? null;
  const isLevel = level.angle !== null && Math.abs(level.angle) <= 2;

  return (
    <View className="flex-1 bg-black">
      {/* CameraView sin hijos: los controles van como hermanos absolutos.
          `active` apaga el preview cuando la pestaña no está enfocada. */}
      <CameraView
        ref={cam.cameraRef}
        style={StyleSheet.absoluteFill}
        facing={cam.facing}
        active={isFocused}
        onCameraReady={cam.onCameraReady}
      />

      {/* Banner de ubicación: pedir en contexto sin bloquear la cámara */}
      {geo.permission !== 'granted' && geo.permission !== 'checking' && (
        <Pressable
          onPress={geo.permission === 'blocked' ? geo.openSettings : geo.requestPermission}
          className="absolute left-4 right-4 top-14 rounded-xl bg-amber-400/90 p-3"
          accessibilityRole="button"
        >
          <Text className="text-center font-medium text-neutral-900">
            {geo.permission === 'blocked'
              ? 'Ubicación bloqueada: tus fotos se guardan sin coordenadas. Toca para abrir Ajustes.'
              : 'Activa la ubicación para etiquetar tus fotos'}
          </Text>
        </Pressable>
      )}

      {/* Coordenadas en vivo */}
      {geo.permission === 'granted' && geo.coords && (
        <View className="absolute left-4 top-14 rounded-lg bg-black/60 px-3 py-2">
          <Text className="font-mono text-xs text-emerald-300">
            {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)}
          </Text>
          <Text className="font-mono text-xs text-neutral-400">
            ±{Math.round(geo.coords.accuracy ?? 0)} m
          </Text>
        </View>
      )}

      {/* Reto opcional: aviso de ubicación aproximada (> 1 km) */}
      {geo.permission === 'granted' && geo.isApproximate && (
        <View className="absolute left-4 right-4 top-32 rounded-xl bg-orange-500/90 p-3">
          <Text className="text-center text-sm font-medium text-neutral-950">
            Concediste ubicación aproximada: las coordenadas pueden desviarse más de 1 km.
          </Text>
        </View>
      )}

      {/* Errores como estado de UI */}
      {(geo.error || cam.error) && (
        <View className="absolute bottom-40 left-4 right-4 rounded-xl bg-red-500/90 p-3">
          <Text className="text-center text-sm text-white">{cam.error ?? geo.error}</Text>
        </View>
      )}

      {/* Reto opcional: indicador de nivel */}
      {level.angle !== null && (
        <View className="absolute right-4 top-14 items-center rounded-lg bg-black/60 px-3 py-2">
          <View
            className={`h-0.5 w-12 ${isLevel ? 'bg-emerald-400' : 'bg-white'}`}
            style={{ transform: [{ rotate: `${-level.angle}deg` }] }}
          />
          <Text className={`mt-1 font-mono text-xs ${isLevel ? 'text-emerald-300' : 'text-white'}`}>
            {level.angle}°
          </Text>
        </View>
      )}

      {/* Controles inferiores */}
      <View className="absolute bottom-10 left-0 right-0 flex-row items-center justify-around">
        <View className="items-center gap-1">
          {lastPhoto ? <PhotoThumb photo={lastPhoto} size="sm" /> : <View className="h-14 w-14" />}
          <Text className="text-xs text-neutral-300">{photos.length} foto(s)</Text>
        </View>

        <Pressable
          onPress={handleCapture}
          disabled={cam.isCapturing}
          className="h-20 w-20 items-center justify-center rounded-full border-4 border-white active:opacity-70"
          accessibilityRole="button"
          accessibilityLabel="Tomar foto"
        >
          <View className={`h-16 w-16 rounded-full ${cam.isCapturing ? 'bg-neutral-400' : 'bg-white'}`} />
        </Pressable>

        <View className="items-center gap-3">
          <Pressable
            onPress={cam.toggleFacing}
            className="h-12 w-12 items-center justify-center rounded-full bg-black/50"
            accessibilityRole="button"
            accessibilityLabel="Cambiar cámara"
          >
            <Text className="text-2xl text-white">↻</Text>
          </Pressable>
          <Pressable
            onPress={handleImport}
            disabled={isImporting}
            className="h-12 w-12 items-center justify-center rounded-full bg-sky-500/80"
            accessibilityRole="button"
            accessibilityLabel="Importar desde galería"
          >
            {isImporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-xs font-bold text-white">GAL</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
