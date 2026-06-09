import { useState, useEffect } from 'react';
import BodyHeatmapSimple from '../components/BodyHeatmapSimple';
import { saveWellness, getPlayerWithCoach } from '../lib/db';
import { supabase } from '../lib/supabase';

const SLEEP = [
  { v: 1, e: '😴', l: 'Pésimo'    },
  { v: 2, e: '😟', l: 'Muy malo'  },
  { v: 3, e: '😕', l: 'Malo'      },
  { v: 4, e: '😐', l: 'Regular'   },
  { v: 5, e: '🙂', l: 'Bueno'     },
  { v: 6, e: '😊', l: 'Muy bueno' },
  { v: 7, e: '😄', l: 'Excelente' },
];

const STRESS = [
  { v: 1, e: '😌', l: 'Sin estrés' },
  { v: 2, e: '🙂', l: 'Muy leve'   },
  { v: 3, e: '😐', l: 'Leve'       },
  { v: 4, e: '😕', l: 'Moderado'   },
  { v: 5, e: '😟', l: 'Alto'       },
  { v: 6, e: '😰', l: 'Muy alto'   },
  { v: 7, e: '😱', l: 'Extremo'    },
];

const FATIGUE = [
  { v: 1, e: '⚡', l: 'Sin fatiga' },
  { v: 2, e: '🙂', l: 'Muy leve'   },
  { v: 3, e: '😐', l: 'Leve'       },
  { v: 4, e: '😕', l: 'Moderada'   },
  { v: 5, e: '😟', l: 'Alta'       },
  { v: 6, e: '😰', l: 'Muy alta'   },
  { v: 7, e: '💀', l: 'Extrema'    },
];

const SORENESS = [
  { v: 1, e: '✅', l: 'Sin dolor' },
  { v: 2, e: '🙂', l: 'Muy leve'  },
  { v: 3, e: '😐', l: 'Leve'      },
  { v: 4, e: '😕', l: 'Moderado'  },
  { v: 5, e: '😟', l: 'Alto'      },
  { v: 6, e: '😰', l: 'Muy alto'  },
  { v: 7, e: '🔥', l: 'Extremo'   },
];

const HEATMAP_LEVELS = ['normal', 'leve', 'moderado', 'alto', 'muy_alto'];

function calcScore(sleep, stress, fatigue, soreness) {
  return stress + (8 - sleep) + fatigue + soreness;
}

function scoreLevel(score) {
  if (score <= 12) return 'safe';
  if (score <= 18) return 'warning';
  return 'danger';
}

const SCORE_CONFIG = {
  safe:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   msg: '¡Listo para entrenar! 💪'  },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  msg: 'Entrenar con precaución ⚠️' },
  danger:  { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   msg: 'Recuperación prioritaria'   },
};

function ProgressBar({ step }) {
  const pct = ((step - 1) / 4) * 100;
  return (
    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: '#38bdf8' }}
      />
    </div>
  );
}

function OptionBtn({ opt, selected, onSelect }) {
  const active = selected === opt.v;
  return (
    <button
      onClick={() => onSelect(opt.v)}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl p-3 border
        transition-all duration-150 active:scale-95 w-full min-h-[64px]"
      style={{
        background:   active ? 'rgba(56,189,248,0.15)' : '#1e293b',
        borderColor:  active ? '#38bdf8' : 'rgba(255,255,255,0.08)',
      }}
    >
      <span style={{ fontSize: '22px', lineHeight: 1 }}>{opt.e}</span>
      <span
        className="text-xs font-semibold leading-none mt-0.5"
        style={{ color: active ? '#38bdf8' : '#94a3b8' }}
      >
        {opt.l}
      </span>
    </button>
  );
}

function OptionGrid({ options, selected, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt, i) => (
        <div
          key={opt.v}
          className={
            options.length % 2 === 1 && i === options.length - 1 ? 'col-span-2' : ''
          }
        >
          <OptionBtn opt={opt} selected={selected} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}

export default function HooperQR({ teamId }) {
  const [step, setStep]         = useState(0);
  const [player, setPlayer]     = useState(null);
  const [search, setSearch]     = useState('');
  const [sleep, setSleep]       = useState(0);
  const [stress, setStress]     = useState(0);
  const [fatigue, setFatigue]   = useState(0);
  const [soreness, setSoreness] = useState(0);
  const [activeZones, setZones] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [sentAt, setSentAt]     = useState(null);
  const [players, setPlayers]   = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [coachId,    setCoachId]    = useState(null);
  const [coachError, setCoachError] = useState(false);

  const isValidTeam = teamId && String(teamId).includes('-');

  useEffect(() => {
    if (!isValidTeam) return;
    setLoadingPlayers(true);
    supabase
      .from('players')
      .select('id, name, position')
      .eq('team_id', teamId)
      .order('name')
      .then(({ data }) => setPlayers(data ?? []))
      .finally(() => setLoadingPlayers(false));
  }, [teamId]);

  function handleZone(id) {
    setZones(prev => {
      const cur  = prev[id] || 'normal';
      const next = HEATMAP_LEVELS[(HEATMAP_LEVELS.indexOf(cur) + 1) % HEATMAP_LEVELS.length];
      return { ...prev, [id]: next };
    });
  }

  function selectPlayer(p) {
    setPlayer(p);
    setCoachId(null);
    setCoachError(false);
    setStep(1);
    getPlayerWithCoach(p.id)
      .then(data => {
        const cid = data.teams?.coach_id ?? null;
        if (!cid) { setCoachError(true); return; }
        setCoachId(cid);
      })
      .catch(() => setCoachError(true));
  }
  function selectSleep(v)   { setSleep(v);    setStep(2); }
  function selectStress(v)  { setStress(v);   setStep(3); }
  function selectFatigue(v) { setFatigue(v);  setStep(4); }
  function selectSoreness(v) {
    setSoreness(v);
    if (v < 4) {
      setZones({});
      setStep(5);
    }
  }

  async function handleSend() {
    if (!coachId) return;
    const now   = new Date();
    const score = calcScore(sleep, stress, fatigue, soreness);
    setSaveError(null);
    try {
      await saveWellness({
        player_id:    player.id,
        coach_id:     coachId,
        date:         now.toISOString().split('T')[0],
        sleep, stress, fatigue, soreness, score,
        active_zones: activeZones,
      });
      setSentAt(now);
      setConfirmed(true);
    } catch {
      setSaveError('No se pudo guardar. Intentá de nuevo.');
    }
  }

  function reset() {
    setStep(0); setPlayer(null); setSearch(''); setCoachId(null); setCoachError(false);
    setSleep(0); setStress(0); setFatigue(0); setSoreness(0);
    setZones({}); setConfirmed(false); setSentAt(null); setSaveError(null);
  }

  const score    = sleep && stress && fatigue && soreness
    ? calcScore(sleep, stress, fatigue, soreness) : null;
  const level    = score !== null ? scoreLevel(score) : null;
  const cfg      = level ? SCORE_CONFIG[level] : null;
  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // QR inválido
  if (!isValidTeam) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0f1a' }}>
        <p className="text-slate-400 text-center text-sm">QR inválido. Pedile el link actualizado al entrenador.</p>
      </div>
    );
  }

  // Pantalla de confirmación
  if (confirmed) {
    const fecha = sentAt.toLocaleDateString('es-AR');
    const hora  = sentAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 qr-fade-in"
        style={{ background: '#0a0f1a' }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6
            text-3xl font-bold qr-scale-in"
          style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e',
                   color: '#22c55e' }}
        >
          ✓
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          ¡Gracias, {player.name.split(' ')[0]}!
        </h2>
        <p className="text-slate-400 text-center text-sm mb-1">Tu reporte fue enviado.</p>
        <p className="text-slate-600 text-center text-xs mb-6">{fecha} — {hora}</p>
        <button
          onClick={reset}
          className="w-full max-w-xs py-4 rounded-2xl font-bold text-sm
            active:scale-95 transition-all"
          style={{ background: '#38bdf8', color: '#0a0f1a' }}
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0a0f1a' }}>
      <div className="max-w-sm mx-auto px-4 pt-6 pb-10 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between min-h-[28px]">
          <span className="text-lg font-black tracking-tight" style={{ color: '#38bdf8' }}>
            FieldLab
          </span>
          {player && step > 0 && (
            <span className="text-xs text-slate-500 truncate ml-4 max-w-[200px]">
              {player.name}
            </span>
          )}
        </div>

        {/* Barra de progreso */}
        {step >= 1 && step <= 5 && <ProgressBar step={step} />}

        {/* Contenido del paso actual */}
        <div key={step} className="qr-fade-in flex flex-col gap-4">

          {/* PASO 0 — Elegir jugador */}
          {step === 0 && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Buen día</h2>
                <p className="text-slate-400 text-sm">Seleccioná tu nombre para comenzar</p>
              </div>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm border text-slate-100
                  focus:outline-none placeholder:text-slate-600 focus:border-accent"
                style={{ background: '#1e293b', borderColor: 'rgba(255,255,255,0.08)' }}
              />
              <div className="grid grid-cols-2 gap-2">
                {loadingPlayers ? (
                  <p className="col-span-2 text-center text-slate-500 text-sm py-8">
                    Cargando jugadores…
                  </p>
                ) : filtered.length === 0 ? (
                  <p className="col-span-2 text-center text-slate-500 text-sm py-8">
                    Sin resultados
                  </p>
                ) : filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPlayer(p)}
                    className="flex flex-col items-start p-4 rounded-2xl border text-left
                      transition-all active:scale-95 min-h-[72px]"
                    style={{ background: '#1e293b', borderColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-sm font-semibold text-white leading-snug">
                      {p.name}
                    </span>
                    <span className="text-xs text-slate-500 mt-0.5">{p.position}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* PASO 1 — Sueño */}
          {step === 1 && (
            <>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Paso 1 de 4</p>
                <h2 className="text-xl font-bold text-white leading-tight">¿Cómo dormiste anoche?</h2>
              </div>
              <OptionGrid options={SLEEP} selected={sleep} onSelect={selectSleep} />
            </>
          )}

          {/* PASO 2 — Estrés */}
          {step === 2 && (
            <>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Paso 2 de 4</p>
                <h2 className="text-xl font-bold text-white leading-tight">¿Cómo está tu nivel de estrés?</h2>
              </div>
              <OptionGrid options={STRESS} selected={stress} onSelect={selectStress} />
            </>
          )}

          {/* PASO 3 — Fatiga */}
          {step === 3 && (
            <>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Paso 3 de 4</p>
                <h2 className="text-xl font-bold text-white leading-tight">¿Cómo está tu nivel de fatiga?</h2>
              </div>
              <OptionGrid options={FATIGUE} selected={fatigue} onSelect={selectFatigue} />
            </>
          )}

          {/* PASO 4 — Dolor / DOMS */}
          {step === 4 && (
            <>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Paso 4 de 4</p>
                <h2 className="text-xl font-bold text-white leading-tight">¿Tenés dolores musculares?</h2>
              </div>
              <OptionGrid options={SORENESS} selected={soreness} onSelect={selectSoreness} />
              {soreness >= 4 && (
                <>
                  <p className="text-xs text-slate-400 text-center -mb-1">
                    Marcá las zonas con dolor (opcional)
                  </p>
                  <BodyHeatmapSimple
                    selectedZones={activeZones}
                    onSelectZone={handleZone}
                    interactive={true}
                  />
                  <button
                    onClick={() => setStep(5)}
                    className="w-full py-4 rounded-2xl font-bold text-sm
                      active:scale-95 transition-all"
                    style={{ background: '#38bdf8', color: '#0a0f1a' }}
                  >
                    Siguiente
                  </button>
                </>
              )}
            </>
          )}

          {/* PASO 5 — Resumen y envío */}
          {step === 5 && score !== null && cfg && (
            <>
              <h2 className="text-xl font-bold text-white">Resumen</h2>

              <div
                className="rounded-2xl p-5 border"
                style={{ background: cfg.bg, borderColor: cfg.color }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider mb-1"
                      style={{ color: cfg.color, opacity: 0.8 }}>
                      Índice Hooper
                    </p>
                    <p className="text-5xl font-black font-data" style={{ color: cfg.color }}>
                      {score}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">/ 28 máximo</p>
                  </div>
                  <p className="text-sm font-semibold text-right max-w-[150px] leading-snug"
                    style={{ color: cfg.color }}>
                    {cfg.msg}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Sueño',  val: sleep,    opts: SLEEP    },
                  { label: 'Estrés', val: stress,   opts: STRESS   },
                  { label: 'Fatiga', val: fatigue,  opts: FATIGUE  },
                  { label: 'Dolor',  val: soreness, opts: SORENESS },
                ].map(({ label, val, opts }) => {
                  const opt = opts.find(o => o.v === val);
                  return (
                    <div
                      key={label}
                      className="rounded-xl p-3 border"
                      style={{ background: '#1e293b', borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <p className="text-xs text-slate-500 mb-1">{label}</p>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '18px', lineHeight: 1 }}>{opt?.e}</span>
                        <span className="text-sm font-semibold text-slate-200">{opt?.l}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {soreness >= 6 && (
                <div
                  className="rounded-xl px-4 py-3 border"
                  style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' }}
                >
                  <p className="text-xs font-semibold" style={{ color: '#ef4444' }}>
                    Dolor severo — consultar al preparador físico
                  </p>
                </div>
              )}

              {saveError && (
                <p className="text-sm text-red-400 text-center">{saveError}</p>
              )}

              {coachError && !coachId && (
                <p className="text-sm text-red-400 text-center">
                  Error al cargar datos. Volvé al inicio y seleccioná el jugador de nuevo.
                </p>
              )}

              <button
                onClick={handleSend}
                disabled={!coachId}
                className="w-full py-4 rounded-2xl font-black text-base uppercase
                  tracking-widest active:scale-95 transition-all mt-1"
                style={{ background: '#38bdf8', color: '#0a0f1a', opacity: coachId ? 1 : 0.7 }}
              >
                {coachId ? 'Enviar' : 'Cargando...'}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
