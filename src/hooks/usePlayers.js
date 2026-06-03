import { useState, useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import { supabase } from '../lib/supabase';

export function usePlayers() {
  const { activeTeam } = useTeam();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    const teamId = activeTeam?.id;
    // Only query when we have a real Supabase UUID — skip fake defaults like 'primera', 'sub18'
    if (!teamId || !String(teamId).includes('-')) return;

    setLoading(true);
    setError(null);
    setPlayers([]);

    supabase
      .from('players')
      .select('id, name, position, number, team_id')
      .eq('team_id', teamId)
      .order('name')
      .then(({ data, error: sbError }) => {
        if (sbError) { setError(sbError); return; }
        setPlayers(data ?? []);
      })
      .finally(() => setLoading(false));
  }, [activeTeam?.id]);

  return { players, loading, error };
}
