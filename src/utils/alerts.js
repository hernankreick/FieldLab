export const ALERT_TYPES = {
  ACWR_HIGH:        { id: 'acwr_high',        level: 'critical', label: 'Riesgo de Lesión'    },
  WELLNESS_MISSING: { id: 'wellness_missing', level: 'warning',  label: 'Wellness Incompleto' },
};

// Returns array of alerts for a single player
export function getPlayerAlerts(player, acwr, lastWellnessDate) {
  const alerts = [];

  if (acwr?.ratio > 1.5) {
    alerts.push({
      ...ALERT_TYPES.ACWR_HIGH,
      playerId:   player.id,
      playerName: player.name,
      message:    `ACWR ${acwr.ratio.toFixed(2)} — alto riesgo de lesión`,
      value:      acwr.ratio,
      timestamp:  new Date().toISOString(),
    });
  }

  if (lastWellnessDate) {
    const hoursAgo = (Date.now() - new Date(lastWellnessDate).getTime()) / 36e5;
    if (hoursAgo > 48) {
      alerts.push({
        ...ALERT_TYPES.WELLNESS_MISSING,
        playerId:   player.id,
        playerName: player.name,
        message:    `Sin reporte de wellness hace ${Math.floor(hoursAgo)}hs`,
        hoursAgo:   Math.floor(hoursAgo),
        timestamp:  new Date().toISOString(),
      });
    }
  } else {
    alerts.push({
      ...ALERT_TYPES.WELLNESS_MISSING,
      playerId:   player.id,
      playerName: player.name,
      message:    'Sin reporte de wellness registrado',
      hoursAgo:   null,
      timestamp:  new Date().toISOString(),
    });
  }

  return alerts;
}

// Returns all alerts for entire team, sorted critical first
export function getTeamAlerts(players, acwrMap, wellnessDateMap) {
  const all = players.flatMap(p =>
    getPlayerAlerts(p, acwrMap[p.id], wellnessDateMap[p.id])
  );
  return all.sort((a, b) =>
    (a.level === 'critical' ? 0 : 1) - (b.level === 'critical' ? 0 : 1)
  );
}

// Stub for future email integration (Supabase/Resend)
export async function sendEmailAlert(alert) {
  // TODO: POST to /api/alerts/email when Supabase is connected
  // await fetch('/api/alerts/email', { method: 'POST', body: JSON.stringify(alert) })
  console.warn('[FieldLab] Email alert queued (backend not connected):', alert);
}
