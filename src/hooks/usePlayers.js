import { useState, useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export function usePlayers() {
  const { activeTeam } = useTeam();
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!user) return;

    const teamId = activeTeam?.id;
    const hasRealTeamId = teamId && String(teamId).includes('-');

    setLoading(true);
    setError(null);
    setPlayers([]);

    // If we have a real team UUID, filter by it.
    // Otherwise rely on RLS: players_select policy returns only players whose
    // team_id belongs to the logged-in coach — no coach_id column needed.
    let query = supabase
      .from('players')
      .select('id, name, position, number, team_id')
      .order('name');

    if (hasRealTeamId) query = query.eq('team_id', teamId);

    query
      .then(({ data, error: sbError }) => {
        if (sbError) { setError(sbError); return; }
        setPlayers(data ?? []);
      })
      .finally(() => setLoading(false));
  }, [activeTeam?.id, user?.id]);

  return { players, loading, error };
}
