import { useState, useRef, useEffect } from 'react';
import { ClipboardList, Info } from 'lucide-react';
import InfoSheet from '../components/InfoSheet';
import { TEST_INFO } from '../utils/testInfo';
import Card from '../components/Card';
import MetricDisplay from '../components/MetricDisplay';
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
import { getMetricStatus } from '../utils/thresholds';
import { calcUNCa, calcNavette, calcSprintCurvo } from '../utils/calculations';
import { saveEvaluation, getPlayers } from '../lib/db';
import { useTeam } from '../context/TeamContext';
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
        <div className="grid grid-cols-3 gap-1 mt-1 bg-slate-800 rounded-lg p-2 border border-slate-700">
          {keys.map(k => (
            <button key={k} onClick={() => press(k)}
              className="bg-slate-700 hover:bg-slate-600 text-white rounded py-2 text-sm font-mono active:bg-slate-500">
              {k}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NumInput({ label, value, onChange, placeholder = '0.00' }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <DecimalPad value={value} onChange={onChange} placeholder={placeholder} />
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

// ── Navette beep timer (Web Audio API, no external files) ──────────────────────

const ZONE_COLORS = {
  regenerativo: '#3b82f6', aerobicoBase: '#22c55e',
  aerobicoDesarrollo: '#eab308', umbralAnaer: '#f97316', hiit: '#ef4444',
};

function navIntervalMs(palier) {
  return Math.round(72000 / (8.5 + 0.5 * palier)); // 72000 / VAM_kmh ms
}

function playBeep(audioRef) {
  try {
    if (!audioRef.current)
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.15);
  } catch { /* AudioContext unavailable */ }
}

function NavetteTimer({ onStop }) {
  const [running,   setRunning]   = useState(false);
  const [dispPal,   setDispPal]   = useState(1);
  const [dispShut,  setDispShut]  = useState(0);
  const [nextSec,   setNextSec]   = useState(null);
  const audioRef  = useRef(null);
  const stateRef  = useRef({ palier: 1, shuttle: 0 });
  const nextBRef  = useRef(0);
  const tickRef   = useRef(null);

  function handleStart() {
    stateRef.current = { palier: 1, shuttle: 0 };
    playBeep(audioRef);
    const ms = navIntervalMs(1);
    nextBRef.current = Date.now() + ms;
    setDispPal(1); setDispShut(0); setNextSec(ms / 1000);
    setRunning(true);
    tickRef.current = setInterval(() => {
      const rem = nextBRef.current - Date.now();
      if (rem <= 0) {
        let { palier, shuttle } = stateRef.current;
        shuttle += 1;
        if (shuttle >= 7) { shuttle = 0; palier += 1; }
        stateRef.current = { palier, shuttle };
        const next = navIntervalMs(palier);
        nextBRef.current = Date.now() + next;
        playBeep(audioRef);
        setDispPal(palier); setDispShut(shuttle); setNextSec(next / 1000);
      } else {
        setNextSec(rem / 1000);
      }
    }, 100);
  }

  function handleStop() {
    clearInterval(tickRef.current);
    setRunning(false); setNextSec(null);
    onStop?.(stateRef.current.palier, stateRef.current.shuttle);
  }

  useEffect(() => () => clearInterval(tickRef.current), []);

  if (running) {
    return (
      <div className="rounded-xl bg-background border border-white/10 p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Palier</p>
            <span className="text-3xl font-data font-black text-accent">{dispPal}</span>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Shuttle</p>
            <span className="text-3xl font-data font-black text-slate-200">
              {dispShut}<span className="text-sm font-normal text-slate-600">/7</span>
            </span>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Próximo</p>
            <span className="text-3xl font-data font-black text-warning">{nextSec?.toFixed(1)}s</span>
          </div>
        </div>
        <button onClick={handleStop}
          className="w-full py-3 rounded-xl text-sm font-bold border border-danger/30 text-danger bg-danger/10 hover:bg-danger/20 active:scale-95 transition-colors">
          ⏹ Detener — registrar palier
        </button>
      </div>
    );
  }
  return (
    <button onClick={handleStart}
      className="w-full py-3 rounded-xl text-sm font-bold bg-accent text-background hover:bg-accent/90 active:scale-95 transition-colors">
      ▶ Iniciar Navette
    </button>
  );
}

export default function EvaluacionesView() {
  const { activeTeam } = useTeam();
  const [players, setPlayers] = useState([]);
  const [athlete, setAthlete] = useState(null);
  const [mainTab, setMainTab] = useState('Salto');
  const [subTab, setSubTab] = useState('SJ');
  const [infoKey, setInfoKey] = useState(null);

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
  const [curvoDist, setCurvoDist] = useState(20);
  const [curvoTime, setCurvoTime] = useState('');
  const [curvoSaving, setCurvoSaving] = useState(false);
  const [curvoDone,   setCurvoDone]   = useState(false);

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
  // Nuevos tests aeróbicos
  const [uncaVfa, setUncaVfa] = useState('');
  const [navPal,  setNavPal]  = useState('');
  const [navShut, setNavShut] = useState('');

  useEffect(() => {
    if (!activeTeam?.id) return;
    getPlayers(activeTeam.id)
      .then(data => { if (data?.length) { setPlayers(data); setAthlete(a => a ?? data[0]); } })
      .catch(() => {});
  }, [activeTeam?.id]);

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
  const asim       = calcCurvoAsim(parseFloat(curDer) || 0, parseFloat(curIzq) || 0);
  const curvoVel   = curvoTime > 0 ? ((curvoDist / curvoTime) * 3.6).toFixed(2) : null;
  const curvoColor = curvoVel >= 22 ? '#22c55e' : curvoVel >= 18 ? '#eab308' : '#ef4444';

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
  // Nuevos tests aeróbicos
  const uncaVfaV  = parseFloat(uncaVfa) || 0;
  const navPalV   = parseInt(navPal,  10) || 0;
  const navResult = navPalV > 0 ? calcNavette(navPalV, parseInt(navShut, 10) || 0) : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">Evaluaciones</h2>
        <p className="text-sm text-slate-400">Salto · Velocidad · Agilidad · Resistencia</p>
      </div>

      {/* Athlete selector */}
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

      <SegCtrl options={MAIN_TABS} active={mainTab} onChange={switchMain} small />
      <SegCtrl options={SUB_TABS[mainTab]} active={subTab} onChange={setSubTab}
        small={mainTab === 'Resistencia' || mainTab === 'Salto'} />

      {/* ── SALTO: SJ ── */}
      {mainTab === 'Salto' && subTab === 'SJ' && (
        <Card title="Squat Jump" icon={ClipboardList}
          action={<button onClick={() => setInfoKey('sj')} className="text-slate-400 hover:text-slate-200 transition-colors"><Info size={16} /></button>}
        >
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="Tiempo de vuelo (s)" value={sjTv}   onChange={setSjTv} />
            <NumInput label="Masa (kg)"            value={sjMasa} onChange={setSjMasa} step="0.5" placeholder="70" />
          </div>
          {sjH > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ResultCard label="Altura SJ" value={sjH.toFixed(1)} unit="cm" status={getMetricStatus('sj', sjH, athlete?.sport, athlete?.category, athlete?.sex)} />
              {sjW > 0 && <ResultCard label="Potencia Sayers" value={Math.round(sjW)} unit="W" status="neutral" />}
            </div>
          )}
          <LsiSection vL={sjLL} vR={sjLR} setL={setSjLL} setR={setSjLR} />
        </Card>
      )}

      {/* ── SALTO: CMJ ── */}
      {mainTab === 'Salto' && subTab === 'CMJ' && (
        <Card title="Counter Movement Jump" icon={ClipboardList}
          action={<button onClick={() => setInfoKey('cmj')} className="text-slate-400 hover:text-slate-200 transition-colors"><Info size={16} /></button>}
        >
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="TV SJ referencia (s)" value={cmjRef}  onChange={setCmjRef} />
            <NumInput label="TV CMJ (s)"            value={cmjTv}   onChange={setCmjTv} />
            <div className="col-span-full">
              <NumInput label="Masa (kg)" value={cmjMasa} onChange={setCmjMasa} step="0.5" placeholder="70" />
            </div>
          </div>
          {cmjH > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ResultCard label="Altura CMJ" value={cmjH.toFixed(1)} unit="cm" status={getMetricStatus('cmj', cmjH, athlete?.sport, athlete?.category, athlete?.sex)} />
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
        <Card title="Drop Jump" icon={ClipboardList}
          action={<button onClick={() => setInfoKey('dropJump')} className="text-slate-400 hover:text-slate-200 transition-colors"><Info size={16} /></button>}
        >
          <div className="grid grid-cols-2 gap-3 mb-4">
            <NumInput label="Tiempo de vuelo (s)"    value={djTv} onChange={setDjTv} />
            <NumInput label="Tiempo de contacto (s)" value={djTc} onChange={setDjTc} />
          </div>
          {djH > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <ResultCard label="Altura DJ" value={djH.toFixed(1)} unit="cm" status={getMetricStatus('dj', djH, athlete?.sport, athlete?.category, athlete?.sex)} />
              {rsi > 0 && (
                <ResultCard label="RSI" value={rsi.toFixed(2)} status={getMetricStatus('rsi', rsi, athlete?.sport, athlete?.category, athlete?.sex)}
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
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <NumInput label="T 10m (s)" value={t10} onChange={setT10} />
              <NumInput label="T 20m (s)" value={t20} onChange={setT20} />
              <NumInput label="T 30m (s)" value={t30} onChange={setT30} />
            </div>
            {(v0_10 > 0 || v10_20 > 0 || v20_30 > 0) && (
              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="grid grid-cols-3 gap-3 overflow-hidden">
                  {v0_10  > 0 && <MetricDisplay value={v0_10.toFixed(2)}  unit="m/s" label="V 0–10m"  status={sprintStatus(t10v, sprintRef.sprint10)}  size="text-xl" />}
                  {v10_20 > 0 && <MetricDisplay value={v10_20.toFixed(2)} unit="m/s" label="V 10–20m" status={sprintStatus(t20v, sprintRef.sprint20)} size="text-xl" />}
                  {v20_30 > 0 && <MetricDisplay value={v20_30.toFixed(2)} unit="m/s" label="V 20–30m" status={sprintStatus(t30v, sprintRef.sprint30)} size="text-xl" />}
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
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── VELOCIDAD: Curvo ── */}
      {mainTab === 'Velocidad' && subTab === 'Curvo' && (
        <>
          <Card title="SPRINT CURVO — VELOCIDAD" icon={ClipboardList}>
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
            <NumInput label="Tiempo (s)" value={curvoTime} onChange={setCurvoTime} />
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
                    if (curvoSaving || curvoDone || !athlete?.id) return;
                    setCurvoSaving(true);
                    try {
                      await saveEvaluation({
                        player_id: athlete?.id,
                        date: new Date().toISOString().split('T')[0],
                        type: 'sprintCurvo',
                        data: { distancia: curvoDist, tiempo: Number(curvoTime), velocidad: Number(curvoVel) },
                      });
                      setCurvoDone(true);
                      setTimeout(() => setCurvoDone(false), 2000);
                    } catch { /* sin Supabase */ }
                    setCurvoSaving(false);
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

          <Card title="Asimetría de giro" icon={ClipboardList}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <NumInput label="Giro Derecho (s)"   value={curDer} onChange={setCurDer} />
              <NumInput label="Giro Izquierdo (s)" value={curIzq} onChange={setCurIzq} />
            </div>
            {asim > 0 && (
              <ResultCard label="Asimetría de giro" value={asim.toFixed(1)} unit="%"
                status={curvoAsimStatus(asim)} sub="< 3% óptimo · 3–5% monitoreo · > 5% riesgo biomecánico" />
            )}
          </Card>
        </>
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
              status={getMetricStatus('vo2max', yyVo2, athlete?.sport, athlete?.category, athlete?.sex)} sub="(dist × 0.0084) + 36.4" />
          )}
        </Card>
      )}

      {/* ── RESISTENCIA: Navette ── */}
      {mainTab === 'Resistencia' && subTab === 'Navette' && (
        <Card title="Course Navette · Léger & Boucher" icon={ClipboardList}>
          <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Temporizador de audio</p>
          <NavetteTimer onStop={(p, s) => { setNavPal(String(p)); setNavShut(String(s)); }} />
          <div className="pt-4 border-t border-white/5 mt-4">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">O ingresá el resultado manualmente</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <NumInput label="Palier alcanzado" value={navPal}  onChange={setNavPal}  step="1" placeholder="8" />
              <NumInput label="Shuttle"          value={navShut} onChange={setNavShut} step="1" placeholder="3" />
            </div>
          </div>
          {navResult && (
            <div className="grid grid-cols-2 gap-3">
              <ResultCard label="VAM" value={navResult.vam.toFixed(1)} unit="km/h" status="neutral" />
              <ResultCard label="VO₂ máx estimado" value={navResult.vo2max.toFixed(1)} unit="ml/kg/min"
                status={getMetricStatus('vo2max', navResult.vo2max, athlete?.sport, athlete?.category, athlete?.sex)}
                className="col-span-2" />
            </div>
          )}
          <p className="text-xs text-slate-600 mt-3 text-center">VAM = 8.5 + (0.5 × palier) · VO₂ = (VAM × 3.5) − 3.5</p>
        </Card>
      )}

      {/* ── RESISTENCIA: UNCa ── */}
      {mainTab === 'Resistencia' && subTab === 'UNCa' && (
        <Card title="Test UNCa · García, Cappa y Secchi" icon={ClipboardList}>
          <div className="mb-4">
            <NumInput label="VFA alcanzada (km/h)" value={uncaVfa} onChange={setUncaVfa} step="0.5" placeholder="14.0" />
          </div>
          {uncaVfaV > 0 && (() => {
            const { zones } = calcUNCa(uncaVfaV);
            return (
              <div className="space-y-2">
                {Object.entries(zones).map(([key, z]) => (
                  <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-background border border-white/5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: ZONE_COLORS[key] }} />
                    <span className="text-xs font-semibold text-slate-300 flex-1">{z.label}</span>
                    <span className="text-xs font-data text-slate-400 tabular-nums">{z.min}–{z.max} km/h</span>
                    <div className="w-14 h-1.5 rounded-full" style={{ background: ZONE_COLORS[key], opacity: 0.55 }} />
                  </div>
                ))}
                <p className="text-xs text-slate-600 text-center pt-1">Referencia: García, Cappa y Secchi (2013)</p>
              </div>
            );
          })()}
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
              status={getMetricStatus('vo2max', coopVo2, athlete?.sport, athlete?.category, athlete?.sex)} sub="(dist − 504.9) / 44.73" />
          )}
        </Card>
      )}

      {/* History */}
      <Card title="Historial reciente">
        <TestHistoryTable />
      </Card>

      <InfoSheet
        isOpen={infoKey !== null}
        onClose={() => setInfoKey(null)}
        title={infoKey ? TEST_INFO[infoKey]?.title : ''}
        content={infoKey ? TEST_INFO[infoKey] : null}
      />
    </div>
  );
}
