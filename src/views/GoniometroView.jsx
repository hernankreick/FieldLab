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
    points: ['Maléolo lateral', 'Cabeza del peroné', '5to metatarsiano'],
    pointCount: 3,
    vertexIndex: 0,
    normalMin: 35,
    icon: '🦵',
    instruction: 'Vista lateral. Tocá en orden:\n1️⃣ Maléolo lateral (hueso del tobillo)\n2️⃣ Cabeza del peroné (rodilla lateral)\n3️⃣ 5to metatarsiano (borde externo del pie)',
    protocol: 'Goniómetro: eje en maléolo lateral, barra fija → cabeza del peroné, barra móvil → 5to metatarsiano.',
  },
  {
    id: 'dorsiflex_der',
    label: 'Dorsiflexión Tobillo Derecho',
    description: 'Prueba de lunge — tobillo derecho',
    points: ['Maléolo lateral', 'Cabeza del peroné', '5to metatarsiano'],
    pointCount: 3,
    vertexIndex: 0,
    normalMin: 35,
    icon: '🦵',
    instruction: 'Vista lateral. Tocá en orden:\n1️⃣ Maléolo lateral (hueso del tobillo)\n2️⃣ Cabeza del peroné (rodilla lateral)\n3️⃣ 5to metatarsiano (borde externo del pie)',
    protocol: 'Goniómetro: eje en maléolo lateral, barra fija → cabeza del peroné, barra móvil → 5to metatarsiano.',
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

function StatusPill({ angle, normalMin }) {
  if (angle == null) return null;
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

  const [imageReady,  setImageReady]  = useState(false);
  const [imageSize,   setImageSize]   = useState(null);
  const [displaySize, setDisplaySize] = useState(null);
  const [countdown,   setCountdown]   = useState(null); // null | 3 | 2 | 1

  const videoRef           = useRef(null);
  const streamRef          = useRef(null);
  const fileInputRef       = useRef(null);
  const readyTimerRef      = useRef(null);
  const countdownIntervalRef = useRef(null);

  const gonio = useGoniometer({
    pointCount: selectedTest?.pointCount ?? 3,
    vertexIndex: selectedTest?.vertexIndex ?? 1,
  });

  const angleColor = gonio.angle == null
    ? '#facc15'
    : selectedTest?.normalMin == null
      ? '#facc15'
      : gonio.angle >= selectedTest.normalMin
        ? '#22c55e'
        : '#ef4444';

  const isCapturing = step === 'captura';

  useEffect(() => {
    onFullscreen?.(isCapturing);
    return () => onFullscreen?.(false);
  }, [isCapturing, onFullscreen]);

  // Reset image state whenever a new photo is set (clears any pending ready timer)
  useEffect(() => {
    clearTimeout(readyTimerRef.current);
    setImageReady(false);
    setImageSize(null);
    setDisplaySize(null);
  }, [imageSrc]);

  // Cancel timers on unmount
  useEffect(() => () => {
    clearTimeout(readyTimerRef.current);
    clearInterval(countdownIntervalRef.current);
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
  }, [gonio]);

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
  }, [stopStream, gonio]);

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
      setStep('selector');
      setSelectedTest(null);
    } else {
      startCamera(captureMode);
    }
  }, [captureMode, gonio, startCamera]);

  const saveResult = useCallback(() => {
    if (gonio.angle == null || !selectedTest) return;
    const entry = {
      id: Date.now(),
      testId: selectedTest.id,
      testLabel: selectedTest.label,
      angle: gonio.angle,
      normalMin: selectedTest.normalMin,
      date: new Date().toISOString(),
    };
    const next = [entry, ...savedResults].slice(0, 50);
    setSavedResults(next);
    try {
      localStorage.setItem(`fieldlab_${coach?.id}_goniometro`, JSON.stringify(next));
    } catch {}
    setStep('resultado');
  }, [gonio.angle, selectedTest, savedResults, coach]);

  const handleBack = useCallback(() => {
    stopStream();
    setImageSrc(null);
    gonio.reset();
    setSelectedTest(null);
    setCaptureMode(null);
    setStep('selector');
  }, [stopStream, gonio]);

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
                    <StatusPill angle={r.angle} normalMin={r.normalMin} />
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
            <p style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>{selectedTest.instruction}</p>
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
    const nextPointIdx = gonio.points.length;
    const nextLabel = nextPointIdx < 3 ? `${['A', 'B', 'C'][nextPointIdx]} — ${pointLabels[nextPointIdx]}` : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={handleBack} className="text-slate-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-white font-bold">{selectedTest?.label}</h2>
        </div>

        {nextLabel && (
          <p className="text-center text-sky-400 font-semibold text-sm bg-sky-900/30 rounded-xl py-2 px-4">
            Tocá para marcar el punto <strong>{nextLabel}</strong>
          </p>
        )}
        {gonio.isFull && gonio.angle != null && (
          <p className="text-center text-slate-400 text-sm">
            Arrastrar los puntos para ajustar
          </p>
        )}
        {selectedTest?.protocol && (
          <div style={{
            padding: '8px 16px',
            background: 'rgba(56,189,248,0.06)',
            borderRadius: 10,
            border: '1px solid #1e293b',
          }}>
            <p style={{ color: '#64748b', fontSize: 11, margin: 0, fontStyle: 'italic' }}>
              📐 {selectedTest.protocol}
            </p>
          </div>
        )}

        <div
          ref={gonio.containerRef}
          className="relative w-full select-none"
          style={{ touchAction: 'none' }}
        >
          <img
            ref={gonio.imageRef}
            src={imageSrc}
            alt="Captura"
            className="w-full object-contain rounded-xl block"
            draggable={false}
            onLoad={onImgLoad}
            style={{ userSelect: 'none' }}
          />
          <GoniometerCanvas
            points={gonio.points}
            angle={gonio.angle}
            imageSize={imageSize}
            displaySize={displaySize}
            pointLabels={pointLabels}
            vertexIndex={selectedTest?.vertexIndex ?? 1}
            angleColor={angleColor}
            onTap={onTap}
            onDragPoint={onDragPoint}
            onDragStart={gonio.startDrag}
            onDragEnd={gonio.endDrag}
            dragging={gonio.draggingIdx}
            disabled={!imageReady}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { gonio.reset(); }}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 font-semibold transition-colors"
          >
            <RotateCcw size={16} /> Limpiar
          </button>
          <button
            onClick={retakePhoto}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-3 font-semibold transition-colors"
          >
            <Camera size={16} /> Nueva foto
          </button>
          <button
            onClick={saveResult}
            disabled={gonio.angle == null}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 font-semibold transition-colors"
          >
            <CheckCircle size={16} /> Guardar
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
          <StatusPill angle={last?.angle} normalMin={last?.normalMin} />
          {last?.normalMin != null && (
            <p className="text-slate-500 text-xs">Normal: ≥{last.normalMin}°</p>
          )}
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
