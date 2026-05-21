import { useState } from 'react';
import { Timer } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import { cn } from '../utils/cn';
import { calcVelocity, sprintRef, sprintStatus, calcCurvoAsim, curvoAsimStatus } from '../utils/speed';

const SHAPE_TABS = ['Lineal', 'Curvo'];
const LINEAR_SEGS = ['10m', '20m', '30m', '10/20/30m'];

function SegControl({ options, active, onChange }) {
  return (
    <div className="flex rounded-lg bg-surface border border-white/5 p-1 gap-1">
      {options.map(o => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cn(
            'flex-1 py-2 text-[11px] font-semibold rounded-md transition-colors',
            active === o ? 'bg-accent text-background' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function SprintRow({ label, value, onChange, velocity, status }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        placeholder="0.00 s"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm font-data text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
      />
      {velocity > 0 && (
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-data text-slate-400">{velocity.toFixed(2)} m/s</span>
          <StatusBadge status={status} />
        </div>
      )}
    </div>
  );
}

function TabVelocidad() {
  const [shape, setShape] = useState('Lineal');
  const [seg, setSeg] = useState('10m');
  const [sprint10, setSprint10] = useState('');
  const [sprint20, setSprint20] = useState('');
  const [sprint30, setSprint30] = useState('');
  const [curvoDer, setCurvoDer] = useState('');
  const [curvoIzq, setCurvoIzq] = useState('');

  const t10 = parseFloat(sprint10) || 0;
  const t20 = parseFloat(sprint20) || 0;
  const t30 = parseFloat(sprint30) || 0;

  const v10 = calcVelocity(10, t10);
  const v20 = calcVelocity(20, t20);
  const v30 = calcVelocity(30, t30);

  const st10 = sprintStatus(t10, sprintRef.sprint10);
  const st20 = sprintStatus(t20, sprintRef.sprint20);
  const st30 = sprintStatus(t30, sprintRef.sprint30);

  const der = parseFloat(curvoDer) || 0;
  const izq = parseFloat(curvoIzq) || 0;
  const curvoAsim = calcCurvoAsim(der, izq);
  const asimSt = curvoAsimStatus(curvoAsim);

  const show = (s) => seg === s || seg === '10/20/30m';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Velocidad</h2>
        <p className="text-sm text-slate-400">Tests de Sprint · COD Curvo</p>
      </div>

      <SegControl options={SHAPE_TABS} active={shape} onChange={setShape} />

      {shape === 'Lineal' && (
        <>
          <SegControl options={LINEAR_SEGS} active={seg} onChange={setSeg} />

          <Card title="Sprint" icon={Timer}>
            <div className="space-y-4">
              {show('10m') && (
                <SprintRow
                  label="Sprint 10m — Aceleración"
                  value={sprint10} onChange={setSprint10}
                  velocity={v10} status={st10}
                />
              )}
              {show('20m') && (
                <SprintRow
                  label="Sprint 20m — Aceleración máxima"
                  value={sprint20} onChange={setSprint20}
                  velocity={v20} status={st20}
                />
              )}
              {show('30m') && (
                <SprintRow
                  label="Sprint 30m — Velocidad máxima"
                  value={sprint30} onChange={setSprint30}
                  velocity={v30} status={st30}
                />
              )}
            </div>
          </Card>

          {seg === '10/20/30m' && (v10 > 0 || v20 > 0 || v30 > 0) && (
            <Card title="Resumen protocolo completo">
              <div className="grid grid-cols-3 gap-3">
                {v10 > 0 && <MetricDisplay value={v10.toFixed(2)} unit="m/s" label="10m" status={st10} />}
                {v20 > 0 && <MetricDisplay value={v20.toFixed(2)} unit="m/s" label="20m" status={st20} />}
                {v30 > 0 && <MetricDisplay value={v30.toFixed(2)} unit="m/s" label="30m" status={st30} />}
              </div>
            </Card>
          )}
        </>
      )}

      {shape === 'Curvo' && (
        <>
          <Card title="Sprint Curvo — Asimetría de giro" icon={Timer}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Giro Derecho (s)</label>
                <input
                  type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                  value={curvoDer}
                  onChange={e => setCurvoDer(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm font-data text-slate-100 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Giro Izquierdo (s)</label>
                <input
                  type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                  value={curvoIzq}
                  onChange={e => setCurvoIzq(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm font-data text-slate-100 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            {curvoAsim > 0 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <MetricDisplay
                  value={curvoAsim.toFixed(1)} unit="%"
                  label="Asimetría curvo" status={asimSt}
                />
                <StatusBadge
                  status={asimSt}
                  label={asimSt === 'safe' ? '< 3%' : asimSt === 'warning' ? '3–5%' : '> 5%'}
                />
              </div>
            )}
          </Card>

          <Card>
            <p className="text-xs text-slate-500 leading-relaxed">
              Referencia: asimetría &lt; 3% óptima · 3–5% monitoreo · &gt; 5% riesgo biomecánico
            </p>
          </Card>
        </>
      )}
    </div>
  );
}

export default TabVelocidad;
