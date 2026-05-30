const MIN_HIP_CONFIDENCE = 0.65;
const DEBOUNCE_MS = 300;
const HISTORY_MAX = 10;

// Returns {x, y, confidence} in normalized [0,1] coords, or null if below threshold.
// Uses MediaPipe landmarks 23 (left hip) and 24 (right hip).
export function calcCentroid(landmarks) {
  if (!landmarks || landmarks.length < 25) return null;
  const hipL = landmarks[23];
  const hipR = landmarks[24];
  if (!hipL || !hipR) return null;
  const confL = hipL.visibility ?? 0;
  const confR = hipR.visibility ?? 0;
  if (confL < MIN_HIP_CONFIDENCE || confR < MIN_HIP_CONFIDENCE) return null;
  return {
    x: (hipL.x + hipR.x) / 2,
    y: (hipL.y + hipR.y) / 2,
    confidence: Math.min(confL, confR),
  };
}

// Edge-detection line crossing: returns true only on the frame where centroid
// transitions from one side of lineX to the other in the specified direction.
// direction: 'ltr' = left-to-right,  'rtl' = right-to-left
export function didCrossLine(prevX, currX, lineX, direction) {
  if (prevX === null || prevX === undefined) return false;
  if (currX === null || currX === undefined) return false;
  if (direction === 'ltr') return prevX < lineX && currX >= lineX;
  if (direction === 'rtl') return prevX > lineX && currX <= lineX;
  return false;
}

// Returns the net horizontal displacement over the last N frames in history.
// Positive = moving right (ltr), negative = moving left (rtl), 0 = no data.
export function calcMovementDirection(history) {
  if (!history || history.length < 2) return 0;
  const n = Math.min(history.length, 6);
  const recent = history.slice(-n);
  return recent[recent.length - 1].x - recent[0].x;
}

// Pushes a new point into history and trims to HISTORY_MAX length in place.
export function pushHistory(history, x) {
  history.push({ x });
  if (history.length > HISTORY_MAX) history.shift();
}

// Returns true if the last crossing happened less than DEBOUNCE_MS ago.
export function isDebounced(lastCrossingTime, now) {
  if (lastCrossingTime === null || lastCrossingTime === undefined) return false;
  return now - lastCrossingTime < DEBOUNCE_MS;
}

// Compute the actual pixel region of the video inside an object-fit:contain container.
// Returns { x, y, w, h } where (x,y) is top-left offset and (w,h) is displayed size.
export function calcVideoRegion(videoNativeW, videoNativeH, containerW, containerH) {
  if (!videoNativeW || !videoNativeH || !containerW || !containerH) {
    return { x: 0, y: 0, w: containerW || 0, h: containerH || 0 };
  }
  const vAspect = videoNativeW / videoNativeH;
  const cAspect = containerW / containerH;
  if (vAspect > cAspect) {
    const h = containerW / vAspect;
    return { x: 0, y: (containerH - h) / 2, w: containerW, h };
  } else {
    const w = containerH * vAspect;
    return { x: (containerW - w) / 2, y: 0, w, h: containerH };
  }
}

// Convert normalized landmark coordinate to canvas pixel using the video region.
export function normToCanvas(normX, normY, region) {
  return {
    x: region.x + normX * region.w,
    y: region.y + normY * region.h,
  };
}

// Convert canvas pixel X to normalized line position within the video region.
// Clamps to [0.02, 0.98] to keep lines visible.
export function canvasToNorm(canvasX, region) {
  if (region.w === 0) return 0.5;
  return Math.max(0.02, Math.min(0.98, (canvasX - region.x) / region.w));
}
