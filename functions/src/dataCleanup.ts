import { FieldPath, Firestore, Query } from "firebase-admin/firestore";

export type CleanupAction = "deleteTeam" | "deleteBracket" | "deleteConversation" | "deleteAllUserData";

export interface CleanupParams {
  db: Firestore;
  appId: string;
  userId: string;
  wsId?: string; // required for deleteTeam/Bracket/Conversation; not used for deleteAllUserData (server iterates memberships)
  action: CleanupAction;
  teamId?: string;
  bracketId?: string;
  conversationId?: string;
}

export interface CleanupResult {
  action: CleanupAction;
  deleted: {
    teams: number;
    brackets: number;
    sharedRefs: number;
    sharedBrackets: number;
    presence: number;
    calendarSessions: number;
    scoutings: number;
    analisis: number;
    planillas: number;
    conversations: number;
    users: number;
  };
}

function userRoot(db: Firestore, appId: string, userId: string) {
  return db.collection("artifacts").doc(appId).collection("users").doc(userId);
}

function userCol(db: Firestore, appId: string, userId: string, collectionName: string) {
  return userRoot(db, appId, userId).collection(collectionName);
}

function workspaceRoot(db: Firestore, appId: string, wsId: string) {
  return db.collection("artifacts").doc(appId).collection("workspaces").doc(wsId);
}

function workspaceCol(db: Firestore, appId: string, wsId: string, collectionName: string) {
  return workspaceRoot(db, appId, wsId).collection(collectionName);
}

function sharedDoc(db: Firestore, appId: string, shareCode: string) {
  return db.collection("artifacts").doc(appId).collection("shared").doc(shareCode);
}

function presenceDoc(db: Firestore, appId: string, shareCode: string) {
  return db.collection("artifacts").doc(appId).collection("presence").doc(shareCode);
}

function emptyResult(action: CleanupAction): CleanupResult {
  return {
    action,
    deleted: {
      teams: 0,
      brackets: 0,
      sharedRefs: 0,
      sharedBrackets: 0,
      presence: 0,
      calendarSessions: 0,
      scoutings: 0,
      analisis: 0,
      planillas: 0,
      conversations: 0,
      users: 0,
    },
  };
}

async function deleteQueryDocs(query: Query): Promise<number> {
  const snap = await query.get();
  await Promise.all(snap.docs.map((docSnap) => docSnap.ref.delete()));
  return snap.size;
}

async function deletePlayoffArtifactsForBracket(
  db: Firestore,
  appId: string,
  wsId: string,
  bracketId: string,
  result: CleanupResult
): Promise<void> {
  const prefix = `playoff-${bracketId}-`;
  const end = `${prefix}`;

  const scoutingsDeleted = await deleteQueryDocs(
    workspaceCol(db, appId, wsId, "scoutings")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<=", end)
  );
  result.deleted.scoutings += scoutingsDeleted;

  const analysisDeleted = await deleteQueryDocs(
    workspaceCol(db, appId, wsId, "analisis")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<=", end)
  );
  result.deleted.analisis += analysisDeleted;

  const planillasDeleted = await deleteQueryDocs(
    workspaceCol(db, appId, wsId, "planillas")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<=", end)
  );
  result.deleted.planillas += planillasDeleted;
}

async function isOwnedSharedBracket(
  db: Firestore,
  appId: string,
  userId: string,
  shareCode: string,
  localData?: Record<string, unknown>
): Promise<boolean> {
  const localOwnerId =
    localData?.shareConfig &&
    typeof localData.shareConfig === "object" &&
    !Array.isArray(localData.shareConfig) &&
    typeof (localData.shareConfig as Record<string, unknown>).ownerId === "string"
      ? ((localData.shareConfig as Record<string, unknown>).ownerId as string)
      : "";

  if (localOwnerId === userId) return true;

  const sharedSnap = await sharedDoc(db, appId, shareCode).get();
  if (!sharedSnap.exists) return false;
  return sharedSnap.get("shareConfig.ownerId") === userId;
}

async function deleteSharedArtifacts(
  db: Firestore,
  appId: string,
  shareCode: string,
  result: CleanupResult
): Promise<void> {
  const bracketRefsSnap = await db.collectionGroup("brackets").where("shareCode", "==", shareCode).get();
  await Promise.all(bracketRefsSnap.docs.map((docSnap) => docSnap.ref.delete()));
  result.deleted.sharedRefs += bracketRefsSnap.size;

  await db.recursiveDelete(sharedDoc(db, appId, shareCode));
  result.deleted.sharedBrackets += 1;

  await db.recursiveDelete(presenceDoc(db, appId, shareCode));
  result.deleted.presence += 1;
}

async function deleteBracketById(
  db: Firestore,
  appId: string,
  userId: string,
  wsId: string,
  bracketId: string,
  result: CleanupResult
): Promise<void> {
  const ref = workspaceCol(db, appId, wsId, "brackets").doc(bracketId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = (snap.data() || {}) as Record<string, unknown>;
  await deletePlayoffArtifactsForBracket(db, appId, wsId, bracketId, result);

  const shareCode = typeof data.shareCode === "string" ? data.shareCode : "";
  if (shareCode && (await isOwnedSharedBracket(db, appId, userId, shareCode, data))) {
    await deleteSharedArtifacts(db, appId, shareCode, result);
    return;
  }

  await ref.delete();
  result.deleted.brackets += 1;
}

async function deleteSessionArtifacts(
  db: Firestore,
  appId: string,
  wsId: string,
  sessionIds: string[],
  result: CleanupResult
): Promise<void> {
  for (const sessionId of sessionIds) {
    const scoutingRef = workspaceCol(db, appId, wsId, "scoutings").doc(sessionId);
    const analysisRef = workspaceCol(db, appId, wsId, "analisis").doc(sessionId);
    const planillaRef = workspaceCol(db, appId, wsId, "planillas").doc(sessionId);

    const [scoutingSnap, analysisSnap, planillaSnap] = await Promise.all([
      scoutingRef.get(),
      analysisRef.get(),
      planillaRef.get(),
    ]);

    if (scoutingSnap.exists) {
      await scoutingRef.delete();
      result.deleted.scoutings += 1;
    }
    if (analysisSnap.exists) {
      await analysisRef.delete();
      result.deleted.analisis += 1;
    }
    if (planillaSnap.exists) {
      await planillaRef.delete();
      result.deleted.planillas += 1;
    }
  }
}

async function deleteTeamById(
  db: Firestore,
  appId: string,
  userId: string,
  wsId: string,
  teamId: string,
  result: CleanupResult
): Promise<void> {
  const teamRef = workspaceCol(db, appId, wsId, "teams").doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) return;

  const sessionsSnap = await workspaceCol(db, appId, wsId, "calendarSessions").where("teamId", "==", teamId).get();
  const sessionIds = sessionsSnap.docs.map((docSnap) => docSnap.id);
  await deleteSessionArtifacts(db, appId, wsId, sessionIds, result);
  await Promise.all(sessionsSnap.docs.map((docSnap) => docSnap.ref.delete()));
  result.deleted.calendarSessions += sessionsSnap.size;

  const bracketsSnap = await workspaceCol(db, appId, wsId, "brackets").where("teamId", "==", teamId).get();
  for (const bracketDoc of bracketsSnap.docs) {
    await deleteBracketById(db, appId, userId, wsId, bracketDoc.id, result);
  }

  await db.recursiveDelete(teamRef);
  result.deleted.teams += 1;
}

async function deleteConversationById(
  db: Firestore,
  appId: string,
  userId: string,
  wsId: string,
  conversationId: string,
  result: CleanupResult
): Promise<void> {
  const ref = userRoot(db, appId, userId).collection("pickHistory").doc(wsId).collection("conversations").doc(conversationId);
  await db.recursiveDelete(ref);
  result.deleted.conversations += 1;
}

async function deleteAllUserDataCascade(
  db: Firestore,
  appId: string,
  userId: string,
  result: CleanupResult
): Promise<void> {
  // 1. Iterate user's memberships and tear down workspaces accordingly
  const membershipsSnap = await userCol(db, appId, userId, "memberships").get();

  for (const membershipDoc of membershipsSnap.docs) {
    const wsId = membershipDoc.id;
    const wsRef = workspaceRoot(db, appId, wsId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) continue;
    const ws = (wsSnap.data() || {}) as { type?: string; ownerId?: string };

    if (ws.type === "personal" && ws.ownerId === userId) {
      // Personal workspace owned by this user: clean up shared brackets first,
      // then recursive-delete the entire workspace tree.
      const sharedSnap = await db
        .collection("artifacts")
        .doc(appId)
        .collection("shared")
        .where("shareConfig.ownerId", "==", userId)
        .get();

      for (const sharedBracket of sharedSnap.docs) {
        await deleteSharedArtifacts(db, appId, sharedBracket.id, result);
      }

      await db.recursiveDelete(wsRef);
    } else {
      // Club workspace where user is a member: just remove their membership.
      await wsRef.collection("members").doc(userId).delete();
    }
  }

  // 2. Recursive delete all user-private data (profile, pickHistory, proactiveNotifications, memberships, etc.)
  await db.recursiveDelete(userRoot(db, appId, userId));
  result.deleted.users += 1;
}

export async function cleanupUserData(params: CleanupParams): Promise<CleanupResult> {
  const { db, appId, userId, wsId, action, teamId, bracketId, conversationId } = params;
  const result = emptyResult(action);

  if (action === "deleteTeam") {
    if (!teamId) throw new Error("Missing teamId");
    if (!wsId) throw new Error("Missing wsId");
    await deleteTeamById(db, appId, userId, wsId, teamId, result);
    return result;
  }

  if (action === "deleteBracket") {
    if (!bracketId) throw new Error("Missing bracketId");
    if (!wsId) throw new Error("Missing wsId");
    await deleteBracketById(db, appId, userId, wsId, bracketId, result);
    return result;
  }

  if (action === "deleteConversation") {
    if (!conversationId) throw new Error("Missing conversationId");
    if (!wsId) throw new Error("Missing wsId");
    await deleteConversationById(db, appId, userId, wsId, conversationId, result);
    return result;
  }

  await deleteAllUserDataCascade(db, appId, userId, result);
  return result;
}
