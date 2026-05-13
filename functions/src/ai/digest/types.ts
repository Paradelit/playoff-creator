import type { MemoryType } from "../tools/memoryTools";

/**
 * Tipos del digest que se inyecta al system prompt de Pick en cada turno.
 *
 * Estructura por capas (ver spec sub-A):
 * - Layer 1 (este archivo): campos que entran en system prompt cada turno.
 * - Layer 3 (PR4): `pendingActions` + `anomalies` derivados del cache
 *   `pickInsights/{date}`.
 * - Layer 4 (PR5): `screenSemantic`.
 */

export type UserRole = "owner" | "coach" | "assistant";

export interface RosterPlayer {
  id: string;
  nombre: string;
  dorsal?: string;
  posicion?: string;
}

/** Resultado de un partido normalizado al punto de vista del coach
 *  (`ourScore` siempre del equipo del coach, `theirScore` del rival). */
export interface MatchResult {
  ourScore: number;
  theirScore: number;
}

export interface DigestTeam {
  id: string;
  name: string;
  categoria?: string;
  nivel?: string;
  memberCount: number;
  rosterSnapshot?: RosterPlayer[];
  nextSession?: {
    id: string;
    fecha: string;
    tipo?: string;
    rival?: string;
  };
  lastResult?: {
    fecha: string;
    rival?: string;
    ourScore: number;
    theirScore: number;
  };
}

export interface DigestBracket {
  id: string;
  name: string;
  teamId?: string | null;
  /** Nombre de la ronda actual (la más temprana con matches sin winner). */
  currentRound?: string;
  /** Siguiente match a decidir en la ronda actual. */
  nextMatch?: {
    id: string;
    teamA: string;
    teamB: string;
    scheduled?: string;
  };
  /** Matches en la ronda actual con ambos teams definidos pero sin winner. */
  pendingScores?: number;
}

export interface DigestSession {
  id: string;
  fecha: string;
  horaInicio?: string;
  tipo?: string;
  teamName?: string;
  rival?: string;
  lugar?: string;
  /** Sólo presente en `recentPastSessions` cuando el coach ya introdujo
   *  el resultado en `session.resultado`. */
  result?: MatchResult;
}

export interface DigestMemory {
  id: string;
  type: MemoryType;
  content: string;
}

export interface DigestPreferences {
  proactivityMode?: string;
  defaultTrainingDuration?: number;
}

export interface DigestWorkspace {
  id: string;
  name: string;
  type: "personal" | "club";
  userRole: UserRole;
}

export interface PendingConvocatoria {
  sessionId: string;
  fecha: string;
  horaInicio?: string;
  teamId?: string;
  teamName?: string;
  rival?: string;
  severity: "high" | "normal";
  hoursUntil: number;
}

export interface PendingMatchAction {
  sessionId: string;
  fecha: string;
  teamId?: string;
  teamName?: string;
  rival?: string;
}

export interface PendingPlayerReportsTeam {
  teamId: string;
  teamName?: string;
  missingForPlayerCount: number;
  missingPlayerNames: string[];
}

export interface PendingActions {
  convocatorias: PendingConvocatoria[];
  scoutings: PendingMatchAction[];
  analyses: PendingMatchAction[];
  /** Per team, cuántos jugadores no tienen contenido en el informe. */
  playerReports: PendingPlayerReportsTeam[];
}

export interface UserDigest {
  todayISO: string;
  todayLocalDayOfWeek: string;
  workspace: DigestWorkspace;
  teams: DigestTeam[];
  activeBrackets: DigestBracket[];
  upcomingSessions: DigestSession[];
  recentPastSessions: DigestSession[];
  pendingActions: PendingActions;
  preferences: DigestPreferences;
  memories: DigestMemory[];
}
