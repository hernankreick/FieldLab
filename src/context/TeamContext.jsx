import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { getTeams, createTeam } from '../lib/db';

const DEFAULT_TEAMS = [
  { id: 'primera', name: 'Primera División', sport: 'football', category: 'senior', sex: 'male', color: '#3b82f6' },
  { id: 'sub18',   name: 'Sub 18',           sport: 'football', category: 'sub18',  sex: 'male', color: '#8b5cf6' },
];

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const { coach } = useAuth();
  const [teams, setTeams] = useState(DEFAULT_TEAMS);
  const [activeTeamId, setActiveTeamId] = useState(
    () => localStorage.getItem('fieldlab_active_team') ?? DEFAULT_TEAMS[0].id
  );

  useEffect(() => {
    if (!coach?.id) return;
    getTeams(coach.id)
      .then(async rows => {
        if (rows && rows.length > 0) {
          setTeams(rows);
          setActiveTeamId(prev =>
            rows.find(t => t.id === prev) ? prev : rows[0].id
          );
        }
      })
      .catch(() => { /* keep DEFAULT_TEAMS */ });
  }, [coach?.id]);

  const activeTeam = teams.find(t => t.id === activeTeamId) ?? teams[0];

  function switchTeam(id) {
    setActiveTeamId(id);
    localStorage.setItem('fieldlab_active_team', id);
  }

  async function addTeam(teamData) {
    if (!coach?.id) return null;
    try {
      const newTeam = await createTeam({ ...teamData, coach_id: coach.id });
      setTeams(prev => [...prev, newTeam]);
      return newTeam;
    } catch {
      const local = { ...teamData, id: `local_${Date.now()}` };
      setTeams(prev => [...prev, local]);
      return local;
    }
  }

  function removeTeam(id) {
    setTeams(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(t => t.id !== id);
      if (activeTeamId === id) switchTeam(next[0].id);
      return next;
    });
  }

  return (
    <TeamContext.Provider value={{ teams, activeTeam, switchTeam, addTeam, removeTeam }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used inside TeamProvider');
  return ctx;
}
