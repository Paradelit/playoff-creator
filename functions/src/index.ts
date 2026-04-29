import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { cleanupUserData as runCleanupUserData, type CleanupAction } from "./dataCleanup";
import { runProactiveBriefing } from "./proactiveEngine";
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

    const { agent, input, sessionId } = request.data;
    if (!agent || !input) throw new HttpsError("invalid-argument", "Missing agent or input");

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
export const aiChat = onCall(
  {
    secrets: [geminiKey, openRouterKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const { message, screenContext, conversationHistory, appId, clientDate, conversationId } = request.data || {};
    if (!message) throw new HttpsError("invalid-argument", "Missing message");
    if (!appId) throw new HttpsError("invalid-argument", "Missing appId");

    const system = getSystem();
    const db = getFirestore();
    const userId = request.auth.uid;

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
      const userDigest = await buildUserDigest({ db, userId, appId, clientDate });

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

    const { action, appId, teamId, bracketId, conversationId } = request.data || {};
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

    try {
      const result = await runCleanupUserData({
        db: getFirestore(),
        appId,
        userId: request.auth.uid,
        action: action as CleanupAction,
        teamId,
        bracketId,
        conversationId,
      });
      return { success: true, result };
    } catch (err) {
      const error = err as Error;
      throw new HttpsError("internal", error.message || "Cleanup failed");
    }
  }
);

// 6. proactiveDailyBriefing — scheduled function that runs every morning at 08:00 Europe/Madrid.
//    Queries active users, finds sessions for today/tomorrow, generates AI suggestions,
//    and writes them to proactiveNotifications/{date}-{sessionId} (idempotent).
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
    const apiKey = geminiKey.value();
    try {
      const result = await runProactiveBriefing(apiKey);
      console.log("[proactiveDailyBriefing] Completed:", result);
    } catch (err) {
      console.error("[proactiveDailyBriefing] Fatal error:", (err as Error).message);
      // Don't rethrow — let the function succeed so Cloud Scheduler doesn't retry aggressively.
    }
  }
);
\nexport { resolveMapsUrl } from "./locations/resolveMapsUrl";
