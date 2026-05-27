import { useCallback, useEffect, useRef } from 'react';

const POINT_RADIUS = 18;
const COLORS = ['#38bdf8', '#f472b6', '#4ade80'];
const LABELS = ['A', 'B', 'C'];

function getEventCoords(e, container) {
  const cr = container.getBoundingClientRect();
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX - cr.left, y: e.touches[0].clientY - cr.top };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX - cr.left, y: e.changedTouches[0].clientY - cr.top };
  }
  return { x: e.clientX - cr.left, y: e.clientY - cr.top };
}

function hitTest(screenPts, sx, sy) {
  for (let i = screenPts.length - 1; i >= 0; i--) {
    const dx = screenPts[i].x - sx;
    const dy = screenPts[i].y - sy;
    if (Math.hypot(dx, dy) <= POINT_RADIUS + 4) return i;
  }
  return -1;
}

export default function GoniometerCanvas({
  imageSrc,
  points,
  angle,
  isFull,
  imageRef,
  containerRef,
  imageToScreen,
  addOrMovePoint,
  startDrag,
  onDragMove,
  endDrag,
  draggingIdx,
}) {
  const svgRef = useRef(null);
  const isDragging = useRef(false);

  const screenPts = points.map(imageToScreen);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const { x, y } = getEventCoords(e, container);
    const hit = hitTest(screenPts, x, y);
    if (hit >= 0) {
      isDragging.current = true;
      startDrag(hit);
    } else if (!isFull) {
      addOrMovePoint(x, y);
    }
  }, [screenPts, isFull, startDrag, addOrMovePoint, containerRef]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const { x, y } = getEventCoords(e, container);
    onDragMove(x, y);
  }, [onDragMove, containerRef]);

  const onPointerUp = useCallback((e) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    endDrag();
  }, [endDrag]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('touchstart', onPointerDown, { passive: false });
    svg.addEventListener('touchmove', onPointerMove, { passive: false });
    svg.addEventListener('touchend', onPointerUp, { passive: false });
    svg.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    return () => {
      svg.removeEventListener('touchstart', onPointerDown);
      svg.removeEventListener('touchmove', onPointerMove);
      svg.removeEventListener('touchend', onPointerUp);
      svg.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
    };
  }, [onPointerDown, onPointerMove, onPointerUp]);

  function buildArc(pts, r = 28) {
    if (pts.length < 3) return null;
    const [A, B, C] = pts;
    const v1 = { x: A.x - B.x, y: A.y - B.y };
    const v2 = { x: C.x - B.x, y: C.y - B.y };
    const m1 = Math.hypot(v1.x, v1.y);
    const m2 = Math.hypot(v2.x, v2.y);
    if (m1 === 0 || m2 === 0) return null;
    const u1 = { x: v1.x / m1, y: v1.y / m1 };
    const u2 = { x: v2.x / m2, y: v2.y / m2 };
    const startX = B.x + u1.x * r;
    const startY = B.y + u1.y * r;
    const endX = B.x + u2.x * r;
    const endY = B.y + u2.y * r;
    const cross = v1.x * v2.y - v1.y * v2.x;
    const sweep = cross < 0 ? 1 : 0;
    return `M ${startX} ${startY} A ${r} ${r} 0 0 ${sweep} ${endX} ${endY}`;
  }

  const arcPath = buildArc(screenPts);
  const midPt = screenPts.length === 3 ? (() => {
    const [A, B, C] = screenPts;
    const v1 = { x: A.x - B.x, y: A.y - B.y };
    const v2 = { x: C.x - B.x, y: C.y - B.y };
    const m1 = Math.hypot(v1.x, v1.y) || 1;
    const m2 = Math.hypot(v2.x, v2.y) || 1;
    const mid = { x: v1.x / m1 + v2.x / m2, y: v1.y / m1 + v2.y / m2 };
    const midM = Math.hypot(mid.x, mid.y) || 1;
    const dist = 52;
    return { x: B.x + (mid.x / midM) * dist, y: B.y + (mid.y / midM) * dist };
  })() : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full select-none"
      style={{ touchAction: 'none' }}
    >
      <img
        ref={imageRef}
        src={imageSrc}
        alt="Captura"
        className="w-full object-contain rounded-xl"
        draggable={false}
        style={{ display: 'block', userSelect: 'none' }}
      />
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: isFull ? 'grab' : 'crosshair' }}
      >
        {/* Lines connecting points */}
        {screenPts.length >= 2 && (
          <line
            x1={screenPts[0].x} y1={screenPts[0].y}
            x2={screenPts[1].x} y2={screenPts[1].y}
            stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="6 4"
          />
        )}
        {screenPts.length === 3 && (
          <line
            x1={screenPts[1].x} y1={screenPts[1].y}
            x2={screenPts[2].x} y2={screenPts[2].y}
            stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeDasharray="6 4"
          />
        )}

        {/* Arc */}
        {arcPath && (
          <path
            d={arcPath}
            fill="none"
            stroke="#facc15"
            strokeWidth="2.5"
          />
        )}

        {/* Angle label */}
        {angle != null && midPt && (
          <>
            <rect
              x={midPt.x - 22} y={midPt.y - 12}
              width={44} height={22}
              rx={6} fill="rgba(0,0,0,0.65)"
            />
            <text
              x={midPt.x} y={midPt.y + 5}
              textAnchor="middle"
              fill="#facc15"
              fontSize="13"
              fontWeight="bold"
            >
              {angle}°
            </text>
          </>
        )}

        {/* Points */}
        {screenPts.map((pt, i) => (
          <g key={i}>
            <circle
              cx={pt.x} cy={pt.y}
              r={POINT_RADIUS}
              fill={COLORS[i] + '33'}
              stroke={COLORS[i]}
              strokeWidth={draggingIdx === i ? 3 : 2}
            />
            <text
              x={pt.x} y={pt.y + 5}
              textAnchor="middle"
              fill={COLORS[i]}
              fontSize="13"
              fontWeight="bold"
            >
              {LABELS[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
