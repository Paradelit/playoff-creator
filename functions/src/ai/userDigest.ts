import type { Firestore } from "firebase-admin/firestore";
import { fetchMemoriesForDigest, MemoryType } from "./tools/memoryTools";

export interface UserDigest {
  teams: Array<{ id: string; name: string; categoria?: string; nivel?: string; memberCount: number }>;
  activeBrackets: Array<{ id: string; name: string; teamId?: string | null }>;
  upcomingSessions: Array<{
    id: string;
    fecha: string;
    horaInicio?: string;
    tipo?: string;
    teamName?: string;
    rival?: string;
    lugar?: string;
  }>;
  preferences: {
    proactivityMode?: string;
    defaultTrainingDuration?: number;
  };
  memories: Array<{ id: string; type: MemoryType; content: string }>;
  todayISO: string;
}

/**
 * Build a compact snapshot of the user's state for injection into the
 * orchestrator system prompt. Size target: ~1KB for typical accounts.
 */
export async function buildUserDigest(deps: {
  db: Firestore;
  userId: string;
  appId: string;
  clientDate?: string;
}): Promise<UserDigest> {
  const { db, userId, appId, clientDate } = deps;
  const base = db.collection("artifacts").doc(appId).collection("users").doc(userId);

  const todayISO = clientDate || new Date().toISOString().slice(0, 10);
  const sevenDaysFromNow = new Date(todayISO);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const toISO = sevenDaysFromNow.toISOString().slice(0, 10);

  const [teamsSnap, bracketsSnap, sessionsSnap, profileSnap, memories] = await Promise.all([
    base.collection("teams").get(),
    base.collection("brackets").get(),
    base
      .collection("calendarSessions")
      .where("fecha", ">=", todayISO)
      .where("fecha", "<=", toISO)
      .orderBy("fecha", "asc")
      .get(),
    base.collection("profile").doc("main").get(),
    fetchMemoriesForDigest(db, appId, userId, 15),
  ]);

  const teams = await Promise.all(
    teamsSnap.docs.map(async (d) => {
      const memSnap = await d.ref.collection("members").count().get();
      const data = d.data();
      return {
        id: d.id,
        name: (data.teamName as string) || "(sin nombre)",
        categoria: data.categoria as string | undefined,
        nivel: data.nivel as string | undefined,
        memberCount: memSnap.data().count,
      };
    })
  );

  const activeBrackets = bracketsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: (data.name as string) || (data.tournamentName as string) || "Playoff",
      teamId: (data.teamId as string | undefined) || null,
    };
  });

  const teamsById = new Map(teams.map((t) => [t.id, t.name]));
  const upcomingSessions = sessionsSnap.docs.slice(0, 15).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      fecha: (data.fecha as string) || "",
      horaInicio: (data.horaInicio as string) || undefined,
      tipo: (data.tipo as string) || undefined,
      teamName: data.teamId ? teamsById.get(data.teamId as string) : undefined,
      rival: (data.rival as string) || undefined,
      lugar: (data.lugar as string) || undefined,
    };
  });

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
