import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Video, Play, Square, Save,
  AlertTriangle, CheckCircle, UploadCloud, Maximize2, SwitchCamera, Info, RotateCcw,
} from 'lucide-react';
import Card from '../components/Card';
import { jumpHeightFromFlightTime, sayersPower } from '../utils/biomechanics';
import { usePoseEstimation } from '../hooks/usePoseEstimation';

const JUMP_TYPES = ['SJ', 'CMJ', 'Drop Jump'];

function angleColor(angle) {
  if (angle > 160) return '#22c55e';
  if (angle > 120) return '#f59e0b';
  return '#ef4444';
}

function heightColor(cm) {
  if (cm >= 40) return '#22c55e';
  if (cm >= 25) return '#f59e0b';
  return '#ef4444';
}

// Verde: tobillos + caderas visibles ≥ 0.7. Amarillo: alguno parcial. Rojo: crítico ausente.
// Nota: NO incluye nariz/cabeza porque al filmar de perfil la cara puede no verse bien.
function calcFrameStatus(lm) {
  if (!lm || lm.length < 33) return null;
  const critical   = [27, 28];                 // tobillos (clave para detección)
  const secondary  = [23, 24, 25, 26];         // caderas y rodillas
  if (critical.some(i => (lm[i]?.visibility ?? 0) < 0.5)) return 'red';
  if ([...critical, ...secondary].some(i => (lm[i]?.visibility ?? 0) < 0.6)) return 'yellow';
  return 'green';
}

function FrameStatusBadge({ status }) {
  const cfg = status === 'green'
    ? { bg: 'rgba(34,197,94,0.85)',  label: 'Cuerpo completo ✓' }
    : status === 'yellow'
    ? { bg: 'rgba(245,158,11,0.85)', label: 'Cuerpo parcial' }
    : status === 'red'
    ? { bg: 'rgba(239,68,68,0.85)',  label: 'Cuerpo no visible' }
    : { bg: 'rgba(15,23,42,0.8)',    label: 'Detectando pose…' };
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: status ? '#fff' : '#94a3b8' }}
    >
      <span
        className="w-2 h-2 rounded-full"
        style={{ background: status ? 'rgba(255,255,255,0.7)' : '#38bdf8', opacity: status ? 1 : 0.7 }}
      />
      {cfg.label}
    </div>
  );
}

function saveJumpResult(result) {
  try {
    const key      = 'fieldlab_jump_results';
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]');
    existing.unshift({ ...result, timestamp: Date.now() });
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  } catch { /* ignorar errores de storage */ }
}

// Beep via AudioContext — silencioso si el browser no lo soporta
function playBeep(freq = 880, duration = 100) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch { /* AudioContext no disponible */ }
}

// ── Indicador de ángulo ────────────────────────────────────────────────────────
function AngleChip({ label, value }) {
  const color = angleColor(value);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-base font-data font-bold" style={{ color }}>
        {value != null ? `${Math.round(value)}°` : '—'}
      </span>
    </div>
  );
}

// ── Panel de métricas (usado superpuesto sobre el video en fullscreen) ─────────
function LiveMetrics({ poseData }) {
  if (!poseData) return null;
  const { kneeAngleLeft, kneeAngleRight, hipAngleLeft, hipAngleRight, tripleExtension } = poseData;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        <AngleChip label="Rodilla I" value={kneeAngleLeft}  />
        <AngleChip label="Rodilla D" value={kneeAngleRight} />
        <AngleChip label="Cadera I"  value={hipAngleLeft}   />
        <AngleChip label="Cadera D"  value={hipAngleRight}  />
      </div>
      <div
        className="flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-semibold"
        style={{
          background: tripleExtension ? 'rgba(34,197,94,0.2)'  : 'rgba(100,116,139,0.15)',
          color:      tripleExtension ? '#22c55e'               : '#94a3b8',
          border:     `1px solid ${tripleExtension ? 'rgba(34,197,94,0.5)' : 'rgba(100,116,139,0.25)'}`,
        }}
      >
        {tripleExtension
          ? <><CheckCircle size={12} /> Triple extensión detectada</>
          : 'Esperando triple extensión…'}
      </div>
    </div>
  );
}

// ── Resultado del salto ───────────────────────────────────────────────────────
function JumpResult({ result, massKg, onSave, onDiscard }) {
  const power = sayersPower(result.heightCm, massKg);
  const color = heightColor(result.heightCm);

  return (
    <Card className="border-accent/20">
      <div className="text-center mb-4">
        <span className="text-[10px] uppercase tracking-widest text-slate-500">Altura de salto</span>
        <div className="text-5xl font-data font-bold mt-1" style={{ color }}>
          {result.heightCm.toFixed(1)}
          <span className="text-xl ml-1 text-slate-400">cm</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-[10px] text-slate-500">Tiempo vuelo</p>
          <p className="text-sm font-data font-bold text-slate-200">{result.flightMs} ms</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500">Potencia (Sayers)</p>
          <p className="text-sm font-data font-bold text-slate-200">{Math.round(power)} W</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-500">Tipo</p>
          <p className="text-sm font-semibold text-slate-200">{result.type}</p>
        </div>
      </div>
      {result.maxKneeAngle != null && (
        <p className="text-xs text-slate-500 text-center mb-4">
          Ángulo máx. rodilla:{' '}
          <span className="font-data text-slate-300">{Math.round(result.maxKneeAngle)}°</span>
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={onSave}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
            bg-accent text-background text-sm font-semibold active:scale-95 transition-transform"
        >
          <Save size={14} /> Guardar
        </button>
        <button
          onClick={onDiscard}
          className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400
            text-sm hover:text-slate-200 hover:border-white/20 transition-colors"
        >
          Descartar
        </button>
      </div>
    </Card>
  );
}

// ── Panel de debug en pantalla ────────────────────────────────────────────────
// Lee debugRef.current (ref, no estado) — no causa re-renders extra por sí solo.
// El componente ya re-renderiza cada frame porque poseData cambia, así que los
// valores siempre están frescos.
function DebugPanel({ debugRef, detectionPhase }) {
  const d = debugRef?.current ?? {};
  const F = 9; // font-size base

  const phaseColor = detectionPhase === 'calibrating' ? '#94a3b8'
    : detectionPhase === 'ready'   ? '#22c55e'
    : detectionPhase === 'jumping' ? '#f59e0b'
    : '#64748b';

  const visOk = d.visL != null && d.visR != null && Math.min(d.visL, d.visR) >= 0.50;
  const visStr = (d.visL != null && d.visR != null)
    ? `${d.visL.toFixed(2)}/${d.visR.toFixed(2)}`
    : '—';

  const row = (label, value, color = '#94a3b8') => (
    <div className="flex justify-between gap-2">
      <span style={{ color: '#475569', fontSize: F }}>{label}</span>
      <span style={{ color, fontSize: F, fontFamily: 'monospace' }}>{value ?? '—'}</span>
    </div>
  );

  return (
    <div
      className="absolute top-12 right-2 z-20 flex flex-col gap-0.5 rounded-lg px-2 py-1.5"
      style={{
        background: 'rgba(2,6,23,0.65)',
        border:     '1px solid rgba(255,255,255,0.08)',
        opacity:    0.75,
        minWidth:   120,
      }}
    >
      {row('Fase',    detectionPhase ?? '—', phaseColor)}
      {row('Vis L/R', visStr, visOk ? '#22c55e' : '#ef4444')}
      {row('Rechazo', d.rejectReason ?? '—', d.rejectReason ? '#ef4444' : '#475569')}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function JumpAnalysis({ onNavigate }) {
  const [mode,       setMode]       = useState('realtime');
  const [jumpType,   setJumpType]   = useState('CMJ');
  const [massInput,  setMassInput]  = useState('70'); // string para edición libre
  const massKg = parseFloat(massInput) || 70;         // número derivado para cálculos
  const [jumpResult, setJumpResult] = useState(null);
  const [saved,      setSaved]      = useState(false);
  const [facing,     setFacing]     = useState('environment'); // 'environment' | 'user'
  const [isSwitching, setIsSwitching] = useState(false);

  // Countdown timer state
  // null | 'countdown' | 'go' | 'detecting' | 'timeout'
  const [timerState,    setTimerState]    = useState(null);
  const [countdownNum,  setCountdownNum]  = useState(3);

  // Timer refs — cleared whenever the flow is interrupted
  const countdownTimerRef   = useRef(null);
  const detectionTimerRef   = useRef(null);
  const countdownStartedRef = useRef(false); // prevents double-trigger per session

  const {
    videoRef, canvasRef,
    isRunning, landmarks, poseData, poseReady, error,
    progress, mpLoading, mpError,
    detectionPhase, jumpDetection, resetDetection,
    debugRef,
    startCamera, stopCamera, analyzeVideo,
  } = usePoseEstimation({ mode });

  const frameStatus = poseReady ? calcFrameStatus(landmarks) : null;
  // Minimum ankle visibility (landmarks 27=left, 28=right) — used for framing guards
  const ankleVis = landmarks
    ? Math.min(landmarks[27]?.visibility ?? 0, landmarks[28]?.visibility ?? 0)
    : 0;

  // Bloquear scroll del body cuando la cámara está en fullscreen (incluso mientras cambia)
  useEffect(() => {
    document.body.style.overflow = (isRunning || isSwitching) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isRunning, isSwitching]);

  // Limpiar timers del countdown al desmontar el componente
  useEffect(() => {
    return () => {
      clearTimeout(countdownTimerRef.current);
      clearTimeout(detectionTimerRef.current);
    };
  }, []);

  // ── Countdown logic ──────────────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    // Clear any previous timers before starting a fresh countdown
    clearTimeout(countdownTimerRef.current);
    clearTimeout(detectionTimerRef.current);
    setTimerState('countdown');
    setCountdownNum(3);
    playBeep(880, 100);

    let count = 3;
    const tick = () => {
      count -= 1;
      if (count > 0) {
        setCountdownNum(count);
        playBeep(880, 100);
        countdownTimerRef.current = setTimeout(tick, 1000);
      } else {
        // count === 0 → flash "¡SALTÁ!" then open detection window
        setTimerState('go');
        playBeep(1760, 200);
        countdownTimerRef.current = setTimeout(() => {
          setTimerState('detecting');
          // 3-second detection window — auto-timeout if no valid jump
          detectionTimerRef.current = setTimeout(() => {
            setTimerState('timeout');
            stopCamera();
          }, 3000);
        }, 500);
      }
    };
    countdownTimerRef.current = setTimeout(tick, 1000);
  }, [stopCamera]);

  // Fire countdown once calibration completes AND ankles are visible (vis ≥ 0.3).
  // ankleVis is in the dep array so the effect retries if the person re-frames.
  useEffect(() => {
    if (detectionPhase === 'ready' && isRunning && !countdownStartedRef.current && ankleVis >= 0.3) {
      countdownStartedRef.current = true;
      startCountdown();
    }
  }, [detectionPhase, isRunning, ankleVis, startCountdown]);

  // Handle jump detected by the hook — only during the active detection window
  useEffect(() => {
    if (!jumpDetection) return;
    if (timerState !== 'detecting') {
      // Jump fired outside the window (e.g. during countdown) — discard
      resetDetection();
      return;
    }
    clearTimeout(countdownTimerRef.current);
    clearTimeout(detectionTimerRef.current);
    const { flightMs, maxKneeAngle } = jumpDetection;
    const heightCm = jumpHeightFromFlightTime(flightMs / 1000) * 100;
    setJumpResult({ heightCm, flightMs, type: jumpType, maxKneeAngle });
    setTimerState(null);
    countdownStartedRef.current = false; // allow countdown to re-run on next session
    stopCamera();
    resetDetection();
  }, [jumpDetection, timerState, jumpType, stopCamera, resetDetection]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function clearTimers() {
    clearTimeout(countdownTimerRef.current);
    clearTimeout(detectionTimerRef.current);
  }

  function handleStop() {
    clearTimers();
    setTimerState(null);
    countdownStartedRef.current = false;
    stopCamera();
  }

  function handleToggle() {
    if (isRunning) {
      handleStop();
    } else {
      setJumpResult(null);
      setSaved(false);
      setTimerState(null);
      countdownStartedRef.current = false;
      startCamera(facing);
    }
  }

  async function handleSwitchCamera() {
    if (isSwitching) return;
    const newFacing = facing === 'environment' ? 'user' : 'environment';
    setFacing(newFacing);
    setIsSwitching(true);
    clearTimers();
    setTimerState(null);
    countdownStartedRef.current = false;
    stopCamera();
    await startCamera(newFacing);
    setIsSwitching(false);
  }

  async function handleVideoUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = null; // permite re-seleccionar el mismo archivo
    if (!file) return;
    setJumpResult(null);
    setSaved(false);
    try {
      await analyzeVideo(file);
    } catch (err) {
      // analyzeVideo ya setea error internamente; este catch es por seguridad
      console.error('Error al analizar video:', err);
    }
  }

  function handleSave() {
    if (!jumpResult) return;
    saveJumpResult({ ...jumpResult, massKg });
    setSaved(true);
    onNavigate?.('evaluaciones');
  }

  function handleDiscard() {
    setJumpResult(null);
    setSaved(false);
  }

  function handleModeChange(m) {
    clearTimers();
    if (isRunning) handleStop();
    setMode(m);
    setJumpResult(null);
    setSaved(false);
    setIsSwitching(false);
    setTimerState(null);
    countdownStartedRef.current = false;
  }

  async function handleRetry() {
    clearTimers();
    setTimerState(null);
    countdownStartedRef.current = false;
    stopCamera();
    setJumpResult(null);
    setSaved(false);
    await startCamera(facing);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">Análisis de Salto</h2>
        <p className="text-sm text-slate-400">Detección de pose con MediaPipe</p>
      </div>

      {/* Toggle modo */}
      <div className="flex gap-2 bg-surface rounded-xl p-1">
        {[
          { id: 'realtime', label: 'Tiempo Real', Icon: Camera },
          { id: 'video',    label: 'Video',       Icon: Video  },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => handleModeChange(id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg
              text-sm font-semibold transition-all"
            style={{
              background: mode === id ? 'rgba(56,189,248,0.15)' : 'transparent',
              color:      mode === id ? '#38bdf8'               : '#64748b',
              border:     `1px solid ${mode === id ? 'rgba(56,189,248,0.35)' : 'transparent'}`,
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Selector tipo de salto + masa */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-slate-400 mb-1 block">Tipo de salto</label>
          <div className="flex gap-1.5">
            {JUMP_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setJumpType(t)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: jumpType === t ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                  color:      jumpType === t ? '#38bdf8'                : '#94a3b8',
                  border:     `1px solid ${jumpType === t ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="w-24">
          <label className="text-xs text-slate-400 mb-1 block">Masa (kg)</label>
          <input
            type="text"
            inputMode="numeric"
            value={massInput}
            onChange={e => setMassInput(e.target.value)}
            onFocus={e => e.target.select()}
            onBlur={e => {
              const v = parseFloat(e.target.value);
              setMassInput(v > 0 ? String(v) : '70');
            }}
            className="w-full bg-background border border-white/10 rounded-lg px-3 py-1.5
              text-sm font-data text-slate-100 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Estado de carga de MediaPipe */}
      {mpLoading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-white/[0.08]">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-200">Cargando MediaPipe…</p>
            <p className="text-xs text-slate-500 mt-0.5">Descargando modelo de detección de pose</p>
          </div>
        </div>
      )}

      {/* Error de inicialización de MediaPipe */}
      {mpError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/25 text-sm text-danger">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Error al cargar MediaPipe</p>
            <p className="text-xs mt-0.5 opacity-80">{mpError}</p>
            <p className="text-xs mt-1 opacity-70">Usá el ingreso manual de tiempo de vuelo (abajo).</p>
          </div>
        </div>
      )}

      {/* Error de permisos / dispositivo */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-danger/10 border border-danger/25 text-sm text-danger">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Instrucciones de configuración — solo modo realtime cuando no hay cámara activa ni timeout */}
      {!jumpResult && !isRunning && mode === 'realtime' && timerState !== 'timeout' && (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06]"
          style={{ background: 'rgba(56,189,248,0.05)' }}>
          <Info size={14} className="text-accent mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            {facing === 'environment'
              ? 'Colocate a 2–3 metros del atleta. El atleta debe estar de perfil a la cámara, con el cuerpo completo visible en pantalla.'
              : 'Apoyá el celu verticalmente a 2–3 metros de distancia. Posicionarte de perfil frente a la cámara y asegurate de que tu cuerpo completo sea visible antes de saltar.'
            }
          </p>
        </div>
      )}

      {/*
        Zona de cámara / video
        — Mismo elemento React siempre montado (mientras !jumpResult) para que el ref del
          <video> no se pierda al transicionar entre layout normal y fullscreen.
        — Cuando isRunning=true: position:fixed cubriendo toda la pantalla (z-50).
        — Cuando isRunning=false: aspect-ratio normal en el flujo del documento.
      */}
      {!jumpResult && (
        <div
          className={
            (isRunning || isSwitching)
              ? 'bg-black'
              : 'relative bg-black rounded-2xl overflow-hidden aspect-[4/3]'
          }
          style={(isRunning || isSwitching) ? {
            position: 'fixed',
            inset:    0,
            zIndex:   50,
          } : undefined}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: (mode === 'realtime' && facing === 'user') ? 'scaleX(-1)' : 'none' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            width={640}
            height={480}
            style={{ transform: (mode === 'realtime' && facing === 'user') ? 'scaleX(-1)' : 'none' }}
          />

          {/* Borde pulsante verde durante la ventana de detección */}
          {isRunning && timerState === 'detecting' && (
            <div
              className="absolute inset-0 z-10 pointer-events-none animate-pulse"
              style={{ boxShadow: 'inset 0 0 0 4px #22c55e' }}
            />
          )}

          {/* ── Overlay countdown ─────────────────────────────────────────── */}
          {isRunning && timerState === 'countdown' && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.72)' }}
            >
              <div
                className="text-white font-black mb-3 select-none"
                style={{ fontSize: '7rem', lineHeight: 1 }}
              >
                {countdownNum}
              </div>
              <p className="text-slate-300 text-xl font-semibold tracking-wide">Preparate…</p>
              <button
                onClick={handleStop}
                className="mt-10 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* ── Overlay ¡SALTÁ! ───────────────────────────────────────────── */}
          {isRunning && timerState === 'go' && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)' }}
            >
              <span
                className="font-black select-none"
                style={{ fontSize: '4rem', color: '#22c55e', textShadow: '0 0 30px rgba(34,197,94,0.6)' }}
              >
                ¡SALTÁ!
              </span>
            </div>
          )}

          {/* ── Aviso tobillos no detectados ─────────────────────────────── */}
          {isRunning && mode === 'realtime' && poseReady && ankleVis < 0.1
            && detectionPhase === 'calibrating' && (
            <div
              className="absolute inset-x-4 z-20 flex items-start gap-2 px-4 py-3 rounded-2xl"
              style={{
                top:        '38%',
                background: 'rgba(234,179,8,0.18)',
                border:     '1px solid rgba(234,179,8,0.45)',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#fde047' }}>
                  Tobillos no detectados
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#fef08a' }}>
                  Alejate más o encuadrá el cuerpo completo en pantalla
                </p>
              </div>
            </div>
          )}

          {/* Aviso post-calibración: cuerpo bien encuadrado pero vis baja → countdown en espera */}
          {isRunning && mode === 'realtime' && detectionPhase === 'ready'
            && !timerState && ankleVis < 0.3 && (
            <div
              className="absolute inset-x-4 z-20 flex items-start gap-2 px-4 py-3 rounded-2xl"
              style={{
                top:        '38%',
                background: 'rgba(234,179,8,0.18)',
                border:     '1px solid rgba(234,179,8,0.45)',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
              <div>
                <p className="text-sm font-bold" style={{ color: '#fde047' }}>
                  Ajustá la posición
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#fef08a' }}>
                  El countdown no arranca hasta que los tobillos sean visibles
                </p>
              </div>
            </div>
          )}

          {/* ── Panel debug (solo realtime, mientras cámara activa) ─────── */}
          {isRunning && mode === 'realtime' && (
            <DebugPanel debugRef={debugRef} detectionPhase={detectionPhase} />
          )}

          {/* ── Barra superior ────────────────────────────────────────────── */}
          <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3 gap-2"
            style={{ zIndex: 15 }}>

            {/* Izquierda: indicador cámara activa + botón switch (solo en realtime fullscreen) */}
            {isRunning && mode === 'realtime' && (
              <button
                onClick={handleSwitchCamera}
                title="Cambiar cámara"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                  font-semibold transition-all active:scale-90"
                style={{
                  background: 'rgba(15,23,42,0.8)',
                  color:      '#94a3b8',
                  border:     '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <SwitchCamera size={12} />
                {facing === 'environment' ? 'Trasera' : 'Frontal'}
              </button>
            )}

            {/* Centro-derecha: indicador de cuerpo en cuadro */}
            {isRunning && (
              <div className="ml-auto">
                <FrameStatusBadge status={frameStatus} />
              </div>
            )}

            {/* Botón Maximize2 — solo cuando no corre */}
            {!isRunning && !isSwitching && !mpLoading && !mpError && mode === 'realtime' && timerState !== 'timeout' && (
              <button
                onClick={handleToggle}
                title="Iniciar en pantalla completa"
                className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg
                  bg-black/50 text-slate-300 hover:text-white hover:bg-black/70
                  active:scale-90 transition-all"
              >
                <Maximize2 size={14} />
              </button>
            )}
          </div>

          {/* ── Overlay cuando no está corriendo ───────────────────────── */}
          {!isRunning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
              {isSwitching ? (
                <>
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 text-xs">Cambiando cámara…</p>
                </>
              ) : timerState === 'timeout' ? (
                /* Timeout — sin salto detectado */
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <AlertTriangle size={32} className="text-amber-400" />
                  <p className="text-slate-200 text-sm font-semibold">No se detectó salto</p>
                  <p className="text-slate-400 text-xs">¿Intentás de nuevo?</p>
                  <button
                    onClick={handleRetry}
                    className="mt-1 flex items-center gap-2 px-5 py-2.5 rounded-xl
                      text-sm font-bold active:scale-95 transition-transform"
                    style={{
                      background: 'rgba(56,189,248,0.15)',
                      color:      '#38bdf8',
                      border:     '1px solid rgba(56,189,248,0.35)',
                    }}
                  >
                    <RotateCcw size={14} /> Reintentar
                  </button>
                </div>
              ) : mpLoading ? (
                <>
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 text-xs">Cargando modelo…</p>
                </>
              ) : (
                <p className="text-slate-400 text-sm px-6 text-center">
                  {mode === 'realtime' ? 'Presioná START para iniciar' : 'Subí un video para analizar'}
                </p>
              )}
            </div>
          )}

          {/* ── Panel inferior fullscreen: métricas + botón Detener ────── */}
          {isRunning && (
            <div
              className="absolute bottom-0 left-0 right-0 px-4 pt-10 pb-6"
              style={{
                zIndex:     15,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
              }}
            >
              {poseData && mode === 'realtime' && (
                <div className="mb-3">
                  <LiveMetrics poseData={poseData} />
                </div>
              )}

              {/* Detection / timer phase indicator */}
              {mode === 'realtime' && (
                <div className="flex items-center justify-center mb-3">
                  {timerState === 'detecting' && detectionPhase === 'ready' && (
                    <span
                      className="text-sm font-bold tracking-wide animate-pulse"
                      style={{ color: '#22c55e' }}
                    >
                      ¡Saltá ahora!
                    </span>
                  )}
                  {timerState === 'detecting' && detectionPhase === 'jumping' && (
                    <span
                      className="text-sm font-bold tracking-wide"
                      style={{ color: '#f59e0b' }}
                    >
                      ¡Saltando!
                    </span>
                  )}
                  {(!timerState || timerState === 'countdown' || timerState === 'go') && detectionPhase === 'calibrating' && (
                    <span
                      className="text-sm font-bold tracking-wide"
                      style={{ color: '#94a3b8' }}
                    >
                      Calibrando…
                    </span>
                  )}
                </div>
              )}

              {/* Setup instructions — only during calibration while body not yet fully visible */}
              {mode === 'realtime' && detectionPhase === 'calibrating' && frameStatus !== 'green' && (
                <p className="text-center text-xs text-slate-400 mb-3 leading-relaxed">
                  {facing === 'environment'
                    ? 'Colocate a 2–3 metros del atleta. El atleta debe estar de perfil a la cámara, con el cuerpo completo visible en pantalla.'
                    : 'Apoyá el celu verticalmente a 2–3 metros de distancia. Posicionarte de perfil frente a la cámara y asegurate de que tu cuerpo completo sea visible antes de saltar.'
                  }
                </p>
              )}

              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
                  text-sm font-bold active:scale-[0.98] transition-transform"
                style={{
                  background:  'rgba(239,68,68,0.2)',
                  color:       '#ef4444',
                  border:      '1px solid rgba(239,68,68,0.4)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <Square size={16} fill="currentColor" /> Detener
              </button>
            </div>
          )}

          {/* Barra de progreso modo video */}
          {mode === 'video' && isRunning && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Botón START en el layout normal — oculto cuando la cámara está en fullscreen o en timeout */}
      {!jumpResult && !mpError && !isRunning && mode === 'realtime' && timerState !== 'timeout' && (
        <button
          onClick={handleToggle}
          disabled={mpLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
            text-sm font-bold active:scale-[0.98] transition-transform
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{
            background: 'rgba(56,189,248,0.15)',
            color:      '#38bdf8',
            border:     '1px solid rgba(56,189,248,0.35)',
          }}
        >
          {mpLoading
            ? 'Esperando MediaPipe…'
            : <><Play size={16} fill="currentColor" /> START — Iniciar cámara</>
          }
        </button>
      )}

      {!jumpResult && !mpError && mode === 'video' && (
        <label
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
            text-sm font-bold border border-accent/35 text-accent bg-accent/[0.08]"
          style={{ cursor: mpLoading || isRunning ? 'not-allowed' : 'pointer', opacity: mpLoading ? 0.4 : 1 }}
        >
          <UploadCloud size={16} />
          {mpLoading
            ? 'Esperando MediaPipe…'
            : isRunning
              ? `Analizando… ${progress}%`
              : 'Subir video (.mp4 / .mov / .webm)'
          }
          <input
            type="file"
            accept=".mp4,.mov,.webm,video/*"
            className="hidden"
            disabled={mpLoading || isRunning}
            onChange={handleVideoUpload}
          />
        </label>
      )}

      {/* Resultado post-salto */}
      {jumpResult && (
        <JumpResult
          result={jumpResult}
          massKg={massKg}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
      )}

      {saved && (
        <p className="text-center text-xs text-safe font-semibold">Resultado guardado ✓</p>
      )}

      {/* Fallback manual */}
      {!isRunning && !jumpResult && (
        <ManualFallback jumpType={jumpType} massKg={massKg} onResult={setJumpResult} />
      )}
    </div>
  );
}

// ── Formulario manual (fallback si MediaPipe no carga) ────────────────────────
function ManualFallback({ jumpType, massKg, onResult }) {
  const [tv,   setTv]   = useState('');
  const [open, setOpen] = useState(false);

  function handleCalc() {
    const secs = parseFloat(tv);
    if (isNaN(secs) || secs <= 0) return;
    onResult({
      heightCm:     jumpHeightFromFlightTime(secs) * 100,
      flightMs:     Math.round(secs * 1000),
      type:         jumpType,
      maxKneeAngle: null,
    });
  }

  return (
    <div className="border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-slate-500 hover:text-slate-300 transition-colors w-full text-left"
      >
        {open ? '▲' : '▼'} Ingresar tiempo de vuelo manualmente
      </button>
      {open && (
        <div className="flex gap-3 mt-3">
          <input
            type="number"
            step="0.001"
            placeholder="Tiempo de vuelo (s)"
            value={tv}
            onChange={e => setTv(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCalc()}
            className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2
              text-sm font-data text-slate-100 placeholder:text-slate-600
              focus:outline-none focus:border-accent"
          />
          <button
            onClick={handleCalc}
            className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-semibold"
          >
            Calcular
          </button>
        </div>
      )}
    </div>
  );
}
