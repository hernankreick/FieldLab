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

export default function GoniometerCanvas({
  points,
  angle,
  imageSize,
  displaySize,
  pointLabels,
  vertexIndex = 1,
  angleColor = '#facc15',
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
      {screenPts.length === 2 && (
        <line x1={screenPts[0].x} y1={screenPts[0].y}
              x2={screenPts[1].x} y2={screenPts[1].y}
          stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="6 4" />
      )}
      {screenPts.length === 3 && [0, 1, 2].filter(i => i !== vertexIndex).map(i => (
        <line key={i}
          x1={screenPts[vertexIndex].x} y1={screenPts[vertexIndex].y}
          x2={screenPts[i].x} y2={screenPts[i].y}
          stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="6 4" />
      ))}

      {screenPts.length === 3 && angle != null && (() => {
        const V    = screenPts[vertexIndex];
        const arms = [0, 1, 2].filter(i => i !== vertexIndex);
        const P1   = screenPts[arms[0]];
        const P2   = screenPts[arms[1]];
        const r    = 40;
        const ang1 = Math.atan2(P1.y - V.y, P1.x - V.x);
        const ang2 = Math.atan2(P2.y - V.y, P2.x - V.x);
        const x1   = V.x + r * Math.cos(ang1);
        const y1   = V.y + r * Math.sin(ang1);
        const x2   = V.x + r * Math.cos(ang2);
        const y2   = V.y + r * Math.sin(ang2);
        const cross = (P1.x - V.x) * (P2.y - V.y) - (P1.y - V.y) * (P2.x - V.x);
        const sweep = cross > 0 ? 1 : 0;
        return (
          <g>
            <path d={`M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`}
              fill="none" stroke={angleColor} strokeWidth="2.5" opacity="0.8" />
            <rect x={V.x + 14} y={V.y - 30} width="68" height="26" rx="6"
              fill="rgba(15,23,42,0.88)" />
            <text x={V.x + 48} y={V.y - 12} textAnchor="middle"
              fill={angleColor} fontSize="15" fontWeight="bold"
              fontFamily="'JetBrains Mono', monospace">
              {angle}°
            </text>
          </g>
        );
      })()}

      {screenPts.map((sp, i) => (
        <g key={i}>
          {/* Touch-target zone */}
          <circle cx={sp.x} cy={sp.y} r={22} fill="rgba(255,255,255,0.08)" />
          {/* Dashed ring marks the vertex */}
          {i === vertexIndex && (
            <circle cx={sp.x} cy={sp.y} r={18}
              fill="none" stroke={POINT_COLORS[i]}
              strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
          )}
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
