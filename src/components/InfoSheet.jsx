import { X } from 'lucide-react';

export default function InfoSheet({ isOpen, onClose, title, content }) {
  if (!content) return null;
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div
        className={`fixed bottom-0 left-0 right-0 w-full bg-slate-900 border-t border-slate-700 rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto z-50 transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-bold text-slate-100 pr-4">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 flex-shrink-0 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Qué mide</p>
          <p className="text-sm text-slate-300">{content.description}</p>
        </div>

        {content.steps?.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cómo ejecutarlo</p>
            <ol className="space-y-1.5">
              {content.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-300">
                  <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {content.reference && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Referencia semáforo</p>
            <p className="text-xs text-slate-400">{content.reference}</p>
          </div>
        )}
      </div>
    </>
  );
}
