import { useState } from 'react';
import { Zap, Camera } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import {
  jumpHeightFromFlightTime, sayersPower, calcRSI, calcIUE, calcLSI,
  lsiStatus, iueStatus,
} from '../utils/biomechanics';

const defaultInputs = {
  massKg:    80,
  tvSJ:      0.48,
  tvCMJ:     0.52,
  tvDJ:      0.44,
  contactDJ: 0.18,
  // CMJ unilateral
  tvLeft:    0.46,
  tvRight:   0.50,
};

export default function Bosco({ onNavigate }) {
  const [inp, setInp] = useState(defaultInputs);

  function set(key, val) {
    setInp(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
  }

  const hSJ   = jumpHeightFromFlightTime(inp.tvSJ)   * 100;
  const hCMJ  = jumpHeightFromFlightTime(inp.tvCMJ)  * 100;
  const hDJ   = jumpHeightFromFlightTime(inp.tvDJ)   * 100;
  const hLeft  = jumpHeightFromFlightTime(inp.tvLeft)  * 100;
  const hRight = jumpHeightFromFlightTime(inp.tvRight) * 100;

  const powerCMJ = sayersPower(hCMJ, inp.massKg);
  const rsi      = calcRSI(hDJ / 100, inp.contactDJ);
  const iue      = calcIUE(hCMJ, hSJ);
  const lsi      = calcLSI(Math.max(hLeft, hRight), Math.min(hLeft, hRight));

  // Normalizado a % del valor de referencia élite para comparar en la misma escala
  const REF = { SJ: 40, CMJ: 45, DJ: 38, RSI: 2.5, IUE: 15 };
  const radarData = [
    { metric: 'SJ',  value: parseFloat(((hSJ  / REF.SJ)  * 100).toFixed(1)) },
    { metric: 'CMJ', value: parseFloat(((hCMJ / REF.CMJ) * 100).toFixed(1)) },
    { metric: 'DJ',  value: parseFloat(((hDJ  / REF.DJ)  * 100).toFixed(1)) },
    { metric: 'RSI', value: parseFloat(((rsi  / REF.RSI) * 100).toFixed(1)) },
    { metric: 'IUE', value: parseFloat(((iue  / REF.IUE) * 100).toFixed(1)) },
  ];

  const fields = [
    { key: 'tvSJ',      label: 'TV SJ (s)'        },
    { key: 'tvCMJ',     label: 'TV CMJ (s)'        },
    { key: 'tvDJ',      label: 'TV DJ (s)'         },
    { key: 'contactDJ', label: 'Contacto DJ (s)'   },
    { key: 'tvLeft',    label: 'TV CMJ-U Izq (s)'  },
    { key: 'tvRight',   label: 'TV CMJ-U Der (s)'  },
    { key: 'massKg',    label: 'Masa (kg)'          },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Batería de Bosco</h2>
          <p className="text-sm text-slate-400">SJ · CMJ · DJ · CMJ Unilateral</p>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('jumpAnalysis')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
              border border-accent/35 text-accent bg-accent/[0.08]
              hover:bg-accent/[0.15] active:scale-95 transition-all"
          >
            <Camera size={13} />
            Analizar con cámara
          </button>
        )}
      </div>

      {/* Resultados clave */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <MetricDisplay value={hCMJ.toFixed(1)} unit="cm" label="Altura CMJ" status="neutral" />
          <MetricDisplay value={Math.round(powerCMJ)} unit="W" label="Potencia Sayers" status="neutral" className="mt-2" />
        </Card>
        <Card>
          <MetricDisplay value={rsi.toFixed(2)} unit="" label="RSI (DJ)" status="neutral" />
          <div className="flex items-center gap-2 mt-2">
            <MetricDisplay value={iue.toFixed(1)} unit="%" label="IUE" status={iueStatus(iue)} />
            <StatusBadge status={iueStatus(iue)} className="self-end mb-0.5" />
          </div>
        </Card>
      </div>

      {/* LSI */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <MetricDisplay value={lsi.toFixed(1)} unit="%" label="Asimetría CMJ-U (LSI)" status={lsiStatus(lsi)} />
            <p className="text-xs text-slate-500 mt-1 font-data">
              Izq {hLeft.toFixed(1)} cm · Der {hRight.toFixed(1)} cm
            </p>
          </div>
          <StatusBadge status={lsiStatus(lsi)} />
        </div>
      </Card>

      {/* Radar */}
      <Card title="Perfil de salto" icon={Zap}>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '0.75rem' }}
              labelStyle={{ color: '#f8fafc' }}
              formatter={v => [`${v}% ref élite`]}
            />
            <Radar dataKey="value" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

      {/* Inputs */}
      <Card title="Parámetros de entrada">
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ key, label }) => (
            <div key={key}>
              <label className="text-xs text-slate-400 mb-1 block">{label}</label>
              <input
                type="number"
                step="0.01"
                value={inp[key]}
                onChange={e => set(key, e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm font-data text-slate-100 focus:outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
