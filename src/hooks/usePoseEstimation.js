import { useRef, useState, useCallback, useEffect } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';

// Índices de landmarks relevantes para salto vertical
const LM = {
  SHOULDER_L: 11, SHOULDER_R: 12,
  HIP_L: 23,      HIP_R: 24,
  KNEE_L: 25,     KNEE_R: 26,
  ANKLE_L: 27,    ANKLE_R: 28,
  HEEL_L: 29,     HEEL_R: 30,
  FOOT_L: 31,     FOOT_R: 32,
};

// Detectar mobile para usar modelo más liviano
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Calcular ángulo en el punto b (vértice) entre los puntos a-b-c
function calcAngle(a, b, c) {
  const ax = a.x - b.x, ay = a.y - b.y;
  const cx = c.x - b.x, cy = c.y - b.y;
  const dot  = ax * cx + ay * cy;
  const magA = Math.sqrt(ax * ax + ay * ay);
  const magC = Math.sqrt(cx * cx + cy * cy);
  if (magA === 0 || magC === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (magA * magC)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Calcular ángulos de articulaciones a partir de los landmarks del frame
function calcPoseData(lm) {
  if (!lm || lm.length < 33) return null;

  const get = (i) => lm[i];

  const kneeAngleLeft  = calcAngle(get(LM.HIP_L),    get(LM.KNEE_L),  get(LM.ANKLE_L));
  const kneeAngleRight = calcAngle(get(LM.HIP_R),    get(LM.KNEE_R),  get(LM.ANKLE_R));
  const hipAngleLeft   = calcAngle(get(LM.SHOULDER_L), get(LM.HIP_L), get(LM.KNEE_L));
  const hipAngleRight  = calcAngle(get(LM.SHOULDER_R), get(LM.HIP_R), get(LM.KNEE_R));
  // Ángulo tobillo: rodilla → tobillo → pie
  const ankleAngleLeft  = calcAngle(get(LM.KNEE_L), get(LM.ANKLE_L), get(LM.FOOT_L));
  const ankleAngleRight = calcAngle(get(LM.KNEE_R), get(LM.ANKLE_R), get(LM.FOOT_R));

  const hipHeight      = (get(LM.HIP_L).y + get(LM.HIP_R).y) / 2;
  const shoulderHeight = (get(LM.SHOULDER_L).y + get(LM.SHOULDER_R).y) / 2;

  // Triple extensión: rodilla > 160°, cadera > 160°, tobillo < 120° (plantar flexión)
  const tripleExtension =
    kneeAngleLeft  > 160 && kneeAngleRight  > 160 &&
    hipAngleLeft   > 160 && hipAngleRight   > 160 &&
    ankleAngleLeft < 120 && ankleAngleRight < 120;

  return {
    kneeAngleLeft, kneeAngleRight,
    hipAngleLeft,  hipAngleRight,
    ankleAngleLeft, ankleAngleRight,
    hipHeight,
    shoulderHeight,
    tripleExtension,
  };
}

export function usePoseEstimation({ mode = 'realtime' } = {}) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const poseRef   = useRef(null);
  const cameraRef = useRef(null);

  const [isRunning,  setIsRunning]  = useState(false);
  const [landmarks,  setLandmarks]  = useState(null);
  const [poseData,   setPoseData]   = useState(null);
  const [poseReady,  setPoseReady]  = useState(false);
  const [error,      setError]      = useState(null);
  const [progress,   setProgress]   = useState(0); // para modo video (0–100)

  // Dibujar skeleton en el canvas de overlay
  function drawSkeleton(results) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.poseLandmarks) return;
    const lm = results.poseLandmarks;

    // Conexiones relevantes para vista sagital de salto
    const connections = [
      [LM.SHOULDER_L, LM.HIP_L],
      [LM.SHOULDER_R, LM.HIP_R],
      [LM.HIP_L,      LM.HIP_R],
      [LM.HIP_L,      LM.KNEE_L],
      [LM.HIP_R,      LM.KNEE_R],
      [LM.KNEE_L,     LM.ANKLE_L],
      [LM.KNEE_R,     LM.ANKLE_R],
      [LM.ANKLE_L,    LM.HEEL_L],
      [LM.ANKLE_R,    LM.HEEL_R],
      [LM.ANKLE_L,    LM.FOOT_L],
      [LM.ANKLE_R,    LM.FOOT_R],
    ];

    const W = canvas.width;
    const H = canvas.height;

    // Líneas
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

    // Articulaciones clave con color por ángulo
    const pd = calcPoseData(lm);
    const jointColors = pd ? {
      [LM.KNEE_L]:  angleColor(pd.kneeAngleLeft),
      [LM.KNEE_R]:  angleColor(pd.kneeAngleRight),
      [LM.HIP_L]:   angleColor(pd.hipAngleLeft),
      [LM.HIP_R]:   angleColor(pd.hipAngleRight),
    } : {};

    const keyJoints = [
      LM.SHOULDER_L, LM.SHOULDER_R,
      LM.HIP_L,  LM.HIP_R,
      LM.KNEE_L, LM.KNEE_R,
      LM.ANKLE_L, LM.ANKLE_R,
    ];

    keyJoints.forEach(i => {
      const p = lm[i];
      if (!p) return;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 5, 0, 2 * Math.PI);
      ctx.fillStyle = jointColors[i] ?? 'rgba(56,189,248,0.9)';
      ctx.fill();
    });
  }

  // Color de articulación según ángulo (para rodilla y cadera)
  function angleColor(angle) {
    if (angle > 160) return '#22c55e';
    if (angle > 120) return '#f59e0b';
    return '#ef4444';
  }

  // Callback de resultados de MediaPipe
  const onResults = useCallback((results) => {
    drawSkeleton(results);
    const lm = results.poseLandmarks ?? null;
    setLandmarks(lm);
    setPoseData(lm ? calcPoseData(lm) : null);
    if (lm) setPoseReady(true);
  }, []);

  // Inicializar instancia de Pose (una sola vez)
  useEffect(() => {
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
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
    poseRef.current = pose;

    return () => {
      pose.close?.();
    };
  }, [onResults]);

  // Iniciar cámara en tiempo real
  const startCamera = useCallback(async () => {
    if (!videoRef.current || !poseRef.current) return;
    setError(null);
    try {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (poseRef.current && videoRef.current) {
            await poseRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480,
        facingMode: 'environment',
      });
      await camera.start();
      cameraRef.current = camera;
      setIsRunning(true);
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
    cameraRef.current?.stop();
    cameraRef.current = null;
    setIsRunning(false);
    setPoseReady(false);
    setLandmarks(null);
    setPoseData(null);
  }, []);

  // Analizar video subido frame a frame
  const analyzeVideo = useCallback(async (file) => {
    if (!poseRef.current) return;
    setError(null);
    setProgress(0);

    const url    = URL.createObjectURL(file);
    const video  = document.createElement('video');
    video.src    = url;
    video.muted  = true;
    video.playsInline = true;

    await new Promise((res, rej) => {
      video.onloadedmetadata = res;
      video.onerror = rej;
    });

    const duration = video.duration;
    const fps      = 30;
    const step     = 1 / fps;
    let   time     = 0;

    setIsRunning(true);

    while (time <= duration) {
      video.currentTime = time;
      await new Promise(res => {
        video.onseeked = res;
      });
      await poseRef.current.send({ image: video });
      setProgress(Math.round((time / duration) * 100));
      time += step;
    }

    setProgress(100);
    setIsRunning(false);
    URL.revokeObjectURL(url);
  }, []);

  return {
    videoRef,
    canvasRef,
    isRunning,
    landmarks,
    poseData,
    poseReady,
    error,
    progress,
    startCamera,
    stopCamera,
    analyzeVideo,
  };
}
