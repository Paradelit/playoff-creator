import type { Firestore } from "firebase-admin/firestore";
import { fetchMemoriesForDigest } from "./tools/memoryTools";
import { buildTeamsDigest } from "./digest/teamsDigest";
import { buildBracketsDigest } from "./digest/bracketsDigest";
import { buildUpcomingSessionsDigest } from "./digest/calendarDigest";
import type { UserDigest } from "./digest/types";

export type {
  UserDigest,
  DigestTeam,
  DigestBracket,
  DigestSession,
  DigestMemory,
  DigestPreferences,
} from "./digest/types";

/**
 * Build a compact snapshot of the workspace's state for injection into the
 * orchestrator system prompt. Size target: ~1KB for typical accounts.
 *
 * Workspace-scoped data (teams, brackets, sessions, memories) reads from
 * `workspaces/{wsId}/...`. User preferences persist on `profile/main` under
 * the user-private namespace `users/{uid}/profile/main` and are read from
 * there — they were never migrated to the workspace.
 *
 * Cada builder vive en su propio archivo (`digest/teamsDigest.ts`,
 * `digest/bracketsDigest.ts`, `digest/calendarDigest.ts`) tras el split de
 * sub-A.1. Este orquestador compone los 5 reads en paralelo y une
 * teams ↔ sessions via `teamsById`.
 */
export async function buildUserDigest(deps: {
  db: Firestore;
  userId: string;
  wsId: string;
  appId: string;
  clientDate?: string;
}): Promise<UserDigest> {
  const { db, userId, wsId, appId, clientDate } = deps;
  const userRoot = db.collection("artifacts").doc(appId).collection("users").doc(userId);

  const todayISO = clientDate || new Date().toISOString().slice(0, 10);

  // Teams first so we can build teamsById for the calendar join.
  const teams = await buildTeamsDigest({ db, appId, wsId });
  const teamsById = new Map(teams.map((t) => [t.id, t.name]));

  const [activeBrackets, upcomingSessions, profileSnap, memories] = await Promise.all([
    buildBracketsDigest({ db, appId, wsId }),
    buildUpcomingSessionsDigest({ db, appId, wsId, todayISO, teamsById }),
    userRoot.collection("profile").doc("main").get(),
    fetchMemoriesForDigest(db, appId, wsId, 15),
  ]);

  const profile = profileSnap.exists ? profileSnap.data() || {} : {};

  return {
    teams,
    activeBrackets,
    upcomingSessions,
    preferences: {
      proactivityMode: profile.proactivityMode as string | undefined,
      defaultTrainingDuration: profile.defaultTrainingDuration as number | undefined,
    },
    memories,
    todayISO,
  };
}

/** Render digest as a compact text block for the system prompt. */
export function digestToPromptText(digest: UserDigest): string {
  const teamsStr = digest.teams.length
    ? digest.teams
        .map((t) => `  - ${t.name} (id: ${t.id}, categoría: ${t.categoria || "?"}, ${t.memberCount} miembros)`)
        .join("\n")
    : "  (sin equipos)";

  const bracketsStr = digest.activeBrackets.length
    ? digest.activeBrackets.map((b) => `  - ${b.name} (id: ${b.id}, teamId: ${b.teamId || "?"})`).join("\n")
    : "  (sin brackets activos)";

  const sessionsStr = digest.upcomingSessions.length
    ? digest.upcomingSessions
        .map(
          (s) =>
            `  - ${s.fecha} ${s.horaInicio || ""} ${s.tipo || ""} ${s.teamName || ""}${
              s.rival ? ` vs ${s.rival}` : ""
            } ${s.lugar || ""}`.trim()
        )
        .join("\n")
    : "  (sin sesiones en los próximos 7 días)";

  const memoriesStr = digest.memories.length
    ? digest.memories.map((m) => `  - [${m.type}] ${m.content}`).join("\n")
    : "  (sin memorias guardadas)";

  return `
CONTEXTO DEL USUARIO (hoy: ${digest.todayISO}):

Equipos del entrenador:
${teamsStr}

Brackets activos:
${bracketsStr}

Próximas sesiones (7 días):
${sessionsStr}

Memorias persistentes del entrenador:
${memoriesStr}
`.trim();
}
