// hooks/useLevel.ts — Reto opcional: indicador de nivel
import { useEffect, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';

interface LevelState {
  /** Inclinación lateral en grados; 0 = foto derecha. null si el teléfono está casi horizontal. */
  angle: number | null;
  isAvailable: boolean | null;
}

/**
 * Calcula el giro del teléfono sobre el eje de la pantalla a partir de la gravedad
 * (acelerómetro en g). Con el teléfono vertical y derecho: x ≈ 0, y ≈ -1.
 *
 * ¿Por qué no Gyroscope? El giroscopio mide velocidad angular (rad/s); para obtener
 * un ángulo habría que integrar y la deriva se acumula. ¿Por qué no DeviceMotion.rotation?
 * `alpha` (giro sobre el eje Z) depende del norte magnético, no de la gravedad.
 */
export function useLevel(enabled = true): LevelState {
  const [angle, setAngle] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: EventSubscription | null = null;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        setIsAvailable(available);
        if (!available) return;
        Accelerometer.setUpdateInterval(100);
        subscription = Accelerometer.addListener(({ x, y }) => {
          // Si el teléfono está casi acostado, la gravedad sobre X/Y es muy pequeña y el ángulo no es fiable
          if (Math.hypot(x, y) < 0.5) {
            setAngle(null);
            return;
          }
          setAngle(Math.round((Math.atan2(x, -y) * 180) / Math.PI));
        });
      })
      .catch(() => {
        if (!cancelled) setIsAvailable(false);
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);

  return { angle, isAvailable };
}
