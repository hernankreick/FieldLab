import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  useManualTimer,
  heightToSayers,
  calcElasticEfficiency,
} from '../hooks/useManualTimer';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';

const C = {
  bg: '#0f172a', card: '#1e293b', card2: '#273347',
  border: '#334155', accent: '#38bdf8',
  green: '#22c55e', yellow: '#eab308', red: '#ef4444',
  muted: '#94a3b8', text: '#e2e8f0',
};

const TEST_CONFIGS = {
  SJ: {
    label: 'Squat Jump', icon: '⬆️',
    desc: 'Salto desde posición estática sin contramovimiento',
    instruction: [
      'Posición: rodillas flexionadas ~90°, manos en la cintura',
      'Sin contramovimiento — saltar directo hacia arriba',
      'Aterrizaje con rodillas extendidas',
    ],
    normal: { optimo: 35, precaucion: 25 },
  },
  CMJ: {
    label: 'Counter Movement Jump', icon: '↕️',
    desc: 'Salto con contramovimiento libre',
    instruction: [
      'Posición inicial: parado derecho, manos en la cintura',
      'Flexión rápida seguida de salto explosivo',
      'Aterrizaje con rodillas extendidas',
    ],
    normal: { optimo: 40, precaucion: 30 },
  },
  DropJump: {
    label: 'Drop Jump', icon: '⤵️',
    desc: 'Salto reactivo desde cajón',
    instruction: [
      'Caer desde el cajón (30–40 cm)',
      'Rebotar lo más rápido y alto posible',
      'Mínimo tiempo de contacto',
    ],
    normal: { optimo: 25, precaucion: 18 },
  },
};

const NORMAL_UNILATERAL = {
  SJ:       { optimo: 18, precaucion: 12 },
  CMJ:      { optimo: 20, precaucion: 14 },
  DropJump: { optimo: 1.2, precaucion: 0.8 },
};

function jumpStatus(heightCm, testType, isUnilateral = false) {
  const normals = isUnilateral ? NORMAL_UNILATERAL[testType] : TEST_CONFIGS[testType]?.normal;
  const { optimo, precaucion } = normals ?? { optimo: 40, precaucion: 30 };
  if (heightCm >= optimo) return 'green';
  if (heightCm >= precaucion) return 'yellow';
  return 'red';
}

const STATUS_COLOR = { green: C.green, yellow: C.yellow, red: C.red };

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

// WAV synthesis — usa <audio> HTML → AVAudioSessionCategoryPlayback → altavoz principal
function genBeepWav(freq, durationMs, sampleRate = 22050) {
  const n   = Math.round(sampleRate * durationMs / 1000);
  const buf = new ArrayBuffer(44 + n * 2);
  const v   = new DataView(buf);
  const ws  = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
  ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const t   = i / sampleRate;
    const env = Math.max(0, Math.min(t / 0.005, 1) * Math.min((durationMs / 1000 - t) / 0.015, 1));
    v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * freq * t) * env * 0.9 * 32767), true);
  }
  const bytes = new Uint8Array(buf);
  let b = '';
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(b);
}

function playBeep(src) {
  if (!src) return;
  try {
    const a = new Audio(src);
    a.setAttribute('playsinline', '');
    a.setAttribute('webkit-playsinline', '');
    a.volume = 1.0;
    a.play().catch(() => {});
  } catch {}
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BoscoView({ onFullscreen }) {
  const { coach } = useAuth();

  const [step,        setStep]        = useState('SELECTOR');
  const [modo,        setModo]        = useState(null);      // 'A' | 'B'
  const [testType,    setTestType]    = useState('CMJ');
  const [numReps,     setNumReps]     = useState(5);
  const [bodyMass,    setBodyMass]    = useState('');
  const [manualJumps, setManualJumps] = useState([]);        // acumula saltos modo B
  const [sessionRes,    setSessionRes]    = useState({});
  const [lateralidad,   setLateralidad]   = useState('bilateral'); // 'bilateral' | 'unilateral'
  const [pierna,        setPierna]        = useState(null);        // null | 'izq' | 'der'
  const [resultadoIzq,  setResultadoIzq]  = useState(null);
  const [toast,         setToast]         = useState(null);

  const [savedResults, setSavedResults] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`fieldlab_${coach?.id}_bosco`) || '[]');
    } catch { return []; }
  });

  const beeps = useMemo(() => ({
    jump: genBeepWav(880, 100),
    land: genBeepWav(440, 150),
    end:  genBeepWav(440, 480),
  }), []);

  const [countdownNum, setCountdownNum] = useState(3);
  const audioCtxRef    = useRef(null);

  const timer           = useManualTimer({ maxJumps: numReps });
  const video           = useVideoAnalysis();
  const cameraInputRef  = useRef(null);
  const galleryInputRef = useRef(null);

  // Fullscreen kiosko para modo A
  useEffect(() => {
    onFullscreen?.(step === 'EVALUANDO_A');
    return () => onFullscreen?.(false);
  }, [step, onFullscreen]);

  // Auto-avanzar cuando modo A completa todos los saltos
  useEffect(() => {
    if (step === 'EVALUANDO_A' && timer.isComplete) {
      playBeep(beeps.end);
      handleSerieCompleta(timer.jumps);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, timer.isComplete]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const activeJumps   = modo === 'A' ? timer.jumps : manualJumps;
  const activeHeights = activeJumps.map(j => j.height);
  const activeStats   = activeHeights.length > 0 ? {
    best:  Math.max(...activeHeights),
    avg:   Math.round(activeHeights.reduce((a, b) => a + b, 0) / activeHeights.length),
    worst: Math.min(...activeHeights),
  } : null;

  const isUnilateral = lateralidad === 'unilateral';

  const bm    = parseFloat(bodyMass) || null;
  const bestH = activeStats?.best ?? 0;
  const watts = bm ? heightToSayers(bestH, bm) : null;

  const lsi = (() => {
    if (!isUnilateral || !resultadoIzq || !activeStats) return null;
    const izq    = resultadoIzq.best;
    const der    = activeStats.best;
    const fuerte = Math.max(izq, der);
    const debil  = Math.min(izq, der);
    return {
      valor: Math.round((debil / fuerte) * 100),
      lado:  izq > der ? 'Izquierdo' : 'Derecho',
      izq, der,
    };
  })();

  const lsiStatus = !lsi ? null
    : lsi.valor >= 90 ? { color: C.green,  label: 'Simétrico ✓',            bg: `${C.green}12`  }
    : lsi.valor >= 85 ? { color: C.yellow, label: 'Asimetría leve',         bg: `${C.yellow}12` }
    :                   { color: C.red,    label: 'Asimetría significativa', bg: `${C.red}12`    };

  const elasticEff = (sessionRes.CMJ && sessionRes.SJ)
    ? calcElasticEfficiency(sessionRes.CMJ.best, sessionRes.SJ.best)
    : (testType === 'CMJ' && sessionRes.SJ && activeStats)
      ? calcElasticEfficiency(bestH, sessionRes.SJ.best)
      : (testType === 'SJ' && sessionRes.CMJ && activeStats)
        ? calcElasticEfficiency(sessionRes.CMJ.best, bestH)
        : null;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // AudioContext beep — funciona desde setTimeout porque el ctx ya fue desbloqueado
  function _beep(freq, dur) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.5, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.start(ctx.currentTime);
      o.stop(ctx.currentTime + dur + 0.01);
    } catch {}
  }

  function handleSelectTest(type) {
    setTestType(type);
    setStep('MODO');
  }

  function clearFileInputs() {
    if (cameraInputRef.current)  cameraInputRef.current.value  = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  function handleComenzar() {
    timer.reset();
    setManualJumps([]);
    setCountdownNum(3);
    setStep('COUNTDOWN');
    _beep(880, 0.15);
    setTimeout(() => { setCountdownNum(2); _beep(880, 0.15); }, 1000);
    setTimeout(() => { setCountdownNum(1); _beep(880, 0.15); }, 2000);
    setTimeout(() => {
      setCountdownNum('GO');
      _beep(1320, 0.40);
      setTimeout(() => setStep('EVALUANDO_A'), 600);
    }, 3000);
  }

  function handleSerieCompleta(jumpsData) {
    const heights = jumpsData.map(j => j.height);
    const stats = {
      best:  Math.max(...heights),
      avg:   Math.round(heights.reduce((a, b) => a + b, 0) / heights.length),
      worst: Math.min(...heights),
      jumps: jumpsData,
    };
    if (lateralidad === 'unilateral' && pierna === 'izq') {
      setResultadoIzq(stats);
      setPierna('der');
      if (modo === 'A') {
        handleComenzar();
      } else {
        video.resetAll();
        setManualJumps([]);
        setStep('GRABANDO_B');
      }
      setToast('✓ Pierna izquierda completada — ahora la derecha');
      setTimeout(() => setToast(null), 2500);
    } else {
      setStep('RESULTADO');
    }
  }

  function handleConfirmVideoJump() {
    if (!video.result) return;
    const jumpData = { height: video.result.height, flightMs: video.result.flightMs };
    const updated = [...manualJumps, jumpData];
    setManualJumps(updated);
    if (updated.length >= numReps) {
      handleSerieCompleta(updated);
    } else {
      video.resetMarkers();
    }
  }

  function handleSave() {
    if (!activeStats) return;
    const entry = {
      id: Date.now(), testType, modo, lateralidad,
      jumps: isUnilateral ? { izq: resultadoIzq, der: activeJumps } : activeJumps,
      stats: activeStats,
      resultadoIzq: isUnilateral ? resultadoIzq : null,
      lsi: lsi?.valor ?? null,
      bodyMass: bm, date: new Date().toISOString(),
    };
    const next = [entry, ...savedResults].slice(0, 100);
    setSavedResults(next);
    try {
      localStorage.setItem(`fieldlab_${coach?.id}_bosco`, JSON.stringify(next));
    } catch {}
    setSessionRes(prev => ({ ...prev, [testType]: activeStats }));
    timer.reset();
    setManualJumps([]);
    video.clearVideo();
    setModo(null);
    setLateralidad('bilateral');
    setPierna(null);
    setResultadoIzq(null);
    setStep('SELECTOR');
  }

  function handleRetry() {
    timer.reset();
    setManualJumps([]);
    video.clearVideo();
    clearFileInputs();
    if (isUnilateral) {
      setPierna('izq');
      setResultadoIzq(null);
    }
    if (modo === 'A') {
      handleComenzar();
    } else {
      setStep('GRABANDO_B');
    }
  }

  function handleNewTest() {
    timer.reset();
    setManualJumps([]);
    video.clearVideo();
    clearFileInputs();
    setModo(null);
    setLateralidad('bilateral');
    setPierna(null);
    setResultadoIzq(null);
    setStep('SELECTOR');
  }

  // ── SELECTOR ──────────────────────────────────────────────────────────────────
  if (step === 'SELECTOR') {
    return (
      <div style={{ paddingBottom: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            Batería de Bosco
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            Evaluación de salto vertical
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
                <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 700 }}>{cfg.label}</div>
                <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{cfg.desc}</div>
                {sessionRes[type] && (
                  <div style={{ marginTop: 6 }}>
                    <Pill color={C.green}>Mejor: {sessionRes[type].best} cm</Pill>
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

  // ── MODO ──────────────────────────────────────────────────────────────────────
  if (step === 'MODO') {
    const cfg = TEST_CONFIGS[testType];
    return (
      <div style={{ paddingBottom: 24 }}>
        <button onClick={() => setStep('SELECTOR')}
          style={{ background: 'none', border: 'none', color: C.muted,
            fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 16 }}>
          ← Volver
        </button>

        <h2 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>
          {cfg.icon} {cfg.label}
        </h2>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 16px' }}>Configuración</p>

        {/* Bilateral / Unilateral */}
        <div style={{ background: C.card, borderRadius: 12, padding: '12px 14px',
          marginBottom: 12, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', marginBottom: 10 }}>
            TIPO DE EVALUACIÓN
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'bilateral',  label: '🦵🦵 Bilateral' },
              { key: 'unilateral', label: '🦵 Unilateral' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setLateralidad(key)}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 10,
                  border: `2px solid ${lateralidad === key ? C.accent : C.border}`,
                  background: lateralidad === key ? `${C.accent}15` : 'transparent',
                  color: lateralidad === key ? C.accent : C.muted,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>
                {label}
              </button>
            ))}
          </div>
          {lateralidad === 'unilateral' && (
            <p style={{ color: C.muted, fontSize: 11, margin: '8px 0 0' }}>
              Primero pierna izquierda, luego derecha. LSI automático.
            </p>
          )}
        </div>

        {/* Modo A / B */}
        <div style={{ background: C.card, borderRadius: 12, padding: '12px 14px',
          marginBottom: 12, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', marginBottom: 10 }}>
            MÉTODO DE MEDICIÓN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => {
                setModo('A');
                if (!audioCtxRef.current) {
                  try {
                    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                    audioCtxRef.current.resume();
                  } catch {}
                }
              }}
              style={{
                padding: '14px 16px', borderRadius: 10,
                border: `2px solid ${modo === 'A' ? C.green : C.border}`,
                background: modo === 'A' ? `${C.green}12` : 'transparent',
                color: modo === 'A' ? C.green : C.muted,
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>👥</span>
              <div>
                <div style={{ fontWeight: 700 }}>Modo Equipo</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>
                  El profe toca ↑ despegue y ↓ aterrizaje
                </div>
              </div>
            </button>
            <button
              onClick={() => setModo('B')}
              style={{
                padding: '14px 16px', borderRadius: 10,
                border: `2px solid ${modo === 'B' ? C.accent : C.border}`,
                background: modo === 'B' ? `${C.accent}12` : 'transparent',
                color: modo === 'B' ? C.accent : C.muted,
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>📱</span>
              <div>
                <div style={{ fontWeight: 700 }}>Autoevaluación</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>
                  Grabás el salto y marcás frame a frame
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Saltos + peso */}
        <div style={{ background: C.card, borderRadius: 12, padding: '12px 14px',
          marginBottom: 20, border: `1px solid ${C.border}` }}>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', marginBottom: 10 }}>
            SALTOS POR {lateralidad === 'unilateral' ? 'PIERNA' : 'SERIE'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[3, 5, 6].map(n => (
              <button key={n} onClick={() => setNumReps(n)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  border: `2px solid ${numReps === n ? C.accent : C.border}`,
                  background: numReps === n ? `${C.accent}15` : 'transparent',
                  color: numReps === n ? C.accent : C.muted,
                  fontWeight: 700, fontSize: 16, cursor: 'pointer',
                }}>
                {n}
              </button>
            ))}
          </div>
          <input
            type="number" inputMode="decimal"
            placeholder="Peso corporal (kg) — opcional para Sayers"
            value={bodyMass} onChange={e => setBodyMass(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px', borderRadius: 8,
              background: C.card2, border: `1px solid ${C.border}`,
              color: C.text, fontSize: 13,
            }}
          />
        </div>

        <button
          disabled={!modo}
          onTouchStart={(e) => {
            e.preventDefault();
            if (!modo) return;
            if (!audioCtxRef.current) {
              try {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
                audioCtxRef.current.resume();
              } catch {}
            }
            if (isUnilateral) { setPierna('izq'); setResultadoIzq(null); }
            if (modo === 'A') { handleComenzar(); } else { video.clearVideo(); clearFileInputs(); setManualJumps([]); setStep('GRABANDO_B'); }
          }}
          onClick={() => {
            if (!modo) return;
            if (isUnilateral) { setPierna('izq'); setResultadoIzq(null); }
            if (modo === 'A') { handleComenzar(); } else { video.clearVideo(); clearFileInputs(); setManualJumps([]); setStep('GRABANDO_B'); }
          }}
          style={{
            width: '100%', padding: 18, borderRadius: 14,
            border: 'none',
            background: modo ? C.accent : C.border,
            color: modo ? '#0f172a' : C.muted,
            fontWeight: 800, fontSize: 17,
            cursor: modo ? 'pointer' : 'not-allowed',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {!modo
            ? 'Seleccioná un método'
            : lateralidad === 'unilateral'
            ? 'Comenzar — Pierna Izquierda'
            : 'Comenzar evaluación'}
        </button>
      </div>
    );
  }

  // ── COUNTDOWN ─────────────────────────────────────────────────────────────────
  if (step === 'COUNTDOWN') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 180, fontWeight: 900, lineHeight: 1,
          color: countdownNum === 'GO' ? C.green
               : countdownNum === 1    ? C.red
               : countdownNum === 2    ? C.yellow
               : C.accent,
          userSelect: 'none',
        }}>
          {countdownNum}
        </span>
      </div>
    );
  }

  // ── EVALUANDO_A ───────────────────────────────────────────────────────────────
  if (step === 'EVALUANDO_A') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20,
      }}>
        {isUnilateral && pierna && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: pierna === 'izq' ? `${C.accent}20` : `${C.green}20`,
            border: `1px solid ${pierna === 'izq' ? C.accent : C.green}44`,
            borderRadius: 99, padding: '4px 12px',
            color: pierna === 'izq' ? C.accent : C.green,
            fontSize: 12, fontWeight: 700,
          }}>
            🦵 Pierna {pierna === 'izq' ? 'Izquierda' : 'Derecha'}
          </div>
        )}
        <div style={{ color: C.muted, fontSize: 14 }}>
          Salto {timer.jumps.length + 1} de {numReps}
        </div>

        <div style={{
          color: timer.phase === 'airborne' ? C.green : C.accent,
          fontSize: 16, fontWeight: 700, letterSpacing: '0.1em',
        }}>
          {timer.phase === 'airborne' ? '↑ EN EL AIRE' : '● EN EL SUELO'}
        </div>

        {/* Botón TAP principal */}
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            playBeep(timer.phase === 'idle' ? beeps.jump : beeps.land);
            timer.tap();
          }}
          onClick={() => timer.tap()}
          style={{
            width: 200, height: 200, borderRadius: '50%',
            border: `4px solid ${timer.phase === 'airborne' ? C.green : C.accent}`,
            background: timer.phase === 'airborne'
              ? 'rgba(34,197,94,0.15)' : 'rgba(56,189,248,0.10)',
            color: timer.phase === 'airborne' ? C.green : C.accent,
            fontSize: 56, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
          }}
        >
          {timer.phase === 'airborne' ? '↓' : '↑'}
        </button>

        <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', margin: 0 }}>
          {timer.phase === 'airborne'
            ? 'Tocá cuando los pies aterricen'
            : 'Tocá cuando los pies despeguen'}
        </p>

        {/* Historial de saltos registrados */}
        {timer.jumps.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {timer.jumps.map((j, i) => {
              const st = jumpStatus(j.height, testType, isUnilateral);
              return (
                <div key={i} style={{
                  background: C.card, borderRadius: 8, padding: '6px 12px', textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: STATUS_COLOR[st] ?? C.accent, fontSize: 16, fontWeight: 700,
                  }}>
                    {j.height}cm
                  </div>
                  <div style={{ color: C.muted, fontSize: 10 }}>S{i + 1}</div>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => {
            if (timer.jumps.length === 0) { setStep('MODO'); return; }
            playBeep(beeps.end);
            handleSerieCompleta(timer.jumps);
          }}
          style={{
            padding: '12px 32px', borderRadius: 10,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.muted, fontSize: 14, cursor: 'pointer',
          }}
        >
          Finalizar ({timer.jumps.length}/{numReps})
        </button>

        {toast && (
          <div style={{
            position: 'fixed', top: 60, left: '50%',
            transform: 'translateX(-50%)', zIndex: 1000,
            background: 'rgba(34,197,94,0.95)', color: '#0f172a',
            fontWeight: 700, fontSize: 13, padding: '10px 20px',
            borderRadius: 99, whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ── GRABANDO_B ────────────────────────────────────────────────────────────────
  if (step === 'GRABANDO_B') {
    const cfg = TEST_CONFIGS[testType];
    return (
      <div style={{ paddingBottom: 24 }}>
        <button onClick={() => setStep('MODO')}
          style={{ background: 'none', border: 'none', color: C.muted,
            fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 20 }}>
          ← Volver
        </button>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {cfg.icon} {cfg.label}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            Modo Autoevaluación
          </p>
        </div>

        <div style={{
          background: C.card, borderRadius: 12, padding: 16, marginBottom: 16,
          border: `1px solid ${C.accent}33`,
        }}>
          <p style={{ color: C.accent, fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>
            📹 Grabá todos los saltos en un solo video
          </p>
          <ol style={{ color: C.text, fontSize: 13, lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
            <li>Apoyá el celu en el suelo apuntando a tus pies</li>
            <li>Grabá los {numReps} saltos seguidos</li>
            <li>Después marcás despegue y aterrizaje de cada uno</li>
          </ol>
        </div>

        <button
          onClick={() => cameraInputRef.current?.click()}
          style={{
            width: '100%', padding: '16px', borderRadius: 12,
            border: 'none', background: C.accent,
            color: '#0f172a', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          🎥 Grabar {numReps} saltos
        </button>

        <button
          onClick={() => galleryInputRef.current?.click()}
          style={{
            width: '100%', padding: '15px', borderRadius: 12,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.text, fontWeight: 600, fontSize: 15, cursor: 'pointer',
          }}
        >
          📁 Cargar video existente
        </button>

        <input
          ref={cameraInputRef}
          type="file" accept="video/*" capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) { video.loadVideo(file); setStep('ANALIZANDO_B'); }
          }}
          style={{ display: 'none' }}
        />
        <input
          ref={galleryInputRef}
          type="file" accept="video/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) { video.loadVideo(file); setStep('ANALIZANDO_B'); }
          }}
          style={{ display: 'none' }}
        />

        {toast && (
          <div style={{
            position: 'fixed', top: 60, left: '50%',
            transform: 'translateX(-50%)', zIndex: 1000,
            background: 'rgba(34,197,94,0.95)', color: '#0f172a',
            fontWeight: 700, fontSize: 13, padding: '10px 20px',
            borderRadius: 99, whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            {toast}
          </div>
        )}
      </div>
    );
  }

  // ── ANALIZANDO_B ──────────────────────────────────────────────────────────────
  if (step === 'ANALIZANDO_B') {
    return (
      <div style={{ background: '#000', minHeight: '100vh' }}>

        {/* Header con progreso */}
        <div style={{
          background: C.card, padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <button
            onClick={() => {
              video.resetAll();
              setManualJumps([]);
              setStep('GRABANDO_B');
            }}
            style={{
              background: 'none', border: 'none',
              color: C.muted, cursor: 'pointer', fontSize: 13, padding: 0,
            }}
          >
            ← Nuevo video
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: C.accent, fontSize: 14, fontWeight: 700,
            }}>
              Salto {manualJumps.length + 1} / {numReps}
            </div>
            {isUnilateral && pierna && (
              <div style={{
                color: pierna === 'izq' ? C.accent : C.green,
                fontSize: 11, fontWeight: 700,
              }}>
                🦵 {pierna === 'izq' ? 'Izquierda' : 'Derecha'}
              </div>
            )}
          </div>
          <div style={{ width: 80 }} />
        </div>

        {/* Chips de saltos ya registrados */}
        {manualJumps.length > 0 && (
          <div style={{
            display: 'flex', gap: 8, padding: '8px 16px',
            background: C.card, borderBottom: `1px solid ${C.border}`,
            flexWrap: 'wrap',
          }}>
            {manualJumps.map((j, i) => {
              const st = jumpStatus(j.height, testType, isUnilateral);
              return (
                <div key={i} style={{
                  background: C.card2, borderRadius: 8,
                  padding: '4px 10px', textAlign: 'center',
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    color: STATUS_COLOR[st] ?? C.accent,
                    fontSize: 13, fontWeight: 700,
                  }}>
                    S{i + 1}: {j.height}cm
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Video */}
        {video.videoSrc && (
          <div style={{ position: 'relative', background: '#000' }}>
            <video
              ref={video.videoRef}
              src={video.videoSrc}
              onLoadedMetadata={video.onVideoLoad}
              onTimeUpdate={video.onVideoTimeUpdate}
              playsInline
              muted
              preload="auto"
              style={{ width: '100%', display: 'block', background: '#000',
                WebkitPlaysinline: true }}
            />
            {!video.isReady && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.6)', gap: 12,
              }}>
                <button
                  onClick={() => {
                    const v = video.videoRef.current;
                    if (!v) return;
                    v.play()
                      .then(() => { v.pause(); video.forceReady(); })
                      .catch(() => video.forceReady());
                  }}
                  style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'rgba(56,189,248,0.9)',
                    border: 'none', color: '#0f172a',
                    fontSize: 24, cursor: 'pointer',
                  }}
                >
                  ▶
                </button>
                <span style={{ color: C.muted, fontSize: 12 }}>Tocá para cargar el video</span>
              </div>
            )}
            {video.takeoffTime !== null && (
              <div style={{
                position: 'absolute', top: 8, left: 8,
                background: 'rgba(34,197,94,0.9)', borderRadius: 6,
                padding: '4px 10px', color: '#0f172a', fontSize: 11, fontWeight: 700,
              }}>
                ↑ {video.takeoffTime.toFixed(3)}s
              </div>
            )}
            {video.landingTime !== null && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(239,68,68,0.9)', borderRadius: 6,
                padding: '4px 10px', color: '#fff', fontSize: 11, fontWeight: 700,
              }}>
                ↓ {video.landingTime.toFixed(3)}s
              </div>
            )}
          </div>
        )}

        {/* Slider de progreso */}
        {video.isReady && (
          <div style={{
            background: C.card, padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <input
              type="range" min="0" max={video.duration}
              step={1 / video.fps} value={video.currentTime}
              onChange={(e) => video.seekTo(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: C.accent }}
            />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              color: C.muted, fontSize: 11, minWidth: 42, flexShrink: 0,
            }}>
              {video.currentTime.toFixed(2)}s
            </span>
          </div>
        )}

        {/* Controles frame a frame */}
        {video.isReady && (
          <div style={{
            display: 'flex', gap: 8, padding: '10px 16px',
            background: C.card, borderBottom: `1px solid ${C.border}`,
          }}>
            <button onClick={() => video.stepFrame(-1)}
              style={{
                flex: 1, padding: '12px', borderRadius: 10,
                border: `1px solid ${C.border}`, background: C.card2,
                color: C.text, fontSize: 16, cursor: 'pointer',
              }}>
              ◀ Frame
            </button>
            <button onClick={() => video.stepFrame(1)}
              style={{
                flex: 1, padding: '12px', borderRadius: 10,
                border: `1px solid ${C.border}`, background: C.card2,
                color: C.text, fontSize: 16, cursor: 'pointer',
              }}>
              Frame ▶
            </button>
          </div>
        )}

        {/* Botones de marcado */}
        {video.isReady && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
            <button onClick={video.markTakeoff}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 10,
                border: `2px solid ${C.green}`,
                background: video.takeoffTime !== null ? 'rgba(34,197,94,0.15)' : 'transparent',
                color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
              ↑ Despegue
              {video.takeoffTime !== null && (
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>
                  {video.takeoffTime.toFixed(3)}s
                </div>
              )}
            </button>
            <button onClick={video.markLanding}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 10,
                border: `2px solid ${C.red}`,
                background: video.landingTime !== null ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: C.red, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
              ↓ Aterrizaje
              {video.landingTime !== null && (
                <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2 }}>
                  {video.landingTime.toFixed(3)}s
                </div>
              )}
            </button>
          </div>
        )}

        {/* Preview resultado */}
        {video.result && (
          <div style={{
            margin: '0 16px',
            background: C.card, borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: `1px solid ${C.green}33`,
          }}>
            <div>
              <div style={{ color: C.muted, fontSize: 11 }}>Tiempo de vuelo</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace",
                color: C.accent, fontSize: 15, fontWeight: 700 }}>
                {video.result.flightMs} ms
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: C.muted, fontSize: 11 }}>Altura estimada</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace",
                color: C.green, fontSize: 28, fontWeight: 700 }}>
                {video.result.height} cm
              </div>
            </div>
          </div>
        )}

        {video.isReady && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px 32px' }}>
            {(() => {
              const isDuplicate = manualJumps.length > 0 &&
                video.result?.flightMs === manualJumps[manualJumps.length - 1]?.flightMs;
              const canConfirm = video.result !== null && !isDuplicate;
              return (
                <button
                  onClick={handleConfirmVideoJump}
                  disabled={!canConfirm}
                  style={{
                    padding: '15px', borderRadius: 12,
                    border: 'none',
                    background: canConfirm ? C.accent : C.border,
                    color: canConfirm ? '#0f172a' : C.muted,
                    fontWeight: 700, fontSize: 15,
                    cursor: canConfirm ? 'pointer' : 'not-allowed',
                    opacity: canConfirm ? 1 : 0.6,
                  }}
                >
                  {isDuplicate
                    ? `⚠ Marcá nuevos puntos para el salto ${manualJumps.length + 1}`
                    : `✓ Confirmar salto ${manualJumps.length + 1}/${numReps}`}
                </button>
              );
            })()}
            <button onClick={video.resetMarkers}
              style={{
                padding: '12px', borderRadius: 12,
                border: 'none', background: 'transparent',
                color: C.muted, fontSize: 13, cursor: 'pointer',
              }}>
              Remarcar puntos
            </button>
          </div>
        )}

        {!video.isReady && (
          <div style={{ padding: '16px 0', textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Cargando video…
          </div>
        )}
      </div>
    );
  }

  // ── RESULTADO ─────────────────────────────────────────────────────────────────
  if (step === 'RESULTADO') {
    const cfg         = TEST_CONFIGS[testType];
    const status      = activeStats ? jumpStatus(activeStats.best, testType, isUnilateral) : null;
    const statusColor = STATUS_COLOR[status] ?? C.muted;

    return (
      <div style={{ paddingBottom: 32 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {cfg.icon} Resultado — {cfg.label}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            {activeJumps.length} salto{activeJumps.length !== 1 ? 's' : ''} ·{' '}
            {modo === 'A' ? 'Cronómetro manual' : 'Video frame a frame'}
          </p>
        </div>

        {activeStats ? (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <StatCard label="Mejor"   value={activeStats.best}  unit="cm" color={statusColor} />
              <StatCard label="Promedio" value={activeStats.avg}   unit="cm" />
              <StatCard label="Peor"    value={activeStats.worst} unit="cm" />
            </div>

            {lsi && lsiStatus && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: 10, marginBottom: 10,
                }}>
                  {[
                    { label: 'IZQUIERDO', value: lsi.izq },
                    { label: 'DERECHO',   value: lsi.der },
                  ].map(({ label, value }) => {
                    const col = jumpStatus(value, testType, true);
                    const colHex = STATUS_COLOR[col] ?? C.accent;
                    return (
                      <div key={label} style={{
                        background: C.card2, border: `1px solid ${colHex}33`,
                        borderRadius: 12, padding: '14px 10px', textAlign: 'center',
                      }}>
                        <div style={{ color: C.muted, fontSize: 10,
                          fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>
                          {label}
                        </div>
                        <div style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 36, fontWeight: 700, color: colHex, lineHeight: 1,
                        }}>
                          {value}
                        </div>
                        <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>cm (mejor)</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  background: lsiStatus.bg, border: `1px solid ${lsiStatus.color}33`,
                  borderRadius: 12, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                  <div>
                    <div style={{ color: C.text, fontSize: 13, fontWeight: 700 }}>
                      LSI — Limb Symmetry Index
                    </div>
                    <div style={{ color: lsiStatus.color, fontSize: 12, marginTop: 2 }}>
                      {lsiStatus.label}
                      {lsi.valor < 90 && ` — lado ${lsi.lado} dominante`}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 32, fontWeight: 700, color: lsiStatus.color,
                  }}>
                    {lsi.valor}%
                  </div>
                </div>
                <div style={{
                  background: C.card, borderRadius: 12,
                  padding: '12px 14px', border: `1px solid ${C.border}`,
                }}>
                  <div style={{ color: C.muted, fontSize: 11, fontWeight: 700,
                    marginBottom: 6, letterSpacing: '0.05em' }}>
                    INTERPRETACIÓN CLÍNICA
                  </div>
                  <p style={{ color: C.text, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
                    {lsi.valor >= 90
                      ? 'Excelente simetría bilateral. Sin indicadores de riesgo por asimetría.'
                      : lsi.valor >= 85
                      ? `Asimetría leve. El lado ${lsi.lado} presenta ${100 - lsi.valor}% menos potencia. Monitorear en próximas evaluaciones.`
                      : `Asimetría significativa (LSI < 85%). El lado ${lsi.lado} presenta déficit de ${100 - lsi.valor}%. Alta correlación con riesgo de lesión. Evaluar intervención.`}
                  </p>
                </div>
              </div>
            )}

            {(watts != null || elasticEff != null) && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {watts != null && (
                  <div style={{ background: C.card, borderRadius: 12,
                    padding: '12px 16px', flex: 1, minWidth: 120 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace",
                      color: C.accent, fontSize: 20, fontWeight: 800 }}>
                      {watts} W
                    </div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>Potencia Sayers</div>
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
            )}

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
                  {testType === 'CMJ' && (status === 'green'
                    ? 'CMJ ≥ 40 cm — dentro de rango élite'
                    : status === 'yellow' ? 'CMJ 30–39 cm — margen de mejora'
                    : 'CMJ < 30 cm — intervención recomendada')}
                  {testType === 'SJ' && (status === 'green'
                    ? 'SJ ≥ 35 cm — buena base de fuerza concéntrica'
                    : status === 'yellow' ? 'SJ 25–34 cm — nivel intermedio'
                    : 'SJ < 25 cm — déficit de fuerza concéntrica')}
                  {testType === 'DropJump' && (status === 'green'
                    ? 'Drop Jump ≥ 25 cm — buena capacidad reactiva'
                    : status === 'yellow' ? 'Drop Jump 18–24 cm — capacidad reactiva moderada'
                    : 'Drop Jump < 18 cm — déficit en ciclo estiramiento-acortamiento')}
                </div>
              </div>
            )}

            <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 20 }}>
              <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                Detalle de saltos
              </div>
              {activeJumps.map((j, i) => {
                const jst = jumpStatus(j.height, testType, isUnilateral);
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: i < activeJumps.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}>
                    <span style={{ color: C.muted, fontSize: 13 }}>Salto {i + 1}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: C.muted, fontSize: 11 }}>{j.flightMs} ms</span>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        color: STATUS_COLOR[jst] ?? C.accent,
                        fontSize: 15, fontWeight: 700, minWidth: 50, textAlign: 'right',
                      }}>
                        {j.height} cm
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div style={{ background: C.card, borderRadius: 16, padding: 20, marginBottom: 16,
            textAlign: 'center', color: C.muted, fontSize: 13 }}>
            No hay saltos registrados.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeStats && (
            <button onClick={handleSave}
              style={{
                padding: '15px 0', borderRadius: 14,
                background: C.green, border: 'none',
                color: '#0f172a', fontSize: 15, fontWeight: 800, cursor: 'pointer',
              }}>
              Guardar resultado
            </button>
          )}
          <button onClick={handleRetry}
            style={{
              padding: '14px 0', borderRadius: 14,
              border: `1px solid ${C.border}`, background: 'transparent',
              color: '#f8fafc', fontSize: 14, fontWeight: 600, cursor: 'pointer',
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
