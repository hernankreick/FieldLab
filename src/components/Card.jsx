import { cn } from '../utils/cn';

export default function Card({ children, className, title, icon: Icon, action }) {
  return (
    <div className={cn(
      'bg-surface rounded-fieldlab p-6 border border-white/5 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] overflow-hidden',
      className
    )}>
      {(title || Icon || action) && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && <Icon size={16} strokeWidth={1.5} className="text-accent" />}
          {title && <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex-1">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
