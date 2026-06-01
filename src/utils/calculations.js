// Player availability status derived from injury tag, Hooper soreness (d),
// composite Hooper score, and heatmap pain zones.
//
// hooper = { d: soreness(1–7), composite: Hooper Index total (4–28) }
// zonesActive = true when the athlete has any body zone marked in the heatmap

export function estadoReal(player, hooper, zonesActive = false) {
  if (player?.tag === 'LESIÓN')      return 'BAJA';
  if (!hooper)                       return 'DISPONIBLE';
  if (hooper.d >= 6)                 return 'BAJA';
  if (zonesActive && hooper.d >= 5)  return 'BAJA';
  if (hooper.composite > 24)         return 'PRECAUCIÓN';
  return 'DISPONIBLE';
}

// loads = daily load values oldest→newest (at least 1 element)
export function calcACWR(loads) {
  const λA = 2 / (7 + 1);
  const λC = 2 / (28 + 1);

  let ewmaAcute   = loads[0] || 0;
  let ewmaChronic = loads[0] || 0;

  for (let i = 1; i < loads.length; i++) {
    ewmaAcute   = λA * loads[i] + (1 - λA) * ewmaAcute;
    ewmaChronic = λC * loads[i] + (1 - λC) * ewmaChronic;
  }

  const ratio = ewmaChronic > 0 ? ewmaAcute / ewmaChronic : 0;
  const risk  = ratio < 0.8  ? 'undertrain'
              : ratio <= 1.3 ? 'optimal'
              : ratio <= 1.5 ? 'caution'
              : 'high';

  return { acute: ewmaAcute, chronic: ewmaChronic, ratio, risk };
}

// Yo-Yo IR1 — official VAM & VO2max lookup (Bangsbo et al.)
export function yoyoIR1(level) {
  const table = {
     5: { vam: 10.0, vo2max: 32.9 },
     6: { vam: 11.0, vo2max: 35.7 },
     7: { vam: 12.0, vo2max: 38.5 },
     8: { vam: 13.0, vo2max: 41.3 },
     9: { vam: 13.5, vo2max: 42.7 },
    10: { vam: 14.0, vo2max: 44.1 },
    11: { vam: 14.5, vo2max: 45.5 },
    12: { vam: 15.0, vo2max: 46.9 },
    13: { vam: 15.5, vo2max: 48.3 },
    14: { vam: 16.0, vo2max: 49.7 },
    15: { vam: 16.5, vo2max: 51.1 },
    16: { vam: 17.0, vo2max: 52.5 },
    17: { vam: 17.5, vo2max: 53.9 },
    18: { vam: 18.0, vo2max: 55.4 },
    19: { vam: 18.5, vo2max: 56.8 },
    20: { vam: 19.0, vo2max: 58.2 },
    21: { vam: 19.5, vo2max: 59.6 },
    22: { vam: 20.0, vo2max: 61.0 },
    23: { vam: 20.5, vo2max: 62.4 },
  };
  return table[level] ?? { vam: null, vo2max: null };
}

// Yo-Yo IR2 — official VAM & VO2max lookup (Bangsbo et al.)
export function yoyoIR2(level) {
  const table = {
    11: { vam: 15.0, vo2max: 40.2 },
    12: { vam: 15.5, vo2max: 42.0 },
    13: { vam: 16.0, vo2max: 43.8 },
    14: { vam: 16.5, vo2max: 45.6 },
    15: { vam: 17.0, vo2max: 47.4 },
    16: { vam: 17.5, vo2max: 49.2 },
    17: { vam: 18.0, vo2max: 51.0 },
    18: { vam: 18.5, vo2max: 52.8 },
    19: { vam: 19.0, vo2max: 54.6 },
    20: { vam: 19.5, vo2max: 56.4 },
    21: { vam: 20.0, vo2max: 58.2 },
    22: { vam: 20.5, vo2max: 60.0 },
    23: { vam: 21.0, vo2max: 61.8 },
  };
  return table[level] ?? { vam: null, vo2max: null };
}
