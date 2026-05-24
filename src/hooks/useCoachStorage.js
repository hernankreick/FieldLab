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
    const toStore = typeof newVal === 'function' ? newVal(value) : newVal;
    localStorage.setItem(fullKey, JSON.stringify(toStore));
    setValue(toStore);
  }, [fullKey, value]);

  const clear = useCallback(() => {
    localStorage.removeItem(fullKey);
    setValue(defaultValue);
  }, [fullKey, defaultValue]);

  return [value, set, clear];
}
