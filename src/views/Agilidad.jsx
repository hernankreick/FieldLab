import { useState } from 'react';
import { Shuffle, Camera } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import SprintVisionModule from '../components/SprintVisionModule';
import { cn } from '../utils/cn';
import { calcCodDeficit, codDeficitType } from '../utils/speed';

const COD_TESTS = [
  { id: 'cod5',       label: 'COD 5+5',           refLabel: 'Sprint 10m', visionType: 'cod5+5' },
  { id: 'proagility', label: 'Pro Agility 5+10+5', refLabel: 'Sprint 20m', visionType: 'proAgility' },
];

function TabAgilidad() {
  const [test, setTest] = useState('cod5');
  const [tCod, setTCod] = useState('');
  const [tRef, setTRef] = useState('');
  const [showVision, setShowVision] = useState(false);

  const current = COD_TESTS.find(t => t.id === test);

  const cod = parseFloat(tCod) || 0;
  const ref = parseFloat(tRef) || 0;

  const rawDeficit = cod && ref ? calcCodDeficit(cod, ref) : null;
  const invalidOrder = rawDeficit !== null && rawDeficit < 0;
  const codDeficit = invalidOrder ? null : rawDeficit;
  const deficitType = codDeficitType(codDeficit);
  const deficitStatus = codDeficit === null
    ? 'neutral'
    : codDeficit > 0.3 ? 'danger' : 'warning';

  function switchTest(id) {
    setTest(id);
    setTCod('');
    setTRef('');
  }

  function handleVisionResult(timeSeconds) {
    setTCod(timeSeconds.toFixed(3));
    setShowVision(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Agilidad / COD</h2>
        <p className="text-sm text-slate-400">Change of Direction Deficit · Nimphius 2016</p>
      </div>

      {/* Test selector */}
      <div className="flex gap-2">
        {COD_TESTS.map(t => (
          <button
            key={t.id}
            onClick={() => switchTest(t.id)}
            className={cn(
              'flex-1 py-2.5 px-3 text-xs font-semibold rounded-xl border transition-colors',
              test === t.id
                ? 'bg-accent text-background border-accent'
                : 'bg-surface text-slate-400 border-white/10 hover:text-slate-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <Card title={current.label} icon={Shuffle}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tiempo COD (s)</label>
            <div className="flex gap-2">
              <input
                type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                value={tCod}
                onChange={e => setTCod(e.target.value)}
                className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm font-data text-slate-100 focus:outline-none focus:border-accent"
              />
              <button
                onClick={() => setShowVision(true)}
                title="Medir con cámara"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors min-h-[44px]"
              >
                <Camera size={14} />
                <span className="hidden sm:inline">Cámara</span>
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              {current.refLabel} — sprint lineal de referencia (s)
            </label>
            <input
              type="number" inputMode="decimal" step="0.01" placeholder="0.00"
              value={tRef}
              onChange={e => setTRef(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm font-data text-slate-100 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </Card>

      {/* Input order error */}
      {invalidOrder && (
        <div className="px-4 py-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-xs text-danger font-semibold">
            El tiempo COD debe ser mayor que el sprint lineal de referencia.
          </p>
        </div>
      )}

      {/* COD Deficit result */}
      {codDeficit !== null && (
        <Card title="Análisis COD Deficit">
          <div className="flex items-center justify-between">
            <div>
              <MetricDisplay
                value={codDeficit.toFixed(2)} unit="s"
                label="COD Deficit" status={deficitStatus}
              />
              <p className="text-xs text-slate-500 mt-1 font-data">
                {current.label} − {current.refLabel}
              </p>
            </div>
            <StatusBadge status={deficitStatus} label={deficitType} />
          </div>

          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-xs text-slate-400 leading-relaxed">
              {deficitType === 'Déficit Técnico'
                ? 'Déficit > 0.3s: limitación mecánica en el cambio de dirección. Priorizar técnica COD y frenado excéntrico.'
                : 'Déficit ≤ 0.3s: la fuerza/potencia es el factor limitante. Priorizar fuerza excéntrica de MMII.'}
            </p>
          </div>
        </Card>
      )}

      {/* Reference */}
      <Card>
        <p className="text-xs text-slate-500 leading-relaxed">
          Nimphius et al. (2016): déficit &gt; 0.3s = limitación técnica ·
          ≤ 0.3s = limitación de potencia
        </p>
      </Card>

      {/* Vision module — fullscreen overlay */}
      {showVision && (
        <SprintVisionModule
          testType={current.visionType}
          onResult={handleVisionResult}
          onClose={() => setShowVision(false)}
        />
      )}
    </div>
  );
}

export default TabAgilidad;
