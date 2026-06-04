import { useState, useEffect } from 'react';
import {
  ArrowLeft, Heart, Zap, ClipboardList, Activity, Footprints,
  ChevronDown, ChevronUp, Save, Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ReportButton from '../components/ReportButton';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import Card from '../components/Card';
import ResultCard from '../components/ResultCard';
import StatusBadge from '../components/StatusBadge';
import BodyHeatmapSimple from '../components/BodyHeatmapSimple';
import { cn } from '../utils/cn';
import { PLAYERS } from '../data/players';
import { getMetricStatus } from '../utils/thresholds';
import { saveEvaluation, getEvaluations, getWellness } from '../lib/db';
import { supabase } from '../lib/supabase';
import { usePlayers } from '../hooks/usePlayers';

// ── Helpers ──────────────────────────────────────────────────────────────────

function heightColor(cm) {
  if (cm >= 40) return '#22c55e';
  if (cm >= 25) return '#f59e0b';
  return '#ef4444';
}

function isToday(ts) {
  return new Date(ts).toDateString() === new Date().toDateString();
}

function formatDate(ts) {
  if (!ts) return '—';
  const d         = new Date(ts);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function acwrColor(v) {
  if (v > 1.5) return '#ef4444';
  if (v > 1.3) return '#f59e0b';
  if (v < 0.8) return '#f59e0b';
  return '#22c55e';
}

function acwrZone(v) {
  if (v > 1.5) return 'Peligro';
  if (v > 1.3) return 'Precaución';
  if (v < 0.8) return 'Subtrabajado';
  return 'Óptimo';
}

function acwrSt(v) {
  if (v > 1.5) return 'danger';
  if (v > 1.3 || v < 0.8) return 'warning';
  return 'safe';
}

function hooperSt(score) {
  if (score > 18) return 'danger';
  if (score > 12) return 'warning';
  return 'safe';
}

function playerRisk(player, latestWellness) {
  const w        = latestWellness && isToday(latestWellness.timestamp) ? latestWellness : null;
  const loadRisk = player.acwr > 1.5 || player.lsi > 15 ? 'danger'
                 : player.acwr > 1.3 || player.lsi > 8   ? 'warning'
                 : 'safe';
  const wellRisk = w ? (w.score > 18 ? 'danger' : w.score > 12 ? 'warning' : 'safe') : null;
  if (loadRisk === 'danger' || wellRisk === 'danger')   return 'danger';
  if (loadRisk === 'warning' || wellRisk === 'warning') return 'warning';
  return 'safe';
}

// ── Barra ACWR con zonas y marcador ─────────────────────────────────────────

function AcwrBar({ value }) {
  const clamped = Math.min(Math.max(value, 0), 2.0);
  const color   = acwrColor(value);
  const W = 200, barY = 30, barH = 12;
  const mx  = (clamped / 2.0) * W;
  const tmx = Math.min(Math.max(mx, 5), W - 5);
  const lx  = Math.min(Math.max(mx, 18), W - 18);

  const zones = [
    { from: 0,   to: 0.8, fill: '#334155' },
    { from: 0.8, to: 1.3, fill: '#22c55e' },
    { from: 1.3, to: 1.5, fill: '#f59e0b' },
    { from: 1.5, to: 2.0, fill: '#ef4444' },
  ];

  const zoneLabels = [
    { label: 'Sub',     cx: (0.4  / 2) * W },
    { label: 'Óptimo',  cx: (1.05 / 2) * W },
    { label: 'Prec.',   cx: (1.4  / 2) * W },
    { label: 'Peligro', cx: (1.75 / 2) * W },
  ];

  return (
    <svg viewBox={`0 0 ${W} 62`} className="w-full">
      <defs>
        <clipPath id="acwrBarClip">
          <rect x="0" y={barY} width={W} height={barH} rx={barH / 2} />
        </clipPath>
      </defs>
      <g clipPath="url(#acwrBarClip)">
        {zones.map(({ from, to, fill }) => (
          <rect key={from}
            x={(from / 2.0) * W} y={barY}
            width={((to - from) / 2.0) * W} height={barH}
            fill={fill}
          />
        ))}
      </g>
      {[0.8, 1.3, 1.5].map(v => {
        const tx = (v / 2.0) * W;
        return (
          <line key={v} x1={tx} y1={barY} x2={tx} y2={barY + barH}
            stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
        );
      })}
      <polygon
        points={`${tmx},${barY} ${tmx - 5},${barY - 9} ${tmx + 5},${barY - 9}`}
        fill={color}
      />
      <text x={lx} y={barY - 12} textAnchor="middle"
        fontSize="12" fontWeight="700" fill={color}
        fontFamily="ui-monospace,monospace">
        {value.toFixed(2)}
      </text>
      {zoneLabels.map(({ label, cx }) => (
        <text key={label} x={cx} y={barY + barH + 14}
          textAnchor="middle" fontSize="8" fill="#64748b">
          {label}
        </text>
      ))}
    </svg>
  );
}

// ── Labels Hooper ────────────────────────────────────────────────────────────

const HOOPER_LABELS = {
  sleep:    ['', 'Pésimo', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'],
  stress:   ['', 'Sin estrés', 'Muy leve', 'Leve', 'Moderado', 'Alto', 'Muy alto', 'Extremo'],
  fatigue:  ['', 'Sin fatiga', 'Muy leve', 'Leve', 'Moderada', 'Alta', 'Muy alta', 'Extrema'],
  soreness: ['', 'Sin dolor', 'Muy leve', 'Leve', 'Moderado', 'Alto', 'Muy alto', 'Extremo'],
};

const HOOPER_META = [
  { key: 'sleep',    label: 'Sueño',  emoji: '😴' },
  { key: 'stress',   label: 'Estrés', emoji: '😤' },
  { key: 'fatigue',  label: 'Fatiga', emoji: '🔋' },
  { key: 'soreness', label: 'Dolor',  emoji: '🤕' },
];

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem',
  },
  labelStyle: { color: '#f8fafc' },
  itemStyle:  { color: '#38bdf8' },
};

const DAYS_ES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

// ── Mobility helpers ─────────────────────────────────────────────────────────

const MOBILITY_DEFAULTS = {
  ankle:    { der: '', izq: '' },
  hip:      { flexDer: '', flexIzq: '', extDer: '', extIzq: '', rotIntDer: '', rotIntIzq: '', rotExtDer: '', rotExtIzq: '' },
  shoulder: { flexDer: '', flexIzq: '', abdDer: '', abdIzq: '', rotIntDer: '', rotIntIzq: '', rotExtDer: '', rotExtIzq: '' },
  fms:      { deepSquat: '', hurdleStepDer: '', hurdleStepIzq: '', inlineLungeDer: '', inlineLungeIzq: '', aslrDer: '', aslrIzq: '' },
};

function asymPct(a, b) {
  const va = Number(a), vb = Number(b);
  if (!va || !vb || va <= 0 || vb <= 0) return null;
  const pct = (Math.abs(va - vb) / Math.max(va, vb)) * 100;
  return pct.toFixed(1);
}

function asymColor(pct) {
  const n = Number(pct);
  if (n > 15) return '#ef4444';
  if (n > 10) return '#f59e0b';
  return '#22c55e';
}

function rangeStatus(val, greenMin, yellowMin) {
  const v = Number(val);
  if (!v || v <= 0) return 'neutral';
  if (v >= greenMin) return 'safe';
  if (v >= yellowMin) return 'warning';
  return 'danger';
}

function ankleStatus(deg) { return rangeStatus(deg, 35, 25); }

const STATUS_COLOR = { safe: '#22c55e', warning: '#f59e0b', danger: '#ef4444', neutral: '#475569' };

function fmsTotal(fms) {
  const vals = [
    fms.deepSquat, fms.hurdleStepDer, fms.hurdleStepIzq,
    fms.inlineLungeDer, fms.inlineLungeIzq, fms.aslrDer, fms.aslrIzq,
  ];
  if (vals.every(v => v === '' || v == null)) return null;
  return vals.reduce((s, v) => s + (Number(v) || 0), 0);
}

function fmsStatus(total) {
  if (total == null) return 'neutral';
  if (total >= 14) return 'safe';
  if (total >= 11) return 'warning';
  return 'danger';
}

// ── Mobility sub-components ──────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, open, onToggle, children }) {
  return (
    <div className="bg-card rounded-2xl border border-white/5 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-accent flex-shrink-0" />}
          <span className="text-sm font-semibold text-slate-200">{title}</span>
        </div>
        {open
          ? <ChevronUp size={15} className="text-slate-500 flex-shrink-0" />
          : <ChevronDown size={15} className="text-slate-500 flex-shrink-0" />
        }
      </button>
      {open && <div className="px-4 pb-4 space-y-1">{children}</div>}
    </div>
  );
}

function DegInput({ value, onChange, max }) {
  return (
    <input
      type="number"
      min="0"
      max={max}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="—"
      className="w-full bg-slate-800/60 border border-white/10 rounded-lg px-1 py-1.5
        text-sm text-center font-data text-slate-100
        focus:outline-none focus:border-accent/50 placeholder-slate-600"
    />
  );
}

function GonioRow({ label, derVal, izqVal, onDer, onIzq, max, statusFn }) {
  const asy   = asymPct(derVal, izqVal);
  const stDer = statusFn ? statusFn(derVal) : 'neutral';
  const stIzq = statusFn ? statusFn(izqVal) : 'neutral';

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-slate-400 min-w-0 flex-1 leading-tight">{label}</span>
      <div className="w-[68px] flex-shrink-0">
        <p className="text-[9px] text-slate-600 text-center mb-0.5">Der</p>
        <div className="relative">
          <DegInput value={derVal} onChange={onDer} max={max} />
          {derVal !== '' && derVal > 0 && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: STATUS_COLOR[stDer] }} />
          )}
        </div>
      </div>
      <div className="w-[68px] flex-shrink-0">
        <p className="text-[9px] text-slate-600 text-center mb-0.5">Izq</p>
        <div className="relative">
          <DegInput value={izqVal} onChange={onIzq} max={max} />
          {izqVal !== '' && izqVal > 0 && (
            <span className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: STATUS_COLOR[stIzq] }} />
          )}
        </div>
      </div>
      <div className="w-12 flex-shrink-0 text-right">
        {asy != null
          ? <span className="text-xs font-data font-bold" style={{ color: asymColor(asy) }}>{asy}%</span>
          : <span className="text-xs text-slate-700">—</span>
        }
      </div>
    </div>
  );
}

function FmsItem({ label, value, onChange, bilateral, derVal, izqVal, onDer, onIzq }) {
  function ScoreInput({ val, onCh }) {
    return (
      <select
        value={val}
        onChange={e => onCh(e.target.value)}
        className="bg-slate-800/60 border border-white/10 rounded-lg px-1 py-1.5
          text-sm text-center font-data text-slate-100
          focus:outline-none focus:border-accent/50 w-[58px]"
      >
        <option value="">—</option>
        {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    );
  }

  if (!bilateral) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-xs text-slate-400 flex-1">{label}</span>
        <ScoreInput val={value} onCh={onChange} />
        <div className="w-12" />
      </div>
    );
  }

  const asy = (derVal !== '' && izqVal !== '' && Number(derVal) >= 0 && Number(izqVal) >= 0)
    ? Math.abs(Number(derVal) - Number(izqVal))
    : null;

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-slate-400 flex-1">{label}</span>
      <div className="w-[68px] flex-shrink-0">
        <p className="text-[9px] text-slate-600 text-center mb-0.5">Der</p>
        <ScoreInput val={derVal} onCh={onDer} />
      </div>
      <div className="w-[68px] flex-shrink-0">
        <p className="text-[9px] text-slate-600 text-center mb-0.5">Izq</p>
        <ScoreInput val={izqVal} onCh={onIzq} />
      </div>
      <div className="w-12 text-right flex-shrink-0">
        {asy != null
          ? <span className={`text-xs font-data font-bold ${asy > 1 ? 'text-yellow-400' : 'text-green-400'}`}>{asy > 0 ? `Δ${asy}` : '✓'}</span>
          : <span className="text-xs text-slate-700">—</span>
        }
      </div>
    </div>
  );
}

function RowHeader() {
  return (
    <div className="flex items-center gap-2 mb-0.5 pb-1 border-b border-white/5">
      <div className="flex-1" />
      <div className="w-[68px] text-center text-[9px] text-slate-600 font-semibold uppercase tracking-wider flex-shrink-0">Der</div>
      <div className="w-[68px] text-center text-[9px] text-slate-600 font-semibold uppercase tracking-wider flex-shrink-0">Izq</div>
      <div className="w-12 text-right text-[9px] text-slate-600 font-semibold uppercase tracking-wider flex-shrink-0">Asim.</div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function PlayerProfile({ initialId, onNavigate }) {
  const { coach } = useAuth();
  const { players: sbPlayers } = usePlayers();

  // initialId is either a UUID (from Dashboard with Supabase loaded)
  // or a numeric string (from Dashboard with static fallback)
  const isUUID = String(initialId).includes('-');

  // Supabase player record (for name resolution)
  const sbPlayer = isUUID
    ? sbPlayers.find(p => p.id === String(initialId))
    : sbPlayers.find(p => p.name === (PLAYERS.find(sp => sp.id === Number(initialId))?.name ?? ''));

  // UUID for all Supabase queries — available immediately for UUID initialId
  const supabasePlayerId = isUUID ? String(initialId) : (sbPlayer?.id ?? null);

  // Static player — provides eval reference values, sport/category/sex, localStorage key
  const player = (() => {
    if (sbPlayer?.name) {
      const match = PLAYERS.find(p => p.name === sbPlayer.name);
      if (match) return match;
      // Supabase player with no static counterpart — synthesize from Supabase data
      return { ...PLAYERS[0], id: sbPlayer.id, name: sbPlayer.name, position: sbPlayer.position ?? PLAYERS[0].position };
    }
    if (!isUUID) return PLAYERS.find(p => p.id === Number(initialId)) ?? PLAYERS[0];
    return PLAYERS[0];
  })();

  const [activeTab,       setActiveTab]       = useState('wellness');
  const [latestWellness,  setLatestWellness]  = useState(null);
  const [wellnessHistory, setWellnessHistory] = useState([]);
  const [playerEvals,     setPlayerEvals]     = useState([]);
  const [playerLoads,     setPlayerLoads]     = useState(
    Array.from({ length: 28 }, (_, i) => ({
      date: new Date(Date.now() - (27 - i) * 86_400_000).toISOString().split('T')[0],
      load: 0,
    }))
  );

  // ── Movilidad state ──────────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState({ ankle: true, hip: false, shoulder: false, fms: false });
  const [ankle,    setAnkle]    = useState(MOBILITY_DEFAULTS.ankle);
  const [hip,      setHip]      = useState(MOBILITY_DEFAULTS.hip);
  const [shoulder, setShoulder] = useState(MOBILITY_DEFAULTS.shoulder);
  const [fms,      setFms]      = useState(MOBILITY_DEFAULTS.fms);
  const [lastSaved, setLastSaved] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [sprintData, setSprintData] = useState(null);

  // Supabase wellness + loads; localStorage para jump evals (pendiente migración)
  useEffect(() => {
    if (!supabasePlayerId) return;

    async function loadData() {
      const today = new Date();
      const since = new Date(today);
      since.setDate(today.getDate() - 27);
      const sinceStr = since.toISOString().split('T')[0];

      const [wellData, { data: loadsRaw }] = await Promise.all([
        getWellness(supabasePlayerId, 7).catch(() => []),
        supabase
          .from('loads')
          .select('date, load')
          .eq('player_id', supabasePlayerId)
          .gte('date', sinceStr)
          .gt('load', 0)
          .order('date', { ascending: true })
          .catch(() => ({ data: [] })),
      ]);

      setLatestWellness(wellData[0] ?? null);
      setWellnessHistory(wellData);

      // Construye array de 28 días con carga diaria (suma si hay varias sesiones)
      const byDate = {};
      (loadsRaw ?? []).forEach(r => {
        byDate[r.date] = (byDate[r.date] ?? 0) + Number(r.load);
      });
      setPlayerLoads(
        Array.from({ length: 28 }, (_, i) => {
          const d = new Date(today);
          d.setDate(today.getDate() - (27 - i));
          const date = d.toISOString().split('T')[0];
          return { date, load: byDate[date] ?? 0 };
        })
      );

    }

    loadData();
    const iv = setInterval(loadData, 30_000);
    return () => clearInterval(iv);
  }, [supabasePlayerId, player.id]);

  // Supabase evaluations — re-runs as soon as supabasePlayerId is resolved
  useEffect(() => {
    if (!supabasePlayerId) return;
    getEvaluations(supabasePlayerId)
      .then(evals => {
        const lastMob = evals?.find(e => e.type === 'mobility');
        if (lastMob) {
          setLastSaved(lastMob.date);
          const d = lastMob.data ?? {};
          if (d.ankle)    setAnkle(prev => ({ ...MOBILITY_DEFAULTS.ankle,    ...d.ankle    }));
          if (d.hip)      setHip(prev   => ({ ...MOBILITY_DEFAULTS.hip,      ...d.hip      }));
          if (d.shoulder) setShoulder(prev => ({ ...MOBILITY_DEFAULTS.shoulder, ...d.shoulder }));
          if (d.fms)      setFms(prev   => ({ ...MOBILITY_DEFAULTS.fms,      ...d.fms      }));
        }
        const sprints = {};
        for (const type of ['sprint10', 'sprint20', 'sprint30']) {
          const found = evals?.find(e => e.type === type);
          if (found?.data) sprints[type] = found.data;
        }
        if (Object.keys(sprints).length > 0) setSprintData(sprints);

        // Saltos: desanida data:{jumpType,height,...} al formato plano que usa el render
        const jumps = (evals ?? [])
          .filter(e => e.type === 'jump' && e.data)
          .map(e => ({ type: 'jump', date: e.date, ...e.data }));
        setPlayerEvals(jumps);
      })
      .catch(() => {});
  }, [supabasePlayerId]);

  async function handleSaveMobility() {
    setSaving(true);
    const payload = {
      player_id: supabasePlayerId ?? player.id,
      coach_id:  coach?.id,
      date:      new Date().toISOString().split('T')[0],
      type:      'mobility',
      data:      { ankle, hip, shoulder, fms },
    };
    try {
      await saveEvaluation(payload);
      setLastSaved(payload.date);
      setSaveDone(true);
      setTimeout(() => setSaveDone(false), 2500);
    } catch {
      // Fallback: save to localStorage
      try {
        const key = `fieldlab_mobility_${player.id}_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify(payload));
        setLastSaved(payload.date);
        setSaveDone(true);
        setTimeout(() => setSaveDone(false), 2500);
      } catch {}
    } finally {
      setSaving(false);
    }
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Derivados de carga
  const todayW        = latestWellness && isToday(latestWellness.timestamp) ? latestWellness : null;
  const hasRealLoads  = playerLoads.some(d => d.load > 0);
  const acute         = playerLoads.slice(-7).reduce((s, d) => s + d.load, 0) / 7;
  const chronic       = playerLoads.reduce((s, d) => s + d.load, 0) / 28;
  const displayAcwr   = hasRealLoads && chronic > 0 ? acute / chronic : player.acwr;
  const risk          = playerRisk(player, latestWellness);
  const sessionCount  = playerLoads.filter(d => d.load > 0).length;

  const wellnessChartData = [...wellnessHistory].reverse().map(r => ({
    date: formatDate(r.timestamp), score: r.score,
  }));

  const loadChartData = playerLoads.slice(-14).map(s => ({
    day:  DAYS_ES[new Date(s.date + 'T12:00:00').getDay()],
    load: Math.round(s.load),
  }));

  const { eval: ev } = player;

  const sprint10Time = sprintData?.sprint10?.tiempo  ?? ev.sprint10.time;
  const sprint30Time = sprintData?.sprint30?.tiempo  ?? ev.sprint30.time;
  const topSpeedVal  = sprintData?.sprint30?.velocidad ?? ev.topSpeed;

  const realByType = {};
  for (const e of playerEvals) {
    if (e.type === 'jump' && !realByType[e.jumpType]) realByType[e.jumpType] = e;
  }
  const realSJ  = realByType['SJ']  ?? null;
  const realCMJ = realByType['CMJ'] ?? null;
  const iueHeight = (realSJ && realCMJ)
    ? ((realCMJ.height - realSJ.height) / realSJ.height) * 100
    : ev.cmj.iue;

  // FMS derived
  const fmsScore  = fmsTotal(fms);
  const fmsSt     = fmsStatus(fmsScore);

  return (
    <div className="space-y-4">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => onNavigate?.('dashboard')}
          className="flex items-center gap-1.5 text-sm text-slate-400
            hover:text-slate-200 mb-3 transition-colors"
        >
          <ArrowLeft size={15} />
          Volver
        </button>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{player.name}</h1>
            <p className="text-sm text-slate-400">{player.position} · {player.sport}</p>
          </div>
          <div className="flex items-center gap-2 mt-1 shrink-0">
            <StatusBadge
              status={risk}
              label={risk === 'safe' ? 'Apto' : risk === 'warning' ? 'Alerta' : 'Riesgo'}
            />
            <ReportButton type="player" player={player} variant="icon" />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-data font-semibold" style={{ color: acwrColor(displayAcwr) }}>
            ACWR {displayAcwr.toFixed(2)}
          </span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-xs text-slate-500">{acwrZone(displayAcwr)}</span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-surface rounded-full p-1 border border-white/5 overflow-x-auto scrollbar-none">
        {[
          { id: 'wellness',     label: 'Wellness'     },
          { id: 'carga',        label: 'Carga'        },
          { id: 'evaluaciones', label: 'Evaluaciones' },
          { id: 'movilidad',    label: 'Movilidad'    },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex-1 py-2 rounded-full text-xs font-semibold transition-colors',
              activeTab === id
                ? 'bg-accent text-background'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB WELLNESS                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wellness' && (
        <>
          <Card title="Hoy" icon={Heart}>
            {todayW ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {HOOPER_META.map(({ key, label, emoji }) => (
                    <div key={key} className="bg-background rounded-xl p-3 border border-white/5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-slate-500">{label}</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold font-data text-slate-200">
                          {todayW[key]}
                        </span>
                        <span className="text-xs text-slate-600">/7</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                        {HOOPER_LABELS[key]?.[todayW[key]] || ''}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div>
                    <p className="text-xs text-slate-500 mb-0.5">Índice Hooper</p>
                    <span className="text-2xl font-black font-data text-slate-100">
                      {todayW.score}
                    </span>
                  </div>
                  <StatusBadge
                    status={hooperSt(todayW.score)}
                    label={
                      hooperSt(todayW.score) === 'danger'  ? 'Recuperar'  :
                      hooperSt(todayW.score) === 'warning' ? 'Monitorear' : 'Listo'
                    }
                  />
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-400 text-sm mb-1">Sin reporte hoy</p>
                <p className="text-slate-600 text-xs leading-relaxed">
                  El jugador debe completar el formulario QR para registrar datos
                </p>
              </div>
            )}
          </Card>

          {todayW && Object.keys(todayW.activeZones || {}).length > 0 && (
            <Card title="Zonas de dolor">
              <BodyHeatmapSimple
                selectedZones={todayW.activeZones}
                onSelectZone={() => {}}
                interactive={false}
              />
            </Card>
          )}

          {wellnessChartData.length > 0 && (
            <Card title="Historial Hooper · 7 días" icon={Activity}>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={wellnessChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hooperGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 28]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={12} stroke="#22c55e" strokeDasharray="4 4"
                    label={{ value: '12', fill: '#22c55e', fontSize: 9, position: 'right' }} />
                  <ReferenceLine y={18} stroke="#ef4444" strokeDasharray="4 4"
                    label={{ value: '18', fill: '#ef4444', fontSize: 9, position: 'right' }} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="score" stroke="#38bdf8" strokeWidth={2}
                    dot={{ fill: '#38bdf8', r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {wellnessHistory.length > 0 && (
            <Card title="Detalle">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-white/5">
                      {['Fecha', 'Sueño', 'Estrés', 'Fatiga', 'Dolor', 'Score', 'Estado'].map(h => (
                        <th key={h} className="pb-2 text-left font-medium pr-3 whitespace-nowrap">
                          {h === 'Estado' ? '' : h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wellnessHistory.map((r) => {
                      const st = hooperSt(r.score);
                      return (
                        <tr key={r.timestamp} className="border-b border-white/5 last:border-0">
                          <td className="py-2 pr-3 text-slate-400 whitespace-nowrap">{formatDate(r.timestamp)}</td>
                          <td className="py-2 pr-3 font-data text-slate-300">{r.sleep}</td>
                          <td className="py-2 pr-3 font-data text-slate-300">{r.stress}</td>
                          <td className="py-2 pr-3 font-data text-slate-300">{r.fatigue}</td>
                          <td className="py-2 pr-3 font-data text-slate-300">{r.soreness}</td>
                          <td className="py-2 pr-3 font-data font-bold text-slate-200">{r.score}</td>
                          <td className="py-2"><StatusBadge status={st} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB CARGA                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'carga' && (
        <>
          <Card title="ACWR" icon={Zap}>
            <AcwrBar value={displayAcwr} />
            <div className="flex justify-center mt-1 mb-4">
              <StatusBadge status={acwrSt(displayAcwr)} label={acwrZone(displayAcwr)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-xl p-3 border border-white/5">
                <p className="text-xs text-slate-500 mb-1">Carga aguda</p>
                <p className="text-xl font-bold font-data text-accent">
                  {hasRealLoads ? Math.round(acute) : '—'}
                  {hasRealLoads && <span className="text-xs font-normal text-slate-500 ml-1">UA · 7d</span>}
                </p>
              </div>
              <div className="bg-background rounded-xl p-3 border border-white/5">
                <p className="text-xs text-slate-500 mb-1">Carga crónica</p>
                <p className="text-xl font-bold font-data text-slate-300">
                  {hasRealLoads ? Math.round(chronic) : '—'}
                  {hasRealLoads && <span className="text-xs font-normal text-slate-500 ml-1">UA · 28d</span>}
                </p>
              </div>
            </div>

            {!hasRealLoads && (
              <p className="text-xs text-slate-600 text-center mt-3">
                Sin sesiones registradas — mostrando ACWR de referencia
              </p>
            )}
          </Card>

          <Card title={`Carga diaria · últimas 2 semanas · ${sessionCount} sesiones en 28d`} icon={Activity}>
            <ResponsiveContainer width="100%" height={155}>
              <AreaChart data={loadChartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="loadGradPlayer" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="load" stroke="#38bdf8" strokeWidth={2}
                  fill="url(#loadGradPlayer)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB EVALUACIONES                                                   */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'evaluaciones' && (
        <>
          <Card title="Salto" icon={ClipboardList}>
            {(realSJ || realCMJ) && (
              <div className="mb-3 px-2 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                <span>✓</span>
                <span>
                  Datos reales registrados
                  {(realSJ || realCMJ) && ` — ${formatDate((realSJ || realCMJ).date)}`}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <ResultCard
                label={realSJ ? 'SJ altura ✓' : 'SJ altura'}
                value={(realSJ?.height ?? ev.sj.height).toFixed(1)} unit="cm"
                status={getMetricStatus('sj', realSJ?.height ?? ev.sj.height, player.sport, player.category, player.sex)}
              />
              <ResultCard
                label={realSJ ? 'SJ potencia ✓' : 'SJ potencia'}
                value={Math.round(realSJ?.power ?? ev.sj.power)} unit="W"
                status="neutral"
              />
              <ResultCard
                label={realCMJ ? 'CMJ altura ✓' : 'CMJ altura'}
                value={(realCMJ?.height ?? ev.cmj.height).toFixed(1)} unit="cm"
                status={getMetricStatus('cmj', realCMJ?.height ?? ev.cmj.height, player.sport, player.category, player.sex)}
              />
              <ResultCard
                label={realCMJ ? 'CMJ potencia ✓' : 'CMJ potencia'}
                value={Math.round(realCMJ?.power ?? ev.cmj.power)} unit="W"
                status="neutral"
              />
              <ResultCard
                label="IUE"
                value={iueHeight.toFixed(1)} unit="%"
                status={iueHeight >= 10 && iueHeight <= 15 ? 'safe' : 'warning'}
                sub="Normal 10–15%"
                className="col-span-2"
              />
              <ResultCard
                label="Drop Jump RSI"
                value={ev.dj.rsi.toFixed(2)}
                status={getMetricStatus('rsi', ev.dj.rsi, player.sport, player.category, player.sex)}
                sub="≥ 2.0 élite · ≥ 1.5 aceptable"
                className="col-span-2"
              />
            </div>
          </Card>

          {playerEvals.filter(e => e.type === 'jump').length > 0 && (
            <Card title="Historial de saltos registrados" icon={ClipboardList}>
              <div className="space-y-2">
                {playerEvals.filter(e => e.type === 'jump').slice(0, 10).map((e, i) => (
                  <div key={i}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <span className="text-xs font-semibold text-slate-300">{e.jumpType}</span>
                      <span className="text-xs text-slate-500 ml-2">{formatDate(e.date)}</span>
                    </div>
                    <div className="flex gap-3 text-right">
                      <div>
                        <span className="text-sm font-data font-bold"
                          style={{ color: heightColor(e.height) }}>
                          {e.height.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-0.5">cm</span>
                      </div>
                      <div>
                        <span className="text-sm font-data font-bold text-slate-300">
                          {e.power}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-0.5">W</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card title="Velocidad" icon={ClipboardList}>
            <div className="grid grid-cols-2 gap-3">
              <ResultCard
                label="Sprint 10m"
                value={sprint10Time.toFixed(2)} unit="s"
                status={getMetricStatus('sprint10', sprint10Time, player.sport, player.category, player.sex)}
              />
              <ResultCard
                label="Sprint 30m"
                value={sprint30Time.toFixed(2)} unit="s"
                status={getMetricStatus('sprint30', sprint30Time, player.sport, player.category, player.sex)}
              />
              <ResultCard
                label="Top Speed"
                value={topSpeedVal.toFixed(1)} unit="m/s"
                status="neutral"
                className="col-span-2"
              />
            </div>
          </Card>

          <Card title="Resistencia" icon={ClipboardList}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 bg-background rounded-xl p-3 border border-white/5">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Test</p>
                <p className="text-base font-semibold text-slate-200">{ev.resistance.test}</p>
              </div>
              <ResultCard
                label="VO₂ máx"
                value={ev.resistance.vo2max.toFixed(1)} unit="ml/kg/min"
                status={getMetricStatus('vo2max', ev.resistance.vo2max, player.sport, player.category, player.sex)}
              />
              <ResultCard
                label="VAM"
                value={ev.resistance.vam.toFixed(1)} unit="km/h"
                status="neutral"
              />
            </div>
          </Card>

          <Card title="LSI — Simetría de carga" icon={ClipboardList}>
            <ResultCard
              label="Asimetría"
              value={ev.lsiPct.toFixed(1)} unit="%"
              status={getMetricStatus('lsi', ev.lsiPct, player.sport, player.category, player.sex)}
              sub="< 8% óptimo · 8–15% monitorear · > 15% riesgo"
            />
          </Card>

          <p className="text-xs text-slate-600 text-center pb-2">
            {(realSJ || realCMJ)
              ? '✓ indica datos registrados con cámara · resto son valores de referencia'
              : 'Valores de referencia · usá Análisis de Salto para registrar datos reales'
            }
          </p>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB MOVILIDAD                                                      */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'movilidad' && (
        <div className="space-y-3">

          {/* Last saved indicator */}
          {lastSaved && (
            <p className="text-xs text-slate-500 text-right">
              Última evaluación guardada: <span className="text-slate-300">{formatDate(lastSaved)}</span>
            </p>
          )}

          {/* ── 1. TOBILLO ──────────────────────────────────────────── */}
          <SectionCard
            title="Tobillo — Dorsiflexión (Lunge Test)"
            icon={Footprints}
            open={openSections.ankle}
            onToggle={() => toggleSection('ankle')}
          >
            <p className="text-[10px] text-slate-600 mb-2">Referencia: ≥35° óptimo · 25–34° aceptable · &lt;25° déficit</p>
            <RowHeader />
            <GonioRow
              label="Dorsiflexión"
              derVal={ankle.der}  onDer={v => setAnkle(p => ({ ...p, der: v }))}
              izqVal={ankle.izq}  onIzq={v => setAnkle(p => ({ ...p, izq: v }))}
              max={45}
              statusFn={ankleStatus}
            />
            {/* Status chips */}
            {(ankle.der !== '' || ankle.izq !== '') && (
              <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                {ankle.der !== '' && ankle.der > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: STATUS_COLOR[ankleStatus(ankle.der)] + '22', color: STATUS_COLOR[ankleStatus(ankle.der)] }}>
                    Der {ankle.der}° {ankleStatus(ankle.der) === 'safe' ? '✓' : ankleStatus(ankle.der) === 'warning' ? '⚠' : '✕'}
                  </span>
                )}
                {ankle.izq !== '' && ankle.izq > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: STATUS_COLOR[ankleStatus(ankle.izq)] + '22', color: STATUS_COLOR[ankleStatus(ankle.izq)] }}>
                    Izq {ankle.izq}° {ankleStatus(ankle.izq) === 'safe' ? '✓' : ankleStatus(ankle.izq) === 'warning' ? '⚠' : '✕'}
                  </span>
                )}
              </div>
            )}
          </SectionCard>

          {/* ── 2. CADERA ────────────────────────────────────────────── */}
          <SectionCard
            title="Cadera — Flexión / Extensión / Rotación"
            open={openSections.hip}
            onToggle={() => toggleSection('hip')}
          >
            <p className="text-[10px] text-slate-600 mb-2">Goniometría estándar — valores en grados</p>
            <RowHeader />
            <GonioRow
              label="Flexión (0–120°)"
              derVal={hip.flexDer}    onDer={v => setHip(p => ({ ...p, flexDer: v }))}
              izqVal={hip.flexIzq}    onIzq={v => setHip(p => ({ ...p, flexIzq: v }))}
              max={120}
              statusFn={v => rangeStatus(v, 110, 90)}
            />
            <GonioRow
              label="Extensión (0–30°)"
              derVal={hip.extDer}     onDer={v => setHip(p => ({ ...p, extDer: v }))}
              izqVal={hip.extIzq}     onIzq={v => setHip(p => ({ ...p, extIzq: v }))}
              max={30}
              statusFn={v => rangeStatus(v, 15, 10)}
            />
            <GonioRow
              label="Rot. Interna (0–45°)"
              derVal={hip.rotIntDer}  onDer={v => setHip(p => ({ ...p, rotIntDer: v }))}
              izqVal={hip.rotIntIzq}  onIzq={v => setHip(p => ({ ...p, rotIntIzq: v }))}
              max={45}
              statusFn={v => rangeStatus(v, 40, 30)}
            />
            <GonioRow
              label="Rot. Externa (0–45°)"
              derVal={hip.rotExtDer}  onDer={v => setHip(p => ({ ...p, rotExtDer: v }))}
              izqVal={hip.rotExtIzq}  onIzq={v => setHip(p => ({ ...p, rotExtIzq: v }))}
              max={45}
              statusFn={v => rangeStatus(v, 40, 30)}
            />
          </SectionCard>

          {/* ── 3. HOMBRO ────────────────────────────────────────────── */}
          <SectionCard
            title="Hombro — Flexión / Abducción / Rotación"
            open={openSections.shoulder}
            onToggle={() => toggleSection('shoulder')}
          >
            <p className="text-[10px] text-slate-600 mb-2">Goniometría estándar — valores en grados</p>
            <RowHeader />
            <GonioRow
              label="Flexión (0–180°)"
              derVal={shoulder.flexDer}    onDer={v => setShoulder(p => ({ ...p, flexDer: v }))}
              izqVal={shoulder.flexIzq}    onIzq={v => setShoulder(p => ({ ...p, flexIzq: v }))}
              max={180}
              statusFn={v => rangeStatus(v, 160, 140)}
            />
            <GonioRow
              label="Abducción (0–180°)"
              derVal={shoulder.abdDer}     onDer={v => setShoulder(p => ({ ...p, abdDer: v }))}
              izqVal={shoulder.abdIzq}     onIzq={v => setShoulder(p => ({ ...p, abdIzq: v }))}
              max={180}
              statusFn={v => rangeStatus(v, 160, 140)}
            />
            <GonioRow
              label="Rot. Interna (0–90°)"
              derVal={shoulder.rotIntDer}  onDer={v => setShoulder(p => ({ ...p, rotIntDer: v }))}
              izqVal={shoulder.rotIntIzq}  onIzq={v => setShoulder(p => ({ ...p, rotIntIzq: v }))}
              max={90}
              statusFn={v => rangeStatus(v, 70, 50)}
            />
            <GonioRow
              label="Rot. Externa (0–90°)"
              derVal={shoulder.rotExtDer}  onDer={v => setShoulder(p => ({ ...p, rotExtDer: v }))}
              izqVal={shoulder.rotExtIzq}  onIzq={v => setShoulder(p => ({ ...p, rotExtIzq: v }))}
              max={90}
              statusFn={v => rangeStatus(v, 70, 50)}
            />
          </SectionCard>

          {/* ── 4. FUNCIONAL (FMS) ───────────────────────────────────── */}
          <SectionCard
            title="Funcional — FMS Simplificado"
            open={openSections.fms}
            onToggle={() => toggleSection('fms')}
          >
            <p className="text-[10px] text-slate-600 mb-2">Puntuación: 3 = completo · 2 = parcial · 1 = compensatorio · 0 = dolor</p>
            <div className="space-y-0.5">
              <FmsItem
                label="Deep Squat"
                value={fms.deepSquat}
                onChange={v => setFms(p => ({ ...p, deepSquat: v }))}
              />
              <FmsItem
                label="Hurdle Step"
                bilateral
                derVal={fms.hurdleStepDer}  onDer={v => setFms(p => ({ ...p, hurdleStepDer: v }))}
                izqVal={fms.hurdleStepIzq}  onIzq={v => setFms(p => ({ ...p, hurdleStepIzq: v }))}
              />
              <FmsItem
                label="Inline Lunge"
                bilateral
                derVal={fms.inlineLungeDer}  onDer={v => setFms(p => ({ ...p, inlineLungeDer: v }))}
                izqVal={fms.inlineLungeIzq}  onIzq={v => setFms(p => ({ ...p, inlineLungeIzq: v }))}
              />
              <FmsItem
                label="ASLR"
                bilateral
                derVal={fms.aslrDer}  onDer={v => setFms(p => ({ ...p, aslrDer: v }))}
                izqVal={fms.aslrIzq}  onIzq={v => setFms(p => ({ ...p, aslrIzq: v }))}
              />
            </div>

            {/* FMS total score */}
            {fmsScore != null && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-sm text-slate-400">Score total</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black font-data"
                    style={{ color: STATUS_COLOR[fmsSt] }}>
                    {fmsScore}
                  </span>
                  <span className="text-sm text-slate-600">/21</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold ml-1"
                    style={{ background: STATUS_COLOR[fmsSt] + '22', color: STATUS_COLOR[fmsSt] }}>
                    {fmsSt === 'safe' ? 'Óptimo' : fmsSt === 'warning' ? 'Monitorear' : 'Riesgo'}
                  </span>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-600 mt-1">Referencia: ≥14 óptimo · 11–13 monitorear · ≤10 riesgo</p>
          </SectionCard>

          {/* ── Guardar ──────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleSaveMobility}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl
              font-semibold text-sm transition-colors disabled:opacity-60"
            style={{
              background: saveDone ? 'rgba(34,197,94,0.15)' : '#38bdf8',
              color:      saveDone ? '#22c55e' : '#0f172a',
            }}
          >
            {saving  ? <span className="animate-spin text-base">⟳</span>
            : saveDone ? <><Check size={16} /> Guardado</>
            : <><Save size={16} /> Guardar evaluación</>}
          </button>
        </div>
      )}

    </div>
  );
}
