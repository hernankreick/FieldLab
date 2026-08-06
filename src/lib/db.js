import { supabase } from './supabase';

// TEAMS
export async function getTeams(coachId) {
  const { data, error } = await supabase
    .from('teams').select('*').eq('coach_id', coachId).order('created_at');
  if (error) throw error;
  return data;
}

export async function createTeam(team) {
  const { data, error } = await supabase
    .from('teams').insert(team).select().single();
  if (error) throw error;
  return data;
}

// PLAYERS
export async function getPlayers(teamId) {
  const { data, error } = await supabase
    .from('players').select('*').eq('team_id', teamId).order('name');
  if (error) throw error;
  return data;
}

export async function createPlayer(player) {
  const { data, error } = await supabase
    .from('players').insert(player).select().single();
  if (error) throw error;
  return data;
}

// Lookup de jugador + coach_id para formularios públicos QR (sin sesión auth).
// Vía RPC SECURITY DEFINER (qr_resolve_coach) en vez de SELECT anónimo directo:
// solo devuelve el coach_id del player_id puntual, no expone el resto de la tabla.
export async function getPlayerWithCoach(playerId) {
  const { data, error } = await supabase
    .rpc('qr_resolve_coach', { p_player_id: playerId })
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Player not found');
  return { id: data.player_id, team_id: data.team_id, teams: { coach_id: data.coach_id } };
}

// Roster de un equipo para el selector de jugador en formularios QR anónimos.
// Vía RPC (qr_team_roster) en vez de SELECT anónimo directo sobre players.
export async function getTeamRosterPublic(teamId) {
  const { data, error } = await supabase.rpc('qr_team_roster', { p_team_id: teamId });
  if (error) throw error;
  return data ?? [];
}

// WELLNESS
function mapWellness(r) {
  return {
    ...r,
    score:       r.score ?? r.composite ?? 0,
    timestamp:   r.date ? new Date(r.date + 'T12:00:00').getTime() : Date.now(),
    activeZones: r.active_zones ?? {},
  };
}

export async function getWellness(playerId, days = 7) {
  const { data, error } = await supabase
    .from('wellness').select('*').eq('player_id', playerId)
    .order('date', { ascending: false }).limit(days);
  if (error) throw error;
  return (data ?? []).map(mapWellness);
}

export async function getLatestTeamWellness(playerIds) {
  if (!playerIds?.length) return {};
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceStr = since.toISOString().split('T')[0];
  const { data } = await supabase
    .from('wellness')
    .select('*')
    .in('player_id', playerIds)
    .gte('date', sinceStr)
    .order('date', { ascending: false });
  const map = {};
  (data ?? []).forEach(r => {
    if (!map[r.player_id]) map[r.player_id] = mapWellness(r);
  });
  return map;
}

export async function getLoadsBatch(playerIds, days = 28) {
  if (!playerIds?.length) return {};
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().split('T')[0];
  const { data } = await supabase
    .from('loads')
    .select('player_id, date, value')
    .in('player_id', playerIds)
    .gte('date', sinceStr)
    .order('date', { ascending: true });
  const map = {};
  (data ?? []).forEach(r => {
    if (!map[r.player_id]) map[r.player_id] = [];
    map[r.player_id].push({ date: r.date, value: r.value });
  });
  return map;
}

export async function saveWellness(entry) {
  const { data, error } = await supabase
    .from('wellness').upsert(entry, { onConflict: 'player_id,date' })
    .select().single();
  if (error) throw error;
  return data;
}

// Para formularios QR anónimos: INSERT puro sin upsert.
// El rol anon no tiene policy UPDATE en wellness, por lo que upsert fallaría
// al intentar sobreescribir un registro existente del mismo día.
// Un duplicado (23505) se trata como éxito — el jugador ya reportó hoy.
export async function saveWellnessPublic(entry) {
  const { error } = await supabase.from('wellness').insert(entry);
  if (error && error.code !== '23505') throw error;
}

// EVALUATIONS
export async function getEvaluations(playerId) {
  const { data, error } = await supabase
    .from('evaluations').select('*').eq('player_id', playerId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveEvaluation(evaluation) {
  const { data, error } = await supabase
    .from('evaluations').insert(evaluation).select().single();
  if (error) throw error;
  return data;
}

// LOADS
export async function getLoads(playerId, days = 28) {
  const { data, error } = await supabase
    .from('loads').select('*').eq('player_id', playerId)
    .order('date', { ascending: false }).limit(days);
  if (error) throw error;
  return data;
}

export async function saveLoad(load) {
  const { data, error } = await supabase
    .from('loads').insert(load).select().single();
  if (error) throw error;
  return data;
}
