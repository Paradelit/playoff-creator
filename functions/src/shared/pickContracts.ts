import type { TeamRecord } from "./teamDomain";

export interface TeamListEntry {
  id: string;
  name: string;
  categoria?: string;
  memberCount: number;
}

export interface TrainingPreviewData {
  title: string;
  totalDuration: number;
  warmup?: unknown;
  mainBlocks?: unknown[];
  cooldown?: unknown;
  notes?: string;
}

export interface BracketPreviewData {
  tournamentName?: string;
  rounds?: unknown[];
  initialMatches?: unknown[];
}

export interface ScoreUpdateEntry {
  id: string;
  scores: unknown[];
}

export interface CalendarSessionRecord {
  id?: string;
  teamId?: string;
  teamName?: string;
  sessionNumber?: number;
  fecha?: string;
  horaInicio?: string;
  horaFin?: string;
  lugar?: string;
  tipo?: string;
  rival?: string;
  esLocal?: boolean;
  trainingId?: string | null;
  recurrenceId?: string;
  recurrenceDetached?: boolean;
  importedFrom?: string;
}

export interface BracketRecord {
  id?: string;
  name?: string;
  teamId?: string | null;
  teamName?: string | null;
  myTeam?: string | null;
  tournamentNameDetected?: string;
  initialMatchesArray?: unknown[];
  roundsData?: unknown[];
  allTeams?: string[];
  bracketData?: Record<string, unknown>;
  shareCode?: string;
  shareConfig?: Record<string, unknown>;
}

export type PickTeamRecord = TeamRecord;

export type WriteProposalKind =
  | "create_training"
  | "create_calendar_session"
  | "update_bracket_scores"
  | "save_note"
  | "create_bracket"
  | "save_attendance"
  | "save_player_report"
  | "save_shooting_test"
  | "save_scouting"
  | "save_analysis"
  | "create_exercise"
  | "create_exercises";

export interface WriteProposal {
  proposalId: string;
  kind: WriteProposalKind;
  summary: string;
  payload: Record<string, unknown>;
}

export type ContentBlock =
  | { type: "text"; markdown: string }
  | { type: "status"; text: string }
  | { type: "team_list"; teams: TeamListEntry[] }
  | { type: "training_preview"; training: TrainingPreviewData }
  | { type: "bracket_preview"; bracket: BracketPreviewData }
  | { type: "session_preview"; session: CalendarSessionRecord | Record<string, unknown> }
  | { type: "score_update"; updates: ScoreUpdateEntry[] }
  | { type: "exercise_preview"; exercises: ExercisePreviewData[] }
  | { type: "convocatoria_preview"; convocatoria: ConvocatoriaPreviewData }
  | { type: "confirm_write"; proposal: WriteProposal };

export interface ExercisePreviewData {
  nombre: string;
  descripcion?: string;
  contenido?: string;
  tags?: string[];
  duracion?: number;
  nivel?: string;
  tipoPista?: string;
}

export interface ConvocatoriaPreviewData {
  sessionId: string;
  tipo: "partido" | "playoff";
  fecha?: string;
  horaInicio?: string;
  rival?: string;
  lugar?: string;
  teamId?: string;
  /** Set when tipo === 'playoff'. Used to persist to playoffConvocatorias collection. */
  bracketId?: string;
  bracketMatchId?: string;
  gameIndex?: number;
  /** Rendered message ready to copy/share. */
  mensaje: string;
  /** Header line (Liga / Playoff / Amistoso). Useful for chat summaries. */
  encabezado: string;
}

/** Acción ejecutable en el cliente (p. ej. navegación SPA). */
export interface PickNavigateAction {
  type: "navigate";
  label: string;
  path: string;
}

export type PickAction = PickNavigateAction;

export interface OrchestratorResponse {
  blocks: ContentBlock[];
  traceId: string;
  /** Botones u órdenes de cliente; p. ej. `navigate` para React Router. */
  actions?: PickAction[];
  /** Internal metrics for auto-evaluation — stripped before sending to client. */
  _autoEvalMetrics?: {
    toolCalls: Array<{ name: string }>;
    loopDetected: boolean;
  };
}
