import { useState, useRef, useCallback, useEffect } from 'react';
import { X, ChevronRight, RotateCcw, Check, Camera, Target } from 'lucide-react';
import { usePoseDetection } from '../hooks/usePoseDetection';
import {
  calcCentroid,
  didCrossLine,
  calcMovementDirection,
  pushHistory,
  isDebounced,
  calcVideoRegionCover,
  normToCanvas,
  canvasToNorm,
} from '../utils/visionUtils';
import { cn } from '../utils/cn';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_LABEL = {
  sprint10:         'Sprint 10m',
  sprint20:         'Sprint 20m',
  sprint30:         'Sprint 30m',
  'sprint10-20-30': 'Sprint 10/20/30m',
  'cod5+5':         'COD 5+5',
  proAgility:       'Pro Agility 5+10+5',
};

const COD_TYPES = new Set(['cod5+5', 'proAgility']);

// ─── SprintVisionModule ───────────────────────────────────────────────────────
//
// Props:
//   testType: 'sprint10' | 'sprint30' | 'sprint10-20-30' | 'cod5+5' | 'proAgility'
//   onResult: (timeSeconds: number) => void  — writes to the existing input field
//   onClose:  () => void                     — closes camera view

export default function SprintVisionModule({ testType, onResult, onClose }) {
  const isCOD = COD_TYPES.has(testType);

  // ── React state (triggers re-renders) ──────────────────────────────────────
  const [phase, setPhaseState] = useState('permission');
  // permission | calib-1 | calib-2 | calib-3 | armed | measuring | result

  const [resultTime, setResultTime] = useState(null);
  const [orientation, setOrientation] = useState({ beta: null, gamma: null });
  const [testRunCountdown, setTestRunCountdown] = useState(null); // null | 3 | 2 | 1
  const [testRunDone, setTestRunDone] = useState(false);
  const [codTurnMade, setCodTurnMade] = useState(false);
  // true when screen.orientation.lock failed and device is in portrait — CSS rotation applied
  const [isPortraitFallback, setIsPortraitFallback] = useState(false);

  // ── Mutable refs (read inside RAF loops and stable callbacks) ──────────────
  const phaseRef = useRef('permission');
  const isPortraitFallbackRef = useRef(false);
  const leftLineRef = useRef(0.2);   // normalized X within video frame
  const rightLineRef = useRef(0.8);  // normalized X within video frame
  const centroidRef = useRef(null);  // { x, y, confidence } | null
  const prevCentroidXRef = useRef(null);
  const centroidHistoryRef = useRef([]);
  const timerStartRef = useRef(null);      // performance.now() at start crossing
  const lastCrossingRef = useRef(null);    // performance.now() of last detected crossing
  const codTurnMadeRef = useRef(false);
  const orientationRef = useRef({ beta: null, gamma: null });
  const videoRegionRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Canvas and dragging
  const canvasRef = useRef(null);
  const draggingRef = useRef(null); // 'left' | 'right' | null

  // Countdown interval for test run
  const countdownRef = useRef(null);

  // ── Phase transition ───────────────────────────────────────────────────────
  function setPhase(p) {
    phaseRef.current = p;
    setPhaseState(p);
  }

  // ── Reset detection state for a fresh measurement ─────────────────────────
  function resetDetectionState() {
    prevCentroidXRef.current = null;
    centroidHistoryRef.current = [];
    lastCrossingRef.current = null;
    timerStartRef.current = null;
    codTurnMadeRef.current = false;
    setCodTurnMade(false);
    setResultTime(null);
  }

  // ── MediaPipe landmarks callback — runs every frame ────────────────────────
  const onLandmarks = useCallback((landmarks) => {
    const centroid = landmarks ? calcCentroid(landmarks) : null;
    centroidRef.current = centroid;

    if (!centroid) {
      prevCentroidXRef.current = null;
      return;
    }

    const prevX = prevCentroidXRef.current;
    const currX = centroid.x;
    const now = performance.now();
    const phase = phaseRef.current;

    // Maintain centroid history for direction detection
    pushHistory(centroidHistoryRef.current, currX);

    if (phase === 'armed') {
      // Start trigger: centroid crosses LEFT line going left-to-right
      if (!isDebounced(lastCrossingRef.current, now)) {
        if (didCrossLine(prevX, currX, leftLineRef.current, 'ltr')) {
          timerStartRef.current = now;
          lastCrossingRef.current = now;
          codTurnMadeRef.current = false;
          setCodTurnMade(false);
          setPhase('measuring');
        }
      }

    } else if (phase === 'measuring') {
      if (isCOD) {
        if (!codTurnMadeRef.current) {
          // Waiting for athlete to reach the TURN line (right line, going ltr)
          if (didCrossLine(prevX, currX, rightLineRef.current, 'ltr')) {
            codTurnMadeRef.current = true;
            lastCrossingRef.current = now;
            setCodTurnMade(true);
          }
        } else {
          // Turn confirmed — now waiting for return crossing of LEFT line (rtl)
          if (!isDebounced(lastCrossingRef.current, now)) {
            // Verify direction: centroid must be moving left (rtl)
            const dx = calcMovementDirection(centroidHistoryRef.current);
            if (dx < 0 && didCrossLine(prevX, currX, leftLineRef.current, 'rtl')) {
              const elapsed = (now - timerStartRef.current) / 1000;
              lastCrossingRef.current = now;
              setResultTime(elapsed);
              setPhase('result');
            }
          }
        }
      } else {
        // Sprint: stop timer when centroid crosses RIGHT line going ltr
        if (!isDebounced(lastCrossingRef.current, now)) {
          if (didCrossLine(prevX, currX, rightLineRef.current, 'ltr')) {
            const elapsed = (now - timerStartRef.current) / 1000;
            lastCrossingRef.current = now;
            setResultTime(elapsed);
            setPhase('result');
          }
        }
      }
    }

    prevCentroidXRef.current = currX;
  }, [isCOD]);

  const { videoRef, isRunning, mpLoading, mpError, cameraError, startCamera, stopCamera } = usePoseDetection({ onLandmarks });

  // Transition to calib-1 only once the camera stream is actually running.
  // This prevents advancing the wizard on permission-denied or early-click errors.
  useEffect(() => {
    if (isRunning && phaseRef.current === 'permission') {
      setPhase('calib-1');
    }
  }, [isRunning]);

  // Keep ref in sync so RAF/callback closures can read current value without stale state
  useEffect(() => { isPortraitFallbackRef.current = isPortraitFallback; }, [isPortraitFallback]);

  // ── Orientation lock — lock to landscape; fallback to CSS rotation on older iOS ──
  useEffect(() => {
    function applyPortraitFallbackIfNeeded() {
      if (window.innerHeight > window.innerWidth) {
        setIsPortraitFallback(true);
      }
    }

    if (screen.orientation?.lock) {
      screen.orientation.lock('landscape').catch(() => {
        // Lock not allowed (e.g. desktop browser, older iOS) — apply CSS rotation
        applyPortraitFallbackIfNeeded();
      });
    } else {
      applyPortraitFallbackIfNeeded();
    }

    return () => {
      screen.orientation?.unlock?.();
    };
  }, []);

  // ── ResizeObserver — keep canvas backing store sized to the video element ──
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ro = new ResizeObserver(() => {
      const w = video.offsetWidth;
      const h = video.offsetHeight;
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width  = w;
        canvas.height = h;
      }
    });
    ro.observe(video);
    return () => ro.disconnect();
  }, []); // videoRef and canvasRef are stable for the component lifetime

  // ── Canvas draw loop — runs at max fps independently of MediaPipe ──────────
  const drawOverlay = useCallback((ctx, W, H, ts) => {
    const phase = phaseRef.current;
    const region = videoRegionRef.current;
    const centroid = centroidRef.current;
    const leftNorm = leftLineRef.current;
    const rightNorm = rightLineRef.current;

    // Pixel positions of the lines within canvas
    const leftPx = region.x + leftNorm * region.w;
    const rightPx = region.x + rightNorm * region.w;

    // ── Calib-1: grid overlay ────────────────────────────────────────────────
    if (phase === 'calib-1') {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(region.x + (i / 6) * region.w, region.y);
        ctx.lineTo(region.x + (i / 6) * region.w, region.y + region.h);
        ctx.stroke();
      }
      for (let j = 1; j < 8; j++) {
        ctx.beginPath();
        ctx.moveTo(region.x, region.y + (j / 8) * region.h);
        ctx.lineTo(region.x + region.w, region.y + (j / 8) * region.h);
        ctx.stroke();
      }
    }

    // ── Calib-2: spirit level ────────────────────────────────────────────────
    if (phase === 'calib-2') {
      const { beta, gamma } = orientationRef.current;
      if (beta !== null) {
        const betaOk = beta > 80 && beta < 100;
        const gammaOk = Math.abs(gamma ?? 0) < 5;
        const ok = betaOk && gammaOk;

        const cx = W / 2;
        const cy = region.y + region.h * 0.45;
        const radius = 52;

        // Outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = ok ? '#22c55e' : '#22d3ee';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Crosshair
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx - radius, cy); ctx.lineTo(cx + radius, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - radius); ctx.lineTo(cx, cy + radius); ctx.stroke();

        // Inner target zone (±5° tolerance)
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Bubble — maps beta (phone tilt fwd/back) and gamma (left/right tilt)
        const bx = cx + Math.max(-(radius - 10), Math.min(radius - 10, ((gamma ?? 0) / 12) * (radius - 10)));
        const by = cy + Math.max(-(radius - 10), Math.min(radius - 10, ((beta - 90) / 12) * (radius - 10)));
        ctx.beginPath();
        ctx.arc(bx, by, 11, 0, Math.PI * 2);
        ctx.fillStyle = ok ? '#22c55e' : '#ef4444';
        ctx.fill();

        // Status text
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        if (ok) {
          ctx.fillStyle = '#22c55e';
          ctx.fillText('✓  Ángulo correcto', cx, cy + radius + 22);
        } else {
          ctx.fillStyle = '#f59e0b';
          ctx.fillText(
            `Inclinación: ${Math.round(beta - 90)}° / ${Math.round(gamma ?? 0)}°`,
            cx, cy + radius + 22
          );
        }
      }
    }

    // ── Lines (all phases except permission) ─────────────────────────────────
    if (phase !== 'permission') {
      const isMeasuring = phase === 'measuring';
      const isArmed = phase === 'armed';
      const pulse = isArmed ? 0.65 + 0.35 * Math.sin(ts * 0.004) : 1;

      const lineColorLeft  = isMeasuring ? `rgba(34,197,94,1)` : `rgba(34,211,238,${pulse})`;
      const lineColorRight = (isMeasuring && !isCOD) ? `rgba(34,197,94,1)` : `rgba(34,211,238,${pulse})`;
      const labelBg        = 'rgba(0,0,0,0.55)';

      // Helper: draw one vertical line with label
      function drawLine(pixelX, color, labelText, showHandle) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(pixelX, region.y);
        ctx.lineTo(pixelX, region.y + region.h);
        ctx.stroke();

        // Label badge at top
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        const labelW = ctx.measureText(labelText).width + 14;
        ctx.fillStyle = labelBg;
        ctx.fillRect(pixelX - labelW / 2, region.y + 6, labelW, 20);
        ctx.fillStyle = color;
        ctx.fillText(labelText, pixelX, region.y + 20);

        // Drag handle (calib steps only)
        if (showHandle) {
          const hy = region.y + region.h / 2;
          ctx.beginPath();
          ctx.arc(pixelX, hy, 18, 0, Math.PI * 2);
          ctx.fillStyle = color.replace('1)', '0.25)').replace(/rgba\((\d+,\d+,\d+),1\)/, 'rgba($1,0.25)');
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
          // Arrow hint
          ctx.fillStyle = color;
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('↔', pixelX, hy + 5);
        }
      }

      const showHandles = ['calib-1', 'calib-2'].includes(phase);
      drawLine(leftPx, lineColorLeft,  'INICIO',                 showHandles);
      drawLine(rightPx, lineColorRight, isCOD ? 'GIRO' : 'FIN', showHandles);
    }

    // ── Centroid dot (calib-3, armed, measuring) ──────────────────────────────
    if (['calib-3', 'armed', 'measuring'].includes(phase) && centroid) {
      const { x: px, y: py } = normToCanvas(centroid.x, centroid.y, region);
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,191,36,0.85)';
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Vertical guide line from dot to bottom of video
      ctx.strokeStyle = 'rgba(251,191,36,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, py + 13);
      ctx.lineTo(px, region.y + region.h);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Timer counter while measuring ─────────────────────────────────────────
    if (phase === 'measuring' && timerStartRef.current !== null) {
      const elapsed = (performance.now() - timerStartRef.current) / 1000;
      const text = elapsed.toFixed(2) + 's';
      const cx = W / 2;
      const ty = region.y + 60;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(cx - 72, ty - 28, 144, 44);
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 34px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, ty - 6);
      ctx.textBaseline = 'alphabetic';
    }

    // ── Armed pulsing overlay ─────────────────────────────────────────────────
    if (phase === 'armed') {
      const pulse = 0.5 + 0.5 * Math.sin(ts * 0.003);
      ctx.fillStyle = `rgba(34,211,238,${0.06 * pulse})`;
      ctx.fillRect(region.x, region.y, region.w, region.h);
    }
  }, [isCOD]);

  useEffect(() => {
    let animFrame;

    function loop(ts) {
      animFrame = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      const video  = videoRef.current;
      if (!canvas) return;

      const W = canvas.width;
      const H = canvas.height;
      if (W === 0 || H === 0) return;

      // Update landmark→canvas mapping using cover semantics (video fills container)
      if (video && video.videoWidth > 0) {
        videoRegionRef.current = calcVideoRegionCover(video.videoWidth, video.videoHeight, W, H);
      } else {
        videoRegionRef.current = { x: 0, y: 0, w: W, h: H };
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      drawOverlay(ctx, W, H, ts);
    }

    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [drawOverlay, videoRef]);

  // ── DeviceOrientation for calib step 2 ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'calib-2') return;

    // `cancelled` guards against the iOS permission promise resolving after
    // the user has already moved past calib-2, which would add a stale listener.
    let cancelled = false;

    function handler(e) {
      orientationRef.current = { beta: e.beta, gamma: e.gamma };
      setOrientation({ beta: e.beta, gamma: e.gamma });
    }

    // iOS 13+ requires an explicit permission request
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(state => {
          if (!cancelled && state === 'granted') {
            window.addEventListener('deviceorientation', handler);
          }
        })
        .catch(() => {});
    } else {
      window.addEventListener('deviceorientation', handler);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('deviceorientation', handler);
    };
  }, [phase]);

  const orientationOk =
    orientation.beta !== null &&
    orientation.beta > 80 && orientation.beta < 100 &&
    Math.abs(orientation.gamma ?? 0) < 5;

  // ── Test run countdown (calib step 3) ────────────────────────────────────
  function startTestRun() {
    setTestRunDone(false);
    setTestRunCountdown(3);
    let count = 3;

    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownRef.current);
        setTestRunCountdown(null);
        setTestRunDone(true);
      } else {
        setTestRunCountdown(count);
      }
    }, 1000);
  }

  useEffect(() => () => clearInterval(countdownRef.current), []);

  // ── Camera open ───────────────────────────────────────────────────────────
  // Phase transition is handled by the isRunning effect above.
  async function handleOpenCamera() {
    await startCamera();
  }

  // ── Line dragging ─────────────────────────────────────────────────────────
  function getPointerCanvasX(e) {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect || !canvas) return 0;
    if (isPortraitFallbackRef.current) {
      // Canvas is rotated 90° CW: screen-Y maps to canvas-X (inverted)
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const ry = clientY - rect.top;
      return (1 - ry / rect.height) * canvas.width;
    }
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return clientX - rect.left;
  }

  function handlePointerDown(e) {
    if (!['calib-1', 'calib-2'].includes(phaseRef.current)) return;
    const canvasX = getPointerCanvasX(e);
    const region = videoRegionRef.current;
    const leftPx = region.x + leftLineRef.current * region.w;
    const rightPx = region.x + rightLineRef.current * region.w;
    if (Math.abs(canvasX - leftPx) < 28) draggingRef.current = 'left';
    else if (Math.abs(canvasX - rightPx) < 28) draggingRef.current = 'right';
  }

  function handlePointerMove(e) {
    if (!draggingRef.current || !canvasRef.current) return;
    e.preventDefault();
    const canvasX = getPointerCanvasX(e);
    const norm = canvasToNorm(canvasX, videoRegionRef.current);
    if (draggingRef.current === 'left') {
      leftLineRef.current = Math.min(norm, rightLineRef.current - 0.08);
    } else {
      rightLineRef.current = Math.max(norm, leftLineRef.current + 0.08);
    }
  }

  function handlePointerUp() {
    draggingRef.current = null;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleStartDetection() {
    resetDetectionState();
    setPhase('armed');
  }

  function handleSave() {
    if (resultTime !== null) {
      onResult(parseFloat(resultTime.toFixed(3)));
    }
    handleClose();
  }

  function handleRepeat() {
    resetDetectionState();
    setPhase('armed');
  }

  function handleClose() {
    stopCamera();
    onClose();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const videoCanvasBase = isPortraitFallback
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100vh',
        height: '100vw',
        transform: 'translate(-50%, -50%) rotate(90deg)',
      }
    : {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
      };

  return (
    <div className="fixed inset-0 z-50 bg-black">

      {/* Video — fixed full screen, object-fit:cover */}
      <video
        ref={videoRef}
        className="object-cover"
        style={{ ...videoCanvasBase, zIndex: 1 }}
        playsInline
        muted
        autoPlay
      />

      {/* Canvas overlay — same layout as video */}
      <canvas
        ref={canvasRef}
        className="touch-none"
        style={{ ...videoCanvasBase, zIndex: 2 }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        onTouchCancel={handlePointerUp}
      />

      {/* ── BANDA NEGRA — header fijo ───────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-[#0f172a] border-b border-white/5">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-[#22d3ee]" />
          <span className="text-sm font-semibold text-slate-200">
            {TEST_LABEL[testType] ?? testType}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-slate-300 active:bg-white/10"
        >
          <X size={20} />
        </button>
      </div>

      {/* MediaPipe loading */}
      {mpLoading && phase !== 'permission' && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60" style={{ zIndex: 3 }}>
          <p className="text-sm text-slate-300">Cargando MediaPipe…</p>
        </div>
      )}

      {/* ── PANEL CALIBRACIÓN — fijo en el fondo ───────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 bg-[#0f172a] border-t border-white/10 px-4 pt-3 pb-safe-bottom overflow-y-auto"
        style={{ maxHeight: '45vh' }}
      >

        {/* Indicador de pasos (calib-1/2/3) */}
        {['calib-1', 'calib-2', 'calib-3'].includes(phase) && (
          <div className="flex items-center gap-2 mb-3">
            {[1, 2, 3].map(n => {
              const stepPhase = ['calib-1', 'calib-2', 'calib-3'][n - 1];
              const active = phase === stepPhase;
              const done = ['calib-1', 'calib-2', 'calib-3'].indexOf(phase) >= n;
              return (
                <div key={n} className="flex items-center gap-1">
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
                      active ? 'bg-[#22d3ee] text-[#0f172a]'
                        : done ? 'bg-[#22c55e] text-white'
                        : 'bg-[#1e293b] text-slate-500'
                    )}
                  >
                    {done && !active ? <Check size={12} /> : n}
                  </span>
                  {n < 3 && <div className={cn('h-px w-5', done ? 'bg-[#22d3ee]' : 'bg-white/10')} />}
                </div>
              );
            })}
            <span className="text-xs text-slate-400 ml-1">
              {phase === 'calib-1' && 'Posicionar líneas'}
              {phase === 'calib-2' && 'Validar ángulo'}
              {phase === 'calib-3' && 'Prueba de detección'}
            </span>
          </div>
        )}

        {/* ── PERMISSION ─────────────────────────────────────────────────────── */}
        {phase === 'permission' && (
          <div className="h-full flex flex-col justify-center gap-3">
            <p className="text-xs text-slate-400 leading-relaxed text-center">
              La cámara detecta el centroide del atleta para medir el tiempo automáticamente.
              Colocá el teléfono lateral, perpendicular a la dirección de carrera.
            </p>
            {(cameraError || mpError) && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">{cameraError || mpError}</p>
              </div>
            )}
            <button
              onClick={handleOpenCamera}
              disabled={mpLoading || !!mpError}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#22d3ee] text-[#0f172a] font-bold text-sm disabled:opacity-40 min-h-[52px] active:bg-[#06b6d4]"
            >
              {mpLoading
                ? 'Cargando modelo…'
                : <><Camera size={18} /> Abrir cámara</>
              }
            </button>
          </div>
        )}

        {/* ── CALIB 1 — Posicionar líneas ────────────────────────────────────── */}
        {phase === 'calib-1' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              Arrastrá las líneas{' '}
              <span className="text-[#22d3ee] font-semibold">INICIO</span> y{' '}
              <span className="text-[#22d3ee] font-semibold">{isCOD ? 'GIRO' : 'FIN'}</span>{' '}
              sobre los conos reales visibles en la cámara.
            </p>
            <button
              onClick={() => setPhase('calib-2')}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#22d3ee] text-[#0f172a] font-bold text-sm min-h-[52px] active:bg-[#06b6d4]"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── CALIB 2 — Validar ángulo ────────────────────────────────────────── */}
        {phase === 'calib-2' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              Mantené el teléfono{' '}
              <strong className="text-slate-200">vertical</strong> y{' '}
              <strong className="text-slate-200">perpendicular</strong> al carril (±5°).
            </p>
            {orientation.beta === null && (
              <p className="text-xs text-slate-500">
                Sensor no disponible — podés continuar igual.
              </p>
            )}
            {orientation.beta !== null && orientationOk && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20">
                <Check size={14} className="text-[#22c55e]" />
                <p className="text-xs text-[#22c55e] font-semibold">Ángulo correcto</p>
              </div>
            )}
            <button
              onClick={() => setPhase('calib-3')}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm min-h-[52px] transition-colors active:opacity-80',
                orientationOk ? 'bg-[#22c55e] text-white' : 'bg-[#22d3ee] text-[#0f172a]'
              )}
            >
              {orientationOk && <Check size={16} />}
              {orientationOk ? 'Ángulo OK — Siguiente' : 'Siguiente'}
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── CALIB 3 — Prueba de detección ──────────────────────────────────── */}
        {phase === 'calib-3' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400 leading-relaxed">
              {testRunCountdown !== null
                ? `Detectando… ${testRunCountdown}s. Mové al atleta frente a la cámara.`
                : testRunDone
                ? '✓ Punto amarillo visible = detección activa.'
                : 'Hacé una prueba de 3 s para confirmar que el centroide se detecta.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={startTestRun}
                disabled={testRunCountdown !== null}
                className="flex-1 py-3.5 rounded-xl bg-[#1e293b] border border-white/10 text-slate-200 text-sm font-semibold disabled:opacity-40 min-h-[52px] active:bg-[#334155]"
              >
                {testRunCountdown !== null
                  ? `${testRunCountdown}s…`
                  : testRunDone ? 'Repetir prueba' : 'Hacer prueba (3s)'}
              </button>
              <button
                onClick={handleStartDetection}
                className="flex-1 flex items-center justify-center gap-1 py-3.5 rounded-xl bg-[#22d3ee] text-[#0f172a] font-bold text-sm min-h-[52px] active:bg-[#06b6d4]"
              >
                LISTO <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── ARMED ──────────────────────────────────────────────────────────── */}
        {phase === 'armed' && (
          <div className="h-full flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#22d3ee]">ARMADO</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Esperando cruce de línea <strong className="text-slate-300">INICIO</strong>
              </p>
            </div>
            <button
              onClick={() => setPhase('calib-1')}
              className="px-4 py-3 rounded-xl bg-[#1e293b] border border-white/10 text-slate-400 text-xs font-medium min-h-[48px] active:bg-[#334155]"
            >
              Ajustar líneas
            </button>
          </div>
        )}

        {/* ── MEASURING ──────────────────────────────────────────────────────── */}
        {phase === 'measuring' && (
          <div className="h-full flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#22c55e]">MIDIENDO…</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {isCOD && !codTurnMade
                  ? 'Esperando giro en línea GIRO…'
                  : isCOD
                  ? 'Esperando retorno a INICIO…'
                  : 'Esperando cruce de línea FIN…'}
              </p>
            </div>
            <button
              onClick={() => { resetDetectionState(); setPhase('armed'); }}
              className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium min-h-[48px] active:bg-red-500/20"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* ── RESULT — cubre toda la pantalla ─────────────────────────────────── */}
      {phase === 'result' && resultTime !== null && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-black/75">
          <div className="bg-[#0f172a] rounded-2xl px-10 py-8 flex flex-col items-center gap-5 border border-white/10 shadow-2xl mx-6 w-full max-w-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {TEST_LABEL[testType] ?? testType}
            </p>
            <p
              className="text-6xl font-bold text-[#22c55e] tabular-nums"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {resultTime.toFixed(3)}s
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={handleRepeat}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#1e293b] border border-white/10 text-slate-200 text-sm font-semibold min-h-[52px] active:bg-[#334155]"
              >
                <RotateCcw size={16} /> REPETIR
              </button>
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-[#22d3ee] text-[#0f172a] text-sm font-bold min-h-[52px] active:bg-[#06b6d4]"
              >
                <Check size={16} /> GUARDAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
