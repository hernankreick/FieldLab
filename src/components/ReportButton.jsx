// Botón reutilizable que dispara la generación de un PDF.
// type='player' → informe individual | type='team' → informe semanal del plantel
// variant='button' → botón completo | variant='icon' → ícono compacto
// En iOS abre el PDF en nueva pestaña (descarga directa no soportada).

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { generatePlayerReport, generateTeamReport } from '../utils/pdfGenerator';

export default function ReportButton({
  type    = 'player',
  player  = null,
  players = [],
  label   = 'Generar PDF',
  variant = 'button',
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      if (type === 'player' && player) {
        await generatePlayerReport(player);
      } else if (type === 'team') {
        await generateTeamReport(players);
      }
    } catch (err) {
      console.error('[ReportButton] Error al generar PDF:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Variante ícono (compacto, para headers de perfil) ────────────────────
  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        title={loading ? 'Generando PDF…' : 'Descargar informe PDF'}
        className="w-8 h-8 flex items-center justify-center rounded-lg
          border border-white/10 text-slate-400
          hover:text-accent hover:border-accent/40
          active:scale-90 transition-all
          disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading
          ? <Loader2 size={14} className="animate-spin" />
          : <FileDown size={14} />
        }
      </button>
    );
  }

  // ── Variante botón completo ───────────────────────────────────────────────
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl
        text-sm font-semibold transition-all active:scale-95
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
      style={{
        background: 'rgba(56,189,248,0.10)',
        color:      '#38bdf8',
        border:     '1px solid rgba(56,189,248,0.30)',
      }}
    >
      {loading
        ? <><Loader2 size={14} className="animate-spin flex-shrink-0" /> Generando PDF…</>
        : <><FileDown size={14} className="flex-shrink-0" /> {label}</>
      }
    </button>
  );
}
