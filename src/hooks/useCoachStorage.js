import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useCoachStorage(key, defaultValue = null) {
  const { coach } = useAuth();
  const fullKey = `fieldlab_${coach?.id ?? 'guest'}_${key}`;

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(fullKey);
      return raw !== null ? JSON.parse(raw) : defaultValue;
    } catch { return defaultValue; }
  });

  const set = useCallback((newVal) => {
    // Usamos la forma funcional de setValue para obtener siempre el estado
    // más reciente (prev), evitando el stale-closure cuando se pasa un updater
    // funcional (ej: set(prev => [...prev, item])) en llamadas rápidas sucesivas.
    setValue(prev => {
      const toStore = typeof newVal === 'function' ? newVal(prev) : newVal;
      try {
        localStorage.setItem(fullKey, JSON.stringify(toStore));
      } catch { /* localStorage no disponible o cuota llena */ }
      return toStore;
    });
  }, [fullKey]);

  const clear = useCallback(() => {
    localStorage.removeItem(fullKey);
    setValue(defaultValue);
  }, [fullKey, defaultValue]);

  return [value, set, clear];
}
