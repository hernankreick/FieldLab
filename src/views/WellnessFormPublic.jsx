import { useState, useEffect } from 'react';
import { saveWellnessPublic, getPlayerWithCoach } from '../lib/db';

const SLIDER_META = [
  { key: 'sleep',    label: 'Sueño',          minLabel: 'Pésimo',     maxLabel: 'Excelente' },
  { key: 'stress',   label: 'Estrés',         minLabel: 'Sin estrés', maxLabel: 'Extremo'   },
  { key: 'fatigue',  label: 'Fatiga',         minLabel: 'Sin fatiga', maxLabel: 'Extrema'   },
  { key: 'soreness', label: 'Dolor muscular', minLabel: 'Sin dolor',  maxLabel: 'Muy alto'  },
];

const PAIN_ZONES = [
  { id: 'cuello',      label: 'Cuello'           },
  { id: 'hombro_der',  label: 'Hombro der'       },
  { id: 'hombro_izq',  label: 'Hombro izq'       },
  { id: 'lumbar',      label: 'Lumbar'           },
  { id: 'gluteo_der',  label: 'Glúteo der'       },
  { id: 'gluteo_izq',  label: 'Glúteo izq'       },
  { id: 'isquio_der',  label: 'Isquiotibial der' },
  { id: 'isquio_izq',  label: 'Isquiotibial izq' },
  { id: 'rodilla_der', label: 'Rodilla der'      },
  { id: 'rodilla_izq', label: 'Rodilla izq'      },
];

const S = {
  root:    { background: '#0f172a', minHeight: '100vh', padding: '1rem', fontFamily: 'system-ui, -apple-system, sans-serif' },
  wrap:    { maxWidth: 420, margin: '0 auto' },
  label:   { color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 3px' },
  heading: { color: '#f8fafc', fontSize: 21, fontWeight: 800, margin: '0 0 2px' },
  sub:     { color: '#64748b', fontSize: 12, margin: 0 },
  card:    { background: '#1e293b', borderRadius: 16, padding: '0.875rem 1rem', marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' },
  section: { color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 },
  sliderRow: { marginBottom: 14 },
  sliderTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 },
  sliderName:{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 },
  sliderVal: { color: '#38bdf8', fontFamily: 'ui-monospace, monospace', fontSize: 15, fontWeight: 800 },
  slider:    { width: '100%', accentColor: '#3b82f6', cursor: 'pointer', margin: 0, height: 20 },
  minmax:    { display: 'flex', justifyContent: 'space-between', marginTop: 1 },
  minmaxTxt: { color: '#334155', fontSize: 10 },
  zoneGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 },
  submit:    { width: '100%', padding: '13px', borderRadius: 14, background: '#3b82f6', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 2 },
  center:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '2rem' },
};

function zoneBtn(active) {
  return {
    background:   active ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
    border:       `1px solid ${active ? '#ef4444' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 10, padding: '7px 6px',
    color:        active ? '#ef4444' : '#64748b',
    fontSize:     11, fontWeight: 600, cursor: 'pointer',
    textAlign:    'center', transition: 'all 0.15s',
  };
}

export default function WellnessFormPublic() {
  const params     = new URLSearchParams(window.location.search);
  const playerId   = params.get('player_id');
  const playerName = params.get('player_name') ?? 'Jugador';

  const [form,        setForm]        = useState({ sleep: 5, stress: 2, fatigue: 2, soreness: 2 });
  const [zones,       setZones]       = useState({});
  const [submitted,   setSubmitted]   = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [saveError,   setSaveError]   = useState(null);
  const [coachId,    setCoachId]    = useState(null);
  const [fetchState, setFetchState] = useState('loading'); // 'loading' | 'ok' | 'error'

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  useEffect(() => {
    if (!playerId || !UUID_RE.test(playerId)) { setFetchState('error'); return; }
    setFetchState('loading');
    getPlayerWithCoach(playerId)
      .then(p => {
        const cid = p.teams?.coach_id ?? null;
        if (!cid) { setFetchState('error'); return; }
        setCoachId(cid);
        setFetchState('ok');
      })
      .catch(() => setFetchState('error'));
  }, [playerId]);

  function setSlider(key, val) {
    setForm(prev => ({ ...prev, [key]: Number(val) }));
  }

  function toggleZone(id) {
    setZones(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = 'alto';
      return next;
    });
  }

  function retry() {
    setFetchState('loading');
    getPlayerWithCoach(playerId)
      .then(p => {
        const cid = p.teams?.coach_id ?? null;
        setCoachId(cid || null);
        setFetchState(cid ? 'ok' : 'error');
      })
      .catch(() => setFetchState('error'));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!playerId || !coachId) return;
    setLoading(true);
    setSaveError(null);
    try {
      await saveWellnessPublic({
        player_id:   playerId,
        coach_id:    coachId,
        date:        new Date().toISOString().split('T')[0],
        sleep:       form.sleep,
        stress:      form.stress,
        fatigue:     form.fatigue,
        muscle_pain: form.soreness,
        zones:       Object.keys(zones).filter(k => zones[k]).join(',') || null,
      });
      setSubmitted(true);
    } catch {
      setSaveError('No se pudo guardar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  if (!playerId) {
    return (
      <div style={S.root}>
        <div style={S.center}>
          <p style={{ color: '#ef4444', fontSize: 15 }}>QR inválido. Escaneá el código actualizado.</p>
        </div>
      </div>
    );
  }

  if (fetchState === 'loading') {
    return (
      <div style={S.root}>
        <div style={S.center}>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Cargando...</p>
        </div>
      </div>
    );
  }

  if (fetchState === 'error') {
    return (
      <div style={S.root}>
        <div style={S.center}>
          <p style={{ color: '#ef4444', fontSize: 15, marginBottom: 16 }}>
            No se pudo cargar el formulario.
          </p>
          <button
            onClick={retry}
            style={{
              padding: '10px 24px', borderRadius: 10,
              background: '#3b82f6', color: '#fff',
              border: 'none', fontSize: 14,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={S.root}>
        <div style={S.center}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
          <p style={{ color: '#f8fafc', fontSize: 19, fontWeight: 700, margin: '0 0 6px' }}>Reporte enviado</p>
          <p style={{ color: '#94a3b8', fontSize: 15 }}>Buen entrenamiento, {playerName.split(' ')[0]}.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <div style={S.wrap}>
        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <p style={S.label}>FieldLab · Wellness</p>
          <h1 style={S.heading}>{playerName}</h1>
          <p style={S.sub}>
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Sliders */}
          <div style={S.card}>
            <p style={S.section}>¿Cómo llegás hoy?</p>
            {SLIDER_META.map(({ key, label, minLabel, maxLabel }) => (
              <div key={key} style={S.sliderRow}>
                <div style={S.sliderTop}>
                  <span style={S.sliderName}>{label}</span>
                  <span style={S.sliderVal}>{form[key]}</span>
                </div>
                <input
                  type="range" min="1" max="7" step="1"
                  value={form[key]}
                  onChange={e => setSlider(key, e.target.value)}
                  style={S.slider}
                />
                <div style={S.minmax}>
                  <span style={S.minmaxTxt}>{minLabel}</span>
                  <span style={S.minmaxTxt}>{maxLabel}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pain zones */}
          <div style={S.card}>
            <p style={S.section}>Zonas de dolor — tocá si aplica</p>
            <div style={S.zoneGrid}>
              {PAIN_ZONES.map(({ id, label }) => (
                <button
                  key={id} type="button"
                  onClick={() => toggleZone(id)}
                  style={zoneBtn(!!zones[id])}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {saveError && (
            <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
              {saveError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...S.submit, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Enviando...' : 'Enviar reporte'}
          </button>
        </form>
      </div>
    </div>
  );
}
