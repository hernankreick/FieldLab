import { useState, useMemo, Fragment } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell,
} from 'recharts';
import { getMobilityAssessments } from '../../utils/storage';

function statusColor(status) {
  if (status === 'NORMAL') return '#22c55e';
  if (status === 'LIMITADO') return '#eab308';
  return '#ef4444';
}

function DotDer({ cx, cy, payload }) {
  if (payload?.der == null || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const c = payload.derStatus ? statusColor(payload.derStatus) : '#38bdf8';
  return <circle cx={cx} cy={cy} r={5} fill={c} stroke="#0f172a" strokeWidth={1.5} />;
}

function DotIzq({ cx, cy, payload }) {
  if (payload?.izq == null || !Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const c = payload.izqStatus ? statusColor(payload.izqStatus) : '#a78bfa';
  return <circle cx={cx} cy={cy} r={5} fill={c} stroke="#0f172a" strokeWidth={1.5} />;
}

export default function MobilityHistory({ athleteId, coachId, jointConfig, athleteName }) {
  const jointKeys = Object.keys(jointConfig);
  const [selJoint, setSelJoint] = useState(jointKeys[0]);
  const [selMovement, setSelMovement] = useState(
    Object.keys(jointConfig[jointKeys[0]].movements)[0]
  );

  const allRecs = useMemo(
    () => getMobilityAssessments(athleteId, coachId),
    [athleteId, coachId]
  );

  const sessionDates = useMemo(() => {
    const s = new Set(allRecs.map(r => r.date.slice(0, 10)));
    return [...s].sort((a, b) => b.localeCompare(a));
  }, [allRecs]);

  const latestDate = sessionDates[0];
  const latestRecs = useMemo(
    () => (latestDate ? allRecs.filter(r => r.date.startsWith(latestDate)) : []),
    [allRecs, latestDate]
  );

  const trendData = useMemo(() => {
    return sessionDates
      .slice(0, 6)
      .reverse()
      .map(date => {
        const recs = allRecs.filter(
          r => r.date.startsWith(date) && r.joint === selJoint && r.movement === selMovement
        );
        const der = recs.find(r => r.side === 'der');
        const izq = recs.find(r => r.side === 'izq');
        return {
          date: date.slice(5).replace('-', '/'),
          der: der?.angle ?? null,
          derStatus: der?.status ?? null,
          izq: izq?.angle ?? null,
          izqStatus: izq?.status ?? null,
        };
      });
  }, [allRecs, sessionDates, selJoint, selMovement]);

  const asiData = useMemo(() => {
    return Object.entries(jointConfig[selJoint]?.movements ?? {}).flatMap(([movKey, mov]) => {
      const recs = allRecs.filter(r => r.joint === selJoint && r.movement === movKey);
      const latDer = recs.find(r => r.side === 'der');
      const latIzq = recs.find(r => r.side === 'izq');
      if (!latDer || !latIzq) return [];
      const dom = Math.max(latDer.angle, latIzq.angle);
      const def = Math.min(latDer.angle, latIzq.angle);
      const asi = dom > 0 ? Math.round(((dom - def) / dom) * 100) : 0;
      const words = mov.label.split(' ');
      const name = words.length > 2
        ? words.map(w => w[0]).join('').toUpperCase()
        : mov.label;
      return [{ name, fullName: mov.label, asi, alert: asi >= 10 }];
    });
  }, [allRecs, jointConfig, selJoint]);

  if (!allRecs.length) {
    return (
      <div style={{ textAlign: 'center', color: '#475569', paddingTop: 32 }}>
        <p style={{ margin: 0 }}>No hay historial registrado para {athleteName}.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Last session summary */}
      {latestDate && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>
            ÚLTIMA SESIÓN — {latestDate}
          </p>
          {jointKeys.map(jKey => {
            const jRecs = latestRecs.filter(r => r.joint === jKey);
            if (!jRecs.length) return null;
            return (
              <div key={jKey} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>
                  {jointConfig[jKey].label.toUpperCase()}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '4px 10px', alignItems: 'center' }}>
                  <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>MOVIMIENTO</span>
                  <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>DER°</span>
                  <span style={{ color: '#475569', fontSize: 10, fontWeight: 700 }}>IZQ°</span>
                  {Object.entries(jointConfig[jKey].movements).map(([movKey, mov]) => {
                    const der = jRecs.find(r => r.movement === movKey && r.side === 'der');
                    const izq = jRecs.find(r => r.movement === movKey && r.side === 'izq');
                    if (!der && !izq) return null;
                    return (
                      <Fragment key={movKey}>
                        <span style={{ color: '#cbd5e1', fontSize: 12, paddingTop: 6, borderTop: '1px solid #273347' }}>
                          {mov.label}
                        </span>
                        {['der', 'izq'].map(side => {
                          const r = side === 'der' ? der : izq;
                          const color = r ? statusColor(r.status) : '#334155';
                          return (
                            <span key={side} style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              color, fontSize: 13, fontWeight: 700,
                              textAlign: 'center', paddingTop: 6, borderTop: '1px solid #273347',
                            }}>
                              {r ? `${r.angle}°` : '—'}
                            </span>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trend section */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>TENDENCIA</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {jointKeys.map(jKey => (
            <button
              key={jKey}
              onClick={() => {
                setSelJoint(jKey);
                setSelMovement(Object.keys(jointConfig[jKey].movements)[0]);
              }}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                background: selJoint === jKey ? '#38bdf8' : '#1e293b',
                color: selJoint === jKey ? '#0f172a' : '#64748b',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              {jointConfig[jKey].label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(jointConfig[selJoint].movements).map(([movKey, mov]) => (
            <button
              key={movKey}
              onClick={() => setSelMovement(movKey)}
              style={{
                padding: '5px 10px', borderRadius: 8, border: 'none',
                background: selMovement === movKey ? '#334155' : 'transparent',
                color: selMovement === movKey ? '#e2e8f0' : '#64748b',
                fontWeight: 600, fontSize: 11, cursor: 'pointer',
              }}
            >
              {mov.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trend LineChart */}
      {trendData.length > 0 && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px', marginBottom: 16 }}>
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 6 }}>
            {jointConfig[selJoint].movements[selMovement]?.label.toUpperCase()} — ÚLTIMAS {trendData.length} SESIONES
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
            {[{ color: '#38bdf8', label: 'Derecho' }, { color: '#a78bfa', label: 'Izquierdo' }].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ color: '#94a3b8', fontSize: 11 }}>{label}</span>
              </div>
            ))}
            <span style={{ color: '#475569', fontSize: 10, marginLeft: 'auto', alignSelf: 'center' }}>punto = estado ROM</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v, name) => [v != null ? `${v}°` : '—', name]}
              />
              <Line type="monotone" dataKey="der" stroke="#38bdf8" strokeWidth={2}
                dot={<DotDer />} connectNulls={false} name="Der" />
              <Line type="monotone" dataKey="izq" stroke="#a78bfa" strokeWidth={2}
                dot={<DotIzq />} connectNulls={false} name="Izq" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ASI bar chart */}
      {asiData.length > 0 && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, padding: '12px' }}>
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 8 }}>
            ASI — {jointConfig[selJoint].label.toUpperCase()} (últimas mediciones)
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={asiData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v, _n, p) => [`${v}%`, p.payload.fullName]}
              />
              <ReferenceLine y={10} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1.5} />
              <Bar dataKey="asi" radius={[4, 4, 0, 0]}>
                {asiData.map((entry, i) => (
                  <Cell key={i} fill={entry.alert ? '#ef4444' : '#22c55e'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>línea roja = 10% (umbral de alerta)</div>
        </div>
      )}
    </div>
  );
}
