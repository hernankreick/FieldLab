import { cn } from '../utils/cn';
import StatusBadge from './StatusBadge';

const valueColor = {
  safe:    'text-success',
  warning: 'text-warning',
  danger:  'text-danger',
  neutral: 'text-accent',
};

export default function ResultCard({ label, value, unit, status = 'neutral', sub, className, size = 'text-2xl' }) {
  return (
    <div className={cn('bg-background rounded-xl p-4 border border-white/5 min-w-0 overflow-hidden', className)}>
      <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold truncate">{label}</p>
      <div className="flex items-baseline gap-1 mb-2 min-w-0">
        <span className={cn('font-data font-bold truncate', size, valueColor[status])}>{value}</span>
        {unit && <span className="text-xs text-slate-500 font-data flex-shrink-0">{unit}</span>}
      </div>
      <StatusBadge status={status} />
      {sub && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{sub}</p>}
    </div>
  );
}
