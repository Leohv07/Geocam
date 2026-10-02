// types/geo.ts
export type PermissionState =
  | 'checking'
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'blocked';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export type PhotoSource = 'camera' | 'gallery';

export interface GeoPhoto {
  id: string;
  uri: string;
  coords: Coords | null; // null si el usuario negó la ubicación
  source: PhotoSource;
  createdAt: number;
  /** De dónde salieron las coordenadas: GPS del dispositivo o EXIF original (reto opcional). */
  coordsOrigin?: 'device' | 'exif';
}
