// hooks/useGeoLocation.ts
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import type { Coords, PermissionState } from '@/types/geo';

interface Options {
  /** Seguimiento continuo. Pásalo en false cuando la pantalla no está enfocada para apagar el GPS. */
  watch?: boolean;
}

interface GeoLocationState {
  permission: PermissionState;
  coords: Coords | null;
  error: string | null;
}

/** Por encima de este valor (en metros) asumimos que el usuario concedió ubicación aproximada. */
export const APPROXIMATE_ACCURACY_M = 1000;

function mapPermission(res: Location.LocationPermissionResponse): PermissionState {
  if (res.granted) return 'granted';
  if (!res.canAskAgain) return 'blocked';
  if (res.status === 'undetermined') return 'undetermined';
  return 'denied';
}

function toCoords(loc: Location.LocationObject): Coords {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    timestamp: loc.timestamp,
  };
}

export function useGeoLocation({ watch = false }: Options = {}) {
  const [state, setState] = useState<GeoLocationState>({
    permission: 'checking',
    coords: null,
    error: null,
  });

  // 1. Al montar: solo CONSULTAR el permiso, nunca pedirlo
  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then((res) => {
        if (!cancelled) setState((s) => ({ ...s, permission: mapPermission(res) }));
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, permission: 'denied' }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Solicitar permiso por acción explícita del usuario
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const res = await Location.requestForegroundPermissionsAsync();
    setState((s) => ({ ...s, permission: mapPermission(res) }));
    return res.granted;
  }, []);

  // Re-consultar el permiso (p. ej. al volver de Ajustes)
  const refreshPermission = useCallback(async (): Promise<void> => {
    try {
      const res = await Location.getForegroundPermissionsAsync();
      setState((s) => ({ ...s, permission: mapPermission(res) }));
    } catch {
      // se conserva el estado anterior
    }
  }, []);

  // Al volver de Ajustes (app de nuevo 'active') el permiso pudo cambiar: blocked -> granted
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') void refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  // 3. Lectura única, útil justo antes de tomar la foto
  const getCurrent = useCallback(async (): Promise<Coords | null> => {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = toCoords(loc);
      setState((s) => ({ ...s, coords, error: null }));
      return coords;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo obtener la ubicación';
      setState((s) => ({ ...s, error: message }));
      return null;
    }
  }, []);

  // 4. Seguimiento continuo con limpieza segura ante desmontaje temprano
  useEffect(() => {
    if (!watch || state.permission !== 'granted') return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      (loc) => setState((s) => ({ ...s, coords: toCoords(loc), error: null }))
    )
      .then((sub) => {
        if (cancelled) sub.remove(); // se desmontó antes de resolver
        else subscription = sub;
      })
      .catch((e: unknown) =>
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Error de GPS' }))
      );

    if (__DEV__) console.log('[useGeoLocation] GPS iniciado');

    return () => {
      cancelled = true;
      subscription?.remove();
      // Log TEMPORAL exigido por el taller: confirma que el GPS se detiene al salir de la pestaña.
      if (__DEV__) console.log('[useGeoLocation] cleanup: GPS detenido');
    };
  }, [watch, state.permission]);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  const isApproximate =
    state.coords?.accuracy != null && state.coords.accuracy > APPROXIMATE_ACCURACY_M;

  return { ...state, isApproximate, requestPermission, refreshPermission, getCurrent, openSettings };
}
