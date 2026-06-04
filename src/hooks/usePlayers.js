import { useState, useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import { supabase } from '../lib/supabase';

export function usePlayers() {
  const { activeTeam } = useTeam();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [debugState, setDebugState] = useState({ teamId: null, error: null, count: null });

  useEffect(() => {
    const teamId = activeTeam?.id;
    setDebugState(d => ({ ...d, teamId: teamId ?? 'undefined' }));

    if (!teamId || !String(teamId).includes('-')) return;

    setLoading(true);
    setPlayers([]);

    supabase
      .from('players')
      .select('id, name, position, team_id')
      .eq('team_id', teamId)
      .order('name')
      .then(({ data, error }) => {
        setDebugState({ teamId, error: error?.message ?? null, count: data?.length ?? 0 });
        if (error) return;
        setPlayers(data ?? []);
      })
      .finally(() => setLoading(false));
  }, [activeTeam?.id]);

  return { players, loading, debugState };
}
