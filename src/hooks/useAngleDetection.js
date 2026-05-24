import { useRef, useState, useCallback, useEffect } from 'react';

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose';

// MediaPipe landmark indices per side
const LM_SIDES = {
  left:  { hip: 23, knee: 25, ankle: 27 },
  right: { hip: 24, knee: 26, ankle: 28 },
};

// ── Normative values by sport ─────────────────────────────────────────────────
export const NORMAS = {
  rugby:   { optimo: 35, precaucion: 25 },
  hockey:  { optimo: 33, precaucion: 23 },
  futbol:  { optimo: 35, precaucion: 25 },
  default: { optimo: 35, precaucion: 25 },
};

export function getAngleStatus(angle, sport = 'default') {
  const n = NORMAS[sport] ?? NORMAS.default;
  if (angle >= n.optimo)     return 'optimo';
  if (angle >= n.precaucion) return 'precaucion';
  return 'riesgo';
}

export function statusColor(s) {
  if (s === 'optimo')    return '#22c55e';
  if (s === 'precaucion') return '#eab308';
  return '#ef4444';
}

export function statusLabel(s) {
  if (s === 'optimo')    return 'ÓPTIMO';
  if (s === 'precaucion') return 'PRECAUCIÓN';
  return 'RIESGO';
}

export function statusBg(s) {
  if (s === 'optimo')    return 'rgba(34,197,94,0.12)';
  if (s === 'precaucion') return 'rgba(234,179,8,0.12)';
  return 'rgba(239,68,68,0.12)';
}

// ── Dorsiflexion angle calculation ────────────────────────────────────────────
// Angle between the tibia (ankle→knee) and the vertical (upward).
// MediaPipe y coords: 0=top, 1=bottom (y increases downward).
// Tibia vector: (knee.x - ankle.x, knee.y - ankle.y)
// Vertical-up vector: (0, -1)
// dot = tibiaY * (-1) = -(knee.y - ankle.y) = ankle.y - knee.y
function calcDorsiflexion(knee, ankle) {
  const tibiaX = knee.x - ankle.x;
  const tibiaY = knee.y - ankle.y;
  const dot    = tibiaX * 0 + tibiaY * (-1); // dot with (0,-1)
  const mag    = Math.sqrt(tibiaX ** 2 + tibiaY ** 2);
  if (mag === 0) return 0;
  const rad = Math.acos(Math.min(1, Math.max(-1, dot / mag)));
  return Math.round(rad * (180 / Math.PI));
}

// ── CDN script loader ─────────────────────────────────────────────────────────
// Fix (bug #2): si la etiqueta <script> ya existe pero aún no disparó onload,
// esperar el evento en vez de resolver de inmediato (evita el TypeError
// "window.Pose is not a constructor" en remontajes rápidos del componente).
function loadScript(src) {
  return new Promise((res, rej) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      // El símbolo ya está disponible (carga previa completada)
      if (window.Pose) { res(); return; }
      // Script en el DOM pero todavía cargando — esperar onload
      existing.addEventListener('load',  res,                                              { once: true });
      existing.addEventListener('error', () => rej(new Error(`No se pudo cargar: ${src}`)), { once: true });
      return;
    }
    const s    = document.createElement('script');
    s.src      = src;
    s.onload   = res;
    s.onerror  = () => rej(new Error(`No se pudo cargar: ${src}`));
    document.head.appendChild(s);
  });
}

// ── Canvas overlay drawing ────────────────────────────────────────────────────
function drawOverlay(ctx, lm, ids, ang, W, H, sport) {
  if (!lm || lm.length < 33) return;
  const hip   = lm[ids.hip];
  const knee  = lm[ids.knee];
  const ankle = lm[ids.ankle];
  if (!hip || !knee || !ankle) return;

  const hx  = hip.x   * W, hy  = hip.y   * H;
  const kx  = knee.x  * W, ky  = knee.y  * H;
  const ax  = ankle.x * W, ay  = ankle.y * H;

  const st  = ang != null ? getAngleStatus(ang, sport) : 'riesgo';
  const col = statusColor(st);

  // Upper leg: hip → knee (accent)
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(56,189,248,0.55)';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(kx, ky);
  ctx.stroke();

  // Tibia: knee → ankle (semaphore color)
  ctx.lineWidth = 4;
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(ax, ay);
  ctx.stroke();

  // Vertical reference from ankle (80px up, dashed)
  ctx.setLineDash([6, 4]);
  ctx.lineWidth   = 2;
  ctx.strokeStyle = 'rgba(148,163,184,0.65)';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax, ay - 80);
  ctx.stroke();
  ctx.setLineDash([]);

  // Arc between tibia and vertical at ankle
  if (ang != null && ang > 0 && ang < 90) {
    const r      = 42;
    const tibAng = Math.atan2(ky - ay, kx - ax);
    const vAng   = -Math.PI / 2;
    const start  = Math.min(tibAng, vAng);
    const end    = Math.max(tibAng, vAng);
    ctx.beginPath();
    ctx.arc(ax, ay, r, start, end);
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2;
    ctx.stroke();
  }

  // Landmark dots
  [[hx, hy, 'rgba(56,189,248,0.9)'], [kx, ky, col], [ax, ay, col]]
    .forEach(([x, y, fill]) => {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,23,42,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

  // Angle text near ankle
  if (ang != null) {
    ctx.font      = 'bold 30px "JetBrains Mono", monospace';
    ctx.fillStyle = col;
    ctx.fillText(`${ang}°`, ax + 18, ay - 26);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAngleDetection({ side, sport = 'default' }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const poseRef     = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const runningRef  = useRef(false);
  // Store ids in a ref so onResults closure doesn't become stale
  const idsRef      = useRef(LM_SIDES[side] ?? LM_SIDES.left);
  const sportRef    = useRef(sport);

  useEffect(() => { sportRef.current = sport; }, [sport]);

  const [angle,       setAngle]       = useState(null);
  const [landmarks,   setLandmarks]   = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [mpLoading,   setMpLoading]   = useState(true);
  const [mpError,     setMpError]     = useState(null);
  const [cameraError, setCameraError] = useState(null);

  // Stable onResults callback — reads ids and sport from refs
  const onResults = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lm = results.poseLandmarks ?? null;
    setLandmarks(lm);

    if (!lm) { setAngle(null); return; }

    const ids   = idsRef.current;
    const knee  = lm[ids.knee];
    const ankle = lm[ids.ankle];
    if (!knee || !ankle) { setAngle(null); return; }

    const computed = calcDorsiflexion(knee, ankle);
    setAngle(computed);
    drawOverlay(ctx, lm, ids, computed, canvas.width, canvas.height, sportRef.current);
  }, []); // stable — reads everything from refs

  // Load MediaPipe from CDN once on mount
  // Fix 2: modelComplexity 0 (más liviano en iOS), timeout 15s en initialize()
  useEffect(() => {
    let pose;
    let cancelled = false;

    (async () => {
      try {
        await loadScript(`${CDN_BASE}/pose.js`);
        // eslint-disable-next-line no-undef
        pose = new window.Pose({ locateFile: (f) => `${CDN_BASE}/${f}` });
        pose.setOptions({
          modelComplexity:        0,   // liviano — carga más rápido en iOS
          smoothLandmarks:        true,
          enableSegmentation:     false,
          smoothSegmentation:     false,
          minDetectionConfidence: 0.6,
          minTrackingConfidence:  0.6,
        });
        pose.onResults(onResults);
        // Timeout de 15s: en iOS el modelo puede tardar en descargarse.
        // Fix (bug #4): guardar el id del timer y limpiarlo cuando initialize()
        // gana la carrera, para que no dispare una rejected promise huérfana.
        let timeoutId;
        await Promise.race([
          pose.initialize().finally(() => clearTimeout(timeoutId)),
          new Promise((_, rej) => {
            timeoutId = setTimeout(() => rej(new Error('Timeout al cargar el modelo (>15s)')), 15000);
          }),
        ]);
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

  // Fix 1: startCamera NO espera a poseRef — abre el stream inmediatamente.
  // El loop de inferencia espera internamente a que poseRef.current esté listo.
  const startCamera = useCallback(async (facingMode = 'environment') => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width:      { ideal: 640 },
          height:     { ideal: 480 },
        },
        audio: false,
      });
      const video = videoRef.current;
      if (!video) {
        // Fix (bug #1): el componente se desmontó mientras getUserMedia resolvía.
        // Detener el stream aquí para que el LED de cámara se apague.
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      video.srcObject = stream;
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror          = rej;
      });
      await video.play();

      streamRef.current  = stream;
      runningRef.current = true;
      setIsDetecting(true);

      // Loop: espera a que MP esté listo antes de enviar frames
      const loop = async () => {
        if (!runningRef.current) return;
        try {
          if (
            poseRef.current &&
            videoRef.current?.readyState >= 2 &&
            !videoRef.current.paused
          ) {
            await poseRef.current.send({ image: videoRef.current });
          }
        } catch { /* ignorar errores de frame individual */ }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Permiso de cámara denegado. Habilitalo en Ajustes → Safari → Cámara.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No se encontró cámara en este dispositivo.');
      } else {
        setCameraError(`Error al iniciar la cámara: ${err.message}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsDetecting(false);
    setLandmarks(null);
    setAngle(null);
  }, []);

  // Cleanup on unmount
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
    angle, landmarks, isDetecting,
    mpLoading, mpError, cameraError,
    startCamera, stopCamera,
  };
}
