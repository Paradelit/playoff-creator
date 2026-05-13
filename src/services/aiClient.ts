import { httpsCallable } from 'firebase/functions';
import type { OrchestratorResponse } from './contentBlocks';
import { CALLABLE_TIMEOUT_MS, getRegionalFunctions } from './functionsClient';
import { eventBus } from '../billing/eventBus';

/**
 * Single choke-point for all AI callable invocations.
 * Intercepts `functions/resource-exhausted` quota errors, emits `quota-exceeded`
 * on the eventBus (so QuotaExceededModal can react), then re-throws so callers
 * still receive the failure.
 */
async function callAICallable<TPayload, TResult>(
  fnName: string,
  payload: TPayload,
  timeoutMs?: number,
): Promise<TResult> {
  const callable = httpsCallable<TPayload, TResult>(getRegionalFunctions(), fnName, {
    timeout: timeoutMs,
  });
  try {
    const response = await callable(payload);
    return response.data;
  } catch (err: any) {
    if (err.code === 'functions/resource-exhausted' && err.details?.limit !== undefined) {
      eventBus.emit('quota-exceeded', {
        count: err.details.count,
        limit: err.details.limit,
        monthId: err.details.monthId,
      });
    }
    throw err;
  }
}

export async function runAgent<TResult>(
  agentName: string,
  input: Record<string, unknown>,
  opts: { wsId: string; appId: string; sessionId?: string },
): Promise<{ result: TResult; traceId: string }> {
  return callAICallable<Record<string, unknown>, { result: TResult; traceId: string }>(
    'runAgent',
    { agent: agentName, input, wsId: opts.wsId, appId: opts.appId, sessionId: opts.sessionId },
    CALLABLE_TIMEOUT_MS,
  );
}

export async function submitFeedback(traceId: string, score: number, comment?: string): Promise<void> {
  const callable = httpsCallable(getRegionalFunctions(), 'logInteractionScore');
  await callable({ traceId, score, comment });
}

export interface ScreenContextPayload {
  screen: string;
  route: string;
  params: Record<string, string>;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

export async function aiChatV2(request: {
  message: string;
  appId: string;
  wsId: string;
  screenContext?: ScreenContextPayload;
  conversationHistory?: Array<{ role: string; content: string }>;
  clientDate?: string;
  conversationId?: string;
}): Promise<OrchestratorResponse> {
  return callAICallable<typeof request, OrchestratorResponse>('aiChat', request, CALLABLE_TIMEOUT_MS);
}

// ── Proactive engine (sub-B.5) ───────────────────────────────────────────────

export type ProactiveKind = 'convocatoria_urgent' | 'analysis_overdue' | 'scouting_missing' | 'player_report_missing';

export interface ProactiveMessage {
  kind: ProactiveKind;
  text: string;
  severity: 'info' | 'warn' | 'high';
  suggestedPrompt?: string;
  contextRefs?: { sessionId?: string; teamId?: string; playerId?: string };
}

/**
 * Fetches the next proactive message Pick wants to surface (or null if quiet).
 * Called on Pick open. Backed by `decideProactive` + 7-day per-kind backoff.
 */
export async function getProactiveMessage(opts: {
  appId: string;
  wsId: string;
  clientDate?: string;
}): Promise<ProactiveMessage | null> {
  const result = await callAICallable<typeof opts, { message: ProactiveMessage | null }>('pickGetProactive', opts);
  return result.message;
}

/** Records a 7-day backoff for a proactive kind ("Ahora no" click). */
export async function dismissProactive(opts: { appId: string; kind: ProactiveKind }): Promise<void> {
  await callAICallable<typeof opts, { success: boolean }>('pickDismissProactive', opts);
}
