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
import { buildPendingConvocatorias } from "./digest/pendingConvocatorias";
import { buildPendingAnalysesAndScoutings } from "./digest/pendingAnalysesScoutings";
import { buildPendingPlayerReports } from "./digest/pendingPlayerReports";
import { buildPlayoffSessionsInRange } from "./digest/playoffSessions";
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
  PendingConvocatoria,
  PendingMatchAction,
  PendingActions,
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

  // PASS 2: sessions + brackets + profile + memorias + pending kinds en paralelo.
  // Playoff sessions virtuales (sub-C follow-up): se generan desde
  // bracketData.state porque NO viven en calendarSessions. Sin esto Pick
  // no sabía de partidos de playoff esta semana — bug detectado el 2026-05-15.
  const lookbackForPlayoffsISO = (() => {
    const d = new Date(todayISO);
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const lookaheadForPlayoffsISO = (() => {
    const d = new Date(todayISO);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const [
    activeBrackets,
    upcomingSessionsRaw,
    recentPastSessionsRaw,
    profileSnap,
    memories,
    pendingAnalysesScoutings,
    pendingPlayerReports,
    playoffSessionsInRange,
  ] = await Promise.all([
    buildBracketsDigest({ db, appId, wsId, scopedTeamIds }),
    buildUpcomingSessionsDigest({ db, appId, wsId, todayISO, teamsById, scopedTeamIds }),
    buildRecentPastSessionsDigest({ db, appId, wsId, todayISO, teamsById, scopedTeamIds }),
    userRoot.collection("profile").doc("main").get(),
    fetchMemoriesForDigest(db, appId, wsId, 15),
    buildPendingAnalysesAndScoutings({ db, appId, wsId, todayISO, teamsById, scopedTeamIds }),
    buildPendingPlayerReports({ db, appId, wsId, teamsById, scopedTeamIds }),
    buildPlayoffSessionsInRange({
      db,
      appId,
      wsId,
      fromISO: lookbackForPlayoffsISO,
      toISO: lookaheadForPlayoffsISO,
      teamsById,
      scopedTeamIds,
    }),
  ]);

  // Merge playoff virtuals con regular sessions, sort by fecha, cap a 15.
  // Para upcoming: fecha >= todayISO (incluye hoy). Para past: < todayISO.
  const upcomingPlayoffs = playoffSessionsInRange.filter((s) => s.fecha >= todayISO);
  const pastPlayoffs = playoffSessionsInRange.filter((s) => s.fecha < todayISO);
  const upcomingSessionsWithTid = [...upcomingSessionsRaw, ...upcomingPlayoffs]
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
      return (a.horaInicio || "").localeCompare(b.horaInicio || "");
    })
    .slice(0, 15);
  const recentPastSessionsWithTid = [...recentPastSessionsRaw, ...pastPlayoffs]
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha > b.fecha ? -1 : 1;
      return (b.horaInicio || "").localeCompare(a.horaInicio || "");
    })
    .slice(0, 15);

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

  // Pending convocatorias on-demand (sub-A.4a). Computa sobre los raw
  // sessions ya leídos — sin lectura extra de Firestore. Usa default 72h
  // de ventana porque convocatoriaReminderHours per-team es un edge case
  // que se difiere a un follow-up (YAGNI).
  const pendingConvocatorias = buildPendingConvocatorias({
    sessions: upcomingSessionsWithTid,
    reminderHoursByTeam: new Map(),
    now: new Date(),
  });

  // Strip teamId + convocatoriaSentAt from session objects before
  // exposing en UserDigest (no van al prompt).
  const upcomingSessions = upcomingSessionsWithTid.map(stripInternalFields);
  const recentPastSessions = recentPastSessionsWithTid.map(stripInternalFields);

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
    pendingActions: {
      convocatorias: pendingConvocatorias,
      scoutings: pendingAnalysesScoutings.pendingScoutings,
      analyses: pendingAnalysesScoutings.pendingAnalyses,
      playerReports: pendingPlayerReports,
    },
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

function stripInternalFields<T extends { teamId?: string; convocatoriaSentAt?: unknown }>(
  s: T
): Omit<T, "teamId" | "convocatoriaSentAt"> {
  const { teamId: _teamId, convocatoriaSentAt: _cs, ...rest } = s;
  void _teamId;
  void _cs;
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
    ? digest.activeBrackets
        .map((b) => {
          const lines = [`  - ${b.name} (id: ${b.id}, teamId: ${b.teamId || "?"})`];
          if (b.currentRound) {
            const pendingNote = b.pendingScores ? ` — ${b.pendingScores} sin decidir` : "";
            lines.push(`      Ronda actual: ${b.currentRound}${pendingNote}`);
          }
          if (b.nextMatch) {
            const dateSuffix = b.nextMatch.scheduled ? ` (${b.nextMatch.scheduled})` : "";
            lines.push(
              `      Siguiente: matchId=${b.nextMatch.id} ${b.nextMatch.teamA} vs ${b.nextMatch.teamB}${dateSuffix}`
            );
          }
          return lines.join("\n");
        })
        .join("\n")
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

  const pendingConvocatoriasStr = digest.pendingActions.convocatorias.length
    ? digest.pendingActions.convocatorias
        .map((p) => {
          const urgency = p.severity === "high" ? " ⚠️ <24h" : "";
          const rivalSuffix = p.rival ? ` vs ${p.rival}` : "";
          const teamSuffix = p.teamName ? ` (${p.teamName})` : "";
          return `  - sessionId=${p.sessionId} ${p.fecha} ${p.horaInicio || ""}${rivalSuffix}${teamSuffix}${urgency}`.trim();
        })
        .join("\n")
    : "  (ninguna)";

  const formatMatchPending = (p: { sessionId: string; fecha: string; teamName?: string; rival?: string }) => {
    const rivalSuffix = p.rival ? ` vs ${p.rival}` : "";
    const teamSuffix = p.teamName ? ` (${p.teamName})` : "";
    return `  - sessionId=${p.sessionId} ${p.fecha}${rivalSuffix}${teamSuffix}`.trim();
  };
  const pendingScoutingsStr = digest.pendingActions.scoutings.length
    ? digest.pendingActions.scoutings.map(formatMatchPending).join("\n")
    : "  (ninguno)";
  const pendingAnalysesStr = digest.pendingActions.analyses.length
    ? digest.pendingActions.analyses.map(formatMatchPending).join("\n")
    : "  (ninguno)";

  const pendingPlayerReportsStr = digest.pendingActions.playerReports.length
    ? digest.pendingActions.playerReports
        .map((p) => {
          const teamLabel = p.teamName ? ` (${p.teamName})` : "";
          const previewNames =
            p.missingPlayerNames.length > 0 ? ` — ${p.missingPlayerNames.slice(0, 5).join(", ")}${p.missingPlayerNames.length > 5 ? "..." : ""}` : "";
          return `  - teamId=${p.teamId}${teamLabel}: ${p.missingForPlayerCount} jugadores${previewNames}`;
        })
        .join("\n")
    : "  (ninguno)";

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

Convocatorias pendientes (partidos próximos sin convocatoria mandada):
${pendingConvocatoriasStr}

Scouting pendiente (próximos partidos en 14d sin scouting de rival):
${pendingScoutingsStr}

Análisis pendiente (partidos jugados últimos 21d sin análisis):
${pendingAnalysesStr}

Informes de jugador pendientes (por team, jugadores sin contenido en informe-jugadores):
${pendingPlayerReportsStr}

Memorias persistentes del entrenador:
${memoriesStr}
`.trim();
}
