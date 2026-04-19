import React, { useState } from 'react';
import { Clock } from 'lucide-react';

function formatRelativeDays(ms, now) {
  if (!ms) return null;
  const diffDays = Math.floor((now - ms) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'hoy';
  if (diffDays === 1) return 'ayer';
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7);
    return `hace ${w} sem.`;
  }
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `hace ${months} mes${months > 1 ? 'es' : ''}`;
  const years = Math.floor(months / 12);
  return `hace ${years} año${years > 1 ? 's' : ''}`;
}

function formatCount(count) {
  if (!count || count <= 0) return null;
  if (count === 1) return 'Usado 1 vez';
  return `Usado ${count} veces`;
}

export default function UsageBadge({ count, lastUsedMs, now, variant = 'subtle' }) {
  const [mountedAt] = useState(() => Date.now());
  const countLabel = formatCount(count);
  const timeLabel = formatRelativeDays(lastUsedMs, now ?? mountedAt);
  if (!countLabel && !timeLabel) return null;

  const toneCls = variant === 'solid' ? 'bg-slate-900/75 text-white' : 'bg-slate-100 text-slate-600';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${toneCls}`}>
      <Clock size={10} />
      {countLabel && <span>{countLabel}</span>}
      {countLabel && timeLabel && <span aria-hidden="true">·</span>}
      {timeLabel && <span>{timeLabel}</span>}
    </span>
  );
}
