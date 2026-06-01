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
