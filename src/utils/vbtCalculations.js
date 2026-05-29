// Mean propulsive velocity: average of upward-phase (positive) velocities
export function calcMPV(positions, timestamps) {
  if (positions.length < 2) return 0;
  const propulsive = [];
  for (let i = 1; i < positions.length; i++) {
    const dt = (timestamps[i] - timestamps[i - 1]) / 1000;
    if (dt <= 0) continue;
    const v = (positions[i] - positions[i - 1]) / dt;
    if (v > 0) propulsive.push(v);
  }
  if (propulsive.length === 0) return 0;
  return propulsive.reduce((a, b) => a + b, 0) / propulsive.length;
}

// Peak velocity: highest absolute instantaneous velocity in the rep
export function calcPeakVelocity(positions, timestamps) {
  if (positions.length < 2) return 0;
  let peak = 0;
  for (let i = 1; i < positions.length; i++) {
    const dt = (timestamps[i] - timestamps[i - 1]) / 1000;
    if (dt <= 0) continue;
    const v = Math.abs((positions[i] - positions[i - 1]) / dt);
    if (v > peak) peak = v;
  }
  return peak;
}

// Mean power output: P = F × v = (m × g) × mpv
export function calcPower(mpv, loadKg) {
  return loadKg * 9.81 * mpv;
}

// Fatigue index: percentage velocity drop from first to last rep
export function calcFatigueIndex(repVelocities) {
  if (repVelocities.length < 2) return 0;
  const first = repVelocities[0];
  const last  = repVelocities[repVelocities.length - 1];
  if (first === 0) return 0;
  return ((first - last) / first) * 100;
}

// Load zone classification by mean propulsive velocity
export function classifyLoad(mpv) {
  if (mpv > 1.30)  return 'Velocidad Pura';
  if (mpv >= 1.00) return 'Fuerza Velocidad';
  if (mpv >= 0.75) return 'Potencia';
  if (mpv >= 0.50) return 'Fuerza Hipertrofia';
  return 'Fuerza Máxima';
}

// Force-velocity profile: [{load, mpv}] array for plotting
export function buildFVProfile(sessions) {
  return sessions.map(s => ({ load: s.loadKg, mpv: s.mpv }));
}
