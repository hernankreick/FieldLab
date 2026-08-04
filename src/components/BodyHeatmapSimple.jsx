import { useState } from 'react';
import Model from 'react-body-highlighter';

const LEVELS = ['normal', 'leve', 'moderado', 'alto', 'muy_alto'];

// Silueta de fondo: react-body-highlighter usa siempre viewBox="0 0 100 200"
// (aspect ratio 0.5). Nuestras zonas usan viewBox "0 0 120 230" (aspect ratio
// ~0.522, casi idéntico). Fijamos el contenedor con esa proporción para que
// ambas capas SVG se estiren y queden alineadas sin medir nada en runtime.
const BODY_ASPECT_RATIO = '120 / 230';
const BODY_COLOR = '#16243a';

const COLORS = {
  normal:   { fill: '#1e3a5f',                  stroke: 'rgba(148,163,184,0.3)' },
  leve:     { fill: 'rgba(56,189,248,0.45)',     stroke: '#38bdf8' },
  moderado: { fill: 'rgba(245,158,11,0.45)',     stroke: '#f59e0b' },
  alto:     { fill: 'rgba(249,115,22,0.5)',      stroke: '#f97316' },
  muy_alto: { fill: 'rgba(239,68,68,0.55)',      stroke: '#ef4444' },
};

const ZONE_NAMES = {
  cuello: 'Cuello',
  hombro_der: 'Hombro der', hombro_izq: 'Hombro izq',
  pectoral: 'Pectoral',
  abdomen: 'Abdomen',
  aductor_der: 'Aductor der', aductor_izq: 'Aductor izq',
  cuadricep_der: 'Cuádricep der', cuadricep_izq: 'Cuádricep izq',
  tibial_der: 'Tibial der', tibial_izq: 'Tibial izq',
  trapecio: 'Trapecio',
  lumbar: 'Lumbar',
  gluteo_mayor_der: 'Glúteo mayor der', gluteo_mayor_izq: 'Glúteo mayor izq',
  gluteo_medio_der: 'Glúteo medio der', gluteo_medio_izq: 'Glúteo medio izq',
  isquio_der: 'Isquiotibial der', isquio_izq: 'Isquiotibial izq',
  gemelo_der: 'Gemelo der', gemelo_izq: 'Gemelo izq',
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
    <div style={{ position: 'relative', width: 126, aspectRatio: BODY_ASPECT_RATIO }}>
      <Model
        type="anterior"
        bodyColor={BODY_COLOR}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        svgStyle={{ width: '100%', height: '100%', display: 'block' }}
      />
      <svg viewBox="0 0 120 230" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <Zone {...zp('cuello',         'ellipse', { cx:60, cy:32,  rx:6,   ry:5    })}/>
      <Zone {...zp('hombro_der',     'ellipse', { cx:25, cy:44,  rx:5.5, ry:6    })}/>
      <Zone {...zp('hombro_izq',     'ellipse', { cx:95, cy:44,  rx:5.5, ry:6    })}/>
      <Zone {...zp('pectoral',       'ellipse', { cx:60, cy:48,  rx:15,  ry:10   })}/>
      <Zone {...zp('abdomen',        'ellipse', { cx:60, cy:85,  rx:14,  ry:13   })}/>
      <Zone {...zp('cuadricep_der',  'ellipse', { cx:43, cy:120, rx:4.5, ry:17   })}/>
      <Zone {...zp('aductor_der',    'ellipse', { cx:53, cy:120, rx:3,   ry:17   })}/>
      <Zone {...zp('aductor_izq',    'ellipse', { cx:67, cy:120, rx:3,   ry:17   })}/>
      <Zone {...zp('cuadricep_izq',  'ellipse', { cx:77, cy:120, rx:4.5, ry:17   })}/>
      <Zone {...zp('tibial_der',     'ellipse', { cx:47, cy:180, rx:6,   ry:34   })}/>
      <Zone {...zp('tibial_izq',     'ellipse', { cx:73, cy:180, rx:6,   ry:34   })}/>
      </svg>
    </div>
  );
}

function PosteriorView({ selectedZones, onSelectZone, interactive, setTooltip }) {
  const zp = (id, tag, attrs) => ({ id, tag, attrs, selectedZones, onSelectZone, interactive, setTooltip });
  return (
    <div style={{ position: 'relative', width: 126, aspectRatio: BODY_ASPECT_RATIO }}>
      <Model
        type="posterior"
        bodyColor={BODY_COLOR}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        svgStyle={{ width: '100%', height: '100%', display: 'block' }}
      />
      <svg viewBox="0 0 120 230" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <Zone {...zp('trapecio',         'ellipse', { cx:60, cy:48,  rx:15,   ry:10 })}/>
      <Zone {...zp('lumbar',           'ellipse', { cx:60, cy:90,  rx:14,   ry:10 })}/>
      <Zone {...zp('gluteo_medio_izq', 'ellipse', { cx:48, cy:103, rx:6,    ry:5  })}/>
      <Zone {...zp('gluteo_medio_der', 'ellipse', { cx:72, cy:103, rx:6,    ry:5  })}/>
      <Zone {...zp('gluteo_mayor_izq', 'ellipse', { cx:48, cy:114, rx:8,    ry:7  })}/>
      <Zone {...zp('gluteo_mayor_der', 'ellipse', { cx:72, cy:114, rx:8,    ry:7  })}/>
      <Zone {...zp('isquio_izq',       'ellipse', { cx:48, cy:147, rx:6.5,  ry:19.5 })}/>
      <Zone {...zp('isquio_der',       'ellipse', { cx:72, cy:147, rx:6.5,  ry:19.5 })}/>
      <Zone {...zp('gemelo_izq',       'ellipse', { cx:48, cy:195, rx:6.5,  ry:21 })}/>
      <Zone {...zp('gemelo_der',       'ellipse', { cx:72, cy:195, rx:6.5,  ry:21 })}/>
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
  const zones = interactive ? (onSelectZone ? selectedZones : internalZones) : selectedZones;
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
