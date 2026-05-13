import type { UserDigest, PendingConvocatoria, PendingMatchAction, PendingPlayerReportsTeam } from '../digest/types';
import type { ProactiveMessage, ProactiveSeverity } from './types';

/**
 * Priorizer (sub-B.5a) — pure function.
 *
 * Reads `digest.pendingActions` and converts it into a ranked list of
 * `ProactiveMessage`s. The engine picks the first one that hasn't been
 * dismissed (B.5b backoff). Pure + synchronous so it's trivial to unit-test.
 *
 * Severity rules (most-→-least urgent):
 *   - high: convocatoria <48h.
 *   - warn: convocatoria 48h-7d, análisis >7d overdue.
 *   - info: scouting pendiente, player_report >=3 missing.
 *
 * Player reports threshold (3+) avoids nagging when the gap is small —
 * a single missing informe isn't worth interrupting the coach for.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PLAYER_REPORT_NOISE_THRESHOLD = 3;

const SEVERITY_ORDER: Record<ProactiveSeverity, number> = {
  high: 0,
  warn: 1,
  info: 2,
};

function isoStartOfDayMs(iso: string): number {
  // "YYYY-MM-DD" → millis at 00:00Z of that day. Defensive: trim if datetime.
  return new Date(iso.slice(0, 10) + 'T00:00:00Z').getTime();
}

function hoursAhead(fechaISO: string, nowISO: string): number {
  const target = isoStartOfDayMs(fechaISO);
  const now = new Date(nowISO).getTime();
  return (target - now) / HOUR_MS;
}

function daysAgo(fechaISO: string, nowISO: string): number {
  const target = isoStartOfDayMs(fechaISO);
  const now = new Date(nowISO).getTime();
  return (now - target) / DAY_MS;
}

function describeMatchup(teamName: string | undefined, rival: string | undefined): string {
  const teamPart = teamName || 'equipo';
  return rival ? `${teamPart} vs ${rival}` : teamPart;
}

function buildConvocatoria(action: PendingConvocatoria, nowISO: string): ProactiveMessage | null {
  // Use precomputed hoursUntil from sub-A.4a when fresh; fall back to recompute
  // if the digest is stale (defensive, shouldn't happen in production).
  const h = typeof action.hoursUntil === 'number' ? action.hoursUntil : hoursAhead(action.fecha, nowISO);
  if (h < 0) return null;
  // Map sub-A.4a's "high"|"normal" severity → our 3-tier scale + downgrade
  // by absolute hours: even a "normal" convocatoria becomes 'info' beyond 7d.
  let severity: ProactiveSeverity;
  if (action.severity === 'high' || h < 48) severity = 'high';
  else if (h <= 24 * 7) severity = 'warn';
  else severity = 'info';
  const matchup = describeMatchup(action.teamName, action.rival);
  const whenLabel = h < 24 ? 'mañana' : `el ${action.fecha}`;
  return {
    kind: 'convocatoria_urgent',
    text: `${whenLabel} hay partido ${matchup}. La convocatoria aún no está mandada.`,
    severity,
    suggestedPrompt: `Prepara la convocatoria del partido del ${action.fecha}`,
    contextRefs: { sessionId: action.sessionId },
  };
}

function buildAnalysis(action: PendingMatchAction, nowISO: string): ProactiveMessage | null {
  const ageDays = Math.floor(daysAgo(action.fecha, nowISO));
  if (ageDays < 7) return null;
  const matchup = describeMatchup(action.teamName, action.rival);
  return {
    kind: 'analysis_overdue',
    text: `Llevas ${ageDays} días sin analizar el partido del ${action.fecha} (${matchup}).`,
    severity: 'warn',
    suggestedPrompt: `Vamos a analizar el partido del ${action.fecha}`,
    contextRefs: { sessionId: action.sessionId },
  };
}

function buildScouting(action: PendingMatchAction): ProactiveMessage {
  const matchup = describeMatchup(action.teamName, action.rival);
  return {
    kind: 'scouting_missing',
    text: `Próximo rival sin scouting: ${matchup} (${action.fecha}).`,
    severity: 'info',
    suggestedPrompt: `Vamos a preparar el scouting del partido del ${action.fecha}`,
    contextRefs: { sessionId: action.sessionId },
  };
}

function buildPlayerReport(team: PendingPlayerReportsTeam): ProactiveMessage | null {
  if (team.missingForPlayerCount < PLAYER_REPORT_NOISE_THRESHOLD) return null;
  const teamName = team.teamName || 'tu equipo';
  return {
    kind: 'player_report_missing',
    text: `${teamName}: te faltan ${team.missingForPlayerCount} informes de jugador este trimestre.`,
    severity: 'info',
    suggestedPrompt: `Vamos a rellenar los informes pendientes de ${teamName}`,
    contextRefs: { teamId: team.teamId },
  };
}

export function prioritizeProactive(digest: UserDigest, nowISO: string): ProactiveMessage[] {
  const messages: ProactiveMessage[] = [];

  for (const c of digest.pendingActions.convocatorias) {
    const m = buildConvocatoria(c, nowISO);
    if (m) messages.push(m);
  }
  for (const a of digest.pendingActions.analyses) {
    const m = buildAnalysis(a, nowISO);
    if (m) messages.push(m);
  }
  for (const s of digest.pendingActions.scoutings) {
    messages.push(buildScouting(s));
  }
  for (const p of digest.pendingActions.playerReports) {
    const m = buildPlayerReport(p);
    if (m) messages.push(m);
  }

  return messages.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
