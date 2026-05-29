import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Camera, Upload, RotateCcw, CheckCircle, Ruler } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAthletes, saveAthlete, saveMobilityAssessment } from '../../utils/storage';
import MobilityHistory from './MobilityHistory';

// ── Joint / movement configuration ────────────────────────────────────────────
const JOINT_CONFIG = {
  cadera: {
    label: 'Cadera',
    movements: {
      rotacion_interna: {
        label: 'Rotación Interna',
        optimo: 37,
        instruction: 'Atleta en decúbito prono, rodilla 90°. Tocá: 1) Referencia fija (cadera/muslo) → 2) Vértice (rodilla) → 3) Tibia/tobillo',
      },
      rotacion_externa: {
        label: 'Rotación Externa',
        optimo: 42,
        instruction: 'Atleta en decúbito prono, rodilla 90°. Tocá: 1) Referencia fija (muslo distal) → 2) Vértice (rodilla) → 3) Maléolo/tobillo (pierna rotada externamente)',
      },
      flexion: {
        label: 'Flexión',
        optimo: 105,
        instruction: 'Atleta en decúbito supino. Tocá: 1) EIAS (cresta ilíaca anterior) → 2) Vértice (cadera/trocánter mayor) → 3) Cóndilo lateral (rodilla)',
      },
      extension: {
        label: 'Extensión',
        optimo: 15,
        instruction: 'Atleta en decúbito prono. Tocá: 1) EIPS (espina ilíaca postero-superior) → 2) Vértice (cadera/trocánter mayor) → 3) Cóndilo lateral (rodilla)',
      },
      abduccion: {
        label: 'Abducción',
        optimo: 37,
        instruction: 'Atleta en decúbito supino, pierna extendida. Tocá: 1) EIAS (cresta ilíaca) → 2) Vértice (cadera/ingle) → 3) Rótula (rodilla)',
      },
      adduccion: {
        label: 'Aducción',
        optimo: 25,
        instruction: 'Atleta en decúbito supino. Tocá: 1) EIAS (cresta ilíaca) → 2) Vértice (cadera/ingle) → 3) Rótula (rodilla, pierna cruzando línea media)',
      },
    },
  },
  hombro: {
    label: 'Hombro',
    movements: {
      flexion: {
        label: 'Flexión',
        optimo: 165,
        instruction: 'Vista lateral. Tocá: 1) Línea media del tronco (referencia) → 2) Vértice (acromion) → 3) Epicóndilo lateral (codo)',
      },
      extension: {
        label: 'Extensión',
        optimo: 50,
        instruction: 'Vista lateral. Tocá: 1) Línea media del tronco (referencia) → 2) Vértice (acromion) → 3) Epicóndilo lateral (codo, brazo detrás)',
      },
      abduccion: {
        label: 'Abducción',
        optimo: 165,
        instruction: 'Vista frontal. Tocá: 1) Línea media del tronco (referencia) → 2) Vértice (acromion) → 3) Epicóndilo lateral (codo, brazo elevado)',
      },
      rotacion_interna: {
        label: 'Rotación Interna',
        optimo: 65,
        instruction: 'Atleta en decúbito supino, codo 90°. Tocá: 1) Muñeca (posición neutra) → 2) Vértice (olécranon/codo) → 3) Muñeca (rotada hacia el suelo)',
      },
      rotacion_externa: {
        label: 'Rotación Externa',
        optimo: 85,
        instruction: 'Atleta en decúbito supino, codo 90°. Tocá: 1) Muñeca (posición neutra) → 2) Vértice (olécranon/codo) → 3) Muñeca (rotada hacia arriba)',
      },
    },
  },
};

const POINT_COLORS = ['#38bdf8', '#a78bfa', '#4ade80'];
const STORAGE_KEY_FN = (coachId) => `fieldlab_${coachId}_hip_shoulder_gonio`;

// ── Pure helpers ───────────────────────────────────────────────────────────────
function calcAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round(Math.acos(cos) * (180 / Math.PI));
}

function getStatus(angle, optimo) {
  if (angle >= optimo * 0.9) return { label: 'NORMAL', color: '#22c55e', bg: 'rgba(34,197,94,0.2)' };
  if (angle >= optimo * 0.65) return { label: 'LIMITADO', color: '#eab308', bg: 'rgba(234,179,8,0.2)' };
  return { label: 'RESTRINGIDO', color: '#ef4444', bg: 'rgba(239,68,68,0.2)' };
}

// ── Canvas drawing ─────────────────────────────────────────────────────────────
function drawGonioCanvas(canvas, points, w, h) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(148,163,184,0.1)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  if (points.length >= 2) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
  }

  if (points.length === 3) {
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.stroke();

    const angle = calcAngle(points[0], points[1], points[2]);
    if (angle !== null) {
      const V = points[1];
      const P1 = points[0];
      const P3 = points[2];
      const R = 38;
      const ang1 = Math.atan2(P1.y - V.y, P1.x - V.x);
      const ang2 = Math.atan2(P3.y - V.y, P3.x - V.x);
      const cross = (P1.x - V.x) * (P3.y - V.y) - (P1.y - V.y) * (P3.x - V.x);

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(V.x, V.y, R, ang1, ang2, cross > 0);
      ctx.stroke();

      // Bisector label position
      const m1 = Math.hypot(P1.x - V.x, P1.y - V.y) || 1;
      const m2 = Math.hypot(P3.x - V.x, P3.y - V.y) || 1;
      const bx = (P1.x - V.x) / m1 + (P3.x - V.x) / m2;
      const by = (P1.y - V.y) / m1 + (P3.y - V.y) / m2;
      const bm = Math.hypot(bx, by) || 1;
      const lx = Math.max(24, Math.min(w - 40, V.x + (bx / bm) * (R + 26)));
      const ly = Math.max(14, Math.min(h - 10, V.y + (by / bm) * (R + 26)));

      ctx.font = "bold 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 5;
      ctx.fillText(`${angle}°`, lx, ly);
      ctx.shadowBlur = 0;
    }
  }

  // Points with glow + label
  POINT_COLORS.slice(0, points.length).forEach((color, i) => {
    const p = points[i];
    // Glow
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = color + '4d';
    ctx.fill();
    // Core
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    // Number label above
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 4;
    ctx.fillText(String(i + 1), p.x, p.y - 15);
    ctx.shadowBlur = 0;
  });
}

// ── BilateralPanel ─────────────────────────────────────────────────────────────
function BilateralPanel({ jointKey, movKey, results }) {
  const movCfg = JOINT_CONFIG[jointKey]?.movements[movKey];
  if (!movCfg) return null;

  const derR = results.find(r => r.joint === jointKey && r.movement === movKey && r.side === 'der');
  const izqR = results.find(r => r.joint === jointKey && r.movement === movKey && r.side === 'izq');
  if (!derR || !izqR) return null;

  const der = derR.angle;
  const izq = izqR.angle;
  const dominant = Math.max(der, izq);
  const deficit = Math.min(der, izq);
  const asi = dominant > 0 ? Math.round(((dominant - deficit) / dominant) * 100) : 0;
  const hasAlert = asi >= 10;
  const defSide = der < izq ? 'Derecho' : 'Izquierdo';
  const barMax = Math.max(der, izq, movCfg.optimo) * 1.15;
  const derSt = getStatus(der, movCfg.optimo);
  const izqSt = getStatus(izq, movCfg.optimo);
  const asiColor = hasAlert ? '#ef4444' : '#22c55e';

  return (
    <div style={{ background: '#273347', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>
        BILATERAL — {movCfg.label.toUpperCase()}
      </div>

      {[{ label: 'Der', val: der, st: derSt, width: (der / barMax) * 100 },
        { label: 'Izq', val: izq, st: izqSt, width: (izq / barMax) * 100 }].map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: '#94a3b8', fontSize: 11, width: 26, textAlign: 'right', flexShrink: 0 }}>{row.label}</span>
          <div style={{ flex: 1, height: 16, background: '#0f172a', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${row.width}%`, background: row.st.color, borderRadius: 99, opacity: 0.85, transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: row.st.color, fontSize: 13, fontWeight: 700, width: 38, flexShrink: 0 }}>
            {row.val}°
          </span>
        </div>
      ))}

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: hasAlert ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        border: `1px solid ${asiColor}33`, borderRadius: 8,
        padding: '8px 12px', marginTop: 4,
      }}>
        <div>
          <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>ASI</div>
          {hasAlert && (
            <div style={{ color: asiColor, fontSize: 11, marginTop: 1 }}>
              ⚠ {defSide} deficiente · {Math.abs(der - izq)}° diff
            </div>
          )}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: asiColor }}>
          {asi}%
        </div>
      </div>
    </div>
  );
}

// ── Quick reference table ──────────────────────────────────────────────────────
function QuickRefTable({ jointKey, results }) {
  const joint = JOINT_CONFIG[jointKey];
  if (!joint) return null;

  const rows = Object.entries(joint.movements).map(([movKey, mov]) => {
    const der = results.find(r => r.joint === jointKey && r.movement === movKey && r.side === 'der');
    const izq = results.find(r => r.joint === jointKey && r.movement === movKey && r.side === 'izq');
    if (!der && !izq) return null;
    let alert = false;
    if (der && izq) {
      const dom = Math.max(der.angle, izq.angle);
      alert = Math.round(((dom - Math.min(der.angle, izq.angle)) / dom) * 100) >= 10;
    }
    return { movKey, label: mov.label, optimo: mov.optimo, der, izq, alert };
  }).filter(Boolean);

  if (!rows.length) return null;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px', marginTop: 8 }}>
      <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>
        {joint.label.toUpperCase()} — RESUMEN
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 10px', alignItems: 'center' }}>
        <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>MOVIMIENTO</span>
        <span style={{ color: '#475569', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>DER°</span>
        <span style={{ color: '#475569', fontSize: 10, fontWeight: 700, textAlign: 'center' }}>IZQ°</span>
        {rows.map(row => (
          <>
            <span key={`l${row.movKey}`} style={{ color: '#cbd5e1', fontSize: 12, paddingTop: 6, borderTop: '1px solid #273347' }}>
              {row.alert && <span style={{ color: '#ef4444', marginRight: 4 }}>⚠</span>}
              {row.label}
            </span>
            {['der', 'izq'].map(side => {
              const r = row[side];
              const st = r ? getStatus(r.angle, row.optimo) : null;
              return (
                <span key={`${side}${row.movKey}`} style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  color: st ? st.color : '#334155',
                  fontSize: 13, fontWeight: 700,
                  textAlign: 'center',
                  paddingTop: 6, borderTop: '1px solid #273347',
                }}>
                  {r ? `${r.angle}°` : '—'}
                </span>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

// ── Global ASI index ───────────────────────────────────────────────────────────
function GlobalASI({ results }) {
  const seen = new Set();
  const pairs = [];
  for (const r of results) {
    const key = `${r.joint}|${r.movement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const der = results.find(x => x.joint === r.joint && x.movement === r.movement && x.side === 'der');
    const izq = results.find(x => x.joint === r.joint && x.movement === r.movement && x.side === 'izq');
    if (der && izq) {
      const dom = Math.max(der.angle, izq.angle);
      pairs.push(Math.round(((dom - Math.min(der.angle, izq.angle)) / dom) * 100));
    }
  }
  if (!pairs.length) return null;

  const global = Math.round(pairs.reduce((a, b) => a + b, 0) / pairs.length);
  const color = global >= 10 ? '#ef4444' : global >= 5 ? '#eab308' : '#22c55e';

  return (
    <div style={{
      background: global >= 10 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
      border: `1px solid ${color}33`, borderRadius: 12,
      padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>ASI Global</div>
        <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>
          Promedio de {pairs.length} movimiento{pairs.length > 1 ? 's' : ''} bilateral{pairs.length > 1 ? 'es' : ''}
        </div>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color }}>{global}%</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HipShoulderGoniometer({ onNavigate, onFullscreen }) {
  const { coach } = useAuth();

  const [step, setStep] = useState('selector');
  const [selectedJoint, setSelectedJoint] = useState(null);
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [selectedSide, setSelectedSide] = useState('der');
  const [captureMode, setCaptureMode] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [imageReady, setImageReady] = useState(false);
  const [canvasSize, setCanvasSize] = useState(null);
  const [points, setPoints] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [sessionResults, setSessionResults] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_FN(coach?.id)) || '[]'); }
    catch { return []; }
  });

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageReadyTimer = useRef(null);
  const countdownInterval = useRef(null);
  const pointsRef = useRef([]);
  const draggingIdxRef = useRef(null);
  const toastTimerRef  = useRef(null);

  const [athletes,          setAthletes]          = useState(() => getAthletes(coach?.id));
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);
  const [showNewForm,       setShowNewForm]        = useState(false);
  const [newAthleteName,    setNewAthleteName]     = useState('');
  const [savedToastName,    setSavedToastName]     = useState(null);
  const [resultsTab,        setResultsTab]         = useState('sesion');

  const selectedAthlete = useMemo(
    () => athletes.find(a => a.id === selectedAthleteId) ?? null,
    [athletes, selectedAthleteId]
  );

  function handleSelectAthlete(value) {
    if (value === '__new__') {
      setShowNewForm(true);
      setSelectedAthleteId(null);
    } else {
      setShowNewForm(false);
      setSelectedAthleteId(value || null);
      setNewAthleteName('');
    }
  }

  function handleCreateAthlete() {
    if (!newAthleteName.trim()) return;
    const athlete = {
      id: crypto.randomUUID(),
      coachId: coach?.id,
      name: newAthleteName.trim(),
      createdAt: new Date().toISOString(),
    };
    saveAthlete(athlete, coach?.id);
    setAthletes(prev => [...prev, athlete]);
    setSelectedAthleteId(athlete.id);
    setShowNewForm(false);
    setNewAthleteName('');
  }

  // Keep points ref in sync
  useEffect(() => { pointsRef.current = points; }, [points]);

  const angle = points.length === 3 ? calcAngle(points[0], points[1], points[2]) : null;
  const isFull = points.length === 3;
  const movCfg = selectedJoint && selectedMovement ? JOINT_CONFIG[selectedJoint]?.movements[selectedMovement] : null;
  const angleStatus = angle !== null && movCfg ? getStatus(angle, movCfg.optimo) : null;

  // Fullscreen control
  useEffect(() => {
    const fs = step === 'marcando' || step === 'captura';
    onFullscreen?.(fs);
    return () => onFullscreen?.(false);
  }, [step, onFullscreen]);

  // Canvas redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasSize) return;
    canvas.width = canvasSize.w;
    canvas.height = canvasSize.h;
    drawGonioCanvas(canvas, points, canvasSize.w, canvasSize.h);
  }, [points, canvasSize]);

  // Resize canvas to match displayed image
  useEffect(() => {
    const img = imageRef.current;
    if (!img || step !== 'marcando') return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0) setCanvasSize({ w: Math.round(width), h: Math.round(height) });
    });
    obs.observe(img);
    return () => obs.disconnect();
  }, [step]);

  // Canvas event handling (stable closure via refs)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageReady) return;

    const HIT = 32;
    let touchStart = null;

    function coords(e) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }

    function findNear(x, y) {
      const pts = pointsRef.current;
      for (let i = pts.length - 1; i >= 0; i--)
        if (Math.hypot(x - pts[i].x, y - pts[i].y) <= HIT) return i;
      return -1;
    }

    function onStart(e) {
      const { x, y } = coords(e);
      const near = findNear(x, y);
      if (near >= 0) {
        e.preventDefault();
        draggingIdxRef.current = near;
        touchStart = null;
      } else {
        touchStart = { x, y };
      }
    }

    function onMove(e) {
      if (draggingIdxRef.current === null) return;
      e.preventDefault();
      const { x, y } = coords(e);
      const idx = draggingIdxRef.current;
      setPoints(prev => { const n = [...prev]; n[idx] = { x, y }; return n; });
    }

    function onEnd(e) {
      if (draggingIdxRef.current !== null) {
        e.preventDefault();
        draggingIdxRef.current = null;
        return;
      }
      if (!touchStart) return;
      // Capture value in a local const before nullifying — the setPoints updater
      // runs in React's render phase (after this handler returns), so touching
      // the mutable `touchStart` closure variable would read null by then.
      const start = touchStart;
      touchStart = null;
      const { x, y } = coords(e);
      if (Math.hypot(x - start.x, y - start.y) < 10) {
        setPoints(prev => prev.length >= 3 ? prev : [...prev, { x: start.x, y: start.y }]);
      }
    }

    canvas.addEventListener('touchstart', onStart, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onEnd, { passive: false });
    canvas.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    return () => {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onEnd);
      canvas.removeEventListener('mousedown', onStart);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
    };
  }, [imageReady, step]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(imageReadyTimer.current);
    clearTimeout(toastTimerRef.current);
    clearInterval(countdownInterval.current);
    stopStream();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach stream to video element when entering capture step
  useEffect(() => {
    if (step === 'captura' && captureMode !== 'upload' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [step, captureMode]);

  // Revoke blob URLs on imageSrc change
  useEffect(() => {
    return () => { if (imageSrc?.startsWith('blob:')) URL.revokeObjectURL(imageSrc); };
  }, [imageSrc]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const resetCanvas = useCallback(() => {
    setPoints([]);
    draggingIdxRef.current = null;
  }, []);

  const startCamera = useCallback(async (facing) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing === 'front' ? 'user' : 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCaptureMode(facing);
      setStep('captura');
    } catch (err) {
      alert('No se pudo acceder a la cámara: ' + err.message);
    }
  }, []);

  const handleUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageSrc(URL.createObjectURL(file));
    setCaptureMode('upload');
    resetCanvas();
    setImageReady(false);
    setStep('marcando');
  }, [resetCanvas]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    stopStream();
    setImageSrc(canvas.toDataURL('image/jpeg', 0.92));
    resetCanvas();
    setImageReady(false);
    setStep('marcando');
  }, [stopStream, resetCanvas]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    let n = 3;
    countdownInterval.current = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(countdownInterval.current); setCountdown(null); takePhoto(); }
      else setCountdown(n);
    }, 1000);
  }, [takePhoto]);

  const onImgLoad = useCallback((e) => {
    const el = e.target;
    setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    clearTimeout(imageReadyTimer.current);
    imageReadyTimer.current = setTimeout(() => setImageReady(true), 400);
  }, []);

  const saveResult = useCallback(() => {
    if (angle == null || !selectedJoint || !selectedMovement) return;

    const st = getStatus(angle, movCfg?.optimo);

    const oppSide = selectedSide === 'der' ? 'izq' : 'der';
    const oppR = sessionResults.find(r =>
      r.athleteId === selectedAthleteId &&
      r.joint === selectedJoint &&
      r.movement === selectedMovement &&
      r.side === oppSide
    );
    let asiPct = null;
    if (oppR) {
      const dom = Math.max(angle, oppR.angle);
      const def = Math.min(angle, oppR.angle);
      asiPct = dom > 0 ? Math.round(((dom - def) / dom) * 100) : 0;
    }

    const entry = {
      id: crypto.randomUUID(),
      athleteId: selectedAthleteId,
      coachId: coach?.id,
      date: new Date().toISOString(),
      joint: selectedJoint,
      movement: selectedMovement,
      side: selectedSide,
      angle,
      optimo: movCfg?.optimo,
      status: st.label,
      asiPct,
    };

    const next = [entry, ...sessionResults].slice(0, 100);
    setSessionResults(next);

    if (selectedAthleteId) {
      saveMobilityAssessment(entry, coach?.id);
    }

    try { localStorage.setItem(STORAGE_KEY_FN(coach?.id), JSON.stringify(next)); } catch {}

    if (selectedAthlete) {
      setSavedToastName(selectedAthlete.name);
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setSavedToastName(null), 2000);
    }

    resetCanvas();
    setImageSrc(null);
    setImageReady(false);
    setResultsTab('sesion');
    setStep('results');
  }, [angle, selectedJoint, selectedMovement, selectedSide, movCfg, sessionResults, selectedAthleteId, selectedAthlete, coach, resetCanvas]);

  const handleBack = useCallback(() => {
    stopStream();
    setImageSrc(null);
    setImageReady(false);
    resetCanvas();
    setCountdown(null);
    clearInterval(countdownInterval.current);
    if (step === 'marcando' || step === 'captura') setStep('captura_modo');
    else if (step === 'captura_modo') setStep('selector');
    else setStep('selector');
  }, [step, stopStream, resetCanvas]);

  // ── Step: selector ────────────────────────────────────────────────────────
  if (step === 'selector') {
    return (
      <div style={{ paddingBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Ruler size={20} style={{ color: '#38bdf8' }} />
          <h1 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 18, margin: 0 }}>Goniómetro Cadera & Hombro</h1>
        </div>

        {/* Athlete selector */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>ATLETA</p>
          <div style={{ position: 'relative' }}>
            <select
              value={showNewForm ? '__new__' : (selectedAthleteId || '')}
              onChange={e => handleSelectAthlete(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                background: '#1e293b',
                border: `1px solid ${selectedAthleteId ? '#38bdf8' : '#334155'}`,
                color: '#e2e8f0', fontSize: 14,
                appearance: 'none', WebkitAppearance: 'none',
                outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="">Sin atleta / evaluación rápida</option>
              {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              <option value="__new__">+ Nuevo atleta...</option>
            </select>
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none', fontSize: 10 }}>▼</span>
          </div>
          {showNewForm && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
                placeholder="Nombre del atleta"
                value={newAthleteName}
                onChange={e => setNewAthleteName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateAthlete()}
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 10,
                  background: '#1e293b', border: '1px solid #38bdf8',
                  color: '#e2e8f0', fontSize: 14, outline: 'none',
                }}
                autoFocus
              />
              <button
                onClick={handleCreateAthlete}
                disabled={!newAthleteName.trim()}
                style={{
                  padding: '9px 16px', borderRadius: 10, border: 'none',
                  background: newAthleteName.trim() ? '#38bdf8' : '#334155',
                  color: newAthleteName.trim() ? '#0f172a' : '#475569',
                  fontWeight: 700, fontSize: 13,
                  cursor: newAthleteName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Guardar
              </button>
            </div>
          )}
          {selectedAthlete && !showNewForm && (
            <div style={{ marginTop: 6, color: '#38bdf8', fontSize: 12, fontWeight: 600 }}>
              Evaluando a {selectedAthlete.name}
            </div>
          )}
        </div>

        {/* Side selector */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>LADO A EVALUAR</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ id: 'der', label: 'Derecho' }, { id: 'izq', label: 'Izquierdo' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedSide(id)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
                  background: selectedSide === id ? '#38bdf8' : '#1e293b',
                  color: selectedSide === id ? '#0f172a' : '#94a3b8',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Joint selector */}
        {Object.entries(JOINT_CONFIG).map(([jointKey, joint]) => (
          <div key={jointKey} style={{ marginBottom: 20 }}>
            <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>
              {joint.label.toUpperCase()}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(joint.movements).map(([movKey, mov]) => {
                const derHas = sessionResults.some(r => r.joint === jointKey && r.movement === movKey && r.side === 'der');
                const izqHas = sessionResults.some(r => r.joint === jointKey && r.movement === movKey && r.side === 'izq');
                return (
                  <button
                    key={movKey}
                    onClick={() => {
                      setSelectedJoint(jointKey);
                      setSelectedMovement(movKey);
                      setStep('captura_modo');
                    }}
                    style={{
                      background: '#1e293b', border: '1px solid #334155',
                      borderRadius: 12, padding: '12px', textAlign: 'left',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{mov.label}</div>
                    <div style={{ color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                      {mov.optimo}° óptimo
                    </div>
                    {(derHas || izqHas) && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                        {derHas && <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>DER ✓</span>}
                        {izqHas && <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 99 }}>IZQ ✓</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Results shortcut */}
        {sessionResults.length > 0 && (
          <button
            onClick={() => setStep('results')}
            style={{
              width: '100%', padding: '13px', borderRadius: 12,
              border: '1px solid #334155', background: 'transparent',
              color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              marginTop: 4,
            }}
          >
            Ver resultados de la sesión ({sessionResults.length})
          </button>
        )}
      </div>
    );
  }

  // ── Step: captura_modo ────────────────────────────────────────────────────
  if (step === 'captura_modo') {
    const joint = JOINT_CONFIG[selectedJoint];
    const mov = movCfg;
    const sideLabel = selectedSide === 'der' ? 'Derecho' : 'Izquierdo';

    return (
      <div style={{ paddingBottom: 32 }}>
        <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', background: 'none', border: 'none', padding: '0 0 16px', cursor: 'pointer', fontSize: 14 }}>
          <ChevronLeft size={16} /> Volver
        </button>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>
            {joint?.label} — {mov?.label}
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            <span style={{
              display: 'inline-block',
              background: selectedSide === 'der' ? 'rgba(56,189,248,0.15)' : 'rgba(167,139,250,0.15)',
              color: selectedSide === 'der' ? '#38bdf8' : '#a78bfa',
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
            }}>
              {sideLabel}
            </span>
            {selectedAthlete && (
              <span style={{ display: 'inline-block', background: 'rgba(148,163,184,0.1)', color: '#94a3b8', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>
                {selectedAthlete.name}
              </span>
            )}
          </div>
        </div>

        {/* Side selector inline */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[{ id: 'der', label: 'Derecho' }, { id: 'izq', label: 'Izquierdo' }].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setSelectedSide(id)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: selectedSide === id ? '#38bdf8' : '#1e293b',
                color: selectedSide === id ? '#0f172a' : '#94a3b8',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Instruction */}
        {mov?.instruction && (
          <div style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
            <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>POSICIÓN Y PUNTOS</div>
            <p style={{ color: '#cbd5e1', fontSize: 13, margin: 0, lineHeight: 1.65 }}>{mov.instruction}</p>
          </div>
        )}

        {/* Point legend */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>PUNTOS A MARCAR</div>
          {[
            { color: '#38bdf8', label: '1 — Referencia proximal' },
            { color: '#a78bfa', label: '2 — Vértice / centro articular' },
            { color: '#4ade80', label: '3 — Segmento distal' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Capture buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => startCamera('rear')} style={captureBtnStyle('#38bdf8', '#0f172a')}>
            <Camera size={18} /> Cámara trasera
          </button>
          <button onClick={() => startCamera('front')} style={captureBtnStyle('#1e293b', '#e2e8f0', '#334155')}>
            <Camera size={18} /> Cámara frontal
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={captureBtnStyle('#1e293b', '#e2e8f0', '#334155')}>
            <Upload size={18} /> Subir foto
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
        </div>
      </div>
    );
  }

  // ── Step: captura ─────────────────────────────────────────────────────────
  if (step === 'captura') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 999, display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => { clearInterval(countdownInterval.current); setCountdown(null); stopStream(); setStep('captura_modo'); }}
            style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 99, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            ✕ Cancelar
          </button>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>
            {JOINT_CONFIG[selectedJoint]?.label} — {movCfg?.label}
          </span>
        </div>

        <video ref={videoRef} autoPlay playsInline muted style={{ flex: 1, width: '100%', objectFit: 'cover' }} />

        {countdown !== null && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
            <div style={{ width: 110, height: 110, borderRadius: '50%', background: 'rgba(15,23,42,0.75)', border: '3px solid #38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 60, fontWeight: 700, color: countdown === 1 ? '#ef4444' : countdown === 2 ? '#eab308' : '#22c55e' }}>
                {countdown}
              </span>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 28, left: 12, right: 12 }}>
          <button
            onClick={captureMode === 'front' ? startCountdown : takePhoto}
            disabled={countdown !== null}
            style={{
              width: '100%', padding: '15px', borderRadius: 14, border: 'none',
              background: countdown !== null ? '#334155' : '#38bdf8',
              color: countdown !== null ? '#94a3b8' : '#0f172a',
              fontWeight: 700, fontSize: 16, cursor: countdown !== null ? 'not-allowed' : 'pointer',
              boxShadow: countdown === null ? '0 4px 20px rgba(56,189,248,0.3)' : 'none',
            }}
          >
            {countdown !== null ? `Capturando en ${countdown}…` : '📸 Capturar'}
          </button>
        </div>
      </div>
    );
  }

  // ── Step: marcando ────────────────────────────────────────────────────────
  if (step === 'marcando') {
    const sideLabel = selectedSide === 'der' ? 'Der' : 'Izq';
    const promptColors = ['#38bdf8', '#a78bfa', '#4ade80'];
    const promptTexts = ['Tocá el punto 1 (referencia proximal)', 'Tocá el punto 2 (vértice / centro articular)', 'Tocá el punto 3 (segmento distal)'];

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0f172a', zIndex: 999, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(15,23,42,0.97)', borderBottom: '1px solid #1e293b' }}>
          <button onClick={handleBack} style={{ color: '#94a3b8', background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex' }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {JOINT_CONFIG[selectedJoint]?.label} · {movCfg?.label} · {sideLabel}
            </div>
            {selectedAthlete && (
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginTop: 1 }}>{selectedAthlete.name}</div>
            )}
          </div>
          {isFull && angle !== null && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: angleStatus?.color ?? '#fbbf24' }}>
              {angle}°
            </span>
          )}
        </div>

        {/* Image + canvas */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Captura"
              style={{ width: '100%', display: 'block', userSelect: 'none' }}
              draggable={false}
              onLoad={onImgLoad}
            />
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                touchAction: isFull ? 'none' : 'pan-y',
                cursor: imageReady ? (isFull ? 'grab' : 'crosshair') : 'default',
                opacity: imageReady ? 1 : 0,
                transition: 'opacity 0.2s',
              }}
            />
          </div>
        </div>

        {/* Bottom panel */}
        <div style={{ flexShrink: 0, background: 'rgba(15,23,42,0.97)', borderTop: '1px solid #1e293b', padding: '10px 14px 20px' }}>
          {/* Side selector in marking step */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[{ id: 'der', label: 'Derecho' }, { id: 'izq', label: 'Izquierdo' }].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedSide(id)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 12,
                  background: selectedSide === id ? '#38bdf8' : '#1e293b',
                  color: selectedSide === id ? '#0f172a' : '#64748b',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Instruction prompt / angle display */}
          {!isFull ? (
            <div style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid #1e3a5f', borderRadius: 10, padding: '8px 12px', marginBottom: 10 }}>
              <p style={{ color: '#e2e8f0', fontSize: 13, margin: 0, textAlign: 'center' }}>
                <span style={{ color: promptColors[points.length], fontWeight: 700 }}>Punto {points.length + 1}: </span>
                {promptTexts[points.length]}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 10 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 40, fontWeight: 700, color: angleStatus?.color ?? '#fbbf24' }}>
                {angle}°
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ background: angleStatus?.bg, color: angleStatus?.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99 }}>
                  {angleStatus?.label}
                </span>
                <span style={{ color: '#475569', fontSize: 11 }}>Arrastrá para ajustar</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resetCanvas} style={actionBtnStyle('#1e293b', '#94a3b8')}>
              <RotateCcw size={14} /> Limpiar
            </button>
            <button
              onClick={() => { stopStream(); setImageSrc(null); setImageReady(false); resetCanvas(); setStep('captura_modo'); }}
              style={actionBtnStyle('#1e293b', '#94a3b8')}
            >
              <Camera size={14} /> Nueva foto
            </button>
            <button
              onClick={saveResult}
              disabled={!isFull || angle === null}
              style={actionBtnStyle(isFull && angle !== null ? '#059669' : '#1e293b', isFull && angle !== null ? '#fff' : '#475569')}
            >
              <CheckCircle size={14} /> Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: results ─────────────────────────────────────────────────────────
  if (step === 'results') {
    const cadResults = sessionResults.filter(r => r.joint === 'cadera');
    const homResults = sessionResults.filter(r => r.joint === 'hombro');
    const bilateralRendered = new Set();
    const showSession = resultsTab === 'sesion' || !selectedAthleteId;

    return (
      <div style={{ paddingBottom: 32 }}>
        {/* Saved toast */}
        {savedToastName && (
          <div style={{
            position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            background: '#059669', color: '#fff', borderRadius: 10,
            padding: '10px 20px', fontWeight: 700, fontSize: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 1000, whiteSpace: 'nowrap',
          }}>
            Guardado para {savedToastName} ✓
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setStep('selector')} style={{ color: '#94a3b8', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 16, margin: 0 }}>Resultados de sesión</h1>
              {selectedAthlete && (
                <div style={{ color: '#38bdf8', fontSize: 12, fontWeight: 600, marginTop: 2 }}>{selectedAthlete.name}</div>
              )}
            </div>
          </div>
          <button
            onClick={() => setStep('selector')}
            style={{ background: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: 10, padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            + Nueva medición
          </button>
        </div>

        {/* Tabs — only when athlete is selected */}
        {selectedAthleteId && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[{ id: 'sesion', label: 'Sesión actual' }, { id: 'historial', label: 'Historial' }].map(tab => (
              <button
                key={tab.id}
                onClick={() => setResultsTab(tab.id)}
                style={{
                  flex: 1, padding: '9px', borderRadius: 10, border: 'none',
                  background: resultsTab === tab.id ? '#38bdf8' : '#1e293b',
                  color: resultsTab === tab.id ? '#0f172a' : '#94a3b8',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Historial tab */}
        {!showSession && selectedAthleteId && (
          <MobilityHistory
            athleteId={selectedAthleteId}
            coachId={coach?.id}
            jointConfig={JOINT_CONFIG}
            athleteName={selectedAthlete?.name ?? ''}
            refreshKey={sessionResults.length}
          />
        )}

        {/* Session tab */}
        {showSession && (
          <>
            {sessionResults.length === 0 && (
              <div style={{ textAlign: 'center', color: '#475569', paddingTop: 48 }}>
                <Ruler size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
                <p>Sin mediciones guardadas en esta sesión.</p>
              </div>
            )}

            <GlobalASI results={sessionResults} />

            {[['cadera', cadResults], ['hombro', homResults]].map(([jointKey, jResults]) => {
              if (!jResults.length) return null;
              return (
                <div key={jointKey} style={{ marginTop: 20 }}>
                  <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>
                    {JOINT_CONFIG[jointKey].label.toUpperCase()}
                  </p>

                  {jResults.map(r => {
                    const st = getStatus(r.angle, r.optimo ?? JOINT_CONFIG[r.joint]?.movements[r.movement]?.optimo);
                    return (
                      <div key={r.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
                            {JOINT_CONFIG[r.joint]?.movements[r.movement]?.label}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                            {r.side === 'der' ? 'Derecho' : 'Izquierdo'} · {new Date(r.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: st.color }}>{r.angle}°</div>
                          <div style={{ display: 'inline-block', background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>{st.label}</div>
                        </div>
                      </div>
                    );
                  })}

                  {Object.keys(JOINT_CONFIG[jointKey].movements).map(movKey => {
                    const key = `${jointKey}|${movKey}`;
                    if (bilateralRendered.has(key)) return null;
                    const der = jResults.find(r => r.movement === movKey && r.side === 'der');
                    const izq = jResults.find(r => r.movement === movKey && r.side === 'izq');
                    if (!der || !izq) return null;
                    bilateralRendered.add(key);
                    return <BilateralPanel key={key} jointKey={jointKey} movKey={movKey} results={sessionResults} />;
                  })}

                  <QuickRefTable jointKey={jointKey} results={sessionResults} />
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  }

  return null;
}

// ── Style helpers ──────────────────────────────────────────────────────────────
function captureBtnStyle(bg, color, border) {
  return {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    background: bg, color, border: border ? `1px solid ${border}` : 'none',
    borderRadius: 12, padding: '14px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
  };
}

function actionBtnStyle(bg, color) {
  return {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: bg, color, border: 'none', borderRadius: 12,
    padding: '12px 0', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  };
}
