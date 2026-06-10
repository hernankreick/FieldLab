import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Users, LogOut, Plus, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, ReferenceLine,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import QRGenerator from '../components/QRGenerator';
import ReportButton from '../components/ReportButton';
import AlertBanner from '../components/AlertBanner';
import { acwrStatus, lsiStatus } from '../utils/biomechanics';
import { calcACWR } from '../utils/calculations';
import { getAllLatestWellness, clearOldRecords } from '../utils/storage';
import { getTeamAlerts } from '../utils/alerts';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { getPlayers, getWellness, getLoads, createPlayer } from '../lib/db';
import { supabase } from '../lib/supabase';
import { PLAYERS } from '../data/players';
import BodyHeatmapSimple from '../components/BodyHeatmapSimple';

const LEVEL_IDX = { normal: 0, leve: 1, moderado: 2, alto: 3, muy_alto: 4 };
const IDX_LEVEL = ['normal', 'leve', 'moderado', 'alto', 'muy_alto'];
const ZONE_LABELS = {
  f_hombro_der: 'Hombro der', f_hombro_izq: 'Hombro izq',
  f_pectoral_der: 'Pectoral der', f_pectoral_izq: 'Pectoral izq',
  f_bicep_der: 'Bícep der', f_bicep_izq: 'Bícep izq',
  f_abdomen: 'Abdomen',
  f_antebrazo_der: 'Antebrazo der', f_antebrazo_izq: 'Antebrazo izq',
  f_ingle_der: 'Ingle der', f_ingle_izq: 'Ingle izq',
  f_cuadricep_der: 'Cuádricep der', f_cuadricep_izq: 'Cuádricep izq',
  f_aductor_der: 'Aductor der', f_aductor_izq: 'Aductor izq',
  f_rodilla_der: 'Rodilla der', f_rodilla_izq: 'Rodilla izq',
  f_tibial_der: 'Tibial ant. der', f_tibial_izq: 'Tibial ant. izq',
  f_tobillo_der: 'Tobillo der', f_tobillo_izq: 'Tobillo izq',
  p_trapecio_sup: 'Trapecio superior', p_trapecio_inf: 'Trapecio inferior',
  p_deltoides_izq: 'Deltoides izq', p_deltoides_der: 'Deltoides der',
  p_tricep_izq: 'Trícep izq', p_tricep_der: 'Trícep der',
  p_dorsal_izq: 'Dorsal izq', p_dorsal_der: 'Dorsal der',
  p_antebrazo_izq: 'Antebrazo post izq', p_antebrazo_der: 'Antebrazo post der',
  p_lumbar: 'Lumbar',
  p_gluteo_medio_izq: 'Glúteo medio izq', p_gluteo_medio_der: 'Glúteo medio der',
  p_gluteo_mayor_izq: 'Glúteo mayor izq', p_gluteo_mayor_der: 'Glúteo mayor der',
  p_isquio_izq: 'Isquiotibial izq', p_isquio_der: 'Isquiotibial der',
  p_rodilla_izq: 'Rodilla post izq', p_rodilla_der: 'Rodilla post der',
  p_gemelo_izq: 'Gemelo izq', p_gemelo_der: 'Gemelo der',
  p_talon_izq: 'Talón izq', p_talon_der: 'Talón der',
};

function buildTeamHeatmap(wellnessMap) {
  const entries = Object.values(wellnessMap);
  if (!entries.length) return { aggregated: {}, counts: {} };
  const scores = {};
  const counts = {};
  entries.forEach(w => {
    Object.entries(w.activeZones ?? {}).forEach(([zone, level]) => {
      const s = LEVEL_IDX[level] ?? 0;
      if (s > 0) {
        scores[zone] = (scores[zone] ?? 0) + s;
        counts[zone] = (counts[zone] ?? 0) + 1;
      }
    });
  });
  const aggregated = {};
  Object.keys(counts).forEach(zone => {
    const avg = scores[zone] / entries.length;
    const idx = Math.min(4, Math.ceil(avg));
    if (idx > 0) aggregated[zone] = IDX_LEVEL[idx];
  });
  return { aggregated, counts };
}

const DEFAULT_ATHLETES = PLAYERS.map(p => ({
  id:       p.id,
  name:     p.name,
  position: p.position,
  number:   0,
  acwr:     p.acwr,
  lsi:      p.lsi ?? 0,
}));

const DOT_COLOR = { danger: '#ef4444', warning: '#f59e0b', safe: '#22c55e' };
const KPI_COLOR = { neutral: '#38bdf8', safe: '#22c55e', warning: '#f59e0b', danger: '#ef4444' };

function wellnessRisk(w) {
  if (!w) return null;
  if (w.score > 18) return 'danger';
  if (w.score > 12) return 'warning';
  return 'safe';
}

function athleteRisk(a, w) {
  const loadRisk = a.acwr > 1.5 || a.lsi > 15 ? 'danger'
                 : a.acwr > 1.3 || a.lsi > 8   ? 'warning'
                 : a.acwr < 0.8                 ? 'warning'
                 : 'safe';
  const wr = wellnessRisk(w);
  if (loadRisk === 'danger' || wr === 'danger')   return 'danger';
  if (loadRisk === 'warning' || wr === 'warning') return 'warning';
  return 'safe';
}

function acwrColor(v) {
  if (v > 1.5) return '#ef4444';
  if (v > 1.3) return '#f59e0b';
  if (v < 0.8) return '#f59e0b';
  return '#22c55e';
}

function isToday(timestamp) {
  return new Date(timestamp).toDateString() === new Date().toDateString();
}

function dotPriority(a, w) {
  const hasToday = w && isToday(w.timestamp);
  if (a.acwr > 1.5 || (hasToday && w.score > 18)) return 0;
  if (a.acwr > 1.3)                                return 1;
  if (!hasToday)                                   return 1;
  return 2;
}

function normalizeWellness(row) {
  return {
    ...row,
    score:     row.score ?? row.composite ?? 0,
    timestamp: new Date(`${row.date}T12:00:00`).getTime(),
  };
}

export default function Dashboard({ onNavigate }) {
  const { coach, logout }  = useAuth();
  const { activeTeam }     = useTeam();
  const [athletes,    setAthletes]    = useState(DEFAULT_ATHLETES);
  const [wellnessMap, setWellnessMap] = useState({});
  const [dbLoading,   setDbLoading]   = useState(false);
  const [usingLocal,  setUsingLocal]  = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [newName,     setNewName]     = useState('');
  const [newPos,      setNewPos]      = useState('');
  const [newNum,      setNewNum]      = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [activeTab,    setActiveTab]    = useState('roster');
  const [teamHistory,   setTeamHistory]   = useState([]);
  const [hooperHistory, setHooperHistory] = useState([]);
  const [trendLoading,  setTrendLoading]  = useState(false);

  const loadFromDB = useCallback(async () => {
    if (!activeTeam?.id) return;
    setDbLoading(true);
    setUsingLocal(false);
    try {
      const players = await getPlayers(activeTeam.id);
      if (!players || players.length === 0) {
        setAthletes(DEFAULT_ATHLETES);
        setUsingLocal(true);
        return;
      }

      const [wellnessResults, loadsResults] = await Promise.all([
        Promise.all(players.map(p => getWellness(p.id, 1).catch(() => []))),
        Promise.all(players.map(p => getLoads(p.id, 28).catch(() => []))),
      ]);

      const newWellnessMap = {};
      const enriched = players.map((p, i) => {
        const wRow = wellnessResults[i]?.[0] ?? null;
        if (wRow) newWellnessMap[String(p.id)] = normalizeWellness(wRow);

        const loadValues = (loadsResults[i] ?? [])
          .slice().reverse()
          .map(l => Number(l.load));
        const acwrResult = loadValues.length > 0 ? calcACWR(loadValues) : null;

        return {
          ...p,
          acwr: acwrResult?.ratio ?? 1.0,
          lsi:  p.lsi ?? 0,
        };
      });

      setAthletes(enriched);
      setWellnessMap(newWellnessMap);
    } catch {
      setAthletes(DEFAULT_ATHLETES);
      setUsingLocal(true);
    } finally {
      setDbLoading(false);
    }
  }, [activeTeam?.id]);

  useEffect(() => { loadFromDB(); }, [loadFromDB]);

  const loadTrendData = useCallback(async () => {
    if (!activeTeam?.id) return;
    setTrendLoading(true);
    try {
      const players = await getPlayers(activeTeam.id);
      if (!players?.length) return;
      const playerIds = players.map(p => p.id);

      const today  = new Date();
      const dateStr = (d) => d.toISOString().split('T')[0];
      const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d; };

      // ACWR histórico del equipo (28 días)
      const { data: loadsData } = await supabase
        .from('loads')
        .select('date, load, player_id')
        .in('player_id', playerIds)
        .gte('date', dateStr(daysAgo(28)))
        .order('date', { ascending: true });

      if (loadsData?.length > 0) {
        const byDate = {};
        loadsData.forEach(r => {
          if (!byDate[r.date]) byDate[r.date] = [];
          byDate[r.date].push(Number(r.load));
        });

        const series = Array.from({ length: 28 }, (_, i) => {
          const date = dateStr(daysAgo(27 - i));
          const vals = byDate[date] ?? [];
          return {
            date,
            label: new Date(date + 'T12:00:00')
              .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
            load: vals.length > 0
              ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
              : 0,
          };
        });

        const seriesWithACWR = series.map((point, i) => {
          if (i < 7) return { ...point, acwr: null };
          const acute7   = series.slice(i - 6, i + 1).reduce((s, d) => s + d.load, 0) / 7;
          const chronic28 = i >= 27
            ? series.slice(0, 28).reduce((s, d) => s + d.load, 0) / 28
            : series.slice(0, i + 1).reduce((s, d) => s + d.load, 0) / (i + 1);
          const acwr = chronic28 > 0 ? acute7 / chronic28 : null;
          return { ...point, acwr: acwr !== null ? Math.round(acwr * 100) / 100 : null };
        });

        setTeamHistory(seriesWithACWR);
      }

      // Hooper histórico del equipo (14 días)
      const { data: wellnessData } = await supabase
        .from('wellness')
        .select('date, composite, player_id')
        .in('player_id', playerIds)
        .gte('date', dateStr(daysAgo(14)))
        .order('date', { ascending: true });

      if (wellnessData?.length > 0) {
        const byDate = {};
        wellnessData.forEach(r => {
          if (!byDate[r.date]) byDate[r.date] = [];
          byDate[r.date].push(Number(r.composite ?? 0));
        });

        const hooperSeries = Array.from({ length: 14 }, (_, i) => {
          const date = dateStr(daysAgo(13 - i));
          const vals = byDate[date] ?? [];
          return {
            date,
            label: new Date(date + 'T12:00:00')
              .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
            score: vals.length > 0
              ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
              : null,
            count: vals.length,
          };
        });

        setHooperHistory(hooperSeries);
      }
    } catch (e) {
      console.warn('trend load error:', e);
    } finally {
      setTrendLoading(false);
    }
  }, [activeTeam?.id]);

  useEffect(() => {
    if (activeTab === 'tendencias') loadTrendData();
  }, [activeTab, loadTrendData]);

  // Poll localStorage wellness when using local fallback
  useEffect(() => {
    if (!usingLocal) return;
    clearOldRecords();
    const load = () => setWellnessMap(getAllLatestWellness());
    load();
    const iv = setInterval(load, 30_000);
    window.addEventListener('storage', load);
    return () => { clearInterval(iv); window.removeEventListener('storage', load); };
  }, [usingLocal]);

  async function addAthlete() {
    if (!newName.trim()) return;
    const isValidTeam = activeTeam?.id && String(activeTeam.id).includes('-');
    setAddingPlayer(true);
    try {
      if (isValidTeam) {
        await createPlayer({
          team_id:  activeTeam.id,
          coach_id: coach?.id,
          name:     newName.trim(),
          position: newPos.trim() || null,
        });
        await loadFromDB();
      } else {
        setAthletes(prev => [...prev, {
          id:       Date.now(),
          name:     newName.trim(),
          position: newPos.trim(),
          number:   Number(newNum) || 0,
          acwr:     1.0,
          lsi:      0,
        }]);
      }
    } finally {
      setNewName(''); setNewPos(''); setNewNum('');
      setShowAdd(false);
      setAddingPlayer(false);
    }
  }

  const athletesWithWellness = athletes.map(a => ({
    ...a,
    w: wellnessMap[String(a.id)] ?? null,
  }));

  const sortedAthletes = [...athletesWithWellness].sort((a, b) => {
    const dp = dotPriority(a, a.w) - dotPriority(b, b.w);
    return dp !== 0 ? dp : b.acwr - a.acwr;
  });

  const todayCount    = athletesWithWellness.filter(a => a.w && isToday(a.w.timestamp)).length;
  const noReportCount = athletesWithWellness.length - todayCount;
  const alerts = athletesWithWellness.filter(a => {
    const w = a.w && isToday(a.w.timestamp) ? a.w : null;
    return athleteRisk(a, w) === 'danger';
  });

  const acwrMap         = Object.fromEntries(athletes.map(a => [a.id, { ratio: a.acwr }]));
  const wellnessDateMap = Object.fromEntries(
    athletes.map(a => [a.id, wellnessMap[String(a.id)]?.timestamp ?? null])
  );
  const teamAlerts = getTeamAlerts(athletes, acwrMap, wellnessDateMap);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">FieldLab</h1>
          <p className="text-sm text-slate-400">{coach?.name ?? coach?.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ReportButton
            type="team"
            players={athletesWithWellness}
            label="Informe Semanal"
          />
          <button onClick={logout} className="text-slate-500 hover:text-slate-300 p-1 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Panel de alertas del equipo */}
      <AlertBanner alerts={teamAlerts} />

      {/* Loading spinner */}
      {dbLoading && (
        <div className="flex items-center justify-center gap-2 py-1 text-slate-500 text-xs">
          <Loader2 size={12} className="animate-spin" />
          Cargando plantel…
        </div>
      )}

      {/* KPI strip — 4 columnas compactas */}
      {(() => {
        const kpis = [
          { value: athletesWithWellness.length, label: 'Atletas',   color: KPI_COLOR.neutral },
          { value: alerts.length,   label: 'En riesgo', color: alerts.length > 0 ? KPI_COLOR.danger  : KPI_COLOR.safe    },
          { value: todayCount,      label: 'Hoy',       color: todayCount === athletesWithWellness.length ? KPI_COLOR.safe : todayCount > 0 ? KPI_COLOR.warning : KPI_COLOR.neutral },
          { value: noReportCount,   label: 'Sin rep.',  color: noReportCount > 0 ? KPI_COLOR.warning : KPI_COLOR.safe    },
        ];
        return (
          <div className="grid grid-cols-4 gap-2">
            {kpis.map(({ value, label, color }) => (
              <Card key={label} className="p-3">
                <span className="font-data text-2xl font-bold block" style={{ color }}>{value}</span>
                <span className="text-[10px] text-slate-500 leading-tight block">{label}</span>
              </Card>
            ))}
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.04] p-1 rounded-xl">
        {[
          { id: 'roster',     label: 'Plantel'       },
          { id: 'heatmap',    label: 'Mapa de dolor' },
          { id: 'tendencias', label: 'Tendencias'    },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === id
                ? 'bg-accent text-background'
                : 'text-slate-400 hover:text-slate-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'roster' && (
        <>
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
                      {a.w && isToday(a.w.timestamp) && a.w.score > 18 &&
                        <StatusBadge status="danger" label={`Hooper ${a.w.score}`} />}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Estado del plantel */}
          <Card title="Estado del plantel" icon={Users}
            action={
              <button
                onClick={() => setShowAdd(s => !s)}
                className="text-xs text-accent font-semibold flex items-center gap-1 hover:text-accent/80 transition-colors"
              >
                <Plus size={12} /> Jugador
              </button>
            }
          >
            {showAdd && (
              <div className="flex flex-col gap-2 mb-3 p-3 bg-background rounded-xl border border-white/10">
                <input
                  placeholder="Nombre"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent/50"
                />
                <input
                  placeholder="Posición"
                  value={newPos}
                  onChange={e => setNewPos(e.target.value)}
                  className="bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent/50"
                />
                <input
                  placeholder="Número"
                  type="number"
                  value={newNum}
                  onChange={e => setNewNum(e.target.value)}
                  className="bg-card border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-accent/50"
                />
                <button
                  onClick={addAthlete}
                  disabled={addingPlayer}
                  className="bg-accent text-background font-bold py-2 rounded-lg text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {addingPlayer ? <><Loader2 size={14} className="animate-spin" />Guardando…</> : 'Agregar'}
                </button>
              </div>
            )}

            <div className="space-y-0">
              {sortedAthletes.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">
                  No hay jugadores — usá el botón + para agregar
                </p>
              )}
              {sortedAthletes.map(a => {
                const hasToday = a.w && isToday(a.w.timestamp);
                const dotColor = a.acwr > 1.5 || (hasToday && a.w.score > 18) ? DOT_COLOR.danger
                               : a.acwr > 1.3                                  ? DOT_COLOR.warning
                               : hasToday                                       ? DOT_COLOR.safe
                               : '#475569';
                return (
                  <button
                    key={a.id}
                    onClick={() => onNavigate?.('player', a.id)}
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
                      style={{ background: dotColor }}
                    />
                  </button>
                );
              })}
            </div>
          </Card>

          {/* QR para el formulario de wellness diario */}
          <QRGenerator />
        </>
      )}

      {activeTab === 'heatmap' && (() => {
        const { aggregated, counts } = buildTeamHeatmap(wellnessMap);
        const top3 = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
        const anyData = top3.length > 0;
        return (
          <Card title="Mapa de dolor del plantel">
            {!anyData ? (
              <p className="text-sm text-slate-500 text-center py-8">
                Sin datos de dolor reportados
              </p>
            ) : (
              <>
                <BodyHeatmapSimple selectedZones={aggregated} interactive={false} />
                <div className="mt-4 space-y-2">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Zonas más afectadas
                  </p>
                  {top3.map(([zone, count]) => (
                    <div key={zone} className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                      <span className="text-sm text-slate-300">{ZONE_LABELS[zone] ?? zone}</span>
                      <span className="text-xs text-slate-400 font-data">
                        {count} jugador{count !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        );
      })()}

      {activeTab === 'tendencias' && (
        <div className="space-y-4">

          {trendLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-slate-500 text-xs">
              <Loader2 size={12} className="animate-spin" />
              Cargando tendencias…
            </div>
          )}

          {/* ACWR del equipo */}
          <Card title="ACWR del Equipo — 28 días" icon={TrendingUp}>
            {teamHistory.filter(d => d.acwr !== null).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Sin datos de carga suficientes (mínimo 7 días)
              </p>
            ) : (
              <>
                {(() => {
                  const withACWR = teamHistory.filter(d => d.acwr !== null);
                  const current  = withACWR[withACWR.length - 1]?.acwr ?? null;
                  const prev     = withACWR[withACWR.length - 8]?.acwr ?? null;
                  const trend    = current && prev
                    ? current > prev + 0.05 ? 'up'
                    : current < prev - 0.05 ? 'down'
                    : 'stable'
                    : null;
                  const acwrCol  = !current ? '#94a3b8'
                    : current > 1.5 ? '#ef4444'
                    : current > 1.3 ? '#f59e0b'
                    : current < 0.8 ? '#f59e0b'
                    : '#22c55e';
                  return (
                    <div className="flex items-center gap-3 mb-3">
                      <div>
                        <span className="font-data text-3xl font-bold" style={{ color: acwrCol }}>
                          {current?.toFixed(2) ?? '—'}
                        </span>
                        <span className="text-slate-500 text-xs ml-1">hoy</span>
                      </div>
                      {trend && (
                        <div className="flex items-center gap-1">
                          {trend === 'up'     && <TrendingUp   size={14} className="text-red-400" />}
                          {trend === 'down'   && <TrendingDown size={14} className="text-green-400" />}
                          {trend === 'stable' && <Minus        size={14} className="text-slate-400" />}
                          <span className="text-xs text-slate-500">vs semana anterior</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart
                    data={teamHistory.filter(d => d.acwr !== null)}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="acwrGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }}
                      axisLine={false} tickLine={false} interval={6} />
                    <YAxis domain={[0, 2]} tick={{ fill: '#64748b', fontSize: 9 }}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', fontSize: 12 }}
                      labelStyle={{ color: '#f8fafc' }}
                      itemStyle={{ color: '#38bdf8' }}
                      formatter={(v) => [v?.toFixed(2), 'ACWR']}
                    />
                    <ReferenceLine y={0.8} stroke="#22c55e" strokeDasharray="3 3"
                      label={{ value: '0.8', fill: '#22c55e', fontSize: 9, position: 'left' }} />
                    <ReferenceLine y={1.3} stroke="#f59e0b" strokeDasharray="3 3"
                      label={{ value: '1.3', fill: '#f59e0b', fontSize: 9, position: 'left' }} />
                    <ReferenceLine y={1.5} stroke="#ef4444" strokeDasharray="3 3"
                      label={{ value: '1.5', fill: '#ef4444', fontSize: 9, position: 'left' }} />
                    <Area type="monotone" dataKey="acwr" stroke="#38bdf8" strokeWidth={2}
                      fill="url(#acwrGrad)" connectNulls={false} dot={false}
                      activeDot={{ r: 4, fill: '#38bdf8' }} />
                  </AreaChart>
                </ResponsiveContainer>

                <p className="text-[10px] text-slate-600 mt-1 text-center">
                  Promedio del equipo · Verde 0.8–1.3 · Riesgo &gt;1.5
                </p>
              </>
            )}
          </Card>

          {/* Hooper Index del equipo */}
          <Card title="Hooper Index del Equipo — 14 días">
            {hooperHistory.filter(d => d.score !== null).length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                Sin reportes de wellness en los últimos 14 días
              </p>
            ) : (
              <>
                {(() => {
                  const withScore = hooperHistory.filter(d => d.score !== null);
                  const current   = withScore[withScore.length - 1]?.score ?? null;
                  const hooCol    = !current ? '#94a3b8'
                    : current > 18 ? '#ef4444'
                    : current > 12 ? '#f59e0b'
                    : '#22c55e';
                  const hooLabel  = !current ? '—'
                    : current > 18 ? 'Fatiga crítica'
                    : current > 12 ? 'Precaución'
                    : 'Óptimo';
                  return (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-data text-3xl font-bold" style={{ color: hooCol }}>
                        {current ?? '—'}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: hooCol }}>
                        {hooLabel}
                      </span>
                    </div>
                  );
                })()}

                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={hooperHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }}
                      axisLine={false} tickLine={false} interval={3} />
                    <YAxis domain={[0, 28]} tick={{ fill: '#64748b', fontSize: 9 }}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', fontSize: 12 }}
                      labelStyle={{ color: '#f8fafc' }}
                      formatter={(v, _, p) => [`${v} pts (${p.payload.count} reportes)`, 'Hooper']}
                    />
                    <ReferenceLine y={12} stroke="#22c55e" strokeDasharray="3 3"
                      label={{ value: '12', fill: '#22c55e', fontSize: 9, position: 'left' }} />
                    <ReferenceLine y={18} stroke="#ef4444" strokeDasharray="3 3"
                      label={{ value: '18', fill: '#ef4444', fontSize: 9, position: 'left' }} />
                    <Line type="monotone" dataKey="score" stroke="#a78bfa" strokeWidth={2}
                      dot={{ r: 3, fill: '#a78bfa' }} connectNulls={false}
                      activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>

                <p className="text-[10px] text-slate-600 mt-1 text-center">
                  Promedio del equipo · Verde &lt;12 · Riesgo &gt;18
                </p>
              </>
            )}
          </Card>

          {/* Top atletas en seguimiento */}
          <Card title="Atletas en seguimiento">
            {(() => {
              const atRisk = sortedAthletes
                .filter(a => a.acwr > 1.3 || (a.w && a.w.score > 12))
                .slice(0, 5);

              if (atRisk.length === 0) {
                return (
                  <p className="text-sm text-slate-500 text-center py-4">
                    ✓ Todo el plantel en zona óptima
                  </p>
                );
              }

              return (
                <div className="space-y-3">
                  {atRisk.map(a => {
                    const acwrCol = acwrColor(a.acwr);
                    const hooCol  = !a.w ? '#475569'
                      : a.w.score > 18 ? '#ef4444'
                      : a.w.score > 12 ? '#f59e0b'
                      : '#22c55e';
                    return (
                      <button key={a.id} onClick={() => onNavigate?.('player', a.id)}
                        className="w-full text-left">
                        <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-200 truncate">{a.name}</p>
                            <p className="text-xs text-slate-500">{a.position}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <div className="text-right">
                              <div className="font-data text-sm font-bold" style={{ color: acwrCol }}>
                                {a.acwr.toFixed(2)}
                              </div>
                              <div className="text-[10px] text-slate-600">ACWR</div>
                            </div>
                            {a.w && (
                              <div className="text-right">
                                <div className="font-data text-sm font-bold" style={{ color: hooCol }}>
                                  {a.w.score}
                                </div>
                                <div className="text-[10px] text-slate-600">Hooper</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </Card>

        </div>
      )}
    </div>
  );
}
