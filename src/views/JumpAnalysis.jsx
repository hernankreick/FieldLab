import { useState, useRef, useEffect } from 'react';
import {
  Camera, Video, Play, Square, Save,
  AlertTriangle, CheckCircle, UploadCloud, Maximize2, SwitchCamera, Info,
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

// Verde: cabeza + tobillos con visibilidad ≥ 0.7. Amarillo: alguno < 0.7. Rojo: crítico ausente.
function calcFrameStatus(lm) {
  if (!lm || lm.length < 33) return null;
  const critical   = [0, 27, 28];              // nariz + tobillos
  const secondary  = [11, 12, 23, 24, 25, 26]; // hombros, caderas, rodillas
  if (critical.some(i => (lm[i]?.visibility ?? 0) < 0.5)) return 'red';
  if ([...critical, ...secondary].some(i => (lm[i]?.visibility ?? 0) < 0.7)) return 'yellow';
  return 'green';
}

function FrameStatusBadge({ lm, poseReady }) {
  const status = poseReady ? calcFrameStatus(lm) : null;
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

  const baselineHipRef   = useRef(null);
  const baselineAnkleRef = useRef(null);
  const flightStartRef   = useRef(null);
  const inFlightRef      = useRef(false);
  const maxKneeAngleRef  = useRef(0);

  const {
    videoRef, canvasRef,
    isRunning, landmarks, poseData, poseReady, error,
    progress, mpLoading, mpError,
    startCamera, stopCamera, analyzeVideo,
  } = usePoseEstimation({ mode });

  // Bloquear scroll del body cuando la cámara está en fullscreen (incluso mientras cambia)
  useEffect(() => {
    document.body.style.overflow = (isRunning || isSwitching) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isRunning, isSwitching]);

  // Calibrar baselines de tobillos (primario) y cadera (secundario) en reposo
  useEffect(() => {
    if (!poseData || inFlightRef.current || jumpResult) return;
    if (baselineAnkleRef.current === null) {
      baselineAnkleRef.current = poseData.ankleHeight;
    } else if (poseData.ankleHeight > baselineAnkleRef.current - 0.03) {
      baselineAnkleRef.current = baselineAnkleRef.current * 0.95 + poseData.ankleHeight * 0.05;
    }
    if (baselineHipRef.current === null) {
      baselineHipRef.current = poseData.hipHeight;
    } else if (poseData.hipHeight > baselineHipRef.current - 0.05) {
      baselineHipRef.current = baselineHipRef.current * 0.95 + poseData.hipHeight * 0.05;
    }
  }, [poseData, jumpResult]);

  // Detección automática de vuelo: tobillos como referencia principal, cadera como validación
  useEffect(() => {
    if (mode !== 'realtime' || !poseData || !isRunning || jumpResult) return;
    if (baselineAnkleRef.current === null || baselineHipRef.current === null) return;

    // Tobillos suben (y disminuye) → despegue. Cadera lo valida para evitar falsos positivos.
    const anklesUp   = poseData.ankleHeight < baselineAnkleRef.current - 0.06;
    const hipUp      = poseData.hipHeight   < baselineHipRef.current   - 0.05;
    const isAirborne = anklesUp && hipUp;

    if (isAirborne && !inFlightRef.current) {
      inFlightRef.current     = true;
      flightStartRef.current  = performance.now();
      maxKneeAngleRef.current = Math.max(poseData.kneeAngleLeft, poseData.kneeAngleRight);
    } else if (isAirborne && inFlightRef.current) {
      const kMax = Math.max(poseData.kneeAngleLeft, poseData.kneeAngleRight);
      if (kMax > maxKneeAngleRef.current) maxKneeAngleRef.current = kMax;
    } else if (!isAirborne && inFlightRef.current) {
      inFlightRef.current = false;
      const flightMs = Math.round(performance.now() - flightStartRef.current);
      const heightCm = jumpHeightFromFlightTime(flightMs / 1000) * 100;
      if (heightCm > 5) {
        setJumpResult({ heightCm, flightMs, type: jumpType, maxKneeAngle: maxKneeAngleRef.current });
        stopCamera();
      }
    }
  }, [poseData, mode, isRunning, jumpResult, jumpType, stopCamera]);

  function handleStop() {
    stopCamera();
    baselineHipRef.current   = null;
    baselineAnkleRef.current = null;
    inFlightRef.current      = false;
    flightStartRef.current   = null;
  }

  function handleToggle() {
    if (isRunning) {
      handleStop();
    } else {
      setJumpResult(null);
      setSaved(false);
      baselineHipRef.current   = null;
      baselineAnkleRef.current = null;
      inFlightRef.current      = false;
      startCamera(facing);
    }
  }

  async function handleSwitchCamera() {
    if (isSwitching) return;
    const newFacing = facing === 'environment' ? 'user' : 'environment';
    setFacing(newFacing);
    setIsSwitching(true);
    // Resetear estado de detección — posición de cámara cambia
    baselineHipRef.current   = null;
    baselineAnkleRef.current = null;
    inFlightRef.current      = false;
    flightStartRef.current   = null;
    stopCamera();
    await startCamera(newFacing);
    setIsSwitching(false);
  }

  async function handleVideoUpload(e) {
    const file = e.target.files?.[0];
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
    baselineHipRef.current   = null;
    baselineAnkleRef.current = null;
  }

  function handleModeChange(m) {
    if (isRunning) handleStop();
    setMode(m);
    setJumpResult(null);
    setSaved(false);
    setIsSwitching(false);
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

      {/* Instrucciones de configuración — solo modo realtime cuando no hay cámara activa */}
      {!jumpResult && !isRunning && mode === 'realtime' && (
        <div className="flex items-start gap-3 p-3 rounded-xl border border-white/[0.06]"
          style={{ background: 'rgba(56,189,248,0.05)' }}>
          <Info size={14} className="text-accent mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            Apoyá el celu <span className="text-slate-200 font-semibold">verticalmente</span> a unos 2–3 metros de distancia, a la altura del pecho. Asegurate de que tu cuerpo completo (cabeza y pies) sea visible en la pantalla antes de saltar.
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
            style={{ transform: mode === 'realtime' ? 'scaleX(-1)' : 'none' }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            width={640}
            height={480}
            style={{ transform: mode === 'realtime' ? 'scaleX(-1)' : 'none' }}
          />

          {/* ── Barra superior ────────────────────────────────────────────── */}
          <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3 gap-2">

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
                <FrameStatusBadge lm={landmarks} poseReady={poseReady} />
              </div>
            )}

            {/* Botón Maximize2 — solo cuando no corre */}
            {!isRunning && !isSwitching && !mpLoading && !mpError && mode === 'realtime' && (
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
              {isSwitching
                ? <>
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-xs">Cambiando cámara…</p>
                  </>
                : mpLoading
                  ? <>
                      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      <p className="text-slate-400 text-xs">Cargando modelo…</p>
                    </>
                  : <p className="text-slate-400 text-sm px-6 text-center">
                      {mode === 'realtime' ? 'Presioná START para iniciar' : 'Subí un video para analizar'}
                    </p>
              }
            </div>
          )}

          {/* ── Panel inferior fullscreen: métricas + botón Detener ────── */}
          {isRunning && (
            <div
              className="absolute bottom-0 left-0 right-0 px-4 pt-10 pb-6"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
              }}
            >
              {poseData && mode === 'realtime' && (
                <div className="mb-3">
                  <LiveMetrics poseData={poseData} />
                </div>
              )}

              {!poseReady && (
                <p className="text-center text-xs text-slate-400 mb-3">
                  Asegurate que todo tu cuerpo sea visible (cabeza y pies)
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

      {/* Botón START en el layout normal — oculto cuando la cámara está en fullscreen */}
      {!jumpResult && !mpError && !isRunning && mode === 'realtime' && (
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
