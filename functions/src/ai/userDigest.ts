import type { Firestore } from "firebase-admin/firestore";
import { fetchMemoriesForDigest } from "./tools/memoryTools";
import { buildTeamsDigest } from "./digest/teamsDigest";
import { buildBracketsDigest } from "./digest/bracketsDigest";
import {
  buildUpcomingSessionsDigest,
  buildRecentPastSessionsDigest,
  groupSessionsByTeamId,
} from "./digest/calendarDigest";
import { resolveScopedTeamIds, type MemberScope } from "./digest/scoping";
import type { UserDigest, UserRole } from "./digest/types";

export type {
  UserDigest,
  DigestTeam,
  DigestBracket,
  DigestSession,
  DigestMemory,
  DigestPreferences,
  DigestWorkspace,
  UserRole,
  RosterPlayer,
  MatchResult,
} from "./digest/types";

const DAY_OF_WEEK_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function localDayOfWeek(iso: string): string {
  // Construct date with explicit yyyy-mm-dd parsing — avoids TZ issues that
  // make new Date("2026-05-16") report different days on UTC vs local.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  return DAY_OF_WEEK_ES[dt.getUTCDay()] || "";
}

/**
 * Optional observability hook accepted by `buildUserDigest`. Matches the
 * shape of `ObservabilityService.logScore` so callers can pass the service
 * directly (or a stub in tests).
 */
export interface DigestObservability {
  logScore: (
    traceId: string,
    score: { name: string; value: number; comment?: string }
  ) => void;
}

/**
 * Build a compact snapshot of the workspace's state for injection into the
 * orchestrator system prompt.
 *
 * Workspace-scoped data (teams, brackets, sessions, memories) reads from
 * `workspaces/{wsId}/...`. User preferences persist on `profile/main` under
 * the user-private namespace `users/{uid}/profile/main` and are read from
 * there — they were never migrated to the workspace.
 *
 * Sub-A.2 + A.3 cambios:
 * - Resuelve role + assignedTeamIds desde `members/{uid}` antes de leer.
 * - Filtra teams/brackets/sessions por scope (asistente con assignedTeamIds
 *   ve sólo sus teams; owner/coach ve todo).
 * - Lee workspace doc para exponer `workspace.{name, type}` + `userRole`.
 * - Añade `todayLocalDayOfWeek` (útil para resolver "el sábado").
 * - Enriquece teams con rosterSnapshot, nextSession, lastResult.
 * - Añade `recentPastSessions` (últimos 7d con `result` normalizado).
 *
 * When `observability` and `traceId` are provided, two baseline scores are
 * logged per call: `digest_build_ms` (wall-clock duration) and
 * `digest_size_tokens` (~chars/4 of the rendered prompt text). These feed
 * the sub-A.0 baseline used to measure the AI chat priority program.
 */
export async function buildUserDigest(deps: {
  db: Firestore;
  userId: string;
  wsId: string;
  appId: string;
  clientDate?: string;
  observability?: DigestObservability;
  traceId?: string;
}): Promise<UserDigest> {
  const { db, userId, wsId, appId, clientDate, observability, traceId } = deps;
  const t0 = Date.now();
  const base = db.collection("artifacts").doc(appId).collection("workspaces").doc(wsId);
  const userRoot = db.collection("artifacts").doc(appId).collection("users").doc(userId);

  const todayISO = clientDate || new Date().toISOString().slice(0, 10);

  // 1. Role + scope desde members/{uid} + workspace meta.
  const [memberSnap, wsSnap] = await Promise.all([
    base.collection("members").doc(userId).get(),
    base.get(),
  ]);
  const memberData = memberSnap.exists ? memberSnap.data() || {} : {};
  const role: UserRole = (memberData.role as UserRole) || "assistant";
  const assignedTeamIds = Array.isArray(memberData.assignedTeamIds)
    ? (memberData.assignedTeamIds as string[])
    : null;
  const scope: MemberScope = { role, assignedTeamIds };
  const scopedTeamIds = resolveScopedTeamIds(scope);

  const wsData = wsSnap.exists ? wsSnap.data() || {} : {};

  // 2. Teams (filtrados por scope ANTES de leer members de cada team).
  //    Para enriquecer con nextSession/lastResult, primero necesitamos las
  //    sessions filtradas. Orden:
  //    a) Lee sessions (upcoming + past) con scope aplicado.
  //    b) Construye teamsByIdInferred desde session.teamId — pero teamName
  //       todavía sin resolver. No vale.
  //    Mejor:
  //    a) Lee teams (sin enriquecer) para construir teamsById.
  //    b) Lee sessions con teamsById ya poblado.
  //    c) Agrupa sessions by teamId.
  //    d) Re-llama buildTeamsDigest con los maps — o pasa los maps al primer
  //       call. Lo segundo es lo que hacemos: una sola lectura de teams.
  //
  //    Problema: si scope filtra teams, las sessions del mismo scope no
  //    apuntan a teams excluidos. OK. Pero si scope=null (owner/DT), no
  //    hay filtro y todo entra. OK.
  //
  //    Simplificación: leer teams primero, luego sessions paralelizadas, en
  //    el segundo pase re-construir DigestTeam con enriquecimiento via los
  //    maps. La doble lectura del members sub-collection sólo ocurre 1 vez
  //    porque buildTeamsDigest lee members. Esto es OK porque sólo se llama
  //    una vez con los maps al final.

  // PASS 1: teams sin enriquecer, solo para teamsById.
  const teamsBare = await buildTeamsDigest({ db, appId, wsId, scopedTeamIds });
  const teamsById = new Map(teamsBare.map((t) => [t.id, t.name]));

  // PASS 2: sessions + brackets + profile + memorias paralelamente.
  const [activeBrackets, upcomingSessionsWithTid, recentPastSessionsWithTid, profileSnap, memories] =
    await Promise.all([
      buildBracketsDigest({ db, appId, wsId, scopedTeamIds }),
      buildUpcomingSessionsDigest({ db, appId, wsId, todayISO, teamsById, scopedTeamIds }),
      buildRecentPastSessionsDigest({ db, appId, wsId, todayISO, teamsById, scopedTeamIds }),
      userRoot.collection("profile").doc("main").get(),
      fetchMemoriesForDigest(db, appId, wsId, 15),
    ]);

  const upcomingByTeam = groupSessionsByTeamId(upcomingSessionsWithTid);
  const recentByTeam = groupSessionsByTeamId(recentPastSessionsWithTid);

  // PASS 3: re-enriquece teams con next/last derivado de las sessions.
  //   Reusa los reads de members ya hechos? No — sería complejo. Hacemos un
  //   segundo call con los maps. Esto duplica el read de members del team,
  //   pero es un trade-off aceptable por simplicidad. Si fuera caliente,
  //   se podría cachear en pass 1.
  //
  //   Optimización pragmática: si scope filtra a 0 teams, no reenriquecer.
  const teams =
    teamsBare.length === 0
      ? teamsBare
      : await buildTeamsDigest({
          db,
          appId,
          wsId,
          scopedTeamIds,
          upcomingSessionsByTeam: upcomingByTeam,
          recentPastSessionsByTeam: recentByTeam,
        });

  // Strip teamId from session objects before exposing in UserDigest.
  const upcomingSessions = upcomingSessionsWithTid.map(stripTeamId);
  const recentPastSessions = recentPastSessionsWithTid.map(stripTeamId);

  const profile = profileSnap.exists ? profileSnap.data() || {} : {};

  const digest: UserDigest = {
    todayISO,
    todayLocalDayOfWeek: localDayOfWeek(todayISO),
    workspace: {
      id: wsId,
      name: (wsData.name as string) || wsId,
      type: (wsData.type as "personal" | "club") || "personal",
      userRole: role,
    },
    teams,
    activeBrackets,
    upcomingSessions,
    recentPastSessions,
    preferences: {
      proactivityMode: profile.proactivityMode as string | undefined,
      defaultTrainingDuration: profile.defaultTrainingDuration as number | undefined,
    },
    memories,
  };

  if (observability && traceId) {
    observability.logScore(traceId, {
      name: "digest_build_ms",
      value: Date.now() - t0,
    });
    // ~chars/4 is a rough but stable proxy for tokens — good enough for
    // tracking distribution + alerting on bloat. We avoid a real tokenizer
    // here to keep buildUserDigest dependency-free.
    observability.logScore(traceId, {
      name: "digest_size_tokens",
      value: Math.ceil(digestToPromptText(digest).length / 4),
    });
  }

  return digest;
}

function stripTeamId<T extends { teamId?: string }>(s: T): Omit<T, "teamId"> {
  const { teamId: _teamId, ...rest } = s;
  void _teamId;
  return rest;
}

/** Render digest as a compact text block for the system prompt. */
export function digestToPromptText(digest: UserDigest): string {
  const teamsStr = digest.teams.length
    ? digest.teams
        .map((t) => {
          const lines = [
            `  - ${t.name} (id: ${t.id}, categoría: ${t.categoria || "?"}, ${t.memberCount} miembros)`,
          ];
          if (t.rosterSnapshot && t.rosterSnapshot.length > 0) {
            const roster = t.rosterSnapshot
              .map((p) => `${p.dorsal ? `#${p.dorsal} ` : ""}${p.nombre}${p.posicion ? ` (${p.posicion})` : ""}`)
              .join(", ");
            lines.push(`      Plantilla: ${roster}`);
          }
          if (t.nextSession) {
            lines.push(
              `      Próximo: ${t.nextSession.fecha} ${t.nextSession.tipo || ""}${
                t.nextSession.rival ? ` vs ${t.nextSession.rival}` : ""
              }`.trimEnd()
            );
          }
          if (t.lastResult) {
            lines.push(
              `      Último resultado: ${t.lastResult.fecha} ${t.lastResult.ourScore}-${t.lastResult.theirScore}${
                t.lastResult.rival ? ` vs ${t.lastResult.rival}` : ""
              }`
            );
          }
          return lines.join("\n");
        })
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

  const recentStr = digest.recentPastSessions.length
    ? digest.recentPastSessions
        .map((s) => {
          const head = `  - ${s.fecha} ${s.tipo || ""} ${s.teamName || ""}${
            s.rival ? ` vs ${s.rival}` : ""
          }`.trim();
          return s.result ? `${head} → ${s.result.ourScore}-${s.result.theirScore}` : head;
        })
        .join("\n")
    : "  (sin sesiones pasadas en los últimos 7 días)";

  const memoriesStr = digest.memories.length
    ? digest.memories.map((m) => `  - [${m.type}] ${m.content}`).join("\n")
    : "  (sin memorias guardadas)";

  const wsLine = `${digest.workspace.name} (${digest.workspace.type}, tu rol: ${digest.workspace.userRole})`;

  return `
CONTEXTO DEL USUARIO (hoy: ${digest.todayISO} ${digest.todayLocalDayOfWeek}):

Workspace activo: ${wsLine}

Equipos del entrenador:
${teamsStr}

Brackets activos:
${bracketsStr}

Próximas sesiones (7 días):
${sessionsStr}

Sesiones pasadas recientes (7 días):
${recentStr}

Memorias persistentes del entrenador:
${memoriesStr}
`.trim();
}
