import { useState } from 'react';
import Model from 'react-body-highlighter';

const LEVELS = ['normal', 'leve', 'moderado', 'alto', 'muy_alto'];
const SEVERITY_OPTIONS = [
  { level: 'normal',   label: 'Sin dolor' },
  { level: 'leve',     label: 'Leve' },
  { level: 'moderado', label: 'Moderado' },
  { level: 'alto',     label: 'Alto' },
  { level: 'muy_alto', label: 'Severo' },
];

// react-body-highlighter queda fijado en 2.0.5 sin "^" en package.json:
// las formas de abajo son las coordenadas svgPoints REALES de esa version
// exacta (extraidas y verificadas byte a byte contra
// dist/react-body-highlighter.cjs.development.js). Un npm install que
// traiga una version distinta podria cambiar esas coordenadas y romper
// el mapeo en silencio, por eso la version queda pineada.
const BODY_ASPECT_RATIO = '100 / 200';
const BODY_COLOR = '#16243a';

const COLORS = {
  normal:   { fill: '#1e3a5f',                  stroke: 'rgba(148,163,184,0.3)' },
  leve:     { fill: 'rgba(56,189,248,0.45)',     stroke: '#38bdf8' },
  moderado: { fill: 'rgba(245,158,11,0.45)',     stroke: '#f59e0b' },
  alto:     { fill: 'rgba(249,115,22,0.5)',      stroke: '#f97316' },
  muy_alto: { fill: 'rgba(239,68,68,0.55)',      stroke: '#ef4444' },
};

const FRONT = {
  cuello: [
    '55.5102041 23.6734694 50.6122449 33.4693878 50.6122449 39.1836735 61.6326531 40 70.6122449 44.8979592 69.3877551 36.7346939 63.2653061 35.1020408 58.3673469 30.6122449',
    '28.9795918 44.8979592 30.2040816 37.1428571 36.3265306 35.1020408 41.2244898 30.2040816 44.4897959 24.4897959 48.9795918 33.877551 48.5714286 39.1836735 37.9591837 39.5918367',
  ],
  hombro_izq: ['78.3673469 53.0612245 79.5918367 47.755102 79.1836735 41.2244898 75.9183673 37.9591837 71.0204082 36.3265306 72.244898 42.8571429 71.4285714 47.3469388'],
  hombro_der: ['28.1632653 47.3469388 21.2244898 53.0612245 20 47.755102 20.4081633 40.8163265 24.4897959 37.1428571 28.5714286 37.1428571 26.9387755 43.2653061'],
  pectoral: [
    '51.8367347 41.6326531 51.0204082 55.1020408 57.9591837 57.9591837 67.755102 55.5102041 70.6122449 47.3469388 62.0408163 41.6326531',
    '29.7959184 46.5306122 31.4285714 55.5102041 40.8163265 57.9591837 48.1632653 55.1020408 47.755102 42.0408163 37.5510204 42.0408163',
  ],
  abdomen: [
    '56.3265306 59.1836735 57.9591837 64.0816327 58.3673469 77.9591837 58.3673469 92.6530612 56.3265306 98.3673469 55.1020408 104.081633 51.4285714 107.755102 51.0204082 84.4897959 50.6122449 67.3469388 51.0204082 57.1428571',
    '43.6734694 58.7755102 48.5714286 57.1428571 48.9795918 67.3469388 48.5714286 84.4897959 48.1632653 107.346939 44.4897959 103.673469 40.8163265 91.4285714 40.8163265 78.3673469 41.2244898 64.4897959',
  ],
  oblicuo_izq: ['68.5714286 63.2653061 67.3469388 57.1428571 58.7755102 59.5918367 60 64.0816327 60.4081633 83.2653061 65.7142857 78.7755102 66.5306122 69.7959184'],
  oblicuo_der: ['33.877551 78.3673469 33.0612245 71.8367347 31.0204082 63.2653061 32.244898 57.1428571 40.8163265 59.1836735 39.1836735 63.2653061 39.1836735 83.6734694'],
  biceps_izq: ['71.4285714 49.3877551 70.2040816 54.6938776 76.3265306 66.122449 81.6326531 71.8367347 82.8571429 68.9795918 78.7755102 55.5102041'],
  biceps_der: ['16.7346939 68.1632653 17.9591837 71.4285714 22.8571429 66.122449 28.9795918 53.877551 27.755102 49.3877551 20.4081633 55.9183673'],
  aductor_izq: ['52.6530612 110.204082 54.2857143 124.897959 60 110.204082 62.0408163 100 64.8979592 94.2857143 60 92.6530612 56.7346939 104.489796'],
  aductor_der: ['47.755102 110.612245 44.8979592 125.306122 42.0408163 115.918367 40.4081633 113.061224 39.5918367 107.346939 37.9591837 102.44898 34.6938776 93.877551 39.5918367 92.244898 41.6326531 99.1836735 43.6734694 105.306122'],
  cuadricep_izq: [
    '63.2653061 105.714286 64.4897959 100 66.9387755 94.6938776 70.2040816 101.22449 71.0204082 111.836735 68.1632653 133.061224 65.3061224 137.55102 62.4489796 128.571429 62.0408163 111.428571',
    '59.5918367 145.714286 55.5102041 128.979592 60.8163265 113.877551 61.2244898 130.204082 64.0816327 139.591837 62.8571429 146.530612',
    '71.8367347 113.061224 73.877551 124.081633 73.877551 140.408163 72.6530612 145.714286 66.5306122 138.367347 70.2040816 133.469388',
  ],
  cuadricep_der: [
    '34.6938776 98.7755102 37.1428571 108.163265 37.1428571 127.755102 34.2857143 137.142857 31.0204082 132.653061 29.3877551 120 28.1632653 111.428571 29.3877551 100.816327 32.244898 94.6938776',
    '38.7755102 129.387755 38.3673469 112.244898 41.2244898 118.367347 44.4897959 129.387755 42.8571429 135.102041 40 146.122449 36.3265306 146.530612 35.5102041 140',
    '32.6530612 138.367347 26.5306122 145.714286 25.7142857 136.734694 25.7142857 127.346939 26.9387755 114.285714 29.3877551 133.469388',
  ],
  rodilla_der: ['33.877551 140 34.6938776 143.265306 35.5102041 147.346939 36.3265306 151.020408 35.1020408 156.734694 29.7959184 156.734694 27.3469388 152.653061 27.3469388 147.346939 30.2040816 144.081633'],
  rodilla_izq: ['65.7142857 140 72.244898 147.755102 72.244898 152.244898 69.7959184 157.142857 64.8979592 156.734694 62.8571429 151.020408'],
  tibial_izq: [
    '71.4285714 160.408163 73.4693878 153.469388 76.7346939 161.22449 79.5918367 167.755102 78.3673469 187.755102 79.5918367 195.510204 74.6938776 195.510204',
    '72.6530612 195.102041 69.7959184 159.183673 65.3061224 158.367347 64.0816327 162.44898 64.0816327 165.306122 65.7142857 177.142857',
  ],
  tibial_der: [
    '24.8979592 194.693878 27.755102 164.897959 28.1632653 160.408163 26.122449 154.285714 24.8979592 157.55102 22.4489796 161.632653 20.8163265 167.755102 22.0408163 188.163265 20.8163265 195.510204',
    '35.5102041 158.367347 35.9183673 162.44898 35.9183673 166.938776 35.1020408 172.244898 35.1020408 176.734694 32.244898 182.040816 30.6122449 187.346939 26.9387755 194.693878 27.3469388 187.755102 28.1632653 180.408163 28.5714286 175.510204 28.9795918 169.795918 29.7959184 164.081633 30.2040816 158.77551',
  ],
};

const BACK = {
  trapecio: [
    '44.6808511 21.7021277 47.6595745 21.7021277 47.2340426 38.2978723 47.6595745 64.6808511 38.2978723 53.1914894 35.3191489 40.8510638 31.0638298 36.5957447 39.1489362 33.1914894 43.8297872 27.2340426',
    '52.3404255 21.7021277 55.7446809 21.7021277 56.5957447 27.2340426 60.8510638 32.7659574 68.9361702 36.5957447 64.6808511 40.4255319 61.7021277 53.1914894 52.3404255 64.6808511 53.1914894 38.2978723',
  ],
  hombro_post_izq: ['29.3617021 37.0212766 22.9787234 39.1489362 17.4468085 44.2553191 18.2978723 53.6170213 24.2553191 49.3617021 27.2340426 46.3829787'],
  hombro_post_der: ['71.0638298 37.0212766 78.2978723 39.5744681 82.5531915 44.6808511 81.7021277 53.6170213 74.893617 48.9361702 72.3404255 45.106383'],
  dorsal_izq: ['31.0638298 38.7234043 28.0851064 48.9361702 28.5106383 55.3191489 34.0425532 75.3191489 47.2340426 71.0638298 47.2340426 66.3829787 36.5957447 54.0425532 33.6170213 41.2765957'],
  dorsal_der: ['68.9361702 38.7234043 71.9148936 49.3617021 71.4893617 56.1702128 65.9574468 75.3191489 52.7659574 71.0638298 52.7659574 66.3829787 63.4042553 54.4680851 66.3829787 41.7021277'],
  triceps_der: [
    '73.6170213 50.212766 82.1276596 55.7446809 85.9574468 73.1914894 83.4042553 82.1276596 77.8723404 62.9787234 73.1914894 55.7446809',
    '72.7659574 58.2978723 77.0212766 64.6808511 80.4255319 77.4468085 76.5957447 75.3191489 72.7659574 68.9361702',
  ],
  triceps_izq: [
    '26.8085106 49.787234 17.8723404 55.7446809 14.4680851 72.3404255 16.5957447 81.7021277 21.7021277 63.8297872 26.8085106 55.7446809',
    '26.8085106 58.2978723 26.8085106 68.5106383 22.9787234 75.3191489 19.1489362 77.4468085 22.5531915 65.5319149',
  ],
  lumbar: [
    '47.6595745 72.7659574 34.4680851 77.0212766 35.3191489 83.4042553 49.3617021 102.12766 46.8085106 82.9787234',
    '52.3404255 72.7659574 65.5319149 77.0212766 64.6808511 83.4042553 50.6382979 102.12766 53.1914894 83.8297872',
  ],
  // Glúteo mayor/medio: la librería solo tiene UN polígono "gluteal" por
  // lado, sin dividir. Estos puntos parten ESE hexágono real en dos con
  // un corte recto en y=109 (unidades del viewBox 0 0 100 200), calculado
  // por intersección con los dos lados del hexágono que cruzan esa altura
  // — no son datos de la librería, es una aproximación geométrica propia
  // sobre el polígono real (documentado a propósito para quien lo lea después).
  gluteo_medio_izq: ['47.56 109 44.68 99.57 30.21 108.51'],
  gluteo_mayor_izq: ['30.19 109 29.79 118.72 31.49 125.96 47.23 121.28 49.36 114.89 47.56 109'],
  gluteo_medio_der: ['69.36 108.51 55.32 99.15 52.58 109'],
  gluteo_mayor_der: ['52.58 109 51.06 114.47 52.34 120.85 68.09 125.96 69.79 119.15 69.38 109'],
  isquio_izq: [
    '28.9361702 122.12766 31.0638298 129.361702 36.5957447 125.957447 35.3191489 135.319149 34.4680851 150.212766 29.3617021 158.297872 28.9361702 146.808511 27.6595745 141.276596 27.2340426 131.489362',
    '38.7234043 125.531915 44.2553191 145.957447 40.4255319 166.808511 36.1702128 152.765957 37.0212766 135.319149',
  ],
  isquio_der: [
    '71.4893617 121.702128 69.3617021 128.93617 63.8297872 125.957447 65.5319149 136.595745 66.3829787 150.212766 71.0638298 158.297872 71.4893617 147.659574 72.7659574 142.12766 73.6170213 131.914894',
    '61.7021277 125.531915 63.4042553 136.170213 64.2553191 153.191489 60 166.808511 56.1702128 146.382979',
  ],
  gemelo_izq: [
    '29.3617021 160.425532 28.5106383 167.234043 24.6808511 179.574468 23.8297872 192.765957 25.5319149 197.021277 28.5106383 193.191489 29.787234 180 31.9148936 171.06383 31.9148936 166.808511',
    '37.4468085 165.106383 35.3191489 167.659574 33.1914894 171.914894 31.0638298 180.425532 30.212766 191.914894 34.0425532 200 38.7234043 190.638298 39.1489362 168.93617',
  ],
  gemelo_der: [
    '62.9787234 165.106383 61.2765957 168.510638 61.7021277 190.638298 66.3829787 199.574468 70.6382979 191.914894 68.9361702 179.574468 66.8085106 170.212766',
    '70.6382979 160.425532 72.3404255 168.510638 75.7446809 179.148936 76.5957447 192.765957 74.4680851 196.595745 72.3404255 193.617021 70.6382979 179.574468 68.0851064 168.085106',
  ],
};

const ZONE_NAMES = {
  cuello: 'Cuello',
  hombro_izq: 'Hombro izq', hombro_der: 'Hombro der',
  pectoral: 'Pectoral',
  abdomen: 'Abdomen',
  oblicuo_izq: 'Oblicuo izq', oblicuo_der: 'Oblicuo der',
  biceps_izq: 'Bícep izq', biceps_der: 'Bícep der',
  aductor_izq: 'Aductor izq', aductor_der: 'Aductor der',
  cuadricep_izq: 'Cuádricep izq', cuadricep_der: 'Cuádricep der',
  rodilla_izq: 'Rodilla izq', rodilla_der: 'Rodilla der',
  tibial_izq: 'Tibial izq', tibial_der: 'Tibial der',
  trapecio: 'Trapecio',
  hombro_post_izq: 'Hombro post. izq', hombro_post_der: 'Hombro post. der',
  dorsal_izq: 'Dorsal izq', dorsal_der: 'Dorsal der',
  triceps_izq: 'Trícep izq', triceps_der: 'Trícep der',
  lumbar: 'Lumbar',
  gluteo_mayor_izq: 'Glúteo mayor izq', gluteo_mayor_der: 'Glúteo mayor der',
  gluteo_medio_izq: 'Glúteo medio izq', gluteo_medio_der: 'Glúteo medio der',
  isquio_izq: 'Isquiotibial izq', isquio_der: 'Isquiotibial der',
  gemelo_izq: 'Gemelo izq', gemelo_der: 'Gemelo der',
};

// Nombre de grupo (sin lado) mostrado en el selector Izquierda/Derecha.
const GROUP_NAMES = {
  hombro: 'Hombro',
  oblicuo: 'Oblicuo',
  biceps: 'Bícep',
  aductor: 'Aductor',
  cuadricep: 'Cuádricep',
  rodilla: 'Rodilla',
  tibial: 'Tibial',
  hombro_post: 'Hombro (posterior)',
  dorsal: 'Dorsal',
  triceps: 'Trícep',
  gluteo_mayor: 'Glúteo mayor',
  gluteo_medio: 'Glúteo medio',
  isquio: 'Isquiotibial',
  gemelo: 'Gemelo',
};

const SIDED_SUFFIX = /_(izq|der)$/;

function ZoneShape({ id, points, selectedZones, interactive, onZoneClick, setTooltip }) {
  const level = selectedZones[id] || 'normal';
  const { fill, stroke } = COLORS[level];
  const [hovered, setHovered] = useState(false);
  return (
    <g
      data-zone-id={id}
      onClick={() => interactive && onZoneClick(id)}
      onMouseEnter={() => { setHovered(true); setTooltip(ZONE_NAMES[id]); }}
      onMouseLeave={() => { setHovered(false); setTooltip(null); }}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
    >
      {points.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill={fill}
          stroke={hovered && interactive ? '#38bdf8' : stroke}
          strokeWidth={hovered && interactive ? 1 : 0.6}
          strokeLinejoin="round"
          style={{ transition: 'fill 0.2s ease, stroke 0.2s ease' }}
        />
      ))}
    </g>
  );
}

function FrontalView({ selectedZones, interactive, onZoneClick, setTooltip }) {
  return (
    <div style={{ position: 'relative', width: 126, aspectRatio: BODY_ASPECT_RATIO }}>
      <Model
        type="anterior"
        bodyColor={BODY_COLOR}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        svgStyle={{ width: '100%', height: '100%', display: 'block' }}
      />
      <svg viewBox="0 0 100 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {Object.entries(FRONT).map(([id, points]) => (
          <ZoneShape key={id} id={id} points={points} selectedZones={selectedZones}
            interactive={interactive} onZoneClick={onZoneClick} setTooltip={setTooltip} />
        ))}
      </svg>
    </div>
  );
}

function PosteriorView({ selectedZones, interactive, onZoneClick, setTooltip }) {
  return (
    <div style={{ position: 'relative', width: 126, aspectRatio: BODY_ASPECT_RATIO }}>
      <Model
        type="posterior"
        bodyColor={BODY_COLOR}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        svgStyle={{ width: '100%', height: '100%', display: 'block' }}
      />
      <svg viewBox="0 0 100 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {Object.entries(BACK).map(([id, points]) => (
          <ZoneShape key={id} id={id} points={points} selectedZones={selectedZones}
            interactive={interactive} onZoneClick={onZoneClick} setTooltip={setTooltip} />
        ))}
      </svg>
    </div>
  );
}

const LEGEND = [
  { level: 'normal',   label: 'Sin dolor', color: '#1e3a5f',               border: 'rgba(148,163,184,0.3)' },
  { level: 'leve',     label: 'Leve',      color: 'rgba(56,189,248,0.5)',  border: '#38bdf8' },
  { level: 'moderado', label: 'Moderado',  color: 'rgba(245,158,11,0.5)', border: '#f59e0b' },
  { level: 'alto',     label: 'Alto',      color: 'rgba(249,115,22,0.55)',border: '#f97316' },
  { level: 'muy_alto', label: 'Severo',    color: 'rgba(239,68,68,0.6)',  border: '#ef4444' },
];

const backdropStyle = {
  position: 'fixed', inset: 0, background: 'rgba(2,6,15,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
};
const cardStyle = {
  background: '#0f172a', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 12,
  padding: 16, minWidth: 220, boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
};
const cardTitleStyle = {
  fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#94a3b8', marginBottom: 12, textAlign: 'center',
};
const sideBtnStyle = {
  flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.3)',
  background: '#1e293b', color: '#e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
function severityBtnStyle(level) {
  const { fill, stroke } = COLORS[level];
  return {
    padding: '10px 12px', borderRadius: 8, border: `1px solid ${stroke}`,
    background: fill, color: '#e2e8f0', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', textAlign: 'left',
  };
}

export default function BodyHeatmapSimple({ selectedZones = {}, onSelectZone, interactive = true }) {
  const [tooltip, setTooltip] = useState(null);
  const [internalZones, setInternalZones] = useState({});
  const [pendingGroup, setPendingGroup] = useState(null);   // grupo esperando lado (izq/der)
  const [pendingZoneId, setPendingZoneId] = useState(null); // zona exacta esperando severidad
  const zones = interactive ? (onSelectZone ? selectedZones : internalZones) : selectedZones;

  const applyLevel = (id, level) => {
    if (onSelectZone) onSelectZone(id, level);
    else setInternalZones(prev => ({ ...prev, [id]: level }));
  };

  const handleZoneClick = (id) => {
    const match = id.match(SIDED_SUFFIX);
    if (match) setPendingGroup(id.slice(0, -match[0].length));
    else setPendingZoneId(id);
  };

  const pickSide = (side) => {
    setPendingZoneId(`${pendingGroup}_${side}`);
    setPendingGroup(null);
  };

  const pickSeverity = (level) => {
    applyLevel(pendingZoneId, level);
    setPendingZoneId(null);
  };

  const closeModals = () => { setPendingGroup(null); setPendingZoneId(null); };

  const viewProps = { selectedZones: zones, interactive, onZoneClick: handleZoneClick, setTooltip };

  return (
    <div style={{ position: 'relative' }}>
      {tooltip && (
        <div style={{ position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
          background: '#0f172a', border: '1px solid rgba(56,189,248,0.4)', color: '#e2e8f0',
          fontSize: 11, padding: '4px 9px', borderRadius: 5, pointerEvents: 'none',
          whiteSpace: 'nowrap', zIndex: 99 }}>
          {tooltip}
        </div>
      )}
      <div style={{ display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.12em', color: '#64748b', fontWeight: 500 }}>FRONTAL</span>
          <FrontalView {...viewProps} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, letterSpacing: '0.12em', color: '#64748b', fontWeight: 500 }}>POSTERIOR</span>
          <PosteriorView {...viewProps} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        {LEGEND.map(({ level, label, color, border }) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color, border: `1px solid ${border}` }}/>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
      </div>

      {pendingGroup && (
        <div style={backdropStyle} onClick={closeModals}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <p style={cardTitleStyle}>{GROUP_NAMES[pendingGroup] ?? pendingGroup} — ¿qué lado?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={sideBtnStyle} onClick={() => pickSide('der')}>Derecha</button>
              <button style={sideBtnStyle} onClick={() => pickSide('izq')}>Izquierda</button>
            </div>
          </div>
        </div>
      )}

      {pendingZoneId && (
        <div style={backdropStyle} onClick={closeModals}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <p style={cardTitleStyle}>{ZONE_NAMES[pendingZoneId] ?? pendingZoneId}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SEVERITY_OPTIONS.map(({ level, label }) => (
                <button key={level} style={severityBtnStyle(level)} onClick={() => pickSeverity(level)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
