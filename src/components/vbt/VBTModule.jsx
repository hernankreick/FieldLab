import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Play, Square, RotateCcw, CameraOff,
  AlertTriangle, Activity, Zap, TrendingDown, CheckCircle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useArUcoTracker, MAX_REPS } from '../../hooks/useArUcoTracker';
import { calcPower, calcFatigueIndex, classifyLoad } from '../../utils/vbtCalculations';

const EXERCISES    = ['Sentadilla', 'Press Banca', 'Peso Muerto', 'Arranque'];
const BAR_LENGTH_M = 2.2;

const CAMERA_ERRORS = {
  PERMISSION_DENIED: 'Permiso de cámara denegado. Ir a Ajustes > Safari > Cámara y permitir acceso.',
  NO_CAMERA:         'No se detectó cámara en este dispositivo.',
  ERROR:             'Error al abrir cámara. Intentá recargar la página.',
};

function zoneColors(mpv) {
  if (mpv > 1.00) return { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e' };
  if (mpv >= 0.75) return { bg: 'rgba(234,179,8,0.15)', text: '#eab308' };
  return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' };
}

const TOOLTIP_STYLE = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '0.75rem',
};

export default function VBTModule() {
  const [athleteName, setAthleteName] = useState('');
  const [exercise,    setExercise]    = useState(EXERCISES[0]);
  const [loadKg,      setLoadKg]      = useState('');
  const [countdown,   setCountdown]   = useState(null); // null | 3 | 2 | 1 | 0

  const audioCtxRef        = useRef(null);
  const countdownActiveRef = useRef(false);

  const {
    videoRef, canvasRef, isTracking, sessionComplete, cameraError,
    repData, startTracking, stopTracking, resetSession,
    setCalibration, captureFrame, calibrationPxPerMeter,
  } = useArUcoTracker();

  // Calibration state
  const [calibMode,   setCalibMode]   = useState(false);
  const [calibFrame,  setCalibFrame]  = useState(null);   // { dataUrl, width, height }
  const [calibPoints, setCalibPoints] = useState([]);     // [{ xPct, yPct }, ...]
  const calibImgRef = useRef(null);

  const load       = parseFloat(loadKg) || 0;
  const repLoadRef = useRef({});

  useEffect(() => {
    if (repData.length === 0) { repLoadRef.current = {}; return; }
    const last = repData[repData.length - 1];
    if (!(last.rep in repLoadRef.current)) repLoadRef.current[last.rep] = load;
  }, [repData.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const repVelocities = useMemo(() => repData.map(r => r.mpv), [repData]);
  const lastRep       = repData[repData.length - 1];
  const currentMPV    = lastRep?.mpv         ?? 0;
  const currentPeak   = lastRep?.peakVelocity ?? 0;
  const currentPower  = calcPower(currentMPV, load);
  const currentZone   = classifyLoad(currentMPV);
  const fatigueIndex  = repData.length >= 3 ? calcFatigueIndex(repVelocities) : null;
  const firstMPV      = repData[0]?.mpv ?? 0;
  const colors        = zoneColors(currentMPV);

  const chartData = repData.map(r => ({ rep: r.rep, mpv: +r.mpv.toFixed(3) }));
  const dropLine  = firstMPV > 0 ? +(firstMPV * 0.8).toFixed(3) : null;

  const fatigueStatus =
    fatigueIndex === null ? null
    : fatigueIndex > 20   ? 'danger'
    : fatigueIndex > 10   ? 'warning'
    : 'ok';

  const avgMPV = repData.length > 0
    ? repData.reduce((s, r) => s + r.mpv, 0) / repData.length
    : 0;

  // Cancel countdown and close AudioContext on unmount to avoid setState on dead component
  useEffect(() => {
    return () => {
      countdownActiveRef.current = false;
      audioCtxRef.current?.close();
    };
  }, []);

  // ── Audio helpers ──────────────────────────────────────────────────────────
  function playBeep(freq, duration) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  // ── Session complete: double beep ──────────────────────────────────────────
  useEffect(() => {
    if (!sessionComplete || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    for (let i = 0; i < 2; i++) {
      const t    = ctx.currentTime + i * 0.45;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 600;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  }, [sessionComplete]);

  // ── Countdown + start ─────────────────────────────────────────────────────
  async function handleStart() {
    if (isTracking || countdown !== null) return;

    // AudioContext must be created inside a user gesture (iOS requirement)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    countdownActiveRef.current = true;
    const wait = ms => new Promise(r => setTimeout(r, ms));

    setCountdown(3); playBeep(800, 0.15);
    await wait(1000); if (!countdownActiveRef.current) return;
    setCountdown(2); playBeep(800, 0.15);
    await wait(1000); if (!countdownActiveRef.current) return;
    setCountdown(1); playBeep(800, 0.15);
    await wait(1000); if (!countdownActiveRef.current) return;
    setCountdown(0); playBeep(1200, 0.4);   // ¡YA!
    await wait(600);  if (!countdownActiveRef.current) return;
    setCountdown(null);
    await startTracking();
  }

  // ── Calibration handlers ───────────────────────────────────────────────────
  function handleCalibrate() {
    const frame = captureFrame();
    if (!frame) return;
    setCalibFrame(frame);
    setCalibPoints([]);
    setCalibMode(true);
  }

  function handleCalibTap(e) {
    e.preventDefault();
    const img = calibImgRef.current;
    if (!img || !calibFrame) return;
    const rect = img.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    const xPct = (clientX - rect.left)  / rect.width;
    const yPct = (clientY - rect.top)   / rect.height;
    const next = [...calibPoints, { xPct, yPct }];
    setCalibPoints(next);

    if (next.length >= 2) {
      const dx = (next[1].xPct - next[0].xPct) * calibFrame.width;
      const dy = (next[1].yPct - next[0].yPct) * calibFrame.height;
      setCalibration(Math.hypot(dx, dy) / BAR_LENGTH_M);
      setCalibMode(false);
      setCalibPoints([]);
    }
  }

  function handleReset() {
    countdownActiveRef.current = false;
    setCountdown(null);
    resetSession();
    setCalibMode(false);
    setCalibPoints([]);
  }

  const isFullscreen = isTracking || countdown !== null;

  return (
    <div className="space-y-4">

      {/* ── Video — always in DOM, fullscreen during tracking/countdown ── */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        style={{
          display:   isFullscreen ? 'block' : 'none',
          position:  'fixed',
          top:       0,
          left:      0,
          width:     '100vw',
          height:    '100vh',
          objectFit: 'cover',
          zIndex:    10,
        }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Countdown overlay ── */}
      {countdown !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          className="bg-black/50"
        >
          <span
            className="font-bold text-white select-none drop-shadow-2xl"
            style={{
              fontSize:    countdown === 0 ? '5rem' : '14rem',
              lineHeight:  1,
              textShadow:  '0 4px 40px rgba(0,0,0,0.9)',
              letterSpacing: countdown === 0 ? '0.02em' : '-0.04em',
            }}
          >
            {countdown === 0 ? '¡YA!' : countdown}
          </span>
        </div>
      )}

      {/* ── Live tracking overlay ── */}
      {isTracking && (
        <>
          {/* MPV — top left */}
          <div
            style={{ position: 'fixed', top: 24, left: 20, zIndex: 20 }}
            className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-3"
          >
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">MPV</p>
            <div className="flex items-end gap-1.5 leading-none">
              <span
                className="text-5xl font-bold font-data"
                style={{ color: currentMPV > 0 ? colors.text : '#94a3b8' }}
              >
                {currentMPV.toFixed(2)}
              </span>
              <span className="text-lg text-white/40 pb-0.5">m/s</span>
            </div>
            <p className="text-xs text-white/30 font-data mt-1">
              V.Pico {currentPeak.toFixed(2)} · {Math.round(currentPower)} W
            </p>
          </div>

          {/* Rep counter — top right */}
          <div
            style={{ position: 'fixed', top: 24, right: 20, zIndex: 20 }}
            className="bg-black/60 backdrop-blur-sm rounded-2xl px-4 py-3 text-right"
          >
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">REP</p>
            <span className="text-4xl font-bold font-data text-white leading-none">
              {repData.length}/{MAX_REPS}
            </span>
          </div>

          {/* Zone — bottom center */}
          <div
            style={{
              position:  'fixed',
              bottom:    110,
              left:      '50%',
              transform: 'translateX(-50%)',
              zIndex:    20,
              whiteSpace: 'nowrap',
            }}
            className="bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-2.5"
          >
            <span
              className="text-base font-bold uppercase tracking-widest"
              style={{ color: currentMPV > 0 ? colors.text : '#64748b' }}
            >
              {currentZone}
            </span>
          </div>

          {/* Calibrate — bottom left */}
          <button
            type="button"
            onClick={handleCalibrate}
            style={{ position: 'fixed', bottom: 44, left: 20, zIndex: 30, touchAction: 'manipulation' }}
            className="px-4 py-3 bg-black/60 backdrop-blur-sm rounded-xl text-sm text-white/60 active:bg-black/80"
          >
            Calibrar
          </button>

          {/* Stop button — bottom right */}
          <button
            type="button"
            onClick={stopTracking}
            style={{ position: 'fixed', bottom: 40, right: 20, zIndex: 30, touchAction: 'manipulation' }}
            className="flex items-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-500 active:bg-red-700 rounded-2xl text-white font-bold text-lg shadow-2xl"
          >
            <Square size={20} /> Detener
          </button>
        </>
      )}

      {/* ── Session complete screen ── */}
      {sessionComplete && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={22} className="text-success shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">Serie completada</h2>
              <p className="text-sm text-slate-400">
                {athleteName || '—'} · {exercise} · {load > 0 ? `${load} kg` : '— kg'}
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">MPV Promedio</p>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-data font-bold text-slate-100">
                  {avgMPV.toFixed(3)}
                </span>
                <span className="text-sm text-slate-500 mb-0.5">m/s</span>
              </div>
            </div>
            <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Fatigue Index</p>
              {fatigueIndex !== null ? (
                <div className="flex items-end gap-1">
                  <span className={`text-3xl font-data font-bold ${
                    fatigueStatus === 'danger'  ? 'text-danger'
                    : fatigueStatus === 'warning' ? 'text-warning'
                    : 'text-slate-100'
                  }`}>
                    {fatigueIndex.toFixed(1)}
                  </span>
                  <span className="text-sm text-slate-500 mb-0.5">%</span>
                </div>
              ) : (
                <span className="text-2xl font-data font-bold text-slate-600">—</span>
              )}
            </div>
          </div>

          {/* Results table */}
          <div className="bg-surface rounded-fieldlab border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <TrendingDown size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-200">Resultados de la serie</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                    <th className="text-left  px-4 py-2.5">Rep</th>
                    <th className="text-right px-4 py-2.5">MPV (m/s)</th>
                    <th className="text-right px-4 py-2.5">V.Pico (m/s)</th>
                    <th className="text-right px-4 py-2.5">Potencia (W)</th>
                    <th className="text-right px-4 py-2.5">Zona</th>
                  </tr>
                </thead>
                <tbody>
                  {repData.map(r => {
                    const pw   = calcPower(r.mpv, repLoadRef.current[r.rep] ?? load);
                    const zone = classifyLoad(r.mpv);
                    const cl   = zoneColors(r.mpv);
                    return (
                      <tr key={r.rep} className="border-t border-white/5">
                        <td className="px-4 py-2.5 font-data text-slate-400">{r.rep}</td>
                        <td className="px-4 py-2.5 font-data font-bold text-right text-slate-100">
                          {r.mpv.toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 font-data text-right text-slate-300">
                          {r.peakVelocity.toFixed(3)}
                        </td>
                        <td className="px-4 py-2.5 font-data text-right text-slate-300">
                          {Math.round(pw)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded"
                            style={{ background: cl.bg, color: cl.text }}
                          >
                            {zone}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{ touchAction: 'manipulation' }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-accent text-background rounded-fieldlab font-semibold text-sm"
          >
            <RotateCcw size={15} /> Nueva Serie
          </button>
        </div>
      )}

      {/* ── Normal view — config + live history ── */}
      {!isTracking && !sessionComplete && (
        <>
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold text-slate-100">VBT · Color Tracking</h2>
            <p className="text-sm text-slate-400">Velocity Based Training — detección por color en tiempo real</p>
          </div>

          {/* Session config panel */}
          <div className="bg-surface rounded-fieldlab border border-white/5 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configuración de sesión</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Atleta</label>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={athleteName}
                  onChange={e => setAthleteName(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  style={{ touchAction: 'manipulation' }}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Carga (kg)</label>
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  inputMode="decimal"
                  value={loadKg}
                  onChange={e => setLoadKg(e.target.value)}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm font-data text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-2 block">Ejercicio</label>
              <div className="flex gap-2 flex-wrap">
                {EXERCISES.map(ex => (
                  <button
                    key={ex}
                    type="button"
                    onClick={e => { e.stopPropagation(); setExercise(ex); }}
                    style={{ touchAction: 'manipulation' }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      exercise === ex
                        ? 'bg-accent text-background'
                        : 'bg-background border border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Calibration row */}
            <div className="flex items-center justify-between py-1 border-t border-white/5">
              <div>
                <p className="text-xs text-slate-400">Calibración</p>
                <p className="text-xs text-slate-600 font-data mt-0.5">
                  {Math.round(calibrationPxPerMeter)} px/m
                  {calibrationPxPerMeter === 200 && <span className="ml-1 text-slate-700">(default)</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCalibrate}
                disabled
                title="Iniciá el tracking para calibrar"
                style={{ touchAction: 'manipulation' }}
                className="px-3 py-1.5 bg-background border border-white/10 rounded-lg text-xs text-slate-400 disabled:opacity-30 transition-colors"
              >
                Calibrar
              </button>
            </div>

            {/* Camera status + controls */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-xs">
                {cameraError ? (
                  <span className="flex items-center gap-1.5 text-danger">
                    <AlertTriangle size={13} /> Sin acceso a cámara
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <CameraOff size={13} /> Sin señal
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={countdown !== null}
                  style={{ touchAction: 'manipulation' }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-background hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  <Play size={14} /> Iniciar
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  title="Resetear sesión"
                  style={{ touchAction: 'manipulation' }}
                  className="px-3 py-2 bg-background border border-white/10 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            {/* Camera error banner */}
            {cameraError && (
              <div className="flex items-start gap-2 p-2.5 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>{CAMERA_ERRORS[cameraError] ?? 'Error de cámara desconocido.'}</span>
              </div>
            )}
          </div>

          {/* Instruction hint */}
          <p className="text-xs text-slate-600 text-center -mt-1">
            Pegá cinta naranja/roja en el extremo de la barra · {MAX_REPS} reps por serie
          </p>

          {/* ── Live metrics + history (after reps recorded) ── */}
          {repData.length > 0 && (
            <>
              {/* Metrics grid */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="col-span-2 rounded-fieldlab border border-white/5 p-4"
                  style={{ background: currentMPV > 0 ? colors.bg : '#1e293b' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Zap size={12} /> MPV última rep
                    </span>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full border"
                      style={{
                        background:  currentMPV > 0 ? colors.bg  : 'rgba(255,255,255,0.04)',
                        color:       currentMPV > 0 ? colors.text : '#475569',
                        borderColor: currentMPV > 0 ? colors.text + '40' : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {currentZone}
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span
                      className="text-5xl font-data font-bold leading-none"
                      style={{ color: currentMPV > 0 ? colors.text : '#475569' }}
                    >
                      {currentMPV.toFixed(2)}
                    </span>
                    <span className="text-xl text-slate-500 mb-1">m/s</span>
                  </div>
                </div>

                <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">V. Pico</span>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-data font-bold text-slate-100">{currentPeak.toFixed(2)}</span>
                    <span className="text-sm text-slate-500 mb-0.5">m/s</span>
                  </div>
                </div>

                <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Potencia</span>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-data font-bold text-slate-100">{Math.round(currentPower)}</span>
                    <span className="text-sm text-slate-500 mb-0.5">W</span>
                  </div>
                </div>

                <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Reps</span>
                  <span className="text-2xl font-data font-bold text-accent">{repData.length}/{MAX_REPS}</span>
                </div>

                <div className={`rounded-fieldlab border p-4 transition-colors ${
                  fatigueStatus === 'danger'  ? 'bg-danger/10 border-danger/30'
                  : fatigueStatus === 'warning' ? 'bg-warning/10 border-warning/30'
                  : 'bg-surface border-white/5'
                }`}>
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Fatiga</span>
                  {fatigueIndex !== null ? (
                    <>
                      <div className="flex items-end gap-1">
                        <span className={`text-2xl font-data font-bold ${
                          fatigueStatus === 'danger'  ? 'text-danger'
                          : fatigueStatus === 'warning' ? 'text-warning'
                          : 'text-slate-100'
                        }`}>
                          {fatigueIndex.toFixed(1)}
                        </span>
                        <span className="text-sm text-slate-500 mb-0.5">%</span>
                      </div>
                      {fatigueStatus === 'danger' && (
                        <p className="text-xs font-bold text-danger mt-1">DETENER SERIE</p>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-600">desde rep 3</span>
                  )}
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={14} className="text-accent" />
                    <span className="text-sm font-medium text-slate-200">MPV por repetición</span>
                    {firstMPV > 0 && (
                      <span className="ml-auto text-xs text-slate-600 font-data">
                        ref {firstMPV.toFixed(2)} m/s
                      </span>
                    )}
                  </div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <XAxis
                        dataKey="rep"
                        tickFormatter={v => `R${v}`}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        labelFormatter={v => `Rep ${v}`}
                        formatter={v => [`${v} m/s`, 'MPV']}
                        labelStyle={{ color: '#f8fafc' }}
                        itemStyle={{ color: '#38bdf8' }}
                      />
                      {firstMPV > 0 && (
                        <ReferenceLine
                          y={firstMPV}
                          stroke="rgba(56,189,248,0.35)"
                          strokeDasharray="5 4"
                          label={{ value: 'Rep 1', fill: '#64748b', fontSize: 10, position: 'insideTopLeft' }}
                        />
                      )}
                      {dropLine && (
                        <>
                          <ReferenceArea y1={0} y2={dropLine} fill="rgba(239,68,68,0.07)" />
                          <ReferenceLine
                            y={dropLine}
                            stroke="rgba(239,68,68,0.55)"
                            strokeDasharray="5 4"
                            label={{ value: '-20%', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }}
                          />
                        </>
                      )}
                      <Line
                        type="monotone"
                        dataKey="mpv"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={{ fill: '#38bdf8', r: 4 }}
                        activeDot={{ r: 6, fill: '#7dd3fc' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* History table */}
              <div className="bg-surface rounded-fieldlab border border-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <TrendingDown size={14} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-200">Histórico de serie</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {athleteName || '—'} · {exercise} · {load || '—'} kg
                  </span>
                </div>

                {fatigueStatus === 'danger' && (
                  <div className="mx-4 mt-3 flex items-center gap-2 p-2.5 bg-danger/10 border border-danger/30 rounded-lg">
                    <AlertTriangle size={14} className="text-danger flex-shrink-0" />
                    <span className="text-xs font-bold text-danger">
                      DETENER SERIE — caída de velocidad superior al 20%
                    </span>
                  </div>
                )}
                {fatigueStatus === 'warning' && (
                  <div className="mx-4 mt-3 flex items-center gap-2 p-2.5 bg-warning/10 border border-warning/30 rounded-lg">
                    <AlertTriangle size={14} className="text-warning flex-shrink-0" />
                    <span className="text-xs text-warning">
                      Fatiga elevada ({fatigueIndex?.toFixed(1)}%) — monitorear velocidad
                    </span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                        <th className="text-left  px-4 py-2.5">Rep</th>
                        <th className="text-right px-4 py-2.5">MPV (m/s)</th>
                        <th className="text-right px-4 py-2.5">V.Pico (m/s)</th>
                        <th className="text-right px-4 py-2.5">Potencia (W)</th>
                        <th className="text-right px-4 py-2.5">Zona</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repData.map((r, i) => {
                        const isLast = i === repData.length - 1;
                        const pw     = calcPower(r.mpv, repLoadRef.current[r.rep] ?? load);
                        const zone   = classifyLoad(r.mpv);
                        const cl     = zoneColors(r.mpv);
                        return (
                          <tr
                            key={r.rep}
                            className={`border-t border-white/5 transition-colors ${
                              isLast ? 'bg-accent/5' : 'hover:bg-white/[0.02]'
                            }`}
                          >
                            <td className="px-4 py-2.5 font-data text-slate-400">
                              {r.rep}
                              {isLast && <span className="ml-1.5 text-accent text-xs">←</span>}
                            </td>
                            <td className="px-4 py-2.5 font-data font-bold text-right text-slate-100">
                              {r.mpv.toFixed(3)}
                            </td>
                            <td className="px-4 py-2.5 font-data text-right text-slate-300">
                              {r.peakVelocity.toFixed(3)}
                            </td>
                            <td className="px-4 py-2.5 font-data text-right text-slate-300">
                              {Math.round(pw)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span
                                className="text-xs font-medium px-1.5 py-0.5 rounded"
                                style={{ background: cl.bg, color: cl.text }}
                              >
                                {zone}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Calibration overlay ── */}
      {calibMode && calibFrame && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-4 p-4">
          <p className="text-sm font-semibold text-slate-200">
            {calibPoints.length === 0
              ? 'Tocá el primer extremo de la barra (2.2 m)'
              : 'Tocá el otro extremo de la barra'}
          </p>
          <p className="text-xs text-slate-500 -mt-2">La distancia entre los dos puntos = 2.2 m</p>

          <div
            className="relative select-none"
            onPointerDown={handleCalibTap}
            style={{ touchAction: 'none', cursor: 'crosshair' }}
          >
            <img
              ref={calibImgRef}
              src={calibFrame.dataUrl}
              alt="Calibración"
              draggable={false}
              className="max-w-full max-h-[60vh] rounded-lg block"
            />
            {calibPoints.map((p, i) => (
              <div
                key={i}
                className="absolute w-5 h-5 rounded-full border-2 border-white bg-accent/80 pointer-events-none"
                style={{
                  left:      `${p.xPct * 100}%`,
                  top:       `${p.yPct * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
            {calibPoints.length === 2 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <line
                  x1={`${calibPoints[0].xPct * 100}%`}
                  y1={`${calibPoints[0].yPct * 100}%`}
                  x2={`${calibPoints[1].xPct * 100}%`}
                  y2={`${calibPoints[1].yPct * 100}%`}
                  stroke="#38bdf8"
                  strokeWidth="0.5"
                  strokeDasharray="3 2"
                />
              </svg>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setCalibMode(false); setCalibPoints([]); }}
            style={{ touchAction: 'manipulation' }}
            className="px-5 py-2 bg-background border border-white/10 rounded-lg text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
