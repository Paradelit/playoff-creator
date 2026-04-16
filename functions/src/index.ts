import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  AgentRouter,
  ObservabilityService,
  LLMProvider,
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
  buildUserDigest,
} from "./ai";

if (getApps().length === 0) initializeApp();

const geminiKey = defineSecret("GEMINI_API_KEY");
const langfusePublicKey = defineSecret("LANGFUSE_PUBLIC_KEY");
const langfuseSecretKey = defineSecret("LANGFUSE_SECRET_KEY");
const langfuseBaseUrl = defineSecret("LANGFUSE_BASE_URL");

interface System {
  router: AgentRouter;
  observability: ObservabilityService;
  llmProvider: LLMProvider;
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

function getSystem(): System {
  if (cached) return cached;

  const observability = new ObservabilityService();
  const llmProvider = new LLMProvider({
    apiKey: geminiKey.value(),
    observability,
  });

  const bracketAgent = new BracketAgent({ llmProvider, observability });
  const calendarAgent = new CalendarAgent({ llmProvider, observability });
  const resultsAgent = new ResultsAgent({ llmProvider, observability });
  const conversationalAgent = new ConversationalAgent({ llmProvider, observability });
  const trainingAgent = new TrainingGeneratorAgent({ llmProvider, observability });

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
  });

  // New orchestrator with tools
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerMany(createReadTools());
  toolRegistry.registerMany(createWriteTools());
  toolRegistry.registerMany(createAgentTools());
  toolRegistry.registerMany(createMemoryTools());

  const orchestrator = new OrchestratorAgent({
    llmProvider,
    observability,
    toolRegistry,
  });

  cached = {
    router,
    observability,
    llmProvider,
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
    secrets: [geminiKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const { agent, input } = request.data;
    if (!agent || !input) throw new HttpsError("invalid-argument", "Missing agent or input");

    const system = getSystem();
    try {
      return await system.router.routeExplicit(agent, input, { userId: request.auth.uid });
    } catch (err) {
      const error = err as Error;
      if (error.message === "RATE_LIMIT") {
        throw new HttpsError("resource-exhausted", "Demasiadas peticiones a Gemini. Espera 60 segundos.");
      }
      if (error.message === "FORBIDDEN") {
        throw new HttpsError("permission-denied", "Error 403: La API Key no tiene acceso a la IA.");
      }
      throw new HttpsError("internal", error.message);
    } finally {
      await system.observability.flush();
    }
  }
);

// 2. aiChat — orchestrator with function calling, returns ContentBlocks
export const aiChat = onCall(
  {
    secrets: [geminiKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
    timeoutSeconds: 180,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required");

    const { message, screenContext, conversationHistory, appId } = request.data || {};
    if (!message) throw new HttpsError("invalid-argument", "Missing message");
    if (!appId) throw new HttpsError("invalid-argument", "Missing appId");

    const system = getSystem();
    const db = getFirestore();
    const userId = request.auth.uid;

    const trace = system.observability.createTrace({
      name: "orchestrator",
      userId,
      metadata: { screen: screenContext?.screen, userMessage: String(message).slice(0, 200) },
    });
    const traceId = (trace as { id?: string })?.id || "";
    const traceContext = { trace };
    const agentOptions = { userId };

    try {
      const userDigest = await buildUserDigest({ db, userId, appId });

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

      return { ...response, traceId };
    } catch (err) {
      const error = err as Error;
      console.error("aiChat error:", error);
      if (error.message === "RATE_LIMIT") {
        throw new HttpsError("resource-exhausted", "Demasiadas peticiones a Gemini. Espera 60 segundos.");
      }
      if (error.message === "FORBIDDEN") {
        throw new HttpsError("permission-denied", "La API Key no tiene acceso a la IA.");
      }
      throw new HttpsError("internal", error.message || "Error en el orquestador");
    } finally {
      await system.observability.flush();
    }
  }
);

// 3. logInteractionScore — user feedback → Langfuse scores
export const logInteractionScore = onCall(
  {
    secrets: [geminiKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
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
