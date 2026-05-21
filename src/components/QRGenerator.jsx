import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { QrCode, Printer } from 'lucide-react';

const HOOPER_URL = `${window.location.origin}/hooper/team_001`;
const RPE_URL    = `${window.location.origin}/rpe/team_001`;

const FORMS = [
  {
    id:       'hooper',
    title:    'Wellness diario',
    subtitle: 'Escaneá antes de cada sesión',
    url:      HOOPER_URL,
  },
  {
    id:       'rpe',
    title:    'RPE de sesión',
    subtitle: 'Escaneá al terminar el entrenamiento',
    url:      RPE_URL,
  },
];

// Fallback de clipboard para iOS Safari
function copyToClipboard(text, onSuccess) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => fallbackCopy(text, onSuccess));
    return;
  }
  fallbackCopy(text, onSuccess);
}

function fallbackCopy(text, onSuccess) {
  const el = document.createElement('input');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
  document.body.appendChild(el);
  el.focus();
  el.select();
  el.setSelectionRange(0, el.value.length);
  const ok = document.execCommand('copy');
  document.body.removeChild(el);
  if (ok) onSuccess();
  else alert(`Copiá este link:\n\n${text}`);
}

// Abre una ventana limpia con los dos QRs para imprimir
function handlePrint() {
  const cards = FORMS.map(f => {
    // Extraer el SVG renderizado por qrcode.react directamente del DOM
    const container = document.getElementById(`qr-svg-${f.id}`);
    const svgHTML   = container ? container.innerHTML : '';
    return `
      <div class="card">
        <h2>${f.title}</h2>
        <p class="sub">${f.subtitle}</p>
        <div class="qr-wrap">${svgHTML}</div>
        <p class="url">${f.url}</p>
      </div>`;
  }).join('');

  const win = window.open('', '_blank', 'width=700,height=520');
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>FieldLab — Códigos QR</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    background: #fff;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 3.5rem;
    padding: 2.5rem;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    max-width: 220px;
  }
  h2  { font-size: 15px; font-weight: 700; color: #0f172a; text-align: center; }
  .sub { font-size: 11px; color: #64748b; text-align: center; line-height: 1.4; }
  .qr-wrap {
    background: #fff;
    padding: 12px;
    border-radius: 12px;
    border: 1.5px solid #e2e8f0;
    line-height: 0;
  }
  .url {
    font-size: 9px;
    color: #94a3b8;
    word-break: break-all;
    text-align: center;
    line-height: 1.5;
  }
  @media print {
    body { padding: 1.5rem; gap: 4rem; }
  }
</style>
</head>
<body>${cards}</body>
</html>`);

  win.document.close();
  win.focus();
  // Pequeño delay para que el DOM termine de renderizar antes de imprimir
  setTimeout(() => win.print(), 350);
}

// ── Tarjeta individual con QR + botón copiar ─────────────────────────────────

function QRCard({ id, title, subtitle, url }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    copyToClipboard(url, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
      {/* Título */}
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-200">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5 leading-tight">{subtitle}</p>
      </div>

      {/* QR en fondo blanco — fondo blanco es requerido para que los escáneres lo lean */}
      <div id={`qr-svg-${id}`} className="rounded-2xl p-3 bg-white shadow-lg">
        <QRCodeSVG
          value={url}
          size={148}
          bgColor="#ffffff"
          fgColor="#0f172a"
          level="M"
          includeMargin={false}
        />
      </div>

      {/* URL legible */}
      <p className="text-[10px] font-data text-slate-500 break-all text-center leading-relaxed px-1">
        {url}
      </p>

      {/* Botón copiar */}
      <button
        onClick={handleCopy}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl
          text-xs font-semibold border transition-all active:scale-95"
        style={{
          background:  copied ? 'rgba(34,197,94,0.12)' : 'rgba(56,189,248,0.08)',
          borderColor: copied ? 'rgba(34,197,94,0.4)'  : 'rgba(56,189,248,0.3)',
          color:       copied ? '#22c55e'               : '#38bdf8',
        }}
      >
        {copied ? '¡Copiado!' : 'Copiar link'}
      </button>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function QRGenerator() {
  return (
    <div className="bg-surface rounded-fieldlab p-4 border border-white/5
      shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)]">

      {/* Header con botón imprimir */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <QrCode size={16} strokeWidth={1.5} className="text-accent" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Códigos QR del equipo
          </h3>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
            font-semibold border border-white/10 text-slate-400
            hover:text-slate-200 hover:border-white/20 transition-all active:scale-95"
        >
          <Printer size={12} strokeWidth={1.5} />
          Imprimir
        </button>
      </div>

      {/* Dos QRs lado a lado */}
      <div className="flex gap-4">
        {FORMS.map(f => (
          <QRCard key={f.id} {...f} />
        ))}
      </div>
    </div>
  );
}
