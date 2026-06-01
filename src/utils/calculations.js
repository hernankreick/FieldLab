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
