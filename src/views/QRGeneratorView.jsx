import { useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { X, Download } from 'lucide-react';
import { PLAYERS } from '../data/players';
import Card from '../components/Card';

function wellnessUrl(playerId) {
  return `${window.location.origin}/wellness?player=${playerId}`;
}

function downloadQR(player) {
  const canvas = document.getElementById('qr-dl-canvas');
  if (!canvas) return;
  const link      = document.createElement('a');
  link.download   = `wellness-qr-${player.name.replace(/\s+/g, '-').toLowerCase()}.png`;
  link.href       = canvas.toDataURL('image/png');
  link.click();
}

export default function QRGeneratorView() {
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-100">QR por jugador</h2>
        <p className="text-sm text-slate-400">
          Generá el código personal de wellness de cada atleta
        </p>
      </div>

      <div className="space-y-2">
        {PLAYERS.map(player => (
          <button
            key={player.id}
            onClick={() => setSelected(player)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl
              bg-surface border border-white/5 hover:border-accent/30 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-semibold text-slate-200">{player.name}</p>
              <p className="text-xs text-slate-500">{player.position} · {player.sport}</p>
            </div>
            <span className="text-xs text-accent font-semibold">Generar QR →</span>
          </button>
        ))}
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
        >
          <div className="bg-surface rounded-2xl p-6 w-full max-w-sm border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100">{selected.name}</h3>
                <p className="text-xs text-slate-500">{selected.position} · {selected.sport}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* QR visible */}
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-white rounded-2xl shadow-lg">
                <QRCodeSVG
                  value={wellnessUrl(selected.id)}
                  size={208}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Hidden canvas for PNG export */}
            <div className="hidden">
              <QRCodeCanvas
                id="qr-dl-canvas"
                value={wellnessUrl(selected.id)}
                size={512}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="M"
                includeMargin
              />
            </div>

            {/* URL */}
            <p className="text-[10px] font-mono text-slate-500 text-center break-all mb-4 leading-relaxed px-1">
              {wellnessUrl(selected.id)}
            </p>

            {/* Download */}
            <button
              onClick={() => downloadQR(selected)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#3b82f6', color: '#fff' }}
            >
              <Download size={14} />
              Descargar PNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
