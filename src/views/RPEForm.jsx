import { useState } from 'react';
import { saveRPE } from '../utils/storage';

// Jugadores del equipo (misma lista que HooperQR)
const TEAM_PLAYERS = [
  { id: 1, name: 'Ramiro Sánchez',   position: 'Fullback'      },
  { id: 2, name: 'Leandro Martínez', position: 'Apertura'      },
  { id: 3, name: 'Tomás Ruiz',       position: 'Hooker'        },
  { id: 4, name: 'Facundo Benítez',  position: 'Ala'           },
  { id: 5, name: 'Agustín Torres',   position: 'Centro'        },
  { id: 6, name: 'Lucía Fernández',  position: 'Mediocampista' },
  { id: 7, name: 'Valentina López',  position: 'Delantera'     },
  { id: 8, name: 'Martín González',  position: 'Delantero'     },
];

// Escala de Borg CR-10 adaptada al español
const RPE_SCALE = [
  { v: 1,  label: 'Muy muy suave'   },
  { v: 2,  label: 'Muy suave'       },
  { v: 3,  label: 'Suave'           },
  { v: 4,  label: 'Algo duro'       },
  { v: 5,  label: 'Duro'            },
  { v: 6,  label: 'Duro'            },
  { v: 7,  label: 'Muy duro'        },
  { v: 8,  label: 'Muy duro'        },
  { v: 9,  label: 'Muy muy duro'    },
  { v: 10, label: 'Máximo esfuerzo' },
];

// Devuelve el color semáforo según el valor RPE
function rpeColor(v) {
  if (v <= 3) return '#22c55e';
  if (v <= 6) return '#f59e0b';
  if (v <= 8) return '#f97316';
  return '#ef4444';
}

// Fecha de hoy en formato YYYY-MM-DD
function todayDate() {
  return new Date().toISOString().split('T')[0];
}

export default function RPEForm({ teamId }) {
  const [step,      setStep]      = useState(0);
  const [player,    setPlayer]    = useState(null);
  const [search,    setSearch]    = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [sentRPE,   setSentRPE]   = useState(null);

  // Guarda el RPE y avanza a la pantalla de confirmación
  function selectRPE(v) {
    saveRPE({
      playerId:   player.id,
      playerName: player.name,
      timestamp:  new Date().toISOString(),
      rpe:        v,
      date:       todayDate(),
    });
    setSentRPE(v);
    setConfirmed(true);
  }

  // Reinicia todo el estado al inicio
  function reset() {
    setStep(0);
    setPlayer(null);
    setSearch('');
    setConfirmed(false);
    setSentRPE(null);
  }

  const filtered = TEAM_PLAYERS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Pantalla de confirmación tras registrar el RPE
  if (confirmed) {
    const color     = rpeColor(sentRPE);
    const firstName = player.name.split(' ')[0];
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 qr-fade-in"
        style={{ background: '#0a0f1a' }}
      >
        {/* Círculo con el número RPE en el color correspondiente */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6
            text-3xl font-black qr-scale-in"
          style={{
            background: color + '26',
            border:     `2px solid ${color}`,
            color,
          }}
        >
          {sentRPE}
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-2">
          ¡Gracias, {firstName}! RPE {sentRPE} registrado.
        </h2>
        <p className="text-slate-400 text-center text-sm mb-10">
          Tu esfuerzo quedó guardado.
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

  return (
    <div className="min-h-screen" style={{ background: '#0a0f1a' }}>
      <div className="max-w-sm mx-auto px-4 pt-6 pb-10 flex flex-col gap-4">

        {/* Encabezado con logo y nombre del jugador seleccionado */}
        <div className="flex items-center justify-between min-h-[28px]">
          <span className="text-lg font-black tracking-tight" style={{ color: '#38bdf8' }}>
            FieldLab
          </span>
          {player && (
            <span className="text-xs text-slate-500 truncate ml-4 max-w-[200px]">
              {player.name}
            </span>
          )}
        </div>

        <div key={step} className="qr-fade-in flex flex-col gap-4">

          {/* PASO 0 — Selección de jugador */}
          {step === 0 && (
            <>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">RPE de sesión</h2>
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
                {filtered.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPlayer(p); setStep(1); }}
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
                {filtered.length === 0 && (
                  <p className="col-span-2 text-center text-slate-500 text-sm py-8">
                    Sin resultados
                  </p>
                )}
              </div>
            </>
          )}

          {/* PASO 1 — Grilla RPE (toque inmediato guarda y confirma) */}
          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight mb-1">
                  ¿Cómo fue el esfuerzo?
                </h2>
                <p className="text-slate-400 text-sm">
                  Tocá el número que mejor describe tu sesión
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {RPE_SCALE.map(({ v, label }) => {
                  const color = rpeColor(v);
                  return (
                    <button
                      key={v}
                      onClick={() => selectRPE(v)}
                      className="flex items-center gap-3 p-4 rounded-2xl border
                        transition-all active:scale-95"
                      style={{
                        background:   '#1e293b',
                        borderColor:  'rgba(255,255,255,0.08)',
                      }}
                    >
                      {/* Número grande con color semáforo */}
                      <span
                        className="text-2xl font-black font-data w-8 text-center"
                        style={{ color }}
                      >
                        {v}
                      </span>
                      {/* Etiqueta descriptiva */}
                      <span className="text-xs text-slate-400 leading-tight text-left">
                        {label}
                      </span>
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
