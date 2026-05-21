const KEY_PREFIX     = 'fieldlab_wellness_';
const MAX_RECORDS    = 100;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function readKey(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

// Guarda un registro de wellness para un jugador
export function saveWellness(data) {
  try {
    const key     = `${KEY_PREFIX}${data.playerId}`;
    const records = readKey(key);
    records.push(data);
    if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
    localStorage.setItem(key, JSON.stringify(records));
  } catch { /* localStorage no disponible o cuota llena */ }
}

// Retorna todos los registros de un jugador, ordenados por fecha desc
export function getWellnessByPlayer(playerId) {
  const records = readKey(`${KEY_PREFIX}${playerId}`);
  return [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Retorna el registro más reciente de un jugador (o null si no hay)
export function getLatestWellness(playerId) {
  const [latest] = getWellnessByPlayer(playerId);
  return latest ?? null;
}

// Retorna un objeto { playerId: latestRecord } con el último reporte de cada jugador
export function getAllLatestWellness() {
  const result = {};
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) keys.push(k);
    }
    for (const key of keys) {
      const playerId = key.slice(KEY_PREFIX.length);
      const latest   = getLatestWellness(playerId);
      if (latest) result[playerId] = latest;
    }
  } catch { /* ignore */ }
  return result;
}

// Elimina registros de más de 30 días
export function clearOldRecords() {
  try {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const keys   = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) keys.push(k);
    }
    for (const key of keys) {
      const fresh = readKey(key).filter(r => new Date(r.timestamp).getTime() > cutoff);
      fresh.length === 0
        ? localStorage.removeItem(key)
        : localStorage.setItem(key, JSON.stringify(fresh));
    }
  } catch { /* ignore */ }
}
