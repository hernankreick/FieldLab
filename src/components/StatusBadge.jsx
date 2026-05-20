import { cn } from '../utils/cn';

const config = {
  safe:    { label: 'Óptimo',   classes: 'bg-success/20 text-success border-success/30' },
  warning: { label: 'Alerta',   classes: 'bg-warning/20 text-warning border-warning/30' },
  danger:  { label: 'Riesgo',   classes: 'bg-danger/20  text-danger  border-danger/30'  },
};

export default function StatusBadge({ status, label, className }) {
  const { label: defaultLabel, classes } = config[status] ?? config.safe;
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
      classes,
      className
    )}>
      {label ?? defaultLabel}
    </span>
  );
}
