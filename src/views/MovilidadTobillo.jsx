import { useState, useEffect, useRef } from 'react';
import { ArrowLeft }   from 'lucide-react';
import { useAuth }     from '../context/AuthContext';
import { PLAYERS }     from '../data/players';
import { useLungePhoto } from '../hooks/useLungePhoto';

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  bg:     '#0f172a',
  card:   '#1e293b',
  card2:  '#273347',
  border: '#334155',
  accent: '#38bdf8',
  green:  '#22c55e',
  yellow: '#eab308',
  red:    '#ef4444',
  muted:  '#94a3b8',
  text:   '#e2e8f0',
};

// ── Helpers de ángulo (usan umbrales por defecto 35/25) ──────────────────────
function angleColor(a)  { return a >= 35 ? C.green : a >= 25 ? C.yellow : C.red; }
function angleStatus(a) { return a >= 35 ? 'ÓPTIMO' : a >= 25 ? 'PRECAUCIÓN' : 'RIESGO'; }
function angleBg(a) {
  return a >= 35 ? 'rgba(34,197,94,0.12)'
       : a >= 25 ? 'rgba(234,179,8,0.12)'
       :           'rgba(239,68,68,0.12)';
}
function angleInterp(a) {
  if (a >= 35) return 'Rango óptimo. Sin restricción funcional.';
  if (a >= 25) return 'Restricción leve. Puede afectar la mecánica de carrera y COD.';
  return 'Restricción significativa. Riesgo aumentado de lesión de rodilla y tobillo.';
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: `3px solid ${C.border}`,
      borderTopColor: C.accent,
      animation: 'lunge-spin 1s linear infinite',
    }} />
  );
}

// ── SVG protocolo (instrucciones) ─────────────────────────────────────────────
function LungeSVG() {
  return (
    <svg viewBox="0 0 200 180"
      style={{ width: '100%', maxWidth: 220, margin: '12px auto', display: 'block' }}>
      <rect width="200" height="180" fill="#1e293b" rx="12" />
      {/* Muslo */}
      <line x1="100" y1="40" x2="80" y2="110" stroke="#475569" strokeWidth="18" strokeLinecap="round" />
      {/* Tibia */}
      <line x1="80" y1="110" x2="95" y2="165" stroke="#475569" strokeWidth="16" strokeLinecap="round" />
      {/* Pie */}
      <line x1="95" y1="165" x2="130" y2="168" stroke="#475569" strokeWidth="10" strokeLinecap="round" />
      {/* Cámara */}
      <rect x="36" y="108" width="28" height="20" rx="4"
        fill="#0f172a" stroke="#38bdf8" strokeWidth="2"
        transform="rotate(-12, 50, 118)" />
      <circle cx="50" cy="118" r="5" fill="none" stroke="#38bdf8" strokeWidth="1.5"
        transform="rotate(-12, 50, 118)" />
      {/* Labels */}
      <text x="105" y="130" fill="#94a3b8" fontSize="9">← foto aquí</text>
      <circle cx="130" cy="168" r="5" fill="none" stroke="#22c55e" strokeWidth="2" />
      <text x="118" y="178" fill="#22c55e" fontSize="8">talón fijo</text>
    </svg>
  );
}

// ── SideCard para resumen ─────────────────────────────────────────────────────
function SideCard({ label, angle }) {
  const col = angleColor(angle);
  const bg  = angleBg(angle);
  const lbl = angleStatus(angle);
  return (
    <div style={{
      flex: 1, borderRadius: 16, padding: '16px 8px',
      background: bg, border: `1px solid ${col}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      <p style={{ fontSize: 10, color: C.muted, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
        {label}
      </p>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 52, fontWeight: 900, color: col, lineHeight: 1,
      }}>
        {angle}°
      </span>
      <span style={{
        fontSize: 10, fontWeight: 700,
        padding: '2px 10px', borderRadius: 99,
        background: col, color: '#0f172a',
      }}>
        {lbl}
      </span>
    </div>
  );
}

// ── Pantalla de resumen final ─────────────────────────────────────────────────
function SummaryScreen({ izq, der, mode, sport, coachId, initialId, onNavigate, onRestart }) {
  const [saved, setSaved] = useState(false);
  const [selAthlete, setSelAthlete] = useState(initialId ? String(initialId) : '');

  const asimetria = (izq != null && der != null && izq > 0 && der > 0)
    ? Math.round(Math.abs(izq - der) / Math.max(izq, der) * 100)
    : null;
  // Calcular sólo cuando asimetria está disponible para evitar null >= n → false
  const asimSt  = asimetria == null ? null
    : asimetria >= 15 ? 'danger'
    : asimetria >= 10 ? 'warning'
    : 'ok';
  const asimCol = asimSt === 'danger' ? C.red : asimSt === 'warning' ? C.yellow : C.green;
  const asimBg  = asimSt === 'danger'
    ? 'rgba(239,68,68,0.12)'
    : asimSt === 'warning'
    ? 'rgba(234,179,8,0.12)'
    : 'rgba(34,197,94,0.12)';

  function handleSave() {
    const aid = selAthlete || 'generic';
    const key = `fieldlab_${coachId}_mobility_${aid}_tobillo_${todayStr()}`;
    const data = {
      izq, der,
      asimetria,
      mode,
      sport,
      timestamp: new Date().toISOString(),
      athleteId: aid,
    };
    try {
      localStorage.setItem(key, JSON.stringify(data));
      setSaved(true);
      // Si hay atleta, volver al perfil después de guardar
      if (aid !== 'generic' && onNavigate) {
        setTimeout(() => onNavigate('player', Number(aid)), 800);
      }
    } catch { /* storage lleno */ }
  }

  return (
    <div style={{ paddingBottom: 24 }} className="space-y-4">
      <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, textAlign: 'center', margin: 0 }}>
        Resumen final
      </h2>

      {/* Cards lado a lado */}
      <div style={{ display: 'flex', gap: 12 }}>
        <SideCard label="Izquierdo" angle={izq} />
        <SideCard label="Derecho"   angle={der} />
      </div>

      {/* Asimetría */}
      {asimetria != null && (
        <div style={{
          borderRadius: 16, padding: '14px 16px',
          background: asimBg, border: `1px solid ${asimCol}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>Asimetría</p>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 28, fontWeight: 700, color: asimCol,
            }}>
              {asimetria}%
            </span>
          </div>
          <p style={{ fontSize: 12, fontWeight: 500, color: asimCol, margin: '4px 0 0' }}>
            {asimSt === 'danger'  && '⚠ Asimetría significativa — revisar cadena posterior'}
            {asimSt === 'warning' && '⚠ Asimetría moderada — monitorear'}
            {asimSt === 'ok'      && '✓ Simetría dentro del rango normal'}
          </p>
        </div>
      )}

      {/* Interpretación combinada */}
      <div style={{
        borderRadius: 14, padding: '12px 16px',
        background: C.card, border: `1px solid ${C.border}`,
      }}>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>Izquierdo:</strong> {angleInterp(izq)}<br />
          <strong style={{ color: C.text }}>Derecho:</strong>   {angleInterp(der)}
        </p>
      </div>

      {/* Selector de atleta (solo si no viene pre-cargado) */}
      {!initialId && (
        <div style={{
          borderRadius: 14, padding: '14px 16px',
          background: C.card, border: `1px solid ${C.border}`,
        }}>
          <label style={{
            display: 'block', fontSize: 11, color: C.muted,
            fontWeight: 600, textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: 8,
          }}>
            Guardar para atleta
          </label>
          <select
            value={selAthlete}
            onChange={e => setSelAthlete(e.target.value)}
            style={{
              width: '100%', borderRadius: 10, padding: '8px 12px',
              background: C.bg, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 14,
            }}
          >
            <option value="">Sin atleta asociado</option>
            {PLAYERS.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Guardar / Guardado */}
      {!saved ? (
        <button onClick={handleSave} style={{
          width: '100%', padding: '14px 0', borderRadius: 14,
          border: 'none', background: C.accent, color: '#0f172a',
          fontWeight: 700, fontSize: 15, cursor: 'pointer',
        }}>
          💾 Guardar resultado
        </button>
      ) : (
        <div style={{
          width: '100%', padding: '14px 0', borderRadius: 14, textAlign: 'center',
          background: 'rgba(34,197,94,0.15)', color: C.green,
          border: `1px solid rgba(34,197,94,0.4)`, fontWeight: 700, fontSize: 14,
        }}>
          ✓ Guardado correctamente
        </div>
      )}

      <button onClick={onRestart} style={{
        width: '100%', padding: '12px 0', borderRadius: 14,
        border: `1px solid rgba(56,189,248,0.3)`,
        background: 'transparent', color: C.accent,
        fontWeight: 600, fontSize: 14, cursor: 'pointer',
      }}>
        Nuevo test
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
//
// Pasos:
//   instrucciones → capturando_izq → capturando_der → resumen   (mode rear/front)
//   instrucciones → upload_izq → upload_der → resumen            (mode upload)
//
export default function MovilidadTobillo({ onNavigate, initialId, onFullscreen }) {
  const { coach } = useAuth();

  const [mode, setMode] = useState(null); // 'rear' | 'front' | 'upload'
  const [step, setStep] = useState('instrucciones');

  const [resultIzq, setResultIzq] = useState(null);
  const [resultDer, setResultDer] = useState(null);

  const hookIzq = useLungePhoto({ side: 'left' });
  const hookDer = useLungePhoto({ side: 'right' });

  const isCapturing = step === 'capturando_izq' || step === 'capturando_der';
  const isUpload    = step === 'upload_izq'     || step === 'upload_der';
  const isCaptureStep = isCapturing || isUpload;

  const isIzq       = step === 'capturando_izq' || step === 'upload_izq';
  const currentSide = isIzq ? 'IZQUIERDO' : 'DERECHO';
  const hook        = isIzq ? hookIzq : hookDer;

  // Ocultar NavBar en pantalla de cámara (fullscreen)
  useEffect(() => {
    onFullscreen?.(isCapturing);
    return () => onFullscreen?.(false);
  }, [isCapturing, onFullscreen]);

  function restart() {
    hookIzq.stopCamera();
    hookDer.stopCamera();
    setMode(null);
    setStep('instrucciones');
    setResultIzq(null);
    setResultDer(null);
  }

  // Confirmar el ángulo capturado y avanzar al siguiente paso
  function confirmCapture() {
    const ang = hook.capturedAngle;
    if (ang == null) return;
    if (step === 'capturando_izq') {
      setResultIzq(ang);
      hook.stopCamera();
      hookDer.resetForNewSide();
      setStep('capturando_der');
      // Pequeño delay para que el SO libere el hardware de la cámara
      // antes de abrir un nuevo stream (evita NotReadableError en iOS)
      setTimeout(() => hookDer.startCamera(mode === 'front' ? 'user' : 'environment'), 150);
    } else {
      setResultDer(ang);
      hook.stopCamera();
      setStep('resumen');
    }
  }

  // Confirmar upload y avanzar
  function confirmUpload() {
    const ang = hook.capturedAngle;
    if (ang == null) return;
    if (step === 'upload_izq') {
      setResultIzq(ang);
      hookDer.resetForNewSide();
      setStep('upload_der');
    } else {
      setResultDer(ang);
      setStep('resumen');
    }
  }

  const athlete = PLAYERS.find(p => p.id === Number(initialId)) ?? null;
  const sport   = (athlete?.sport ?? 'default').toLowerCase();
  const coachId = coach?.id ?? 'anon';

  // ══════════════════════════════════════════════════════════════════════════
  // PANTALLA: INSTRUCCIONES
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'instrucciones') {
    return (
      <div className="space-y-5" style={{ paddingBottom: 24 }}>
        <div>
          <button
            onClick={() => onNavigate?.('dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.muted, fontSize: 13, marginBottom: 12, padding: 0,
            }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0 }}>
            Lunge Test
          </h1>
          <p style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>
            Dorsiflexión de Tobillo — Foto con MediaPipe
          </p>
          {athlete && (
            <p style={{ fontSize: 13, color: C.accent, marginTop: 4 }}>
              Atleta: {athlete.name}
            </p>
          )}
        </div>

        <LungeSVG />

        {/* Protocolo */}
        <div style={{
          borderRadius: 18, padding: '18px 16px',
          background: C.card, border: `1px solid ${C.border}`,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 14px' }}>
            Protocolo
          </h2>
          {[
            'Atleta en posición de lunge, talón izquierdo fijo en el suelo',
            'Flexioná la rodilla al máximo sin levantar el talón',
            'Mantenés la posición en el punto máximo',
            'Capturás la foto desde un costado (tibia y tobillo visibles)',
            'Repetís con el tobillo derecho',
          ].map((txt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: C.accent, color: '#0f172a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>{txt}</p>
            </div>
          ))}
        </div>

        {/* Selector de modo */}
        <div style={{
          borderRadius: 18, padding: '18px 16px',
          background: C.card, border: `1px solid ${C.border}`,
        }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: C.muted,
            textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 14px' }}>
            ¿Cómo querés evaluar?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { id: 'rear',   emoji: '📷', label: 'Cámara trasera',
                desc: 'El profe filma al atleta desde un costado' },
              { id: 'front',  emoji: '🤳', label: 'Cámara frontal',
                desc: 'El atleta se autoevalúa sosteniendo el celular' },
              { id: 'upload', emoji: '🖼', label: 'Cargar foto',
                desc: 'Analizá una foto existente o enviada por el atleta' },
            ].map(({ id, emoji, label, desc }) => (
              <button
                key={id}
                onClick={() => {
                  setMode(id);
                  if (id === 'upload') {
                    hookIzq.resetForNewSide();
                    setStep('upload_izq');
                  } else {
                    hookIzq.resetForNewSide();
                    setStep('capturando_izq');
                    hookIzq.startCamera(id === 'front' ? 'user' : 'environment');
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: C.card2, border: `1px solid ${C.border}`,
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 24, flexShrink: 0 }}>{emoji}</span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: C.text, margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PANTALLA: CAPTURANDO (cámara trasera o frontal) — FULLSCREEN
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'capturando_izq' || step === 'capturando_der') {
    return (
      <>
        {/* Animación spinner inyectada inline para evitar import de CSS global */}
        <style>{`@keyframes lunge-spin { to { transform: rotate(360deg); } }`}</style>

        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: '#000',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Área de video */}
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
            <video
              ref={hook.videoRef}
              playsInline
              muted
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
              }}
            />
            <canvas
              ref={hook.canvasRef}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
              }}
            />

            {/* Spinner MediaPipe cargando */}
            {hook.mpLoading && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,23,42,0.85)', gap: 14,
              }}>
                <Spinner />
                <span style={{ color: C.muted, fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
                  Cargando modelo IA...
                </span>
              </div>
            )}

            {/* Error MediaPipe */}
            {hook.mpError && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,23,42,0.9)', gap: 14, padding: 24,
              }}>
                <span style={{ fontSize: 32 }}>⚠️</span>
                <p style={{ color: C.red, fontSize: 13, textAlign: 'center', margin: 0 }}>
                  {hook.mpError}
                </p>
                <button onClick={() => window.location.reload()} style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: C.accent, color: '#0f172a', fontWeight: 600, cursor: 'pointer',
                }}>
                  Reintentar
                </button>
              </div>
            )}

            {/* Error de cámara */}
            {hook.cameraError && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15,23,42,0.9)', gap: 14, padding: 24,
              }}>
                <span style={{ fontSize: 32 }}>📷</span>
                <p style={{ color: C.red, fontSize: 13, textAlign: 'center', margin: 0 }}>
                  {hook.cameraError}
                </p>
                <button onClick={() => { hook.stopCamera(); setStep('instrucciones'); }} style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: C.accent, color: '#0f172a', fontWeight: 600, cursor: 'pointer',
                }}>
                  Volver
                </button>
              </div>
            )}

            {/* Ángulo en vivo — centro superior */}
            {!hook.capturedAngle && hook.liveAngle != null && !hook.mpError && !hook.cameraError && (
              <div style={{
                position: 'absolute', top: 20,
                left: '50%', transform: 'translateX(-50%)',
                zIndex: 10, background: 'rgba(15,23,42,0.75)',
                borderRadius: 14, padding: '4px 20px',
                backdropFilter: 'blur(8px)',
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 52, fontWeight: 700,
                  color: angleColor(hook.liveAngle),
                }}>
                  {hook.liveAngle}°
                </span>
              </div>
            )}

            {/* Label del lado — esquina superior derecha */}
            <div style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              background: 'rgba(15,23,42,0.75)',
              borderRadius: 8, padding: '6px 12px',
              backdropFilter: 'blur(8px)',
              color: C.accent, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em',
            }}>
              {currentSide}
            </div>

            {/* Botón atrás — esquina superior izquierda */}
            <button
              onClick={() => { hook.stopCamera(); setStep('instrucciones'); }}
              style={{
                position: 'absolute', top: 16, left: 16, zIndex: 10,
                background: 'rgba(15,23,42,0.75)',
                border: `1px solid rgba(255,255,255,0.15)`,
                borderRadius: 10, padding: '8px 14px',
                color: C.muted, fontSize: 13, cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
            >
              ← Atrás
            </button>
          </div>

          {/* Barra inferior — sin foto capturada todavía */}
          {!hook.capturedImage && (
            <div style={{
              padding: '16px 20px 36px',
              background: 'rgba(15,23,42,0.9)',
              backdropFilter: 'blur(12px)',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <p style={{ color: C.muted, fontSize: 12, textAlign: 'center', margin: 0 }}>
                Posicioná al atleta en el punto máximo de flexión y tocá capturar
              </p>
              <button
                onClick={hook.capturePhoto}
                disabled={hook.mpLoading || !!hook.mpError || !!hook.cameraError}
                style={{
                  background: (hook.mpLoading || hook.mpError || hook.cameraError) ? C.border : C.accent,
                  color: '#0f172a', fontWeight: 700, fontSize: 16,
                  border: 'none', borderRadius: 16,
                  padding: '16px 0', cursor: 'pointer',
                  boxShadow: '0 4px 24px rgba(56,189,248,0.3)',
                  transition: 'background 0.2s',
                }}
              >
                📸 Capturar foto
              </button>
            </div>
          )}

          {/* Foto capturada pero detección falló */}
          {hook.capturedImage && hook.capturedAngle == null && (
            <div style={{
              padding: '16px 20px 36px',
              background: 'rgba(15,23,42,0.95)',
              backdropFilter: 'blur(12px)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {hook.detectionError ? (
                <div style={{
                  borderRadius: 12, padding: '12px 14px',
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.35)',
                }}>
                  <p style={{ color: C.red, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                    ⚠ {hook.detectionError}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Spinner />
                </div>
              )}
              <button
                onClick={hook.retake}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 14,
                  border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.muted,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                ↺ Repetir foto
              </button>
            </div>
          )}

          {/* Resultado foto capturada */}
          {hook.capturedAngle != null && (
            <div style={{
              padding: '16px 20px 36px',
              background: 'rgba(15,23,42,0.95)',
              backdropFilter: 'blur(12px)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 64, fontWeight: 700,
                  color: angleColor(hook.capturedAngle),
                  lineHeight: 1,
                }}>
                  {hook.capturedAngle}°
                </span>
                <div style={{
                  background: angleBg(hook.capturedAngle),
                  border: `1px solid ${angleColor(hook.capturedAngle)}`,
                  borderRadius: 10, padding: '4px 10px',
                }}>
                  <span style={{ color: angleColor(hook.capturedAngle), fontSize: 11, fontWeight: 700 }}>
                    {angleStatus(hook.capturedAngle)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={hook.retake}
                  style={{
                    flex: 1, padding: '13px 0', borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.muted,
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  ↺ Repetir
                </button>
                <button
                  onClick={confirmCapture}
                  style={{
                    flex: 2, padding: '13px 0', borderRadius: 14,
                    border: 'none', background: C.accent,
                    color: '#0f172a', fontWeight: 700,
                    cursor: 'pointer', fontSize: 14,
                  }}
                >
                  {step === 'capturando_izq' ? 'Evaluar Derecho →' : 'Ver Resumen →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PANTALLA: UPLOAD (foto desde galería)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'upload_izq' || step === 'upload_der') {
    const inputId = `upload-input-${isIzq ? 'izq' : 'der'}`;
    // analyzing viene del hook (true mientras poseRef.current.send() está en vuelo)

    return (
      <>
        <style>{`@keyframes lunge-spin { to { transform: rotate(360deg); } }`}</style>

        <div className="space-y-4" style={{ paddingBottom: 24 }}>
          {/* Header */}
          <div>
            <button
              onClick={() => {
                if (step === 'upload_izq') {
                  hookIzq.resetForNewSide();
                  setStep('instrucciones');
                } else {
                  hookDer.resetForNewSide();
                  setStep('upload_izq');
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.muted, fontSize: 13, marginBottom: 10, padding: 0,
              }}
            >
              <ArrowLeft size={14} /> Atrás
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
              Tobillo {isIzq ? 'Izquierdo' : 'Derecho'}
            </h2>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
              Foto lateral — tibia y tobillo completamente visibles
            </p>
          </div>

          {/* Guía de foto correcta — siempre visible */}
          <div style={{
            borderRadius: 14, padding: '14px 16px',
            background: C.card, border: `1px solid ${C.border}`,
          }}>
            <p style={{ fontSize: 12, color: C.muted, fontWeight: 600, margin: '0 0 6px' }}>
              La foto debe mostrar:
            </p>
            <ul style={{ fontSize: 12, color: C.muted, margin: 0, paddingLeft: 16, lineHeight: 1.8 }}>
              <li>Vista lateral estricta (90° de perfil)</li>
              <li>Cuerpo completo: cadera, rodilla y tobillo visibles</li>
              <li>Talón apoyado en el suelo</li>
              <li>Rodilla en el punto máximo de flexión</li>
              <li>Buena iluminación, sin ropa suelta que tape las articulaciones</li>
            </ul>
          </div>

          {/* Botón seleccionar foto */}
          <input
            type="file"
            accept="image/*"
            id={inputId}
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files[0]) hook.analyzeUpload(e.target.files[0]);
            }}
          />
          <label htmlFor={inputId} style={{
            display: 'block', width: '100%',
            padding: '14px 0', borderRadius: 14, textAlign: 'center',
            background: hook.capturedImage ? C.card : C.accent,
            color: hook.capturedImage ? C.accent : '#0f172a',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
            border: hook.capturedImage ? `1px solid ${C.border}` : 'none',
          }}>
            {hook.capturedImage ? '↻ Cambiar foto' : '🖼 Seleccionar foto'}
          </label>

          {/* MediaPipe loading */}
          {hook.mpLoading && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 14,
              background: C.card, border: `1px solid ${C.border}`,
            }}>
              <Spinner />
              <span style={{ fontSize: 13, color: C.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                Cargando modelo IA...
              </span>
            </div>
          )}

          {/* MediaPipe error */}
          {hook.mpError && (
            <div style={{
              padding: '14px 16px', borderRadius: 14,
              background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`,
            }}>
              <p style={{ fontSize: 13, color: C.red, margin: 0 }}>{hook.mpError}</p>
            </div>
          )}

          {/* Preview foto + overlay canvas */}
          {hook.capturedImage && (
            <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
              <img
                src={hook.capturedImage}
                alt="Foto analizada"
                style={{ width: '100%', display: 'block', borderRadius: 14 }}
              />
              <canvas
                ref={hook.canvasRef}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  pointerEvents: 'none',
                }}
              />
              {/* Spinner de análisis encima de la foto */}
              {hook.analyzing && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 14,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(15,23,42,0.7)', gap: 12,
                }}>
                  <Spinner />
                  <span style={{ fontSize: 13, color: C.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                    Analizando...
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Resultado del análisis */}
          {hook.capturedAngle != null && (
            <>
              <div style={{
                borderRadius: 18, padding: '20px 16px',
                background: angleBg(hook.capturedAngle),
                border: `2px solid ${angleColor(hook.capturedAngle)}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 80, fontWeight: 900, lineHeight: 1,
                  color: angleColor(hook.capturedAngle),
                }}>
                  {hook.capturedAngle}°
                </span>
                <div style={{
                  padding: '4px 16px', borderRadius: 99,
                  background: angleColor(hook.capturedAngle), color: '#0f172a',
                  fontWeight: 700, fontSize: 12,
                }}>
                  {angleStatus(hook.capturedAngle)}
                </div>
              </div>

              <div style={{
                padding: '12px 16px', borderRadius: 14,
                background: C.card, border: `1px solid ${C.border}`,
              }}>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                  {angleInterp(hook.capturedAngle)}
                </p>
              </div>

              <button
                onClick={confirmUpload}
                disabled={!!hook.detectionError}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 14,
                  border: 'none',
                  background: hook.detectionError ? C.border : C.accent,
                  color: hook.detectionError ? C.muted : '#0f172a',
                  fontWeight: 700, fontSize: 15,
                  cursor: hook.detectionError ? 'not-allowed' : 'pointer',
                  opacity: hook.detectionError ? 0.5 : 1,
                }}
              >
                {step === 'upload_izq' ? 'Continuar con Derecho →' : 'Ver Resumen →'}
              </button>
            </>
          )}

          {/* Error de detección específico */}
          {hook.detectionError && (
            <div style={{
              padding: '12px 16px', borderRadius: 14,
              background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`,
            }}>
              <p style={{ fontSize: 13, color: C.red, margin: 0, lineHeight: 1.5 }}>
                ⚠ {hook.detectionError}
              </p>
            </div>
          )}

          {/* Sin pose detectada (ningún landmarks) */}
          {hook.capturedImage && hook.capturedAngle == null && !hook.analyzing && !hook.detectionError && !hook.mpLoading && (
            <div style={{
              padding: '14px 16px', borderRadius: 14,
              background: 'rgba(234,179,8,0.1)', border: `1px solid ${C.yellow}`,
            }}>
              <p style={{ fontSize: 13, color: C.yellow, margin: 0 }}>
                ⚠ No se detectó ninguna persona. Probá con una foto más clara o en mejor posición lateral.
              </p>
            </div>
          )}
        </div>
      </>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PANTALLA: RESUMEN FINAL
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'resumen') {
    return (
      <SummaryScreen
        izq={resultIzq}
        der={resultDer}
        mode={mode}
        sport={sport}
        coachId={coachId}
        initialId={initialId}
        onNavigate={onNavigate}
        onRestart={restart}
      />
    );
  }

  return null;
}
