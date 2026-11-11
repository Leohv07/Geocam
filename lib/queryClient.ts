// lib/queryClient.ts — Semana 9: TanStack Query conectado a la red y al foco de React Native
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import kvStore from 'expo-sqlite/kv-store';

const ONE_DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // durante 30 s no se repite una consulta que ya está en caché
      retry: 2,
    },
  },
});

// 1. TanStack Query se entera del estado de la red (en React Native no existe window 'online')
onlineManager.setEventListener((setOnline) => {
  let initialised = false;
  const subscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    setOnline(!!state.isConnected);
  });
  Network.getNetworkStateAsync()
    .then((state) => {
      if (!initialised) setOnline(!!state.isConnected);
    })
    .catch(() => {});
  return () => subscription.remove();
});

// 2. TanStack Query se entera de cuándo la app vuelve a primer plano
export function useAppFocusManager() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);
}

// 3. Hook para que la UI muestre si hay conexión
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline()
  );
}

// 4. C3: la caché sobrevive al cierre. Se guarda en el kv-store de expo-sqlite (API de AsyncStorage).
// Solo se persiste la pestaña Nube: la sincronización ['sync'] siempre debe volver a ejecutarse.
export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister: createAsyncStoragePersister({ storage: kvStore, key: 'geocam-query-cache' }),
  maxAge: ONE_DAY,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.queryKey[0] === 'cloud' && query.state.status === 'success',
  },
};

/** gcTime de las consultas que se persisten: debe ser al menos maxAge o se descartan antes de guardarse. */
export const PERSISTED_GC_TIME = ONE_DAY;
