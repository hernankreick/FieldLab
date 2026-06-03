import { useState, useEffect } from 'react';
import { Timer, Camera, Info } from 'lucide-react';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
import StatusBadge from '../components/StatusBadge';
import SprintVisionModule from '../components/SprintVisionModule';
import InfoSheet from '../components/InfoSheet';
import { cn } from '../utils/cn';
import { calcVelocity, sprintRef, sprintStatus, calcCurvoAsim, curvoAsimStatus } from '../utils/speed';
import { saveEvaluation, getPlayers } from '../lib/db';
import { TEST_INFO } from '../utils/testInfo';
import { useTeam } from '../context/TeamContext';

const SHAPE_TABS = ['Lineal', 'Curvo'];
const LINEAR_SEGS = ['10m', '20m', '30m', '10/20/30m'];

const parseTime = (val) => parseFloat(String(val).replace(',', '.')) || 0;

function DecimalPad({ value, onChange, placeholder = '0.00' }) {
  const [active, setActive] = useState(false);

  const press = (k) => {
    if (k === '⌫') { onChange(String(value).slice(0, -1) || ''); return; }
    if (k === '.' && String(value).includes('.')) return;
    if (k === '.' && value === '') { onChange('0.'); return; }
    onChange(String(value) + k);
  };

  const keys = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

  return (
    <div>
      <div
        onClick={() => setActive(!active)}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm cursor-pointer min-h-[40px] flex items-center"
      >
        {value || <span className="text-slate-500">{placeholder}</span>}
      </div>
      {active && (
        <div className="grid grid-cols-3 gap-2 mt-1 bg-slate-800 rounded-lg p-2 border border-slate-700">
          {keys.map(k => (
            <button key={k} onClick={() => press(k)}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded py-4 text-lg font-mono active:bg-slate-500">
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

function SprintRow({ label, value, onChange, velocity, status, onMeasure, onInfo, onSave }) {
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  async function handleSave() {
    if (saving || done || !onSave) return;
    setSaving(true);
    await onSave();
    setSaving(false);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        {onInfo && (
          <button onClick={onInfo} className="text-slate-500 hover:text-slate-300 transition-colors p-0.5">
            <Info size={14} />
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <DecimalPad value={value} onChange={onChange} />
        </div>
      </div>
      {velocity > 0 && (
        <div className="mt-2 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-data text-slate-200">{velocity.toFixed(2)}</span>
            <span className="text-xl font-data text-slate-400">m/s</span>
            <StatusBadge status={status} />
          </div>
          <button
            onClick={handleSave}
            className={cn(
              'w-full py-3 rounded-xl font-bold text-sm transition-colors active:scale-95',
              done ? 'bg-green-500 text-white' : 'bg-cyan-500 text-black hover:bg-cyan-400'
            )}
          >
            {done ? '✓ Guardado' : saving ? 'Guardando…' : 'Guardar'}
          </button>
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
  const [curvoTime20, setCurvoTime20] = useState('');
  const [curvoTime30, setCurvoTime30] = useState('');
  const [curvoTime40, setCurvoTime40] = useState('');
  const [curvoSaving, setCurvoSaving] = useState(false);
  const [curvoDone,   setCurvoDone]   = useState(false);

  const { activeTeam } = useTeam();
  const [players, setPlayers] = useState([]);
  const [athlete, setAthlete] = useState(null);

  useEffect(() => {
    if (!activeTeam?.id) return;
    getPlayers(activeTeam.id)
      .then(data => { if (data?.length) { setPlayers(data); setAthlete(a => a ?? data[0]); } })
      .catch(() => {});
  }, [activeTeam?.id]);

  const [visionTarget, setVisionTarget] = useState(null);
  const [showSprintVision, setShowSprintVision] = useState(false);
  const [infoKey, setInfoKey] = useState(null);

  const t10 = parseTime(sprint10);
  const t20 = parseTime(sprint20);
  const t30 = parseTime(sprint30);

  const v10 = calcVelocity(10, t10);
  const v20 = calcVelocity(20, t20);
  const v30 = calcVelocity(30, t30);

  const st10 = sprintStatus(t10, sprintRef.sprint10);
  const st20 = sprintStatus(t20, sprintRef.sprint20);
  const st30 = sprintStatus(t30, sprintRef.sprint30);

  const der = parseTime(curvoDer);
  const izq = parseTime(curvoIzq);
  const curvoAsim = calcCurvoAsim(der, izq);
  const asimSt = curvoAsimStatus(curvoAsim);

  const activeTime = curvoDist === 20 ? curvoTime20 : curvoDist === 30 ? curvoTime30 : curvoTime40;
  const activeTimeParsed = parseTime(activeTime);
  const curvoVel   = activeTimeParsed > 0 ? ((curvoDist / activeTimeParsed) * 3.6).toFixed(2) : null;
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

      <div className="flex gap-2 flex-wrap">
        {players.map(p => (
          <button key={p.id} onClick={() => setAthlete(p)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              athlete?.id === p.id
                ? 'bg-accent text-background border-accent'
                : 'bg-surface text-slate-400 border-white/10 hover:text-slate-200'
            )}>
            {p.name.split(' ')[0]} {p.name.split(' ')[1]?.[0]}.
          </button>
        ))}
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

          <Card title="Sprint Lineal" icon={Timer}>
            <div className="space-y-4">
              {show('10m') && (
                <SprintRow
                  label="Sprint 10m — Aceleración"
                  value={sprint10} onChange={setSprint10}
                  velocity={v10} status={st10}
                  onMeasure={() => setVisionTarget('sprint10')}
                  onInfo={() => setInfoKey('sprint10')}
                  onSave={async () => { try { await saveEvaluation({ player_id: athlete.id, type: 'sprint10', data: { tiempo: t10, velocidad: v10 } }); } catch { /* sin Supabase */ } }}
                />
              )}
              {show('20m') && (
                <SprintRow
                  label="Sprint 20m — Aceleración máxima"
                  value={sprint20} onChange={setSprint20}
                  velocity={v20} status={st20}
                  onMeasure={() => setVisionTarget('sprint20')}
                  onSave={async () => { try { await saveEvaluation({ player_id: athlete.id, type: 'sprint20', data: { tiempo: t20, velocidad: v20 } }); } catch { /* sin Supabase */ } }}
                />
              )}
              {show('30m') && (
                <SprintRow
                  label="Sprint 30m — Velocidad máxima"
                  value={sprint30} onChange={setSprint30}
                  velocity={v30} status={st30}
                  onMeasure={() => setVisionTarget('sprint30')}
                  onInfo={() => setInfoKey('sprint30')}
                  onSave={async () => { try { await saveEvaluation({ player_id: athlete.id, type: 'sprint30', data: { tiempo: t30, velocidad: v30 } }); } catch { /* sin Supabase */ } }}
                />
              )}
              {seg === '10/20/30m' && (v10 > 0 || v20 > 0 || v30 > 0) && (
                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="grid grid-cols-3 gap-3 overflow-hidden">
                    {v10 > 0 && <MetricDisplay value={v10.toFixed(2)} unit="m/s" label="V 0–10m" status={st10} size="text-xl" />}
                    {v20 > 0 && <MetricDisplay value={v20.toFixed(2)} unit="m/s" label="V 10–20m" status={st20} size="text-xl" />}
                    {v30 > 0 && <MetricDisplay value={v30.toFixed(2)} unit="m/s" label="V 20–30m" status={st30} size="text-xl" />}
                  </div>
                  {v10 > 0 && (v20 > 0 || v30 > 0) && (
                    <div>
                      <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Perfil de velocidad</p>
                      {[
                        v10 > 0 && ['Aceleración',  v10, 10, '#38bdf8'],
                        v20 > 0 && ['Acc. máxima',  v20, 12, '#f59e0b'],
                        v30 > 0 && ['Vel. máxima',  v30, 12, '#22c55e'],
                      ].filter(Boolean).map(([lbl, val, max, color]) => (
                        <div key={lbl} className="flex items-center gap-3 mb-2">
                          <span className="text-xs text-slate-400 w-24">{lbl}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(val / max * 100, 100)}%`, background: color }} />
                          </div>
                          <span className="text-xs font-data text-slate-300 w-14 text-right">{val.toFixed(2)} m/s</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {shape === 'Curvo' && (
        <>
          <button
            onClick={() => setShowSprintVision(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-accent/10 border border-accent/20 text-accent font-semibold text-sm hover:bg-accent/20 active:scale-95 transition-colors"
          >
            <Camera size={20} />
            Medir con Cámara
          </button>

          <Card title="SPRINT CURVO — VELOCIDAD" icon={Timer}
            action={<button onClick={() => setInfoKey('sprintCurvo')} className="text-slate-400 hover:text-slate-200 transition-colors"><Info size={16} /></button>}
          >
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
            {curvoDist === 20 && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tiempo 20m (s)</label>
                <DecimalPad key="curvo-20" value={curvoTime20} onChange={setCurvoTime20} />
              </div>
            )}
            {curvoDist === 30 && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tiempo 30m (s)</label>
                <DecimalPad key="curvo-30" value={curvoTime30} onChange={setCurvoTime30} />
              </div>
            )}
            {curvoDist === 40 && (
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tiempo 40m (s)</label>
                <DecimalPad key="curvo-40" value={curvoTime40} onChange={setCurvoTime40} />
              </div>
            )}
            {curvoVel !== null && (
              <div className="mt-4 space-y-3">
                <div className="px-4 py-4 rounded-xl bg-background border border-white/10 text-center">
                  <span className="text-4xl font-data font-black" style={{ color: curvoColor }}>
                    {curvoVel} km/h
                  </span>
                  <p className="text-xs text-slate-500 mt-1">{curvoDist}m ÷ {activeTime}s × 3.6</p>
                </div>
                <button
                  onClick={async () => {
                    if (curvoSaving || curvoDone) return;
                    setCurvoSaving(true);
                    try {
                      await saveEvaluation({
                        player_id: athlete.id,
                        type: 'sprintCurvo',
                        data: { distancia: curvoDist, tiempo: parseTime(activeTime), velocidad: Number(curvoVel) },
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
                <DecimalPad value={curvoDer} onChange={setCurvoDer} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Giro Izquierdo (s)</label>
                <DecimalPad value={curvoIzq} onChange={setCurvoIzq} />
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

      <InfoSheet
        isOpen={infoKey !== null}
        onClose={() => setInfoKey(null)}
        title={infoKey ? TEST_INFO[infoKey]?.title : ''}
        content={infoKey ? TEST_INFO[infoKey] : null}
      />

      {visionTarget && (
        <SprintVisionModule
          testType={visionTarget}
          onResult={handleVisionResult}
          onClose={() => setVisionTarget(null)}
        />
      )}

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
