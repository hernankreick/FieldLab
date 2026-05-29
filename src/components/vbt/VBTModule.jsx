import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Play, Square, RotateCcw, Camera, Loader2, Plus,
  AlertTriangle, Activity, Zap, TrendingDown,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from 'recharts';
import { useArUcoTracker } from '../../hooks/useArUcoTracker';
import { calcPower, calcFatigueIndex, classifyLoad } from '../../utils/vbtCalculations';

const EXERCISES = ['Sentadilla', 'Press Banca', 'Peso Muerto', 'Arranque'];

// Background/text colour based on MPV zone
function zoneColors(mpv) {
  if (mpv > 1.00) return { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e' };
  if (mpv >= 0.75) return { bg: 'rgba(234,179,8,0.15)', text: '#eab308' };
  return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444' };
}

const TOOLTIP_STYLE = {
  background: '#1e293b',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '0.75rem',
};

export default function VBTModule() {
  const [athleteName, setAthleteName] = useState('');
  const [exercise,    setExercise]    = useState(EXERCISES[0]);
  const [loadKg,      setLoadKg]      = useState('');

  const {
    videoRef, isTracking, currentVelocity, repData,
    startTracking, stopTracking, resetSession, addManualRep,
    calibrationPxPerMeter, cvReady, cvLoading, statusMsg,
  } = useArUcoTracker();

  const [manualMPV,    setManualMPV]    = useState('');
  const [manualActive, setManualActive] = useState(false);

  function handleAddManualRep() {
    const v = parseFloat(manualMPV);
    if (!v || v <= 0) return;
    addManualRep(v);
    setManualMPV('');
  }

  function handleReset() {
    resetSession();
    setManualActive(false);
    setManualMPV('');
  }

  const load       = parseFloat(loadKg) || 0;
  const repLoadRef = useRef({});

  // Capture load at the moment each rep is saved so historical power is immutable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (repData.length === 0) { repLoadRef.current = {}; return; }
    const last = repData[repData.length - 1];
    if (!(last.rep in repLoadRef.current)) repLoadRef.current[last.rep] = load;
  }, [repData.length]);

  const repVelocities = useMemo(() => repData.map(r => r.mpv), [repData]);
  const lastRep       = repData[repData.length - 1];
  const currentMPV    = lastRep?.mpv         ?? 0;
  const currentPeak   = lastRep?.peakVelocity ?? 0;
  const currentPower  = calcPower(currentMPV, load);
  const currentZone   = classifyLoad(currentMPV);
  const fatigueIndex  = repData.length >= 3 ? calcFatigueIndex(repVelocities) : null;
  const firstMPV      = repData[0]?.mpv ?? 0;
  const colors        = zoneColors(currentMPV);

  const chartData = repData.map(r => ({ rep: r.rep, mpv: +r.mpv.toFixed(3) }));
  const dropLine  = firstMPV > 0 ? +(firstMPV * 0.8).toFixed(3) : null;

  const fatigueStatus =
    fatigueIndex === null       ? null
    : fatigueIndex > 20         ? 'danger'
    : fatigueIndex > 10         ? 'warning'
    : 'ok';

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div>
        <h2 className="text-xl font-bold text-slate-100">VBT · ArUco</h2>
        <p className="text-sm text-slate-400">Velocity Based Training — seguimiento óptico en tiempo real</p>
      </div>

      {/* ── Panel Superior — Sesión ── */}
      <div className="bg-surface rounded-fieldlab border border-white/5 p-4 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Configuración de sesión</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Atleta</label>
            <input
              type="text"
              placeholder="Nombre"
              value={athleteName}
              onChange={e => setAthleteName(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              style={{ touchAction: 'manipulation' }}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Carga (kg)</label>
            <input
              type="number"
              placeholder="0"
              min="0"
              inputMode="decimal"
              value={loadKg}
              onChange={e => setLoadKg(e.target.value)}
              style={{ touchAction: 'manipulation' }}
              className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-sm font-data text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-2 block">Ejercicio</label>
          <div className="flex gap-2 flex-wrap">
            {EXERCISES.map(ex => (
              <button
                key={ex}
                type="button"
                onClick={e => { e.stopPropagation(); setExercise(ex); }}
                style={{ touchAction: 'manipulation' }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  exercise === ex
                    ? 'bg-accent text-background'
                    : 'bg-background border border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Camera status + controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-xs">
            {cvLoading ? (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Loader2 size={13} className="animate-spin text-accent" />
                Cargando motor de visión…
              </span>
            ) : (
              <span className={`flex items-center gap-1.5 ${cvReady ? 'text-success' : 'text-warning'}`}>
                {cvReady
                  ? isTracking ? <Camera size={13} /> : <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                  : <AlertTriangle size={13} />}
                {cvReady && isTracking ? 'Cámara activa' : statusMsg}
              </span>
            )}
            {cvReady && calibrationPxPerMeter > 0 && (
              <span className="text-slate-600 font-data ml-1">
                {Math.round(calibrationPxPerMeter)} px/m
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={cvReady
                ? (isTracking ? stopTracking : startTracking)
                : () => setManualActive(a => !a)}
              style={{ touchAction: 'manipulation' }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                (cvReady && isTracking) || (!cvReady && manualActive)
                  ? 'bg-danger/20 text-danger hover:bg-danger/30 border border-danger/30'
                  : 'bg-accent text-background hover:bg-accent/90'
              }`}
            >
              {(cvReady && isTracking) || (!cvReady && manualActive)
                ? <><Square size={14} /> Detener</>
                : <><Play size={14} /> Iniciar</>}
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Nueva sesión"
              style={{ touchAction: 'manipulation' }}
              className="px-3 py-2 bg-background border border-white/10 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Manual mode input — visible when OpenCV unavailable and session active */}
        {!cvReady && !cvLoading && manualActive && (
          <div className="bg-background rounded-lg border border-white/10 p-3 space-y-2">
            <p className="text-xs text-slate-500">Ingresá MPV por rep manualmente</p>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="MPV (m/s)"
                value={manualMPV}
                onChange={e => setManualMPV(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddManualRep()}
                inputMode="decimal"
                autoComplete="off"
                style={{ touchAction: 'manipulation' }}
                className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm font-data text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleAddManualRep}
                style={{ touchAction: 'manipulation' }}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors"
              >
                <Plus size={14} /> Rep
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden video element — camera frames consumed by the hook */}
      <video ref={videoRef} playsInline muted className="hidden" width={640} height={480} />

      {/* ── Panel Central — Métricas en tiempo real ── */}
      <div className="grid grid-cols-2 gap-3">

        {/* MPV — full-width, zone-coloured */}
        <div
          className="col-span-2 rounded-fieldlab border border-white/5 p-4"
          style={{ background: currentMPV > 0 ? colors.bg : '#1e293b' }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Zap size={12} /> MPV
            </span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full border"
              style={{
                background: currentMPV > 0 ? colors.bg : 'rgba(255,255,255,0.04)',
                color:      currentMPV > 0 ? colors.text : '#475569',
                borderColor: currentMPV > 0 ? colors.text + '40' : 'rgba(255,255,255,0.08)',
              }}
            >
              {currentZone}
            </span>
          </div>

          <div className="flex items-end gap-2">
            <span
              className="text-5xl font-data font-bold leading-none"
              style={{ color: currentMPV > 0 ? colors.text : '#475569' }}
            >
              {currentMPV.toFixed(2)}
            </span>
            <span className="text-xl text-slate-500 mb-1">m/s</span>
          </div>

          {isTracking && (
            <p className="mt-1.5 text-xs text-slate-500 font-data">
              live {currentVelocity >= 0 ? '+' : ''}{currentVelocity.toFixed(3)} m/s
            </p>
          )}
        </div>

        {/* Peak Velocity */}
        <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
          <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">V. Pico</span>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-data font-bold text-slate-100">{currentPeak.toFixed(2)}</span>
            <span className="text-sm text-slate-500 mb-0.5">m/s</span>
          </div>
        </div>

        {/* Power */}
        <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
          <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Potencia</span>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-data font-bold text-slate-100">{Math.round(currentPower)}</span>
            <span className="text-sm text-slate-500 mb-0.5">W</span>
          </div>
        </div>

        {/* Rep counter */}
        <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
          <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Reps</span>
          <span className="text-2xl font-data font-bold text-accent">{repData.length}</span>
        </div>

        {/* Fatigue Index */}
        <div className={`rounded-fieldlab border p-4 transition-colors ${
          fatigueStatus === 'danger'  ? 'bg-danger/10 border-danger/30'
          : fatigueStatus === 'warning' ? 'bg-warning/10 border-warning/30'
          : 'bg-surface border-white/5'
        }`}>
          <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Fatiga</span>
          {fatigueIndex !== null ? (
            <>
              <div className="flex items-end gap-1">
                <span className={`text-2xl font-data font-bold ${
                  fatigueStatus === 'danger'  ? 'text-danger'
                  : fatigueStatus === 'warning' ? 'text-warning'
                  : 'text-slate-100'
                }`}>
                  {fatigueIndex.toFixed(1)}
                </span>
                <span className="text-sm text-slate-500 mb-0.5">%</span>
              </div>
              {fatigueStatus === 'danger' && (
                <p className="text-xs font-bold text-danger mt-1">DETENER SERIE</p>
              )}
            </>
          ) : (
            <span className="text-sm text-slate-600">desde rep 3</span>
          )}
        </div>
      </div>

      {/* ── Gráfico MPV por rep ── */}
      {chartData.length > 0 && (
        <div className="bg-surface rounded-fieldlab border border-white/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} className="text-accent" />
            <span className="text-sm font-medium text-slate-200">MPV por repetición</span>
            {firstMPV > 0 && (
              <span className="ml-auto text-xs text-slate-600 font-data">
                ref {firstMPV.toFixed(2)} m/s
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="rep"
                tickFormatter={v => `R${v}`}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={v => `Rep ${v}`}
                formatter={v => [`${v} m/s`, 'MPV']}
                labelStyle={{ color: '#f8fafc' }}
                itemStyle={{ color: '#38bdf8' }}
              />
              {/* Reference line at first rep MPV */}
              {firstMPV > 0 && (
                <ReferenceLine
                  y={firstMPV}
                  stroke="rgba(56,189,248,0.35)"
                  strokeDasharray="5 4"
                  label={{ value: 'Rep 1', fill: '#64748b', fontSize: 10, position: 'insideTopLeft' }}
                />
              )}
              {/* Danger zone — 20% drop from first rep */}
              {dropLine && (
                <>
                  <ReferenceArea y1={0} y2={dropLine} fill="rgba(239,68,68,0.07)" />
                  <ReferenceLine
                    y={dropLine}
                    stroke="rgba(239,68,68,0.55)"
                    strokeDasharray="5 4"
                    label={{ value: '-20%', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }}
                  />
                </>
              )}
              <Line
                type="monotone"
                dataKey="mpv"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ fill: '#38bdf8', r: 4 }}
                activeDot={{ r: 6, fill: '#7dd3fc' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Panel Inferior — Tabla histórico de serie ── */}
      {repData.length > 0 && (
        <div className="bg-surface rounded-fieldlab border border-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <TrendingDown size={14} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-200">Histórico de serie</span>
            <span className="ml-auto text-xs text-slate-500">{athleteName || '—'} · {exercise} · {load || '—'} kg</span>
          </div>

          {fatigueStatus === 'danger' && (
            <div className="mx-4 mt-3 flex items-center gap-2 p-2.5 bg-danger/10 border border-danger/30 rounded-lg">
              <AlertTriangle size={14} className="text-danger flex-shrink-0" />
              <span className="text-xs font-bold text-danger">DETENER SERIE — caída de velocidad superior al 20%</span>
            </div>
          )}
          {fatigueStatus === 'warning' && (
            <div className="mx-4 mt-3 flex items-center gap-2 p-2.5 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle size={14} className="text-warning flex-shrink-0" />
              <span className="text-xs text-warning">
                Fatiga elevada ({fatigueIndex?.toFixed(1)}%) — monitorear velocidad
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="text-left  px-4 py-2.5">Rep</th>
                  <th className="text-right px-4 py-2.5">MPV (m/s)</th>
                  <th className="text-right px-4 py-2.5">V.Pico (m/s)</th>
                  <th className="text-right px-4 py-2.5">Potencia (W)</th>
                  <th className="text-right px-4 py-2.5">Zona</th>
                </tr>
              </thead>
              <tbody>
                {repData.map((r, i) => {
                  const isLast = i === repData.length - 1;
                  const pw     = calcPower(r.mpv, repLoadRef.current[r.rep] ?? load);
                  const zone   = classifyLoad(r.mpv);
                  const cl     = zoneColors(r.mpv);
                  return (
                    <tr
                      key={r.rep}
                      className={`border-t border-white/5 transition-colors ${
                        isLast ? 'bg-accent/5' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-data text-slate-400">
                        {r.rep}
                        {isLast && <span className="ml-1.5 text-accent text-xs">←</span>}
                      </td>
                      <td className="px-4 py-2.5 font-data font-bold text-right text-slate-100">
                        {r.mpv.toFixed(3)}
                      </td>
                      <td className="px-4 py-2.5 font-data text-right text-slate-300">
                        {r.peakVelocity.toFixed(3)}
                      </td>
                      <td className="px-4 py-2.5 font-data text-right text-slate-300">
                        {Math.round(pw)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{ background: cl.bg, color: cl.text }}
                        >
                          {zone}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
