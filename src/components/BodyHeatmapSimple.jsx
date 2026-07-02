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
  f_ingle_der: 'Ingle der', f_ingle_izq: 'Ingle izq',
  f_cuadricep_der: 'Cuádricep der', f_cuadricep_izq: 'Cuádricep izq',
  f_aductor_der: 'Aductor der', f_aductor_izq: 'Aductor izq',
  f_rodilla_der: 'Rodilla der', f_rodilla_izq: 'Rodilla izq',
  f_tibial_der: 'Tibial anterior der', f_tibial_izq: 'Tibial anterior izq',
  f_tobillo_der: 'Tobillo der', f_tobillo_izq: 'Tobillo izq',
  p_trapecio_sup: 'Trapecio superior',
  p_deltoides_izq: 'Deltoides post izq', p_deltoides_der: 'Deltoides post der',
  p_trapecio_inf: 'Trapecio inferior',
  p_tricep_izq: 'Trícep izq', p_tricep_der: 'Trícep der',
  p_dorsal_izq: 'Dorsal izq', p_dorsal_der: 'Dorsal der',
  p_antebrazo_izq: 'Antebrazo post izq', p_antebrazo_der: 'Antebrazo post der',
  p_lumbar: 'Lumbar',
  p_gluteo_medio_izq: 'Glúteo medio izq', p_gluteo_medio_der: 'Glúteo medio der',
  p_gluteo_mayor_izq: 'Glúteo mayor izq', p_gluteo_mayor_der: 'Glúteo mayor der',
  p_isquio_izq: 'Isquiotibial izq', p_isquio_der: 'Isquiotibial der',
  p_rodilla_izq: 'Rodilla post izq', p_rodilla_der: 'Rodilla post der',
  p_gemelo_izq: 'Gemelo izq', p_gemelo_der: 'Gemelo der',
  p_talon_izq: 'Talón izq', p_talon_der: 'Talón der',
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
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <Zone {...zp('f_hombro_der',    'rect',    { x:16, y:19, width:14, height:11, rx:3 })}/>
      <Zone {...zp('f_hombro_izq',    'rect',    { x:70, y:19, width:14, height:11, rx:3 })}/>
      <Zone {...zp('f_pectoral_der',  'rect',    { x:30, y:20, width:20, height:14, rx:3 })}/>
      <Zone {...zp('f_pectoral_izq',  'rect',    { x:50, y:20, width:20, height:14, rx:3 })}/>
      <Zone {...zp('f_bicep_der',     'rect',    { x:10, y:30, width:16, height:14, rx:3 })}/>
      <Zone {...zp('f_bicep_izq',     'rect',    { x:74, y:30, width:16, height:14, rx:3 })}/>
      <Zone {...zp('f_abdomen',       'rect',    { x:29, y:34, width:42, height:16, rx:3 })}/>
      <Zone {...zp('f_antebrazo_der', 'rect',    { x:6,  y:44, width:15, height:10, rx:3 })}/>
      <Zone {...zp('f_antebrazo_izq', 'rect',    { x:79, y:44, width:15, height:10, rx:3 })}/>
      <Zone {...zp('f_ingle_der',     'rect',    { x:29, y:50, width:20, height:8,  rx:3 })}/>
      <Zone {...zp('f_ingle_izq',     'rect',    { x:51, y:50, width:20, height:8,  rx:3 })}/>
      <Zone {...zp('f_cuadricep_der', 'rect',    { x:28, y:58, width:12, height:14, rx:3 })}/>
      <Zone {...zp('f_aductor_der',   'rect',    { x:40, y:58, width:9,  height:14, rx:3 })}/>
      <Zone {...zp('f_aductor_izq',   'rect',    { x:51, y:58, width:9,  height:14, rx:3 })}/>
      <Zone {...zp('f_cuadricep_izq', 'rect',    { x:60, y:58, width:12, height:14, rx:3 })}/>
      <Zone {...zp('f_rodilla_der',   'rect',    { x:29, y:72, width:16, height:8,  rx:3 })}/>
      <Zone {...zp('f_rodilla_izq',   'rect',    { x:55, y:72, width:16, height:8,  rx:3 })}/>
      <Zone {...zp('f_tibial_der',    'rect',    { x:30, y:80, width:14, height:10, rx:3 })}/>
      <Zone {...zp('f_tibial_izq',    'rect',    { x:56, y:80, width:14, height:10, rx:3 })}/>
      <Zone {...zp('f_tobillo_der',   'ellipse', { cx:37, cy:92, rx:6, ry:3 })}/>
      <Zone {...zp('f_tobillo_izq',   'ellipse', { cx:63, cy:92, rx:6, ry:3 })}/>
      </svg>
    </div>
  );
}

function PosteriorView({ selectedZones, onSelectZone, interactive, setTooltip }) {
  const zp = (id, tag, attrs) => ({ id, tag, attrs, selectedZones, onSelectZone, interactive, setTooltip });
  return (
    <div style={{ position: 'relative', width: 126, aspectRatio: POSTERIOR_ASPECT_RATIO }}>
      <img src={bodyPosterior} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <Zone {...zp('p_trapecio_sup',  'rect',    { x:33, y:17, width:34, height:8,  rx:3 })}/>
      <Zone {...zp('p_deltoides_izq', 'rect',    { x:16, y:19, width:14, height:11, rx:3 })}/>
      <Zone {...zp('p_deltoides_der', 'rect',    { x:70, y:19, width:14, height:11, rx:3 })}/>
      <Zone {...zp('p_trapecio_inf',  'rect',    { x:33, y:25, width:34, height:7,  rx:3 })}/>
      <Zone {...zp('p_tricep_izq',    'rect',    { x:10, y:30, width:16, height:14, rx:3 })}/>
      <Zone {...zp('p_tricep_der',    'rect',    { x:74, y:30, width:16, height:14, rx:3 })}/>
      <Zone {...zp('p_dorsal_izq',    'rect',    { x:28, y:32, width:21, height:18, rx:3 })}/>
      <Zone {...zp('p_dorsal_der',    'rect',    { x:51, y:32, width:21, height:18, rx:3 })}/>
      <Zone {...zp('p_antebrazo_izq', 'rect',    { x:6,  y:44, width:15, height:10, rx:3 })}/>
      <Zone {...zp('p_antebrazo_der', 'rect',    { x:79, y:44, width:15, height:10, rx:3 })}/>
      <Zone {...zp('p_lumbar',        'rect',    { x:29, y:50, width:42, height:8,  rx:3 })}/>
      <Zone {...zp('p_gluteo_medio_izq', 'rect', { x:28, y:58, width:20, height:5,  rx:3 })}/>
      <Zone {...zp('p_gluteo_medio_der', 'rect', { x:52, y:58, width:20, height:5,  rx:3 })}/>
      <Zone {...zp('p_gluteo_mayor_izq', 'rect', { x:28, y:63, width:20, height:7,  rx:3 })}/>
      <Zone {...zp('p_gluteo_mayor_der', 'rect', { x:52, y:63, width:20, height:7,  rx:3 })}/>
      <Zone {...zp('p_isquio_izq',    'rect',    { x:29, y:70, width:16, height:12, rx:3 })}/>
      <Zone {...zp('p_isquio_der',    'rect',    { x:55, y:70, width:16, height:12, rx:3 })}/>
      <Zone {...zp('p_rodilla_izq',   'rect',    { x:30, y:82, width:14, height:6,  rx:3 })}/>
      <Zone {...zp('p_rodilla_der',   'rect',    { x:56, y:82, width:14, height:6,  rx:3 })}/>
      <Zone {...zp('p_gemelo_izq',    'rect',    { x:31, y:88, width:13, height:8,  rx:3 })}/>
      <Zone {...zp('p_gemelo_der',    'rect',    { x:56, y:88, width:13, height:8,  rx:3 })}/>
      <Zone {...zp('p_talon_izq',     'ellipse', { cx:37, cy:97, rx:6, ry:2.5 })}/>
      <Zone {...zp('p_talon_der',     'ellipse', { cx:63, cy:97, rx:6, ry:2.5 })}/>
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
