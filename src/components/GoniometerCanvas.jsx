import { useRef, useEffect } from 'react';

const POINT_COLORS = ['#38bdf8', '#f472b6', '#4ade80'];
const LABELS = ['A', 'B', 'C'];
const HIT_RADIUS = 36;

// Pure helpers — used both during render and inside stable event closures
function toScreen(pt, imageSize, displaySize) {
  if (!imageSize || !displaySize) return pt;
  return { x: pt.x * (displaySize.w / imageSize.w), y: pt.y * (displaySize.h / imageSize.h) };
}

function getCoords(e, svgEl) {
  const rect = svgEl.getBoundingClientRect();
  const t = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
  return { sx: t.clientX - rect.left, sy: t.clientY - rect.top };
}

function findNear(pts, sx, sy, imageSize, displaySize) {
  for (let i = 0; i < pts.length; i++) {
    const sp = toScreen(pts[i], imageSize, displaySize);
    if (Math.hypot(sx - sp.x, sy - sp.y) <= HIT_RADIUS) return i;
  }
  return -1;
}

function buildArc(screenPts, r = 28) {
  if (screenPts.length < 3) return null;
  const [A, B, C] = screenPts;
  const v1 = { x: A.x - B.x, y: A.y - B.y };
  const v2 = { x: C.x - B.x, y: C.y - B.y };
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 === 0 || m2 === 0) return null;
  const u1 = { x: v1.x / m1, y: v1.y / m1 };
  const u2 = { x: v2.x / m2, y: v2.y / m2 };
  const cross = v1.x * v2.y - v1.y * v2.x;
  const sweep = cross < 0 ? 1 : 0;
  return `M ${B.x + u1.x * r} ${B.y + u1.y * r} A ${r} ${r} 0 0 ${sweep} ${B.x + u2.x * r} ${B.y + u2.y * r}`;
}

function calcMidPt(screenPts, dist = 52) {
  if (screenPts.length < 3) return null;
  const [A, B, C] = screenPts;
  const v1 = { x: A.x - B.x, y: A.y - B.y };
  const v2 = { x: C.x - B.x, y: C.y - B.y };
  const m1 = Math.hypot(v1.x, v1.y) || 1;
  const m2 = Math.hypot(v2.x, v2.y) || 1;
  const mid = { x: v1.x / m1 + v2.x / m2, y: v1.y / m1 + v2.y / m2 };
  const midM = Math.hypot(mid.x, mid.y) || 1;
  return { x: B.x + (mid.x / midM) * dist, y: B.y + (mid.y / midM) * dist };
}

export default function GoniometerCanvas({
  points,
  angle,
  imageSize,
  displaySize,
  pointLabels,
  onTap,
  onDragPoint,
  onDragStart,
  onDragEnd,
  dragging,
  disabled,
}) {
  const svgRef = useRef(null);

  // Stable refs so the single-mount useEffect always reads current values
  const onTapRef       = useRef(onTap);
  const onDragPointRef = useRef(onDragPoint);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef   = useRef(onDragEnd);
  const disabledRef    = useRef(disabled);
  const pointsRef      = useRef(points);
  const imageSizeRef   = useRef(imageSize);
  const displaySizeRef = useRef(displaySize);

  useEffect(() => { onTapRef.current       = onTap;       }, [onTap]);
  useEffect(() => { onDragPointRef.current = onDragPoint; }, [onDragPoint]);
  useEffect(() => { onDragStartRef.current = onDragStart; }, [onDragStart]);
  useEffect(() => { onDragEndRef.current   = onDragEnd;   }, [onDragEnd]);
  useEffect(() => { disabledRef.current    = disabled;    }, [disabled]);
  useEffect(() => { pointsRef.current      = points;      }, [points]);
  useEffect(() => { imageSizeRef.current   = imageSize;   }, [imageSize]);
  useEffect(() => { displaySizeRef.current = displaySize; }, [displaySize]);

  // Synchronous drag index — avoids stale-state issues on first touchmove
  const localDragIdx = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleStart = (e) => {
      if (disabledRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const { sx, sy } = getCoords(e, svg);
      const near = findNear(pointsRef.current, sx, sy, imageSizeRef.current, displaySizeRef.current);
      if (near >= 0) {
        localDragIdx.current = near;
        onDragStartRef.current(near);
      } else if (pointsRef.current.length < 3) {
        onTapRef.current(sx, sy);
      }
    };

    const handleMove = (e) => {
      if (localDragIdx.current === null) return;
      e.preventDefault();
      e.stopPropagation();
      const { sx, sy } = getCoords(e, svg);
      onDragPointRef.current(localDragIdx.current, sx, sy);
    };

    const handleEnd = (e) => {
      if (localDragIdx.current === null) return;
      e.preventDefault();
      localDragIdx.current = null;
      onDragEndRef.current();
    };

    // { passive: false } required on iOS to call preventDefault in touchstart/touchmove
    svg.addEventListener('touchstart', handleStart, { passive: false });
    svg.addEventListener('touchmove',  handleMove,  { passive: false });
    svg.addEventListener('touchend',   handleEnd,   { passive: false });
    svg.addEventListener('mousedown',  handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup',   handleEnd);

    return () => {
      svg.removeEventListener('touchstart', handleStart);
      svg.removeEventListener('touchmove',  handleMove);
      svg.removeEventListener('touchend',   handleEnd);
      svg.removeEventListener('mousedown',  handleStart);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup',   handleEnd);
    };
  }, []); // stable — all values accessed via refs

  const screenPts = points.map(p => toScreen(p, imageSize, displaySize));
  const arcPath   = buildArc(screenPts);
  const midPt     = calcMidPt(screenPts);
  const labels    = pointLabels?.length >= 3 ? pointLabels : null;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        touchAction: 'none',
        userSelect: 'none',
        cursor: disabled ? 'default' : points.length >= 3 ? 'grab' : 'crosshair',
        opacity: disabled ? 0 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {screenPts.length >= 2 && (
        <line x1={screenPts[0].x} y1={screenPts[0].y}
              x2={screenPts[1].x} y2={screenPts[1].y}
          stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="6 4" />
      )}
      {screenPts.length === 3 && (
        <line x1={screenPts[1].x} y1={screenPts[1].y}
              x2={screenPts[2].x} y2={screenPts[2].y}
          stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="6 4" />
      )}

      {arcPath && (
        <path d={arcPath} fill="none" stroke="#facc15" strokeWidth="2.5" />
      )}

      {angle != null && midPt && (
        <>
          <rect x={midPt.x - 22} y={midPt.y - 12} width={44} height={22}
            rx={6} fill="rgba(0,0,0,0.65)" />
          <text x={midPt.x} y={midPt.y + 5} textAnchor="middle"
            fill="#facc15" fontSize="13" fontWeight="bold">
            {angle}°
          </text>
        </>
      )}

      {screenPts.map((sp, i) => (
        <g key={i}>
          {/* Touch-target zone */}
          <circle cx={sp.x} cy={sp.y} r={22} fill="rgba(255,255,255,0.08)" />
          {/* Shadow backing */}
          <circle cx={sp.x} cy={sp.y} r={14} fill="rgba(15,23,42,0.7)" />
          {/* Coloured point */}
          <circle cx={sp.x} cy={sp.y} r={12}
            fill={POINT_COLORS[i]}
            stroke="white"
            strokeWidth={dragging === i ? 3 : 2}
          />
          <text x={sp.x} y={sp.y + 5} textAnchor="middle"
            fill="white" fontSize="11" fontWeight="bold">
            {labels ? labels[i][0] : LABELS[i]}
          </text>
        </g>
      ))}
    </svg>
  );
}
