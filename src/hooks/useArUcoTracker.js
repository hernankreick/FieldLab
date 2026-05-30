import { useRef, useState, useCallback, useEffect } from 'react';
import { calcMPV, calcPeakVelocity } from '../utils/vbtCalculations';

const VEL_THRESHOLD        = 0.15;   // m/s — min speed to start/end a rep
const SMOOTH_N             = 5;      // frames for position moving average (smoothY)
const VEL_WINDOW           = 3;      // frames for velocity derivation
const DEFAULT_PX_PER_M     = 200;
const MIN_BLOB_AREA        = 400;    // px² — ignore tiny noise blobs
const MAX_BLOB_AREA        = 40000;  // px² — ignore blobs that fill the frame
const MAX_VELOCITY         = 3.0;   // m/s — physical ceiling; higher = noise spike
const MAX_CENTROID_JUMP_PX = 80;    // px — max cy shift between consecutive frames
const MIN_REP_MS           = 300;   // ms — shorter = false positive
const MAX_REP_MS           = 4000;  // ms — longer = false positive
const MIN_PAUSE_MS         = 500;   // ms — dead zone between reps
const SCAN_STRIDE          = 4;

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

// Returns centroid {cx, cy} of orange/red blob that passes area thresholds, or null.
function detectColorBlob(imageData) {
  const { data, width, height } = imageData;
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < height; y += SCAN_STRIDE) {
    for (let x = 0; x < width; x += SCAN_STRIDE) {
      const i = (y * width + x) * 4;
      const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      // Orange/red tape: H in [0,30]° or wrap-around [330,360°], well-saturated, mid-luminance
      if ((h <= 30 || h >= 330) && s > 60 && l >= 40 && l <= 70) {
        sumX += x; sumY += y; count++;
      }
    }
  }
  // Each sampled pixel represents SCAN_STRIDE² actual pixels
  const area = count * SCAN_STRIDE * SCAN_STRIDE;
  if (area < MIN_BLOB_AREA || area > MAX_BLOB_AREA) return null;
  return { cx: sumX / count, cy: sumY / count };
}

// iOS Safari: playsinline + muted + explicit play() required.
// Returns MediaStream on success, or error string on failure.
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
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const streamRef        = useRef(null);
  const rafRef           = useRef(null);
  const runningRef       = useRef(false);
  const cameraReadyRef   = useRef(false);

  const calibPxMRef      = useRef(DEFAULT_PX_PER_M);

  // Rep state
  const inRepRef         = useRef(false);
  const repPosRef        = useRef([]);
  const repTsRef         = useRef([]);
  const repCountRef      = useRef(0);
  const repStartTsRef    = useRef(null);   // when current rep started
  const lastRepEndTsRef  = useRef(null);   // when last rep ended (pause guard)

  // Smoothing
  const positionBufferRef = useRef([]);    // last SMOOTH_N raw cy px values → smoothY
  const smoothPosRef      = useRef([]);    // last VEL_WINDOW smoothed posM values
  const smoothTsRef       = useRef([]);    // timestamps for velocity window

  // Centroid stability
  const prevCyRef         = useRef(null);  // previous frame's cy for jump detection

  // Blob indicator
  const blobDetectedRef   = useRef(false);

  const [isCameraReady,         setIsCameraReady]         = useState(false);
  const [isTracking,            setIsTracking]            = useState(false);
  const [sessionComplete,       setSessionComplete]       = useState(false);
  const [cameraError,           setCameraError]           = useState(null);
  const [currentVelocity,       setCurrentVelocity]       = useState(0);
  const [calibrationPxPerMeter, setCalibrationPxPerMeter] = useState(DEFAULT_PX_PER_M);
  const [repData,               setRepData]               = useState([]);
  const [blobDetected,          setBlobDetected]          = useState(false);

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
      positionBufferRef.current = [];
      smoothPosRef.current      = [];
      smoothTsRef.current       = [];
      prevCyRef.current         = null;
      if (blobDetectedRef.current) { blobDetectedRef.current = false; setBlobDetected(false); }
      return;
    }

    // Centroid jump check — discard frames where the blob teleports
    const prevCy = prevCyRef.current;
    prevCyRef.current = blob.cy;
    if (prevCy !== null && Math.abs(blob.cy - prevCy) > MAX_CENTROID_JUMP_PX) {
      positionBufferRef.current = [];
      smoothPosRef.current      = [];
      smoothTsRef.current       = [];
      if (blobDetectedRef.current) { blobDetectedRef.current = false; setBlobDetected(false); }
      return;
    }

    if (!blobDetectedRef.current) { blobDetectedRef.current = true; setBlobDetected(true); }

    // Position smoothing: 5-frame moving average on raw cy pixel values
    const cyBuf = positionBufferRef.current;
    cyBuf.push(blob.cy);
    if (cyBuf.length > SMOOTH_N) cyBuf.shift();
    const smoothY = cyBuf.reduce((a, b) => a + b, 0) / cyBuf.length;

    const pxPerM = calibPxMRef.current;
    // Negate: upward movement (decreasing Y in image) = positive position
    const posM = -(smoothY / pxPerM);
    const now  = performance.now();

    // Velocity derivation: 3-frame window on smoothed positions
    smoothPosRef.current.push(posM);
    smoothTsRef.current.push(now);
    if (smoothPosRef.current.length > VEL_WINDOW) {
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

    // Velocity spike filter — physical ceiling
    if (Math.abs(vel) > MAX_VELOCITY) return;

    setCurrentVelocity(vel);

    const speed = Math.abs(vel);

    if (!inRepRef.current && speed > VEL_THRESHOLD) {
      // Enforce minimum rest pause between reps
      if (lastRepEndTsRef.current !== null && now - lastRepEndTsRef.current < MIN_PAUSE_MS) return;
      inRepRef.current      = true;
      repStartTsRef.current = now;
      repPosRef.current     = [posM];
      repTsRef.current      = [now];
    } else if (inRepRef.current) {
      repPosRef.current.push(posM);
      repTsRef.current.push(now);
      if (speed < VEL_THRESHOLD) {
        inRepRef.current = false;
        const repDuration = now - (repStartTsRef.current ?? now);
        lastRepEndTsRef.current = now;

        // Discard reps that are too short (noise) or too long (static hold)
        if (repDuration < MIN_REP_MS || repDuration > MAX_REP_MS) {
          repPosRef.current = [];
          repTsRef.current  = [];
          return;
        }

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
            // Inline stop — safe to call from within the rAF callback
            runningRef.current    = false;
            cameraReadyRef.current = false;
            streamRef.current?.getTracks().forEach(t => t.stop());
            streamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
            inRepRef.current          = false;
            repPosRef.current         = [];
            repTsRef.current          = [];
            positionBufferRef.current = [];
            smoothPosRef.current      = [];
            smoothTsRef.current       = [];
            prevCyRef.current         = null;
            repStartTsRef.current     = null;
            lastRepEndTsRef.current   = null;
            blobDetectedRef.current   = false;
            setBlobDetected(false);
            setIsCameraReady(false);
            setIsTracking(false);
            setCurrentVelocity(0);
            setSessionComplete(true);
          }
        }
      }
    }
  }, []);

  // ── Open camera only — stream assigned, rAF loop not started ──────────────
  const openCamera = useCallback(async () => {
    setCameraError(null);
    const result = await startCamera(videoRef);
    if (typeof result === 'string') {
      setCameraError(result);
      return result;
    }
    streamRef.current      = result;
    cameraReadyRef.current = true;
    setIsCameraReady(true);
    return null;
  }, []);

  // ── Begin velocity tracking — starts rAF loop (camera must already be open) ─
  const beginTracking = useCallback(() => {
    if (!cameraReadyRef.current) return;
    runningRef.current = true;
    setIsTracking(true);
    const loop = () => {
      if (!runningRef.current) return;
      processFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [processFrame]);

  // ── Stop tracking + close camera ───────────────────────────────────────────
  const stopTracking = useCallback(() => {
    runningRef.current     = false;
    cameraReadyRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    inRepRef.current          = false;
    repPosRef.current         = [];
    repTsRef.current          = [];
    positionBufferRef.current = [];
    smoothPosRef.current      = [];
    smoothTsRef.current       = [];
    prevCyRef.current         = null;
    repStartTsRef.current     = null;
    lastRepEndTsRef.current   = null;
    blobDetectedRef.current   = false;
    setBlobDetected(false);
    setIsCameraReady(false);
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

  // ── Capture current video frame (DOM canvas — safe on iOS) ────────────────
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
    isCameraReady,
    isTracking,
    sessionComplete,
    cameraError,
    currentVelocity,
    repData,
    blobDetected,
    openCamera,
    beginTracking,
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
