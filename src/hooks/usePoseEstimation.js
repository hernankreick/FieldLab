import { useRef, useState, useCallback, useEffect } from 'react';

const LM = {
  SHOULDER_L: 11, SHOULDER_R: 12,
  HIP_L: 23,      HIP_R: 24,
  KNEE_L: 25,     KNEE_R: 26,
  ANKLE_L: 27,    ANKLE_R: 28,
  HEEL_L: 29,     HEEL_R: 30,
  FOOT_L: 31,     FOOT_R: 32,
};

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose';

// Detection constants  (amplios temporalmente para diagnóstico)
const CALIB_FRAMES    = 60;   // frames to average for baseline (~2 s @ 30 fps)
const VIS_MIN         = 0.50; // minimum ankle visibility
const TAKEOFF_THR     = 0.03; // ankles must rise > 3 % of frame height to start flight
const LAND_THR        = 0.02; // ankles within 2 % of baseline → landed
const FLIGHT_MIN_MS   = 120;  // reject flights shorter than this
const FLIGHT_MAX_MS   = 1000; // reject flights longer than this
const COOLDOWN_MS     = 2000; // lockout after a detected jump
const LOW_VIS_CANCEL  = 8;    // consecutive low-vis frames needed to abort a flight

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s    = document.createElement('script');
    s.src      = src;
    s.onload   = resolve;
    s.onerror  = () => reject(new Error(`No se pudo cargar: ${src}`));
    document.head.appendChild(s);
  });
}

function calcAngle(a, b, c) {
  const ax = a.x - b.x, ay = a.y - b.y;
  const cx = c.x - b.x, cy = c.y - b.y;
  const dot  = ax * cx + ay * cy;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magC = Math.sqrt(cx * cx + cy * cy);
  if (magA === 0 || magC === 0) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot / (magA * magC)))) * 180) / Math.PI;
}

function angleColor(angle) {
  if (angle > 160) return '#22c55e';
  if (angle > 120) return '#f59e0b';
  return '#ef4444';
}

function calcPoseData(lm) {
  if (!lm || lm.length < 33) return null;

  const kneeAngleLeft   = calcAngle(lm[LM.HIP_L],      lm[LM.KNEE_L],  lm[LM.ANKLE_L]);
  const kneeAngleRight  = calcAngle(lm[LM.HIP_R],      lm[LM.KNEE_R],  lm[LM.ANKLE_R]);
  const hipAngleLeft    = calcAngle(lm[LM.SHOULDER_L],  lm[LM.HIP_L],  lm[LM.KNEE_L]);
  const hipAngleRight   = calcAngle(lm[LM.SHOULDER_R],  lm[LM.HIP_R],  lm[LM.KNEE_R]);
  const ankleAngleLeft  = calcAngle(lm[LM.KNEE_L], lm[LM.ANKLE_L], lm[LM.FOOT_L]);
  const ankleAngleRight = calcAngle(lm[LM.KNEE_R], lm[LM.ANKLE_R], lm[LM.FOOT_R]);

  const hipHeight      = (lm[LM.HIP_L].y    + lm[LM.HIP_R].y)    / 2;
  const shoulderHeight = (lm[LM.SHOULDER_L].y + lm[LM.SHOULDER_R].y) / 2;
  const ankleHeight    = (lm[LM.ANKLE_L].y  + lm[LM.ANKLE_R].y)  / 2;

  const tripleExtension =
    kneeAngleLeft  > 160 && kneeAngleRight  > 160 &&
    hipAngleLeft   > 160 && hipAngleRight   > 160 &&
    ankleAngleLeft < 120 && ankleAngleRight < 120;

  return {
    kneeAngleLeft, kneeAngleRight,
    hipAngleLeft,  hipAngleRight,
    ankleAngleLeft, ankleAngleRight,
    hipHeight, shoulderHeight, ankleHeight,
    tripleExtension,
  };
}

// Portable timestamp — avoids Intl.DateTimeFormat fractionalSecondDigits
// which isn't supported on Safari < 14.5 / older Android.
function nowStamp() {
  const t = new Date();
  const h = t.getHours().toString().padStart(2, '0');
  const m = t.getMinutes().toString().padStart(2, '0');
  const s = t.getSeconds().toString().padStart(2, '0');
  const ms = t.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}
  // ── Core refs ──────────────────────────────────────────────────────────────
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const poseRef    = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);
  const runningRef = useRef(false);
  const modeRef    = useRef(mode); // always-current mode for use inside closures

  // ── Core state ─────────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [landmarks, setLandmarks] = useState(null);
  const [poseData,  setPoseData]  = useState(null);
  const [poseReady, setPoseReady] = useState(false);
  const [error,     setError]     = useState(null);
  const [progress,  setProgress]  = useState(0);
  const [mpLoading, setMpLoading] = useState(true);
  const [mpError,   setMpError]   = useState(null);

  // ── Jump detection refs (all mutable, no re-render cost) ───────────────────
  const detPhaseRef     = useRef(null); // 'calibrating' | 'ready' | 'jumping' | null
  const calibBuf        = useRef([]);   // ankle-Y samples collected during calibration
  const baselineRef     = useRef(null); // mean ankle Y while standing (0–1, y=0 is top)
  const flightT0        = useRef(null); // performance.now() at takeoff
  const minVisRef       = useRef(1);    // minimum ankle visibility seen during flight
  const cooldownRef     = useRef(0);    // performance.now() threshold for next detection
  const lowVisFramesRef = useRef(0);    // consecutive low-vis frames during flight (buffer)

  // ── Debug snapshot (updated every frame, read by component on each render) ──
  const debugRef = useRef({
    baseline:     null,   // frozen ankle-Y baseline (null while calibrating)
    ankleY:       null,   // current average ankle Y
    delta:        null,   // baseline - ankleY (positive = above baseline)
    deltaPercent: null,   // delta * 100 as string '±X.X%'
    visL:         null,   // left ankle visibility
    visR:         null,   // right ankle visibility
    lowVisBuf:    0,      // current consecutive low-vis frame count
    takeoffAt:    null,   // time string of last takeoff
    landingAt:    null,   // time string of last landing
    lastFlightMs: null,   // last calculated flight time (even if rejected)
    rejectReason: null,   // why last jump was rejected
  });

  // ── Jump detection state (drives component UI) ─────────────────────────────
  // 'calibrating' → 'ready' → 'jumping' → 'ready' (loop)
  const [detectionPhase, setDetectionPhase] = useState(null);
  // Set once when a valid jump is measured; cleared by the component after handling
  const [jumpDetection, setJumpDetection] = useState(null);
  const resetDetection = useCallback(() => setJumpDetection(null), []);

  // Keep modeRef in sync so the onResults closure always reads the current mode
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Detection state machine ────────────────────────────────────────────────
  // Called synchronously in onResults every frame (avoids useEffect round-trip lag).
  // Only uses refs and stable setters → safe as useCallback([]).
  const runDetection = useCallback((lm, pd) => {
    const phase = detPhaseRef.current;
    if (!phase) return;

    const now    = performance.now();
    const ankleL = lm[LM.ANKLE_L];
    const ankleR = lm[LM.ANKLE_R];
    const visL   = ankleL?.visibility ?? 0;
    const visR   = ankleR?.visibility ?? 0;
    const avgY   = (ankleL.y + ankleR.y) / 2; // smaller = higher in frame

    // Update debug snapshot on every frame (component reads this on each render)
    const dbg = debugRef.current;
    dbg.ankleY    = avgY;
    dbg.visL      = visL;
    dbg.visR      = visR;
    dbg.lowVisBuf = lowVisFramesRef.current;
    if (baselineRef.current != null) {
      const delta        = baselineRef.current - avgY; // positive = above baseline
      dbg.baseline       = baselineRef.current;
      dbg.delta          = delta;
      dbg.deltaPercent   = (delta * 100).toFixed(1);
    }

    // ── CALIBRATING: build ankle-Y baseline from first CALIB_FRAMES good frames ──
    if (phase === 'calibrating') {
      if (visL > VIS_MIN && visR > VIS_MIN) {
        calibBuf.current.push(avgY);
        if (calibBuf.current.length >= CALIB_FRAMES) {
          const sum = calibBuf.current.reduce((a, b) => a + b, 0);
          baselineRef.current = sum / calibBuf.current.length;
          dbg.baseline        = baselineRef.current;
          dbg.rejectReason    = null;
          calibBuf.current    = [];
          detPhaseRef.current = 'ready';
          setDetectionPhase('ready');
          console.log('[Det] Baseline OK:', baselineRef.current.toFixed(3));
        }
      }
      return;
    }

    // ── READY: watch for takeoff ───────────────────────────────────────────────
    if (phase === 'ready') {
      if (now < cooldownRef.current) return;
      if (visL > VIS_MIN && visR > VIS_MIN &&
          avgY < baselineRef.current - TAKEOFF_THR) {
        detPhaseRef.current     = 'jumping';
        lowVisFramesRef.current = 0;
        dbg.lowVisBuf           = 0;
        setDetectionPhase('jumping');
        flightT0.current  = now;
        minVisRef.current = Math.min(visL, visR);
        dbg.takeoffAt     = nowStamp();
        dbg.landingAt     = null;
        dbg.lastFlightMs  = null;
        dbg.rejectReason  = null;
        console.log('[Det] Despegue — ankleY:', avgY.toFixed(3),
          '| baseline:', baselineRef.current.toFixed(3),
          '| Δ:', (baselineRef.current - avgY).toFixed(3));
      }
      return;
    }

    // ── JUMPING: track visibility + detect landing ─────────────────────────────
    if (phase === 'jumping') {
      const visMin = Math.min(visL, visR);
      if (visMin < minVisRef.current) minVisRef.current = visMin;

      if (visMin < VIS_MIN) {
        lowVisFramesRef.current += 1;
        dbg.lowVisBuf = lowVisFramesRef.current;
        if (lowVisFramesRef.current >= LOW_VIS_CANCEL) {
          dbg.rejectReason = `vis. baja (${lowVisFramesRef.current} frames)`;
          console.log('[Det] Cancelado por baja vis —', lowVisFramesRef.current, 'frames');
          detPhaseRef.current = 'ready';
          setDetectionPhase('ready');
        }
        return;
      }
      lowVisFramesRef.current = 0;
      dbg.lowVisBuf = 0;

      // Landing: both ankles return within LAND_THR of standing baseline
      if (avgY > baselineRef.current - LAND_THR) {
        const flightMs = Math.round(now - flightT0.current);
        dbg.landingAt    = nowStamp();
        dbg.lastFlightMs = flightMs;
        console.log('[Det] Aterrizaje — flightMs:', flightMs,
          '| ankleY:', avgY.toFixed(3));

        if (flightMs >= FLIGHT_MIN_MS && flightMs <= FLIGHT_MAX_MS) {
          dbg.rejectReason = null;
          setJumpDetection({
            flightMs,
            maxKneeAngle: pd ? Math.max(pd.kneeAngleLeft, pd.kneeAngleRight) : null,
          });
        } else {
          dbg.rejectReason = flightMs < FLIGHT_MIN_MS
            ? `muy corto (${flightMs}ms < ${FLIGHT_MIN_MS})`
            : `muy largo (${flightMs}ms > ${FLIGHT_MAX_MS})`;
          console.log('[Det] Rechazado —', dbg.rejectReason);
        }
        cooldownRef.current = now + COOLDOWN_MS;
        detPhaseRef.current = 'ready';
        setDetectionPhase('ready');
      }
    }
  }, []);

  // Start detection — called when camera opens
  const startDetection = useCallback(() => {
    detPhaseRef.current      = 'calibrating';
    calibBuf.current         = [];
    baselineRef.current      = null;
    flightT0.current         = null;
    minVisRef.current        = 1;
    cooldownRef.current      = 0;
    lowVisFramesRef.current  = 0;
    debugRef.current = {
      baseline: null, ankleY: null, delta: null, deltaPercent: null,
      visL: null, visR: null, lowVisBuf: 0,
      takeoffAt: null, landingAt: null, lastFlightMs: null, rejectReason: null,
    };
    setDetectionPhase('calibrating');
  }, []);

  // Stop/reset detection — called when camera closes
  const stopDetection = useCallback(() => {
    detPhaseRef.current = null;
    calibBuf.current    = [];
    setDetectionPhase(null);
  }, []);

  // ── Skeleton drawing ───────────────────────────────────────────────────────
  const drawSkeleton = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!results.poseLandmarks) return;

    const lm = results.poseLandmarks;
    const W  = canvas.width, H = canvas.height;

    const connections = [
      [LM.SHOULDER_L, LM.HIP_L],   [LM.SHOULDER_R, LM.HIP_R],
      [LM.HIP_L,      LM.HIP_R],
      [LM.HIP_L,      LM.KNEE_L],  [LM.HIP_R,      LM.KNEE_R],
      [LM.KNEE_L,     LM.ANKLE_L], [LM.KNEE_R,     LM.ANKLE_R],
      [LM.ANKLE_L,    LM.HEEL_L],  [LM.ANKLE_R,    LM.HEEL_R],
      [LM.ANKLE_L,    LM.FOOT_L],  [LM.ANKLE_R,    LM.FOOT_R],
    ];

    ctx.lineWidth = 2;
    connections.forEach(([i, j]) => {
      const a = lm[i], b = lm[j];
      if (!a || !b) return;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(56,189,248,0.7)';
      ctx.moveTo(a.x * W, a.y * H);
      ctx.lineTo(b.x * W, b.y * H);
      ctx.stroke();
    });

    const pd = calcPoseData(lm);
    const jointColors = pd ? {
      [LM.KNEE_L]: angleColor(pd.kneeAngleLeft),
      [LM.KNEE_R]: angleColor(pd.kneeAngleRight),
      [LM.HIP_L]:  angleColor(pd.hipAngleLeft),
      [LM.HIP_R]:  angleColor(pd.hipAngleRight),
    } : {};

    [LM.SHOULDER_L, LM.SHOULDER_R, LM.HIP_L, LM.HIP_R, LM.KNEE_L, LM.KNEE_R, LM.ANKLE_L, LM.ANKLE_R]
      .forEach(i => {
        const p = lm[i];
        if (!p) return;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 5, 0, 2 * Math.PI);
        ctx.fillStyle = jointColors[i] ?? 'rgba(56,189,248,0.9)';
        ctx.fill();
      });
  }, []);

  // ── MediaPipe results handler ──────────────────────────────────────────────
  const onResults = useCallback((results) => {
    drawSkeleton(results);
    const lm = results.poseLandmarks ?? null;
    setLandmarks(lm);
    const pd = lm ? calcPoseData(lm) : null;
    setPoseData(pd);
    if (lm) setPoseReady(true);
    // Run detection synchronously on every frame — no useEffect lag
    if (modeRef.current === 'realtime' && runningRef.current && lm && pd) {
      runDetection(lm, pd);
    }
  }, [drawSkeleton, runDetection]);

  // ── Load MediaPipe from CDN ────────────────────────────────────────────────
  useEffect(() => {
    let pose;
    let cancelled = false;

    (async () => {
      try {
        await loadScript(`${CDN_BASE}/pose.js`);
        // eslint-disable-next-line no-undef
        pose = new window.Pose({
          locateFile: (file) => `${CDN_BASE}/${file}`,
        });
        pose.setOptions({
          modelComplexity:        IS_MOBILE ? 0 : 1,
          smoothLandmarks:        true,
          enableSegmentation:     false,
          smoothSegmentation:     false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence:  0.5,
        });
        pose.onResults(onResults);
        await pose.initialize();

        if (!cancelled) {
          poseRef.current = pose;
          setMpLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setMpError(`No se pudo cargar MediaPipe: ${err.message ?? err}`);
          setMpLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      pose?.close?.();
      poseRef.current = null;
    };
  }, [onResults]);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async (facingMode = 'environment') => {
    if (!videoRef.current || !poseRef.current) return;
    setError(null);
    startDetection();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width:      { ideal: 640 },
          height:     { ideal: 480 },
        },
        audio: false,
      });

      const video     = videoRef.current;
      video.srcObject = stream;
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror          = rej;
      });
      await video.play();

      streamRef.current  = stream;
      runningRef.current = true;
      setIsRunning(true);

      const loop = async () => {
        if (!runningRef.current) return;
        try {
          if (poseRef.current && videoRef.current?.readyState >= 2) {
            await poseRef.current.send({ image: videoRef.current });
          }
        } catch { /* ignorar errores de frame individual */ }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

    } catch (err) {
      stopDetection();
      if (err.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Habilitá el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró cámara disponible en este dispositivo.');
      } else {
        setError(`Error al iniciar la cámara: ${err.message}`);
      }
    }
  }, [startDetection, stopDetection]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    stopDetection();
    setIsRunning(false);
    setPoseReady(false);
    setLandmarks(null);
    setPoseData(null);
  }, [stopDetection]);

  // ── Video file analysis (detection disabled — frame timing is synthetic) ───
  const analyzeVideo = useCallback(async (file) => {
    if (!poseRef.current) return;
    setError(null);
    setProgress(0);

    const url   = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src         = url;
    video.muted       = true;
    video.playsInline = true;

    try {
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror          = () => rej(new Error('No se pudo cargar el video'));
      });
    } catch (err) {
      setError(err.message);
      URL.revokeObjectURL(url);
      return;
    }

    const duration = video.duration;
    const step     = 1 / 30;
    let   time     = 0;

    runningRef.current = true;
    setIsRunning(true);

    try {
      while (time <= duration) {
        if (!runningRef.current) break;
        video.currentTime = time;
        await new Promise(res => { video.onseeked = res; });
        if (!runningRef.current) break;
        try {
          await poseRef.current?.send({ image: video });
        } catch { /* ignorar frame con error */ }
        setProgress(Math.round((time / duration) * 100));
        time += step;
      }
      if (runningRef.current) setProgress(100);
    } finally {
      runningRef.current = false;
      setIsRunning(false);
      URL.revokeObjectURL(url);
    }
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return {
    videoRef, canvasRef,
    isRunning, landmarks, poseData, poseReady,
    error, progress, mpLoading, mpError,
    detectionPhase, jumpDetection, resetDetection,
    debugRef,
    startCamera, stopCamera, analyzeVideo,
  };
}
