import React, { useState } from 'react';
import { Bell, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useProactiveNotifications } from '../hooks/useProactiveNotifications';

/**
 * Shows a collapsible banner with AI-generated daily briefing notifications.
 * Appears at the top of every authenticated screen when there are unread items.
 *
 * Design goals:
 *   - Unobtrusive: collapsed by default after first render
 *   - Clear origin: labelled as IA suggestion
 *   - Easy to dismiss: per-notification X and global "dismiss all"
 */
export default function ProactiveNotificationsBanner() {
  const { notifications, markAsRead, dismissAll } = useProactiveNotifications();
  const [expanded, setExpanded] = useState(true);

  if (notifications.length === 0) return null;

  const typeLabel = (type) => (type === 'match-reminder' ? '⚽ Partido' : '🏀 Entrenamiento');

  const typeColor = (type) =>
    type === 'match-reminder'
      ? 'bg-blue-50 border-blue-200 text-blue-900'
      : 'bg-amber-50 border-amber-200 text-amber-900';

  const badgeColor = (type) =>
    type === 'match-reminder' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';

  return (
    <div className="mx-3 mt-3 mb-1 rounded-xl border border-purple-200 bg-purple-50 shadow-sm overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-purple-100 transition-colors"
        aria-expanded={expanded}
      >
        <Sparkles size={15} className="text-purple-500 shrink-0" />
        <Bell size={14} className="text-purple-500 shrink-0" />
        <span className="text-sm font-semibold text-purple-800 flex-1">
          {notifications.length === 1 ? 'Aviso de hoy' : `${notifications.length} avisos de hoy`}
        </span>
        <span className="text-xs text-purple-500 mr-1">IA</span>
        {expanded ? (
          <ChevronUp size={15} className="text-purple-400 shrink-0" />
        ) : (
          <ChevronDown size={15} className="text-purple-400 shrink-0" />
        )}
      </button>

      {/* Notification cards */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${typeColor(n.type)}`}
            >
              <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${badgeColor(n.type)}`}>
                {typeLabel(n.type)}
              </span>
              <p className="flex-1 leading-snug">{n.message}</p>
              <button
                onClick={() => markAsRead(n.id)}
                className="shrink-0 ml-1 p-0.5 rounded hover:bg-black/10 transition-colors"
                aria-label="Descartar aviso"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {notifications.length > 1 && (
            <button
              onClick={dismissAll}
              className="text-xs text-purple-600 hover:text-purple-800 underline underline-offset-2 pl-1 transition-colors"
            >
              Descartar todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
