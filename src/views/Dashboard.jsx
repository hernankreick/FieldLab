import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Users, LogOut, Plus, Loader2 } from 'lucide-react';
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
import { PLAYERS } from '../data/players';

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
    score:     row.score ?? 0,
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
    </div>
  );
}
