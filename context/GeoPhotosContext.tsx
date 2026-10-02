// context/GeoPhotosContext.tsx
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { GeoPhoto } from '@/types/geo';

type Action =
  | { type: 'add'; photo: GeoPhoto }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

// Actualizaciones inmutables (Semana 4): nunca se muta el arreglo, siempre se devuelve uno nuevo.
function photosReducer(state: GeoPhoto[], action: Action): GeoPhoto[] {
  switch (action.type) {
    case 'add':
      return [action.photo, ...state];
    case 'remove':
      return state.filter((p) => p.id !== action.id);
    case 'clear':
      return [];
  }
}

interface GeoPhotosContextValue {
  photos: GeoPhoto[];
  addPhoto: (photo: GeoPhoto) => void;
  removePhoto: (id: string) => void;
  clearAll: () => void;
}

const GeoPhotosContext = createContext<GeoPhotosContextValue | null>(null);

export function GeoPhotosProvider({ children }: { children: ReactNode }) {
  const [photos, dispatch] = useReducer(photosReducer, []);

  const addPhoto = useCallback((photo: GeoPhoto) => dispatch({ type: 'add', photo }), []);
  const removePhoto = useCallback((id: string) => dispatch({ type: 'remove', id }), []);
  const clearAll = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo(
    () => ({ photos, addPhoto, removePhoto, clearAll }),
    [photos, addPhoto, removePhoto, clearAll]
  );

  return <GeoPhotosContext.Provider value={value}>{children}</GeoPhotosContext.Provider>;
}

export function useGeoPhotos(): GeoPhotosContextValue {
  const ctx = useContext(GeoPhotosContext);
  if (!ctx) throw new Error('useGeoPhotos debe usarse dentro de <GeoPhotosProvider>');
  return ctx;
}

/** Genera un id único aunque se creen dos fotos en el mismo milisegundo. */
export function createPhotoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
