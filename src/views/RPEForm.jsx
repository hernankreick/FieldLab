import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getPlayerWithCoach } from '../lib/db';

const RPE_SCALE = [
  { v: 1, label: 'Recuperación',    color: '#22c55e' },
  { v: 2, label: 'Suave',           color: '#84cc16' },
  { v: 3, label: 'Moderado',        color: '#f59e0b' },
  { v: 4, label: 'Intenso',         color: '#f97316' },
  { v: 5, label: 'Máximo esfuerzo', color: '#ef4444' },
];

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

export default function RPEForm({ teamId }) {
  const [step,     setStep]     = useState(0);
  const [player,   setPlayer]   = useState(null);
  const [search,   setSearch]   = useState('');
  const [pressing, setPressing] = useState(null);
  const [sentItem, setSentItem] = useState(null);
  const [players,       setPlayers]       = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [saveError,     setSaveError]     = useState(null);
  const [coachId,       setCoachId]       = useState(null);
  const submittingRef = useRef(false);

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

  function handleSelectPlayer(p) {
    setPlayer(p);
    setCoachId(null);
    setStep(1);
    getPlayerWithCoach(p.id)
      .then(data => setCoachId(data.teams?.coach_id ?? null))
      .catch(() => {});
  }

  async function selectRPE(item) {
    if (submittingRef.current || !coachId) return;
    submittingRef.current = true;
    setPressing(item.v);
    navigator.vibrate?.(60);
    setTimeout(async () => {
      const { error } = await supabase.from('loads').insert({
        player_id: player.id,
        coach_id:  coachId,
        date:      todayDate(),
        rpe:       item.v * 2,
        load:      0,
      });
      if (error) {
        console.error('RPE insert error:', error);
        setSaveError('No se pudo guardar. Intentá de nuevo.');
        submittingRef.current = false;
        setPressing(null);
        return;
      }
      setSentItem(item);
      setPressing(null);
    }, 140);
  }

  function reset() {
    submittingRef.current = false;
    setStep(0);
    setPlayer(null);
    setCoachId(null);
    setSearch('');
    setSentItem(null);
    setPressing(null);
    setSaveError(null);
  }

  const filtered = players.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const BG = 'linear-gradient(160deg, #0a0f1a 0%, #0d1627 100%)';

  // QR inválido o antiguo
  if (!isValidTeam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 pb-12"
        style={{ background: BG }}>
        <p className="text-slate-400 text-center text-sm leading-relaxed">
          QR inválido. Pedile el link actualizado al entrenador.
        </p>
      </div>
    );
  }

  // ── Pantalla de confirmación ──────────────────────────────────────────────────
  if (sentItem) {
    const { v, label, color } = sentItem;
    const firstName = player.name.split(' ')[0];
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-8 pb-12 qr-fade-in"
        style={{ background: BG }}
      >
        <div
          className="w-28 h-28 rounded-full flex flex-col items-center justify-center mb-8 qr-scale-in"
          style={{
            background:  `${color}18`,
            border:      `2px solid ${color}`,
            boxShadow:   `0 0 40px ${color}50`,
            color,
          }}
        >
          <span className="text-5xl font-black leading-none">{v}</span>
        </div>

        <p
          className="text-xs font-bold uppercase tracking-[0.2em] mb-3"
          style={{ color }}
        >
          {label}
        </p>

        <h2 className="text-2xl font-black text-white text-center mb-2">
          ¡Gracias, {firstName}!
        </h2>
        <p className="text-slate-500 text-sm text-center mb-14 leading-relaxed">
          Tu esfuerzo quedó registrado
        </p>

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

  // ── Formulario principal ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-sm mx-auto px-5 pt-8 pb-14 flex flex-col gap-7">

        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-black tracking-tight" style={{ color: '#38bdf8' }}>
            FieldLab
          </span>
          {player && step === 1 && (
            <button
              onClick={() => { setStep(0); setPlayer(null); }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cambiar jugador
            </button>
          )}
        </div>

        <div key={step} className="qr-fade-in flex flex-col gap-6">

          {/* PASO 0 — Selección de jugador */}
          {step === 0 && (
            <>
              <div>
                <h2 className="text-3xl font-black text-white mb-1">RPE de sesión</h2>
                <p className="text-slate-500 text-sm">Seleccioná tu nombre para continuar</p>
              </div>

              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm border text-slate-100
                  focus:outline-none placeholder:text-slate-600 focus:border-sky-400/40
                  transition-colors"
                style={{
                  background:   'rgba(255,255,255,0.05)',
                  borderColor:  'rgba(255,255,255,0.08)',
                }}
              />

              <div className="grid grid-cols-2 gap-3">
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
                    onClick={() => handleSelectPlayer(p)}
                    className="flex flex-col items-start p-4 rounded-2xl border text-left
                      transition-all active:scale-95 min-h-[72px]"
                    style={{
                      background:  'rgba(255,255,255,0.04)',
                      borderColor: 'rgba(255,255,255,0.08)',
                    }}
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

          {/* PASO 1 — Selección de RPE */}
          {step === 1 && (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                  {player.name}
                </p>
                <h2 className="text-3xl font-black text-white leading-tight mb-1">
                  ¿Cómo estuvo<br />la sesión?
                </h2>
                <p className="text-slate-500 text-sm">Tocá tu percepción de esfuerzo</p>
              </div>

              {saveError && (
                <p className="text-sm text-red-400 text-center">{saveError}</p>
              )}

              <div className="flex flex-col gap-3">
                {RPE_SCALE.map((item) => {
                  const { v, label, color } = item;
                  const isPressed = pressing === v;
                  return (
                    <button
                      key={v}
                      onClick={() => selectRPE(item)}
                      className="w-full flex items-center gap-5 px-6 py-5 rounded-2xl border
                        text-left transition-all active:scale-[0.97]"
                      style={{
                        background:  isPressed ? `${color}22` : `${color}0c`,
                        borderColor: isPressed ? color         : `${color}28`,
                        boxShadow:   isPressed ? `0 0 24px ${color}35` : 'none',
                        transform:   isPressed ? 'scale(0.97)' : 'scale(1)',
                      }}
                    >
                      <span
                        className="text-4xl font-black font-data w-10 text-center shrink-0
                          leading-none tabular-nums"
                        style={{ color }}
                      >
                        {v}
                      </span>
                      <p className="text-base font-semibold text-white">{label}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
