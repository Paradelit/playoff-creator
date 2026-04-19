import React from 'react';

export default function ExerciseSection({
  id,
  icon: Icon,
  iconColor = 'text-slate-600',
  title,
  subtitle,
  count,
  action,
  variant = 'grid',
  gridCols = 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
  emptyHidden = true,
  isEmpty,
  children,
}) {
  if (emptyHidden && isEmpty) return null;

  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-end justify-between mb-3 px-1">
        <div className="min-w-0 flex items-center gap-2">
          {Icon && <Icon size={20} className={`${iconColor} shrink-0`} />}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">
              {title}
              {typeof count === 'number' && count > 0 && (
                <span className="ml-2 text-xs font-semibold text-slate-400">{count}</span>
              )}
            </h2>
            {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {variant === 'carousel' ? (
        <div className="-mx-6 sm:-mx-12 px-6 sm:px-12 overflow-x-auto no-scrollbar snap-x snap-mandatory">
          <div className="flex gap-3 pb-2">{children}</div>
        </div>
      ) : (
        <div className={`grid gap-4 ${gridCols}`}>{children}</div>
      )}
    </section>
  );
}
