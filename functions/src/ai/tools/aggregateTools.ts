import { ToolDefinition, ToolContext } from "./registry";
import { formatTeamDisplayName } from "../../shared/teamDomain";

/**
 * Aggregate read tools (sub-A.6) — querys de profundización que el digest
 * NO incluye en system prompt (caro/voluminoso) pero el LLM puede pedir
 * on-demand cuando el coach pregunta cosas como "qué resultados llevamos"
 * o "cómo está Pablo".
 *
 * Las 3 independientes (no requieren A.4b cache):
 *   - get_recent_results
 *   - get_attendance_summary
 *   - get_player_status
 *
 * Tools que SÍ dependerían de cache (get_pending_actions_detail,
 * get_team_health) se difieren a un follow-up cuando el deploy
 * de Firestore triggers esté desbloqueado por IAM.
 */

function workspaceRoot(ctx: ToolContext) {
  return ctx.db.doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}`);
}

function teamDoc(ctx: ToolContext, teamId: string) {
  return workspaceRoot(ctx).collection("teams").doc(teamId);
}

function userCol(ctx: ToolContext, collectionName: string) {
  return workspaceRoot(ctx).collection(collectionName);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoOffsetDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function teamNameFromData(data: Record<string, unknown>): string {
  return (
    formatTeamDisplayName({
      teamName: typeof data.teamName === "string" ? data.teamName : null,
      categoria: typeof data.categoria === "string" ? data.categoria : null,
      "año": typeof data["año"] === "string" ? data["año"] : null,
      letra: typeof data.letra === "string" ? data.letra : null,
      genero: typeof data.genero === "string" ? data.genero : null,
      division: typeof data.division === "string" ? data.division : null,
    }) || "(sin nombre)"
  );
}

interface SessionResultPoV {
  ourScore: number;
  theirScore: number;
}

function parseSessionResult(data: Record<string, unknown>): SessionResultPoV | null {
  const resultado = data.resultado as { local?: unknown; visitante?: unknown } | undefined;
  if (!resultado) return null;
  const local = Number(resultado.local);
  const visitante = Number(resultado.visitante);
  if (!Number.isFinite(local) || !Number.isFinite(visitante)) return null;
  const esLocal = data.esLocal as boolean | undefined;
  if (esLocal === undefined) return null;
  return {
    ourScore: esLocal ? local : visitante,
    theirScore: esLocal ? visitante : local,
  };
}

export function createAggregateTools(): ToolDefinition[] {
  return [
    {
      name: "get_recent_results",
      description:
        "Devuelve los últimos N partidos jugados con su resultado normalizado al PoV del coach (ourScore vs theirScore). Útil cuando el usuario pregunta 'cómo llevamos la temporada' o 'qué tal fue el último partido'. Si teamId se pasa, solo devuelve resultados de ese team. Por defecto agrega de todos los teams.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional. Filtra resultados a un team." },
          limit: { type: "integer", description: "Cuántos partidos. Default 10, max 30." },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const teamId = typeof args.teamId === "string" ? args.teamId : "";
        const limitRaw = typeof args.limit === "number" ? args.limit : 10;
        const limit = Math.max(1, Math.min(30, limitRaw));

        const today = todayISO();
        let query = userCol(ctx, "calendarSessions")
          .where("tipo", "==", "partido")
          .where("fecha", "<", today)
          .orderBy("fecha", "desc")
          .limit(limit);
        // Firestore no permite combinar where igualdad sobre `teamId` con
        // where range sobre fecha + orderBy sin index compuesto extra.
        // Si teamId está, filtramos in-memory tras leer (limit más amplio).
        if (teamId) {
          query = userCol(ctx, "calendarSessions")
            .where("tipo", "==", "partido")
            .where("fecha", "<", today)
            .orderBy("fecha", "desc")
            .limit(limit * 3);
        }

        const snap = await query.get();
        let docs = snap.docs;
        if (teamId) docs = docs.filter((d) => d.data().teamId === teamId).slice(0, limit);

        // Build a teamsById map (lazy) for join. Si teamId está, podemos
        // saltar el join salvo para tener nombre del partido — leemos el
        // doc del team. Si no, list_teams en paralelo.
        const teamIds = new Set(docs.map((d) => d.data().teamId).filter((t): t is string => typeof t === "string"));
        const teamsById = new Map<string, string>();
        if (teamIds.size > 0) {
          const teamSnaps = await Promise.all(
            Array.from(teamIds).map((tid) => teamDoc(ctx, tid).get())
          );
          for (const ts of teamSnaps) {
            if (ts.exists) teamsById.set(ts.id, teamNameFromData(ts.data() || {}));
          }
        }

        const results = docs.map((d) => {
          const data = d.data();
          const result = parseSessionResult(data);
          return {
            sessionId: d.id,
            fecha: (data.fecha as string) || "",
            teamId: (data.teamId as string) || undefined,
            teamName: data.teamId ? teamsById.get(data.teamId as string) : undefined,
            rival: (data.rival as string) || undefined,
            esLocal: (data.esLocal as boolean) || undefined,
            result, // null si no se introdujo resultado
          };
        });

        return { count: results.length, results };
      },
    },

    {
      name: "get_attendance_summary",
      description:
        "Agregado de asistencia por jugador en las últimas N semanas para un team. Útil para detectar patrones (jugador que falta repetido) o resumir la asistencia general. Devuelve por jugador: count de Faltas (F), Retrasos (r+R), Mala actitud (-), Lesionado (L+/L), y sesiones totales en la ventana.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Requerido." },
          weeks: { type: "integer", description: "Cuántas semanas hacia atrás. Default 4, max 12." },
        },
        required: ["teamId"],
      },
      handler: async (args, ctx) => {
        const teamId = typeof args.teamId === "string" ? args.teamId : "";
        if (!teamId) return { error: "Falta teamId." };
        const weeksRaw = typeof args.weeks === "number" ? args.weeks : 4;
        const weeks = Math.max(1, Math.min(12, weeksRaw));

        const today = todayISO();
        const fromISO = isoOffsetDays(today, -7 * weeks);

        const [attendanceSnap, membersSnap, sessionsSnap] = await Promise.all([
          teamDoc(ctx, teamId).collection("cuaderno").doc("asistencia").get(),
          teamDoc(ctx, teamId).collection("members").get(),
          userCol(ctx, "calendarSessions")
            .where("teamId", "==", teamId)
            .where("fecha", ">=", fromISO)
            .where("fecha", "<", today)
            .get(),
        ]);

        const attendanceMap = (
          attendanceSnap.exists
            ? ((attendanceSnap.data() as { attendance?: Record<string, Record<string, string>> })
                .attendance || {})
            : {}
        );

        interface MemberRecord {
          id: string;
          tipo?: string;
          nombre?: string;
          dorsal?: string | number;
          [k: string]: unknown;
        }
        const players: MemberRecord[] = membersSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as MemberRecord)
          .filter((m) => (m.tipo || "jugador") === "jugador");

        const sessionIdsInWindow = new Set(sessionsSnap.docs.map((d) => d.id));
        const totalSessionsInWindow = sessionIdsInWindow.size;

        const summary = players.map((p) => {
          let F = 0;
          let R = 0; // r + R
          let minus = 0;
          let lesionado = 0;
          for (const sessionId of sessionIdsInWindow) {
            const code = attendanceMap[sessionId]?.[p.id];
            if (!code) continue;
            if (code === "F") F += 1;
            else if (code === "r" || code === "R") R += 1;
            else if (code === "-") minus += 1;
            else if (code === "L" || code === "L+") lesionado += 1;
          }
          return {
            playerId: p.id,
            nombre: (p.nombre as string) || "(sin nombre)",
            dorsal: (p.dorsal as string | number) || undefined,
            F,
            R,
            "-": minus,
            lesionado,
          };
        });

        // Orden: jugadores con más F primero (más relevantes para el coach).
        summary.sort((a, b) => b.F - a.F || b.R - a.R);

        return {
          teamId,
          weeks,
          totalSessionsInWindow,
          summary,
        };
      },
    },

    {
      name: "get_player_status",
      description:
        "Estado consolidado de un jugador: nombre, dorsal, asistencia reciente (4 semanas), último informe disponible, último test de tiro. Útil cuando el coach pregunta 'cómo está Pablo' o 'qué pasa con el #4'. Requiere teamId y playerId.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Requerido." },
          playerId: { type: "string", description: "Requerido — id del member doc dentro del team." },
        },
        required: ["teamId", "playerId"],
      },
      handler: async (args, ctx) => {
        const teamId = typeof args.teamId === "string" ? args.teamId : "";
        const playerId = typeof args.playerId === "string" ? args.playerId : "";
        if (!teamId) return { error: "Falta teamId." };
        if (!playerId) return { error: "Falta playerId." };

        const today = todayISO();
        const fromISO = isoOffsetDays(today, -28); // 4 semanas

        const [playerSnap, attendanceSnap, sessionsSnap, informeSnap, shootingSnap] = await Promise.all([
          teamDoc(ctx, teamId).collection("members").doc(playerId).get(),
          teamDoc(ctx, teamId).collection("cuaderno").doc("asistencia").get(),
          userCol(ctx, "calendarSessions")
            .where("teamId", "==", teamId)
            .where("fecha", ">=", fromISO)
            .where("fecha", "<", today)
            .get(),
          teamDoc(ctx, teamId).collection("cuaderno").doc("informe-jugadores").get(),
          teamDoc(ctx, teamId).collection("cuaderno").doc("test-tiro").get(),
        ]);

        if (!playerSnap.exists) return { error: "Jugador no encontrado." };
        const player = playerSnap.data() || {};

        // Attendance summary últimas 4 semanas
        const attendanceMap = (
          attendanceSnap.exists
            ? ((attendanceSnap.data() as { attendance?: Record<string, Record<string, string>> })
                .attendance || {})
            : {}
        );
        const sessionIds = sessionsSnap.docs.map((d) => d.id);
        let F = 0;
        let R = 0;
        let minus = 0;
        let lesionado = 0;
        for (const sessionId of sessionIds) {
          const code = attendanceMap[sessionId]?.[playerId];
          if (!code) continue;
          if (code === "F") F += 1;
          else if (code === "r" || code === "R") R += 1;
          else if (code === "-") minus += 1;
          else if (code === "L" || code === "L+") lesionado += 1;
        }

        // Informe row (busca en el informe-jugadores doc — shape:
        // { rows: [{ id, nombre, ... }, ...], observaciones }).
        const informeData = informeSnap.exists ? (informeSnap.data() || {}) : {};
        const rows = Array.isArray(informeData.rows) ? (informeData.rows as Array<Record<string, unknown>>) : [];
        const informeRow =
          rows.find((r) => r.id === playerId) ||
          rows.find(
            (r) =>
              typeof r.nombre === "string" &&
              typeof player.nombre === "string" &&
              r.nombre.trim().toLowerCase() === (player.nombre as string).trim().toLowerCase()
          ) ||
          null;

        // Shooting test row (mismo patrón).
        const shootingData = shootingSnap.exists ? (shootingSnap.data() || {}) : {};
        const shootingRows = Array.isArray(shootingData.rows)
          ? (shootingData.rows as Array<Record<string, unknown>>)
          : [];
        const shootingRow =
          shootingRows.find((r) => r.id === playerId) ||
          shootingRows.find(
            (r) =>
              typeof r.nombre === "string" &&
              typeof player.nombre === "string" &&
              r.nombre.trim().toLowerCase() === (player.nombre as string).trim().toLowerCase()
          ) ||
          null;

        return {
          teamId,
          playerId,
          nombre: (player.nombre as string) || "(sin nombre)",
          dorsal: (player.dorsal as string | number) || undefined,
          posicion: (player.posicion as string) || undefined,
          fechaNacimiento: (player.fechaNacimiento as string) || undefined,
          attendance4w: {
            sessionsInWindow: sessionIds.length,
            F,
            R,
            "-": minus,
            lesionado,
          },
          informeRow,
          shootingRow,
        };
      },
    },
  ];
}
