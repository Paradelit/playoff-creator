import React from 'react';
import { Calendar, Clock } from 'lucide-react';

export default function SessionPreviewBlock({ session }: { session: Record<string, unknown> }) {
  const title = (session.title as string) || (session.tipo as string) || 'Sesión';
  const date = session.date as string | undefined;
  const start = session.startTime as string | undefined;
  const end = session.endTime as string | undefined;
  const location = session.location as string | undefined;
  const teamName = session.teamName as string | undefined;

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white overflow-hidden">
      <div className="px-3 py-2 bg-indigo-100/60 border-b border-indigo-200 flex items-center gap-2">
        <Calendar size={14} className="text-indigo-600" />
        <p className="text-sm font-semibold text-indigo-900 truncate flex-1">{title}</p>
      </div>
      <div className="px-3 py-2 space-y-1 text-xs text-slate-700">
        {date && <p><span className="font-semibold">Fecha:</span> {date}</p>}
        {(start || end) && (
          <p className="flex items-center gap-1">
            <Clock size={10} className="text-indigo-500" />
            {start}{end ? ` – ${end}` : ''}
          </p>
        )}
        {teamName && <p><span className="font-semibold">Equipo:</span> {teamName}</p>}
        {location && <p><span className="font-semibold">Lugar:</span> {location}</p>}
      </div>
    </div>
  );
}
