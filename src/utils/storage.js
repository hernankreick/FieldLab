const MAX_RECORDS    = 100;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function readKey(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); }
  catch { return []; }
}

// Construye el prefijo según si se pasa coachId o no
function prefix(coachId, domain) {
  return coachId ? `fieldlab_${coachId}_${domain}` : `fieldlab_${domain}`;
}

// ─── Wellness ─────────────────────────────────────────────────────────────────

// Guarda un registro de wellness para un jugador
export function saveWellness(data, coachId = null) {
  try {
    const key     = `${prefix(coachId, 'wellness')}_${data.playerId}`;
    const records = readKey(key);
    records.push(data);
    if (records.length > MAX_RECORDS) records.splice(0, records.length - MAX_RECORDS);
    localStorage.setItem(key, JSON.stringify(records));
  } catch { /* localStorage no disponible o cuota llena */ }
}

// Retorna todos los registros de un jugador, ordenados por fecha desc
export function getWellnessByPlayer(playerId, coachId = null) {
  const records = readKey(`${prefix(coachId, 'wellness')}_${playerId}`);
  return [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Retorna el registro más reciente de un jugador (o null si no hay)
export function getLatestWellness(playerId, coachId = null) {
  const [latest] = getWellnessByPlayer(playerId, coachId);
  return latest ?? null;
}

// Retorna un objeto { playerId: latestRecord } con el último reporte de cada jugador
export function getAllLatestWellness(coachId = null) {
  const result    = {};
  const keyPrefix = `${prefix(coachId, 'wellness')}_`;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(keyPrefix)) keys.push(k);
    }
    for (const key of keys) {
      const playerId = key.slice(keyPrefix.length);
      const latest   = getLatestWellness(playerId, coachId);
      if (latest) result[playerId] = latest;
    }
  } catch { /* ignore */ }
  return result;
}

// Elimina registros de más de 30 días
export function clearOldRecords(coachId = null) {
  try {
    const keyPrefix = `${prefix(coachId, 'wellness')}_`;
    const cutoff    = Date.now() - THIRTY_DAYS_MS;
    const keys      = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(keyPrefix)) keys.push(k);
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
export function saveRPE(data, coachId = null) {
  try {
    const key = `${prefix(coachId, 'rpe')}_${data.playerId}_${data.date}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore */ }
}

// Retorna el RPE de un jugador para una fecha (por defecto hoy), o null si no existe
export function getRPE(playerId, date = todayDate(), coachId = null) {
  try {
    const key = `${prefix(coachId, 'rpe')}_${playerId}_${date}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Retorna un objeto { [playerId]: record } con todos los RPEs registrados hoy
export function getAllTodayRPEs(coachId = null) {
  const result    = {};
  const rpePrefix = `${prefix(coachId, 'rpe')}_`;
  try {
    const today  = todayDate();
    const suffix = `_${today}`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(rpePrefix) && k.endsWith(suffix)) {
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
export function saveSession(data, coachId = null) {
  try {
    const key = `${prefix(coachId, 'session')}_${data.date}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* ignore */ }
}

// Retorna la sesión para una fecha (por defecto hoy), o null si no existe
export function getSession(date = todayDate(), coachId = null) {
  try {
    const key = `${prefix(coachId, 'session')}_${date}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Retorna las cargas de un jugador específico en los últimos `days` días (oldest → newest)
export function getPlayerRecentLoads(playerId, days = 28, coachId = null) {
  const result = [];
  try {
    const base = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const date    = d.toISOString().split('T')[0];
      const session = getSession(date, coachId);
      const player  = session?.players?.find(p => String(p.playerId) === String(playerId));
      result.push({ date, load: player?.load ?? 0 });
    }
  } catch { /* ignore */ }
  return result;
}

// ─── Evaluaciones (saltos, velocidad, etc.) ───────────────────────────────────

/**
 * Guarda un registro de evaluación para un jugador.
 * Formato esperado:
 * { playerId, date, type, jumpType, height, flightTime, power, kneeAngle }
 */
export function savePlayerEval(record, coachId = null) {
  try {
    const key     = `${prefix(coachId, 'eval')}_${record.playerId}`;
    const records = readKey(key);
    records.unshift(record);                 // newest first
    localStorage.setItem(key, JSON.stringify(records.slice(0, 100)));
  } catch { /* localStorage no disponible o cuota llena */ }
}

/**
 * Retorna todos los registros de evaluación de un jugador (newest first).
 */
export function getPlayerEvals(playerId, coachId = null) {
  return readKey(`${prefix(coachId, 'eval')}_${playerId}`);
}

// ─── Mobility Athletes ─────────────────────────────────────────────────────────
// Supabase-ready: maps to table `athletes`
// Row schema: { id TEXT PK, coach_id TEXT, name TEXT, created_at TIMESTAMPTZ }
//
// Migration notes:
//   1. CREATE TABLE athletes (id text primary key, coach_id text, name text, created_at timestamptz)
//      with RLS: coach_id = auth.uid()
//   2. Replace readKey(key) with supabase.from('athletes').select('*').eq('coach_id', coachId)
//   3. Replace localStorage.setItem with supabase.from('athletes').upsert(athlete)

export function getAthletes(coachId = null) {
  return readKey(prefix(coachId, 'athletes'));
}

export function saveAthlete(athlete, coachId = null) {
  try {
    const key  = prefix(coachId, 'athletes');
    const list = readKey(key);
    const idx  = list.findIndex(a => a.id === athlete.id);
    if (idx >= 0) list[idx] = athlete; else list.push(athlete);
    localStorage.setItem(key, JSON.stringify(list));
  } catch { /* ignore */ }
}

export function deleteAthlete(athleteId, coachId = null) {
  try {
    const key  = prefix(coachId, 'athletes');
    const list = readKey(key).filter(a => a.id !== athleteId);
    localStorage.setItem(key, JSON.stringify(list));
  } catch { /* ignore */ }
}

// ─── Mobility Assessments ──────────────────────────────────────────────────────
// Supabase-ready: maps to table `mobility_assessments`
// Row schema: { id TEXT PK, athlete_id TEXT FK, coach_id TEXT, date TIMESTAMPTZ,
//               joint TEXT, movement TEXT, side TEXT, angle INT, status TEXT, asi_pct REAL,
//               optimo INT }
//
// Migration notes:
//   1. CREATE TABLE mobility_assessments (...) with RLS: coach_id = auth.uid()
//   2. Replace readKey with supabase.from('mobility_assessments').select('*')
//        .eq('athlete_id', athleteId).order('date', { ascending: false })
//   3. Replace localStorage.setItem with supabase.from('mobility_assessments').insert(record)

export function saveMobilityAssessment(record, coachId = null) {
  try {
    const key  = `${prefix(coachId, 'mobility')}_${record.athleteId}`;
    const list = readKey(key);
    list.unshift(record);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 500)));
  } catch { /* ignore */ }
}

export function getMobilityAssessments(athleteId, coachId = null) {
  return readKey(`${prefix(coachId, 'mobility')}_${athleteId}`);
}

// ─── Session helpers (existing) ────────────────────────────────────────────────

// Retorna las sesiones de los últimos `days` días, ordenadas de más antigua a más reciente
export function getRecentSessions(days = 28, coachId = null) {
  const result = [];
  try {
    const base = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const date    = d.toISOString().split('T')[0];
      const session = getSession(date, coachId);
      result.push({ date, load: avgSessionLoad(session) || 0 });
    }
  } catch { /* ignore */ }
  return result;
}
