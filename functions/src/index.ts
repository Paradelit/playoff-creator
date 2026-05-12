import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as functionsV1 from "firebase-functions/v1";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { cleanupUserData as runCleanupUserData, type CleanupAction } from "./dataCleanup";
import { runProactiveBriefing } from "./proactiveEngine";
import { bootstrapPersonalWorkspace } from "./auth/onUserCreate";
// Re-export del trigger v1 al final del index.ts para que el deploy lo registre.
import {
  AgentRouter,
  ObservabilityService,
  LLMProvider,
  PromptManager,
  BracketAgent,
  CalendarAgent,
  ResultsAgent,
  ConversationalAgent,
  TrainingGeneratorAgent,
  OrchestratorAgent,
  ToolRegistry,
  createReadTools,
  createWriteTools,
  createAgentTools,
  createMemoryTools,
  createNavigationTools,
  createKnowledgeTools,
  createUserContextTools,
  buildUserDigest,
  AutoEvaluator,
} from "./ai";
import { assertWithinQuota } from "./billing/quota";
import { assertWorkspaceMembership } from "./common/assertWorkspaceMembership";

if (getApps().length === 0) initializeApp();

const geminiKey = defineSecret("GEMINI_API_KEY");
const openRouterKey = defineSecret("OPENROUTER_API_KEY");
const langfusePublicKey = defineSecret("LANGFUSE_PUBLIC_KEY");
const langfuseSecretKey = defineSecret("LANGFUSE_SECRET_KEY");
const langfuseBaseUrl = defineSecret("LANGFUSE_BASE_URL");

interface System {
  router: AgentRouter;
  observability: ObservabilityService;
  llmProvider: LLMProvider;
  promptManager: PromptManager;
  orchestrator: OrchestratorAgent;
  toolRegistry: ToolRegistry;
  agents: {
    bracket: BracketAgent;
    calendar: CalendarAgent;
    results: ResultsAgent;
    training: TrainingGeneratorAgent;
  };
}

let cached: System | null = null;

function safeSecret(param: { value: () => string }): string {
  try {
    return param.value() || "";
  } catch {
    return "";
  }
}

function getSystem(): System {
  if (cached) return cached;

  const observability = new ObservabilityService();

  const gKey = geminiKey.value();
  const orKey = safeSecret(openRouterKey);

  console.log(`[System] Cargando secretos... Gemini: ${gKey ? "OK" : "MISSING"}, OpenRouter: ${orKey ? "OK" : "MISSING"}`);

  const llmProvider = new LLMProvider({
    apiKey: gKey,
    openRouterApiKey: orKey,
    observability,
  });

  // PromptManager: uses the Langfuse client exposed by ObservabilityService
  const promptManager = new PromptManager(observability.getLangfuseClient());

  const agentDeps = { llmProvider, observability, promptManager };
  const bracketAgent = new BracketAgent(agentDeps);
  const calendarAgent = new CalendarAgent(agentDeps);
  const resultsAgent = new ResultsAgent(agentDeps);
  const conversationalAgent = new ConversationalAgent(agentDeps);
  const trainingAgent = new TrainingGeneratorAgent(agentDeps);

  // Legacy router (kept for runAgent endpoint and backwards-compat)
  const router = new AgentRouter({
    agents: {
      bracket: bracketAgent,
      calendar: calendarAgent,
      results: resultsAgent,
      conversational: conversationalAgent,
      training: trainingAgent,
    },
    llmProvider,
    observability,
    promptManager,
  });

  // New orchestrator with tools
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerMany(createReadTools());
  toolRegistry.registerMany(createWriteTools());
  toolRegistry.registerMany(createAgentTools());
  toolRegistry.registerMany(createMemoryTools());
  toolRegistry.registerMany(createNavigationTools());
  toolRegistry.registerMany(createKnowledgeTools(gKey));
  toolRegistry.registerMany(createUserContextTools(gKey));

  const orchestrator = new OrchestratorAgent({
    llmProvider,
    observability,
    toolRegistry,
    promptManager,
  });

  cached = {
    router,
    observability,
    llmProvider,
    promptManager,
    orchestrator,
    toolRegistry,
    agents: {
      bracket: bracketAgent,
      calendar: calendarAgent,
      results: resultsAgent,
      training: trainingAgent,
    },
  };
  return cached;
}

// 1. runAgent — execute a specific legacy agent by name (kept for backwards compat)
export const runAgent = onCall(
  {
    secrets: [geminiKey, openRouterKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const { agent, input, sessionId, appId, wsId } = request.data;
    if (!agent || !input) throw new HttpsError("invalid-argument", "Missing agent or input");
    if (!appId) throw new HttpsError("invalid-argument", "Missing appId");
    if (!wsId) throw new HttpsError("invalid-argument", "Missing wsId");

    const db = getFirestore();
    // Verify membership BEFORE consuming quota — sin este check, un atacante
    // podía pasar cualquier wsId conocido y agotar la cuota de otro workspace.
    // Espejo del check que aiChat ya hacía in-line.
    await assertWorkspaceMembership(db, appId as string, wsId as string, request.auth.uid);
    // Quota gate — same as aiChat. Increments counter atomically; throws resource-exhausted when free + over.
    await assertWithinQuota(db, { wsId: wsId as string, appId: appId as string });

    const system = getSystem();
    try {
      return await system.router.routeExplicit(agent, input, { userId: request.auth.uid, sessionId });
    } catch (err) {
      const error = err as Error;
      const msg = error.message || "";
      if (msg === "RATE_LIMIT" || msg.includes("saturados")) {
        throw new HttpsError("resource-exhausted", "Demasiadas peticiones a la IA. Espera 60 segundos.");
      }
      if (msg === "FORBIDDEN") {
        throw new HttpsError("permission-denied", "Error 403: La API Key no tiene acceso a la IA.");
      }
      throw new HttpsError("internal", msg);
    } finally {
      await system.observability.flush();
    }
  }
);

// 2. aiChat — orchestrator with function calling, returns ContentBlocks

export interface AiChatRequest {
  auth?: { uid: string };
  data: Record<string, unknown> | null | undefined;
}

/**
 * Inner handler for the aiChat callable — extracted so it can be unit-tested
 * without booting the full Firebase Functions runtime. The "Login required"
 * check stays in the callable wrapper to preserve its error message contract.
 */
export async function aiChatHandler(request: AiChatRequest, system: System, db: Firestore) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (request.data || {}) as any;
  const { message, screenContext, conversationHistory, appId, wsId, clientDate, conversationId } = data;
  if (!message) throw new HttpsError("invalid-argument", "Missing message");
  if (!appId || typeof appId !== "string") throw new HttpsError("invalid-argument", "Missing appId");
  if (!wsId || typeof wsId !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid wsId");
  }

  const userId = request.auth!.uid;

  // Validate workspace membership server-side (single doc read)
  const memberRef = db.doc(`artifacts/${appId}/workspaces/${wsId}/members/${userId}`);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError("permission-denied", "Not a member of this workspace");
  }

  // Quota gate — increments counter atomically; throws resource-exhausted when free + over.
  await assertWithinQuota(db, { wsId, appId });

  const trace = system.observability.createTrace({
    name: "orchestrator",
    userId,
    sessionId: conversationId,
    metadata: { screen: screenContext?.screen, userMessage: String(message).slice(0, 200) },
  });
  const traceId = (trace as { id?: string })?.id || "";
  const traceContext = { trace };
  const agentOptions = { userId, sessionId: conversationId };

  try {
    const userDigest = await buildUserDigest({ db, userId, wsId, appId, clientDate });

    // Infer default IDs from the current screen so tools can fallback
    // when the LLM forgets to pass an explicit id arg.
    const defaults: { teamId?: string; sessionId?: string; bracketId?: string } = {};
    if (screenContext) {
      const entityType = screenContext.entityType as string | undefined;
      const entityId = screenContext.entityId as string | undefined;
      if (entityType && entityId) {
        if (entityType === "team") defaults.teamId = entityId;
        else if (entityType === "session" || entityType === "calendarSession")
          defaults.sessionId = entityId;
        else if (entityType === "bracket") defaults.bracketId = entityId;
      }
      // Also probe params (e.g. /teams/:teamId)
      const params = (screenContext.params as Record<string, string> | undefined) || {};
      if (!defaults.teamId && params.teamId) defaults.teamId = params.teamId;
      if (!defaults.sessionId && params.sessionId) defaults.sessionId = params.sessionId;
      if (!defaults.bracketId && params.bracketId) defaults.bracketId = params.bracketId;
    }

    const toolCtx = {
      db,
      userId,
      wsId,
      appId,
      defaults,
      agents: system.agents,
      traceContext,
      agentOptions,
      geminiApiKey: geminiKey.value(),
    };

    const response = await system.orchestrator.run(
      {
        userMessage: String(message),
        screenContext,
        conversationHistory,
        userDigest,
      },
      toolCtx,
      traceContext,
      agentOptions
    );

    // Fire-and-forget: auto-score the trace without adding latency
    if (traceId && response._autoEvalMetrics) {
      const autoEvaluator = new AutoEvaluator(system.observability);
      autoEvaluator.score(traceId, {
        toolCalls: response._autoEvalMetrics.toolCalls,
        loopDetected: response._autoEvalMetrics.loopDetected,
        contentBlocks: response.blocks,
      });
    }

    // Strip internal metrics before sending to client
    const { _autoEvalMetrics: _omit, ...clientResponse } = response;
    return { ...clientResponse, traceId };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    const error = err as Error;
    const msg = error.message || "";
    console.error("aiChat error:", error);
    if (msg === "RATE_LIMIT" || msg.includes("saturados")) {
      throw new HttpsError("resource-exhausted", "Demasiadas peticiones a la IA. Espera 60 segundos.");
    }
    if (msg === "FORBIDDEN") {
      throw new HttpsError("permission-denied", "La API Key no tiene acceso a la IA.");
    }
    throw new HttpsError("internal", msg || "Error en el orquestador");
  } finally {
    await system.observability.flush();
  }
}

export const aiChat = onCall(
  {
    secrets: [geminiKey, openRouterKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");
    const system = getSystem();
    const db = getFirestore();
    return aiChatHandler(request, system, db);
  }
);

// 3. logInteractionScore — user feedback → Langfuse scores
export const logInteractionScore = onCall(
  {
    secrets: [geminiKey, openRouterKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const { traceId, score, comment } = request.data;
    if (!traceId || score === undefined) {
      throw new HttpsError("invalid-argument", "Missing traceId or score");
    }

    const system = getSystem();
    system.observability.logScore(traceId, {
      name: "user-feedback",
      value: score,
      comment,
    });
    await system.observability.flush();
    return { success: true };
  }
);

// 4. cleanupUserData — backend cascade deletes for teams, brackets, conversations and full account data
export const cleanupUserData = onCall(
  {
    region: "europe-west1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const { action, appId, wsId, teamId, bracketId, conversationId } = request.data || {};
    if (!appId || typeof appId !== "string") {
      throw new HttpsError("invalid-argument", "Missing appId");
    }
    if (!action || typeof action !== "string") {
      throw new HttpsError("invalid-argument", "Missing action");
    }
    const allowedActions: CleanupAction[] = [
      "deleteTeam",
      "deleteBracket",
      "deleteConversation",
      "deleteAllUserData",
    ];
    if (!allowedActions.includes(action as CleanupAction)) {
      throw new HttpsError("invalid-argument", "Invalid action");
    }
    const actionsNeedingWsId: CleanupAction[] = [
      "deleteTeam",
      "deleteBracket",
      "deleteConversation",
    ];
    if (actionsNeedingWsId.includes(action as CleanupAction)) {
      if (!wsId || typeof wsId !== "string") {
        throw new HttpsError("invalid-argument", "Missing or invalid wsId");
      }
    }
    // deleteAllUserData iterates memberships server-side and doesn't need wsId from client.

    const db = getFirestore();

    // Authorization por acción. Pre-batch-security, este callable solo verificaba
    // auth.uid presente y pasaba cualquier (wsId, teamId/bracketId) a la lógica
    // de borrado — un atacante podía borrar teams/brackets de cualquier workspace
    // pasando los IDs (descubrir IDs es trivial vía screenshots, share-codes, etc.).
    if (action === "deleteTeam" || action === "deleteBracket") {
      // Borrados de team/bracket requieren ser DT (o owner) del workspace —
      // misma matriz que firestore.rules para `allow delete` en /teams.
      const ctx = await assertWorkspaceMembership(
        db,
        appId,
        wsId as string,
        request.auth.uid,
      );
      if (!ctx.isOwner && !ctx.isDT) {
        throw new HttpsError(
          "permission-denied",
          "Solo el owner o DT pueden borrar teams/brackets.",
        );
      }
    } else if (action === "deleteConversation") {
      // La conversación vive bajo users/{uid}/pickHistory/{wsId}/... — el path
      // ya scopea al uid del caller; aún así verificamos membership para no
      // permitir crear basura en wsId que el caller nunca ha usado.
      await assertWorkspaceMembership(db, appId, wsId as string, request.auth.uid);
    }
    // deleteAllUserData scopea a request.auth.uid en todas las queries internas;
    // no necesita check adicional.

    try {
      const result = await runCleanupUserData({
        db,
        appId,
        userId: request.auth.uid,
        wsId,
        action: action as CleanupAction,
        teamId,
        bracketId,
        conversationId,
      });
      return { success: true, result };
    } catch (err) {
      const error = err as Error;
      // Si la lógica interna ya lanzó HttpsError, propagarlo tal cual; si fue
      // Error genérico, envolverlo como internal sin filtrar el mensaje (puede
      // incluir paths Firestore con IDs sensibles).
      if (error instanceof HttpsError) throw error;
      console.error("[cleanupUserData] internal error", {
        uid: request.auth.uid,
        action,
        wsId,
        err: error.message,
      });
      throw new HttpsError("internal", "Cleanup failed");
    }
  }
);

// 6. proactiveDailyBriefing — scheduled function that runs every morning at 08:00 Europe/Madrid.
//    Queries active users, finds sessions for today/tomorrow, generates AI suggestions,
//    and writes them to proactiveNotifications/{date}-{sessionId} (idempotent).
/**
 * Resolves the Firestore appId (the `artifacts/{appId}/...` namespace) from the
 * `PICK_APP_ID` env var. Fails closed: returns null and logs an error if the
 * var is missing, so a misconfigured deploy can never write to the wrong
 * namespace by accident. Callers handle null by skipping work.
 */
function resolveAppId(handlerName: string): string | null {
  const appId = process.env.PICK_APP_ID;
  if (!appId) {
    console.error(`[${handlerName}] PICK_APP_ID env var missing; skipping run.`);
    return null;
  }
  return appId;
}

export const proactiveDailyBriefing = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Europe/Madrid",
    secrets: [geminiKey],
    region: "europe-west1",
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async (_event) => {
    const appId = resolveAppId("proactiveDailyBriefing");
    if (!appId) return;
    const apiKey = geminiKey.value();
    try {
      const result = await runProactiveBriefing(apiKey, appId);
      console.log("[proactiveDailyBriefing] Completed:", result);
    } catch (err) {
      console.error("[proactiveDailyBriefing] Fatal error:", (err as Error).message);
      // Don't rethrow — let the function succeed so Cloud Scheduler doesn't retry aggressively.
    }
  }
);

// 7. onUserCreate — Auth trigger that fires when a new Firebase Auth user is created.
//    Bootstraps a personal workspace + owner member + memberships cache so post-cutover
//    sign-ups never land in WorkspaceProvisioningState indefinitely. Idempotent on retry.
//    Uses the v1 trigger because firebase-functions v2 does not expose a non-blocking
//    auth.user().onCreate equivalent (only beforeUserCreated, which blocks signup).
export const onUserCreate = functionsV1
  .region("europe-west1")
  .auth.user()
  .onCreate(async (user) => {
    const appId = resolveAppId("onUserCreate");
    if (!appId) return;
    try {
      const result = await bootstrapPersonalWorkspace({ uid: user.uid }, appId);
      console.log(
        `[onUserCreate] uid=${user.uid} ${result.status} wsId=${result.wsId}`
      );
    } catch (err) {
      console.error(
        `[onUserCreate] uid=${user.uid} FATAL:`,
        (err as Error).message
      );
      // Do not rethrow: the user record exists in Auth and we don't want to leave
      // them in a half-broken state. Client's WorkspaceProvisioningState handles retry.
    }
  });

export { resolveMapsUrl } from "./locations/resolveMapsUrl";

// Sub-7 batch CI — cleanup automático cuando Firebase Auth borra un user.
// Sin esto, workspaces/datos del user borrado quedaban como zombies.
export { onUserDelete } from "./auth/onUserDelete";

// Sub-7 batch CI — backup automatizado diario de Firestore a Cloud Storage.
// Requiere bucket `gs://playoff-creator-firestore-backups` con permisos
// Firestore Service Agent. Si el bucket no existe, función falla con log
// pero no rompe nada. Ver docs/runbooks/firestore-backups.md.
export { scheduledFirestoreBackup } from "./maintenance/scheduledFirestoreBackup";

// Stripe billing (sub-proyecto 5).
export { createCheckoutSession } from "./billing/createCheckoutSession";
export { createPortalSession } from "./billing/createPortalSession";
export { stripeWebhook } from "./billing/webhook";
// Sub-proyecto 6 — B2B per-seat billing.
export { createClubSubscription } from "./billing/createClubSubscription";

// Sub-proyecto 3 — invitaciones y licencias.
export { createClub } from "./sub3/createClub";
export { inviteMember } from "./sub3/inviteMember";
export { acceptInvite } from "./sub3/acceptInvite";
export { revokeInvite } from "./sub3/revokeInvite";
export { revokeMember } from "./sub3/revokeMember";
export { setMemberTeams } from "./sub3/setMemberTeams";
export { setMemberRole } from "./sub3/setMemberRole";
export { transferOwnership } from "./sub3/transferOwnership";
export { getClubAllowlistStatus } from "./sub3/getClubAllowlistStatus";
export { onMemberDelete } from "./sub3/onMemberDelete";
export { onTeamCreate } from "./sub3/onTeamCreate";
export { onTeamDelete } from "./sub3/onTeamDelete";
export { cleanupExpiredInvites } from "./sub3/cleanupExpiredInvites";
