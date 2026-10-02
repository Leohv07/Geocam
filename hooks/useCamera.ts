// hooks/useCamera.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type CameraCapturedPicture,
  type CameraType,
} from 'expo-camera';
import type { PermissionState } from '@/types/geo';

export function useCamera() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissionState: PermissionState = !permission
    ? 'checking'
    : permission.granted
      ? 'granted'
      : !permission.canAskAgain
        ? 'blocked'
        : permission.status === 'undetermined'
          ? 'undetermined'
          : 'denied';

  // Al volver de Ajustes se vuelve a CONSULTAR (no pedir) el permiso
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const takePhoto = useCallback(async (): Promise<CameraCapturedPicture | null> => {
    if (!cameraRef.current || !isReady || isCapturing) return null;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setError(null);
      return photo ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo tomar la foto');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [isReady, isCapturing]);

  const onCameraReady = useCallback(() => setIsReady(true), []);
  const openSettings = useCallback(() => Linking.openSettings(), []);
  const handleRequest = useCallback(() => {
    void requestPermission();
  }, [requestPermission]);

  return {
    cameraRef,
    permissionState,
    requestPermission: handleRequest,
    openSettings,
    facing,
    toggleFacing,
    isReady,
    onCameraReady,
    takePhoto,
    isCapturing,
    error,
  };
}
