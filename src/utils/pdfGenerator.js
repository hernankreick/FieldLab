// Generación de PDFs en el cliente — jsPDF 4 + jspdf-autotable 5
// Fondo oscuro con paleta del design system de FieldLab.
// En iOS no se puede hacer descarga directa → se abre en nueva pestaña.

import { jsPDF }   from 'jspdf';
import autoTable   from 'jspdf-autotable';
import { getWellnessByPlayer, getPlayerRecentLoads, getPlayerEvals } from './storage';
import { PLAYERS }  from '../data/players';

// ── Constantes de diseño ─────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const M      = 14;          // margen izq/der
const CW     = PAGE_W - M * 2;  // ancho de contenido: 182 mm

const C = {
  bg:      [15,  23,  42],   // #0f172a
  surface: [30,  41,  59],   // #1e293b
  alt:     [21,  32,  52],   // fila alternada de tabla
  accent:  [56,  189, 248],  // #38bdf8
  green:   [34,  197, 94],   // #22c55e
  yellow:  [245, 158, 11],   // #f59e0b
  red:     [239, 68,  68],   // #ef4444
  text:    [226, 232, 240],  // #e2e8f0
  muted:   [100, 116, 139],  // #64748b
  border:  [51,  65,  85],   // #334155
};

// ── Helpers de dominio ───────────────────────────────────────────────────────

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

function statusColor(s) {
  if (s === 'safe')    return C.green;
  if (s === 'warning') return C.yellow;
  if (s === 'danger')  return C.red;
  return C.muted;
}

function acwrSt(v) {
  if (v > 1.5) return 'danger';
  if (v > 1.3 || v < 0.8) return 'warning';
  return 'safe';
}
function acwrZone(v) {
  if (v > 1.5) return 'Peligro';
  if (v > 1.3) return 'Precaución';
  if (v < 0.8) return 'Subentrenado';
  return 'Óptimo';
}

function hooperSt(score) {
  if (score > 18) return 'danger';
  if (score > 12) return 'warning';
  return 'safe';
}
function hooperZone(score) {
  if (score > 18) return 'Riesgo';
  if (score > 12) return 'Alerta';
  return 'Óptimo';
}

function isToday(ts) {
  return new Date(ts).toDateString() === new Date().toDateString();
}

function computeRisk(player, latestWellness) {
  const w = latestWellness && isToday(latestWellness.timestamp) ? latestWellness : null;
  const loadRisk =
    player.acwr > 1.5 || (player.lsi ?? 0) > 15 ? 'danger' :
    player.acwr > 1.3 || (player.lsi ?? 0) > 8  ? 'warning' : 'safe';
  const wellRisk = w ? hooperSt(w.score) : null;
  if (loadRisk === 'danger'  || wellRisk === 'danger')  return 'danger';
  if (loadRisk === 'warning' || wellRisk === 'warning') return 'warning';
  return 'safe';
}

function riskLabel(s) {
  if (s === 'danger')  return 'RIESGO';
  if (s === 'warning') return 'ALERTA';
  return 'APTO';
}

function fmtDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Mezcla un color de estado con el fondo oscuro (alpha 0–1)
function blend(color, alpha = 0.25) {
  return color.map((c, i) => Math.round(c * alpha + C.surface[i] * (1 - alpha)));
}

// ── Primitivos de dibujo ─────────────────────────────────────────────────────

function fillPage(doc) {
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
}

function addPage(doc) {
  doc.addPage();
  fillPage(doc);
  return M;
}

// Agrega página si no hay espacio suficiente
function checkBreak(doc, y, needed = 30) {
  if (y + needed > PAGE_H - 20) return addPage(doc);
  return y;
}

// Barra de encabezado — devuelve y de la primera línea de contenido
function drawHeader(doc, subtitle) {
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, PAGE_W, 1.5, 'F');
  doc.setFillColor(...C.surface);
  doc.rect(0, 1.5, PAGE_W, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.accent);
  doc.text('Field Lab', M, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(subtitle, PAGE_W - M, 9, { align: 'right' });
  doc.setFontSize(7);
  doc.text(
    new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }),
    PAGE_W - M, 13.5, { align: 'right' }
  );
  return 20;
}

// Footer en la página activa
function drawFooter(doc) {
  const fy = PAGE_H - 12;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.line(M, fy, PAGE_W - M, fy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text('Generado por Field Lab · fieldlab.app', M, fy + 5);
  doc.text(new Date().toLocaleDateString('es-AR'), PAGE_W - M, fy + 5, { align: 'right' });
}

// Barra de sección — devuelve y del contenido
function secBar(doc, title, y) {
  doc.setFillColor(...C.surface);
  doc.rect(M, y, CW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.accent);
  doc.text(title.toUpperCase(), M + 3, y + 5);
  return y + 10;
}

// Badge de color (APTO / ALERTA / RIESGO)
function drawBadge(doc, label, status, cx, cy) {
  const w = 26, h = 7;
  doc.setFillColor(...blend(statusColor(status), 0.22));
  doc.roundedRect(cx - w / 2, cy, w, h, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...statusColor(status));
  doc.text(label, cx, cy + h / 2 + 1.7, { align: 'center' });
}

// Tarjeta de métrica individual (label / valor / unidad)
function drawMetric(doc, label, value, unit, status, x, y, w = 40) {
  const h = 18;
  doc.setFillColor(...C.surface);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F');
  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.muted);
  doc.text(label, x + w / 2, y + 5.5, { align: 'center' });
  // Valor
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...statusColor(status));
  doc.text(String(value), x + w / 2, y + 12.5, { align: 'center' });
  // Unidad
  if (unit) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...C.muted);
    doc.text(unit, x + w / 2, y + 16.5, { align: 'center' });
  }
}

// Tabla con estilos del design system; devuelve y tras la tabla
function drawTable(doc, y, head, body, colStyles = {}, didParseCell = null) {
  autoTable(doc, {
    startY:  y,
    head:    [head],
    body,
    margin:  { left: M, right: M },
    theme:   'plain',
    styles:  {
      fillColor:   C.bg,
      textColor:   C.text,
      fontSize:    7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      lineColor:   C.border,
      lineWidth:   0.1,
    },
    headStyles: {
      fillColor: C.surface,
      textColor: C.muted,
      fontStyle: 'bold',
      fontSize:  7,
    },
    alternateRowStyles: { fillColor: C.alt },
    columnStyles: colStyles,
    ...(didParseCell ? { didParseCell } : {}),
  });
  return doc.lastAutoTable.finalY + 4;
}

// ── Bloques de contenido ─────────────────────────────────────────────────────

// Bloque superior: nombre, posición, badge, ACWR
function drawPlayerBlock(doc, player, displayAcwr, risk, y) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.text);
  doc.text(player.name, M, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(`${player.position} · ${player.sport}`, M, y + 17);

  // Badge derecha
  drawBadge(doc, riskLabel(risk), risk, PAGE_W - M - 13, y + 3);

  // ACWR
  const acCol = statusColor(acwrSt(displayAcwr));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...acCol);
  doc.text(`ACWR  ${displayAcwr.toFixed(2)}`, M, y + 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(acwrZone(displayAcwr), M + 33, y + 26);

  y += 31;
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.line(M, y, PAGE_W - M, y);
  return y + 5;
}

// Tabla de wellness (últimos 7 reportes)
function drawWellness(doc, history, y) {
  if (!history.length) return y;
  y = secBar(doc, 'Wellness — Última Semana', y);

  // Score promedio con semáforo
  const avg   = history.reduce((s, r) => s + r.score, 0) / history.length;
  const avgSt = hooperSt(Math.round(avg));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text('Score promedio:', M, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...statusColor(avgSt));
  doc.text(`${avg.toFixed(1)}  (${hooperZone(Math.round(avg))})`, M + 29, y);
  y += 5;

  return drawTable(
    doc, y,
    ['Fecha', 'Sueño', 'Estrés', 'Fatiga', 'Dolor', 'Score', 'Zona'],
    history.map(r => [
      fmtDate(r.timestamp), r.sleep, r.stress, r.fatigue, r.soreness, r.score,
      hooperZone(r.score),
    ]),
    { 0: { cellWidth: 22 }, 6: { fontStyle: 'bold' } },
    (data) => {
      if (data.row.section === 'body' && data.column.index === 6) {
        data.cell.styles.textColor = statusColor(hooperSt(Number(data.row.raw[5])));
        data.cell.styles.fontStyle = 'bold';
      }
    }
  );
}

// Sección de carga
function drawCarga(doc, displayAcwr, acute, chronic, playerLoads, y) {
  y = secBar(doc, 'Carga de Entrenamiento', y);
  const hasLoads = playerLoads.some(d => d.load > 0);
  const mW = (CW - 6) / 3;

  drawMetric(doc, 'ACWR',               displayAcwr.toFixed(2),             acwrZone(displayAcwr), acwrSt(displayAcwr), M,               y, mW);
  drawMetric(doc, 'Carga aguda (7d)',   hasLoads ? Math.round(acute) : '—', 'UA',                  'safe',              M + mW + 3,      y, mW);
  drawMetric(doc, 'Carga crónica (28d)',hasLoads ? Math.round(chronic) : '—','UA',                  'safe',              M + (mW+3)*2,    y, mW);
  y += 22;

  const last7 = playerLoads.slice(-7);
  if (last7.some(d => d.load > 0)) {
    return drawTable(doc, y,
      ['Fecha', 'Carga (UA)'],
      last7.map(s => [s.date, s.load > 0 ? Math.round(s.load) : '—']),
      { 0: { cellWidth: 40 } }
    );
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text('Sin sesiones registradas en los últimos 7 días', M, y + 5);
  return y + 10;
}

// Clasificadores de evaluaciones
const jumpSt     = h => h >= 40 ? 'safe' : h >= 30 ? 'warning' : 'danger';
const rsiSt      = r => r >= 2.0 ? 'safe' : r >= 1.5 ? 'warning' : 'danger';
const vo2St      = v => v >= 50 ? 'safe' : v >= 40 ? 'warning' : 'danger';
const sprint10St = t => t <= 1.75 ? 'safe' : t <= 1.90 ? 'warning' : 'danger';
const sprint30St = t => t <= 4.10 ? 'safe' : t <= 4.50 ? 'warning' : 'danger';
const lsiSt      = p => p < 8 ? 'safe' : p <= 15 ? 'warning' : 'danger';

// Sección de evaluaciones físicas
function drawEvals(doc, player, playerEvals, y) {
  y = secBar(doc, 'Evaluaciones Físicas', y);
  const ev = player.eval;

  // Determinar datos reales vs referencia
  const byType = {};
  for (const e of playerEvals) {
    if (e.type === 'jump' && !byType[e.jumpType]) byType[e.jumpType] = e;
  }
  const sj  = byType['SJ']  ? { height: byType['SJ'].height,  power: byType['SJ'].power  } : ev.sj;
  const cmj = byType['CMJ'] ? { height: byType['CMJ'].height, power: byType['CMJ'].power } : ev.cmj;
  const iue = (byType['SJ'] && byType['CMJ'])
    ? ((cmj.height - sj.height) / sj.height) * 100
    : ev.cmj.iue;

  // — Salto
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.text);
  doc.text('Salto', M, y); y += 3;

  const m4 = (CW - 9) / 4;
  drawMetric(doc, 'SJ Altura',    sj.height.toFixed(1),  'cm', jumpSt(sj.height),  M,             y, m4);
  drawMetric(doc, 'SJ Potencia',  Math.round(sj.power),  'W',  'safe',             M+(m4+3),      y, m4);
  drawMetric(doc, 'CMJ Altura',   cmj.height.toFixed(1), 'cm', jumpSt(cmj.height), M+(m4+3)*2,    y, m4);
  drawMetric(doc, 'CMJ Potencia', Math.round(cmj.power), 'W',  'safe',             M+(m4+3)*3,    y, m4);
  y += 21;

  const m2 = (CW - 3) / 2;
  drawMetric(doc, 'IUE (Contramov.)', iue.toFixed(1),       '%', iue>=10&&iue<=15?'safe':'warning', M,      y, m2);
  drawMetric(doc, 'Drop Jump RSI',    ev.dj.rsi.toFixed(2), '',  rsiSt(ev.dj.rsi),                  M+m2+3, y, m2);
  y += 21;

  // — Velocidad
  y = checkBreak(doc, y, 28);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.text);
  doc.text('Velocidad', M, y); y += 3;

  const m3 = (CW - 6) / 3;
  drawMetric(doc, 'Sprint 10m', ev.sprint10.time.toFixed(2), 's',   sprint10St(ev.sprint10.time), M,          y, m3);
  drawMetric(doc, 'Sprint 30m', ev.sprint30.time.toFixed(2), 's',   sprint30St(ev.sprint30.time), M+m3+3,     y, m3);
  drawMetric(doc, 'Top Speed',  ev.topSpeed.toFixed(1),      'm/s', 'safe',                       M+(m3+3)*2, y, m3);
  y += 21;

  // — Resistencia & LSI
  y = checkBreak(doc, y, 28);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C.text);
  doc.text('Resistencia & LSI', M, y); y += 3;

  drawMetric(doc, 'Test',      ev.resistance.test,              '',          'safe',                     M,          y, m4);
  drawMetric(doc, 'VO₂ máx',  ev.resistance.vo2max.toFixed(1), 'ml/kg/min', vo2St(ev.resistance.vo2max), M+(m4+3),  y, m4);
  drawMetric(doc, 'VAM',       ev.resistance.vam.toFixed(1),   'km/h',      'safe',                     M+(m4+3)*2, y, m4);
  drawMetric(doc, 'LSI Asim.', ev.lsiPct.toFixed(1)+'%',       '',          lsiSt(ev.lsiPct),            M+(m4+3)*3, y, m4);
  y += 21;

  return y;
}

// ── Exportaciones públicas ───────────────────────────────────────────────────

/**
 * Genera y descarga el informe individual de un jugador.
 * Lee datos directamente de localStorage para ser auto-contenido.
 * @param {object} player — objeto de PLAYERS (debe tener .eval)
 */
export async function generatePlayerReport(player) {
  const wellnessHistory = getWellnessByPlayer(player.id).slice(0, 7);
  const playerLoads     = getPlayerRecentLoads(player.id, 28);
  const playerEvals     = getPlayerEvals(player.id);
  const latestWellness  = wellnessHistory[0] ?? null;

  const acute       = playerLoads.slice(-7).reduce((s, d) => s + d.load, 0) / 7;
  const chronic     = playerLoads.reduce((s, d) => s + d.load, 0) / 28;
  const hasLoads    = playerLoads.some(d => d.load > 0);
  const displayAcwr = hasLoads && chronic > 0 ? acute / chronic : player.acwr;
  const risk        = computeRisk(player, latestWellness);

  const doc = new jsPDF('p', 'mm', 'a4');
  fillPage(doc);

  let y = drawHeader(doc, 'Informe Individual');
  y = drawPlayerBlock(doc, player, displayAcwr, risk, y);

  if (wellnessHistory.length) {
    y = checkBreak(doc, y, 55);
    y = drawWellness(doc, wellnessHistory, y);
  }

  y = checkBreak(doc, y, 50);
  y = drawCarga(doc, displayAcwr, acute, chronic, playerLoads, y);

  if (player.eval) {
    y = checkBreak(doc, y, 65);
    drawEvals(doc, player, playerEvals, y);
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) { doc.setPage(i); drawFooter(doc); }

  const date     = new Date().toISOString().split('T')[0];
  const filename = `fieldlab_${player.name.replace(/\s+/g, '_')}_${date}.pdf`;
  isIOS() ? window.open(doc.output('bloburl'), '_blank') : doc.save(filename);
}

/**
 * Genera y descarga el informe semanal del plantel.
 * @param {Array} athletes — atletas de Dashboard: [{id, name, acwr, lsi, w}]
 */
export async function generateTeamReport(athletes) {
  // Enriquecer con posición y deporte desde PLAYERS
  const enriched = athletes.map(a => {
    const full = PLAYERS.find(p => p.id === a.id) ?? {};
    return { ...full, ...a };
  });

  const doc = new jsPDF('p', 'mm', 'a4');
  fillPage(doc);

  // ── Página 1: KPIs + tabla estado ───────────────────────────────────────
  let y = drawHeader(doc, 'Informe Semanal del Plantel');

  const todayAthletes = enriched.filter(a => a.w && isToday(a.w.timestamp));
  const enRiesgo = enriched.filter(a => {
    const w = a.w && isToday(a.w.timestamp) ? a.w : null;
    return computeRisk(a, w) === 'danger';
  }).length;
  const acwrProm = enriched.reduce((s, a) => s + (a.acwr ?? 0), 0) / enriched.length;

  // KPI strip
  y = secBar(doc, 'Resumen del Plantel', y);
  const kpiW = CW / 4;
  const kpis = [
    { label: 'Atletas',    value: enriched.length,      color: C.accent                                          },
    { label: 'En riesgo',  value: enRiesgo,              color: enRiesgo > 0 ? C.red : C.green                   },
    { label: 'Reportaron', value: todayAthletes.length,  color: todayAthletes.length===enriched.length ? C.green : C.yellow },
    { label: 'ACWR prom.', value: acwrProm.toFixed(2),  color: statusColor(acwrSt(acwrProm))                     },
  ];
  kpis.forEach(({ label, value, color }, i) => {
    const kx = M + i * kpiW;
    doc.setFillColor(...C.surface);
    doc.roundedRect(kx, y, kpiW - 2, 18, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');   doc.setFontSize(16); doc.setTextColor(...color);
    doc.text(String(value), kx + (kpiW-2)/2, y + 11, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.muted);
    doc.text(label, kx + (kpiW-2)/2, y + 16.5, { align: 'center' });
  });
  y += 22;

  // Tabla estado (ordenada por riesgo)
  y = secBar(doc, 'Estado del Plantel', y);
  const riskOrder = { danger: 0, warning: 1, safe: 2 };
  const sorted = [...enriched].sort((a, b) => {
    const wa = a.w && isToday(a.w.timestamp) ? a.w : null;
    const wb = b.w && isToday(b.w.timestamp) ? b.w : null;
    return (riskOrder[computeRisk(a, wa)] ?? 2) - (riskOrder[computeRisk(b, wb)] ?? 2);
  });

  y = drawTable(
    doc, y,
    ['Jugador', 'Posición', 'ACWR', 'Zona ACWR', 'Hooper', 'Estado'],
    sorted.map(a => {
      const todayW = a.w && isToday(a.w.timestamp) ? a.w : null;
      return [
        a.name, a.position ?? '—', a.acwr.toFixed(2),
        acwrZone(a.acwr), todayW ? todayW.score : '—',
        riskLabel(computeRisk(a, todayW)),
      ];
    }),
    { 0: { cellWidth: 46 }, 1: { cellWidth: 28 } },
    (data) => {
      if (data.row.section !== 'body') return;
      if (data.column.index === 2 || data.column.index === 3) {
        data.cell.styles.textColor = statusColor(acwrSt(parseFloat(data.row.raw[2])));
        if (data.column.index === 2) data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.index === 5) {
        const raw = data.cell.raw;
        data.cell.styles.textColor = statusColor(raw==='RIESGO'?'danger':raw==='ALERTA'?'warning':'safe');
        data.cell.styles.fontStyle = 'bold';
      }
    }
  );

  // ── Detalle compacto (misma página, sin salto) ──────────────────────────
  y = checkBreak(doc, y, 20);
  y = secBar(doc, 'Detalle por Jugador', y);

  const detRowH = 5;
  sorted.forEach((a, idx) => {
    y = checkBreak(doc, y, detRowH + 2);

    const todayW = a.w && isToday(a.w.timestamp) ? a.w : null;
    const risk   = computeRisk(a, todayW);
    const rCol   = statusColor(risk);

    if (idx % 2 === 0) {
      doc.setFillColor(...C.alt);
      doc.rect(M, y, CW, detRowH, 'F');
    }

    // dot
    doc.setFillColor(...rCol);
    doc.circle(M + 3, y + detRowH / 2, 1.5, 'F');

    // nombre
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.text);
    doc.text(a.name, M + 8, y + detRowH / 2 + 1.2);

    // posición
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(a.position ?? '—', M + 60, y + detRowH / 2 + 1.2);

    // ACWR coloreado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...statusColor(acwrSt(a.acwr)));
    doc.text(`ACWR ${a.acwr.toFixed(2)}`, M + 92, y + detRowH / 2 + 1.2);

    // zona
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(acwrZone(a.acwr), M + 122, y + detRowH / 2 + 1.2);

    // estado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...rCol);
    doc.text(riskLabel(risk), M + 158, y + detRowH / 2 + 1.2);

    y += detRowH;
  });

  y += 4;

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) { doc.setPage(i); drawFooter(doc); }

  const date     = new Date().toISOString().split('T')[0];
  const filename = `fieldlab_plantel_${date}.pdf`;
  isIOS() ? window.open(doc.output('bloburl'), '_blank') : doc.save(filename);
}
