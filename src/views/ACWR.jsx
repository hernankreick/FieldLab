import { useState, useEffect, useCallback } from 'react';
import { BarChart2, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import { calcACWR } from '../utils/calculations';
import { acwrStatus } from '../utils/biomechanics';
import { supabase } from '../lib/supabase';
import { usePlayers } from '../hooks/usePlayers';

const MOCK_HISTORY = [
  { day: 'L', load: 420 }, { day: 'M', load: 380 }, { day: 'X', load: 510 },
  { day: 'J', load: 290 }, { day: 'V', load: 600 }, { day: 'S', load: 450 },
  { day: 'D', load: 0   },
];
const MOCK_CHRONIC = 420;
const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function dateMinusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export default function ACWR() {
  const { players } = usePlayers();
  const [loads,     setLoads]     = useState(MOCK_HISTORY);
  const [fullLoads, setFullLoads] = useState(null); // 28 valores oldest→newest para EWMA
  const [input,     setInput]     = useState('');

  const loadFromSupabase = useCallback(async () => {
    if (!players.length) return;
    const playerIds = players.map(p => p.id);
    const since = dateMinusDays(27);

    const { data } = await supabase
      .from('loads')
      .select('date, value, player_id')
      .in('player_id', playerIds)
      .gte('date', since)
      .gt('value', 0)
      .order('date', { ascending: true });

    if (!data || data.length === 0) return;

    // Agrupa por fecha: promedio de cargas del plantel ese día
    const byDate = {};
    data.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(Number(r.value));
    });

    const dailyAvg = Array.from({ length: 28 }, (_, i) => {
      const date = dateMinusDays(27 - i);
      const vals  = byDate[date] ?? [];
      return { date, load: vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0 };
    });

    if (!dailyAvg.some(d => d.load > 0)) return;

    const last7 = dailyAvg.slice(-7).map(d => ({
      day:  DAYS[new Date(d.date + 'T12:00:00').getDay()],
      load: Math.round(d.load),
    }));

    setFullLoads(dailyAvg.map(d => d.load));
    setLoads(last7);
  }, [players]);

  useEffect(() => {
    loadFromSupabase();
    const iv = setInterval(loadFromSupabase, 30_000);
    return () => clearInterval(iv);
  }, [loadFromSupabase]);

  const acwrCalc = calcACWR(fullLoads ?? Array(28).fill(MOCK_CHRONIC));
  const status   = acwrStatus(acwrCalc.ratio);

  function addLoad() {
    const val = parseFloat(input);
    if (isNaN(val)) return;
    setLoads(prev => [...prev.slice(1), { day: 'Hoy', load: val }]);
    setFullLoads(prev => {
      const arr = prev ?? Array(28).fill(MOCK_CHRONIC);
      return [...arr.slice(1), val];
    });
    setInput('');
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Control de Carga</h2>
        <p className="text-sm text-slate-400">ACWR · Acute:Chronic Workload Ratio</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <MetricDisplay
            value={acwrCalc.ratio.toFixed(2)}
            label="ACWR actual"
            status={status}
          />
          <StatusBadge status={status} className="mt-2" />
        </Card>
        <Card>
          <MetricDisplay value={Math.round(acwrCalc.acute)} unit="UA" label="Carga aguda (7d)" status="neutral" />
          <MetricDisplay value={Math.round(acwrCalc.chronic)} unit="UA" label="Crónica (28d)" status="neutral" className="mt-2" />
        </Card>
      </div>

      {/* Zona de referencia */}
      <Card title="Carga semanal" icon={BarChart2}>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={loads} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}
              labelStyle={{ color: '#f8fafc' }}
              itemStyle={{ color: '#38bdf8' }}
            />
            <ReferenceLine y={acwrCalc.chronic * 1.3} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '1.3x', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine y={acwrCalc.chronic * 1.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '1.5x', fill: '#ef4444', fontSize: 10 }} />
            <Area type="monotone" dataKey="load" stroke="#38bdf8" strokeWidth={2} fill="url(#loadGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Simulación de carga */}
      <Card title="Simular sesión">
        <div className="flex gap-3">
          <input
            type="number"
            placeholder="Unidades de carga (UA)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addLoad()}
            className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
          />
          <button
            onClick={addLoad}
            className="flex items-center gap-1 px-4 py-2 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            <Plus size={14} />
            Simular
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Simulación local · Sweet spot: 0.8 – 1.3 · Danger zone: &gt; 1.5</p>
      </Card>
    </div>
  );
}
