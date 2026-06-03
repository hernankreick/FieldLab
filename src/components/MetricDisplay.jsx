import { cn } from '../utils/cn';

const statusColor = {
  safe:    'text-success',
  warning: 'text-warning',
  danger:  'text-danger',
  neutral: 'text-accent',
};

export default function MetricDisplay({ value, unit, label, status = 'neutral', className, size = 'text-3xl' }) {
  return (
    <div className={cn('flex flex-col gap-0.5 min-w-0', className)}>
      <div className="flex items-baseline gap-1 min-w-0">
        <span className={cn('font-data font-bold truncate', size, statusColor[status])}>
          {value ?? '—'}
        </span>
        {unit && <span className="text-xs text-slate-500 font-data flex-shrink-0">{unit}</span>}
      </div>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </div>
  );
}
