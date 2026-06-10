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
// Requiere RLS policy que permita SELECT anónimo en players y teams por id.
export async function getPlayerWithCoach(playerId) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, team_id, teams(coach_id)')
    .eq('id', playerId)
    .single();
  if (error) throw error;
  return data; // { id, name, team_id, teams: { coach_id } }
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
  const { data } = await supabase
    .from('wellness')
    .select('*')
    .in('player_id', playerIds)
    .order('date', { ascending: false });
  const map = {};
  (data ?? []).forEach(r => {
    if (!map[r.player_id]) map[r.player_id] = mapWellness(r);
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
