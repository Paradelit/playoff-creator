import { useEffect, useRef } from 'react';
import { useProfile } from './useProfile';

/**
 * In-app reminders for upcoming sessions.
 * Shows browser Notification if permission granted and reminders enabled in profile.
 * @param {Array} sessions - all calendar sessions (with fecha, horaInicio, teamName, tipo, rival)
 */
export function useReminders(sessions) {
  const { profile } = useProfile();
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!profile.notifEnabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const antelacionMs = (profile.notifAntelacion || 30) * 60 * 1000;

    function checkReminders() {
      const now = new Date();
      for (const s of sessions) {
        if (!s.fecha || !s.horaInicio) continue;
        if (notifiedRef.current.has(s.id)) continue;

        const [year, month, day] = s.fecha.split('-').map(Number);
        const [h, m] = s.horaInicio.split(':').map(Number);
        const sessionTime = new Date(year, month - 1, day, h, m, 0, 0);
        const diffMs = sessionTime - now;

        if (diffMs > 0 && diffMs <= antelacionMs) {
          notifiedRef.current.add(s.id);

          const title =
            s.tipo === 'partido'
              ? `Partido vs ${s.rival || 'Rival'}`
              : s.tipo === 'playoff'
                ? `Torneo vs ${s.rival || 'Rival'}`
                : `Entrenamiento`;

          const diffMin = Math.round(diffMs / 60000);
          const body = `${s.teamName || ''} · En ${diffMin} min${s.lugar ? ` · ${s.lugar}` : ''}`;

          new Notification(title, { body, icon: '/favicon.ico', tag: s.id });
        }
      }
    }

    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [sessions, profile.notifEnabled, profile.notifAntelacion]);
}
