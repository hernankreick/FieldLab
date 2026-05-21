import { useState, useEffect } from 'react';
import { Zap, Target, Trophy, Moon, Save, Link2, RefreshCw } from 'lucide-react';
import Card from '../components/Card';
import { getAllTodayRPEs, saveSession } from '../utils/storage';

// ─── Constantes ───────────────────────────────────────────────────────────────

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

const SESSION_TYPES = [
  { id: 'fisico',   label: 'Físico',   Icon: Zap    },
  { id: 'tactico',  label: 'Táctico',  Icon: Target },
  { id: 'partido',  label: 'Partido',  Icon: Trophy },
  { id: 'descanso', label: 'Descanso', Icon: Moon   },
];

// ─── Helpers de módulo ────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function todayLabel() {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  });
}

// Color para el RPE visual 1-5 (el interno se guarda como v×2)
const RPE_VISUAL_COLORS = {
  1: '#22c55e',
  2: '#84cc16',
  3: '#f59e0b',
  4: '#f97316',
  5: '#ef4444',
};

function rpeColor(internalRpe) {
  // internalRpe proviene de localStorage: 2, 4, 6, 8 o 10
  return RPE_VISUAL_COLORS[internalRpe / 2] ?? '#94a3b8';
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CargaSesionView() {
  const [sessionType, setSessionType] = useState('fisico');
  const [minutes,     setMinutes]     = useState(90);
  const [rpeMap,      setRpeMap]      = useState({});
  const [saved,       setSaved]       = useState(false);
  const [copied,      setCopied]      = useState(false);

  // Refresca el mapa de RPEs desde localStorage
  function refresh() {
    setRpeMap(getAllTodayRPEs());
  }

  useEffect(() => {
    refresh();

    // Polling cada 15 segundos para captar nuevos envíos desde el formulario
    const interval = setInterval(refresh, 15_000);

    // Escucha cambios desde otras pestañas
    window.addEventListener('storage', refresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  // ─── Valores derivados ───────────────────────────────────────────────────────

  const isDescanso = sessionType === 'descanso';

  const players = TEAM_PLAYERS.map(p => {
    const rec  = rpeMap[String(p.id)];
    const rpe  = rec?.rpe ?? null;
    const load = isDescanso ? 0 : rpe !== null ? rpe * minutes : null;
    return { ...p, rpe, load };
  });

  const withRPE = players.filter(p => p.rpe !== null);

  const avgLoad = withRPE.length > 0
    ? Math.round(withRPE.reduce((s, p) => s + p.load, 0) / withRPE.length)
    : 0;

  // avgRPE se muestra en escala visual 1-5 (interno ÷ 2)
  const avgRPE = withRPE.length > 0
    ? (withRPE.reduce((s, p) => s + p.rpe, 0) / withRPE.length / 2).toFixed(1)
    : '—';

  // ─── Guardar sesión ──────────────────────────────────────────────────────────

  function handleSave() {
    saveSession({
      date:    todayDate(),
      type:    sessionType,
      minutes,
      players: players.map(p => ({
        playerId:   p.id,
        playerName: p.name,
        rpe:        p.rpe,
        load:       p.load ?? 0,
      })),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // ─── Copiar URL del formulario ───────────────────────────────────────────────

  const rpeFormUrl = `${window.location.origin}/rpe/team_001`;

  function markCopied() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function fallbackCopy() {
    // Intento 2: execCommand con input temporal (funciona en iOS Safari < 13.4)
    const el = document.createElement('input');
    el.value = rpeFormUrl;
    el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length); // necesario en iOS
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    if (ok) {
      markCopied();
    } else {
      // Intento 3: alert como último recurso
      alert(`Copiá este link:\n\n${rpeFormUrl}`);
    }
  }

  function handleCopyUrl() {
    // Intento 1: API moderna (requiere HTTPS y permiso en iOS 13.4+)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(rpeFormUrl)
        .then(markCopied)
        .catch(fallbackCopy);
      return;
    }
    fallbackCopy();
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Encabezado */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">Carga de Sesión</h2>
        <p className="text-sm text-slate-400 capitalize">{todayLabel()}</p>
      </div>

      {/* Tipo de sesión */}
      <Card title="Tipo de sesión">
        <div className="grid grid-cols-2 gap-2">
          {SESSION_TYPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setSessionType(id)}
              className={[
                'flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-95',
                sessionType === id
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-white/10 bg-background text-slate-400 hover:text-slate-200',
              ].join(' ')}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Duración — solo cuando no es descanso */}
      {!isDescanso && (
        <Card title="Duración">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={minutes}
              onChange={e => setMinutes(Math.max(1, parseInt(e.target.value) || 90))}
              className="w-20 text-center text-lg font-data bg-background border border-white/10 rounded-xl px-2 py-2 text-slate-100 focus:outline-none focus:border-accent"
            />
            <span className="text-slate-400 text-sm">minutos</span>
            <span className="ml-auto text-xs text-slate-500">Carga = RPE × min</span>
          </div>
        </Card>
      )}

      {/* Lista de jugadores */}
      <Card title={`RPE del plantel · ${withRPE.length}/${TEAM_PLAYERS.length} reportaron`}>
        <div className="space-y-2">
          {players.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1">

              {/* Nombre y posición */}
              <div>
                <p className="text-sm font-medium text-slate-200">{p.name}</p>
                <p className="text-xs text-slate-500">{p.position}</p>
              </div>

              {/* Estado RPE */}
              <div className="flex items-center gap-2">
                {isDescanso ? (
                  <span className="text-sm text-slate-500">Descanso</span>
                ) : p.rpe !== null ? (
                  <>
                    <span className="text-sm text-slate-500">{p.load} UA</span>
                    <span
                      className="inline-block px-2 py-0.5 rounded-lg font-bold font-data text-sm"
                      style={{
                        background: rpeColor(p.rpe) + '26',
                        color:      rpeColor(p.rpe),
                      }}
                    >
                      {p.rpe / 2}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-warning">Sin RPE</span>
                )}
              </div>

            </div>
          ))}
        </div>
      </Card>

      {/* Resumen de carga — solo cuando hay datos y no es descanso */}
      {!isDescanso && withRPE.length > 0 && (
        <Card>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500 mb-1">Carga media</p>
              <p className="text-2xl font-bold font-data text-accent">
                {avgLoad} <span className="text-base font-normal text-slate-400">UA</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">RPE medio</p>
              <p className="text-2xl font-bold font-data text-slate-200">{avgRPE}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Enlace al formulario RPE */}
      <div className="bg-surface rounded-fieldlab p-4 border border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-slate-300">
            <Link2 size={16} />
            <span className="text-sm font-medium">Formulario RPE</span>
          </div>
          <button
            onClick={refresh}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Actualizar RPEs"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="bg-background rounded-lg px-3 py-2 flex items-center justify-between gap-2">
          <span className="font-data text-xs text-slate-400 break-all">{rpeFormUrl}</span>
          <button
            onClick={handleCopyUrl}
            className="shrink-0 text-xs font-medium transition-colors"
            style={{ color: copied ? '#22c55e' : '#38bdf8' }}
          >
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
        </div>
      </div>

      {/* Botón guardar */}
      <button
        onClick={handleSave}
        className={[
          'w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all',
          saved
            ? 'bg-success/20 text-success border border-success/30'
            : '',
        ].join(' ')}
        style={saved ? {} : { background: '#38bdf8', color: '#0a0f1a' }}
      >
        <Save size={18} />
        {saved ? 'Sesión guardada' : 'Guardar sesión'}
      </button>

    </div>
  );
}
