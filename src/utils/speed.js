import { getThresholds } from './thresholds';

// Sprint velocity
export function calcVelocity(distance, time) {
  if (!time || time === 0) return 0;
  return distance / time;
}

// Reference thresholds (seconds) — derived from dynamic baremos (default: football/senior/male)
// Keys kept as { safe, warning } for backward compatibility with sprintStatus()
function buildSprintRef(sport = 'football', category = 'senior', sex = 'male') {
  const t = getThresholds(sport, category, sex);
  return {
    sprint10: { safe: t.sprint10.green, warning: t.sprint10.yellow },
    sprint20: { safe: t.sprint20.green, warning: t.sprint20.yellow },
    sprint30: { safe: t.sprint30.green, warning: t.sprint30.yellow },
  };
}

export const sprintRef = buildSprintRef();

// Lower time = better performance
export function sprintStatus(time, ref) {
  if (!time || time === 0) return 'neutral';
  if (time <= ref.safe) return 'safe';
  if (time <= ref.warning) return 'warning';
  return 'danger';
}

// COD Deficit — Nimphius et al. 2016
export function calcCodDeficit(tCod, tSprint) {
  if (!tCod || !tSprint) return null;
  return parseFloat((tCod - tSprint).toFixed(3));
}

export function codDeficitType(deficit) {
  if (deficit === null) return null;
  return deficit > 0.3 ? 'Déficit Técnico' : 'Déficit de Potencia';
}

// Sprint Curvo asymmetry
export function calcCurvoAsim(der, izq) {
  if (!der || !izq || isNaN(der) || isNaN(izq)) return 0;
  return (Math.abs(der - izq) / Math.min(der, izq)) * 100;
}

export function curvoAsimStatus(asim) {
  if (asim < 3) return 'safe';
  if (asim <= 5) return 'warning';
  return 'danger';
}
