import { useState } from 'react';
import bodyFrontal from '../assets/body-frontal.png';
import bodyPosterior from '../assets/body-posterior.png';

const LEVELS = ['normal', 'leve', 'moderado', 'alto', 'muy_alto'];

// Siluetas de fondo: PNG recortados al bounding box exacto de la figura,
// así el contenedor puede usar el aspect-ratio real de cada imagen y las
// zonas (viewBox "0 0 100 100", en % del bounding box) quedan alineadas
// sin medir nada en runtime.
const FRONTAL_ASPECT_RATIO = '709 / 1680';
const POSTERIOR_ASPECT_RATIO = '793 / 1841';

// --- Generadores de paths anatómicos -----------------------------------
// Cada zona se dibuja con una de estas formas paramétricas en vez de un
// óvalo genérico, para que cada parche siga mejor el contorno real del
// músculo. Reciben coordenadas en unidades del viewBox de cada vista.

// Cápsula/píldora con extremos redondeados, opcionalmente afinada en un
// extremo (taperTop/taperBot en 0-1, relativo al ancho w). Usada para
// bícep, tríceps, antebrazo, cuádricep, isquiotibial, gemelo, tibial.
function capsulePath(cx, cy, w, h, taperTop = 1, taperBot = 1) {
  const topW = (w / 2) * taperTop;
  const botW = (w / 2) * taperBot;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  return `M ${cx - topW},${top + topW}
    A ${topW},${topW} 0 0 1 ${cx + topW},${top + topW}
    L ${cx + botW},${bot - botW}
    A ${botW},${botW} 0 0 1 ${cx - botW},${bot - botW}
    Z`;
}

// Gota/lágrima: punta angosta arriba, bulbo redondeado abajo. Usada para
// aductores (siguiendo la cara interna del muslo).
function teardropPath(cx, cy, w, h) {
  const hw = w / 2;
  const top = cy - h / 2;
  const bot = cy + h / 2;
  const bulbCy = bot - hw;
  return `M ${cx},${top}
    C ${cx + hw * 1.4},${top + h * 0.35} ${cx + hw},${bulbCy - hw * 0.6} ${cx + hw},${bulbCy}
    A ${hw},${hw} 0 1 1 ${cx - hw},${bulbCy}
    C ${cx - hw},${bulbCy - hw * 0.6} ${cx - hw * 1.4},${top + h * 0.35} ${cx},${top}
    Z`;
}

// Rectángulo con esquinas redondeadas. Usado para abdomen (sup/inf) y lumbar.
function roundedRectPath(cx, cy, w, h, r) {
  const x = cx - w / 2, y = cy - h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  return `M ${x + rr},${y}
    H ${x + w - rr} A ${rr},${rr} 0 0 1 ${x + w},${y + rr}
    V ${y + h - rr} A ${rr},${rr} 0 0 1 ${x + w - rr},${y + h}
    H ${x + rr} A ${rr},${rr} 0 0 1 ${x},${y + h - rr}
    V ${y + rr} A ${rr},${rr} 0 0 1 ${x + rr},${y}
    Z`;
}

// Trapecio posterior: forma de cometa ancha en el cuello/hombros que se
// afina hacia la columna torácica media, representando el músculo completo.
function trapeziusPath(cx, topY, bottomY, topW, botW) {
  const midY = (topY + bottomY) / 2;
  return `M ${cx - topW / 2},${topY + topW * 0.15}
    Q ${cx},${topY - topW * 0.1} ${cx + topW / 2},${topY + topW * 0.15}
    Q ${cx + topW * 0.32},${midY} ${cx + botW / 2},${bottomY}
    Q ${cx},${bottomY + botW * 0.8} ${cx - botW / 2},${bottomY}
    Q ${cx - topW * 0.32},${midY} ${cx - topW / 2},${topY + topW * 0.15}
    Z`;
}

// Zonas sin dato quedan invisibles (solo la silueta de fondo se ve); el
// glow (feGaussianBlur, ver GlowDefs) es lo que le da a las zonas con dato
// el look de "mancha de calor" difuminada en vez de un parche con borde duro.
const COLORS = {
  normal:   { fill: 'transparent' },
  leve:     { fill: '#22c55e' },
  moderado: { fill: '#facc15' },
  alto:     { fill: '#f97316' },
  muy_alto: { fill: '#ef4444' },
};

function GlowDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter id="zoneGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
    </svg>
  );
}

const ZONE_NAMES = {
  f_hombro_der: 'Hombro der', f_hombro_izq: 'Hombro izq',
  f_pectoral_der: 'Pectoral der', f_pectoral_izq: 'Pectoral izq',
  f_bicep_der: 'Bícep der', f_bicep_izq: 'Bícep izq',
  f_antebrazo_der: 'Antebrazo der', f_antebrazo_izq: 'Antebrazo izq',
  f_abdomen_sup: 'Abdomen superior', f_abdomen_inf: 'Abdomen inferior',
  f_aductor_der: 'Aductor der', f_aductor_izq: 'Aductor izq',
  f_cuadricep_der: 'Cuádricep der', f_cuadricep_izq: 'Cuádricep izq',
  f_rodilla_der: 'Rodilla der', f_rodilla_izq: 'Rodilla izq',
  f_tibial_der: 'Tibial der', f_tibial_izq: 'Tibial izq',
  p_trapecio: 'Trapecio',
  p_hombro_der: 'Hombro der', p_hombro_izq: 'Hombro izq',
  p_tricep_der: 'Trícep der', p_tricep_izq: 'Trícep izq',
  p_antebrazo_der: 'Antebrazo der', p_antebrazo_izq: 'Antebrazo izq',
  p_lumbar: 'Lumbar',
  p_gluteo_der: 'Glúteo der', p_gluteo_izq: 'Glúteo izq',
  p_isquio_der: 'Isquiotibial der', p_isquio_izq: 'Isquiotibial izq',
  p_gemelo_der: 'Gemelo der', p_gemelo_izq: 'Gemelo izq',
  p_aquiles_der: 'Aquiles der', p_aquiles_izq: 'Aquiles izq',
};

function Zone({ id, tag: Tag, attrs, selectedZones, onSelectZone, interactive, setTooltip }) {
  const level = selectedZones[id] || 'normal';
  const { fill } = COLORS[level];
  const [hovered, setHovered] = useState(false);
  const handleClick = () => { if (interactive && onSelectZone) onSelectZone(id); };
  return (
    <g
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      onClick={handleClick}
      onMouseEnter={() => { setHovered(true); setTooltip(ZONE_NAMES[id]); }}
      onMouseLeave={() => { setHovered(false); setTooltip(null); }}
    >
      {level !== 'normal' && (
        <Tag {...attrs} fill={fill} filter="url(#zoneGlow)" style={{ transition: 'fill 0.2s ease' }} />
      )}
      {/* capa invisible: hit area de click + contorno nítido solo al hover */}
      <Tag {...attrs} fill="transparent"
        stroke={hovered && interactive ? '#38bdf8' : 'transparent'}
        strokeWidth={1.5}
        style={{ transition: 'stroke 0.2s ease' }}
      />
    </g>
  );
}

function FrontalView({ selectedZones, onSelectZone, interactive, setTooltip }) {
  const zp = (id, tag, attrs) => ({ id, tag, attrs, selectedZones, onSelectZone, interactive, setTooltip });
  return (
    <div style={{ position: 'relative', width: 126, aspectRatio: FRONTAL_ASPECT_RATIO }}>
      <img src={bodyFrontal} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      {/* viewBox alto = 100 * (1680/709), igual al aspect ratio real de la imagen,
          así 1 unidad de x y de y ocupan el mismo tamaño en pantalla (sin distorsión). */}
      <svg viewBox="0 0 100 237" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <Zone {...zp('f_hombro_der',    'ellipse', { cx:23, cy:54.5,  rx:7,  ry:11.9 })}/>
      <Zone {...zp('f_hombro_izq',    'ellipse', { cx:77, cy:54.5,  rx:7,  ry:11.9 })}/>
      <Zone {...zp('f_pectoral_der',  'ellipse', { cx:39, cy:61.6,  rx:9,  ry:15.4 })}/>
      <Zone {...zp('f_pectoral_izq',  'ellipse', { cx:61, cy:61.6,  rx:9,  ry:15.4 })}/>
      <Zone {...zp('f_bicep_der',     'path', { d: capsulePath(18, 87.7,  10, 30.8, 1, 0.85) })}/>
      <Zone {...zp('f_bicep_izq',     'path', { d: capsulePath(82, 87.7,  10, 30.8, 1, 0.85) })}/>
      <Zone {...zp('f_antebrazo_der', 'path', { d: capsulePath(12, 116.1, 9, 28.4, 1, 0.7) })}/>
      <Zone {...zp('f_antebrazo_izq', 'path', { d: capsulePath(88, 116.1, 9, 28.4, 1, 0.7) })}/>
      <Zone {...zp('f_abdomen_sup',   'path', { d: roundedRectPath(50, 90.1,  24, 19, 8) })}/>
      <Zone {...zp('f_abdomen_inf',   'path', { d: roundedRectPath(50, 111.4, 22, 19, 8) })}/>
      <Zone {...zp('f_aductor_der',   'path', { d: teardropPath(44, 151.7, 8, 37.9) })}/>
      <Zone {...zp('f_aductor_izq',   'path', { d: teardropPath(56, 151.7, 8, 37.9) })}/>
      <Zone {...zp('f_cuadricep_der', 'path', { d: capsulePath(32, 151.7, 13, 37.9, 0.85, 1) })}/>
      <Zone {...zp('f_cuadricep_izq', 'path', { d: capsulePath(68, 151.7, 13, 37.9, 0.85, 1) })}/>
      <Zone {...zp('f_rodilla_der',   'ellipse', { cx:33, cy:180.1, rx:4.5, ry:7.1 })}/>
      <Zone {...zp('f_rodilla_izq',   'ellipse', { cx:67, cy:180.1, rx:4.5, ry:7.1 })}/>
      <Zone {...zp('f_tibial_der',    'path', { d: capsulePath(34, 206.2, 7, 33.2, 1, 0.8) })}/>
      <Zone {...zp('f_tibial_izq',    'path', { d: capsulePath(66, 206.2, 7, 33.2, 1, 0.8) })}/>
      </svg>
    </div>
  );
}

function PosteriorView({ selectedZones, onSelectZone, interactive, setTooltip }) {
  const zp = (id, tag, attrs) => ({ id, tag, attrs, selectedZones, onSelectZone, interactive, setTooltip });
  return (
    <div style={{ position: 'relative', width: 126, aspectRatio: POSTERIOR_ASPECT_RATIO }}>
      <img src={bodyPosterior} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      {/* viewBox alto = 100 * (1841/793), igual al aspect ratio real de la imagen. */}
      <svg viewBox="0 0 100 232" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <Zone {...zp('p_trapecio',      'path', { d: trapeziusPath(50, 39.4, 78.9, 26, 5) })}/>
      <Zone {...zp('p_hombro_izq',    'ellipse', { cx:23, cy:53.4,  rx:7,  ry:11.6 })}/>
      <Zone {...zp('p_hombro_der',    'ellipse', { cx:77, cy:53.4,  rx:7,  ry:11.6 })}/>
      <Zone {...zp('p_tricep_izq',    'path', { d: capsulePath(18, 85.8,  10, 30.2, 1, 0.85) })}/>
      <Zone {...zp('p_tricep_der',    'path', { d: capsulePath(82, 85.8,  10, 30.2, 1, 0.85) })}/>
      <Zone {...zp('p_antebrazo_izq', 'path', { d: capsulePath(12, 113.7, 9, 27.8, 1, 0.7) })}/>
      <Zone {...zp('p_antebrazo_der', 'path', { d: capsulePath(88, 113.7, 9, 27.8, 1, 0.7) })}/>
      <Zone {...zp('p_lumbar',        'path', { d: roundedRectPath(50, 125.3, 34, 23.2, 10) })}/>
      <Zone {...zp('p_gluteo_izq',    'ellipse', { cx:40, cy:146.2, rx:10, ry:12.8 })}/>
      <Zone {...zp('p_gluteo_der',    'ellipse', { cx:60, cy:146.2, rx:10, ry:12.8 })}/>
      <Zone {...zp('p_isquio_izq',    'path', { d: capsulePath(37, 176.3, 15, 34.8, 0.85, 1) })}/>
      <Zone {...zp('p_isquio_der',    'path', { d: capsulePath(63, 176.3, 15, 34.8, 0.85, 1) })}/>
      <Zone {...zp('p_gemelo_izq',    'path', { d: capsulePath(38, 206.5, 12, 25.5, 0.85, 1) })}/>
      <Zone {...zp('p_gemelo_der',    'path', { d: capsulePath(62, 206.5, 12, 25.5, 0.85, 1) })}/>
      <Zone {...zp('p_aquiles_izq',   'ellipse', { cx:39, cy:222.7, rx:2.5, ry:6.9 })}/>
      <Zone {...zp('p_aquiles_der',   'ellipse', { cx:61, cy:222.7, rx:2.5, ry:6.9 })}/>
      </svg>
    </div>
  );
}

const LEGEND = [
  { level: 'leve',     label: 'Leve',     color: '#22c55e' },
  { level: 'moderado', label: 'Moderado', color: '#facc15' },
  { level: 'alto',     label: 'Importante', color: '#f97316' },
  { level: 'muy_alto', label: 'Severo',   color: '#ef4444' },
];

export default function BodyHeatmapSimple({ selectedZones = {}, onSelectZone, interactive = true }) {
  const [tooltip, setTooltip] = useState(null);
  const [internalZones, setInternalZones] = useState({});
  const zones = onSelectZone ? selectedZones : internalZones;
  const handleSelect = (id) => {
    if (onSelectZone) {
      onSelectZone(id);
    } else {
      setInternalZones(prev => {
        const cur = prev[id] || 'normal';
        const next = LEVELS[(LEVELS.indexOf(cur) + 1) % LEVELS.length];
        return { ...prev, [id]: next };
      });
    }
  };
  const viewProps = { selectedZones: zones, onSelectZone: handleSelect, interactive, setTooltip };
  return (
    <div style={{ position: 'relative' }}>
      <GlowDefs />
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
        {LEGEND.map(({ level, label, color }) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }}/>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
