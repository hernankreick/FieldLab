import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, RotateCcw, CheckCircle, ChevronLeft, Ruler } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGoniometer } from '../hooks/useGoniometer';
import GoniometerCanvas from '../components/GoniometerCanvas';

const TEST_CONFIGS = [
  {
    id: 'dorsiflex_izq',
    label: 'Dorsiflexión Tobillo Izquierdo',
    description: 'Prueba de lunge — tobillo izquierdo',
    points: ['Maléolo lateral', 'Cabeza del peroné'],
    pointCount: 2,
    autoVertical: true,
    vertexIndex: 0,
    normalMin: 35,
    normal: { optimo: 35, precaucion: 25 },
    icon: '🦵',
    instruction: [
      '1️⃣ Maléolo lateral — hueso prominente del tobillo externo',
      '2️⃣ Cabeza del peroné — bulto óseo lateral justo debajo de la rodilla',
    ],
    protocol: 'Eje en maléolo lateral. Barra → cabeza del peroné. Vertical automática.',
  },
  {
    id: 'dorsiflex_der',
    label: 'Dorsiflexión Tobillo Derecho',
    description: 'Prueba de lunge — tobillo derecho',
    points: ['Maléolo lateral', 'Cabeza del peroné'],
    pointCount: 2,
    autoVertical: true,
    vertexIndex: 0,
    normalMin: 35,
    normal: { optimo: 35, precaucion: 25 },
    icon: '🦵',
    instruction: [
      '1️⃣ Maléolo lateral — hueso prominente del tobillo externo',
      '2️⃣ Cabeza del peroné — bulto óseo lateral justo debajo de la rodilla',
    ],
    protocol: 'Eje en maléolo lateral. Barra → cabeza del peroné. Vertical automática.',
  },
  {
    id: 'flex_cadera',
    label: 'Flexión de Cadera',
    description: 'Flexión de cadera en decúbito',
    points: ['Trocánter mayor', 'EIAS', 'Cóndilo lateral rodilla'],
    pointCount: 3,
    vertexIndex: 0,
    normalMin: 90,
    icon: '🫁',
    instruction: 'Vista lateral. Tocá:\n1️⃣ Trocánter mayor (cadera)\n2️⃣ EIAS (cresta ilíaca anterior)\n3️⃣ Cóndilo lateral de la rodilla',
    protocol: 'Goniómetro: eje en trocánter mayor, barra fija → EIAS, barra móvil → cóndilo lateral rodilla.',
  },
  {
    id: 'flex_hombro',
    label: 'Flexión de Hombro',
    description: 'Flexión de hombro — rango sagital',
    points: ['Acromion', 'Epicóndilo lateral', 'Línea media tronco'],
    pointCount: 3,
    vertexIndex: 0,
    normalMin: 160,
    icon: '💪',
    instruction: 'Vista lateral. Tocá:\n1️⃣ Acromion (punta del hombro)\n2️⃣ Epicóndilo lateral (codo)\n3️⃣ Punto en la línea media del tronco (referencia)',
    protocol: 'Goniómetro: eje en acromion, barra fija → línea media tronco, barra móvil → epicóndilo lateral.',
  },
  {
    id: 'rot_cadera',
    label: 'Rotación Interna Cadera',
    description: 'Rotación interna/externa de cadera',
    points: ['Rótula', 'Tobillo', 'Vertical (suelo)'],
    pointCount: 3,
    vertexIndex: 0,
    normalMin: 40,
    icon: '🔄',
    instruction: 'Atleta sentado al borde de la camilla, rodilla 90°. Tocá:\n1️⃣ Rótula (centro de la rodilla)\n2️⃣ Tobillo (maléolo)\n3️⃣ Punto vertical hacia abajo (referencia suelo)',
    protocol: 'Goniómetro: eje en rótula, barra fija → vertical, barra móvil → tobillo.',
  },
  {
    id: 'overhead_squat',
    label: 'Overhead Squat',
    description: 'Inclinación de tronco en squat overhead',
    points: ['Maléolo', 'Rodilla', 'Cadera'],
    pointCount: 3,
    vertexIndex: 1,
    normalMin: null,
    icon: '🏋️',
    instruction: 'Vista lateral en posición de squat. Tocá:\n1️⃣ Maléolo lateral\n2️⃣ Cóndilo lateral rodilla\n3️⃣ Trocánter mayor (cadera)',
    protocol: 'Mide el ángulo de flexión de rodilla.',
  },
];

function StatusPill({ angle, normalMin, normal }) {
  if (angle == null) return null;
  if (normal) {
    if (angle >= normal.optimo)
      return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-emerald-900/60 text-emerald-300">Normal</span>;
    if (angle >= normal.precaucion)
      return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-900/60 text-yellow-300">Límite</span>;
    return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-900/60 text-red-300">Reducido</span>;
  }
  if (normalMin == null) {
    return (
      <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-700 text-slate-300">
        Sin norma
      </span>
    );
  }
  const ok = angle >= normalMin;
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${ok ? 'bg-emerald-900/60 text-emerald-300' : 'bg-red-900/60 text-red-300'}`}>
      {ok ? 'Normal' : 'Reducido'}
    </span>
  );
}

export default function GoniometroView({ onNavigate, onFullscreen }) {
  const { coach } = useAuth();
  const [step, setStep] = useState('selector');
  const [selectedTest, setSelectedTest] = useState(null);
  const [captureMode, setCaptureMode] = useState(null); // 'rear' | 'front' | 'upload'
  const [imageSrc, setImageSrc] = useState(null);
  const [savedResults, setSavedResults] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`fieldlab_${coach?.id}_goniometro`) || '[]');
    } catch {
      return [];
    }
  });

  const [imageReady,       setImageReady]       = useState(false);
  const [imageSize,        setImageSize]        = useState(null);
  const [displaySize,      setDisplaySize]      = useState(null);
  const [countdown,        setCountdown]        = useState(null);
  const [bilateralResults, setBilateralResults] = useState({});
  const [transitionMsg,    setTransitionMsg]    = useState(null);
  const [selectedAthlete,  setSelectedAthlete]  = useState('');

  const videoRef             = useRef(null);
  const streamRef            = useRef(null);
  const fileInputRef         = useRef(null);
  const readyTimerRef        = useRef(null);
  const countdownIntervalRef = useRef(null);
  const transitionTimerRef   = useRef(null);

  const gonio = useGoniometer({
    pointCount:   selectedTest?.pointCount   ?? 3,
    vertexIndex:  selectedTest?.vertexIndex  ?? 1,
    autoVertical: selectedTest?.autoVertical ?? false,
  });

  const angleColor = gonio.angle == null
    ? '#facc15'
    : selectedTest?.normal
      ? gonio.angle >= selectedTest.normal.optimo
        ? '#22c55e'
        : gonio.angle >= selectedTest.normal.precaucion
          ? '#eab308'
          : '#ef4444'
      : selectedTest?.normalMin == null
        ? '#facc15'
        : gonio.angle >= selectedTest.normalMin
          ? '#22c55e'
          : '#ef4444';

  useEffect(() => {
    const isFs = step === 'marcando' || step === 'captura';
    onFullscreen?.(isFs);
    return () => onFullscreen?.(false);
  }, [step, onFullscreen]);

  // Reset image state whenever a new photo is set (clears any pending ready timer)
  useEffect(() => {
    clearTimeout(readyTimerRef.current);
    setImageReady(false);
    setImageSize(null);
    setDisplaySize(null);
  }, [imageSrc]);

  // Reset points whenever the test changes so stale landmarks never bleed into a new test
  useEffect(() => {
    gonio.reset();
  }, [selectedTest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancel timers on unmount
  useEffect(() => () => {
    clearTimeout(readyTimerRef.current);
    clearInterval(countdownIntervalRef.current);
    clearTimeout(transitionTimerRef.current);
  }, []);

  const onImgLoad = useCallback((e) => {
    const el = e.target;
    setImageSize({ w: el.naturalWidth, h: el.naturalHeight });
    setDisplaySize({ w: el.clientWidth, h: el.clientHeight });
    clearTimeout(readyTimerRef.current);
    // Delay prevents residual touches from the previous tap registering as points
    readyTimerRef.current = setTimeout(() => setImageReady(true), 400);
  }, []);

  const onTap = useCallback((sx, sy) => {
    gonio.addOrMovePoint(sx, sy);
  }, [gonio.addOrMovePoint]);

  const onDragPoint = useCallback((_idx, sx, sy) => {
    gonio.onDragMove(sx, sy);
  }, [gonio.onDragMove]);

  // Attach stream to video when in capture step
  useEffect(() => {
    if (step === 'captura' && captureMode !== 'upload' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [step, captureMode]);

  // Stop camera stream on unmount (e.g. user switches tabs mid-capture)
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Revoke blob URL when imageSrc changes to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imageSrc?.startsWith('blob:')) URL.revokeObjectURL(imageSrc);
    };
  }, [imageSrc]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
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
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCaptureMode('upload');
    gonio.reset();
    setStep('marcando');
  }, [gonio.reset]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const url = canvas.toDataURL('image/jpeg', 0.92);
    stopStream();
    setImageSrc(url);
    gonio.reset();
    setStep('marcando');
  }, [stopStream, gonio.reset]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    let count = 3;
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        takePhoto();
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [takePhoto]);

  const retakePhoto = useCallback(() => {
    setImageSrc(null);
    gonio.reset();
    if (captureMode === 'upload') {
      setBilateralResults({});
      setStep('selector');
      setSelectedTest(null);
    } else {
      startCamera(captureMode);
    }
  }, [captureMode, gonio.reset, startCamera]);

  const saveResult = useCallback(() => {
    if (gonio.angle == null || !selectedTest) return;
    const entry = {
      id: Date.now(),
      testId: selectedTest.id,
      testLabel: selectedTest.label,
      angle: gonio.angle,
      normalMin: selectedTest.normalMin,
      normal: selectedTest.normal ?? null,
      date: new Date().toISOString(),
    };
    const next = [entry, ...savedResults].slice(0, 50);
    setSavedResults(next);
    try {
      localStorage.setItem(`fieldlab_${coach?.id}_goniometro`, JSON.stringify(next));
    } catch {}

    if (selectedTest.id === 'dorsiflex_izq') {
      setBilateralResults(prev => ({ ...prev, dorsiflex_izq: gonio.angle }));
      clearTimeout(transitionTimerRef.current);
      setTransitionMsg('✓ Tobillo izquierdo guardado — ahora el derecho');
      transitionTimerRef.current = setTimeout(() => setTransitionMsg(null), 2500);
      setSelectedTest(TEST_CONFIGS.find(t => t.id === 'dorsiflex_der'));
      setImageSrc(null);
      setStep('captura_modo');
      return;
    }

    if (selectedTest.id === 'dorsiflex_der' && bilateralResults.dorsiflex_izq != null) {
      setBilateralResults(prev => ({ ...prev, dorsiflex_der: gonio.angle }));
      setStep('resumen_bilateral');
      return;
    }

    setStep('resultado');
  }, [gonio.angle, selectedTest, savedResults, coach, bilateralResults]);

  const handleBack = useCallback(() => {
    stopStream();
    setImageSrc(null);
    gonio.reset();
    setSelectedTest(null);
    setCaptureMode(null);
    setBilateralResults({});
    clearTimeout(transitionTimerRef.current);
    setTransitionMsg(null);
    setStep('selector');
  }, [stopStream, gonio.reset]);

  const selectTest = useCallback((test) => {
    setSelectedTest(test);
    setStep('captura_modo');
  }, []);

  if (step === 'selector') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-6">
          <Ruler size={22} className="text-sky-400" />
          <h1 className="text-xl font-bold text-white">Goniómetro Digital</h1>
        </div>
        <p className="text-slate-400 text-sm">Seleccioná la prueba que querés medir:</p>
        <div className="grid grid-cols-2 gap-3">
          {TEST_CONFIGS.map(test => (
            <button
              key={test.id}
              onClick={() => selectTest(test)}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 text-left transition-colors"
            >
              {test.icon && <p className="text-xl mb-1">{test.icon}</p>}
              <p className="font-semibold text-white text-sm">{test.label}</p>
              <p className="text-slate-400 text-xs mt-1">{test.description}</p>
              {test.normalMin != null && (
                <p className="text-sky-400 text-xs mt-2">Normal: ≥{test.normalMin}°</p>
              )}
            </button>
          ))}
        </div>

        {savedResults.length > 0 && (
          <div className="mt-6">
            <h2 className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wider">Historial reciente</h2>
            <div className="space-y-2">
              {savedResults.slice(0, 5).map(r => (
                <div key={r.id} className="bg-slate-800 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{r.testLabel}</p>
                    <p className="text-slate-500 text-xs">{new Date(r.date).toLocaleDateString('es-AR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sky-400 font-bold text-lg">{r.angle}°</p>
                    <StatusPill angle={r.angle} normalMin={r.normalMin} normal={r.normal} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'captura_modo') {
    return (
      <>
        {transitionMsg && (
          <div style={{
            position: 'fixed', top: 60, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(34,197,94,0.95)',
            color: '#0f172a', fontWeight: 700,
            fontSize: 13, padding: '10px 20px',
            borderRadius: 99, whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            {transitionMsg}
          </div>
        )}
        <div className="space-y-6">
          <button onClick={handleBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm">
          <ChevronLeft size={16} /> Volver
        </button>
        <div>
          <h2 className="text-white font-bold text-lg">{selectedTest?.label}</h2>
          <p className="text-slate-400 text-sm mt-1">{selectedTest?.description}</p>
        </div>
        <div className="space-y-3">
          <p className="text-slate-300 text-sm font-semibold">¿Cómo querés capturar la foto?</p>
          <button
            onClick={() => startCamera('rear')}
            className="w-full flex items-center gap-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl px-5 py-4 font-semibold transition-colors"
          >
            <Camera size={20} />
            Cámara trasera
          </button>
          <button
            onClick={() => startCamera('front')}
            className="w-full flex items-center gap-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-5 py-4 font-semibold transition-colors"
          >
            <Camera size={20} />
            Cámara frontal
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl px-5 py-4 font-semibold transition-colors"
          >
            <Upload size={20} />
            Subir foto
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
        {selectedTest?.instruction && (
          <div className="bg-slate-800/60 rounded-xl p-4 text-slate-300 text-sm">
            {Array.isArray(selectedTest.instruction)
              ? <ul className="space-y-1">{selectedTest.instruction.map((line, i) => <li key={i} style={{ lineHeight: 1.7 }}>{line}</li>)}</ul>
              : <p style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>{selectedTest.instruction}</p>
            }
          </div>
        )}
        <div className="bg-slate-800/60 rounded-xl p-4 text-slate-400 text-sm space-y-1">
          <p className="font-semibold text-slate-300 mb-2">Puntos a marcar:</p>
          {selectedTest?.points.map((pt, i) => (
            <p key={i}>
              <span className="font-bold" style={{ color: ['#38bdf8', '#f472b6', '#4ade80'][i] }}>● {['A', 'B', 'C'][i]}</span>
              {i === (selectedTest?.vertexIndex ?? 1) && <span className="text-xs text-slate-500 ml-1">(eje)</span>}
              {' '}— {pt}
            </p>
          ))}
          <p className="text-slate-500 text-xs mt-2">
            El ángulo se calcula en el punto {['A', 'B', 'C'][selectedTest?.vertexIndex ?? 1]} (eje del goniómetro).
          </p>
        </div>
      </div>
      </>
    );
  }

  if (step === 'captura') {
    return (
      <div
        className="fixed inset-0 bg-black flex flex-col"
        style={{ zIndex: 999 }}
      >
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          <button
            onClick={() => {
              clearInterval(countdownIntervalRef.current);
              setCountdown(null);
              stopStream();
              setStep('captura_modo');
            }}
            className="bg-black/50 text-white rounded-full px-4 py-2 text-sm font-semibold"
          >
            ✕ Cancelar
          </button>
          <p className="text-white/80 text-sm font-semibold">{selectedTest?.label}</p>
        </div>

        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="flex-1 w-full object-cover"
        />

        {/* Countdown overlay */}
        {countdown !== null && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 20, pointerEvents: 'none',
          }}>
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: 'rgba(15,23,42,0.75)',
              border: '3px solid #38bdf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 64, fontWeight: 700, lineHeight: 1,
                color: countdown === 1 ? '#ef4444' : countdown === 2 ? '#eab308' : '#22c55e',
              }}>
                {countdown}
              </span>
            </div>
          </div>
        )}

        {/* Capture button */}
        <div className="absolute bottom-8 left-4 right-4 flex justify-center">
          <button
            onClick={captureMode === 'front' ? startCountdown : takePhoto}
            disabled={countdown !== null}
            style={{
              width: '100%', padding: '16px', borderRadius: 14,
              border: 'none',
              background: countdown !== null ? '#334155' : '#38bdf8',
              color: countdown !== null ? '#94a3b8' : '#0f172a',
              fontWeight: 700, fontSize: 16,
              cursor: countdown !== null ? 'not-allowed' : 'pointer',
              boxShadow: countdown === null ? '0 4px 24px rgba(56,189,248,0.3)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {countdown !== null ? `Capturando en ${countdown}…` : '📸 Capturar'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'marcando') {
    const pointLabels = selectedTest?.points ?? ['A', 'B', 'C'];
    const currentInstruction = Array.isArray(selectedTest?.instruction)
      ? selectedTest.instruction[gonio.points.length]
      : selectedTest?.instruction;
    const angStatus = gonio.angle == null ? ''
      : selectedTest?.normal
        ? gonio.angle >= selectedTest.normal.optimo ? 'Normal'
          : gonio.angle >= selectedTest.normal.precaucion ? 'Límite' : 'Reducido'
        : selectedTest?.normalMin == null ? 'Sin norma'
          : gonio.angle >= selectedTest.normalMin ? 'Normal' : 'Reducido';

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Fixed header */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'rgba(15,23,42,0.97)',
          borderBottom: '1px solid #1e293b',
        }}>
          <button
            onClick={handleBack}
            style={{ color: '#94a3b8', background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ChevronLeft size={22} />
          </button>
          <span style={{ flex: 1, color: '#f1f5f9', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedTest?.label}
          </span>
          {gonio.isFull && gonio.angle != null && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: angleColor }}>
              {gonio.angle}°
            </span>
          )}
        </div>

        {/* Scrollable image zone */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div
            ref={gonio.containerRef}
            style={{ position: 'relative', width: '100%' }}
          >
            <img
              ref={gonio.imageRef}
              src={imageSrc}
              alt="Captura"
              style={{ width: '100%', display: 'block', userSelect: 'none' }}
              draggable={false}
              onLoad={onImgLoad}
            />
            <GoniometerCanvas
              points={gonio.points}
              angle={gonio.angle}
              imageSize={imageSize}
              displaySize={displaySize}
              pointLabels={pointLabels}
              vertexIndex={selectedTest?.vertexIndex ?? 1}
              angleColor={angleColor}
              autoVertical={selectedTest?.autoVertical ?? false}
              onTap={onTap}
              onDragPoint={onDragPoint}
              onDragStart={gonio.startDrag}
              onDragEnd={gonio.endDrag}
              dragging={gonio.draggingIdx}
              disabled={!imageReady}
            />
          </div>
        </div>

        {/* Fixed bottom panel */}
        <div style={{
          flexShrink: 0,
          background: 'rgba(15,23,42,0.97)',
          borderTop: '1px solid #1e293b',
          padding: '10px 14px 18px',
        }}>
          {!gonio.isFull ? (
            <div style={{
              padding: '8px 14px',
              background: 'rgba(56,189,248,0.08)',
              borderRadius: 10,
              border: '1px solid #1e3a5f',
              marginBottom: 10,
            }}>
              <p style={{ color: '#e2e8f0', fontSize: 13, margin: 0, textAlign: 'center' }}>
                <span style={{ color: ['#38bdf8', '#ec4899', '#22c55e'][gonio.points.length], fontWeight: 700 }}>
                  Punto {gonio.points.length + 1}:
                </span>{' '}
                {currentInstruction}
              </p>
              {selectedTest?.tip && gonio.points.length === 2 && (
                <p style={{ color: '#eab308', fontSize: 11, margin: '6px 0 0', textAlign: 'center' }}>
                  ⚠ {selectedTest.tip}
                </p>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, paddingBottom: 10 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 38, fontWeight: 700, color: angleColor }}>
                {gonio.angle}°
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <StatusPill angle={gonio.angle} normalMin={selectedTest?.normalMin} normal={selectedTest?.normal} />
                <span style={{ fontSize: 11, color: '#64748b' }}>Arrastrar para ajustar</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => gonio.reset()}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 12,
                padding: '12px 0', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} /> Limpiar
            </button>
            <button
              onClick={retakePhoto}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: '#334155', color: '#f1f5f9', border: 'none', borderRadius: 12,
                padding: '12px 0', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              <Camera size={15} /> Nueva foto
            </button>
            <button
              onClick={saveResult}
              disabled={gonio.angle == null}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: gonio.angle == null ? '#1e293b' : '#059669',
                color: gonio.angle == null ? '#475569' : '#fff',
                border: 'none', borderRadius: 12,
                padding: '12px 0', fontWeight: 600, fontSize: 14,
                cursor: gonio.angle == null ? 'not-allowed' : 'pointer',
              }}
            >
              <CheckCircle size={15} /> Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'resumen_bilateral') {
    const izq = bilateralResults.dorsiflex_izq ?? 0;
    const der = bilateralResults.dorsiflex_der ?? 0;
    const asimetria = Math.round(Math.abs(izq - der) / Math.max(izq, der, 1) * 100);
    const izqColor = izq >= 35 ? '#22c55e' : izq >= 25 ? '#eab308' : '#ef4444';
    const derColor = der >= 35 ? '#22c55e' : der >= 25 ? '#eab308' : '#ef4444';
    const symColor = asimetria >= 15 ? '#ef4444' : asimetria >= 10 ? '#eab308' : '#22c55e';
    const symLabel = asimetria >= 15 ? 'Asimetría significativa' : asimetria >= 10 ? 'Asimetría moderada' : 'Simetría normal';
    const symBg    = asimetria >= 15 ? 'rgba(239,68,68,0.12)' : asimetria >= 10 ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)';
    const clinical = asimetria >= 15
      ? `Asimetría significativa de ${asimetria}%. Una diferencia >15% entre tobillos se asocia a mayor riesgo de lesión de tobillo y rodilla. Evaluar restricción en tobillo ${izq < der ? 'izquierdo' : 'derecho'}.`
      : asimetria >= 10
      ? `Asimetría moderada de ${asimetria}%. Monitorear en próximas evaluaciones. Trabajar movilidad bilateral.`
      : Math.min(izq, der) < 25
      ? 'Ambos tobillos con restricción significativa (<25°). Riesgo aumentado de lesión. Priorizar trabajo de movilidad de tobillo.'
      : Math.min(izq, der) < 35
      ? 'Uno o ambos tobillos en rango límite (25–34°). Incluir trabajo de dorsiflexión en el calentamiento.'
      : 'Excelente movilidad bilateral. Mantener con trabajo preventivo.';

    const resetBilateral = () => {
      setBilateralResults({});
      setSelectedAthlete('');
      gonio.reset();
      setImageSrc(null);
      setSelectedTest(null);
      setCaptureMode(null);
      setStep('selector');
    };

    return (
      <div className="pb-8 space-y-3">
        <div>
          <h2 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 18, margin: '0 0 4px' }}>
            Dorsiflexión Bilateral
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>Lunge Test — comparación bilateral</p>
        </div>

        {/* Side-by-side ankle cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[{ label: 'IZQUIERDO', value: izq, color: izqColor }, { label: 'DERECHO', value: der, color: derColor }].map(({ label, value, color }) => (
            <div key={label} style={{ background: '#1e293b', border: `1px solid ${color}33`, borderRadius: 14, padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 44, fontWeight: 700, color, lineHeight: 1 }}>{value}°</div>
              <div style={{ display: 'inline-block', marginTop: 8, background: color + '20', border: `1px solid ${color}44`, borderRadius: 99, padding: '3px 10px', color, fontSize: 10, fontWeight: 700 }}>
                {value >= 35 ? 'Normal' : value >= 25 ? 'Límite' : 'Reducido'}
              </div>
            </div>
          ))}
        </div>

        {/* Asymmetry bar */}
        <div style={{ background: symBg, border: `1px solid ${symColor}33`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>Asimetría</div>
            <div style={{ color: symColor, fontSize: 12, marginTop: 2 }}>{symLabel}</div>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: symColor }}>{asimetria}%</div>
        </div>

        {/* Stats */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Diferencia absoluta</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>{Math.abs(izq - der)}°</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>Lado dominante</span>
            <span style={{ color: '#38bdf8', fontSize: 12, fontWeight: 600 }}>
              {izq > der ? 'Izquierdo' : izq < der ? 'Derecho' : 'Simétrico'}
            </span>
          </div>
        </div>

        {/* Clinical interpretation */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>INTERPRETACIÓN CLÍNICA</div>
          <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0, lineHeight: 1.6 }}>{clinical}</p>
        </div>

        {/* Athlete label */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px 14px' }}>
          <label style={{ color: '#94a3b8', fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>ATLETA (OPCIONAL)</label>
          <input
            type="text"
            placeholder="Nombre del atleta"
            value={selectedAthlete}
            onChange={e => setSelectedAthlete(e.target.value)}
            style={{ width: '100%', background: '#273347', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => {
              try {
                localStorage.setItem(
                  `fieldlab_${coach?.id ?? 'guest'}_gonio_bilateral_tobillo_${Date.now()}`,
                  JSON.stringify({ izq, der, asimetria, athlete: selectedAthlete, fecha: new Date().toISOString().slice(0, 10) })
                );
              } catch {}
              resetBilateral();
            }}
            style={{ padding: '14px', borderRadius: 12, border: 'none', background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            💾 Guardar resultado bilateral
          </button>
          <button
            onClick={resetBilateral}
            style={{ padding: '13px', borderRadius: 12, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: 'pointer' }}
          >
            Nueva evaluación
          </button>
        </div>
      </div>
    );
  }

  if (step === 'resultado') {
    const last = savedResults[0];
    return (
      <div className="space-y-6">
        <div className="bg-slate-800 rounded-2xl p-6 text-center space-y-3">
          <p className="text-slate-400 text-sm font-semibold uppercase tracking-wider">{last?.testLabel}</p>
          <p className="text-5xl font-bold text-sky-400">{last?.angle}°</p>
          <StatusPill angle={last?.angle} normalMin={last?.normalMin} normal={last?.normal} />
          {last?.normal
            ? <p className="text-slate-500 text-xs">Normal ≥{last.normal.optimo}° · Límite {last.normal.precaucion}–{last.normal.optimo - 1}° · Reducido &lt;{last.normal.precaucion}°</p>
            : last?.normalMin != null && <p className="text-slate-500 text-xs">Normal: ≥{last.normalMin}°</p>
          }
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              gonio.reset();
              setStep('marcando');
            }}
            disabled={!imageSrc}
            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded-xl py-3 font-semibold transition-colors"
          >
            Remedir
          </button>
          <button
            onClick={() => {
              gonio.reset();
              setImageSrc(null);
              setSelectedTest(null);
              setCaptureMode(null);
              setStep('selector');
            }}
            className="flex-1 bg-sky-600 hover:bg-sky-500 text-white rounded-xl py-3 font-semibold transition-colors"
          >
            Nueva prueba
          </button>
        </div>
      </div>
    );
  }

  return null;
}
