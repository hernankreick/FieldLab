import { useState } from 'react';
import { AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const h    = Math.floor(diff / 3_600_000);
  const m    = Math.floor(diff / 60_000);
  if (h >= 1) return `hace ${h}h`;
  if (m >= 1) return `hace ${m}m`;
  return 'ahora';
}

export default function AlertBanner({ alerts }) {
  const [open, setOpen] = useState(true);

  if (!alerts || alerts.length === 0) return null;

  const hasCritical = alerts.some(a => a.level === 'critical');

  const headerBg     = hasCritical ? 'bg-red-950'   : 'bg-amber-950';
  const headerBorder = hasCritical ? 'border-red-500' : 'border-amber-500';
  const headerText   = hasCritical ? 'text-red-400'  : 'text-amber-400';
  const criticalCount = alerts.filter(a => a.level === 'critical').length;

  return (
    <div className={`rounded-xl border ${headerBorder} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${headerBg} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className={headerText} />
          <span className={`text-sm font-bold ${headerText}`}>
            {alerts.length} {alerts.length === 1 ? 'alerta activa' : 'alertas activas'}
          </span>
          {criticalCount > 0 && (
            <span className="text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
              {criticalCount} crítica{criticalCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={15} className={headerText} />
          : <ChevronDown size={15} className={headerText} />
        }
      </button>

      {/* Alert rows */}
      <div
        className="transition-all duration-200 overflow-hidden"
        style={{ maxHeight: open ? '300px' : '0px' }}
      >
        <div className="overflow-y-auto" style={{ maxHeight: '300px' }}>
          {alerts.map((alert, idx) => {
            const isCritical  = alert.level === 'critical';
            const borderColor = isCritical ? 'border-red-500'   : 'border-amber-400';
            const Icon        = isCritical ? AlertTriangle       : Clock;
            const iconColor   = isCritical ? 'text-red-400'      : 'text-amber-400';

            return (
              <div
                key={`${alert.id}-${alert.playerId}-${idx}`}
                className={`flex items-start gap-3 px-4 py-3 border-l-4 ${borderColor}
                  border-b border-white/5 last:border-b-0 bg-slate-900`}
              >
                <Icon size={14} className={`${iconColor} mt-0.5 flex-shrink-0`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white leading-tight">{alert.playerName}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{alert.message}</p>
                </div>
                <span className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5">
                  {relTime(alert.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
