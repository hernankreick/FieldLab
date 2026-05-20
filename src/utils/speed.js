// Sprint velocity
export function calcVelocity(distance, time) {
  if (!time || time === 0) return 0;
  return distance / time;
}

// Reference thresholds (seconds) — team sports, male senior
export const sprintRef = {
  sprint10: { safe: 1.70, warning: 1.85 },
  sprint20: { safe: 2.90, warning: 3.10 },
  sprint30: { safe: 4.10, warning: 4.40 },
};

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
