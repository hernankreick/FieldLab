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

const COLORS = {
  normal:   { fill: '#1e3a5f',                  stroke: 'rgba(148,163,184,0.3)' },
  leve:     { fill: 'rgba(56,189,248,0.45)',     stroke: '#38bdf8' },
  moderado: { fill: 'rgba(245,158,11,0.45)',     stroke: '#f59e0b' },
  alto:     { fill: 'rgba(249,115,22,0.5)',      stroke: '#f97316' },
  muy_alto: { fill: 'rgba(239,68,68,0.55)',      stroke: '#ef4444' },
};

const ZONE_NAMES = {
  f_hombro_der: 'Hombro der', f_hombro_izq: 'Hombro izq',
  f_pectoral_der: 'Pectoral der', f_pectoral_izq: 'Pectoral izq',
  f_bicep_der: 'Bícep der', f_bicep_izq: 'Bícep izq',
  f_abdomen: 'Abdomen',
  f_antebrazo_der: 'Antebrazo der', f_antebrazo_izq: 'Antebrazo izq',
  f_cuadricep_der: 'Cuádricep der', f_cuadricep_izq: 'Cuádricep izq',
  f_aductor_der: 'Aductor der', f_aductor_izq: 'Aductor izq',
  p_trapecio: 'Trapecios',
  p_hombro_der: 'Hombro der', p_hombro_izq: 'Hombro izq',
  p_tricep_der: 'Trícep der', p_tricep_izq: 'Trícep izq',
  p_antebrazo_der: 'Antebrazo der', p_antebrazo_izq: 'Antebrazo izq',
  p_lumbar: 'Lumbar',
  p_gluteo_der: 'Glúteo der', p_gluteo_izq: 'Glúteo izq',
  p_isquio_der: 'Isquiotibial der', p_isquio_izq: 'Isquiotibial izq',
  p_gemelo_der: 'Gemelo der', p_gemelo_izq: 'Gemelo izq',
};

function Zone({ id, tag: Tag, attrs, selectedZones, onSelectZone, interactive, setTooltip }) {
  const level = selectedZones[id] || 'normal';
  const { fill, stroke } = COLORS[level];
  const [hovered, setHovered] = useState(false);
  const handleClick = () => { if (interactive && onSelectZone) onSelectZone(id); };
  return (
    <Tag {...attrs} fill={fill}
      stroke={hovered && interactive ? '#38bdf8' : stroke}
      strokeWidth={hovered && interactive ? 1.5 : 1}
      style={{ cursor: interactive ? 'pointer' : 'default', transition: 'fill 0.2s ease, stroke 0.2s ease' }}
      onClick={handleClick}
      onMouseEnter={() => { setHovered(true); setTooltip(ZONE_NAMES[id]); }}
      onMouseLeave={() => { setHovered(false); setTooltip(null); }}
    />
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
      <Zone {...zp('f_hombro_der',    'ellipse', { cx:23, cy:56.9,  rx:7, ry:11 })}/>
      <Zone {...zp('f_hombro_izq',    'ellipse', { cx:77, cy:56.9,  rx:7, ry:11 })}/>
      <Zone {...zp('f_pectoral_der',  'ellipse', { cx:40, cy:62,    rx:9, ry:12 })}/>
      <Zone {...zp('f_pectoral_izq',  'ellipse', { cx:60, cy:62,    rx:9, ry:12 })}/>
      <Zone {...zp('f_bicep_der',     'ellipse', { cx:18, cy:90,    rx:6, ry:15 })}/>
      <Zone {...zp('f_bicep_izq',     'ellipse', { cx:82, cy:90,    rx:6, ry:15 })}/>
      <Zone {...zp('f_abdomen',       'ellipse', { cx:50, cy:98,    rx:17, ry:15 })}/>
      <Zone {...zp('f_antebrazo_der', 'ellipse', { cx:12, cy:118,   rx:6, ry:10 })}/>
      <Zone {...zp('f_antebrazo_izq', 'ellipse', { cx:88, cy:118,   rx:6, ry:10 })}/>
      <Zone {...zp('f_cuadricep_der', 'ellipse', { cx:32, cy:162,   rx:7, ry:20 })}/>
      <Zone {...zp('f_aductor_der',   'ellipse', { cx:45, cy:162,   rx:4, ry:20 })}/>
      <Zone {...zp('f_aductor_izq',   'ellipse', { cx:55, cy:162,   rx:4, ry:20 })}/>
      <Zone {...zp('f_cuadricep_izq', 'ellipse', { cx:68, cy:162,   rx:7, ry:20 })}/>
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
      <Zone {...zp('p_trapecio',      'polygon', { points: '37,37 63,37 50,72' })}/>
      <Zone {...zp('p_hombro_izq',    'ellipse', { cx:23, cy:55,  rx:7,  ry:11 })}/>
      <Zone {...zp('p_hombro_der',    'ellipse', { cx:77, cy:55,  rx:7,  ry:11 })}/>
      <Zone {...zp('p_tricep_izq',    'ellipse', { cx:17, cy:86,  rx:7,  ry:12 })}/>
      <Zone {...zp('p_tricep_der',    'ellipse', { cx:83, cy:86,  rx:7,  ry:12 })}/>
      <Zone {...zp('p_antebrazo_izq', 'ellipse', { cx:13, cy:114, rx:7,  ry:11 })}/>
      <Zone {...zp('p_antebrazo_der', 'ellipse', { cx:87, cy:114, rx:7,  ry:11 })}/>
      <Zone {...zp('p_lumbar',        'ellipse', { cx:50, cy:125, rx:17, ry:11 })}/>
      <Zone {...zp('p_gluteo_izq',    'ellipse', { cx:40, cy:146, rx:11, ry:12 })}/>
      <Zone {...zp('p_gluteo_der',    'ellipse', { cx:60, cy:146, rx:11, ry:12 })}/>
      <Zone {...zp('p_isquio_izq',    'ellipse', { cx:37, cy:177, rx:8,  ry:17 })}/>
      <Zone {...zp('p_isquio_der',    'ellipse', { cx:63, cy:177, rx:8,  ry:17 })}/>
      <Zone {...zp('p_gemelo_izq',    'ellipse', { cx:38, cy:207, rx:6,  ry:15 })}/>
      <Zone {...zp('p_gemelo_der',    'ellipse', { cx:62, cy:207, rx:6,  ry:15 })}/>
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
    </div>
  );
}
