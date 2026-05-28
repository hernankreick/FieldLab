import { useState, useCallback, useRef } from 'react';

export function calcAngle(A, B, C) {
  return calcAngleAtVertex(B, A, C);
}

export function calcAngleAtVertex(vertex, armB, armC) {
  const v1 = { x: armB.x - vertex.x, y: armB.y - vertex.y };
  const v2 = { x: armC.x - vertex.x, y: armC.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round(Math.acos(cos) * (180 / Math.PI));
}

export function calcAngleFromVertical(A, B) {
  const vx = B.x - A.x;
  const vy = B.y - A.y;
  const mag = Math.sqrt(vx * vx + vy * vy);
  if (mag === 0) return 0;
  // Compare A→B against vertical UP (0,-1) — y increases downward in screen coords,
  // so a tibia pointing straight up has vy<0, giving cos=1 and angle=0°.
  const cos = Math.min(1, Math.max(-1, -vy / mag));
  return Math.round(Math.acos(cos) * (180 / Math.PI));
}

export function useGoniometer({ pointCount = 3, vertexIndex = 1, autoVertical = false } = {}) {
  const [points, setPoints] = useState([]);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const draggingIdxRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const effectivePointCount = autoVertical ? 2 : pointCount;

  const imageToScreen = useCallback((pt) => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return pt;
    const cr = container.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const offX = ir.left - cr.left;
    const offY = ir.top - cr.top;
    return {
      x: pt.x * (ir.width / (img.naturalWidth || ir.width)) + offX,
      y: pt.y * (ir.height / (img.naturalHeight || ir.height)) + offY,
    };
  }, []);

  const screenToImage = useCallback((screenX, screenY) => {
    const img = imageRef.current;
    const container = containerRef.current;
    if (!img || !container) return { x: screenX, y: screenY };
    const cr = container.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    const offX = ir.left - cr.left;
    const offY = ir.top - cr.top;
    const scaleX = (img.naturalWidth || ir.width) / ir.width;
    const scaleY = (img.naturalHeight || ir.height) / ir.height;
    return {
      x: (screenX - offX) * scaleX,
      y: (screenY - offY) * scaleY,
    };
  }, []);

  const addOrMovePoint = useCallback((screenX, screenY) => {
    const imgPt = screenToImage(screenX, screenY);
    setPoints(prev => {
      if (prev.length < effectivePointCount) {
        return [...prev, imgPt];
      }
      return prev;
    });
  }, [screenToImage, effectivePointCount]);

  const startDrag = useCallback((idx) => {
    draggingIdxRef.current = idx;
    setDraggingIdx(idx);
  }, []);

  const onDragMove = useCallback((screenX, screenY) => {
    const idx = draggingIdxRef.current;
    if (idx === null) return;
    const imgPt = screenToImage(screenX, screenY);
    setPoints(prev => {
      const next = [...prev];
      next[idx] = imgPt;
      return next;
    });
  }, [screenToImage]);

  const endDrag = useCallback(() => {
    draggingIdxRef.current = null;
    setDraggingIdx(null);
  }, []);

  const reset = useCallback(() => {
    draggingIdxRef.current = null;
    setPoints([]);
    setDraggingIdx(null);
  }, []);

  const arms = [0, 1, 2].filter(i => i !== vertexIndex);
  const angle = autoVertical && points.length === 2
    ? calcAngleFromVertical(points[0], points[1])
    : !autoVertical && points.length === pointCount
      ? calcAngleAtVertex(points[vertexIndex], points[arms[0]], points[arms[1]])
      : null;

  return {
    points,
    angle,
    draggingIdx,
    imageRef,
    containerRef,
    imageToScreen,
    addOrMovePoint,
    startDrag,
    onDragMove,
    endDrag,
    reset,
    isFull: points.length >= effectivePointCount,
  };
}
