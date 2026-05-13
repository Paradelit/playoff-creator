/**
 * Proactive engine (sub-B.5) — types.
 *
 * The on-open ProactiveEngine reads digest.pendingActions + (future)
 * digest.anomalies and decides whether to emit a single message to the coach
 * the moment Pick opens. Distinct from `functions/src/proactiveEngine.ts`,
 * which is a scheduled batch that writes push-style notifications.
 */

export type ProactiveKind = 'convocatoria_urgent' | 'analysis_overdue' | 'scouting_missing' | 'player_report_missing';

export type ProactiveSeverity = 'info' | 'warn' | 'high';

export interface ProactiveContextRefs {
  sessionId?: string;
  teamId?: string;
  playerId?: string;
}

export interface ProactiveMessage {
  kind: ProactiveKind;
  /** What Pick says to the coach. 1-2 short sentences, basketball-native voice. */
  text: string;
  severity: ProactiveSeverity;
  /** Optional follow-up prompt the user can accept with one click. */
  suggestedPrompt?: string;
  /** IDs of entities the message refers to — frontend uses these for deep-link. */
  contextRefs?: ProactiveContextRefs;
}
