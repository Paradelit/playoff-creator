/**
 * Client-side mirror of functions/src/ai/contentBlocks.ts.
 * Keep both files in sync — these are the discriminated-union block types
 * the orchestrator emits for rendering in the chat UI.
 */

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

export type WriteProposalKind =
  | 'create_training'
  | 'create_calendar_session'
  | 'update_bracket_scores'
  | 'save_note'
  | 'create_bracket'
  | 'save_attendance'
  | 'save_player_report'
  | 'save_shooting_test'
  | 'save_scouting'
  | 'save_analysis';

export interface WriteProposal {
  proposalId: string;
  kind: WriteProposalKind;
  summary: string;
  payload: Record<string, unknown>;
}

export type ContentBlock =
  | { type: 'text'; markdown: string }
  | { type: 'status'; text: string }
  | { type: 'team_list'; teams: TeamListEntry[] }
  | { type: 'training_preview'; training: TrainingPreviewData }
  | { type: 'bracket_preview'; bracket: BracketPreviewData }
  | { type: 'session_preview'; session: Record<string, unknown> }
  | { type: 'score_update'; updates: ScoreUpdateEntry[] }
  | { type: 'confirm_write'; proposal: WriteProposal };

export interface OrchestratorResponse {
  blocks: ContentBlock[];
  traceId: string;
}
