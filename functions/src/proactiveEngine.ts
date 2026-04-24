/**
 * proactiveEngine.ts
 *
 * Core logic for the proactiveDailyBriefing scheduled Cloud Function.
 * Queries active users, finds sessions for today/tomorrow, generates
 * AI-powered suggestions and stores them as proactiveNotifications docs.
 */

import { getFirestore } from "firebase-admin/firestore";
import { LLMProvider } from "./ai/llmProvider";
import { ObservabilityService } from "./ai/observability";

// ── Constants ────────────────────────────────────────────────────────────────

export const PROACTIVE_APP_ID = "playoff-creator";

/** Maximum number of users to process per run to stay within GCF timeout. */
const MAX_USERS = 50;

/** How many days back to consider a user "active". */
const ACTIVITY_WINDOW_DAYS = 30;

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarSessionData {
  fecha?: string;       // "YYYY-MM-DD"
  tipo?: string;        // "partido" | "entrenamiento"
  teamId?: string;
  rival?: string;
  nombreRival?: string;
  [key: string]: unknown;
}

interface ProactiveNotification {
  message: string;
  type: "match-reminder" | "training-tip";
  generatedAt: string;
  read: boolean;
  sessionId?: string;
  teamId?: string;
}

interface BriefingResult {
  processed: number;
  notifications: number;
  errors: number;
  skipped: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" for a date offset by `offsetDays` from `base`. */
function toDateStr(base: Date, offsetDays = 0): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

/**
 * Build a simple AI prompt for a session notification.
 * Returns a Spanish coaching tip as JSON: `{ "message": "..." }`.
 */
function buildPrompt(tipo: string, dayLabel: string, rival?: string): string {
  if (tipo === "partido") {
    const rivalName = rival || "el rival";
    return (
      `Eres un asistente de coaching de baloncesto. ` +
      `Genera un consejo breve y motivador (máximo 2 frases) para un entrenador ` +
      `que tiene un partido ${dayLabel} contra ${rivalName}. ` +
      `El consejo debe ser concreto y útil: táctica, preparación física, o mentalidad. ` +
      `Responde ÚNICAMENTE con JSON en el formato: {"message": "tu consejo aquí"}`
    );
  }
  return (
    `Eres un asistente de coaching de baloncesto. ` +
    `Genera un consejo breve y útil (máximo 2 frases) para un entrenador ` +
    `que tiene un entrenamiento ${dayLabel}. ` +
    `El consejo debe ser específico: un ejercicio, un foco táctico, o una dinámica de grupo. ` +
    `Responde ÚNICAMENTE con JSON en el formato: {"message": "tu consejo aquí"}`
  );
}

/** Fallback message if the LLM call fails. */
function fallbackMessage(tipo: string, dayLabel: string, rival?: string): string {
  if (tipo === "partido") {
    const rivalName = rival || "el rival";
    return `Partido ${dayLabel} vs ${rivalName}. Recuerda revisar el scouting y preparar la táctica con el equipo.`;
  }
  return `Entrenamiento ${dayLabel}. Planifica los ejercicios con antelación para maximizar el rendimiento del equipo.`;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Runs the proactive briefing pass.
 * Called from the scheduled Cloud Function in index.ts.
 *
 * @param geminiApiKey  The Gemini API key (passed in from the function secret).
 * @param appId         Firestore appId (defaults to PROACTIVE_APP_ID).
 */
export async function runProactiveBriefing(
  geminiApiKey: string,
  appId: string = PROACTIVE_APP_ID
): Promise<BriefingResult> {
  const db = getFirestore();
  const observability = new ObservabilityService();
  // Minimal trace context — observability is optional; logGeneration is a no-op when span is falsy.
  const traceContext = { trace: {}, span: {} };

  const llm = new LLMProvider({ apiKey: geminiApiKey, observability });

  const now = new Date();
  const today = toDateStr(now, 0);
  const tomorrow = toDateStr(now, 1);
  const activityCutoff = toDateStr(now, -ACTIVITY_WINDOW_DAYS);

  console.log(`[proactiveEngine] Starting run for appId=${appId}, today=${today}, tomorrow=${tomorrow}`);

  // ── Step 1: Collect active users ──────────────────────────────────────────

  const usersRef = db
    .collection("artifacts")
    .doc(appId)
    .collection("users");

  // We over-fetch to account for filtering; Firestore doesn't support
  // cross-collection queries, so we check activity after listing.
  const usersSnap = await usersRef.limit(MAX_USERS * 3).get();

  const activeUids: string[] = [];

  for (const userDoc of usersSnap.docs) {
    if (activeUids.length >= MAX_USERS) break;

    const uid = userDoc.id;

    // Check for teams (existence = active user)
    const teamsSnap = await db
      .collection("artifacts").doc(appId)
      .collection("users").doc(uid)
      .collection("teams")
      .limit(1)
      .get();

    if (!teamsSnap.empty) {
      activeUids.push(uid);
      continue;
    }

    // Check for any calendar session within the activity window
    const recentSnap = await db
      .collection("artifacts").doc(appId)
      .collection("users").doc(uid)
      .collection("calendarSessions")
      .where("fecha", ">=", activityCutoff)
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      activeUids.push(uid);
    }
  }

  console.log(`[proactiveEngine] Active users found: ${activeUids.length}`);

  // ── Step 2: Process each user ─────────────────────────────────────────────

  let processed = 0;
  let notifications = 0;
  let errors = 0;
  let skipped = 0;

  for (const uid of activeUids) {
    try {
      // Query sessions for today and tomorrow in a single range query
      const sessionsSnap = await db
        .collection("artifacts").doc(appId)
        .collection("users").doc(uid)
        .collection("calendarSessions")
        .where("fecha", ">=", today)
        .where("fecha", "<=", tomorrow)
        .get();

      const relevantSessions = sessionsSnap.docs.filter((doc) => {
        const tipo = (doc.data() as CalendarSessionData).tipo;
        return tipo === "partido" || tipo === "entrenamiento";
      });

      for (const sessionDoc of relevantSessions) {
        const sessionId = sessionDoc.id;
        const session = sessionDoc.data() as CalendarSessionData;
        const fecha = session.fecha ?? today;
        const tipo = session.tipo ?? "entrenamiento";
        const notifType: "match-reminder" | "training-tip" =
          tipo === "partido" ? "match-reminder" : "training-tip";

        // ── Idempotency check ────────────────────────────────────────────────
        const notifId = `${fecha}-${sessionId}`;
        const notifRef = db
          .collection("artifacts").doc(appId)
          .collection("users").doc(uid)
          .collection("proactiveNotifications")
          .doc(notifId);

        const existing = await notifRef.get();
        if (existing.exists) {
          skipped++;
          continue;
        }

        // ── Generate AI suggestion ───────────────────────────────────────────
        const dayLabel = fecha === today ? "hoy" : "mañana";
        const rival = session.rival ?? session.nombreRival;
        const prompt = buildPrompt(tipo, dayLabel, rival);

        let message: string;

        try {
          const result = await llm.generate<{ message: string }>({
            prompt,
            traceContext,
          });
          message =
            typeof result.data?.message === "string" && result.data.message.trim()
              ? result.data.message.trim()
              : fallbackMessage(tipo, dayLabel, rival);
        } catch (llmErr) {
          console.warn(
            `[proactiveEngine] LLM failed for uid=${uid} session=${sessionId}: ` +
            (llmErr as Error).message
          );
          message = fallbackMessage(tipo, dayLabel, rival);
        }

        // ── Write notification ───────────────────────────────────────────────
        const notif: ProactiveNotification = {
          message,
          type: notifType,
          generatedAt: new Date().toISOString(),
          read: false,
          sessionId,
          ...(session.teamId ? { teamId: session.teamId } : {}),
        };

        await notifRef.set(notif);
        notifications++;

        console.log(
          `[proactiveEngine] Notification written: uid=${uid} notifId=${notifId} type=${notifType}`
        );
      }

      processed++;
    } catch (err) {
      console.error(
        `[proactiveEngine] Error processing uid=${uid}: `,
        (err as Error).message
      );
      errors++;
    }
  }

  await observability.flush();

  const result: BriefingResult = { processed, notifications, errors, skipped };
  console.log("[proactiveEngine] Run complete:", result);
  return result;
}
