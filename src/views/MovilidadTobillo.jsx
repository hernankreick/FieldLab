import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  useAngleDetection,
  getAngleStatus,
  statusColor,
  statusLabel,
  statusBg,
  NORMAS,
} from '../hooks/useAngleDetection';
import { useAuth } from '../context/AuthContext';
import { PLAYERS } from '../data/players';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInterpretation(angle, sport) {
  const n = NORMAS[sport] ?? NORMAS.default;
  if (angle >= n.optimo) return 'Rango óptimo. Sin restricción funcional.';
  if (angle >= n.precaucion) {
    return 'Restricción leve. Puede afectar la mecánica de carrera y cambio de dirección.';
  }
  return 'Restricción significativa. Riesgo aumentado de lesión de rodilla y tobillo.';
}

function calcAsimetria(a, b) {
  const mayor = Math.max(a, b);
  if (mayor === 0) return 0;
  return Math.round(((mayor - Math.min(a, b)) / mayor) * 100);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ── CameraSessionView ─────────────────────────────────────────────────────────
// Handles calibracion → grabando internally to avoid remounting between phases.
// key="left" or key="right" in parent ensures separate instances per side.

function CameraSessionView({ side, startPhase, sport, onCapture }) {
  const [phase, setPhase] = useState(startPhase ?? 'calibracion');

  const {
    videoRef, canvasRef,
    angle, landmarks,
    mpLoading, mpError, cameraError,
    startCamera, stopCamera,
  } = useAngleDetection({ side, sport });

  useEffect(() => {
    startCamera();
    return () => { stopCamera(); };
  }, [startCamera, stopCamera]);

  const hasLm  = !!landmarks;
  const st     = angle != null ? getAngleStatus(angle, sport) : null;
  const col    = st ? statusColor(st) : '#38bdf8';
  const bgCol  = st ? statusBg(st)    : 'rgba(56,189,248,0.1)';

  if (mpLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#38bdf8', borderTopColor: 'transparent' }} />
        <p className="text-slate-400 text-sm">Iniciando cámara y MediaPipe…</p>
      </div>
    );
  }

  if (mpError) {
    return (
      <div className="p-4 rounded-xl text-sm text-red-400"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
        {mpError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video + canvas overlay */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-950"
        style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          playsInline autoPlay muted
          className="w-full h-full object-cover"
        />
        <canvas
          ref={canvasRef}
          width={640} height={480}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Live angle badge — shown in grabando phase */}
        {phase === 'grabando' && angle != null && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 px-5 py-2 rounded-2xl"
            style={{
              background: bgCol,
              border: `2px solid ${col}`,
              backdropFilter: 'blur(8px)',
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '72px',
                fontWeight: 900,
                color: col,
                lineHeight: 1,
                display: 'block',
                textAlign: 'center',
              }}
            >
              {angle}°
            </span>
          </div>
        )}

        {/* Landmark status in calibracion */}
        {phase === 'calibracion' && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
            style={{
              background: hasLm ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
              border: `1px solid ${hasLm ? '#22c55e' : '#ef4444'}`,
              color: hasLm ? '#22c55e' : '#ef4444',
            }}
          >
            {hasLm ? '✓ Landmarks detectados' : '⬤ Buscando landmarks…'}
          </div>
        )}
      </div>

      {/* Camera error */}
      {cameraError && (
        <div className="p-3 rounded-xl text-sm text-red-400"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          {cameraError}
        </div>
      )}

      {/* Calibracion controls */}
      {phase === 'calibracion' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400 text-center leading-relaxed">
            Ajustá el encuadre hasta ver los 3 puntos (cadera · rodilla · tobillo)
          </p>
          <button
            onClick={() => setPhase('grabando')}
            disabled={!hasLm}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-colors"
            style={{
              background: hasLm ? '#38bdf8' : '#334155',
              color:      hasLm ? '#0f172a' : '#64748b',
              cursor:     hasLm ? 'pointer' : 'not-allowed',
            }}
          >
            {hasLm
              ? `Listo — Evaluar ${side === 'left' ? 'Izquierdo' : 'Derecho'}`
              : 'Esperando detección…'}
          </button>
        </div>
      )}

      {/* Grabando controls */}
      {phase === 'grabando' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400 text-center">
            Flexioná la rodilla al máximo y capturá el ángulo pico.
          </p>
          <button
            onClick={() => onCapture(angle)}
            disabled={angle == null}
            className="w-full py-4 rounded-xl font-bold text-base transition-colors"
            style={{
              background: angle != null ? '#38bdf8' : '#334155',
              color:      angle != null ? '#0f172a' : '#64748b',
              cursor:     angle != null ? 'pointer' : 'not-allowed',
            }}
          >
            📐 Capturar ángulo máximo
            {angle != null && (
              <span className="ml-2 opacity-70 font-normal">({angle}°)</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── ResultScreen ──────────────────────────────────────────────────────────────

function ResultScreen({ side, angle, sport, onNext, nextLabel }) {
  const st    = getAngleStatus(angle, sport);
  const col   = statusColor(st);
  const bg    = statusBg(st);
  const label = statusLabel(st);
  const interp = getInterpretation(angle, sport);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-100 text-center">
        Resultado — {side === 'left' ? 'Izquierdo' : 'Derecho'}
      </h2>

      {/* Angle */}
      <div className="rounded-2xl p-8 flex flex-col items-center gap-4"
        style={{ background: bg, border: `2px solid ${col}` }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '96px',
            fontWeight: 900,
            color: col,
            lineHeight: 1,
          }}
        >
          {angle}°
        </span>
        <div
          className="px-5 py-1.5 rounded-full font-bold text-sm"
          style={{ background: col, color: '#0f172a' }}
        >
          {label}
        </div>
      </div>

      {/* Interpretation */}
      <div className="rounded-xl p-4"
        style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-sm text-slate-300 leading-relaxed">{interp}</p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl font-semibold text-sm"
        style={{ background: '#38bdf8', color: '#0f172a' }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

// ── SummaryScreen ─────────────────────────────────────────────────────────────

function SideCard({ label, angle, sport }) {
  const st  = getAngleStatus(angle, sport);
  const col = statusColor(st);
  const bg  = statusBg(st);
  const lbl = statusLabel(st);

  return (
    <div className="flex-1 rounded-xl p-4 flex flex-col items-center gap-2"
      style={{ background: bg, border: `1px solid ${col}` }}>
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
        {label}
      </p>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '52px',
          fontWeight: 900,
          color: col,
          lineHeight: 1,
        }}
      >
        {angle}°
      </span>
      <span
        className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: col, color: '#0f172a' }}
      >
        {lbl}
      </span>
    </div>
  );
}

function SummaryScreen({ izq, der, sport, coachId, athleteId, onRestart, onNavigate }) {
  const [saved,      setSaved]      = useState(false);
  const [selAthlete, setSelAthlete] = useState(athleteId ? String(athleteId) : '');

  const asim   = calcAsimetria(izq, der);
  const asimSt = asim >= 15 ? 'danger' : asim >= 10 ? 'warning' : 'ok';
  const asimCol = asimSt === 'danger' ? '#ef4444' : asimSt === 'warning' ? '#eab308' : '#22c55e';
  const asimBg  = asimSt === 'danger'
    ? 'rgba(239,68,68,0.12)'
    : asimSt === 'warning'
    ? 'rgba(234,179,8,0.12)'
    : 'rgba(34,197,94,0.12)';

  function handleSave() {
    const aid  = selAthlete || 'generic';
    const key  = `fieldlab_${coachId}_mobility_${aid}_tobillo_${todayStr()}`;
    const data = {
      izq, der, asimetria: asim, sport,
      timestamp: new Date().toISOString(),
      athleteId: aid,
    };
    try {
      localStorage.setItem(key, JSON.stringify(data));
      setSaved(true);
    } catch { /* storage full */ }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-slate-100 text-center">Resumen final</h2>

      {/* Side-by-side results */}
      <div className="flex gap-3">
        <SideCard label="Izquierdo" angle={izq} sport={sport} />
        <SideCard label="Derecho"   angle={der} sport={sport} />
      </div>

      {/* Asymmetry */}
      <div className="rounded-xl p-4 space-y-2"
        style={{ background: asimBg, border: `1px solid ${asimCol}` }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-300">Asimetría</p>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '28px',
              fontWeight: 700,
              color: asimCol,
            }}
          >
            {asim}%
          </span>
        </div>
        {asimSt === 'danger' && (
          <p className="text-xs font-medium" style={{ color: '#ef4444' }}>
            ⚠ Asimetría significativa — revisar cadena posterior
          </p>
        )}
        {asimSt === 'warning' && (
          <p className="text-xs font-medium" style={{ color: '#eab308' }}>
            ⚠ Asimetría moderada — monitorear
          </p>
        )}
        {asimSt === 'ok' && (
          <p className="text-xs font-medium" style={{ color: '#22c55e' }}>
            ✓ Asimetría dentro del rango aceptable
          </p>
        )}
      </div>

      {/* Athlete selector (only if no pre-selected athlete) */}
      {!athleteId && (
        <div className="rounded-xl p-4"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-2">
            Guardar para atleta
          </label>
          <select
            value={selAthlete}
            onChange={e => setSelAthlete(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-slate-200"
            style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <option value="">Sin atleta asociado</option>
            {PLAYERS.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Save */}
      {!saved ? (
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: '#38bdf8', color: '#0f172a' }}
        >
          💾 Guardar en perfil del atleta
        </button>
      ) : (
        <div
          className="w-full py-3 rounded-xl font-semibold text-sm text-center"
          style={{
            background: 'rgba(34,197,94,0.15)',
            color: '#22c55e',
            border: '1px solid rgba(34,197,94,0.4)',
          }}
        >
          ✓ Guardado correctamente
        </div>
      )}

      <button
        onClick={onRestart}
        className="w-full py-3 rounded-xl font-semibold text-sm"
        style={{
          background: '#1e293b',
          color: '#38bdf8',
          border: '1px solid rgba(56,189,248,0.3)',
        }}
      >
        Nuevo test
      </button>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────
// State machine:
//   instrucciones → camera_left (calib+grab) → resultado_izq
//   → camera_right (grab only) → resultado_der → resumen

export default function MovilidadTobillo({ initialId, onNavigate }) {
  const { coach } = useAuth();
  const [step,     setStep]     = useState('instrucciones');
  const [izqAngle, setIzqAngle] = useState(null);
  const [derAngle, setDerAngle] = useState(null);

  const athlete = PLAYERS.find(p => p.id === Number(initialId)) ?? null;
  const sport   = (athlete?.sport ?? 'default').toLowerCase();
  const coachId = coach?.id ?? 'anon';

  function restart() {
    setStep('instrucciones');
    setIzqAngle(null);
    setDerAngle(null);
  }

  // ── INSTRUCCIONES ──────────────────────────────────────────────────────────
  if (step === 'instrucciones') {
    return (
      <div className="space-y-5">
        <div>
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4 transition-colors"
          >
            <ArrowLeft size={15} /> Volver
          </button>
          <h1 className="text-2xl font-bold text-slate-100">Lunge Test</h1>
          <p className="text-sm text-slate-400 mt-0.5">Dorsiflexión de Tobillo</p>
          {athlete && (
            <p className="text-sm mt-1" style={{ color: '#38bdf8' }}>
              Atleta: {athlete.name}
            </p>
          )}
        </div>

        {/* Instructions */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-base font-semibold text-slate-200">Instrucciones</h2>
          {[
            'Posicioná al atleta de perfil (vista lateral estricta)',
            'Pie a evaluar adelante, talón pegado al suelo',
            'Flexioná la rodilla al máximo sin levantar el talón',
            'Mantené la posición cuando veas la línea verde',
          ].map((txt, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: '#38bdf8', color: '#0f172a' }}
              >
                <span className="text-xs font-bold">{i + 1}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{txt}</p>
            </div>
          ))}
        </div>

        {/* Reference values */}
        <div className="rounded-2xl p-5"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Valores normativos
          </h3>
          <div className="space-y-2.5">
            {[
              { col: '#22c55e', txt: 'Óptimo: ≥ 35°' },
              { col: '#eab308', txt: 'Precaución: 25° – 34°' },
              { col: '#ef4444', txt: 'Riesgo: < 25°' },
            ].map(({ col, txt }) => (
              <div key={txt} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: col }} />
                <span className="text-sm text-slate-300">{txt}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => setStep('camera_left')}
          className="w-full py-4 rounded-xl font-bold text-base"
          style={{ background: '#38bdf8', color: '#0f172a' }}
        >
          Comenzar
        </button>
      </div>
    );
  }

  // ── CAMERA LEFT (calibracion + grabando_izq in one session) ───────────────
  if (step === 'camera_left') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('instrucciones')}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Lado <span style={{ color: '#38bdf8' }}>Izquierdo</span>
            </h2>
            <p className="text-xs text-slate-500">Calibrá y luego capturá el ángulo máximo</p>
          </div>
        </div>
        <CameraSessionView
          key="left"
          side="left"
          startPhase="calibracion"
          sport={sport}
          onCapture={(ang) => {
            setIzqAngle(ang);
            setStep('resultado_izq');
          }}
        />
      </div>
    );
  }

  // ── RESULTADO IZQUIERDO ────────────────────────────────────────────────────
  if (step === 'resultado_izq') {
    return (
      <ResultScreen
        side="left"
        angle={izqAngle}
        sport={sport}
        onNext={() => setStep('camera_right')}
        nextLabel="Evaluar lado Derecho →"
      />
    );
  }

  // ── CAMERA RIGHT (grabando only) ───────────────────────────────────────────
  if (step === 'camera_right') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('resultado_izq')}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Lado <span style={{ color: '#38bdf8' }}>Derecho</span>
            </h2>
            <p className="text-xs text-slate-500">
              Cambiá el pie adelante y capturá el ángulo máximo
            </p>
          </div>
        </div>
        <CameraSessionView
          key="right"
          side="right"
          startPhase="grabando"
          sport={sport}
          onCapture={(ang) => {
            setDerAngle(ang);
            setStep('resultado_der');
          }}
        />
      </div>
    );
  }

  // ── RESULTADO DERECHO ──────────────────────────────────────────────────────
  if (step === 'resultado_der') {
    return (
      <ResultScreen
        side="right"
        angle={derAngle}
        sport={sport}
        onNext={() => setStep('resumen')}
        nextLabel="Ver resumen →"
      />
    );
  }

  // ── RESUMEN FINAL ──────────────────────────────────────────────────────────
  if (step === 'resumen') {
    return (
      <SummaryScreen
        izq={izqAngle}
        der={derAngle}
        sport={sport}
        coachId={coachId}
        athleteId={initialId}
        onRestart={restart}
        onNavigate={onNavigate}
      />
    );
  }

  return null;
}
