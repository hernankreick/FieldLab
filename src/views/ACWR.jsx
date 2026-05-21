import { useState, useEffect } from 'react';
import { BarChart2, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import { calcACWR, acwrStatus } from '../utils/biomechanics';
import { getRecentSessions } from '../utils/storage';

const mockHistory = [
  { day: 'L', load: 420 }, { day: 'M', load: 380 }, { day: 'X', load: 510 },
  { day: 'J', load: 290 }, { day: 'V', load: 600 }, { day: 'S', load: 450 },
  { day: 'D', load: 0   },
];

const mockChronic = 420;

export default function ACWR() {
  const [loads,   setLoads]   = useState(mockHistory);
  const [chronic, setChronic] = useState(mockChronic);
  const [input, setInput] = useState('');

  // Carga sesiones reales desde localStorage; actualiza cada 30 s o ante cambios
  useEffect(() => {
    function loadSessions() {
      const sessions = getRecentSessions(28);
      if (!sessions.some(s => s.load > 0)) return; // sin datos reales, usar mock
      const last7      = sessions.slice(-7);
      const chronicAvg = sessions.reduce((s, d) => s + d.load, 0) / 28;
      const DAYS       = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
      setChronic(chronicAvg || mockChronic);
      setLoads(last7.map(s => ({
        day:  DAYS[new Date(s.date + 'T12:00:00').getDay()],
        load: Math.round(s.load),
      })));
    }
    loadSessions();
    const iv = setInterval(loadSessions, 30_000);
    window.addEventListener('storage', loadSessions);
    return () => { clearInterval(iv); window.removeEventListener('storage', loadSessions); };
  }, []);

  const acute = loads.reduce((s, d) => s + d.load, 0) / 7;
  const acwr = calcACWR(acute, chronic);
  const status = acwrStatus(acwr);

  function addLoad() {
    const val = parseFloat(input);
    if (isNaN(val)) return;
    setLoads(prev => {
      const next = [...prev.slice(1), { day: 'Hoy', load: val }];
      return next;
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
            value={acwr.toFixed(2)}
            label="ACWR actual"
            status={status}
          />
          <StatusBadge status={status} className="mt-2" />
        </Card>
        <Card>
          <MetricDisplay value={Math.round(acute)} unit="UA" label="Carga aguda (7d)" status="neutral" />
          <MetricDisplay value={Math.round(chronic)} unit="UA" label="Crónica (28d)" status="neutral" className="mt-2" />
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
            <ReferenceLine y={chronic * 1.3} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '1.3x', fill: '#f59e0b', fontSize: 10 }} />
            <ReferenceLine y={chronic * 1.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '1.5x', fill: '#ef4444', fontSize: 10 }} />
            <Area type="monotone" dataKey="load" stroke="#38bdf8" strokeWidth={2} fill="url(#loadGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Input de carga */}
      <Card title="Registrar sesión">
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
            Agregar
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Sweet spot: 0.8 – 1.3 · Danger zone: &gt; 1.5</p>
      </Card>
    </div>
  );
}
