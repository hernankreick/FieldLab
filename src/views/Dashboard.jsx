import { AlertTriangle, Users } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import QRGenerator from '../components/QRGenerator';
import { acwrStatus, lsiStatus } from '../utils/biomechanics';

const athletes = [
  { name: 'Ramiro S.',  acwr: 1.42, lsi: 6.2,  doms: 4, sleep: 4 },
  { name: 'Leandro M.', acwr: 1.61, lsi: 18.4, doms: 8, sleep: 3 },
  { name: 'Tomás R.',   acwr: 1.1,  lsi: 4.8,  doms: 2, sleep: 5 },
  { name: 'Facundo B.', acwr: 0.95, lsi: 11.2, doms: 5, sleep: 4 },
];

function athleteRisk(a) {
  if (a.acwr > 1.5 || a.lsi > 15 || a.doms > 7 || a.sleep < 3) return 'danger';
  if (a.acwr > 1.3 || a.lsi > 8  || a.doms > 5 || a.sleep < 4) return 'warning';
  return 'safe';
}

export default function Dashboard({ onNavigate }) {
  const alerts = athletes.filter(a => athleteRisk(a) === 'danger');
  const warnings = athletes.filter(a => athleteRisk(a) === 'warning');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">FieldLab</h1>
        <p className="text-sm text-slate-400">Alto rendimiento deportivo</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <MetricDisplay value={athletes.length} label="Atletas activos" status="neutral" />
        </Card>
        <Card>
          <MetricDisplay value={alerts.length} label="En riesgo" status={alerts.length > 0 ? 'danger' : 'safe'} />
        </Card>
        <Card>
          <MetricDisplay value={warnings.length} label="En alerta" status={warnings.length > 0 ? 'warning' : 'safe'} />
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card title="Alertas críticas" icon={AlertTriangle} className="border-danger/20">
          <div className="space-y-3">
            {alerts.map(a => (
              <div key={a.name} className="flex items-center justify-between">
                <span className="text-sm text-slate-200 font-medium">{a.name}</span>
                <div className="flex gap-2">
                  {acwrStatus(a.acwr) === 'danger' && <StatusBadge status="danger" label={`ACWR ${a.acwr.toFixed(2)}`} />}
                  {lsiStatus(a.lsi) === 'danger'   && <StatusBadge status="danger" label={`LSI ${a.lsi.toFixed(1)}%`} />}
                  {a.doms > 7  && <StatusBadge status="danger" label={`DOMS ${a.doms}`} />}
                  {a.sleep < 3 && <StatusBadge status="danger" label={`Sueño ${a.sleep}`} />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Roster overview */}
      <Card title="Estado del plantel" icon={Users}
        className="cursor-default"
        action={onNavigate && (
          <button
            onClick={() => onNavigate('wellness')}
            className="text-xs text-accent hover:text-accent/80 font-semibold transition-colors"
          >
            Ver Wellness →
          </button>
        )}
      >
        <div className="space-y-3">
          {athletes.map(a => {
            const risk = athleteRisk(a);
            return (
              <div key={a.name} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-200">{a.name}</p>
                  <p className="text-xs text-slate-500 font-data">ACWR {a.acwr.toFixed(2)} · LSI {a.lsi.toFixed(1)}%</p>
                </div>
                <StatusBadge status={risk} />
              </div>
            );
          })}
        </div>
      </Card>
      {/* QR para el formulario de wellness diario */}
      <QRGenerator teamId="team_001" teamName="Equipo" />
    </div>
  );
}
