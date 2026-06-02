import { useState } from 'react';
import { Timer, Camera } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import SprintVisionModule from '../components/SprintVisionModule';
import { cn } from '../utils/cn';
import { calcVelocity, sprintRef, sprintStatus, calcCurvoAsim, curvoAsimStatus } from '../utils/speed';
import { saveEvaluation } from '../lib/db';

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

function SprintRow({ label, value, onChange, velocity, status, onMeasure }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00 s"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm font-data text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
        />
        <button
          onClick={onMeasure}
          title="Medir con cámara"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-semibold whitespace-nowrap hover:bg-accent/20 transition-colors min-h-[44px]"
        >
          <Camera size={14} />
          <span className="hidden sm:inline">Cámara</span>
        </button>
      </div>
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
  const [curvoDist, setCurvoDist] = useState(20);
  const [curvoTime, setCurvoTime] = useState('');
  const [curvoSaving, setCurvoSaving] = useState(false);
  const [curvoDone,   setCurvoDone]   = useState(false);

  // Vision module state
  const [visionTarget, setVisionTarget] = useState(null); // 'sprint10' | 'sprint20' | 'sprint30'
  const [showSprintVision, setShowSprintVision] = useState(false);

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

  const curvoVel   = curvoTime > 0 ? ((curvoDist / parseFloat(curvoTime)) * 3.6).toFixed(2) : null;
  const curvoColor = curvoVel >= 22 ? '#22c55e' : curvoVel >= 18 ? '#eab308' : '#ef4444';

  const show = (s) => seg === s || seg === '10/20/30m';

  function handleVisionResult(timeSeconds) {
    const val = timeSeconds.toFixed(3);
    if (visionTarget === 'sprint10') setSprint10(val);
    else if (visionTarget === 'sprint20') setSprint20(val);
    else if (visionTarget === 'sprint30') setSprint30(val);
    setVisionTarget(null);
  }

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

          <button
            onClick={() => setShowSprintVision(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent/10 border border-accent/20 text-accent font-semibold text-sm hover:bg-accent/20 active:scale-95 transition-colors"
          >
            <Camera size={20} />
            Medir con Cámara
          </button>

          <Card title="Sprint" icon={Timer}>
            <div className="space-y-4">
              {show('10m') && (
                <SprintRow
                  label="Sprint 10m — Aceleración"
                  value={sprint10} onChange={setSprint10}
                  velocity={v10} status={st10}
                  onMeasure={() => setVisionTarget('sprint10')}
                />
              )}
              {show('20m') && (
                <SprintRow
                  label="Sprint 20m — Aceleración máxima"
                  value={sprint20} onChange={setSprint20}
                  velocity={v20} status={st20}
                  onMeasure={() => setVisionTarget('sprint20')}
                />
              )}
              {show('30m') && (
                <SprintRow
                  label="Sprint 30m — Velocidad máxima"
                  value={sprint30} onChange={setSprint30}
                  velocity={v30} status={st30}
                  onMeasure={() => setVisionTarget('sprint30')}
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
          <Card title="SPRINT CURVO — VELOCIDAD" icon={Timer}>
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2 block">Distancia</p>
              <div className="flex gap-2">
                {[20, 30, 40].map(d => (
                  <button
                    key={d}
                    onClick={() => setCurvoDist(d)}
                    className={cn(
                      'flex-1 py-2 rounded-full text-sm font-semibold border transition-colors',
                      curvoDist === d
                        ? 'bg-accent text-background border-accent'
                        : 'bg-surface text-slate-400 border-white/10 hover:text-slate-200'
                    )}
                  >
                    {d}m
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Tiempo (s)</label>
              <input
                type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                value={curvoTime}
                onChange={e => setCurvoTime(e.target.value)}
                className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm font-data text-slate-100 focus:outline-none focus:border-accent"
              />
            </div>
            {curvoVel !== null && (
              <div className="mt-4 space-y-3">
                <div className="px-4 py-4 rounded-xl bg-background border border-white/10 text-center">
                  <span className="text-4xl font-data font-black" style={{ color: curvoColor }}>
                    {curvoVel} km/h
                  </span>
                  <p className="text-xs text-slate-500 mt-1">{curvoDist}m ÷ {curvoTime}s × 3.6</p>
                </div>
                <button
                  onClick={async () => {
                    if (curvoSaving || curvoDone) return;
                    setCurvoSaving(true);
                    try {
                      await saveEvaluation({
                        player_id: null,
                        type: 'sprintCurvo',
                        data: { distancia: curvoDist, tiempo: parseFloat(curvoTime), velocidad: Number(curvoVel) },
                      });
                    } catch { /* sin Supabase */ }
                    setCurvoSaving(false);
                    setCurvoDone(true);
                    setTimeout(() => setCurvoDone(false), 2000);
                  }}
                  className={cn(
                    'w-full py-2.5 rounded-xl text-sm font-bold transition-colors',
                    curvoDone
                      ? 'bg-safe/20 text-safe border border-safe/30'
                      : 'bg-accent text-background hover:bg-accent/90 active:scale-95'
                  )}
                >
                  {curvoDone ? '✓ Guardado' : curvoSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            )}
          </Card>

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

      {/* Vision module — per-row */}
      {visionTarget && (
        <SprintVisionModule
          testType={visionTarget}
          onResult={handleVisionResult}
          onClose={() => setVisionTarget(null)}
        />
      )}

      {/* Vision module — top camera button (Lineal tab) */}
      {showSprintVision && (
        <SprintVisionModule
          testType={seg === '20m' ? 'sprint20' : seg === '30m' ? 'sprint30' : 'sprint10'}
          onResult={(t) => {
            const val = t.toFixed(3);
            if (seg === '20m') setSprint20(val);
            else if (seg === '30m') setSprint30(val);
            else setSprint10(val);
            setShowSprintVision(false);
          }}
          onClose={() => setShowSprintVision(false)}
        />
      )}
    </div>
  );
}

export default TabVelocidad;
