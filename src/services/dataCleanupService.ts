import { httpsCallable } from 'firebase/functions';
import { CALLABLE_TIMEOUT_MS, getRegionalFunctions } from './functionsClient';

type CleanupAction = 'deleteTeam' | 'deleteBracket' | 'deleteConversation' | 'deleteAllUserData';

interface CleanupRequest {
  action: CleanupAction;
  appId: string;
  wsId?: string;
  teamId?: string;
  bracketId?: string;
  conversationId?: string;
}

interface CleanupResponse {
  success: boolean;
  result?: {
    action: CleanupAction;
    deleted: Record<string, number>;
  };
}

async function runCleanup(request: CleanupRequest): Promise<CleanupResponse['result']> {
  const callable = httpsCallable(getRegionalFunctions(), 'cleanupUserData', {
    timeout: CALLABLE_TIMEOUT_MS,
  });
  const response = await callable(request);
  return (response.data as CleanupResponse).result;
}

export async function deleteTeamCascade({ appId, wsId, teamId }: { appId: string; wsId: string; teamId: string }) {
  return runCleanup({ action: 'deleteTeam', appId, wsId, teamId });
}

export async function deleteBracketCascade({
  appId,
  wsId,
  bracketId,
}: {
  appId: string;
  wsId: string;
  bracketId: string;
}) {
  return runCleanup({ action: 'deleteBracket', appId, wsId, bracketId });
}

export async function deleteConversationCascade({
  appId,
  wsId,
  conversationId,
}: {
  appId: string;
  wsId: string;
  conversationId: string;
}) {
  return runCleanup({ action: 'deleteConversation', appId, wsId, conversationId });
}

export async function deleteAllUserDataCascade({ appId }: { appId: string }) {
  return runCleanup({ action: 'deleteAllUserData', appId });
}
