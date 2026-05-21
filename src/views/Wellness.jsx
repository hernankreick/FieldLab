import { useState } from 'react';
import { Heart, Map } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import BodyHeatmapSimple from '../components/BodyHeatmapSimple';
import { hooperStatus } from '../utils/biomechanics';

const athletes = ['Ramiro S.', 'Leandro M.', 'Tomás R.', 'Facundo B.'];

const defaultWellness = {
  'Ramiro S.':  { doms: 4, sleep: 4, fatigue: 3, stress: 3 },
  'Leandro M.': { doms: 8, sleep: 2, fatigue: 7, stress: 5 },
  'Tomás R.':   { doms: 2, sleep: 5, fatigue: 2, stress: 2 },
  'Facundo B.': { doms: 5, sleep: 4, fatigue: 4, stress: 3 },
};

function hooperScore(w) {
  return w.doms + (5 - w.sleep) + w.fatigue + w.stress;
}

const SLIDER_CONFIG = [
  { key: 'doms',    label: 'Dolor (DOMS)',  min: 0, max: 10 },
  { key: 'sleep',   label: 'Calidad sueño', min: 1, max: 5  },
  { key: 'fatigue', label: 'Fatiga',        min: 0, max: 10 },
  { key: 'stress',  label: 'Estrés',        min: 0, max: 10 },
];

const sliderColor = { safe: '#22c55e', warning: '#f59e0b', danger: '#ef4444' };
const HEATMAP_LEVELS = ['normal', 'leve', 'moderado', 'alto', 'muy_alto'];
const defaultHeatmap = Object.fromEntries(athletes.map(n => [n, {}]));

export default function Wellness() {
  const [wellness, setWellness] = useState(defaultWellness);
  const [selected, setSelected] = useState(athletes[0]);
  const [heatmapZones, setHeatmapZones] = useState(defaultHeatmap);

  function handleZoneSelect(id) {
    setHeatmapZones(prev => {
      const cur = prev[selected][id] || 'normal';
      const next = HEATMAP_LEVELS[(HEATMAP_LEVELS.indexOf(cur) + 1) % HEATMAP_LEVELS.length];
      return { ...prev, [selected]: { ...prev[selected], [id]: next } };
    });
  }

  const w = wellness[selected];
  const status = hooperStatus(w.doms, w.sleep);
  const score = hooperScore(w);

  function update(key, val) {
    setWellness(prev => ({
      ...prev,
      [selected]: { ...prev[selected], [key]: parseInt(val) },
    }));
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Wellness · Hooper</h2>
        <p className="text-sm text-slate-400">Monitoreo subjetivo pre-sesión</p>
      </div>

      {/* Selector atleta */}
      <div className="flex gap-2 flex-wrap">
        {athletes.map(name => {
          const s = hooperStatus(wellness[name].doms, wellness[name].sleep);
          return (
            <button
              key={name}
              onClick={() => setSelected(name)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                selected === name
                  ? 'bg-accent text-background border-accent'
                  : 'bg-surface text-slate-400 border-white/10 hover:text-slate-200'
              }`}
            >
              {name}
              {s !== 'safe' && (
                <span className={`ml-1.5 w-1.5 h-1.5 rounded-full inline-block ${s === 'danger' ? 'bg-danger' : 'bg-warning'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Score global */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <MetricDisplay value={score} label="Índice Hooper" status={status} />
            <p className="text-xs text-slate-500 mt-1">Umbral crítico: DOMS {'>'} 7 o Sueño {'<'} 3</p>
          </div>
          <StatusBadge status={status} label={status === 'danger' ? 'PRECAUCIÓN' : status === 'warning' ? 'Monitorear' : 'Listo'} />
        </div>
      </Card>

      {/* Sliders */}
      <Card title="Parámetros" icon={Heart}>
        <div className="space-y-5">
          {SLIDER_CONFIG.map(({ key, label, min, max }) => (
            <div key={key}>
              <div className="flex justify-between mb-1.5">
                <span className="text-xs text-slate-400">{label}</span>
                <span className={`text-xs font-data font-bold`} style={{ color: sliderColor[status] }}>
                  {w[key]}{key === 'sleep' ? '/5' : '/10'}
                </span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                value={w[key]}
                onChange={e => update(key, e.target.value)}
                className="w-full h-1.5 rounded-full appearance-none bg-white/10 accent-accent cursor-pointer"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Mapa de calor */}
      <Card title="Mapa de dolor muscular" icon={Map}>
        <p className="text-xs text-slate-500 mb-4">Tocá una zona para ciclar entre niveles de dolor.</p>
        <BodyHeatmapSimple
          selectedZones={heatmapZones[selected]}
          onSelectZone={handleZoneSelect}
          interactive={true}
        />
      </Card>

      {/* Resumen plantel */}
      <Card title="Estado plantel">
        <div className="space-y-2">
          {athletes.map(name => {
            const s = hooperStatus(wellness[name].doms, wellness[name].sleep);
            return (
              <div key={name} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-200">{name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-data text-slate-500">
                    DOMS {wellness[name].doms} · Sueño {wellness[name].sleep}/5
                  </span>
                  <StatusBadge status={s} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
