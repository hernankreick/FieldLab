import { useRef, useState, useCallback, useEffect } from 'react';

// Versión 0.5.1675469404 — última compatible con iOS Safari
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404';

// Landmarks por lado
const SIDES = {
  left:  { hip: 23, knee: 25, ankle: 27 },
  right: { hip: 24, knee: 26, ankle: 28 },
};

// ── Valores normativos por deporte (re-exportados para PlayerProfile) ─────────
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
  if (s === 'optimo')     return '#22c55e';
  if (s === 'precaucion') return '#eab308';
  return '#ef4444';
}

export function statusLabel(s) {
  if (s === 'optimo')     return 'ÓPTIMO';
  if (s === 'precaucion') return 'PRECAUCIÓN';
  return 'RIESGO';
}

export function statusBg(s) {
  if (s === 'optimo')     return 'rgba(34,197,94,0.12)';
  if (s === 'precaucion') return 'rgba(234,179,8,0.12)';
  return 'rgba(239,68,68,0.12)';
}

// ── Fórmula dorsiflexión: ángulo entre tibia y vertical ──────────────────────
function calcDorsiflexion(knee, ankle) {
  const tx = knee.x - ankle.x;
  const ty = knee.y - ankle.y;
  const dot = tx * 0 + ty * (-1);
  const mag = Math.sqrt(tx * tx + ty * ty);
  if (mag === 0) return 0;
  const rad = Math.acos(Math.min(1, Math.max(-1, dot / mag)));
  return Math.round(rad * (180 / Math.PI));
}

// ── Cargar script CDN, esperando si ya está en el DOM pero no ha cargado ─────
function loadScript(src) {
  return new Promise((res, rej) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.Pose) { res(); return; }
      existing.addEventListener('load',  res,                                               { once: true });
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

// ── Dibujar overlay en canvas sobre la foto analizada ────────────────────────
function drawOverlay(ctx, lm, ids, angle, W, H) {
  if (!lm || lm.length < 33) return;
  const hip   = lm[ids.hip];
  const knee  = lm[ids.knee];
  const ankle = lm[ids.ankle];
  if (!hip || !knee || !ankle) return;

  const hx = hip.x   * W, hy = hip.y   * H;
  const kx = knee.x  * W, ky = knee.y  * H;
  const ax = ankle.x * W, ay = ankle.y * H;

  const col = angle >= 35 ? '#22c55e' : angle >= 25 ? '#eab308' : '#ef4444';

  // Línea muslo
  ctx.lineWidth   = 5;
  ctx.strokeStyle = 'rgba(56,189,248,0.7)';
  ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();

  // Línea tibia (color semáforo)
  ctx.lineWidth   = 5;
  ctx.strokeStyle = col;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(ax, ay); ctx.stroke();

  // Línea vertical referencia desde tobillo
  ctx.setLineDash([6, 4]);
  ctx.lineWidth   = 2;
  ctx.strokeStyle = 'rgba(148,163,184,0.7)';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - 90); ctx.stroke();
  ctx.setLineDash([]);

  // Arco del ángulo
  if (angle > 0 && angle < 90) {
    const r      = 48;
    const tibAng = Math.atan2(ky - ay, kx - ax);
    const vAng   = -Math.PI / 2;
    ctx.beginPath();
    ctx.arc(ax, ay, r, Math.min(tibAng, vAng), Math.max(tibAng, vAng));
    ctx.strokeStyle = col;
    ctx.lineWidth   = 2.5;
    ctx.stroke();
  }

  // Puntos en articulaciones
  [[hx, hy, '#38bdf8'], [kx, ky, col], [ax, ay, col]].forEach(([x, y, fill]) => {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fillStyle  = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.9)';
    ctx.lineWidth   = 2;
    ctx.stroke();
  });

  // Ángulo en texto con contorno
  ctx.font        = 'bold 36px "JetBrains Mono", monospace';
  ctx.lineWidth   = 4;
  ctx.strokeStyle = 'rgba(15,23,42,0.85)';
  ctx.strokeText(`${angle}°`, ax + 20, ay - 30);
  ctx.fillStyle   = col;
  ctx.fillText(`${angle}°`, ax + 20, ay - 30);
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useLungePhoto({ side, sport = 'default' }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const poseRef    = useRef(null);
  const rafRef     = useRef(null);
  const runningRef = useRef(false);

  const [mpLoading,     setMpLoading]     = useState(true);
  const [mpError,       setMpError]       = useState(null);
  const [cameraError,   setCameraError]   = useState(null);
  const [isStreaming,   setIsStreaming]    = useState(false);
  const [capturedAngle, setCapturedAngle] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null); // dataURL
  const [landmarks,     setLandmarks]     = useState(null);
  const [liveAngle,     setLiveAngle]     = useState(null);

  const ids = SIDES[side] ?? SIDES.left;

  // onResults para video en vivo (preview)
  const onLiveResults = useCallback((results) => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;
    canvas.width  = video.videoWidth  || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lm = results.poseLandmarks ?? null;
    setLandmarks(lm);
    if (!lm) { setLiveAngle(null); return; }
    const knee  = lm[ids.knee];
    const ankle = lm[ids.ankle];
    if (!knee || !ankle) { setLiveAngle(null); return; }
    const ang = calcDorsiflexion(knee, ankle);
    setLiveAngle(ang);
    drawOverlay(ctx, lm, ids, ang, canvas.width, canvas.height);
  }, [ids]);  // ids is stable per hook instance

  // Cargar MediaPipe al montar
  useEffect(() => {
    let pose;
    let cancelled = false;
    (async () => {
      try {
        await loadScript(`${CDN}/pose.js`);
        // eslint-disable-next-line no-undef
        pose = new window.Pose({
          locateFile: (f) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`,
        });
        pose.setOptions({
          modelComplexity:        0,    // modelo liviano — carga más rápido en iOS
          smoothLandmarks:        true,
          enableSegmentation:     false,
          smoothSegmentation:     false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence:  0.5,
        });
        pose.onResults(onLiveResults);
        let timeoutId;
        await Promise.race([
          pose.initialize().finally(() => clearTimeout(timeoutId)),
          new Promise((_, rej) => {
            timeoutId = setTimeout(() => rej(new Error('Timeout >15s')), 15000);
          }),
        ]);
        if (!cancelled) { poseRef.current = pose; setMpLoading(false); }
      } catch (err) {
        if (!cancelled) {
          setMpError(`No se pudo cargar MediaPipe: ${err.message}`);
          setMpLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      pose?.close?.();
      poseRef.current = null;
    };
  }, [onLiveResults]);

  // Abrir cámara (trasera o frontal)
  const startCamera = useCallback(async (facingMode = 'environment') => {
    setCameraError(null);
    setCapturedAngle(null);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width:      { ideal: 1280 },
          height:     { ideal: 720 },
        },
        audio: false,
      });
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      video.srcObject = stream;
      await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = rej; });
      await video.play();
      streamRef.current  = stream;
      runningRef.current = true;
      setIsStreaming(true);

      const loop = async () => {
        if (!runningRef.current) return;
        try {
          if (poseRef.current && videoRef.current?.readyState >= 2 && !videoRef.current.paused) {
            await poseRef.current.send({ image: videoRef.current });
          }
        } catch { /* ignorar errores de frame */ }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      const msg =
        err.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Habilitalo en Ajustes.' :
        err.name === 'NotFoundError'   ? 'No se encontró cámara en este dispositivo.' :
        `Error al iniciar la cámara: ${err.message}`;
      setCameraError(msg);
    }
  }, []);

  // CAPTURAR FOTO: congela el frame actual y analiza la imagen estática
  const capturePhoto = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !poseRef.current) return;

    // Pausar el loop de video
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);

    // Capturar frame como imagen
    const snap    = document.createElement('canvas');
    snap.width    = video.videoWidth;
    snap.height   = video.videoHeight;
    snap.getContext('2d').drawImage(video, 0, 0);
    const dataURL = snap.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataURL);

    // Analizar imagen estática con MediaPipe
    const img = new Image();
    img.src   = dataURL;
    await new Promise(res => { img.onload = res; });

    let resolved = false;
    const staticHandler = (results) => {
      if (resolved) return;
      resolved  = true;
      const lm  = results.poseLandmarks ?? null;
      canvas.width  = snap.width;
      canvas.height = snap.height;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (lm) {
        const knee  = lm[ids.knee];
        const ankle = lm[ids.ankle];
        if (knee && ankle) {
          const ang = calcDorsiflexion(knee, ankle);
          setCapturedAngle(ang);
          setLandmarks(lm);
          drawOverlay(ctx, lm, ids, ang, canvas.width, canvas.height);
        } else {
          setCapturedAngle(null);
        }
      } else {
        setCapturedAngle(null);
      }
    };

    poseRef.current.onResults(staticHandler);
    await poseRef.current.send({ image: img });
    // Restaurar handler de live
    if (poseRef.current) poseRef.current.onResults(onLiveResults);
  }, [ids, onLiveResults]);

  // ANALIZAR FOTO CARGADA DESDE GALERÍA
  const analyzeUpload = useCallback(async (file) => {
    if (!poseRef.current) return;
    setCapturedAngle(null);
    setCapturedImage(null);

    const dataURL = await new Promise((res, rej) => {
      const reader    = new FileReader();
      reader.onload   = e => res(e.target.result);
      reader.onerror  = rej;
      reader.readAsDataURL(file);
    });
    setCapturedImage(dataURL);

    const img = new Image();
    img.src   = dataURL;
    await new Promise(res => { img.onload = res; });

    const canvas = canvasRef.current;
    if (!canvas) return;

    let resolved = false;
    const handler = (results) => {
      if (resolved) return;
      resolved  = true;
      const lm  = results.poseLandmarks ?? null;
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (lm) {
        const knee  = lm[ids.knee];
        const ankle = lm[ids.ankle];
        if (knee && ankle) {
          const ang = calcDorsiflexion(knee, ankle);
          setCapturedAngle(ang);
          setLandmarks(lm);
          drawOverlay(ctx, lm, ids, ang, canvas.width, canvas.height);
        }
      }
    };
    poseRef.current.onResults(handler);
    await poseRef.current.send({ image: img });
    if (poseRef.current) poseRef.current.onResults(onLiveResults);
  }, [ids, onLiveResults]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsStreaming(false);
    setLiveAngle(null);
  }, []);

  // Volver a retomar el stream de video después de captura
  const retake = useCallback(() => {
    setCapturedAngle(null);
    setCapturedImage(null);
    // Limpiar canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    runningRef.current = true;
    if (poseRef.current) poseRef.current.onResults(onLiveResults);
    const loop = async () => {
      if (!runningRef.current) return;
      try {
        if (poseRef.current && videoRef.current?.readyState >= 2 && !videoRef.current.paused) {
          await poseRef.current.send({ image: videoRef.current });
        }
      } catch { /* ignorar */ }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [onLiveResults]);

  // Reset estado para un nuevo lado
  const resetForNewSide = useCallback(() => {
    setCapturedAngle(null);
    setCapturedImage(null);
    setLiveAngle(null);
    setLandmarks(null);
    setCameraError(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  // Cleanup al desmontar
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
    mpLoading, mpError,
    cameraError,
    isStreaming,
    liveAngle,
    capturedAngle,
    capturedImage,
    landmarks,
    startCamera,
    stopCamera,
    capturePhoto,
    analyzeUpload,
    retake,
    resetForNewSide,
  };
}
