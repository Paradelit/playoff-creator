import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import type { OrchestratorResponse } from './contentBlocks';

let emulatorConnected = false;

// Match the backend Cloud Function timeoutSeconds: 300
const CALLABLE_TIMEOUT_MS = 300_000;

function getRegionalFunctions() {
  const functions = getFunctions(undefined, 'europe-west1');
  if (import.meta.env.DEV && !emulatorConnected) {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    emulatorConnected = true;
  }
  return functions;
}

export async function runAgent<TResult>(
  agentName: string,
  input: Record<string, unknown>,
  sessionId?: string,
): Promise<{ result: TResult; traceId: string }> {
  const callable = httpsCallable(getRegionalFunctions(), 'runAgent', {
    timeout: CALLABLE_TIMEOUT_MS,
  });
  const response = await callable({ agent: agentName, input, sessionId });
  return response.data as { result: TResult; traceId: string };
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
  screenContext?: ScreenContextPayload;
  conversationHistory?: Array<{ role: string; content: string }>;
  clientDate?: string;
  conversationId?: string;
}): Promise<OrchestratorResponse> {
  const callable = httpsCallable(getRegionalFunctions(), 'aiChat', {
    timeout: CALLABLE_TIMEOUT_MS,
  });
  const response = await callable(request);
  return response.data as OrchestratorResponse;
}
