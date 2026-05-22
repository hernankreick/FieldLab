import { useRef, useState, useCallback, useEffect } from 'react';

// Índices de landmarks relevantes para salto vertical
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

// Inyectar script de CDN (idempotente: si ya existe, resuelve inmediatamente)
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
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

  const hipHeight      = (lm[LM.HIP_L].y + lm[LM.HIP_R].y) / 2;
  const shoulderHeight = (lm[LM.SHOULDER_L].y + lm[LM.SHOULDER_R].y) / 2;

  const tripleExtension =
    kneeAngleLeft  > 160 && kneeAngleRight  > 160 &&
    hipAngleLeft   > 160 && hipAngleRight   > 160 &&
    ankleAngleLeft < 120 && ankleAngleRight < 120;

  return {
    kneeAngleLeft, kneeAngleRight,
    hipAngleLeft,  hipAngleRight,
    ankleAngleLeft, ankleAngleRight,
    hipHeight, shoulderHeight,
    tripleExtension,
  };
}

export function usePoseEstimation({ mode = 'realtime' } = {}) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const poseRef    = useRef(null);
  const streamRef  = useRef(null);
  const rafRef     = useRef(null);
  const runningRef = useRef(false);

  const [isRunning, setIsRunning] = useState(false);
  const [landmarks, setLandmarks] = useState(null);
  const [poseData,  setPoseData]  = useState(null);
  const [poseReady, setPoseReady] = useState(false);
  const [error,     setError]     = useState(null);
  const [progress,  setProgress]  = useState(0);
  const [mpLoading, setMpLoading] = useState(true);
  const [mpError,   setMpError]   = useState(null);

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

  const onResults = useCallback((results) => {
    drawSkeleton(results);
    const lm = results.poseLandmarks ?? null;
    setLandmarks(lm);
    setPoseData(lm ? calcPoseData(lm) : null);
    if (lm) setPoseReady(true);
  }, [drawSkeleton]);

  // Cargar MediaPipe desde CDN e inicializar Pose
  useEffect(() => {
    let pose;
    let cancelled = false;

    (async () => {
      try {
        // Inyectar el script de CDN — window.Pose queda disponible tras onload
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

  const startCamera = useCallback(async () => {
    if (!videoRef.current || !poseRef.current) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:      { ideal: 640 },
          height:     { ideal: 480 },
        },
        audio: false,
      });

      const video    = videoRef.current;
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
      if (err.name === 'NotAllowedError') {
        setError('Permiso de cámara denegado. Habilitá el acceso en la configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('No se encontró cámara disponible en este dispositivo.');
      } else {
        setError(`Error al iniciar la cámara: ${err.message}`);
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
    setIsRunning(false);
    setPoseReady(false);
    setLandmarks(null);
    setPoseData(null);
  }, []);

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
        // Cancelar si el componente se desmontó o se llamó stopCamera
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

  // Detener cámara y stream al desmontar el componente que usa el hook
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
    startCamera, stopCamera, analyzeVideo,
  };
}
