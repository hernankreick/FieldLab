import { useState, useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import { supabase } from '../lib/supabase';

export function usePlayers() {
  const { activeTeam } = useTeam();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const teamId = activeTeam?.id;
    if (!teamId || !String(teamId).includes('-')) return;

    setLoading(true);
    setPlayers([]);

    supabase
      .from('players')
      .select('id, name, position, number, team_id')
      .eq('team_id', teamId)
      .order('name')
      .then(({ data }) => setPlayers(data ?? []))
      .finally(() => setLoading(false));
  }, [activeTeam?.id]);

  return { players, loading };
}
