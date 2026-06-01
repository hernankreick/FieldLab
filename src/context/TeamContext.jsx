import { createContext, useContext, useState } from 'react';
import { DEFAULT_TEAMS } from '../data/teams';

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const [teams, setTeams] = useState(() => {
    try {
      const saved = localStorage.getItem('fieldlab_teams');
      return saved ? JSON.parse(saved) : DEFAULT_TEAMS;
    } catch { return DEFAULT_TEAMS; }
  });

  const [activeTeamId, setActiveTeamId] = useState(() => {
    return localStorage.getItem('fieldlab_activeTeam') ?? DEFAULT_TEAMS[0].id;
  });

  const activeTeam = teams.find(t => t.id === activeTeamId) ?? teams[0];

  function switchTeam(teamId) {
    setActiveTeamId(teamId);
    localStorage.setItem('fieldlab_activeTeam', teamId);
  }

  function addTeam(team) {
    const updated = [...teams, team];
    setTeams(updated);
    localStorage.setItem('fieldlab_teams', JSON.stringify(updated));
  }

  function removeTeam(teamId) {
    if (teams.length <= 1) return;
    const updated = teams.filter(t => t.id !== teamId);
    setTeams(updated);
    localStorage.setItem('fieldlab_teams', JSON.stringify(updated));
    if (activeTeamId === teamId) switchTeam(updated[0].id);
  }

  return (
    <TeamContext.Provider value={{ teams, activeTeam, activeTeamId, switchTeam, addTeam, removeTeam }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used inside TeamProvider');
  return ctx;
}
