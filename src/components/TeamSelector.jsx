import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Users, Check } from 'lucide-react';
import { useTeam } from '../context/TeamContext';

const PRESET_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
const SPORTS       = ['football', 'rugby', 'hockey'];
const CATEGORIES   = ['senior', 'sub20', 'sub18', 'sub16'];
const SPORT_LABEL  = { football: 'Fútbol', rugby: 'Rugby', hockey: 'Hockey' };
const CAT_LABEL    = { senior: 'Senior', sub20: 'Sub 20', sub18: 'Sub 18', sub16: 'Sub 16' };

function Dot({ color, size = 10 }) {
  return (
    <span
      className="rounded-full flex-shrink-0 inline-block"
      style={{ width: size, height: size, background: color }}
    />
  );
}

export default function TeamSelector() {
  const { teams, activeTeam, activeTeamId, switchTeam, addTeam } = useTeam();
  const [open,      setOpen]      = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newSport,  setNewSport]  = useState('football');
  const [newCat,    setNewCat]    = useState('senior');
  const [newColor,  setNewColor]  = useState(PRESET_COLORS[2]);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleAdd() {
    if (!newName.trim()) return;
    const id = `team_${Date.now()}`;
    addTeam({ id, name: newName.trim(), sport: newSport, category: newCat, sex: 'male', color: newColor });
    setNewName(''); setNewSport('football'); setNewCat('senior'); setNewColor(PRESET_COLORS[2]);
    setShowModal(false);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-white/10
          hover:border-white/20 transition-colors text-sm"
      >
        <Dot color={activeTeam.color} />
        <span className="font-semibold text-slate-200 max-w-[140px] truncate">{activeTeam.name}</span>
        <ChevronDown size={13} className="text-slate-500" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl bg-slate-800 border border-white/10
          shadow-2xl z-50 overflow-hidden">
          <div className="p-1">
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => { switchTeam(t.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-700 transition-colors text-left"
              >
                <Dot color={t.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-200 truncate">{t.name}</p>
                  <p className="text-[10px] text-slate-500">{SPORT_LABEL[t.sport] ?? t.sport} · {CAT_LABEL[t.category] ?? t.category}</p>
                </div>
                {t.id === activeTeamId && <Check size={14} className="text-accent flex-shrink-0" />}
              </button>
            ))}
          </div>

          <div className="border-t border-white/5 p-1">
            <button
              onClick={() => { setShowModal(true); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-700
                transition-colors text-sm text-slate-400 hover:text-slate-200"
            >
              <Users size={14} />
              Nuevo equipo
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm border border-white/10 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-100">Nuevo equipo</h3>

            <div>
              <label className="text-xs text-slate-400 mb-1 block">Nombre</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ej: Reserva"
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm
                  text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Deporte</label>
                <select
                  value={newSport}
                  onChange={e => setNewSport(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm
                    text-slate-100 focus:outline-none focus:border-accent"
                >
                  {SPORTS.map(s => <option key={s} value={s}>{SPORT_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Categoría</label>
                <select
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm
                    text-slate-100 focus:outline-none focus:border-accent"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-2 block">Color</label>
              <div className="flex gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                    style={{
                      background: c,
                      outline: newColor === c ? `2px solid ${c}` : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-400
                  bg-slate-700 hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ background: newColor }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
