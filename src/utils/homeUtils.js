import { toYMD } from './dateUtils';

function toMillis(raw) {
  if (!raw) return 0;
  if (typeof raw === 'object' && typeof raw.toMillis === 'function') return raw.toMillis();
  if (typeof raw === 'number') return raw;
  if (raw instanceof Date) return raw.getTime();
  const d = new Date(raw);
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sessionStartDate(session) {
  if (!session?.fecha) return null;
  const [y, m, d] = session.fecha.split('-').map(Number);
  const [h, mm] = (session.horaInicio || '00:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, h || 0, mm || 0, 0, 0);
}

function sessionEndDate(session) {
  if (!session?.fecha) return null;
  const [y, m, d] = session.fecha.split('-').map(Number);
  if (session.horaFin) {
    const [h, mm] = session.horaFin.split(':').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, h || 0, mm || 0, 0, 0);
  }
  const start = sessionStartDate(session);
  if (!start) return null;
  return new Date(start.getTime() + 90 * 60 * 1000);
}

/**
 * Countdown string for a session relative to `now`.
 * Returns { label, urgency } where urgency is one of: 'live' | 'soon' | 'today' | 'tomorrow' | 'future'.
 */
export function formatCountdown(session, now = new Date()) {
  if (!session?.fecha) return { label: '', urgency: 'future' };
  const start = sessionStartDate(session);
  const end = sessionEndDate(session);
  if (!start) return { label: '', urgency: 'future' };

  const todayYMD = toYMD(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowYMD = toYMD(tomorrow);

  if (end && now >= start && now <= end) return { label: 'En curso', urgency: 'live' };

  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) {
    if (session.fecha === todayYMD) return { label: 'Ya empezó', urgency: 'live' };
    return { label: 'Pasado', urgency: 'future' };
  }

  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);

  if (diffMin < 60) return { label: `En ${diffMin} min`, urgency: 'soon' };
  if (session.fecha === todayYMD) {
    const m = diffMin % 60;
    return { label: m > 0 ? `En ${diffH}h ${m}m` : `En ${diffH}h`, urgency: 'today' };
  }
  if (session.fecha === tomorrowYMD) {
    return { label: session.horaInicio ? `Mañana · ${session.horaInicio}` : 'Mañana', urgency: 'tomorrow' };
  }
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return { label: `En ${days} días`, urgency: 'future' };
}

/**
 * Short relative-time string for a past timestamp.
 * Returns "hace 3 min", "hace 2h", "ayer", "hace 3 d", etc.
 */
export function relativeTime(ts, now = new Date()) {
  const t = toMillis(ts);
  if (!t) return '';
  const diff = now.getTime() - t;
  if (diff < 0) return 'ahora';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'ahora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} sem`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `hace ${mo} meses`;
  return `hace ${Math.floor(d / 365)} años`;
}

function hasPlayoffScores(session) {
  if (!Array.isArray(session?.scores)) return false;
  return session.scores.some((g) => Number(g?.s1) > 0 || Number(g?.s2) > 0);
}

/**
 * Build pending actions list from sessions.
 * - Pasts training without trainingId → "Crear entrenamiento"
 * - Past playoff without scores → "Registrar resultado"
 * Sorted by most recent first, limited to `limit`.
 */
export function buildPendingActions(allSessions, todayYMD, { limit = 6 } = {}) {
  const items = [];
  const seenPlayoff = new Set();
  for (const s of allSessions || []) {
    if (!s?.fecha || s.fecha > todayYMD) continue;
    if (s.tipo === 'entrenamiento' && !s.trainingId) {
      items.push({
        id: `pending-training-${s.id}`,
        type: 'training',
        session: s,
        label: `Crear entrenamiento · ${s.teamName || ''}`.trim().replace(/·\s*$/, ''),
        cta: 'Crear',
        severity: s.fecha < todayYMD ? 'high' : 'medium',
      });
    } else if (s.tipo === 'playoff' && !hasPlayoffScores(s)) {
      // One pending per (bracket, match) — scores are shared across games.
      const key = `${s.bracketId}:${s.bracketMatchId}`;
      if (seenPlayoff.has(key)) continue;
      seenPlayoff.add(key);
      items.push({
        id: `pending-playoff-${s.id}`,
        type: 'result',
        session: s,
        label: `Registrar resultado · vs ${s.rival || 'Rival'}`,
        cta: 'Resultado',
        severity: s.fecha < todayYMD ? 'high' : 'medium',
      });
    }
  }
  items.sort((a, b) => (b.session.fecha || '').localeCompare(a.session.fecha || ''));
  return items.slice(0, limit);
}

function trainingsToNews(trainings) {
  const out = [];
  for (const t of trainings) {
    const ts = toMillis(t.createdAt || t.updatedAt);
    if (!ts) continue;
    const fecha = t?.meta?.fecha;
    const numero = t?.meta?.numero || '';
    const teamLabel = t?.meta?.equipo || '';
    out.push({
      id: `news-training-${t.id}`,
      kind: 'training_created',
      title: numero ? `Entrenamiento #${numero} creado` : 'Entrenamiento creado',
      subtitle: teamLabel || (fecha ? `Fecha ${fecha}` : ''),
      ts,
      navigateTo: t.teamId ? `/teams/${t.teamId}/trainings/${t.id}` : null,
    });
  }
  return out;
}

function exercisesToNews(exercises) {
  const out = [];
  for (const ex of exercises) {
    const ts = toMillis(ex.createdAt);
    if (!ts) continue;
    out.push({
      id: `news-exercise-${ex.id}`,
      kind: 'exercise_added',
      title: 'Ejercicio añadido',
      subtitle: ex.nombre || 'Sin nombre',
      ts,
      navigateTo: '/exercises',
    });
  }
  return out;
}

function sessionsToNews(sessions, nowMs) {
  const out = [];
  for (const s of sessions) {
    if (s?.tipo !== 'partido' || !s.fecha) continue;
    if (!hasPlayoffScores(s) && !s.resultado) continue;
    const ts = toMillis(s.updatedAt) || sessionStartDate(s)?.getTime() || 0;
    if (!ts || ts > nowMs) continue;
    out.push({
      id: `news-match-${s.id}`,
      kind: 'match_played',
      title: `Partido jugado vs ${s.rival || 'Rival'}`,
      subtitle: s.teamName || '',
      ts,
      navigateTo: `/calendar/${s.id}/analysis`,
    });
  }
  return out;
}

function bracketsToNews(brackets) {
  const out = [];
  for (const b of brackets) {
    const ts = toMillis(b.updatedAt);
    if (!ts) continue;
    const state = b.bracketData?.state;
    if (!state) continue;
    const hasWinner = Object.values(state).some((m) => m.winner);
    if (!hasWinner) continue;
    out.push({
      id: `news-bracket-${b.id}`,
      kind: 'bracket_progress',
      title: 'Torneo actualizado',
      subtitle: b.name || b.tournamentNameDetected || 'Torneo',
      ts,
      navigateTo: b.teamId ? `/playoffs?teamId=${b.teamId}` : '/playoffs',
    });
  }
  return out;
}

/**
 * Build news feed items from recent trainings, exercises, bracket progress and played matches.
 * Items are { id, kind, title, subtitle, ts, navigateTo }. Sorted desc by ts.
 */
export function buildNewsItems({ trainings = [], exercises = [], sessions = [], brackets = [], now, limit = 8 }) {
  const nowMs = (now || new Date()).getTime();
  const items = [
    ...trainingsToNews(trainings),
    ...exercisesToNews(exercises),
    ...sessionsToNews(sessions, nowMs),
    ...bracketsToNews(brackets),
  ];
  items.sort((a, b) => b.ts - a.ts);
  return items.slice(0, limit);
}

const DOW_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function startOfWeek(d) {
  const copy = new Date(d);
  const dow = copy.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Build 7-day strip (Mon..Sun) centered on the week containing `today`.
 * Each day: { ymd, label, dayNum, isToday, counts: { entrenamiento, partido, playoff }, sessions }.
 */
export function buildWeekStrip(allSessions = [], today = new Date()) {
  const start = startOfWeek(today);
  const todayYMD = toYMD(today);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ymd = toYMD(d);
    const sessionsOfDay = allSessions.filter((s) => s.fecha === ymd);
    const counts = {
      entrenamiento: sessionsOfDay.filter((s) => s.tipo === 'entrenamiento').length,
      partido: sessionsOfDay.filter((s) => s.tipo === 'partido').length,
      playoff: sessionsOfDay.filter((s) => s.tipo === 'playoff').length,
    };
    days.push({
      ymd,
      label: DOW_NAMES[i],
      dayNum: d.getDate(),
      isToday: ymd === todayYMD,
      isPast: ymd < todayYMD,
      counts,
      sessions: sessionsOfDay,
    });
  }
  return days;
}

/**
 * First upcoming (today or future) session ordered by date+time.
 * `matchDayFallback` is used when no session is found (keeps backward-compat).
 */
export function pickNextAction(allSessions = [], todayYMD, matchDayFallback = null) {
  const future = (allSessions || [])
    .filter((s) => s.fecha >= todayYMD)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.horaInicio || '').localeCompare(b.horaInicio || ''));
  return future[0] || matchDayFallback || null;
}
