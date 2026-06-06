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

function jumpStatus(heightCm, testType) {
  const { optimo, precaucion } = TEST_CONFIGS[testType]?.normal ?? { optimo: 40, precaucion: 30 };
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
  const [sessionRes,  setSessionRes]  = useState({});

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

  const timer          = useManualTimer({ maxJumps: numReps });
  const video          = useVideoAnalysis();
  const cameraInputRef = useRef(null);
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
      setStep('RESULTADO');
    }
  }, [step, timer.isComplete, beeps.end]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const activeJumps   = modo === 'A' ? timer.jumps : manualJumps;
  const activeHeights = activeJumps.map(j => j.height);
  const activeStats   = activeHeights.length > 0 ? {
    best:  Math.max(...activeHeights),
    avg:   Math.round(activeHeights.reduce((a, b) => a + b, 0) / activeHeights.length),
    worst: Math.min(...activeHeights),
  } : null;

  const bm    = parseFloat(bodyMass) || null;
  const bestH = activeStats?.best ?? 0;
  const watts = bm ? heightToSayers(bestH, bm) : null;

  const elasticEff = (sessionRes.CMJ && sessionRes.SJ)
    ? calcElasticEfficiency(sessionRes.CMJ.best, sessionRes.SJ.best)
    : (testType === 'CMJ' && sessionRes.SJ && activeStats)
      ? calcElasticEfficiency(bestH, sessionRes.SJ.best)
      : (testType === 'SJ' && sessionRes.CMJ && activeStats)
        ? calcElasticEfficiency(sessionRes.CMJ.best, bestH)
        : null;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleSelectTest(type) {
    setTestType(type);
    setStep('MODO');
  }

  function handleSelectModo(m) {
    setModo(m);
    setStep('CONFIG');
  }

  function clearFileInputs() {
    if (cameraInputRef.current)  cameraInputRef.current.value  = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }

  function handleVideoFile(file) {
    if (!file) return;
    video.loadVideo(file);
    setStep('ANALIZANDO_B');
  }

  function handleStartEval() {
    timer.reset();
    setManualJumps([]);
    video.clearVideo();
    clearFileInputs();
    setStep(modo === 'A' ? 'EVALUANDO_A' : 'GRABANDO_B');
  }

  function handleConfirmVideoJump() {
    if (!video.result) return;
    const updated = [...manualJumps, { height: video.result.height, flightMs: video.result.flightMs }];
    setManualJumps(updated);
    if (updated.length >= numReps) {
      setStep('RESULTADO');
    } else {
      video.clearVideo();
      clearFileInputs();
      setStep('GRABANDO_B');
    }
  }

  function handleSave() {
    if (!activeStats) return;
    const entry = {
      id: Date.now(), testType, modo,
      jumps: activeJumps, stats: activeStats,
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
    setStep('SELECTOR');
  }

  function handleRetry() {
    timer.reset();
    setManualJumps([]);
    video.clearVideo();
    clearFileInputs();
    setStep(modo === 'A' ? 'EVALUANDO_A' : 'GRABANDO_B');
  }

  function handleNewTest() {
    timer.reset();
    setManualJumps([]);
    video.clearVideo();
    clearFileInputs();
    setModo(null);
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
            fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 20 }}>
          ← Volver
        </button>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {cfg.icon} {cfg.label}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>¿Cómo evaluás?</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => handleSelectModo('A')}
            style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '20px',
              display: 'flex', alignItems: 'flex-start', gap: 16,
              cursor: 'pointer', textAlign: 'left', width: '100%',
            }}
          >
            <span style={{ fontSize: 36 }}>👥</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                Modo Equipo
              </div>
              <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
                El profe toca ↑ al despegue y ↓ al aterrizaje mientras observa al atleta
              </div>
              <div style={{ color: C.green, fontSize: 11, fontWeight: 700, marginTop: 6 }}>
                Rápido · Para grupos
              </div>
            </div>
          </button>

          <button
            onClick={() => handleSelectModo('B')}
            style={{
              background: C.card, border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '20px',
              display: 'flex', alignItems: 'flex-start', gap: 16,
              cursor: 'pointer', textAlign: 'left', width: '100%',
            }}
          >
            <span style={{ fontSize: 36 }}>📱</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#f8fafc', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                Modo Autoevaluación
              </div>
              <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
                Grabás el salto con el celu y marcás los frames de despegue y aterrizaje
              </div>
              <div style={{ color: C.accent, fontSize: 11, fontWeight: 700, marginTop: 6 }}>
                Solo · Más preciso
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── CONFIG ────────────────────────────────────────────────────────────────────
  if (step === 'CONFIG') {
    const cfg = TEST_CONFIGS[testType];
    return (
      <div style={{ paddingBottom: 24 }}>
        <button onClick={() => setStep('MODO')}
          style={{ background: 'none', border: 'none', color: C.muted,
            fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 20 }}>
          ← Volver
        </button>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {cfg.icon} {cfg.label}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            {modo === 'A' ? '👥 Modo Equipo' : '📱 Modo Autoevaluación'}
          </p>
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

        <button
          onTouchStart={(e) => { e.preventDefault(); handleStartEval(); }}
          onClick={handleStartEval}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 14,
            background: C.accent, border: 'none',
            color: '#0f172a', fontSize: 16, fontWeight: 800,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
          Comenzar →
        </button>
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
        <div style={{ color: C.muted, fontSize: 14 }}>
          Salto {timer.jumps.length + (timer.phase === 'airborne' ? 1 : 1)} de {numReps}
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
              const st = jumpStatus(j.height, testType);
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
            if (timer.jumps.length === 0) { setStep('CONFIG'); return; }
            playBeep(beeps.end);
            setStep('RESULTADO');
          }}
          style={{
            padding: '12px 32px', borderRadius: 10,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.muted, fontSize: 14, cursor: 'pointer',
          }}
        >
          Finalizar ({timer.jumps.length}/{numReps})
        </button>
      </div>
    );
  }

  // ── GRABANDO_B ────────────────────────────────────────────────────────────────
  if (step === 'GRABANDO_B') {
    return (
      <div style={{ paddingBottom: 24 }}>
        <button onClick={() => setStep('CONFIG')}
          style={{ background: 'none', border: 'none', color: C.muted,
            fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 20 }}>
          ← Volver
        </button>

        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 700, margin: 0 }}>
            Salto {manualJumps.length + 1} de {numReps}
          </h2>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            Grabá el salto con el celu apoyado
          </p>
        </div>

        <div style={{ background: C.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Cómo posicionar la cámara
          </div>
          <ol style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
            <li>Apoyá el celu contra la pared o en el piso</li>
            <li>La cámara debe ver los pies completos</li>
            <li>Grabá el salto en video</li>
            <li>Cargá el video para analizarlo</li>
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
          🎥 Grabar con cámara
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="video/*"
          capture="environment"
          onChange={(e) => handleVideoFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />

        <button
          onClick={() => galleryInputRef.current?.click()}
          style={{
            width: '100%', padding: '15px', borderRadius: 12,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.text, fontWeight: 600, fontSize: 15, cursor: 'pointer',
          }}
        >
          📁 Cargar desde galería
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => handleVideoFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />

        {manualJumps.length > 0 && (
          <button
            onClick={() => setStep('RESULTADO')}
            style={{
              width: '100%', marginTop: 10, padding: '13px', borderRadius: 12,
              border: `1px solid ${C.border}`, background: 'transparent',
              color: C.muted, fontSize: 13, cursor: 'pointer',
            }}
          >
            Ver resultados parciales ({manualJumps.length}/{numReps})
          </button>
        )}
      </div>
    );
  }

  // ── ANALIZANDO_B ──────────────────────────────────────────────────────────────
  if (step === 'ANALIZANDO_B') {
    return (
      <div style={{ paddingBottom: 24 }}>
        <button onClick={() => { video.clearVideo(); setStep('GRABANDO_B'); }}
          style={{ background: 'none', border: 'none', color: C.muted,
            fontSize: 14, cursor: 'pointer', padding: '4px 0 0', display: 'block', marginBottom: 8 }}>
          ← Volver a grabar
        </button>

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
            {/* Overlay de play — desbloquea carga de video en iOS cuando loadedmetadata no dispara */}
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
          <div style={{ display: 'flex', gap: 8, padding: '8px 0' }}>
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={video.markTakeoff}
              style={{
                flex: 1, padding: '14px 8px', borderRadius: 10,
                border: `2px solid ${C.green}`,
                background: video.takeoffTime !== null ? 'rgba(34,197,94,0.15)' : 'transparent',
                color: C.green, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
              ↑ Marcar Despegue
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
              ↓ Marcar Aterrizaje
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
            background: C.card, borderRadius: 12, padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 8,
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {video.result && (
              <button onClick={handleConfirmVideoJump}
                style={{
                  padding: '14px', borderRadius: 12,
                  border: 'none', background: C.accent,
                  color: '#0f172a', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                }}>
                ✓ Confirmar salto {manualJumps.length + 1}/{numReps}
              </button>
            )}
            <button onClick={video.reset}
              style={{
                padding: '12px', borderRadius: 12,
                border: `1px solid ${C.border}`, background: 'transparent',
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
    const status      = activeStats ? jumpStatus(activeStats.best, testType) : null;
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
                const jst = jumpStatus(j.height, testType);
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
