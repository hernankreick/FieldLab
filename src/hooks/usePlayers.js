import { useState, useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import { getPlayers } from '../lib/db';

export function usePlayers() {
  const { activeTeam } = useTeam();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!activeTeam?.id) return;
    setLoading(true);
    setError(null);
    getPlayers(activeTeam.id)
      .then(data => { setPlayers(data ?? []); })
      .catch(err  => { setError(err); })
      .finally(() => { setLoading(false); });
  }, [activeTeam?.id]);

  return { players, loading, error };
}
