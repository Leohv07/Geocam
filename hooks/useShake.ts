// hooks/useShake.ts
import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';

interface ShakeOptions {
  /** Magnitud en g que cuenta como agitado. En reposo la magnitud es ~1 g. */
  threshold?: number;
  /** Tiempo mínimo entre dos disparos, en ms. */
  cooldownMs?: number;
  /** Permite pausar el sensor (p. ej. cuando la pestaña no está enfocada). */
  enabled?: boolean;
}

const UPDATE_INTERVAL_MS = 100;

export function useShake(
  onShake: () => void,
  options?: ShakeOptions
): { isAvailable: boolean | null } {
  const { threshold = 1.8, cooldownMs = 1000, enabled = true } = options ?? {};
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // El callback se guarda en una ref para no reiniciar la suscripción en cada render.
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: EventSubscription | null = null;
    let lastShake = 0;

    // 1. Verificar disponibilidad antes de suscribirse
    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        setIsAvailable(available);
        if (!available) return;

        // 2. Frecuencia moderada: 100 ms basta para detectar un agitado
        Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);

        subscription = Accelerometer.addListener(({ x, y, z }) => {
          // 3. Umbral sobre la magnitud del vector √(x² + y² + z²)
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          // 4. Enfriamiento: un solo disparo por agitado
          if (magnitude > threshold && now - lastShake > cooldownMs) {
            lastShake = now;
            onShakeRef.current();
          }
        });
      })
      .catch(() => {
        if (!cancelled) setIsAvailable(false);
      });

    // 5. Limpieza con bandera cancelled, igual que en useGeoLocation
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, threshold, cooldownMs]);

  return { isAvailable };
}
