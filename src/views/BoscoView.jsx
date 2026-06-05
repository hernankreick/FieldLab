import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAccelerometerJump, heightToSayers, calcRSI, calcElasticEfficiency } from '../hooks/useAccelerometerJump';

const C = {
  bg: '#0f172a', card: '#1e293b', card2: '#273347',
  border: '#334155', accent: '#38bdf8',
  green: '#22c55e', yellow: '#eab308', red: '#ef4444', muted: '#94a3b8',
};

const TEST_CONFIGS = {
  SJ: {
    label: 'Squat Jump',
    desc:  'Salto desde posición estática sin contramovimiento',
    icon:  '⬆️',
    reps:  5,
    instruction: [
      'Posición: rodillas flexionadas ~90°, manos en la cintura',
      'Sin contramovimiento — saltar directo hacia arriba',
      'Aterrizaje con rodillas extendidas',
    ],
  },
  CMJ: {
    label: 'Counter Movement Jump',
    desc:  'Salto con contramovimiento libre',
    icon:  '↕️',
    reps:  5,
    instruction: [
      'Posición inicial: parado derecho, manos en la cintura',
      'Flexión rápida seguida de salto explosivo',
      'Aterrizaje con rodillas extendidas',
    ],
  },
  DropJump: {
    label: 'Drop Jump',
    desc:  'Salto reactivo desde cajón (RSI)',
    icon:  '⤵️',
    reps:  5,
    instruction: [
      'Caer desde el cajón (30–40 cm)',
      'Rebotar lo más rápido y alto posible',
      'Mínimo tiempo de contacto',
    ],
  },
};

// Semáforo por altura (cm)
function jumpStatus(heightCm, testType) {
  if (testType === 'DropJump') return null; // DJ usa RSI
  const thresholds = { SJ: [35, 30], CMJ: [40, 30] }[testType] ?? [40, 30];
  if (heightCm >= thresholds[0]) return 'green';
  if (heightCm >= thresholds[1]) return 'yellow';
  return 'red';
}

function rsiStatus(rsi) {
  const v = parseFloat(rsi);
  if (v >= 1.5) return 'green';
  if (v >= 1.0) return 'yellow';
  return 'red';
}

const STATUS_COLOR = { green: C.green, yellow: C.yellow, red: C.red };

// ── UI helpers ───────────────────────────────────────────────────────────────

function Pill({ color, children }) {
  return (
    <span style={{
      background: color + '22', border: `1px solid ${color}55`,
      color, borderRadius: 20, padding: '2px 10px',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
    }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, unit, color }) {
  return (
    <div style={{
      background: C.card2, borderRadius: 12, padding: '14px 16px',
      textAlign: 'center', flex: 1,
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 28, fontWeight: 800,
        color: color ?? C.accent, lineHeight: 1,
      }}>
        {value}<span style={{ fontSize: 14, marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BoscoView({ onNavigate, onFullscreen }) {
  const { coach } = useAuth();

  const [step,       setStep]       = useState('SELECTOR');
  const [testType,   setTestType]   = useState('CMJ');
  const [bodyMass,   setBodyMass]   = useState('');
  const [numReps,    setNumReps]    = useState(5);
  const [countNum,   setCountNum]   = useState(3);
  const [sessionRes,  setSessionRes]  = useState({});
  const [showDebug,   setShowDebug]   = useState(false);
  const [currentMag,  setCurrentMag]  = useState(null);

  const [savedResults, setSavedResults] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`fieldlab_${coach?.id}_bosco`) || '[]');
    } catch { return []; }
  });

  const audioCtxRef   = useRef(null);
  const undoTrapRef   = useRef(null);
  const prevJumpCount = useRef(0);

  const accel = useAccelerometerJump({ maxJumps: numReps, testType });

  function _playBeepSync(ctx, freq = 880, duration = 0.15) {
    if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type            = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch (e) { console.warn('beep error:', e); }
  }

  // Track jump count to trigger beep on new jumps
  useEffect(() => {
    if (accel.jumps.length > prevJumpCount.current) {
      _playBeepSync(audioCtxRef.current, 660, 0.08);
      prevJumpCount.current = accel.jumps.length;
    }
  }, [accel.jumps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen during kiosk steps
  useEffect(() => {
    const fs = ['ENTREGAR', 'COUNTDOWN', 'DETECTANDO'].includes(step);
    onFullscreen?.(fs);
    return () => onFullscreen?.(false);
  }, [step, onFullscreen]);

  // Auto-advance when detection fills up
  useEffect(() => {
    if (step === 'DETECTANDO' && !accel.isDetecting && accel.jumps.length > 0) {
      _playBeepSync(audioCtxRef.current, 440, 0.5);
      setStep('RESULTADO');
    }
  }, [accel.isDetecting, accel.jumps.length, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bloquear scroll durante pantallas kiosko (solo touchmove — NO touchstart)
  useEffect(() => {
    if (step !== 'DETECTANDO' && step !== 'COUNTDOWN') return;

    const blockScroll = (e) => { e.preventDefault(); };
    document.addEventListener('touchmove', blockScroll, { passive: false });

    window.history.pushState(null, '', window.location.href);
    const blockBack = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);

    return () => {
      document.removeEventListener('touchmove', blockScroll);
      window.removeEventListener('popstate', blockBack);
    };
  }, [step]);

  // Deshabilitar shake-to-undo: foco en input readOnly vacío durante la detección
  // Un <input readOnly> es el único elemento que iOS reconoce como first responder
  // pero sin historial de deshacer — el popup no aparece.
  useEffect(() => {
    if (step !== 'DETECTANDO' && step !== 'COUNTDOWN') {
      undoTrapRef.current?.blur();
      return;
    }
    const t = setTimeout(() => undoTrapRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [step]);
  useEffect(() => {
    if (!showDebug) { setCurrentMag(null); return; }
    const handler = (e) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      setCurrentMag(Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2));
    };
    if (typeof DeviceMotionEvent?.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().then(res => {
        if (res === 'granted') window.addEventListener('devicemotion', handler, { passive: true });
      });
    } else {
      window.addEventListener('devicemotion', handler, { passive: true });
    }
    return () => window.removeEventListener('devicemotion', handler);
  }, [showDebug]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSelectTest = useCallback((type) => {
    setTestType(type);
    setStep('CONFIG');
  }, []);

  const handleGoKiosk = useCallback(async () => {
    const ok = await accel.requestPermission();
    if (!ok) return;
    accel.reset();
    prevJumpCount.current = 0;
    setStep('ENTREGAR');
  }, [accel]);

  // AudioContext se crea SÍNCRONAMENTE aquí — iOS requiere que el gesto sea síncrono
  function handleAthleteStart() {
    // Reproducir audio HTML silencioso ANTES del AudioContext:
    // esto eleva la sesión de audio de iOS de "Ambient" (mutable por el switch)
    // a "Playback" (altavoz principal, no afectado por el mute switch).
    try {
      // WAV silencioso de 1 sample — mínimo válido
      const sil = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      sil.setAttribute('playsinline', '');
      sil.volume = 0.001;
      sil.play().catch(() => {});
    } catch (_) {}

    let ctx = null;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      // Primer beep inmediato y síncrono — desbloquea el audio en iOS
      _playBeepSync(ctx, 880, 0.15);
    } catch (e) { console.warn('AudioContext error:', e); }

    setStep('COUNTDOWN');
    setCountNum(3);

    setTimeout(() => {
      setCountNum(2);
      _playBeepSync(audioCtxRef.current, 880, 0.15);
    }, 1000);
    setTimeout(() => {
      setCountNum(1);
      _playBeepSync(audioCtxRef.current, 880, 0.15);
    }, 2000);
    setTimeout(() => {
      setCountNum('GO');
      _playBeepSync(audioCtxRef.current, 1320, 0.4);
      setTimeout(() => {
        setStep('DETECTANDO');
        accel.startDetection();
      }, 500);
    }, 3000);
  }

  const handleSave = useCallback(() => {
    if (!accel.stats) return;
    const entry = {
      id:       Date.now(),
      testType,
      jumps:    accel.jumps,
      stats:    accel.stats,
      bodyMass: bodyMass ? parseFloat(bodyMass) : null,
      date:     new Date().toISOString(),
    };
    const next = [entry, ...savedResults].slice(0, 100);
    setSavedResults(next);
    try {
      localStorage.setItem(`fieldlab_${coach?.id}_bosco`, JSON.stringify(next));
    } catch {}
    setSessionRes(prev => ({ ...prev, [testType]: accel.stats }));
    setStep('SELECTOR');
    accel.reset();
  }, [accel, testType, bodyMass, savedResults, coach]);

  const handleNewTest = useCallback(() => {
    accel.reset();
    setStep('SELECTOR');
  }, [accel]);

  const handleRetry = useCallback(() => {
    accel.reset();
    prevJumpCount.current = 0;
    setStep('ENTREGAR');
  }, [accel]);

  // ── RESULTADO helpers ────────────────────────────────────────────────────────

  const bm      = parseFloat(bodyMass) || null;
  const bestH   = accel.stats?.best ?? 0;
  const watts   = bm ? heightToSayers(bestH, bm) : null;
  const bestRSI = testType === 'DropJump' && accel.jumps.length > 0
    ? (() => {
        const djJumps = accel.jumps.filter(j => j.contactMs != null);
        if (!djJumps.length) return null;
        return djJumps.reduce((best, j) => {
          const r = parseFloat(calcRSI(j.height, j.contactMs));
          return r > parseFloat(best) ? r.toFixed(2) : best;
        }, '0');
      })()
    : null;

  const elasticEff = (sessionRes.CMJ && sessionRes.SJ)
    ? calcElasticEfficiency(sessionRes.CMJ.best, sessionRes.SJ.best)
    : (testType === 'CMJ' && sessionRes.SJ)
      ? calcElasticEfficiency(bestH, sessionRes.SJ.best)
      : (testType === 'SJ' && sessionRes.CMJ)
        ? calcElasticEfficiency(sessionRes.CMJ.best, bestH)
        : null;

  // ── Render ───────────────────────────────────────────────────────────────────

  // Input oculto siempre en el DOM — recibe foco durante COUNTDOWN/DETECTANDO
  // para que iOS no encuentre historial de escritura al hacer shake-to-undo
  const undoTrap = (
    <input
      ref={undoTrapRef}
      type="text"
      readOnly
      autoComplete="off"
      aria-hidden="true"
      tabIndex={-1}
      style={{ position: 'fixed', opacity: 0, width: 1, height: 1,
        left: -9999, pointerEvents: 'none' }}
    />
  );

  // ── SELECTOR ────────────────────────────────────────────────────────────────
  if (step === 'SELECTOR') {
    return (
      <div style={{ paddingBottom: 24 }}>
        {undoTrap}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            Batería de Bosco
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            Evaluación de salto vertical con acelerómetro
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(TEST_CONFIGS).map(([type, cfg]) => (
            <button
              key={type}
              onClick={() => handleSelectTest(type)}
              style={{
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: '18px 20px',
                display: 'flex', alignItems: 'center', gap: 16,
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <span style={{ fontSize: 36 }}>{cfg.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 700 }}>
                  {cfg.label}
                </div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                  {cfg.desc}
                </div>
                {sessionRes[type] && (
                  <div style={{ marginTop: 6 }}>
                    <Pill color={C.green}>
                      Mejor: {sessionRes[type].best} cm
                    </Pill>
                  </div>
                )}
              </div>
              <span style={{ color: C.muted, fontSize: 20 }}>›</span>
            </button>
          ))}
        </div>

        {savedResults.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ color: C.muted, fontSize: 12, fontWeight: 600,
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Historial reciente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {savedResults.slice(0, 5).map(r => (
                <div key={r.id} style={{
                  background: C.card, borderRadius: 12, padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <span style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600 }}>
                      {TEST_CONFIGS[r.testType]?.label ?? r.testType}
                    </span>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                      {new Date(r.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: C.accent, fontSize: 16, fontWeight: 700,
                  }}>
                    {r.stats.best} cm
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── CONFIG ───────────────────────────────────────────────────────────────────
  if (step === 'CONFIG') {
    const cfg = TEST_CONFIGS[testType];
    return (
      <div style={{ paddingBottom: 24 }}>
        {undoTrap}
        <button onClick={() => setStep('SELECTOR')}
          style={{ background: 'none', border: 'none', color: C.muted,
            fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 20 }}>
          ← Volver
        </button>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {cfg.icon} {cfg.label}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>{cfg.desc}</p>
        </div>

        <div style={{ background: C.card, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Instrucciones
          </div>
          {cfg.instruction.map((line, i) => (
            <div key={i} style={{ color: C.muted, fontSize: 13, marginBottom: 6,
              display: 'flex', gap: 8 }}>
              <span style={{ color: C.accent, minWidth: 18 }}>{i + 1}.</span>
              {line}
            </div>
          ))}
        </div>

        <div style={{ background: C.card, borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            Configuración
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ color: C.muted, fontSize: 12, display: 'block', marginBottom: 6 }}>
              Número de saltos
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[3, 5, 6].map(n => (
                <button key={n} onClick={() => setNumReps(n)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    border: `1px solid ${numReps === n ? C.accent : C.border}`,
                    background: numReps === n ? C.accent + '22' : 'transparent',
                    color: numReps === n ? C.accent : C.muted,
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ color: C.muted, fontSize: 12, display: 'block', marginBottom: 6 }}>
              Peso corporal (kg) — opcional, para calcular potencia
            </label>
            <input
              type="number" inputMode="decimal" placeholder="ej. 75"
              value={bodyMass} onChange={e => setBodyMass(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0f172a', border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '10px 14px',
                color: '#f8fafc', fontSize: 15, outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Debug sensor */}
        <button
          onClick={() => setShowDebug(s => !s)}
          style={{
            padding: '8px 16px', borderRadius: 8,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: '#64748b', fontSize: 12, cursor: 'pointer', marginBottom: 8,
          }}>
          {showDebug ? 'Ocultar debug' : 'Ver sensor'}
        </button>
        {showDebug && (
          <div style={{
            background: '#0f172a', border: `1px solid ${C.border}`,
            borderRadius: 12, padding: 16, marginBottom: 12,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
              DEBUG — Aceleración en tiempo real
            </div>
            <div style={{ color: C.accent, fontSize: 28, fontWeight: 700 }}>
              {currentMag != null ? currentMag.toFixed(1) : '--'} m/s²
            </div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>
              Reposo: ~9.8 · Caída libre: ~0–2 · Impacto: ~15–30
            </div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
              Umbral despegue: &lt;4.0 · Umbral aterrizaje: &gt;12.0
            </div>
          </div>
        )}

        {accel.error && (
          <div style={{ background: '#ef444422', border: '1px solid #ef4444',
            borderRadius: 12, padding: '12px 16px', marginBottom: 16,
            color: '#ef4444', fontSize: 13 }}>
            {accel.error}
          </div>
        )}

        <button onClick={handleGoKiosk}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 14,
            background: C.accent, border: 'none',
            color: '#0f172a', fontSize: 16, fontWeight: 800,
            cursor: 'pointer',
          }}>
          Entregar al atleta →
        </button>
      </div>
    );
  }

  // ── ENTREGAR (kiosko) ────────────────────────────────────────────────────────
  if (step === 'ENTREGAR') {
    const cfg = TEST_CONFIGS[testType];
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 32,
      }}>
        {undoTrap}
        <div style={{ fontSize: 56, marginBottom: 12 }}>{cfg.icon}</div>
        <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 700,
          marginBottom: 8, textAlign: 'center', margin: '0 0 8px' }}>
          {cfg.label}
        </h2>
        <p style={{ color: C.muted, fontSize: 13, textAlign: 'center',
          marginBottom: 28, lineHeight: 1.7, maxWidth: 320 }}>
          {cfg.instruction.join('\n')}
        </p>

        <div style={{
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.3)',
          borderRadius: 12, padding: '12px 20px',
          marginBottom: 36, textAlign: 'center', maxWidth: 300,
        }}>
          <p style={{ color: C.accent, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            Colocate el celular en el bolsillo o cintura.<br />
            Tocá INICIAR cuando estés listo.
          </p>
        </div>

        <button onClick={handleAthleteStart}
          style={{
            width: 180, height: 180, borderRadius: '50%',
            background: C.accent, border: 'none',
            color: '#0f172a', fontSize: 22, fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 0 60px rgba(56,189,248,0.35)',
          }}>
          INICIAR
        </button>

        <button onClick={() => setStep('CONFIG')}
          style={{ marginTop: 32, background: 'none', border: 'none',
            color: 'rgba(148,163,184,0.5)', fontSize: 13, cursor: 'pointer' }}>
          ← Cancelar
        </button>
      </div>
    );
  }

  // ── COUNTDOWN ────────────────────────────────────────────────────────────────
  if (step === 'COUNTDOWN') {
    const numColor = countNum === 'GO' ? C.green
      : countNum === 1 ? C.red
      : countNum === 2 ? C.yellow
      : C.accent;
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {undoTrap}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 140, fontWeight: 900,
          color: numColor,
          transition: 'color 0.15s',
        }}>
          {countNum}
        </span>
      </div>
    );
  }

  // ── DETECTANDO (kiosko) ──────────────────────────────────────────────────────
  if (step === 'DETECTANDO') {
    const last = accel.jumps[accel.jumps.length - 1];
    return (
      <div
        contentEditable={false}
        suppressContentEditableWarning
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: C.bg,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 24, touchAction: 'none',
        }}
      >
        {undoTrap}
        <div style={{
          background: accel.state === 'airborne'
            ? 'rgba(34,197,94,0.12)' : 'rgba(56,189,248,0.08)',
          border: `2px solid ${accel.state === 'airborne' ? C.green : C.border}`,
          borderRadius: 16, padding: '8px 24px',
          transition: 'all 0.15s',
        }}>
          <span style={{
            color: accel.state === 'airborne' ? C.green : C.muted,
            fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
          }}>
            {accel.state === 'airborne' ? '↑ EN EL AIRE' : '● EN EL SUELO'}
          </span>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 96, fontWeight: 900,
            color: C.accent, lineHeight: 1,
          }}>
            {accel.jumps.length}
          </div>
          <div style={{ color: C.muted, fontSize: 14, marginTop: 4 }}>
            de {numReps} saltos
          </div>
        </div>

        {last && (
          <div style={{ background: C.card, borderRadius: 12,
            padding: '10px 28px', textAlign: 'center' }}>
            <span style={{ color: C.muted, fontSize: 12 }}>Último: </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: C.green, fontSize: 18, fontWeight: 700,
            }}>
              {last.height} cm
            </span>
            {last.contactMs && (
              <span style={{ color: C.muted, fontSize: 12, marginLeft: 8 }}>
                · {last.contactMs} ms contacto
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => {
            accel.stopDetection();
            _playBeepSync(audioCtxRef.current, 440, 0.5);
            setStep('RESULTADO');
          }}
          style={{
            marginTop: 16, minWidth: 200, minHeight: 56,
            padding: '18px 56px', borderRadius: 14,
            border: '2px solid #475569',
            background: 'rgba(30,41,59,0.8)', color: C.muted,
            fontSize: 17, fontWeight: 700, cursor: 'pointer',
            letterSpacing: '0.08em',
            WebkitTapHighlightColor: 'transparent',
          }}>
          FINALIZAR
        </button>
      </div>
    );
  }

  // ── RESULTADO ────────────────────────────────────────────────────────────────
  if (step === 'RESULTADO') {
    const cfg    = TEST_CONFIGS[testType];
    const status = jumpStatus(bestH, testType);
    const statusColor = STATUS_COLOR[status] ?? C.muted;

    return (
      <div style={{ paddingBottom: 32 }}>
        {undoTrap}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {cfg.icon} Resultado — {cfg.label}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            {accel.jumps.length} salto{accel.jumps.length !== 1 ? 's' : ''} registrado{accel.jumps.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Estadísticas principales */}
        {accel.stats && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <StatCard label="Mejor" value={accel.stats.best} unit="cm"
              color={statusColor} />
            <StatCard label="Promedio" value={accel.stats.avg}  unit="cm" />
            <StatCard label="Peor"    value={accel.stats.worst} unit="cm" />
          </div>
        )}

        {/* Métricas adicionales */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {watts != null && (
            <div style={{ background: C.card, borderRadius: 12,
              padding: '12px 16px', flex: 1, minWidth: 120 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace",
                color: C.accent, fontSize: 20, fontWeight: 800 }}>
                {watts} W
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                Potencia Sayers
              </div>
            </div>
          )}
          {bestRSI != null && (
            <div style={{ background: C.card, borderRadius: 12,
              padding: '12px 16px', flex: 1, minWidth: 120 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace",
                color: STATUS_COLOR[rsiStatus(bestRSI)], fontSize: 20, fontWeight: 800 }}>
                {bestRSI}
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>RSI (mejor)</div>
            </div>
          )}
          {elasticEff != null && (
            <div style={{ background: C.card, borderRadius: 12,
              padding: '12px 16px', flex: 1, minWidth: 120 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace",
                color: elasticEff >= 10 ? C.green : elasticEff >= 0 ? C.yellow : C.red,
                fontSize: 20, fontWeight: 800 }}>
                {elasticEff > 0 ? '+' : ''}{elasticEff}%
              </div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                Eficiencia elástica (CMJ/SJ)
              </div>
            </div>
          )}
        </div>

        {/* Semáforo */}
        {status && (
          <div style={{ background: C.card, borderRadius: 16,
            padding: '14px 18px', marginBottom: 16,
            borderLeft: `4px solid ${statusColor}` }}>
            <div style={{ color: statusColor, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
              {status === 'green' ? '✓ Óptimo'
                : status === 'yellow' ? '⚠ Precaución'
                : '✕ Por debajo del mínimo'}
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>
              {testType === 'CMJ' &&
                (status === 'green' ? 'CMJ ≥ 40 cm — dentro de rango élite' :
                 status === 'yellow' ? 'CMJ 30–39 cm — margen de mejora' :
                 'CMJ < 30 cm — intervención recomendada')}
              {testType === 'SJ' &&
                (status === 'green' ? 'SJ ≥ 35 cm — buena base de fuerza concéntrica' :
                 status === 'yellow' ? 'SJ 30–34 cm — nivel intermedio' :
                 'SJ < 30 cm — déficit de fuerza concéntrica')}
            </div>
          </div>
        )}
        {bestRSI != null && (
          <div style={{ background: C.card, borderRadius: 16,
            padding: '14px 18px', marginBottom: 16,
            borderLeft: `4px solid ${STATUS_COLOR[rsiStatus(bestRSI)]}` }}>
            <div style={{ color: STATUS_COLOR[rsiStatus(bestRSI)], fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
              RSI {parseFloat(bestRSI) >= 1.5 ? '✓ Óptimo'
                : parseFloat(bestRSI) >= 1.0 ? '⚠ Precaución'
                : '✕ Bajo'}
            </div>
            <div style={{ color: C.muted, fontSize: 12 }}>
              {parseFloat(bestRSI) >= 1.5 ? 'RSI ≥ 1.5 — capacidad reactiva excelente'
                : parseFloat(bestRSI) >= 1.0 ? 'RSI 1.0–1.49 — capacidad reactiva moderada'
                : 'RSI < 1.0 — déficit en ciclo estiramiento-acortamiento'}
            </div>
          </div>
        )}

        {/* Tabla de saltos */}
        <div style={{ background: C.card, borderRadius: 16,
          padding: '16px', marginBottom: 20 }}>
          <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            Detalle de saltos
          </div>
          {accel.jumps.map((j, i) => {
            const jStatus = jumpStatus(j.height, testType);
            const jRSI    = j.contactMs ? calcRSI(j.height, j.contactMs) : null;
            return (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '8px 0',
                borderBottom: i < accel.jumps.length - 1
                  ? `1px solid ${C.border}` : 'none',
              }}>
                <span style={{ color: C.muted, fontSize: 13 }}>
                  Salto {i + 1}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: C.muted, fontSize: 11 }}>
                    {j.flightMs} ms
                    {j.contactMs ? ` · ${j.contactMs} ms ctc` : ''}
                  </span>
                  {jRSI && (
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: STATUS_COLOR[rsiStatus(jRSI)], fontSize: 13, fontWeight: 700,
                    }}>
                      RSI {jRSI}
                    </span>
                  )}
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: jStatus ? STATUS_COLOR[jStatus] : C.accent,
                    fontSize: 15, fontWeight: 700, minWidth: 50, textAlign: 'right',
                  }}>
                    {j.height} cm
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleSave}
            style={{
              padding: '15px 0', borderRadius: 14,
              background: C.green, border: 'none',
              color: '#0f172a', fontSize: 15, fontWeight: 800,
              cursor: 'pointer',
            }}>
            Guardar resultado
          </button>
          <button onClick={handleRetry}
            style={{
              padding: '14px 0', borderRadius: 14,
              border: `1px solid ${C.border}`,
              background: 'transparent', color: '#f8fafc',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
            Repetir test
          </button>
          <button onClick={handleNewTest}
            style={{
              padding: '14px 0', borderRadius: 14,
              border: 'none', background: 'transparent',
              color: C.muted, fontSize: 14, cursor: 'pointer',
            }}>
            Nuevo test
          </button>
        </div>
      </div>
    );
  }

  return null;
}
