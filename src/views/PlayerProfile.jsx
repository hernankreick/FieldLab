import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Zap, ClipboardList, Activity } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer,
} from 'recharts';
import Card from '../components/Card';
import ResultCard from '../components/ResultCard';
import StatusBadge from '../components/StatusBadge';
import BodyHeatmapSimple from '../components/BodyHeatmapSimple';
import { cn } from '../utils/cn';
import { getLatestWellness, getWellnessByPlayer, getPlayerRecentLoads } from '../utils/storage';

// ── Datos de atletas con evaluaciones mock ───────────────────────────────────

const PLAYERS = [
  {
    id: 1, name: 'Ramiro Sánchez',   position: 'Fullback',      sport: 'Rugby',
    acwr: 1.42, lsi: 6.2,
    eval: {
      sj:         { height: 34.2, power: 3200 },
      cmj:        { height: 38.5, power: 3580, iue: 11.8 },
      dj:         { rsi: 1.8 },
      sprint10:   { time: 1.78 },
      sprint30:   { time: 4.25 },
      topSpeed:   7.8,
      resistance: { test: 'Yo-Yo IR1', vo2max: 48.5, vam: 13.9 },
      lsiPct:     6.2,
    },
  },
  {
    id: 2, name: 'Leandro Martínez', position: 'Apertura',      sport: 'Rugby',
    acwr: 1.61, lsi: 18.4,
    eval: {
      sj:         { height: 30.1, power: 2950 },
      cmj:        { height: 33.8, power: 3210, iue: 12.2 },
      dj:         { rsi: 1.4 },
      sprint10:   { time: 1.92 },
      sprint30:   { time: 4.68 },
      topSpeed:   7.1,
      resistance: { test: 'Navette', vo2max: 43.2, vam: 12.5 },
      lsiPct:     18.4,
    },
  },
  {
    id: 3, name: 'Tomás Ruiz',       position: 'Hooker',        sport: 'Rugby',
    acwr: 1.1,  lsi: 4.8,
    eval: {
      sj:         { height: 36.8, power: 3480 },
      cmj:        { height: 41.2, power: 3850, iue: 12.0 },
      dj:         { rsi: 2.1 },
      sprint10:   { time: 1.74 },
      sprint30:   { time: 4.10 },
      topSpeed:   8.1,
      resistance: { test: 'Yo-Yo IR1', vo2max: 52.0, vam: 14.5 },
      lsiPct:     4.8,
    },
  },
  {
    id: 4, name: 'Facundo Benítez',  position: 'Ala',           sport: 'Rugby',
    acwr: 0.95, lsi: 11.2,
    eval: {
      sj:         { height: 32.5, power: 3100 },
      cmj:        { height: 36.0, power: 3390, iue: 10.8 },
      dj:         { rsi: 1.6 },
      sprint10:   { time: 1.85 },
      sprint30:   { time: 4.40 },
      topSpeed:   7.4,
      resistance: { test: 'Cooper', vo2max: 46.8, vam: 13.2 },
      lsiPct:     11.2,
    },
  },
  {
    id: 5, name: 'Agustín Torres',   position: 'Centro',        sport: 'Rugby',
    acwr: 1.05, lsi: 5.0,
    eval: {
      sj:         { height: 38.0, power: 3620 },
      cmj:        { height: 42.5, power: 4010, iue: 11.8 },
      dj:         { rsi: 2.3 },
      sprint10:   { time: 1.71 },
      sprint30:   { time: 4.05 },
      topSpeed:   8.3,
      resistance: { test: 'Yo-Yo IR1', vo2max: 54.2, vam: 15.0 },
      lsiPct:     5.0,
    },
  },
  {
    id: 6, name: 'Lucía Fernández',  position: 'Mediocampista', sport: 'Fútbol',
    acwr: 0.88, lsi: 7.3,
    eval: {
      sj:         { height: 28.4, power: 2680 },
      cmj:        { height: 32.1, power: 3050, iue: 13.0 },
      dj:         { rsi: 1.5 },
      sprint10:   { time: 1.90 },
      sprint30:   { time: 4.52 },
      topSpeed:   7.3,
      resistance: { test: 'UNCa', vo2max: 44.5, vam: 12.8 },
      lsiPct:     7.3,
    },
  },
  {
    id: 7, name: 'Valentina López',  position: 'Delantera',     sport: 'Fútbol',
    acwr: 1.22, lsi: 9.8,
    eval: {
      sj:         { height: 31.5, power: 2920 },
      cmj:        { height: 35.2, power: 3280, iue: 11.7 },
      dj:         { rsi: 1.7 },
      sprint10:   { time: 1.83 },
      sprint30:   { time: 4.35 },
      topSpeed:   7.6,
      resistance: { test: 'Navette', vo2max: 47.8, vam: 13.5 },
      lsiPct:     9.8,
    },
  },
  {
    id: 8, name: 'Martín González',  position: 'Delantero',     sport: 'Fútbol',
    acwr: 1.35, lsi: 6.1,
    eval: {
      sj:         { height: 40.2, power: 3780 },
      cmj:        { height: 44.8, power: 4180, iue: 11.4 },
      dj:         { rsi: 2.2 },
      sprint10:   { time: 1.69 },
      sprint30:   { time: 3.98 },
      topSpeed:   8.5,
      resistance: { test: 'Yo-Yo IR1', vo2max: 56.1, vam: 15.5 },
      lsiPct:     6.1,
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function isToday(ts) {
  return new Date(ts).toDateString() === new Date().toDateString();
}

function formatDate(ts) {
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

// Zonas para evaluaciones
function jumpSt(h)       { return h >= 40 ? 'safe' : h >= 30 ? 'warning' : 'danger'; }
function rsiSt(r)        { return r >= 2.0 ? 'safe' : r >= 1.5 ? 'warning' : 'danger'; }
function vo2St(v)        { return v >= 50 ? 'safe' : v >= 40 ? 'warning' : 'danger'; }
function lsiSt(p)        { return p < 8 ? 'safe' : p <= 15 ? 'warning' : 'danger'; }
function sprint10St(t)   { return t <= 1.75 ? 'safe' : t <= 1.90 ? 'warning' : 'danger'; }
function sprint30St(t)   { return t <= 4.10 ? 'safe' : t <= 4.50 ? 'warning' : 'danger'; }

// ── Barra ACWR con zonas y marcador ─────────────────────────────────────────

function AcwrBar({ value }) {
  const clamped = Math.min(Math.max(value, 0), 2.0);
  const color   = acwrColor(value);
  const W = 200, barY = 30, barH = 12;
  const mx = (clamped / 2.0) * W;
  // Clamp del marcador para que no se recorte en valores extremos
  const tmx = Math.min(Math.max(mx, 5), W - 5);
  // Clamp del label (más margen porque el texto es más ancho)
  const lx = Math.min(Math.max(mx, 18), W - 18);

  const zones = [
    { from: 0,   to: 0.8, fill: '#334155' }, // gris — subcarga
    { from: 0.8, to: 1.3, fill: '#22c55e' }, // verde — óptimo
    { from: 1.3, to: 1.5, fill: '#f59e0b' }, // amarillo — precaución
    { from: 1.5, to: 2.0, fill: '#ef4444' }, // rojo — peligro
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
        {/* ClipPath para que los extremos de la barra sean redondeados */}
        <clipPath id="acwrBarClip">
          <rect x="0" y={barY} width={W} height={barH} rx={barH / 2} />
        </clipPath>
      </defs>

      {/* Segmentos de zona */}
      <g clipPath="url(#acwrBarClip)">
        {zones.map(({ from, to, fill }) => (
          <rect key={from}
            x={(from / 2.0) * W} y={barY}
            width={((to - from) / 2.0) * W} height={barH}
            fill={fill}
          />
        ))}
      </g>

      {/* Separadores entre zonas */}
      {[0.8, 1.3, 1.5].map(v => {
        const tx = (v / 2.0) * W;
        return (
          <line key={v} x1={tx} y1={barY} x2={tx} y2={barY + barH}
            stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
        );
      })}

      {/* Triángulo marcador apuntando hacia la barra desde arriba */}
      <polygon
        points={`${tmx},${barY} ${tmx - 5},${barY - 9} ${tmx + 5},${barY - 9}`}
        fill={color}
      />

      {/* Valor actual sobre el triángulo */}
      <text x={lx} y={barY - 12} textAnchor="middle"
        fontSize="12" fontWeight="700" fill={color}
        fontFamily="ui-monospace,monospace">
        {value.toFixed(2)}
      </text>

      {/* Etiquetas de zona */}
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

// ── Componente principal ─────────────────────────────────────────────────────

export default function PlayerProfile({ initialId, onNavigate }) {
  const player = PLAYERS.find(p => p.id === Number(initialId)) ?? PLAYERS[0];

  const [activeTab,       setActiveTab]       = useState('wellness');
  const [latestWellness,  setLatestWellness]  = useState(null);
  const [wellnessHistory, setWellnessHistory] = useState([]);
  const [playerLoads,     setPlayerLoads]     = useState(
    Array.from({ length: 28 }, (_, i) => ({
      date: new Date(Date.now() - (27 - i) * 86_400_000).toISOString().split('T')[0],
      load: 0,
    }))
  );

  useEffect(() => {
    function loadData() {
      setLatestWellness(getLatestWellness(player.id));
      setWellnessHistory(getWellnessByPlayer(player.id).slice(0, 7));
      setPlayerLoads(getPlayerRecentLoads(player.id, 28));
    }
    loadData();
    const iv = setInterval(loadData, 30_000);
    window.addEventListener('storage', loadData);
    return () => { clearInterval(iv); window.removeEventListener('storage', loadData); };
  }, [player.id]);

  // Derivados de carga
  const todayW        = latestWellness && isToday(latestWellness.timestamp) ? latestWellness : null;
  const hasRealLoads  = playerLoads.some(d => d.load > 0);
  const acute         = playerLoads.slice(-7).reduce((s, d) => s + d.load, 0) / 7;
  const chronic       = playerLoads.reduce((s, d) => s + d.load, 0) / 28;
  const displayAcwr   = hasRealLoads && chronic > 0 ? acute / chronic : player.acwr;
  const risk          = playerRisk(player, latestWellness);
  const sessionCount  = playerLoads.filter(d => d.load > 0).length;

  // Datos para gráficos
  const wellnessChartData = [...wellnessHistory].reverse().map(r => ({
    date: formatDate(r.timestamp), score: r.score,
  }));

  const loadChartData = playerLoads.slice(-14).map(s => ({
    day:  DAYS_ES[new Date(s.date + 'T12:00:00').getDay()],
    load: Math.round(s.load),
  }));

  const { eval: ev } = player;

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
          <StatusBadge
            status={risk}
            label={risk === 'safe' ? 'Apto' : risk === 'warning' ? 'Alerta' : 'Riesgo'}
            className="mt-1 shrink-0"
          />
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
      <div className="flex gap-1 bg-surface rounded-full p-1 border border-white/5">
        {[
          { id: 'wellness',     label: 'Wellness'     },
          { id: 'carga',        label: 'Carga'        },
          { id: 'evaluaciones', label: 'Evaluaciones' },
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
          {/* Reporte de hoy */}
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

          {/* Mapa de zonas de dolor — solo si tiene reporte con zonas activas */}
          {todayW && Object.keys(todayW.activeZones || {}).length > 0 && (
            <Card title="Zonas de dolor">
              <BodyHeatmapSimple
                selectedZones={todayW.activeZones}
                onSelectZone={() => {}}
                interactive={false}
              />
            </Card>
          )}

          {/* Gráfico historial Hooper */}
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

          {/* Tabla historial */}
          {wellnessHistory.length > 0 && (
            <Card title="Detalle">
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-white/5">
                      {['Fecha', 'Sueño', 'Estrés', 'Fatiga', 'Dolor', 'Score', ''].map(h => (
                        <th key={h} className="pb-2 text-left font-medium pr-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wellnessHistory.map((r, i) => {
                      const st = hooperSt(r.score);
                      return (
                        <tr key={i} className="border-b border-white/5 last:border-0">
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
          {/* Gauge ACWR + métricas */}
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

          {/* Gráfico de carga */}
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
          {/* Salto */}
          <Card title="Salto" icon={ClipboardList}>
            <div className="grid grid-cols-2 gap-3">
              <ResultCard
                label="SJ altura"
                value={ev.sj.height.toFixed(1)} unit="cm"
                status={jumpSt(ev.sj.height)}
              />
              <ResultCard
                label="SJ potencia"
                value={Math.round(ev.sj.power)} unit="W"
                status="neutral"
              />
              <ResultCard
                label="CMJ altura"
                value={ev.cmj.height.toFixed(1)} unit="cm"
                status={jumpSt(ev.cmj.height)}
              />
              <ResultCard
                label="CMJ potencia"
                value={Math.round(ev.cmj.power)} unit="W"
                status="neutral"
              />
              <ResultCard
                label="IUE"
                value={ev.cmj.iue.toFixed(1)} unit="%"
                status={ev.cmj.iue >= 10 && ev.cmj.iue <= 15 ? 'safe' : 'warning'}
                sub="Normal 10–15%"
                className="col-span-2"
              />
              <ResultCard
                label="Drop Jump RSI"
                value={ev.dj.rsi.toFixed(2)}
                status={rsiSt(ev.dj.rsi)}
                sub="≥ 2.0 élite · ≥ 1.5 aceptable"
                className="col-span-2"
              />
            </div>
          </Card>

          {/* Velocidad */}
          <Card title="Velocidad" icon={ClipboardList}>
            <div className="grid grid-cols-2 gap-3">
              <ResultCard
                label="Sprint 10m"
                value={ev.sprint10.time.toFixed(2)} unit="s"
                status={sprint10St(ev.sprint10.time)}
              />
              <ResultCard
                label="Sprint 30m"
                value={ev.sprint30.time.toFixed(2)} unit="s"
                status={sprint30St(ev.sprint30.time)}
              />
              <ResultCard
                label="Top Speed"
                value={ev.topSpeed.toFixed(1)} unit="m/s"
                status="neutral"
                className="col-span-2"
              />
            </div>
          </Card>

          {/* Resistencia */}
          <Card title="Resistencia" icon={ClipboardList}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 bg-background rounded-xl p-3 border border-white/5">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">
                  Test
                </p>
                <p className="text-base font-semibold text-slate-200">{ev.resistance.test}</p>
              </div>
              <ResultCard
                label="VO₂ máx"
                value={ev.resistance.vo2max.toFixed(1)} unit="ml/kg/min"
                status={vo2St(ev.resistance.vo2max)}
              />
              <ResultCard
                label="VAM"
                value={ev.resistance.vam.toFixed(1)} unit="km/h"
                status="neutral"
              />
            </div>
          </Card>

          {/* LSI */}
          <Card title="LSI — Simetría de carga" icon={ClipboardList}>
            <ResultCard
              label="Asimetría"
              value={ev.lsiPct.toFixed(1)} unit="%"
              status={lsiSt(ev.lsiPct)}
              sub="< 8% óptimo · 8–15% monitorear · > 15% riesgo"
            />
          </Card>

          <p className="text-xs text-slate-600 text-center pb-2">
            Datos de la última evaluación registrada
          </p>
        </>
      )}

    </div>
  );
}
