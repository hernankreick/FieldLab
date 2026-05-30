import { useRef, useState, useCallback, useEffect } from 'react';
import { calcMPV, calcPeakVelocity } from '../utils/vbtCalculations';

const VEL_THRESHOLD    = 0.1;   // m/s
const SMOOTH_N         = 4;
const DEFAULT_PX_PER_M = 200;
const BLOB_MIN_PX      = 10;
const SCAN_STRIDE      = 4;

export const MAX_REPS = 4;

// RGB → [H°, S%, L%]
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r)      h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else                h = (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

// Returns centroid {cx, cy} of orange/red blob in image coordinates, or null
function detectColorBlob(imageData) {
  const { data, width, height } = imageData;
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < height; y += SCAN_STRIDE) {
    for (let x = 0; x < width; x += SCAN_STRIDE) {
      const i = (y * width + x) * 4;
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      // Orange/red tape: H in [0,30]° or wrap-around red [330,360°], well-saturated, mid-luminance
      if ((h <= 30 || h >= 330) && s > 60 && l >= 40 && l <= 70) {
        sumX += x; sumY += y; count++;
      }
    }
  }
  return count >= BLOB_MIN_PX ? { cx: sumX / count, cy: sumY / count } : null;
}

// iOS Safari requires: playsinline set as attribute, muted, and a direct play() call.
// Returns the MediaStream on success, or a string error code on failure.
async function startCamera(videoRef) {
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1280 },
        height: { ideal: 720  },
      },
      audio: false,
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', '');
      videoRef.current.setAttribute('muted', '');
      await videoRef.current.play();
    }
    return stream;
  } catch (err) {
    stream?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    if (err.name === 'NotAllowedError') return 'PERMISSION_DENIED';
    if (err.name === 'NotFoundError')   return 'NO_CAMERA';
    return 'ERROR';
  }
}

export function useArUcoTracker() {
  // videoRef and canvasRef are attached to DOM elements in VBTModule.
  // iOS requires both to be in the DOM before use.
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const streamRef    = useRef(null);
  const rafRef       = useRef(null);
  const runningRef   = useRef(false);

  const calibPxMRef  = useRef(DEFAULT_PX_PER_M);

  const inRepRef     = useRef(false);
  const repPosRef    = useRef([]);
  const repTsRef     = useRef([]);
  const smoothPosRef = useRef([]);
  const smoothTsRef  = useRef([]);
  const repCountRef  = useRef(0);

  const [isTracking,            setIsTracking]            = useState(false);
  const [sessionComplete,       setSessionComplete]       = useState(false);
  const [cameraError,           setCameraError]           = useState(null);
  const [currentVelocity,       setCurrentVelocity]       = useState(0);
  const [calibrationPxPerMeter, setCalibrationPxPerMeter] = useState(DEFAULT_PX_PER_M);
  const [repData,               setRepData]               = useState([]);

  // ── Single-frame processing ────────────────────────────────────────────────
  const processFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || video.readyState < 2 || !canvas) return;

    if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const blob = detectColorBlob(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (!blob) {
      // Clear smoothing window so stale timestamps don't corrupt velocity when blob reappears
      smoothPosRef.current = [];
      smoothTsRef.current  = [];
      return;
    }

    const pxPerM = calibPxMRef.current;
    // Negate: upward movement (decreasing Y in image) = positive position
    const posM = -(blob.cy / pxPerM);
    const now  = performance.now();

    smoothPosRef.current.push(posM);
    smoothTsRef.current.push(now);
    if (smoothPosRef.current.length > SMOOTH_N) {
      smoothPosRef.current.shift();
      smoothTsRef.current.shift();
    }

    let vel = 0;
    const n = smoothPosRef.current.length;
    if (n >= 2) {
      const dp = smoothPosRef.current[n - 1] - smoothPosRef.current[0];
      const dt = (smoothTsRef.current[n - 1] - smoothTsRef.current[0]) / 1000;
      if (dt > 0) vel = dp / dt;
    }
    setCurrentVelocity(vel);

    const speed = Math.abs(vel);
    if (!inRepRef.current && speed > VEL_THRESHOLD) {
      inRepRef.current  = true;
      repPosRef.current = [posM];
      repTsRef.current  = [now];
    } else if (inRepRef.current) {
      repPosRef.current.push(posM);
      repTsRef.current.push(now);
      if (speed < VEL_THRESHOLD) {
        inRepRef.current   = false;
        const positions    = repPosRef.current.slice();
        const timestamps   = repTsRef.current.slice();
        const mpv          = calcMPV(positions, timestamps);
        const peakVelocity = calcPeakVelocity(positions, timestamps);
        repPosRef.current  = [];
        repTsRef.current   = [];
        if (mpv > 0) {
          repCountRef.current += 1;
          const done = repCountRef.current >= MAX_REPS;
          setRepData(prev => [...prev, { rep: prev.length + 1, mpv, peakVelocity }]);
          if (done) {
            // Inline stop — avoids calling stopTracking() from within the rAF callback
            runningRef.current = false;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            inRepRef.current     = false;
            repPosRef.current    = [];
            repTsRef.current     = [];
            smoothPosRef.current = [];
            smoothTsRef.current  = [];
            setIsTracking(false);
            setCurrentVelocity(0);
            setSessionComplete(true);
          }
        }
      }
    }
  }, []);

  // ── Start tracking ─────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (isTracking) return;
    setCameraError(null);

    const result = await startCamera(videoRef);
    if (typeof result === 'string') {
      setCameraError(result);
      return;
    }

    streamRef.current  = result;
    runningRef.current = true;
    setIsTracking(true);

    const loop = () => {
      if (!runningRef.current) return;
      processFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [isTracking, processFrame]);

  // ── Stop tracking ──────────────────────────────────────────────────────────
  const stopTracking = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    inRepRef.current     = false;
    repPosRef.current    = [];
    repTsRef.current     = [];
    smoothPosRef.current = [];
    smoothTsRef.current  = [];
    setIsTracking(false);
    setCurrentVelocity(0);
  }, []);

  // ── Manual rep entry (fallback) ────────────────────────────────────────────
  const addManualRep = useCallback((mpv) => {
    const v = parseFloat(mpv);
    if (!v || v <= 0) return;
    setRepData(prev => [...prev, { rep: prev.length + 1, mpv: v, peakVelocity: v }]);
  }, []);

  // ── Calibration ────────────────────────────────────────────────────────────
  const setCalibration = useCallback((pxPerMeter) => {
    calibPxMRef.current = pxPerMeter;
    setCalibrationPxPerMeter(Math.round(pxPerMeter));
  }, []);

  // Capture the current video frame (uses DOM canvas to avoid iOS off-screen restrictions)
  const captureFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height };
  }, []);

  // ── Reset session ──────────────────────────────────────────────────────────
  const resetSession = useCallback(() => {
    stopTracking();
    setRepData([]);
    setSessionComplete(false);
    repCountRef.current = 0;
    calibPxMRef.current = DEFAULT_PX_PER_M;
    setCalibrationPxPerMeter(DEFAULT_PX_PER_M);
  }, [stopTracking]);

  // Cleanup on unmount
  useEffect(() => () => { stopTracking(); }, [stopTracking]);

  return {
    videoRef,
    canvasRef,
    isTracking,
    sessionComplete,
    cameraError,
    currentVelocity,
    repData,
    startTracking,
    stopTracking,
    resetSession,
    addManualRep,
    setCalibration,
    captureFrame,
    calibrationPxPerMeter,
    cvReady:   true,
    cvLoading: false,
  };
}
