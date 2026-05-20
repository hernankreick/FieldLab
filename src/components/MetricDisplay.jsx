import { cn } from '../utils/cn';

const statusColor = {
  safe:    'text-success',
  warning: 'text-warning',
  danger:  'text-danger',
  neutral: 'text-accent',
};

export default function MetricDisplay({ value, unit, label, status = 'neutral', className }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex items-baseline gap-1">
        <span className={cn('font-data text-3xl font-bold', statusColor[status])}>
          {value ?? '—'}
        </span>
        {unit && <span className="text-xs text-slate-500 font-data">{unit}</span>}
      </div>
      {label && <span className="text-xs text-slate-400">{label}</span>}
    </div>
  );
}
