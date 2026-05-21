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

// ─── RPE y Sesión ─────────────────────────────────────────────────────────────

const RPE_PREFIX     = 'fieldlab_rpe_';
const SESSION_PREFIX = 'fieldlab_session_';

// Retorna la fecha de hoy en formato YYYY-MM-DD
function todayDate() {
  return new Date().toISOString().split('T')[0];
}

// Calcula la carga promedio de una sesión (RPE × minutos por jugador)
function avgSessionLoad(session) {
  if (!session?.players?.length) return 0;
  const withLoad = session.players.filter(p => p.load > 0);
  if (!withLoad.length) return 0;
  return withLoad.reduce((s, p) => s + p.load, 0) / withLoad.length;
}

// Guarda el RPE de un jugador para una fecha dada
export function saveRPE(data) {
  try {
    localStorage.setItem(`${RPE_PREFIX}${data.playerId}_${data.date}`, JSON.stringify(data));
  } catch { /* ignore */ }
}

// Retorna el RPE de un jugador para una fecha (por defecto hoy), o null si no existe
export function getRPE(playerId, date = todayDate()) {
  try {
    const raw = localStorage.getItem(`${RPE_PREFIX}${playerId}_${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Retorna un objeto { [playerId]: record } con todos los RPEs registrados hoy
export function getAllTodayRPEs() {
  const result = {};
  try {
    const today  = todayDate();
    const suffix = `_${today}`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(RPE_PREFIX) && k.endsWith(suffix)) {
        try {
          const record = JSON.parse(localStorage.getItem(k));
          if (record) result[String(record.playerId)] = record;
        } catch { /* clave corrupta, ignorar */ }
      }
    }
  } catch { /* ignore */ }
  return result;
}

// Guarda la sesión del equipo para una fecha dada
export function saveSession(data) {
  try {
    localStorage.setItem(`${SESSION_PREFIX}${data.date}`, JSON.stringify(data));
  } catch { /* ignore */ }
}

// Retorna la sesión para una fecha (por defecto hoy), o null si no existe
export function getSession(date = todayDate()) {
  try {
    const raw = localStorage.getItem(`${SESSION_PREFIX}${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Retorna las sesiones de los últimos `days` días, ordenadas de más antigua a más reciente
export function getRecentSessions(days = 28) {
  const result = [];
  try {
    const base = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const date    = d.toISOString().split('T')[0];
      const session = getSession(date);
      result.push({ date, load: avgSessionLoad(session) || 0 });
    }
  } catch { /* ignore */ }
  return result;
}
