import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import Card from '../components/Card';
import ResultCard from '../components/ResultCard';
import TestHistoryTable from '../components/TestHistoryTable';
import StatusBadge from '../components/StatusBadge';
import { cn } from '../utils/cn';
import {
  jumpHeightFromFlightTime, sayersPower, calcRSI, calcIUE, iueStatus,
  calcLSI, lsiStatus,
} from '../utils/biomechanics';
import {
  calcVelocity, sprintRef, sprintStatus, calcCurvoAsim, curvoAsimStatus,
  calcCodDeficit, codDeficitType,
} from '../utils/speed';

const ATHLETES = ['Ramiro S.', 'Leandro M.', 'Tomás R.', 'Facundo B.'];
const MAIN_TABS = ['Salto', 'Velocidad', 'Agilidad', 'Resistencia'];
const SUB_TABS = {
  Salto:       ['SJ', 'CMJ', 'Drop Jump'],
  Velocidad:   ['Lineal', 'Curvo'],
  Agilidad:    ['COD 5+5', 'Pro Agility'],
  Resistencia: ['Yo-Yo IR1', 'Navette', 'UNCa', 'Cooper'],
};

const COD_META = {
  'COD 5+5':    { refLabel: 'Sprint 10m' },
  'Pro Agility': { refLabel: 'Sprint 20m' },
};

function jumpStatus(h) { if (h >= 40) return 'safe'; if (h >= 30) return 'warning'; return 'danger'; }
function rsiSt(r)      { if (r >= 2.0) return 'safe'; if (r >= 1.5) return 'warning'; return 'danger'; }
function vo2Status(v)  { if (v >= 50) return 'safe'; if (v >= 40) return 'warning'; return 'danger'; }

function NumInput({ label, value, onChange, placeholder = '0.00', step = '0.01' }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        type="number" inputMode="decimal" step={step} placeholder={placeholder}
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-background border border-white/10 rounded-lg px-3 py-2.5 text-sm font-data text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
      />
    </div>
  );
}

function SegCtrl({ options, active, onChange, small }) {
  return (
    <div className="flex rounded-lg bg-surface border border-white/5 p-1 gap-1">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={cn(
            'flex-1 py-2 rounded-md transition-colors font-semibold',
            small ? 'text-[10px]' : 'text-[11px]',
            active === o ? 'bg-accent text-background' : 'text-slate-400 hover:text-slate-200'
          )}>
          {o}
        </button>
      ))}
    </div>
  );
}

function LsiSection({ vL, vR, setL, setR }) {
  const fl = parseFloat(vL) || 0;
  const fr = parseFloat(vR) || 0;
  const lsi = fl && fr ? calcLSI(Math.max(fl, fr), Math.min(fl, fr)) : 0;
  return (
    <div className="pt-4 border-t border-white/5 mt-2">
      <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">LSI — opcional</p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <NumInput label="TV Pierna Izq (s)" value={vL} onChange={setL} />
        <NumInput label="TV Pierna Der (s)" value={vR} onChange={setR} />
      </div>
      {lsi > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-data font-bold text-slate-200">{lsi.toFixed(1)}%</span>
          <StatusBadge status={lsiStatus(lsi)} />
        </div>
      )}
    </div>
  );
}

function CodSection({ name, deficit, invalidOrder, tCod, setTCod, tRef, setTRef, meta }) {
  const defType   = deficit !== null ? codDeficitType(deficit) : null;
  const defStatus = deficit === null ? 'neutral' : deficit > 0.3 ? 'danger' : 'warning';
  return (
    <Card title={name} icon={ClipboardList}>
      <div className="space-y-4">
        <NumInput label="Tiempo COD (s)" value={tCod} onChange={setTCod} />
        <NumInput label={`${meta.refLabel} — referencia (s)`} value={tRef} onChange={setTRef} />
      </div>
      {invalidOrder && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20">
          <p className="text-xs text-danger font-semibold">
            El tiempo COD debe ser mayor que el sprint de referencia.
          </p>
        </div>
      )}
      {deficit !== null && (
        <div className="mt-4 space-y-3">
          <ResultCard
            label="COD Deficit (Nimphius 2016)"
            value={deficit.toFixed(2)} unit="s"
            status={defStatus}
            sub={`${name} − ${meta.refLabel}`}
          />
          <p className="text-xs text-slate-400 leading-relaxed px-1">
            {defType === 'Déficit Técnico'
              ? 'Déficit > 0.3s: limitación mecánica. Priorizar técnica COD y frenado excéntrico.'
              : 'Déficit ≤ 0.3s: limitación de potencia. Priorizar fuerza excéntrica de MMII.'}
          </p>
        </div>
      )}
    </Card>
  );
}

export default function EvaluacionesView() {
  const [athlete, setAthlete] = useState(ATHLETES[0]);
  const [mainTab, setMainTab] = useState('Salto');
  const [subTab, setSubTab] = useState('SJ');

  // Salto inputs
  const [sjTv, setSjTv]     = useState(''); const [sjMasa, setSjMasa]   = useState('');
  const [sjLL, setSjLL]     = useState(''); const [sjLR, setSjLR]       = useState('');
  const [cmjRef, setCmjRef] = useState(''); const [cmjTv, setCmjTv]     = useState('');
  const [cmjMasa, setCmjMasa] = useState('');
  const [cmjLL, setCmjLL]   = useState(''); const [cmjLR, setCmjLR]     = useState('');
  const [djTv, setDjTv]     = useState(''); const [djTc, setDjTc]       = useState('');
  const [djLL, setDjLL]     = useState(''); const [djLR, setDjLR]       = useState('');

  // Velocidad inputs
  const [t10, setT10]       = useState('');
  const [t20, setT20]       = useState('');
  const [t30, setT30]       = useState('');
  const [curDer, setCurDer] = useState(''); const [curIzq, setCurIzq]   = useState('');

  // Agilidad inputs (separate state per test to preserve values when switching)
  const [ag5Cod, setAg5Cod]   = useState(''); const [ag5Ref, setAg5Ref]   = useState('');
  const [agPaCod, setAgPaCod] = useState(''); const [agPaRef, setAgPaRef] = useState('');

  // Resistencia inputs
  const [yyNivel, setYyNivel] = useState(''); const [yyShut, setYyShut]   = useState('');
  const [yyDist, setYyDist]   = useState('');
  const [navEtapa, setNavEtapa]   = useState(''); const [navPaliers, setNavPaliers] = useState('');
  const [navEdad, setNavEdad]     = useState('');
  const [uncaDist, setUncaDist]   = useState(''); const [uncaMin, setUncaMin]       = useState('');
  const [coopDist, setCoopDist]   = useState('');

  function switchMain(tab) { setMainTab(tab); setSubTab(SUB_TABS[tab][0]); }

  // Salto calcs
  const sjH  = sjTv  ? jumpHeightFromFlightTime(parseFloat(sjTv))  * 100 : 0;
  const sjW  = sjH > 0 && sjMasa  ? sayersPower(sjH, parseFloat(sjMasa))  : 0;
  const cmjH = cmjTv ? jumpHeightFromFlightTime(parseFloat(cmjTv)) * 100 : 0;
  const sjRef = cmjRef ? jumpHeightFromFlightTime(parseFloat(cmjRef)) * 100 : 0;
  const cmjW = cmjH > 0 && cmjMasa ? sayersPower(cmjH, parseFloat(cmjMasa)) : 0;
  const iue  = cmjH > 0 && sjRef > 0 ? calcIUE(cmjH, sjRef) : null;
  const djH  = djTv  ? jumpHeightFromFlightTime(parseFloat(djTv))  * 100 : 0;
  const rsi  = djH > 0 && djTc ? calcRSI(djH / 100, parseFloat(djTc)) : 0;

  // Velocidad calcs
  const t10v = parseFloat(t10) || 0;
  const t20v = parseFloat(t20) || 0;
  const t30v = parseFloat(t30) || 0;
  const v0_10  = calcVelocity(10, t10v);
  const v10_20 = t10v > 0 && t20v > t10v ? calcVelocity(10, t20v - t10v) : 0;
  const v20_30 = t20v > 0 && t30v > t20v ? calcVelocity(10, t30v - t20v) : 0;
  const asim   = calcCurvoAsim(parseFloat(curDer) || 0, parseFloat(curIzq) || 0);

  // Agilidad calcs
  const cod5Raw    = ag5Cod && ag5Ref ? calcCodDeficit(parseFloat(ag5Cod), parseFloat(ag5Ref)) : null;
  const cod5Invalid  = cod5Raw !== null && cod5Raw < 0;
  const cod5Deficit  = cod5Invalid ? null : cod5Raw;

  const proaRaw    = agPaCod && agPaRef ? calcCodDeficit(parseFloat(agPaCod), parseFloat(agPaRef)) : null;
  const proaInvalid  = proaRaw !== null && proaRaw < 0;
  const proaDeficit  = proaInvalid ? null : proaRaw;

  // Resistencia calcs
  const yyDistV = parseFloat(yyDist) || 0;
  const yyVo2   = yyDistV > 0 ? (yyDistV * 0.0084) + 36.4 : 0;
  const navE    = parseFloat(navEtapa) || 0;
  const navAge  = parseFloat(navEdad)  || 0;
  const navVel  = navE > 0 ? 8 + (navE - 1) * 0.5 : 0;
  const navVo2  = navVel > 0 && navAge > 0
    ? 31.025 + 3.238 * navVel - 3.248 * navAge + 0.1536 * navVel * navAge : 0;
  const uncaD   = parseFloat(uncaDist) || 0;
  const uncaT   = parseFloat(uncaMin)  || 0;
  const uncaVo2 = uncaD > 0 && uncaT > 0 ? (uncaD / uncaT) * 6.65 - 35.8 : 0;
  const coopD   = parseFloat(coopDist) || 0;
  const coopVo2 = coopD > 0 ? (coopD - 504.9) / 44.73 : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Evaluaciones</h2>
        <p className="text-sm text-slate-400">Salto · Velocidad · Agilidad · Resistencia</p>
      </div>

      {/* Athlete selector */}
      <div className="flex gap-2 flex-wrap">
        {ATHLETES.map(n => (
          <button key={n} onClick={() => setAthlete(n)}
            className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
              athlete === n
                ? 'bg-accent text-background border-accent'
                : 'bg-surface text-slate-400 border-white/10 hover:text-slate-200'
            )}>
            {n}
          </button>
        ))}
      </div>

      <SegCtrl options={MAIN_TABS} active={mainTab} onChange={switchMain} small />
      <SegCtrl options={SUB_TABS[mainTab]} active={subTab} onChange={setSubTab}
        small={mainTab === 'Resistencia' || mainTab === 'Salto'} />

      {/* ── SALTO: SJ ── */}
      {mainTab === 'Salto' && subTab === 'SJ' && (
        <Card title="Squat Jump" icon={ClipboardList}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="Tiempo de vuelo (s)" value={sjTv}   onChange={setSjTv} />
            <NumInput label="Masa (kg)"            value={sjMasa} onChange={setSjMasa} step="0.5" placeholder="70" />
          </div>
          {sjH > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ResultCard label="Altura SJ" value={sjH.toFixed(1)} unit="cm" status={jumpStatus(sjH)} />
              {sjW > 0 && <ResultCard label="Potencia Sayers" value={Math.round(sjW)} unit="W" status="neutral" />}
            </div>
          )}
          <LsiSection vL={sjLL} vR={sjLR} setL={setSjLL} setR={setSjLR} />
        </Card>
      )}

      {/* ── SALTO: CMJ ── */}
      {mainTab === 'Salto' && subTab === 'CMJ' && (
        <Card title="Counter Movement Jump" icon={ClipboardList}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="TV SJ referencia (s)" value={cmjRef}  onChange={setCmjRef} />
            <NumInput label="TV CMJ (s)"            value={cmjTv}   onChange={setCmjTv} />
            <div className="col-span-full">
              <NumInput label="Masa (kg)" value={cmjMasa} onChange={setCmjMasa} step="0.5" placeholder="70" />
            </div>
          </div>
          {cmjH > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ResultCard label="Altura CMJ" value={cmjH.toFixed(1)} unit="cm" status={jumpStatus(cmjH)} />
              {cmjW > 0 && <ResultCard label="Potencia Sayers" value={Math.round(cmjW)} unit="W" status="neutral" />}
              {iue !== null && (
                <ResultCard label="IUE" value={iue.toFixed(1)} unit="%" status={iueStatus(iue)}
                  sub="Normal: 10–15%" className="col-span-full" />
              )}
            </div>
          )}
          <LsiSection vL={cmjLL} vR={cmjLR} setL={setCmjLL} setR={setCmjLR} />
        </Card>
      )}

      {/* ── SALTO: Drop Jump ── */}
      {mainTab === 'Salto' && subTab === 'Drop Jump' && (
        <Card title="Drop Jump" icon={ClipboardList}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="Tiempo de vuelo (s)"    value={djTv} onChange={setDjTv} />
            <NumInput label="Tiempo de contacto (s)" value={djTc} onChange={setDjTc} />
          </div>
          {djH > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ResultCard label="Altura DJ" value={djH.toFixed(1)} unit="cm" status={jumpStatus(djH)} />
              {rsi > 0 && (
                <ResultCard label="RSI" value={rsi.toFixed(2)} status={rsiSt(rsi)}
                  sub="≥ 2.0 élite · ≥ 1.5 aceptable" />
              )}
            </div>
          )}
          <LsiSection vL={djLL} vR={djLR} setL={setDjLL} setR={setDjLR} />
        </Card>
      )}

      {/* ── VELOCIDAD: Lineal ── */}
      {mainTab === 'Velocidad' && subTab === 'Lineal' && (
        <Card title="Sprint Lineal" icon={ClipboardList}>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <NumInput label="T 10m (s)" value={t10} onChange={setT10} />
            <NumInput label="T 20m (s)" value={t20} onChange={setT20} />
            <NumInput label="T 30m (s)" value={t30} onChange={setT30} />
          </div>
          {(v0_10 > 0 || v10_20 > 0 || v20_30 > 0) && (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {v0_10  > 0 && <ResultCard label="V 0–10m"  value={v0_10.toFixed(2)}  unit="m/s" status={sprintStatus(t10v, sprintRef.sprint10)} />}
                {v10_20 > 0 && <ResultCard label="V 10–20m" value={v10_20.toFixed(2)} unit="m/s" status={sprintStatus(t20v, sprintRef.sprint20)} />}
                {v20_30 > 0 && <ResultCard label="V 20–30m" value={v20_30.toFixed(2)} unit="m/s" status={sprintStatus(t30v, sprintRef.sprint30)} />}
              </div>
              {v0_10 > 0 && (v10_20 > 0 || v20_30 > 0) && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Perfil de velocidad</p>
                  {[
                    v0_10  > 0 && ['Aceleración', v0_10,  10, '#38bdf8'],
                    v10_20 > 0 && ['Acc. máxima', v10_20, 12, '#f59e0b'],
                    v20_30 > 0 && ['Vel. máxima', v20_30, 12, '#22c55e'],
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
            </>
          )}
        </Card>
      )}

      {/* ── VELOCIDAD: Curvo ── */}
      {mainTab === 'Velocidad' && subTab === 'Curvo' && (
        <Card title="Sprint Curvo" icon={ClipboardList}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="Giro Derecho (s)"   value={curDer} onChange={setCurDer} />
            <NumInput label="Giro Izquierdo (s)" value={curIzq} onChange={setCurIzq} />
          </div>
          {asim > 0 && (
            <ResultCard label="Asimetría de giro" value={asim.toFixed(1)} unit="%"
              status={curvoAsimStatus(asim)} sub="< 3% óptimo · 3–5% monitoreo · > 5% riesgo biomecánico" />
          )}
        </Card>
      )}

      {/* ── AGILIDAD ── */}
      {mainTab === 'Agilidad' && subTab === 'COD 5+5' && (
        <CodSection
          name="COD 5+5"
          deficit={cod5Deficit} invalidOrder={cod5Invalid}
          tCod={ag5Cod} setTCod={setAg5Cod}
          tRef={ag5Ref} setTRef={setAg5Ref}
          meta={COD_META['COD 5+5']}
        />
      )}
      {mainTab === 'Agilidad' && subTab === 'Pro Agility' && (
        <CodSection
          name="Pro Agility 5+10+5"
          deficit={proaDeficit} invalidOrder={proaInvalid}
          tCod={agPaCod} setTCod={setAgPaCod}
          tRef={agPaRef} setTRef={setAgPaRef}
          meta={COD_META['Pro Agility']}
        />
      )}

      {/* ── RESISTENCIA: Yo-Yo IR1 ── */}
      {mainTab === 'Resistencia' && subTab === 'Yo-Yo IR1' && (
        <Card title="Yo-Yo Intermittent Recovery Test 1" icon={ClipboardList}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="Nivel alcanzado" value={yyNivel} onChange={setYyNivel} step="1" placeholder="5" />
            <NumInput label="Shuttles"        value={yyShut}  onChange={setYyShut}  step="1" placeholder="4" />
            <div className="col-span-full">
              <NumInput label="Distancia total (m)" value={yyDist} onChange={setYyDist} step="40" placeholder="1200" />
            </div>
          </div>
          {yyVo2 > 0 && (
            <ResultCard label="VO₂ máx estimado" value={yyVo2.toFixed(1)} unit="ml/kg/min"
              status={vo2Status(yyVo2)} sub="(dist × 0.0084) + 36.4" />
          )}
        </Card>
      )}

      {/* ── RESISTENCIA: Navette ── */}
      {mainTab === 'Resistencia' && subTab === 'Navette' && (
        <Card title="Course Navette · Léger & Lambert" icon={ClipboardList}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="Etapa alcanzada" value={navEtapa}   onChange={setNavEtapa}   step="1" placeholder="8" />
            <NumInput label="Paliers"         value={navPaliers} onChange={setNavPaliers} step="1" placeholder="3" />
            <div className="col-span-full">
              <NumInput label="Edad (años)" value={navEdad} onChange={setNavEdad} step="1" placeholder="22" />
            </div>
          </div>
          {navVo2 > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-3">
                Velocidad alcanzada: <span className="font-data text-slate-300">{navVel.toFixed(1)} km/h</span>
              </p>
              <ResultCard label="VO₂ máx estimado" value={navVo2.toFixed(1)} unit="ml/kg/min" status={vo2Status(navVo2)} />
            </>
          )}
        </Card>
      )}

      {/* ── RESISTENCIA: UNCa ── */}
      {mainTab === 'Resistencia' && subTab === 'UNCa' && (
        <Card title="Test UNCa" icon={ClipboardList}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="Distancia (m)" value={uncaDist} onChange={setUncaDist} step="1"   placeholder="1500" />
            <NumInput label="Tiempo (min)"  value={uncaMin}  onChange={setUncaMin}  step="0.1" placeholder="6.0" />
          </div>
          {uncaVo2 > 0 && (
            <ResultCard label="VO₂ máx estimado" value={uncaVo2.toFixed(1)} unit="ml/kg/min"
              status={vo2Status(uncaVo2)} sub="(dist / tiempo) × 6.65 − 35.8" />
          )}
        </Card>
      )}

      {/* ── RESISTENCIA: Cooper ── */}
      {mainTab === 'Resistencia' && subTab === 'Cooper' && (
        <Card title="Test de Cooper · 12 minutos" icon={ClipboardList}>
          <div className="mb-4">
            <NumInput label="Distancia recorrida (m)" value={coopDist} onChange={setCoopDist} step="10" placeholder="2400" />
          </div>
          {coopVo2 > 0 && (
            <ResultCard label="VO₂ máx estimado" value={coopVo2.toFixed(1)} unit="ml/kg/min"
              status={vo2Status(coopVo2)} sub="(dist − 504.9) / 44.73" />
          )}
        </Card>
      )}

      {/* History */}
      <Card title="Historial reciente">
        <TestHistoryTable />
      </Card>
    </div>
  );
}
