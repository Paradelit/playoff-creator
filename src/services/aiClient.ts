import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';

let emulatorConnected = false;

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
): Promise<{ result: TResult; traceId: string }> {
  const callable = httpsCallable(getRegionalFunctions(), 'runAgent');
  const response = await callable({ agent: agentName, input });
  return response.data as { result: TResult; traceId: string };
}

export async function aiChat(
  message: string,
  context?: Record<string, unknown>,
): Promise<{ type: string; result?: unknown; agent?: string; message?: string; traceId: string }> {
  const callable = httpsCallable(getRegionalFunctions(), 'aiChat');
  const response = await callable({ message, context });
  return response.data as { type: string; result?: unknown; agent?: string; message?: string; traceId: string };
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

export interface EnrichedResponsePayload {
  type: 'agent_result' | 'conversational' | 'no_match';
  agent?: string;
  result?: unknown;
  naturalResponse: string;
  suggestedMode: 'compact' | 'panel' | 'column';
  actions?: Array<{ type: 'navigate' | 'create'; label: string; path?: string; data?: unknown }>;
  traceId: string;
}

export async function aiChatV2(request: {
  message: string;
  screenContext?: ScreenContextPayload;
  conversationHistory?: Array<{ role: string; content: string }>;
}): Promise<EnrichedResponsePayload> {
  const callable = httpsCallable(getRegionalFunctions(), 'aiChat');
  const response = await callable(request);
  return response.data as EnrichedResponsePayload;
}
