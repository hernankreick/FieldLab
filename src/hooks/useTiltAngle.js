import { useState, useEffect, useCallback, useRef } from 'react';

// ── Valores normativos por deporte ────────────────────────────────────────────
export const NORMAS = {
  rugby:   { optimo: 35, precaucion: 25 },
  hockey:  { optimo: 33, precaucion: 23 },
  futbol:  { optimo: 35, precaucion: 25 },
  default: { optimo: 35, precaucion: 25 },
};

export function getAngleStatus(angle, sport = 'default') {
  const n = NORMAS[sport] ?? NORMAS.default;
  if (angle >= n.optimo)     return 'optimo';
  if (angle >= n.precaucion) return 'precaucion';
  return 'riesgo';
}

export function statusColor(s) {
  if (s === 'optimo')     return '#22c55e';
  if (s === 'precaucion') return '#eab308';
  return '#ef4444';
}

export function statusLabel(s) {
  if (s === 'optimo')     return 'ÓPTIMO';
  if (s === 'precaucion') return 'PRECAUCIÓN';
  return 'RIESGO';
}

export function statusBg(s) {
  if (s === 'optimo')     return 'rgba(34,197,94,0.12)';
  if (s === 'precaucion') return 'rgba(234,179,8,0.12)';
  return 'rgba(239,68,68,0.12)';
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useTiltAngle() {
  const [angle,     setAngle]     = useState(null);
  const [isReading, setIsReading] = useState(false);
  const [error,     setError]     = useState(null);
  const [permitted, setPermitted] = useState(false);
  const baseRef                   = useRef(null);

  // En iOS 13+ se necesita pedir permiso explícito
  const requestPermission = useCallback(async () => {
    setError(null);
    if (typeof DeviceOrientationEvent === 'undefined') {
      setError('Tu dispositivo no soporta el giroscopio.');
      return false;
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') {
          setError('Permiso de giroscopio denegado. Habilitalo en Ajustes.');
          return false;
        }
      } catch (e) {
        setError(`Error al pedir permiso: ${e.message}`);
        return false;
      }
    }
    setPermitted(true);
    return true;
  }, []);

  // gamma = inclinación lateral (izq/der) cuando el celular está de canto
  // contra la tibia. Rango: -90 a 90. Usamos el valor absoluto.
  const handleOrientation = useCallback((e) => {
    const raw = e.gamma;
    if (raw === null) return;
    setAngle(Math.round(Math.abs(raw)));
  }, []);

  const startReading = useCallback(() => {
    setIsReading(true);
    baseRef.current = null;
    window.addEventListener('deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  const stopReading = useCallback(() => {
    setIsReading(false);
    window.removeEventListener('deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [handleOrientation]);

  return {
    angle,
    isReading,
    error,
    permitted,
    requestPermission,
    startReading,
    stopReading,
  };
}
