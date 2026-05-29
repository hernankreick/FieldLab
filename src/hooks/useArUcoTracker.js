import { useRef, useState, useCallback, useEffect } from 'react';
import { calcMPV, calcPeakVelocity } from '../utils/vbtCalculations';

const MARKER_SIZE_M = 0.08;  // physical side of printed ArUco marker in metres
const VEL_THRESHOLD = 0.1;   // m/s — velocity gate for rep start / end
const SMOOTH_N      = 4;     // frames used for velocity smoothing

const loadOpenCV = () => new Promise((resolve, reject) => {
  if (window.cv && window.cv.Mat) return resolve(window.cv);
  const script = document.createElement('script');
  script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
  script.async = true;
  const timer = setTimeout(() => reject(new Error('timeout')), 10000);
  script.onload = () => {
    clearTimeout(timer);
    const wait = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(wait);
        resolve(window.cv);
      }
    }, 100);
  };
  script.onerror = () => { clearTimeout(timer); reject(new Error('load error')); };
  document.head.appendChild(script);
});

// Resolve the detection function across OpenCV.js API versions
function resolveDetectFn(cv) {
  if (typeof cv.ArucoDetector === 'function') return null;         // new API — use instance
  if (typeof cv.detectMarkers === 'function') return cv.detectMarkers.bind(cv);
  if (typeof cv.aruco_detectMarkers === 'function') return cv.aruco_detectMarkers.bind(cv);
  return null;
}

// Resolve the dictionary constructor across OpenCV.js API versions
function buildDictionary(cv) {
  const id = cv.DICT_4X4_50 ?? 0;
  if (typeof cv.getPredefinedDictionary === 'function') return cv.getPredefinedDictionary(id);
  if (cv.aruco?.getPredefinedDictionary) return cv.aruco.getPredefinedDictionary(id);
  throw new Error('ArUco dictionary API not found — ensure OpenCV build includes aruco contrib');
}

export function useArUcoTracker() {
  // DOM / stream refs
  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const rafRef       = useRef(null);
  const offscreenRef = useRef(null);
  const runningRef   = useRef(false);

  // OpenCV refs (initialised once)
  const cvRef         = useRef(null);
  const dictRef       = useRef(null);
  const paramsRef     = useRef(null);
  const detectorRef   = useRef(null); // ArucoDetector instance for new API
  const detectFnRef   = useRef(null); // bound detectMarkers for old API

  // Calibration
  const calibPxMRef         = useRef(0);
  const lastDisplayCalibRef = useRef(0); // tracks last rounded value pushed to state

  // Rep tracking — all in refs to avoid per-frame re-renders
  const inRepRef     = useRef(false);
  const repPosRef    = useRef([]);
  const repTsRef     = useRef([]);
  const smoothPosRef = useRef([]);
  const smoothTsRef  = useRef([]);

  const [cvReady,               setCvReady]               = useState(false);
  const [cvLoading,             setCvLoading]             = useState(true);
  const [statusMsg,             setStatusMsg]             = useState('');
  const [isTracking,            setIsTracking]            = useState(false);
  const [currentVelocity,       setCurrentVelocity]       = useState(0);
  const [calibrationPxPerMeter, setCalibrationPxPerMeter] = useState(0);
  const [repData,               setRepData]               = useState([]);

  // ── Load OpenCV.js and initialise ArUco resources ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadOpenCV()
      .then(cv => {
        if (cancelled) return;
        cvRef.current = cv;

        const dict   = buildDictionary(cv);
        const params = new cv.DetectorParameters();
        dictRef.current   = dict;
        paramsRef.current = params;

        if (typeof cv.ArucoDetector === 'function') {
          detectorRef.current = new cv.ArucoDetector(dict, params);
        } else {
          const fn = resolveDetectFn(cv);
          if (!fn) throw new Error('No ArUco detection function found in this OpenCV build');
          detectFnRef.current = fn;
        }
        setCvReady(true);
        setStatusMsg('Motor listo ✓');
        setCvLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setCvReady(false);
          setStatusMsg('Modo manual');
          setCvLoading(false);
        }
      });
    return () => {
      cancelled = true;
      // Free C++ heap objects allocated in the WASM module
      try { detectorRef.current?.delete?.(); } catch {}
      try { paramsRef.current?.delete?.();  } catch {}
      try { dictRef.current?.delete?.();    } catch {}
      detectorRef.current = null;
      paramsRef.current   = null;
      dictRef.current     = null;
    };
  }, []);

  // ── Single-frame processing ────────────────────────────────────────────────
  const processFrame = useCallback(() => {
    const cv    = cvRef.current;
    const video = videoRef.current;
    if (!cv || !video || video.readyState < 2) return;

    // Draw current video frame to offscreen canvas for cv.imread
    const canvas = offscreenRef.current;
    if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    let src, gray, corners, ids, rejected;
    try {
      src      = cv.imread(canvas);
      gray     = new cv.Mat();
      corners  = new cv.MatVector();
      ids      = new cv.Mat();
      rejected = new cv.MatVector();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      if (detectorRef.current) {
        // New API (4.7.0+)
        detectorRef.current.detectMarkers(gray, corners, ids);
      } else {
        // Old API (4.5.x)
        detectFnRef.current(gray, dictRef.current, corners, ids, paramsRef.current, rejected);
      }

      if (ids.rows > 0) {
        const corner = corners.get(0);
        const d      = corner.data32F; // flat [x0,y0, x1,y1, x2,y2, x3,y3]
        corner.delete();
        // Guard against non-standard OpenCV builds that return a different typed array
        if (!d || d.length < 8) return;
        // Centroid Y of the four corners
        const cy = (d[1] + d[3] + d[5] + d[7]) / 4;
        // Width from top-left to top-right corner (used for px/m calibration)
        const wPx = Math.hypot(d[2] - d[0], d[3] - d[1]);

        if (wPx > 4) {
          const pxPerM     = wPx / MARKER_SIZE_M;
          calibPxMRef.current = pxPerM;
          // Only update React state when rounded value changes — avoids 60fps re-renders
          const displayVal = Math.round(pxPerM);
          if (displayVal !== lastDisplayCalibRef.current) {
            lastDisplayCalibRef.current = displayVal;
            setCalibrationPxPerMeter(displayVal);
          }
        }

        if (calibPxMRef.current > 0) {
          // Negate so that upward movement (decreasing Y in image space) = positive position
          const posM = -(cy / calibPxMRef.current);
          const now  = performance.now();

          // Update smoothing window
          smoothPosRef.current.push(posM);
          smoothTsRef.current.push(now);
          if (smoothPosRef.current.length > SMOOTH_N) {
            smoothPosRef.current.shift();
            smoothTsRef.current.shift();
          }

          // Velocity over the smoothing window
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
            // Rep started
            inRepRef.current = true;
            repPosRef.current = [posM];
            repTsRef.current  = [now];
          } else if (inRepRef.current) {
            repPosRef.current.push(posM);
            repTsRef.current.push(now);
            if (speed < VEL_THRESHOLD) {
              // Rep completed — compute metrics and save
              inRepRef.current = false;
              const positions  = repPosRef.current.slice();
              const timestamps = repTsRef.current.slice();
              const mpv        = calcMPV(positions, timestamps);
              const peakVelocity = calcPeakVelocity(positions, timestamps);
              repPosRef.current = [];
              repTsRef.current  = [];
              if (mpv > 0) {
                // Store only computed metrics — omit raw arrays to keep state lean
                setRepData(prev => [
                  ...prev,
                  { rep: prev.length + 1, mpv, peakVelocity },
                ]);
              }
            }
          }
        }
      }
    } catch (err) { console.error('[ArUco] frame error:', err); } finally {
      src?.delete();
      gray?.delete();
      corners?.delete();
      ids?.delete();
      rejected?.delete();
    }
  }, []);

  // ── Start tracking ─────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (!cvReady || isTracking) return;
    let stream = null;
    try {
      offscreenRef.current = document.createElement('canvas');
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      const video = videoRef.current;
      // Guard: component may have unmounted during the async permission dialog
      if (!video) throw new Error('Video element unmounted before stream could attach');
      video.srcObject  = stream;
      await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = rej; });
      await video.play();
      streamRef.current  = stream;
      runningRef.current = true;
      setIsTracking(true);

      const loop = () => {
        if (!runningRef.current) return;
        processFrame();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      // Always release the stream if we acquired one but failed to attach it
      stream?.getTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      console.error('[useArUcoTracker] camera error:', err.message);
    }
  }, [cvReady, isTracking, processFrame]);

  // ── Stop tracking ──────────────────────────────────────────────────────────
  const stopTracking = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    inRepRef.current      = false;
    repPosRef.current     = [];
    repTsRef.current      = [];
    smoothPosRef.current  = [];
    smoothTsRef.current   = [];
    setIsTracking(false);
    setCurrentVelocity(0);
  }, []);

  // ── Manual rep entry (fallback when OpenCV is unavailable) ────────────────
  const addManualRep = useCallback((mpv) => {
    const v = parseFloat(mpv);
    if (!v || v <= 0) return;
    setRepData(prev => [...prev, { rep: prev.length + 1, mpv: v, peakVelocity: v }]);
  }, []);

  // ── Reset session ──────────────────────────────────────────────────────────
  const resetSession = useCallback(() => {
    stopTracking();
    setRepData([]);
    calibPxMRef.current         = 0;
    lastDisplayCalibRef.current = 0;
    setCalibrationPxPerMeter(0);
  }, [stopTracking]);

  // Cleanup on unmount
  useEffect(() => () => { stopTracking(); }, [stopTracking]);

  return {
    videoRef,
    isTracking,
    currentVelocity,
    repData,
    startTracking,
    stopTracking,
    resetSession,
    addManualRep,
    calibrationPxPerMeter,
    cvReady,
    cvLoading,
    statusMsg,
  };
}
