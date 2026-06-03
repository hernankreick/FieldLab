import { jsPDF } from 'jspdf';

const DARK   = [15, 23, 42];
const PANEL  = [30, 41, 59];
const TEXT   = [248, 250, 252];
const MUTED  = [100, 116, 139];
const GREEN  = [34, 197, 94];
const YELLOW = [245, 158, 11];
const RED    = [239, 68, 68];
const ACCENT = [59, 130, 246];

function acwrColor(v) {
  if (v > 1.5) return RED;
  if (v > 1.3 || v < 0.8) return YELLOW;
  return GREEN;
}

function hooperColor(score) {
  if (score > 18) return RED;
  if (score > 12) return YELLOW;
  return GREEN;
}

function setFill(doc, rgb) { doc.setFillColor(...rgb); }
function setTxt(doc, rgb)  { doc.setTextColor(...rgb); }

export function generatePlayerReport(player, hooper, acwr, evaluaciones = []) {
  const doc  = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W    = 210;
  const date = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // ── Header ──────────────────────────────────────────────────────────────────
  setFill(doc, DARK);
  doc.rect(0, 0, W, 28, 'F');

  setTxt(doc, ACCENT);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('FIELDLAB · REPORTE DE JUGADOR', 14, 9);

  setTxt(doc, TEXT);
  doc.setFontSize(14);
  doc.text(player.name, 14, 18);

  setTxt(doc, MUTED);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`${player.position} · ${player.sport}`, 14, 24);
  doc.text(date, W - 14, 24, { align: 'right' });

  let y = 34;

  // ── Wellness / Hooper ────────────────────────────────────────────────────────
  if (hooper) {
    setFill(doc, PANEL);
    doc.roundedRect(14, y, W - 28, 30, 2, 2, 'F');

    setTxt(doc, MUTED);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('WELLNESS — HOOPER', 20, y + 6);

    const score = hooper.score ?? 0;
    const hCol  = hooperColor(score);
    setTxt(doc, hCol);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(score), 20, y + 18);

    setTxt(doc, MUTED);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Índice Hooper', 20, y + 24);

    const items = [
      { label: 'Sueño',  val: hooper.sleep    },
      { label: 'Estrés', val: hooper.stress   },
      { label: 'Fatiga', val: hooper.fatigue  },
      { label: 'Dolor',  val: hooper.soreness },
    ];
    items.forEach(({ label, val }, i) => {
      const cx = 70 + i * 32;
      setTxt(doc, MUTED);
      doc.setFontSize(6);
      doc.text(label, cx, y + 10);
      setTxt(doc, TEXT);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(val != null ? String(val) : '—', cx, y + 20);
      doc.setFont('helvetica', 'normal');
    });

    y += 36;
  }

  // ── ACWR ────────────────────────────────────────────────────────────────────
  if (acwr != null) {
    setFill(doc, PANEL);
    doc.roundedRect(14, y, W - 28, 22, 2, 2, 'F');

    setTxt(doc, MUTED);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('ACWR — CARGA AGUDA/CRÓNICA', 20, y + 6);

    const acwrVal = typeof acwr === 'object' ? (acwr.ratio ?? 0) : acwr;
    const aCol    = acwrColor(acwrVal);
    setTxt(doc, aCol);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(acwrVal.toFixed(2), 20, y + 17);

    const zone = acwrVal > 1.5 ? 'Peligro' : acwrVal > 1.3 ? 'Precaución' : acwrVal < 0.8 ? 'Subtrabajado' : 'Óptimo';
    setTxt(doc, MUTED);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(zone, 38, y + 17);

    // mini bar
    const barX = 70, barW = 110, barY = y + 12, barH = 4;
    const zones = [
      { from: 0,   to: 0.8, color: [51, 65, 85] },
      { from: 0.8, to: 1.3, color: GREEN         },
      { from: 1.3, to: 1.5, color: YELLOW        },
      { from: 1.5, to: 2.0, color: RED           },
    ];
    zones.forEach(({ from, to, color }) => {
      setFill(doc, color);
      doc.rect(barX + (from / 2) * barW, barY, ((to - from) / 2) * barW, barH, 'F');
    });
    const markerX = barX + Math.min(Math.max(acwrVal / 2, 0), 1) * barW;
    setFill(doc, aCol);
    doc.triangle(markerX, barY, markerX - 2, barY - 3, markerX + 2, barY - 3, 'F');

    y += 28;
  }

  // ── Evaluaciones ─────────────────────────────────────────────────────────────
  if (evaluaciones && evaluaciones.length > 0) {
    y += 3;
    setTxt(doc, MUTED);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text('EVALUACIONES', 14, y);
    y += 4;

    const cols = ['Fecha', 'Tipo', 'Detalle', 'Valor'];
    const colX = [14, 44, 84, 164];
    const rowH = 5;

    setFill(doc, PANEL);
    doc.rect(14, y, W - 28, rowH, 'F');
    setTxt(doc, MUTED);
    doc.setFontSize(6);
    cols.forEach((c, i) => doc.text(c, colX[i] + 2, y + 3.5));
    y += rowH;

    evaluaciones.slice(0, 20).forEach((ev, idx) => {
      if (idx % 2 === 0) {
        setFill(doc, [20, 30, 48]);
        doc.rect(14, y, W - 28, rowH, 'F');
      }
      setTxt(doc, TEXT);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      const evDate = ev.date ? new Date(ev.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
      const type   = ev.type ?? '—';
      const detail = ev.jumpType ?? ev.testType ?? ev.label ?? '—';
      const value  = ev.height != null ? `${ev.height} cm`
                   : ev.value  != null ? String(ev.value)
                   : '—';
      [evDate, type, detail, value].forEach((v, i) => doc.text(v, colX[i] + 2, y + 3.5));
      y += rowH;
    });

    y += 3;
  }

  // ── Footer (always at page bottom) ───────────────────────────────────────────
  setFill(doc, DARK);
  doc.rect(0, 287, W, 10, 'F');
  setTxt(doc, MUTED);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Generado por FieldLab AMS', 14, 293);
  doc.text(date, W - 14, 293, { align: 'right' });

  doc.save(`reporte-${player.name.replace(/\s+/g, '-').toLowerCase()}-${date.replace(/\//g, '-')}.pdf`);
}
