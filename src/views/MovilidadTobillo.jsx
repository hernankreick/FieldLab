import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  useTiltAngle,
  getAngleStatus,
  statusColor,
  statusLabel,
  statusBg,
  NORMAS,
} from '../hooks/useTiltAngle';
import { useAuth } from '../context/AuthContext';
import { PLAYERS } from '../data/players';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function calcAsimetria(a, b) {
  const mayor = Math.max(a, b);
  if (mayor === 0) return 0;
  return Math.round((Math.abs(a - b) / mayor) * 100);
}

function getInterpretation(angle, sport) {
  const n = NORMAS[sport] ?? NORMAS.default;
  if (angle >= n.optimo) return 'Rango óptimo. Sin restricción funcional.';
  if (angle >= n.precaucion)
    return 'Restricción leve. Puede afectar la mecánica de carrera y cambio de dirección.';
  return 'Restricción significativa. Riesgo aumentado de lesión de rodilla y tobillo.';
}

function getInstruction(angle) {
  if (angle === null) return '📱 Apoyá el celular plano sobre la tibia';
  if (angle < 10)    return '↕ Incliná más el celular hacia adelante';
  if (angle > 55)    return '⚠ Demasiada inclinación, verificá la posición';
  return '✓ Ángulo estable — tocá Capturar';
}

// ── SVG de referencia — protocolo visual ─────────────────────────────────────

function LungeSVG() {
  return (
    <svg
      viewBox="0 0 200 180"
      style={{ width: '100%', maxWidth: 220, margin: '16px auto', display: 'block' }}
    >
      <rect width="200" height="180" fill="#1e293b" rx="12" />
      {/* Muslo */}
      <line x1="100" y1="40" x2="80" y2="110" stroke="#475569" strokeWidth="18" strokeLinecap="round" />
      {/* Tibia */}
      <line x1="80" y1="110" x2="95" y2="165" stroke="#475569" strokeWidth="16" strokeLinecap="round" />
      {/* Pie */}
      <line x1="95" y1="165" x2="130" y2="168" stroke="#475569" strokeWidth="10" strokeLinecap="round" />
      {/* Celular */}
      <rect x="60" y="112" width="28" height="48" rx="4"
        fill="#0f172a" stroke="#38bdf8" strokeWidth="2"
        transform="rotate(-12, 74, 136)" />
      <rect x="63" y="116" width="22" height="40" rx="2"
        fill="#1e3a5f" opacity="0.8"
        transform="rotate(-12, 74, 136)" />
      <text x="69" y="138" fill="#38bdf8" fontSize="9"
        fontFamily="monospace" fontWeight="bold"
        transform="rotate(-12, 74, 136)">38°</text>
      {/* Labels */}
      <text x="105" y="130" fill="#94a3b8" fontSize="9">← apoyá</text>
      <text x="105" y="142" fill="#94a3b8" fontSize="9">{'  '}aquí</text>
      <circle cx="130" cy="168" r="5" fill="none" stroke="#22c55e" strokeWidth="2" />
      <text x="118" y="178" fill="#22c55e" fontSize="8">talón fijo</text>
    </svg>
  );
}

// ── ResultScreen ──────────────────────────────────────────────────────────────

function ResultScreen({ side, angle, sport, onNext, nextLabel }) {
  const st     = getAngleStatus(angle, sport);
  const col    = statusColor(st);
  const bg     = statusBg(st);
  const label  = statusLabel(st);
  const interp = getInterpretation(angle, sport);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-100 text-center">
        Resultado — {side === 'izq' ? 'Izquierdo' : 'Derecho'}
      </h2>

      <div className="rounded-2xl p-8 flex flex-col items-center gap-4"
        style={{ background: bg, border: `2px solid ${col}` }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '96px', fontWeight: 900, color: col, lineHeight: 1,
        }}>
          {angle}°
        </span>
        <div className="px-5 py-1.5 rounded-full font-bold text-sm"
          style={{ background: col, color: '#0f172a' }}>
          {label}
        </div>
      </div>

      <div className="rounded-xl p-4"
        style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-sm text-slate-300 leading-relaxed">{interp}</p>
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-xl font-semibold text-sm"
        style={{ background: '#38bdf8', color: '#0f172a' }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

// ── SideCard (Resumen) ────────────────────────────────────────────────────────

function SideCard({ label, angle, sport }) {
  const st  = getAngleStatus(angle, sport);
  const col = statusColor(st);
  const bg  = statusBg(st);
  const lbl = statusLabel(st);

  return (
    <div className="flex-1 rounded-xl p-4 flex flex-col items-center gap-2"
      style={{ background: bg, border: `1px solid ${col}` }}>
      <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '52px', fontWeight: 900, color: col, lineHeight: 1,
      }}>
        {angle}°
      </span>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: col, color: '#0f172a' }}>
        {lbl}
      </span>
    </div>
  );
}

// ── SummaryScreen ─────────────────────────────────────────────────────────────

function SummaryScreen({ izq, der, sport, coachId, athleteId, onRestart }) {
  const [saved,      setSaved]      = useState(false);
  const [selAthlete, setSelAthlete] = useState(athleteId ? String(athleteId) : '');

  const asim    = calcAsimetria(izq, der);
  const asimSt  = asim >= 15 ? 'danger' : asim >= 10 ? 'warning' : 'ok';
  const asimCol = asimSt === 'danger'  ? '#ef4444'
                : asimSt === 'warning' ? '#eab308'
                : '#22c55e';
  const asimBg  = asimSt === 'danger'  ? 'rgba(239,68,68,0.12)'
                : asimSt === 'warning' ? 'rgba(234,179,8,0.12)'
                : 'rgba(34,197,94,0.12)';

  function handleSave() {
    const aid = selAthlete || 'generic';
    const key = `fieldlab_${coachId}_mobility_${aid}_tobillo_${todayStr()}`;
    const data = {
      izq, der,
      asimetria:  asim,
      status_izq: getAngleStatus(izq, sport),
      status_der: getAngleStatus(der, sport),
      sport,
      timestamp:  new Date().toISOString(),
      athleteId:  aid,
    };
    try {
      localStorage.setItem(key, JSON.stringify(data));
      setSaved(true);
    } catch { /* storage lleno */ }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-slate-100 text-center">Resumen final</h2>

      <div className="flex gap-3">
        <SideCard label="Izquierdo" angle={izq} sport={sport} />
        <SideCard label="Derecho"   angle={der} sport={sport} />
      </div>

      {/* Asimetría */}
      <div className="rounded-xl p-4 space-y-2"
        style={{ background: asimBg, border: `1px solid ${asimCol}` }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-300">Asimetría</p>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '28px', fontWeight: 700, color: asimCol,
          }}>
            {asim}%
          </span>
        </div>
        {asimSt === 'danger'  && <p className="text-xs font-medium" style={{ color: '#ef4444' }}>⚠ Asimetría significativa — revisar cadena posterior</p>}
        {asimSt === 'warning' && <p className="text-xs font-medium" style={{ color: '#eab308' }}>⚠ Asimetría moderada — monitorear</p>}
        {asimSt === 'ok'      && <p className="text-xs font-medium" style={{ color: '#22c55e' }}>✓ Simetría dentro del rango normal</p>}
      </div>

      {/* Selector de atleta (solo si no viene pre-cargado) */}
      {!athleteId && (
        <div className="rounded-xl p-4"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block mb-2">
            Guardar para atleta
          </label>
          <select
            value={selAthlete}
            onChange={e => setSelAthlete(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm text-slate-200"
            style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <option value="">Sin atleta asociado</option>
            {PLAYERS.map(p => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {!saved ? (
        <button onClick={handleSave}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: '#38bdf8', color: '#0f172a' }}>
          💾 Guardar resultado
        </button>
      ) : (
        <div className="w-full py-3 rounded-xl font-semibold text-sm text-center"
          style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }}>
          ✓ Guardado correctamente
        </div>
      )}

      <button onClick={onRestart}
        className="w-full py-3 rounded-xl font-semibold text-sm"
        style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
        Nuevo test
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
// Máquina de estados:
//   instrucciones → permiso → midiendo_izq → resultado_izq
//   → midiendo_der → resultado_der → resumen

export default function MovilidadTobillo({ initialId, onNavigate, onFullscreen }) {
  const { coach } = useAuth();
  const [step,     setStep]     = useState('instrucciones');
  const [izqAngle, setIzqAngle] = useState(null);
  const [derAngle, setDerAngle] = useState(null);

  const {
    angle, error,
    requestPermission, startReading, stopReading,
  } = useTiltAngle();

  const athlete = PLAYERS.find(p => p.id === Number(initialId)) ?? null;
  const sport   = (athlete?.sport ?? 'default').toLowerCase();
  const coachId = coach?.id ?? 'anon';
  const normas  = NORMAS[sport] ?? NORMAS.default;

  // Sin cámara → nunca se necesita pantalla completa
  useEffect(() => {
    return () => onFullscreen?.(false);
  }, [onFullscreen]);

  // Controlar lectura del sensor según el paso activo
  useEffect(() => {
    if (step !== 'midiendo_izq' && step !== 'midiendo_der') return;
    startReading();
    return () => stopReading();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function restart() {
    setStep('instrucciones');
    setIzqAngle(null);
    setDerAngle(null);
  }

  function handleCapture() {
    stopReading();
    if (step === 'midiendo_izq') {
      setIzqAngle(angle);
      setStep('resultado_izq');
    } else {
      setDerAngle(angle);
      setStep('resultado_der');
    }
  }

  // ── INSTRUCCIONES ─────────────────────────────────────────────────────────
  if (step === 'instrucciones') {
    return (
      <div className="space-y-5">
        <div>
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4 transition-colors"
          >
            <ArrowLeft size={15} /> Volver
          </button>
          <h1 className="text-2xl font-bold text-slate-100">Lunge Test</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Dorsiflexión de Tobillo — Medición con giroscopio
          </p>
          {athlete && (
            <p className="text-sm mt-1" style={{ color: '#38bdf8' }}>
              Atleta: {athlete.name}
            </p>
          )}
        </div>

        <LungeSVG />

        {/* Protocolo */}
        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-base font-semibold text-slate-200">Protocolo</h2>
          {[
            'Atleta en posición de lunge, talón izquierdo fijo en el suelo',
            'Flexioná la rodilla al máximo sin levantar el talón',
            'Apoyá el celular plano contra la espinilla (tibia)',
            'Tocá "Medir" y esperá que el ángulo se estabilice',
            'Tocá "Capturar" y repetí con el tobillo derecho',
          ].map((txt, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: '#38bdf8', color: '#0f172a' }}>
                <span className="text-xs font-bold">{i + 1}</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{txt}</p>
            </div>
          ))}
        </div>

        {/* Valores normativos — derivados de NORMAS[sport] */}
        <div className="rounded-2xl p-5"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Valores normativos
            {sport !== 'default' && (
              <span className="ml-2 normal-case font-normal text-slate-500">({sport})</span>
            )}
          </h3>
          <div className="space-y-2.5">
            {[
              { col: '#22c55e', txt: `Óptimo: ≥ ${normas.optimo}°` },
              { col: '#eab308', txt: `Precaución: ${normas.precaucion}° – ${normas.optimo - 1}°` },
              { col: '#ef4444', txt: `Riesgo: < ${normas.precaucion}°` },
            ].map(({ col, txt }) => (
              <div key={txt} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: col }} />
                <span className="text-sm text-slate-300">{txt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fix (bug #1): requestPermission() debe llamarse directamente desde
            el onClick — iOS 13+ Safari exige que el call stack provenga del
            gesture handler. Llamarlo desde useEffect (post-render) hace que
            el token de user-gesture ya haya expirado y arroja SecurityError. */}
        <button
          onClick={async () => {
            const ok = await requestPermission();
            if (ok) setStep('midiendo_izq');
            // Si ok === false el hook ya seteó error; mostrar pantalla de error
            else     setStep('permiso');
          }}
          className="w-full py-4 rounded-xl font-bold text-base"
          style={{ background: '#38bdf8', color: '#0f172a' }}
        >
          Comenzar
        </button>
      </div>
    );
  }

  // ── PERMISO ───────────────────────────────────────────────────────────────
  // Sólo se muestra si requestPermission() falló (error !== null).
  // El flujo normal (Android/desktop/iOS exitoso) salta directamente a
  // midiendo_izq desde el onClick de "Comenzar" y nunca llega aquí.
  if (step === 'permiso') {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl p-6 text-center space-y-4"
          style={{ background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)' }}>
          <span style={{ fontSize: 40 }}>⚠️</span>
          <p className="text-sm text-red-400">
            {error ?? 'No se pudo obtener permiso del giroscopio.'}
          </p>
        </div>
        {/* Fix: Reintentar también llama desde onClick para respetar el
            gesture requirement de iOS */}
        <button
          onClick={async () => {
            const ok = await requestPermission();
            if (ok) setStep('midiendo_izq');
          }}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: '#38bdf8', color: '#0f172a' }}
        >
          Reintentar
        </button>
        <button
          onClick={() => setStep('instrucciones')}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{ background: '#1e293b', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          ← Volver
        </button>
      </div>
    );
  }

  // ── MIDIENDO (izquierdo y derecho) ────────────────────────────────────────
  if (step === 'midiendo_izq' || step === 'midiendo_der') {
    const isIzq     = step === 'midiendo_izq';
    const sideLabel = isIzq ? 'TOBILLO IZQUIERDO' : 'TOBILLO DERECHO';

    const st      = angle != null ? getAngleStatus(angle, sport) : null;
    const col     = st ? statusColor(st) : '#38bdf8';
    const stLabel = st ? statusLabel(st) : null;

    // Barra de rango (0–60°)
    const MAX_BAR  = 60;
    const barPct   = Math.min(angle ?? 0, MAX_BAR) / MAX_BAR * 100;
    const precPct  = (normas.precaucion / MAX_BAR) * 100;
    const optPct   = (normas.optimo    / MAX_BAR) * 100;

    const instrMsg  = getInstruction(angle);
    const msgColor  = angle !== null && angle >= 10 && angle <= 55 ? '#22c55e' : '#94a3b8';
    const canCapture = angle !== null;

    return (
      <div className="space-y-5">
        {/* Atrás */}
        <button
          onClick={() => {
            stopReading();
            setStep(isIzq ? 'instrucciones' : 'resultado_izq');
          }}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={15} /> Atrás
        </button>

        {/* Label de lado */}
        <p className="text-xs font-bold uppercase tracking-widest text-center"
          style={{ color: '#38bdf8' }}>
          {sideLabel}
        </p>

        {/* Ángulo grande */}
        <div className="rounded-2xl py-8 flex flex-col items-center gap-3"
          style={{
            background: st ? statusBg(st) : 'rgba(56,189,248,0.08)',
            border: `2px solid ${col}`,
          }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '96px', fontWeight: 900, lineHeight: 1,
            color: col,
            transition: 'color 0.3s ease',
          }}>
            {angle != null ? `${angle}°` : '--'}
          </span>
          {stLabel && (
            <div className="px-4 py-1 rounded-full text-xs font-bold"
              style={{ background: col, color: '#0f172a' }}>
              {stLabel}
            </div>
          )}
        </div>

        {/* Barra de rango */}
        <div className="rounded-xl p-4"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">
            Rango de dorsiflexión
          </p>
          {/* Barra */}
          <div className="relative" style={{ height: 12, borderRadius: 6, background: '#334155' }}>
            {/* Fill */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${barPct}%`,
              borderRadius: 6,
              background: col,
              transition: 'width 0.1s ease, background-color 0.3s ease',
            }} />
            {/* Marca precaución */}
            <div style={{
              position: 'absolute',
              left: `${precPct}%`, transform: 'translateX(-50%)',
              top: -5, bottom: -5, width: 2,
              background: '#eab308', borderRadius: 1,
            }} />
            {/* Marca óptimo */}
            <div style={{
              position: 'absolute',
              left: `${optPct}%`, transform: 'translateX(-50%)',
              top: -5, bottom: -5, width: 2,
              background: '#22c55e', borderRadius: 1,
            }} />
          </div>
          {/* Labels posicionados bajo las marcas */}
          <div className="relative mt-2" style={{ height: 16 }}>
            <span className="absolute text-xs text-slate-500" style={{ left: 0 }}>0°</span>
            <span className="absolute text-xs" style={{
              left: `${precPct}%`, transform: 'translateX(-50%)', color: '#eab308',
            }}>
              {normas.precaucion}°
            </span>
            <span className="absolute text-xs" style={{
              left: `${optPct}%`, transform: 'translateX(-50%)', color: '#22c55e',
            }}>
              {normas.optimo}°
            </span>
            <span className="absolute text-xs text-slate-500" style={{ right: 0 }}>60°</span>
          </div>
        </div>

        {/* Instrucción contextual */}
        <div className="rounded-xl p-4 text-center"
          style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-sm font-medium" style={{ color: msgColor }}>
            {instrMsg}
          </p>
        </div>

        {/* Botón capturar */}
        <button
          onClick={handleCapture}
          disabled={!canCapture}
          className="w-full py-4 rounded-xl font-bold text-base"
          style={{
            background: canCapture ? '#38bdf8' : '#334155',
            color:      canCapture ? '#0f172a' : '#64748b',
            cursor:     canCapture ? 'pointer' : 'not-allowed',
            boxShadow:  canCapture ? '0 4px 24px rgba(56,189,248,0.3)' : 'none',
            transition: 'background 0.2s ease',
          }}
        >
          📐 Capturar ángulo máximo
        </button>
      </div>
    );
  }

  // ── RESULTADO IZQUIERDO ────────────────────────────────────────────────────
  if (step === 'resultado_izq') {
    return (
      <ResultScreen
        side="izq"
        angle={izqAngle}
        sport={sport}
        onNext={() => setStep('midiendo_der')}
        nextLabel="Evaluar Tobillo Derecho →"
      />
    );
  }

  // ── RESULTADO DERECHO ──────────────────────────────────────────────────────
  if (step === 'resultado_der') {
    return (
      <ResultScreen
        side="der"
        angle={derAngle}
        sport={sport}
        onNext={() => setStep('resumen')}
        nextLabel="Ver Resumen →"
      />
    );
  }

  // ── RESUMEN FINAL ──────────────────────────────────────────────────────────
  if (step === 'resumen') {
    return (
      <SummaryScreen
        izq={izqAngle}
        der={derAngle}
        sport={sport}
        coachId={coachId}
        athleteId={initialId}
        onRestart={restart}
        onNavigate={onNavigate}
      />
    );
  }

  return null;
}
