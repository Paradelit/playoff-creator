import type { UserDigest, DigestSession, DigestTeam } from '../digest/types';
import type { ScreenContextData } from '../types';
import type { AmbiguityCandidate, AmbiguityResult } from './types';

/**
 * Regex-based heuristics (sub-B.3).
 *
 * Cheap pre-LLM step that catches the most common ambiguity patterns:
 *   - "del partido" / "la convocatoria" when there's >1 upcoming partido
 *   - "este equipo" without a TeamDetail screen semantic + >1 team
 *   - "este jugador" without a player screen semantic
 *   - out-of-scope domains (finance, external messaging)
 *
 * Conservative on purpose: false positives = Pick interrupts the coach with
 * a clarification question when none was needed. False negatives just fall
 * through to the LLM (B.4 will catch some of those with a fast-model pass).
 */

const PATTERN_PARTIDO_GENERIC = [
  // Demonstrative partido references — "del partido", "este partido", "ese partido"
  /\b(del|al|este|ese)\s+partido\b/i,
  // "la convocatoria" alone is ambiguous when no specific partido is mentioned.
  // We allow "la convocatoria de X" (specific) by requiring no qualifier follows.
  /\bla\s+convocatoria\b(?!\s+(?:del?\s+(?:s[aá]bado|domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|partido\s+de|el|la|los|las)|para))/i,
];

/** "el partido del sábado" / "el partido de Cadete A" — specific, let LLM resolve. */
const PATTERN_PARTIDO_SPECIFIC =
  /\b(el|los)\s+partidos?\s+(del?\s+(?:s[aá]bado|domingo|lunes|martes|mi[eé]rcoles|jueves|viernes)|de\s+\w+)/i;

const PATTERN_EQUIPO = /\b(este|ese|el)\s+equipo\b/i;

const PATTERN_JUGADOR = /\b(este|ese)\s+jugador\b/i;

const OUT_OF_SCOPE_PATTERNS = [
  /\b(balance|presupuesto|finanzas?|facturaci[oó]n|factura|suscripci[oó]n|stripe|tarjeta\s+de\s+cr[eé]dito|cobro|n[oó]mina)\b/i,
  /\b(env[ií]ame|m[aá]ndame|env[ií]a)\s+(un\s+)?(email|sms|correo|whatsapp|telegrama)\b/i,
  /\b(tw[ií]ttea|publica\s+en\s+(twitter|instagram|facebook))\b/i,
];

function upcomingPartidos(digest: UserDigest): DigestSession[] {
  return digest.upcomingSessions.filter((s) => s.tipo === 'partido');
}

function partidoCandidates(sessions: DigestSession[]): AmbiguityCandidate[] {
  return sessions.map((s) => {
    const parts = [s.fecha, s.horaInicio, s.teamName, s.rival ? `vs ${s.rival}` : ''];
    const label = parts
      .filter((p) => p && p.length > 0)
      .join(' ')
      .trim();
    return {
      id: s.id,
      label: label || s.fecha,
      kind: 'session' as const,
    };
  });
}

function teamCandidates(teams: DigestTeam[]): AmbiguityCandidate[] {
  return teams.map((t) => ({ id: t.id, label: t.name, kind: 'team' as const }));
}

function hasReferableId(screen: ScreenContextData | null, key: string): string | null {
  const v = screen?.semantic?.referableIds?.[key];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function detectAmbiguity(
  message: string,
  digest: UserDigest,
  screen: ScreenContextData | null,
): AmbiguityResult {
  // 1. Out-of-scope — cheapest, most decisive. Run first.
  for (const pat of OUT_OF_SCOPE_PATTERNS) {
    if (pat.test(message)) {
      return {
        kind: 'out-of-scope',
        reason: 'Pick no puede acceder a datos financieros ni enviar mensajes externos.',
        suggestedAlternative: 'Te puedo ayudar con entrenamientos, partidos, jugadores y brackets.',
      };
    }
  }

  // 2. "este equipo" — try referableIds first, then fall back to team-list ambiguity.
  if (PATTERN_EQUIPO.test(message)) {
    if (hasReferableId(screen, 'este equipo')) return { kind: 'clear' };
    const teams = digest.teams;
    if (teams.length > 1) {
      return {
        kind: 'ambiguous',
        clarification: '¿De qué equipo hablas?',
        candidates: teamCandidates(teams),
      };
    }
  }

  // 3. "este jugador" — only resolvable via screen semantic. Can't enumerate all players cheaply.
  if (PATTERN_JUGADOR.test(message)) {
    if (hasReferableId(screen, 'este jugador')) return { kind: 'clear' };
    return {
      kind: 'ambiguous',
      clarification: '¿De qué jugador hablas? Dime equipo y dorsal o nombre.',
      candidates: [],
    };
  }

  // 4. "del partido" / "la convocatoria" — only ambiguous when:
  //    - phrasing is generic (no specific date or team)
  //    - there's > 1 upcoming partido
  if (PATTERN_PARTIDO_GENERIC.some((p) => p.test(message)) && !PATTERN_PARTIDO_SPECIFIC.test(message)) {
    const partidos = upcomingPartidos(digest);
    if (partidos.length > 1) {
      return {
        kind: 'ambiguous',
        clarification: '¿De qué partido?',
        candidates: partidoCandidates(partidos),
      };
    }
  }

  return { kind: 'clear' };
}
