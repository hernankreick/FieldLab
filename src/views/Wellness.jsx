import { useState, useEffect } from 'react';
import { Heart, Map, Clock } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import BodyHeatmapSimple from '../components/BodyHeatmapSimple';
import { getWellnessByPlayer, getLatestWellness, getAllLatestWellness } from '../utils/storage';

// IDs deben coincidir con TEAM_PLAYERS en HooperQR
const ATHLETES = [
  { id: 1, name: 'Ramiro S.'    },
  { id: 2, name: 'Leandro M.'   },
  { id: 3, name: 'Tomás R.'     },
  { id: 4, name: 'Facundo B.'   },
  { id: 5, name: 'Agustín T.'   },
  { id: 6, name: 'Lucía F.'     },
  { id: 7, name: 'Valentina L.' },
  { id: 8, name: 'Martín G.'    },
];

// Etiquetas para valores 1-7 de cada métrica
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
  const [selectedId, setSelectedId] = useState(initialId ?? ATHLETES[0].id);
  const [latest,     setLatest]     = useState(null);
  const [history,    setHistory]    = useState([]);
  const [rosterMap,  setRosterMap]  = useState({});

  useEffect(() => {
    function loadAll() {
      setLatest(getLatestWellness(selectedId));
      setHistory(getWellnessByPlayer(selectedId).slice(0, 7));
      setRosterMap(getAllLatestWellness());
    }
    loadAll();
    const iv       = setInterval(loadAll, 30_000);
    const onStorage = () => loadAll();
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(iv); window.removeEventListener('storage', onStorage); };
  }, [selectedId]);

  const status   = latest ? hooperStatus(latest.score) : 'neutral';
  const hasZones = latest && Object.keys(latest.activeZones || {}).length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Wellness · Hooper</h2>
        <p className="text-sm text-slate-400">Monitoreo subjetivo pre-sesión</p>
      </div>

      {/* Selector atleta */}
      <div className="flex gap-2 flex-wrap">
        {ATHLETES.map(({ id, name }) => {
          const w  = rosterMap[String(id)];
          const st = w ? hooperStatus(w.score) : null;
          return (
            <button
              key={id}
              onClick={() => setSelectedId(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                selectedId === id
                  ? 'bg-accent text-background border-accent'
                  : 'bg-surface text-slate-400 border-white/10 hover:text-slate-200'
              }`}
            >
              {name}
              {st && st !== 'safe' && (
                <span className={`ml-1.5 w-1.5 h-1.5 rounded-full inline-block align-middle
                  ${st === 'danger' ? 'bg-danger' : 'bg-warning'}`} />
              )}
            </button>
          );
        })}
      </div>

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
          {ATHLETES.map(({ id, name }) => {
            const w  = rosterMap[String(id)];
            const st = w ? hooperStatus(w.score) : null;
            return (
              <div key={id}
                className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
                <span className="text-sm text-slate-200">{name}</span>
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
