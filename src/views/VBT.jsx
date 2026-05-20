import { useState } from 'react';
import { Eye, Plus, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import { vbtDropoff } from '../utils/biomechanics';

const DROPOFF_THRESHOLD = 20;

export default function VBT() {
  const [reps, setReps] = useState([
    { rep: 1, vmp: 0.82 },
    { rep: 2, vmp: 0.79 },
    { rep: 3, vmp: 0.74 },
  ]);
  const [input, setInput] = useState('');

  const firstVMP = reps[0]?.vmp ?? 0;
  const lastVMP  = reps[reps.length - 1]?.vmp ?? 0;
  const dropoff  = vbtDropoff(lastVMP, firstVMP);
  const cutSeries = dropoff >= DROPOFF_THRESHOLD;

  function addRep() {
    const v = parseFloat(input);
    if (isNaN(v)) return;
    setReps(prev => [...prev, { rep: prev.length + 1, vmp: v }]);
    setInput('');
  }

  function removeLastRep() {
    setReps(prev => prev.slice(0, -1));
  }

  function resetSeries() {
    setReps([]);
  }

  const status = cutSeries ? 'danger' : dropoff > 10 ? 'warning' : 'safe';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">VBT</h2>
        <p className="text-sm text-slate-400">Velocity Based Training · VMP tracking</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <MetricDisplay value={lastVMP.toFixed(2)} unit="m/s" label="VMP última rep" status={status} />
          <StatusBadge status={status} className="mt-2" label={cutSeries ? 'CORTAR SERIE' : status === 'warning' ? 'Monitorear' : 'Continuar'} />
        </Card>
        <Card>
          <MetricDisplay value={dropoff.toFixed(1)} unit="%" label="Caída VMP" status={status} />
          <p className="text-xs text-slate-500 mt-1">Umbral de corte: {DROPOFF_THRESHOLD}%</p>
        </Card>
      </div>

      {/* Gráfico */}
      <Card title="Serie actual" icon={Eye}>
        {reps.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={reps} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="rep" tickFormatter={v => `R${v}`} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}
                labelFormatter={v => `Rep ${v}`}
                formatter={v => [`${v} m/s`, 'VMP']}
                labelStyle={{ color: '#f8fafc' }}
                itemStyle={{ color: '#38bdf8' }}
              />
              {firstVMP > 0 && (
                <ReferenceLine
                  y={firstVMP * (1 - DROPOFF_THRESHOLD / 100)}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `-${DROPOFF_THRESHOLD}%`, fill: '#ef4444', fontSize: 10 }}
                />
              )}
              <Line type="monotone" dataKey="vmp" stroke="#38bdf8" strokeWidth={2} dot={{ fill: '#38bdf8', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-500 py-8 text-center">Sin repeticiones. Agregá la primera.</p>
        )}
      </Card>

      {/* Input */}
      <Card title="Registrar repetición">
        <div className="flex gap-3">
          <input
            type="number"
            step="0.01"
            placeholder="VMP (m/s)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRep()}
            className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2 text-sm font-data text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
          />
          <button
            onClick={addRep}
            className="flex items-center gap-1 px-4 py-2 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={removeLastRep}
            disabled={reps.length === 0}
            className="px-3 py-2 bg-surface border border-white/10 rounded-lg text-slate-400 hover:text-danger transition-colors disabled:opacity-30"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <button
          onClick={resetSeries}
          className="mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Nueva serie
        </button>
      </Card>

      {/* Log */}
      {reps.length > 0 && (
        <Card title="Log de repeticiones">
          <div className="space-y-1">
            {reps.map((r, i) => {
              const d = i === 0 ? 0 : vbtDropoff(r.vmp, firstVMP);
              const s = d >= DROPOFF_THRESHOLD ? 'danger' : d > 10 ? 'warning' : 'safe';
              return (
                <div key={i} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                  <span className="text-xs text-slate-400 font-data">Rep {r.rep}</span>
                  <span className="text-sm font-data font-bold text-slate-200">{r.vmp.toFixed(2)} m/s</span>
                  {i > 0 && <StatusBadge status={s} label={`-${d.toFixed(1)}%`} />}
                  {i === 0 && <span className="text-xs text-slate-500">baseline</span>}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
