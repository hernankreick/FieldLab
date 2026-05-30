import { useRef, useState, useCallback, useEffect } from 'react';

// Version pinned to iOS Safari–compatible build (same as usePoseEstimation.js)
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404';
const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`));
    document.head.appendChild(s);
  });
}

// Minimal MediaPipe Pose hook for the timing module.
// Handles model loading, camera stream, and per-frame inference.
// Calls onLandmarks(lm) synchronously for every processed frame.
// lm is the raw poseLandmarks array (or null if pose not detected).
export function usePoseDetection({ onLandmarks }) {
  const videoRef = useRef(null);
  const poseRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const runningRef = useRef(false);
  const onLandmarksRef = useRef(onLandmarks);

  const [mpLoading, setMpLoading] = useState(true);
  const [mpError, setMpError] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Keep the callback ref current without restarting the effect chain
  useEffect(() => { onLandmarksRef.current = onLandmarks; }, [onLandmarks]);

  const handleResults = useCallback((results) => {
    onLandmarksRef.current?.(results.poseLandmarks ?? null);
  }, []);

  // Load MediaPipe from CDN once on mount
  useEffect(() => {
    let cancelled = false;
    let pose;

    (async () => {
      try {
        await loadScript(`${CDN_BASE}/pose.js`);
        // eslint-disable-next-line no-undef
        pose = new window.Pose({
          locateFile: (file) => `${CDN_BASE}/${file}`,
        });
        pose.setOptions({
          modelComplexity: IS_MOBILE ? 0 : 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        pose.onResults(handleResults);
        await pose.initialize();
        if (!cancelled) {
          poseRef.current = pose;
          setMpLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setMpError(`No se pudo cargar MediaPipe: ${err.message ?? String(err)}`);
          setMpLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      pose?.close?.();
      poseRef.current = null;
    };
  }, [handleResults]);

  const startCamera = useCallback(async () => {
    if (!poseRef.current) return;
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      video.srcObject = stream;
      await new Promise((res, rej) => {
        video.onloadedmetadata = res;
        video.onerror = () => rej(new Error('Error al cargar video'));
      });
      await video.play();

      streamRef.current = stream;
      runningRef.current = true;
      setIsRunning(true);

      const loop = async () => {
        if (!runningRef.current) return;
        try {
          if (poseRef.current && videoRef.current?.readyState >= 2) {
            await poseRef.current.send({ image: videoRef.current });
          }
        } catch {
          // Silently skip frames that fail (common during seek or resize)
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Permiso de cámara denegado. Habilitá el acceso en Configuración del navegador.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No se encontró cámara disponible en este dispositivo.');
      } else {
        setCameraError(`Error al iniciar cámara: ${err.message}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRunning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  return {
    videoRef,
    isRunning,
    mpLoading,
    mpError,
    cameraError,
    startCamera,
    stopCamera,
  };
}
