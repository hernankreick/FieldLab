// LSI - Limb Symmetry Index
export function calcLSI(strong, weak) {
  if (!strong || strong === 0) return 0;
  return ((strong - weak) / strong) * 100;
}

export function lsiStatus(lsi) {
  if (lsi <= 8) return 'safe';
  if (lsi <= 15) return 'warning';
  return 'danger';
}

// ACWR - Acute:Chronic Workload Ratio
export function calcACWR(acute, chronic) {
  if (!chronic || chronic === 0) return 0;
  return acute / chronic;
}

export function acwrStatus(acwr) {
  if (acwr >= 0.8 && acwr <= 1.3) return 'safe';
  if (acwr > 1.3 && acwr <= 1.5) return 'warning';
  if (acwr > 1.5) return 'danger';
  // < 0.8: subentrenamiento, requiere monitoreo pero no es riesgo de lesión
  return 'warning';
}

// Bosco Battery
export function jumpHeightFromFlightTime(tv) {
  return (9.81 * tv * tv) / 8;
}

export function sayersPower(heightCm, massKg) {
  return 60.7 * heightCm + 45.3 * massKg - 2055;
}

export function calcRSI(heightM, contactTime) {
  if (!contactTime || contactTime === 0) return 0;
  return heightM / contactTime;
}

export function calcIUE(cmj, sj) {
  if (!sj || sj === 0) return 0;
  return ((cmj - sj) / sj) * 100;
}

export function iueStatus(iue) {
  if (iue >= 10 && iue <= 15) return 'safe';
  if (iue > 15) return 'warning';
  return 'danger';
}

// Hooper Wellness
export function hooperStatus(doms, sleep) {
  if (doms > 7 || sleep < 3) return 'danger';
  if (doms > 5 || sleep < 4) return 'warning';
  return 'safe';
}

// VBT
export function vbtDropoff(current, first) {
  if (!first || first === 0) return 0;
  return ((first - current) / first) * 100;
}
