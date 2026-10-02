// lib/exif.ts — Reto opcional: leer coordenadas EXIF de fotos importadas
import type { Coords } from '@/types/geo';

type Exif = Record<string, unknown>;

/**
 * Convierte cualquier formato GPS que devuelvan las plataformas a grados decimales:
 *  - número decimal (iOS {GPS}.Latitude, algunos Android)
 *  - string decimal "10.54"
 *  - string racional de Android "10/1,32/1,4512/100" (grados, minutos, segundos)
 *  - arreglo [grados, minutos, segundos]
 */
function toDecimal(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number')) {
    const [d, m, s] = value as number[];
    return d + m / 60 + s / 3600;
  }
  if (typeof value === 'string') {
    if (value.includes('/')) {
      const parts = value.split(',').map((part) => {
        const [num, den] = part.trim().split('/').map(Number);
        return den ? num / den : num;
      });
      if (parts.length === 3 && parts.every(Number.isFinite)) {
        return parts[0] + parts[1] / 60 + parts[2] / 3600;
      }
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function applyRef(value: number, ref: unknown, negativeRef: 'S' | 'W'): number {
  // Si el valor ya viene negativo (algunos Android), se respeta.
  if (value < 0) return value;
  return typeof ref === 'string' && ref.toUpperCase().startsWith(negativeRef) ? -value : value;
}

/** Devuelve las coordenadas del EXIF o null si la foto no las trae. */
export function coordsFromExif(exif: Exif | null | undefined): Coords | null {
  if (!exif) return null;

  // iOS: diccionario anidado "{GPS}" con Latitude/LatitudeRef/Longitude/LongitudeRef
  const gps = (exif['{GPS}'] as Exif | undefined) ?? undefined;
  const rawLat = gps?.Latitude ?? exif.GPSLatitude;
  const rawLon = gps?.Longitude ?? exif.GPSLongitude;
  const latRef = gps?.LatitudeRef ?? exif.GPSLatitudeRef;
  const lonRef = gps?.LongitudeRef ?? exif.GPSLongitudeRef;

  const lat = toDecimal(rawLat);
  const lon = toDecimal(rawLon);
  if (lat == null || lon == null) return null;
  if (lat === 0 && lon === 0) return null; // Android devuelve 0,0 cuando se eliminó la ubicación

  return {
    latitude: applyRef(lat, latRef, 'S'),
    longitude: applyRef(lon, lonRef, 'W'),
    accuracy: null,
    timestamp: Date.now(),
  };
}

/** Claves GPS encontradas, útil para documentar en el AI-LOG qué devolvió cada plataforma. */
export function gpsKeys(exif: Exif | null | undefined): string[] {
  if (!exif) return [];
  const flat = Object.keys(exif).filter((k) => k.startsWith('GPS'));
  const nested = exif['{GPS}'] ? Object.keys(exif['{GPS}'] as Exif).map((k) => `{GPS}.${k}`) : [];
  return [...flat, ...nested];
}
