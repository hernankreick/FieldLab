import { useState, useEffect, useRef } from 'react';
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
// Renders inside a fullscreen fixed container provided by the parent.
// Handles calibracion → grabando transition internally (same MediaPipe instance).
// All controls float absolutely over the video.

// Fix (bug #5): mínimo de frames consecutivos con landmarks antes de habilitar
// el botón de captura. Evita capturar el primer frame ruidoso del modelo.
const MIN_STABLE_FRAMES = 3;

function CameraSessionView({ side, startPhase, sport, sideLabel, onBack, onCapture }) {
  const [phase, setPhase] = useState(startPhase ?? 'calibracion');

  // Contador de frames consecutivos con landmarks — se reinicia si se pierden
  const [stableFrames, setStableFrames] = useState(0);
  const prevLmRef = useRef(false);

  const {
    videoRef, canvasRef,
    angle, landmarks,
    mpLoading, mpError, cameraError,
    startCamera, stopCamera,
  } = useAngleDetection({ side, sport });

  // Actualizar contador de frames estables
  useEffect(() => {
    const hasLmNow = !!landmarks;
    setStableFrames(hasLmNow ? prev => prev + 1 : 0);
    prevLmRef.current = hasLmNow;
  }, [landmarks]);

  // Open camera immediately on mount — does NOT wait for MediaPipe
  useEffect(() => {
    startCamera();
    return () => { stopCamera(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync canvas pixel dimensions to video intrinsic size so overlay aligns
  useEffect(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const sync = () => {
      canvas.width  = video.videoWidth  || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
    };
    video.addEventListener('loadedmetadata', sync);
    window.addEventListener('resize', sync);
    return () => {
      video.removeEventListener('loadedmetadata', sync);
      window.removeEventListener('resize', sync);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasLm        = !!landmarks;
  // En fase 'grabando': habilitar captura sólo tras MIN_STABLE_FRAMES frames estables
  const readyToCapture = phase === 'grabando'
    ? (angle != null && stableFrames >= MIN_STABLE_FRAMES)
    : false;
  const st         = angle != null ? getAngleStatus(angle, sport) : null;
  const angleCol   = st ? statusColor(st) : '#38bdf8';

  return (
    // flex:1 fills the fixed fullscreen container from parent
    <div style={{ position: 'relative', flex: 1, width: '100%', background: '#000', overflow: 'hidden' }}>

      {/* ── Video feed ──────────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        playsInline autoPlay muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* ── Loading overlay ─────────────────────────────────────────────────── */}
      {mpLoading && !cameraError && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,23,42,0.85)', gap: 12,
        }}>
          <div className="animate-spin" style={{
            width: 36, height: 36, borderRadius: '50%',
            border: '3px solid #334155', borderTopColor: '#38bdf8',
          }} />
          <span style={{
            color: '#94a3b8', fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            Cargando modelo IA…
          </span>
        </div>
      )}

      {/* ── MediaPipe error overlay ──────────────────────────────────────────── */}
      {mpError && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,23,42,0.92)', gap: 12,
          padding: 20, textAlign: 'center',
        }}>
          <span style={{ color: '#ef4444', fontSize: 13 }}>{mpError}</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: '#38bdf8', color: '#0f172a',
              fontWeight: 700, fontSize: 12,
              border: 'none', cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Camera permission error overlay ─────────────────────────────────── */}
      {cameraError && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,23,42,0.92)', gap: 8,
          padding: 20, textAlign: 'center',
        }}>
          <span style={{ color: '#ef4444', fontSize: 14 }}>⚠</span>
          <span style={{ color: '#ef4444', fontSize: 13 }}>{cameraError}</span>
          <button
            onClick={onBack}
            style={{
              marginTop: 8, padding: '8px 16px', borderRadius: 8,
              background: '#334155', color: '#94a3b8',
              fontWeight: 600, fontSize: 12,
              border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
            }}
          >
            ← Volver
          </button>
        </div>
      )}

      {/* ── Floating UI (visible only when camera is live) ────────────────── */}

      {/* Back button — top left */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: 16, left: 16, zIndex: 10,
          background: 'rgba(15,23,42,0.75)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, padding: '8px 14px',
          color: '#94a3b8', fontSize: 13,
          cursor: 'pointer', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Atrás
      </button>

      {/* Side label — top right */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        background: 'rgba(15,23,42,0.75)',
        borderRadius: 8, padding: '6px 12px',
        backdropFilter: 'blur(8px)',
        color: '#38bdf8', fontSize: 12,
        fontWeight: 700, letterSpacing: '0.05em',
      }}>
        {sideLabel}
      </div>

      {/* Angle display — top center (grabando phase) */}
      {phase === 'grabando' && (
        <div style={{
          position: 'absolute', top: 20,
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(15,23,42,0.75)',
          borderRadius: 12, padding: '6px 18px',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 52, fontWeight: 700,
            color: angleCol,
          }}>
            {angle != null ? `${angle}°` : '--'}
          </span>
        </div>
      )}

      {/* Landmark status — visible en ambas fases una vez que MP cargó.
          Fix (bug #5): en grabando muestra progreso de estabilización. */}
      {!mpLoading && (
        <div style={{
          position: 'absolute', bottom: 112,
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 10,
          background: hasLm ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
          border: `1px solid ${hasLm ? '#22c55e' : '#ef4444'}`,
          color: hasLm ? '#22c55e' : '#ef4444',
          borderRadius: 8, padding: '6px 14px',
          fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {hasLm
            ? (phase === 'grabando' && stableFrames < MIN_STABLE_FRAMES
                ? `⬤ Estabilizando… (${stableFrames}/${MIN_STABLE_FRAMES})`
                : '✓ Landmarks detectados')
            : '⬤ Buscando landmarks…'}
        </div>
      )}

      {/* Calibracion "Listo" button — bottom center */}
      {phase === 'calibracion' && !mpLoading && (
        <button
          onClick={() => setPhase('grabando')}
          disabled={!hasLm}
          style={{
            position: 'absolute', bottom: 32,
            left: '50%', transform: 'translateX(-50%)',
            zIndex: 10,
            background: hasLm ? '#38bdf8' : 'rgba(51,65,85,0.9)',
            color: hasLm ? '#0f172a' : '#64748b',
            fontWeight: 700, fontSize: 14,
            border: hasLm ? 'none' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14, padding: '14px 32px',
            cursor: hasLm ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap', backdropFilter: 'blur(8px)',
            boxShadow: hasLm ? '0 4px 24px rgba(56,189,248,0.35)' : 'none',
          }}
        >
          {hasLm
            ? `Listo — Evaluar ${side === 'left' ? 'Izquierdo' : 'Derecho'}`
            : 'Esperando detección…'}
        </button>
      )}

      {/* Capture button — bottom center (grabando).
          Fix (bug #5): deshabilitado hasta MIN_STABLE_FRAMES frames con
          landmarks para no capturar el primer frame ruidoso del modelo. */}
      {phase === 'grabando' && (
        <button
          onClick={() => onCapture(angle)}
          disabled={!readyToCapture}
          style={{
            position: 'absolute', bottom: 32,
            left: '50%', transform: 'translateX(-50%)',
            zIndex: 10,
            background: readyToCapture ? '#38bdf8' : 'rgba(51,65,85,0.9)',
            color: readyToCapture ? '#0f172a' : '#64748b',
            fontWeight: 700, fontSize: 15,
            border: readyToCapture ? 'none' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 14, padding: '14px 40px',
            cursor: readyToCapture ? 'pointer' : 'not-allowed',
            boxShadow: readyToCapture ? '0 4px 24px rgba(56,189,248,0.35)' : 'none',
            whiteSpace: 'nowrap', backdropFilter: 'blur(8px)',
          }}
        >
          📐 Capturar ángulo máximo
        </button>
      )}
    </div>
  );
}

// ── ResultScreen ──────────────────────────────────────────────────────────────

function ResultScreen({ side, angle, sport, onNext, nextLabel }) {
  const st     = getAngleStatus(angle, sport);
  const col    = statusColor(st);
  const bg     = statusBg(st);
  const label  = statusLabel(st);
  const interp = getInterpretation(angle, sport);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-100 text-center">
        Resultado — {side === 'left' ? 'Izquierdo' : 'Derecho'}
      </h2>

      <div className="rounded-2xl p-8 flex flex-col items-center gap-4"
        style={{ background: bg, border: `2px solid ${col}` }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '96px', fontWeight: 900, color: col, lineHeight: 1,
        }}>
          {angle}°
        </span>
        <div className="px-5 py-1.5 rounded-full font-bold text-sm"
          style={{ background: col, color: '#0f172a' }}>
          {label}
        </div>
      </div>

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
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '52px', fontWeight: 900, color: col, lineHeight: 1,
      }}>
        {angle}°
      </span>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: col, color: '#0f172a' }}>
        {lbl}
      </span>
    </div>
  );
}

function SummaryScreen({ izq, der, sport, coachId, athleteId, onRestart, onNavigate }) {
  const [saved,      setSaved]      = useState(false);
  const [selAthlete, setSelAthlete] = useState(athleteId ? String(athleteId) : '');

  const asim    = calcAsimetria(izq, der);
  const asimSt  = asim >= 15 ? 'danger' : asim >= 10 ? 'warning' : 'ok';
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
      timestamp: new Date().toISOString(), athleteId: aid,
    };
    try { localStorage.setItem(key, JSON.stringify(data)); setSaved(true); }
    catch { /* storage full */ }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-slate-100 text-center">Resumen final</h2>

      <div className="flex gap-3">
        <SideCard label="Izquierdo" angle={izq} sport={sport} />
        <SideCard label="Derecho"   angle={der} sport={sport} />
      </div>

      <div className="rounded-xl p-4 space-y-2"
        style={{ background: asimBg, border: `1px solid ${asimCol}` }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-300">Asimetría</p>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '28px', fontWeight: 700, color: asimCol,
          }}>
            {asim}%
          </span>
        </div>
        {asimSt === 'danger'  && <p className="text-xs font-medium" style={{ color: '#ef4444' }}>⚠ Asimetría significativa — revisar cadena posterior</p>}
        {asimSt === 'warning' && <p className="text-xs font-medium" style={{ color: '#eab308' }}>⚠ Asimetría moderada — monitorear</p>}
        {asimSt === 'ok'      && <p className="text-xs font-medium" style={{ color: '#22c55e' }}>✓ Asimetría dentro del rango aceptable</p>}
      </div>

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

      {!saved ? (
        <button onClick={handleSave} className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: '#38bdf8', color: '#0f172a' }}>
          💾 Guardar en perfil del atleta
        </button>
      ) : (
        <div className="w-full py-3 rounded-xl font-semibold text-sm text-center"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }}>
          ✓ Guardado correctamente
        </div>
      )}

      <button onClick={onRestart} className="w-full py-3 rounded-xl font-semibold text-sm"
        style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
        Nuevo test
      </button>
    </div>
  );
}

// ── Fullscreen camera wrapper ──────────────────────────────────────────────────

const FS_STYLE = {
  position: 'fixed', inset: 0, zIndex: 999,
  background: '#000',
  display: 'flex', flexDirection: 'column',
};

// ── Main view ─────────────────────────────────────────────────────────────────
// State machine:
//   instrucciones → camera_left (calib+grab) → resultado_izq
//   → camera_right (grab only) → resultado_der → resumen

export default function MovilidadTobillo({ initialId, onNavigate, onFullscreen }) {
  const { coach } = useAuth();
  const [step,     setStep]     = useState('instrucciones');
  const [izqAngle, setIzqAngle] = useState(null);
  const [derAngle, setDerAngle] = useState(null);

  const athlete = PLAYERS.find(p => p.id === Number(initialId)) ?? null;
  const sport   = (athlete?.sport ?? 'default').toLowerCase();
  const coachId = coach?.id ?? 'anon';

  // Notify parent to hide/show NavBar based on camera step
  useEffect(() => {
    const isFs = step === 'camera_left' || step === 'camera_right';
    onFullscreen?.(isFs);
    return () => onFullscreen?.(false);
  }, [step, onFullscreen]);

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
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: '#38bdf8', color: '#0f172a' }}>
                <span className="text-xs font-bold">{i + 1}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{txt}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-5"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Fix (bug #3): derivar umbrales desde NORMAS[sport] para que
              coincidan exactamente con los valores usados en getAngleStatus().
              Antes estaban hardcodeados en 35/25 ignorando el deporte. */}
          {(() => {
            const n = NORMAS[sport] ?? NORMAS.default;
            return (
              <>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Valores normativos
                  {sport !== 'default' && (
                    <span className="ml-2 normal-case font-normal text-slate-500">({sport})</span>
                  )}
                </h3>
                <div className="space-y-2.5">
                  {[
                    { col: '#22c55e', txt: `Óptimo: ≥ ${n.optimo}°` },
                    { col: '#eab308', txt: `Precaución: ${n.precaucion}° – ${n.optimo - 1}°` },
                    { col: '#ef4444', txt: `Riesgo: < ${n.precaucion}°` },
                  ].map(({ col, txt }) => (
                    <div key={txt} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: col }} />
                      <span className="text-sm text-slate-300">{txt}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
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

  // ── CAMERA LEFT — fullscreen (calibracion + grabando_izq) ─────────────────
  if (step === 'camera_left') {
    return (
      <div style={FS_STYLE}>
        <CameraSessionView
          key="left"
          side="left"
          startPhase="calibracion"
          sport={sport}
          sideLabel="IZQUIERDO"
          onBack={() => setStep('instrucciones')}
          onCapture={(ang) => { setIzqAngle(ang); setStep('resultado_izq'); }}
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

  // ── CAMERA RIGHT — fullscreen (grabando only) ──────────────────────────────
  if (step === 'camera_right') {
    return (
      <div style={FS_STYLE}>
        <CameraSessionView
          key="right"
          side="right"
          startPhase="grabando"
          sport={sport}
          sideLabel="DERECHO"
          onBack={() => setStep('resultado_izq')}
          onCapture={(ang) => { setDerAngle(ang); setStep('resultado_der'); }}
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
