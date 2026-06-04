import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function usePlayers() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    async function fetchPlayers() {
      setLoading(true);

      const { data: teams } = await supabase
        .from('teams')
        .select('id')
        .eq('coach_id', user.id);

      if (!teams?.length) {
        setLoading(false);
        return;
      }

      const teamIds = teams.map(t => t.id);

      const { data } = await supabase
        .from('players')
        .select('id, name, position, number, team_id')
        .in('team_id', teamIds)
        .order('name');

      setPlayers(data || []);
      setLoading(false);
    }

    fetchPlayers();
  }, [user?.id]);

  return { players, loading };
}
