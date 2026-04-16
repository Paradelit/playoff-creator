/**
 * ContentBlock — the unit of output from the orchestrator to the chat UI.
 * Each block has a `type` tag and the frontend selects a renderer accordingly.
 *
 * Keep this in sync with src/services/contentBlocks.ts (client-side copy).
 */

export type ContentBlock =
  | { type: "text"; markdown: string }
  | { type: "status"; text: string }
  | { type: "team_list"; teams: Array<{ id: string; name: string; categoria?: string; memberCount: number }> }
  | {
      type: "training_preview";
      training: {
        title: string;
        totalDuration: number;
        warmup?: unknown;
        mainBlocks?: unknown[];
        cooldown?: unknown;
        notes?: string;
      };
    }
  | { type: "bracket_preview"; bracket: { tournamentName?: string; rounds?: unknown[]; initialMatches?: unknown[] } }
  | { type: "session_preview"; session: Record<string, unknown> }
  | { type: "score_update"; updates: Array<{ id: string; scores: unknown[] }> }
  | { type: "confirm_write"; proposal: WriteProposal };

export interface WriteProposal {
  proposalId: string;
  kind:
    | "create_training"
    | "create_calendar_session"
    | "update_bracket_scores"
    | "save_note"
    | "create_bracket"
    | "save_attendance"
    | "save_player_report"
    | "save_shooting_test"
    | "save_scouting"
    | "save_analysis";
  summary: string;
  payload: Record<string, unknown>;
}

export interface OrchestratorResponse {
  blocks: ContentBlock[];
  traceId: string;
}
