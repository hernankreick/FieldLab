import { useState } from 'react';
import { Copy, ExternalLink, QrCode } from 'lucide-react';

export default function QRGenerator({ teamId, teamName }) {
  const url = `${window.location.origin}/hooper/${teamId}`;
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-surface rounded-fieldlab p-4 border border-white/5
      shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)]">
      <div className="flex items-center gap-2 mb-3">
        <QrCode size={16} strokeWidth={1.5} className="text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Formulario Wellness{teamName ? ` · ${teamName}` : ''}
        </h3>
      </div>

      {/* URL del formulario */}
      <div
        className="rounded-xl px-3 py-2.5 mb-3 text-xs text-slate-400 break-all font-data"
        style={{ background: 'rgba(0,0,0,0.35)' }}
      >
        {url}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
            text-xs font-semibold border transition-all active:scale-95"
          style={{
            background:   copied ? 'rgba(34,197,94,0.12)'  : 'rgba(56,189,248,0.08)',
            borderColor:  copied ? 'rgba(34,197,94,0.4)'   : 'rgba(56,189,248,0.3)',
            color:        copied ? '#22c55e'                : '#38bdf8',
          }}
        >
          <Copy size={12} strokeWidth={1.5} />
          {copied ? '¡Copiado!' : 'Copiar link'}
        </button>
        <button
          onClick={() => window.open(url, '_blank')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
            text-xs font-semibold border border-white/10 text-slate-400
            hover:text-slate-200 transition-all active:scale-95"
          style={{ background: '#1e293b' }}
        >
          <ExternalLink size={12} strokeWidth={1.5} />
          Ver formulario
        </button>
      </div>

      <p className="text-xs text-slate-600 mt-3 text-center leading-relaxed">
        Los jugadores escanean este QR para reportar su wellness diario
      </p>
    </div>
  );
}
