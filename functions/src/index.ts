import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import {
  AgentRouter,
  ObservabilityService,
  LLMProvider,
  BracketAgent,
  CalendarAgent,
  ResultsAgent,
  ConversationalAgent,
  TrainingGeneratorAgent,
} from "./ai";

const geminiKey = defineSecret("GEMINI_API_KEY");
const langfusePublicKey = defineSecret("LANGFUSE_PUBLIC_KEY");
const langfuseSecretKey = defineSecret("LANGFUSE_SECRET_KEY");
const langfuseBaseUrl = defineSecret("LANGFUSE_BASE_URL");

let cachedRouter: AgentRouter | null = null;
let cachedObservability: ObservabilityService | null = null;

function getSystem(): { router: AgentRouter; observability: ObservabilityService } {
  if (cachedRouter && cachedObservability) {
    return { router: cachedRouter, observability: cachedObservability };
  }

  // Secrets are available as env vars at runtime when declared via defineSecret
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

  cachedRouter = router;
  cachedObservability = observability;
  return { router, observability };
}

// 1. runAgent — execute a specific agent by name
export const runAgent = onCall(
  {
    secrets: [geminiKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    const { agent, input } = request.data;
    if (!agent || !input) {
      throw new HttpsError("invalid-argument", "Missing agent or input");
    }

    const system = getSystem();
    try {
      return await system.router.routeExplicit(agent, input, {
        userId: request.auth.uid,
      });
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

// 2. aiChat — route by intent (free-text AI chat)
export const aiChat = onCall(
  {
    secrets: [geminiKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

    const { message, context, screenContext, conversationHistory } = request.data;
    if (!message) {
      throw new HttpsError("invalid-argument", "Missing message");
    }

    const system = getSystem();
    try {
      return await system.router.routeByIntent(
        message,
        context || {},
        { userId: request.auth.uid },
        screenContext,
        conversationHistory
      );
    } catch (err) {
      const error = err as Error;
      throw new HttpsError("internal", error.message);
    } finally {
      await system.observability.flush();
    }
  }
);

// 3. submitFeedback — user feedback → Langfuse scores
export const submitFeedback = onCall(
  {
    secrets: [geminiKey, langfusePublicKey, langfuseSecretKey, langfuseBaseUrl],
    region: "europe-west1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login required");
    }

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
