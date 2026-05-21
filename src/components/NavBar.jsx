import { Activity, BarChart2, Zap, Heart, Eye, Timer, Shuffle, ClipboardList, Dumbbell } from 'lucide-react';
import { cn } from '../utils/cn';

const tabs = [
  { id: 'dashboard',    label: 'Dashboard', Icon: Activity      },
  { id: 'acwr',         label: 'Carga',     Icon: BarChart2     },
  { id: 'carga',        label: 'Sesión',    Icon: Dumbbell      },
  { id: 'bosco',        label: 'Bosco',     Icon: Zap           },
  { id: 'velocidad',    label: 'Sprint',    Icon: Timer         },
  { id: 'agilidad',     label: 'COD',       Icon: Shuffle       },
  { id: 'evaluaciones', label: 'Eval.',     Icon: ClipboardList },
  { id: 'wellness',     label: 'Wellness',  Icon: Heart         },
  { id: 'vbt',          label: 'VBT',       Icon: Eye           },
];

export default function NavBar({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/5 flex items-center h-16 z-50 overflow-x-auto scrollbar-none md:static md:flex-col md:h-full md:w-20 md:border-t-0 md:border-r md:justify-start md:pt-8 md:gap-1 md:overflow-x-visible">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-colors',
            active === id
              ? 'text-accent'
              : 'text-slate-500 hover:text-slate-300'
          )}
        >
          <Icon size={20} strokeWidth={1.5} />
          <span className="hidden md:block">{label}</span>
          <span className="md:hidden">{label}</span>
        </button>
      ))}
    </nav>
  );
}
