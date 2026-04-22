import { FieldPath, Firestore, Query } from "firebase-admin/firestore";

export type CleanupAction = "deleteTeam" | "deleteBracket" | "deleteConversation" | "deleteAllUserData";

export interface CleanupParams {
  db: Firestore;
  appId: string;
  userId: string;
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
  userId: string,
  bracketId: string,
  result: CleanupResult
): Promise<void> {
  const prefix = `playoff-${bracketId}-`;
  const end = `${prefix}\uf8ff`;

  const scoutingsDeleted = await deleteQueryDocs(
    userCol(db, appId, userId, "scoutings")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<=", end)
  );
  result.deleted.scoutings += scoutingsDeleted;

  const analysisDeleted = await deleteQueryDocs(
    userCol(db, appId, userId, "analisis")
      .where(FieldPath.documentId(), ">=", prefix)
      .where(FieldPath.documentId(), "<=", end)
  );
  result.deleted.analisis += analysisDeleted;

  const planillasDeleted = await deleteQueryDocs(
    userCol(db, appId, userId, "planillas")
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
  bracketId: string,
  result: CleanupResult
): Promise<void> {
  const ref = userCol(db, appId, userId, "brackets").doc(bracketId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const data = (snap.data() || {}) as Record<string, unknown>;
  await deletePlayoffArtifactsForBracket(db, appId, userId, bracketId, result);

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
  userId: string,
  sessionIds: string[],
  result: CleanupResult
): Promise<void> {
  for (const sessionId of sessionIds) {
    const scoutingRef = userCol(db, appId, userId, "scoutings").doc(sessionId);
    const analysisRef = userCol(db, appId, userId, "analisis").doc(sessionId);
    const planillaRef = userCol(db, appId, userId, "planillas").doc(sessionId);

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
  teamId: string,
  result: CleanupResult
): Promise<void> {
  const teamRef = userCol(db, appId, userId, "teams").doc(teamId);
  const teamSnap = await teamRef.get();
  if (!teamSnap.exists) return;

  const sessionsSnap = await userCol(db, appId, userId, "calendarSessions").where("teamId", "==", teamId).get();
  const sessionIds = sessionsSnap.docs.map((docSnap) => docSnap.id);
  await deleteSessionArtifacts(db, appId, userId, sessionIds, result);
  await Promise.all(sessionsSnap.docs.map((docSnap) => docSnap.ref.delete()));
  result.deleted.calendarSessions += sessionsSnap.size;

  const bracketsSnap = await userCol(db, appId, userId, "brackets").where("teamId", "==", teamId).get();
  for (const bracketDoc of bracketsSnap.docs) {
    await deleteBracketById(db, appId, userId, bracketDoc.id, result);
  }

  await db.recursiveDelete(teamRef);
  result.deleted.teams += 1;
}

async function deleteConversationById(
  db: Firestore,
  appId: string,
  userId: string,
  conversationId: string,
  result: CleanupResult
): Promise<void> {
  const ref = userCol(db, appId, userId, "conversations").doc(conversationId);
  await db.recursiveDelete(ref);
  result.deleted.conversations += 1;
}

async function deleteAllUserArtifacts(db: Firestore, appId: string, userId: string, result: CleanupResult): Promise<void> {
  const sharedSnap = await db
    .collection("artifacts")
    .doc(appId)
    .collection("shared")
    .where("shareConfig.ownerId", "==", userId)
    .get();

  for (const sharedBracket of sharedSnap.docs) {
    await deleteSharedArtifacts(db, appId, sharedBracket.id, result);
  }

  await db.recursiveDelete(userRoot(db, appId, userId));
  result.deleted.users += 1;
}

export async function cleanupUserData(params: CleanupParams): Promise<CleanupResult> {
  const { db, appId, userId, action, teamId, bracketId, conversationId } = params;
  const result = emptyResult(action);

  if (action === "deleteTeam") {
    if (!teamId) throw new Error("Missing teamId");
    await deleteTeamById(db, appId, userId, teamId, result);
    return result;
  }

  if (action === "deleteBracket") {
    if (!bracketId) throw new Error("Missing bracketId");
    await deleteBracketById(db, appId, userId, bracketId, result);
    return result;
  }

  if (action === "deleteConversation") {
    if (!conversationId) throw new Error("Missing conversationId");
    await deleteConversationById(db, appId, userId, conversationId, result);
    return result;
  }

  await deleteAllUserArtifacts(db, appId, userId, result);
  return result;
}
