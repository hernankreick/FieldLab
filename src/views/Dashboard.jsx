import { useState, useEffect } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import QRGenerator from '../components/QRGenerator';
import { acwrStatus, lsiStatus } from '../utils/biomechanics';
import { getAllLatestWellness, clearOldRecords } from '../utils/storage';

const BASE_ATHLETES = [
  { id: 1, name: 'Ramiro S.',    acwr: 1.42, lsi: 6.2  },
  { id: 2, name: 'Leandro M.',   acwr: 1.61, lsi: 18.4 },
  { id: 3, name: 'Tomás R.',     acwr: 1.1,  lsi: 4.8  },
  { id: 4, name: 'Facundo B.',   acwr: 0.95, lsi: 11.2 },
  { id: 5, name: 'Agustín T.',   acwr: 1.05, lsi: 5.0  },
  { id: 6, name: 'Lucía F.',     acwr: 0.88, lsi: 7.3  },
  { id: 7, name: 'Valentina L.', acwr: 1.22, lsi: 9.8  },
  { id: 8, name: 'Martín G.',    acwr: 1.35, lsi: 6.1  },
];

const DOT_COLOR = { danger: '#ef4444', warning: '#f59e0b', safe: '#22c55e' };

function wellnessRisk(w) {
  if (!w) return null;
  if (w.score > 18) return 'danger';
  if (w.score > 12) return 'warning';
  return 'safe';
}

function athleteRisk(a, w) {
  const loadRisk = a.acwr > 1.5 || a.lsi > 15 ? 'danger'
                 : a.acwr > 1.3 || a.lsi > 8   ? 'warning'
                 : 'safe';
  const wr = wellnessRisk(w);
  if (loadRisk === 'danger' || wr === 'danger')   return 'danger';
  if (loadRisk === 'warning' || wr === 'warning') return 'warning';
  return 'safe';
}

function acwrColor(v) {
  return v > 1.5 ? '#ef4444' : v > 1.3 ? '#f59e0b' : '#22c55e';
}

function isToday(timestamp) {
  return new Date(timestamp).toDateString() === new Date().toDateString();
}

export default function Dashboard({ onNavigate }) {
  const [wellnessMap, setWellnessMap] = useState({});

  useEffect(() => {
    clearOldRecords();
    const loadData = () => setWellnessMap(getAllLatestWellness());
    loadData();
    const iv = setInterval(loadData, 30_000);
    window.addEventListener('storage', loadData);
    return () => { clearInterval(iv); window.removeEventListener('storage', loadData); };
  }, []);

  const athletes = BASE_ATHLETES.map(a => ({
    ...a,
    w: wellnessMap[String(a.id)] ?? null,
  }));

  const todayCount    = athletes.filter(a => a.w && isToday(a.w.timestamp)).length;
  const noReportCount = athletes.length - todayCount;
  const alerts        = athletes.filter(a => athleteRisk(a, a.w) === 'danger');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">FieldLab</h1>
        <p className="text-sm text-slate-400">Alto rendimiento deportivo</p>
      </div>

      {/* KPI strip — 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <MetricDisplay value={athletes.length} label="Atletas" status="neutral" />
        </Card>
        <Card>
          <MetricDisplay value={alerts.length} label="En riesgo"
            status={alerts.length > 0 ? 'danger' : 'safe'} />
        </Card>
        <Card>
          <MetricDisplay value={todayCount} label="Reportaron hoy"
            status={todayCount === athletes.length ? 'safe' : todayCount > 0 ? 'warning' : 'neutral'} />
        </Card>
        <Card>
          <MetricDisplay value={noReportCount} label="Sin reporte"
            status={noReportCount > 0 ? 'warning' : 'safe'} />
        </Card>
      </div>

      {/* Alertas críticas */}
      {alerts.length > 0 && (
        <Card title="Alertas críticas" icon={AlertTriangle} className="border-danger/20">
          <div className="space-y-3">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium">{a.name}</span>
                <div className="flex gap-2 flex-wrap justify-end">
                  {acwrStatus(a.acwr) === 'danger' &&
                    <StatusBadge status="danger" label={`ACWR ${a.acwr.toFixed(2)}`} />}
                  {lsiStatus(a.lsi) === 'danger' &&
                    <StatusBadge status="danger" label={`LSI ${a.lsi.toFixed(1)}%`} />}
                  {a.w?.score > 18 &&
                    <StatusBadge status="danger" label={`Hooper ${a.w.score}`} />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Estado del plantel */}
      <Card title="Estado del plantel" icon={Users}
        action={onNavigate && (
          <button
            onClick={() => onNavigate('wellness')}
            className="text-xs text-accent hover:text-accent/80 font-semibold transition-colors"
          >
            Ver Wellness →
          </button>
        )}
      >
        <div className="space-y-0">
          {athletes.map(a => {
            const risk     = athleteRisk(a, a.w);
            const hasToday = a.w && isToday(a.w.timestamp);
            return (
              <button
                key={a.id}
                onClick={() => onNavigate?.('wellness', a.id)}
                className="w-full flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg
                  border-b border-white/5 last:border-0 hover:bg-white/[0.04]
                  active:bg-white/[0.07] transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{a.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs font-data" style={{ color: acwrColor(a.acwr) }}>
                      ACWR {a.acwr.toFixed(2)}
                    </span>
                    <span className="text-slate-600 text-xs">·</span>
                    {hasToday
                      ? <span className="text-xs text-slate-400 font-data">Hooper {a.w.score}</span>
                      : <span className="text-xs text-slate-600">Sin reporte</span>
                    }
                  </div>
                </div>
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 ml-3"
                  style={{ background: hasToday ? DOT_COLOR[risk] : '#475569' }}
                />
              </button>
            );
          })}
        </div>
      </Card>

      {/* QR para el formulario de wellness diario */}
      <QRGenerator teamId="team_001" teamName="Equipo" />
    </div>
  );
}
