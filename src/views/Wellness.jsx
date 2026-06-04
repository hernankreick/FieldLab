import { useState, useEffect, useCallback } from 'react';
import { Heart, Map, Clock } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import BodyHeatmapSimple from '../components/BodyHeatmapSimple';
import { getWellness, getLatestTeamWellness } from '../lib/db';
import { usePlayers } from '../hooks/usePlayers';

const LABELS = {
  sleep:    ['', 'Pésimo',    'Muy malo', 'Malo',     'Regular',  'Bueno',    'Muy bueno', 'Excelente'],
  stress:   ['', 'Sin estrés','Muy leve', 'Leve',     'Moderado', 'Alto',     'Muy alto',  'Extremo'  ],
  fatigue:  ['', 'Sin fatiga','Muy leve', 'Leve',     'Moderada', 'Alta',     'Muy alta',  'Extrema'  ],
  soreness: ['', 'Sin dolor', 'Muy leve', 'Leve',     'Moderado', 'Alto',     'Muy alto',  'Extremo'  ],
};

function hooperStatus(score) {
  if (score > 18) return 'danger';
  if (score > 12) return 'warning';
  return 'safe';
}

function isToday(ts) {
  return new Date(ts).toDateString() === new Date().toDateString();
}

function formatDate(ts) {
  const d = new Date(ts);
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

export default function Wellness({ initialId }) {
  const { players, loading: loadingPlayers } = usePlayers();

  const [selectedId, setSelectedId] = useState(initialId ?? null);
  const [latest,     setLatest]     = useState(null);
  const [history,    setHistory]    = useState([]);
  const [rosterMap,  setRosterMap]  = useState({});

  // Cuando cargan los jugadores, fija el primero si no hay uno seleccionado
  useEffect(() => {
    if (!selectedId && players.length > 0) {
      setSelectedId(initialId ?? players[0].id);
    }
  }, [players, initialId]);

  const loadAll = useCallback(async () => {
    if (!selectedId) return;
    const [hist, rMap] = await Promise.all([
      getWellness(selectedId, 7).catch(() => []),
      players.length > 0
        ? getLatestTeamWellness(players.map(p => p.id)).catch(() => ({}))
        : Promise.resolve({}),
    ]);
    setHistory(hist);
    setLatest(hist[0] ?? null);
    setRosterMap(rMap);
  }, [selectedId, players]);

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 30_000);
    return () => clearInterval(iv);
  }, [loadAll]);

  const status   = latest ? hooperStatus(latest.score) : 'neutral';
  const hasZones = latest && Object.keys(latest.activeZones || {}).length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Wellness · Hooper</h2>
        <p className="text-sm text-slate-400">Monitoreo subjetivo pre-sesión</p>
      </div>

      {/* Selector atleta */}
      {loadingPlayers ? (
        <p className="text-slate-500 text-sm">Cargando jugadores…</p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {players.map(p => {
            const w  = rosterMap[p.id];
            const st = w ? hooperStatus(w.score) : null;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  selectedId === p.id
                    ? 'bg-accent text-background border-accent'
                    : 'bg-surface text-slate-400 border-white/10 hover:text-slate-200'
                }`}
              >
                {p.name.split(' ')[0]} {p.name.split(' ')[1]?.[0]}.
                {st && st !== 'safe' && (
                  <span className={`ml-1.5 w-1.5 h-1.5 rounded-full inline-block align-middle
                    ${st === 'danger' ? 'bg-danger' : 'bg-warning'}`} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Sin datos */}
      {!latest ? (
        <Card>
          <div className="text-center py-4">
            <p className="text-slate-400 text-sm mb-1">Sin reporte de wellness</p>
            <p className="text-slate-600 text-xs leading-relaxed">
              El jugador debe completar el formulario QR para generar datos
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Score card */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <MetricDisplay value={latest.score} label="Índice Hooper" status={status} />
                <p className="text-xs text-slate-500 mt-1">
                  {isToday(latest.timestamp)
                    ? 'Reporte de hoy'
                    : `Último: ${formatDate(latest.timestamp)}`}
                </p>
              </div>
              <StatusBadge
                status={status}
                label={
                  status === 'danger'  ? 'Recuperar'  :
                  status === 'warning' ? 'Monitorear' : 'Listo'
                }
              />
            </div>
          </Card>

          {/* Métricas del último reporte */}
          <Card title="Último reporte" icon={Heart}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'sleep',    label: 'Sueño'  },
                { key: 'stress',   label: 'Estrés' },
                { key: 'fatigue',  label: 'Fatiga' },
                { key: 'soreness', label: 'Dolor'  },
              ].map(({ key, label }) => {
                const val = latest[key];
                return (
                  <div key={key} className="bg-background rounded-xl p-3 border border-white/5">
                    <p className="text-xs text-slate-500 mb-1">{label}</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-data font-bold text-slate-200">{val}</span>
                      <span className="text-xs text-slate-600">/7</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                      {LABELS[key]?.[val] || ''}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Mapa de calor — solo si hay zonas marcadas */}
          {hasZones && (
            <Card title="Zonas de dolor" icon={Map}>
              <BodyHeatmapSimple
                selectedZones={latest.activeZones}
                onSelectZone={() => {}}
                interactive={false}
              />
            </Card>
          )}
        </>
      )}

      {/* Historial últimos 7 registros */}
      {history.length > 0 && (
        <Card title="Historial" icon={Clock}>
          <div className="space-y-0">
            {history.map((r, i) => {
              const st = hooperStatus(r.score);
              return (
                <div key={i}
                  className="py-2.5 border-b border-white/5 last:border-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm text-slate-300 font-medium">
                      {formatDate(r.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-data font-bold text-slate-300">
                        {r.score}
                      </span>
                      <StatusBadge status={st} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Sueño {r.sleep} · Estrés {r.stress} · Fatiga {r.fatigue} · Dolor {r.soreness}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Resumen plantel */}
      <Card title="Estado plantel">
        <div className="space-y-2">
          {players.map(p => {
            const w  = rosterMap[p.id];
            const st = w ? hooperStatus(w.score) : null;
            return (
              <div key={p.id}
                className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-200">{p.name}</span>
                <div className="flex items-center gap-2">
                  {w ? (
                    <>
                      <span className="text-xs font-data text-slate-500">
                        Hooper {w.score} · {formatDate(w.timestamp)}
                      </span>
                      <StatusBadge status={st} />
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-slate-600">Sin reporte</span>
                      <span className="w-2 h-2 rounded-full bg-slate-700 inline-block flex-shrink-0" />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
