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

// WELLNESS
export async function getWellness(playerId, days = 7) {
  const { data, error } = await supabase
    .from('wellness').select('*').eq('player_id', playerId)
    .order('date', { ascending: false }).limit(days);
  if (error) throw error;
  return data;
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
    .order('date', { ascending: false });
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
