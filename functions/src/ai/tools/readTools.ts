import { ToolDefinition, ToolContext } from "./registry";
import { formatTeamDisplayName } from "../../shared/teamDomain";
import { renderConvocatoria, SessionShape, TeamShape, CompetitionShape } from "../../shared/convocatoriaTemplate";

function userCol(ctx: ToolContext, collectionName: string) {
  return ctx.db
    .collection("artifacts").doc(ctx.appId)
    .collection("workspaces").doc(ctx.wsId)
    .collection(collectionName);
}

function teamSubCol(ctx: ToolContext, teamId: string, collectionName: string) {
  return ctx.db
    .collection("artifacts").doc(ctx.appId)
    .collection("workspaces").doc(ctx.wsId)
    .collection("teams").doc(teamId)
    .collection(collectionName);
}

function resolveId(
  args: Record<string, unknown>,
  ctx: ToolContext,
  key: "teamId" | "sessionId" | "bracketId"
): string {
  const fromArg = args[key];
  if (typeof fromArg === "string" && fromArg) return fromArg;
  const fromCtx = ctx.defaults?.[key];
  if (fromCtx) return fromCtx;
  return "";
}

function teamNameFromData(data: Record<string, unknown>): string {
  return formatTeamDisplayName({
    teamName: typeof data.teamName === "string" ? data.teamName : null,
    categoria: typeof data.categoria === "string" ? data.categoria : null,
    "año": typeof data["año"] === "string" ? data["año"] : null,
    letra: typeof data.letra === "string" ? data.letra : null,
    genero: typeof data.genero === "string" ? data.genero : null,
    division: typeof data.division === "string" ? data.division : null,
  }) || "(sin nombre)";
}

export function createReadTools(): ToolDefinition[] {
  return [
    {
      name: "list_teams",
      description:
        "Lista todos los equipos del entrenador con su categoría, nivel y número de miembros. Úsalo cuando el usuario pregunte por 'mis equipos' o necesites identificar un equipo por nombre.",
      parameters: { type: "object", properties: {}, required: [] },
      renderAs: "team_list",
      handler: async (_args, ctx) => {
        const snap = await userCol(ctx, "teams").get();
        const teams = await Promise.all(
          snap.docs.map(async (d) => {
            const memSnap = await teamSubCol(ctx, d.id, "members").count().get();
            const data = d.data();
            return {
              id: d.id,
              name: teamNameFromData(data),
              categoria: data.categoria || "",
              nivel: data.nivel || "",
              memberCount: memSnap.data().count,
            };
          })
        );
        return { teams };
      },
    },

    {
      name: "get_team",
      description:
        "Devuelve los detalles completos de un equipo: plantilla (jugadores + staff), categoría y nivel. Si el usuario ya está viendo un equipo, puedes omitir teamId (se infiere de la pantalla). Si no, llama primero a list_teams.",
      parameters: {
        type: "object",
        properties: { teamId: { type: "string", description: "ID del equipo (opcional si el usuario ya está viendo un equipo)" } },
        required: [],
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId. Llama a list_teams primero o pregunta al usuario." };
        const teamSnap = await ctx.db
          .doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${teamId}`).get();
        if (!teamSnap.exists) return { error: "Equipo no encontrado" };
        const memSnap = await teamSubCol(ctx, teamId, "members").get();
        const members = memSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            tipo: data.tipo || "jugador",
            nombre: data.nombre || "",
            dorsal: data.dorsal || "",
            posicion: data.posicion || "",
            rol: data.rol || "",
          };
        });
        const team = teamSnap.data() || {};
        return {
          id: teamId,
          name: teamNameFromData(team),
          categoria: team.categoria,
          nivel: team.nivel,
          members,
        };
      },
    },

    {
      name: "list_exercises",
      description:
        "Lista la biblioteca de ejercicios del entrenador. Úsalo cuando el usuario pida ejercicios guardados, favoritos o quiera reutilizar contenidos.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Máximo a devolver (default 20)" },
          favoritesOnly: { type: "boolean", description: "Filtra solo favoritos" },
          search: { type: "string", description: "Texto libre para filtrar por nombre, tags o contenido" },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const limit = Math.min(Number(args.limit) || 20, 50);
        const search = typeof args.search === "string" ? args.search.trim().toLowerCase() : "";
        const snap = await userCol(ctx, "exercises").get();
        let exercises = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
        if (args.favoritesOnly) exercises = exercises.filter((ex) => ex.favorite === true);
        if (search) {
          exercises = exercises.filter((ex) => {
            const haystack = [
              ex.nombre,
              ex.descripcion,
              ex.contenido,
              ...(Array.isArray(ex.tags) ? ex.tags : []),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return haystack.includes(search);
          });
        }
        return {
          exercises: exercises.slice(0, limit).map((ex) => ({
            id: ex.id,
            nombre: ex.nombre || "",
            favorite: ex.favorite === true,
            tags: Array.isArray(ex.tags) ? ex.tags : [],
            updatedAt:
              ex.updatedAt &&
              typeof ex.updatedAt === "object" &&
              typeof (ex.updatedAt as { toMillis?: () => number }).toMillis === "function"
                ? (ex.updatedAt as { toMillis: () => number }).toMillis()
                : null,
          })),
        };
      },
    },

    {
      name: "get_exercise",
      description:
        "Devuelve el contenido completo de un ejercicio de la biblioteca por id.",
      parameters: {
        type: "object",
        properties: {
          exerciseId: { type: "string", description: "ID del ejercicio" },
        },
        required: ["exerciseId"],
      },
      handler: async (args, ctx) => {
        const exerciseId = String(args.exerciseId || "");
        if (!exerciseId) return { error: "Falta exerciseId." };
        const snap = await ctx.db
          .doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/exercises/${exerciseId}`).get();
        if (!snap.exists) return { error: "Ejercicio no encontrado" };
        return { id: exerciseId, ...snap.data() };
      },
    },

    {
      name: "list_trainings",
      description:
        "Lista los entrenamientos guardados de un equipo, ordenados por fecha descendente. Útil para responder 'qué entrenamientos hay', encontrar uno reciente, o ver qué ha hecho el equipo. Si el usuario ya está en un equipo, teamId se infiere de la pantalla.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "ID del equipo (opcional si el usuario ya está viendo un equipo)" },
          limit: { type: "integer", description: "Máximo a devolver (default 20)" },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId. Llama a list_teams primero o pregunta al usuario." };
        const limit = Math.min(Number(args.limit) || 20, 50);
        const snap = await teamSubCol(ctx, teamId, "trainings").get();
        const trainings = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.meta?.titulo || `Sesión ${data.meta?.fecha || d.id}`,
              fecha: data.meta?.fecha || "",
              duracion: data.meta?.duracion || null,
              ejerciciosCount: Array.isArray(data.ejercicios) ? data.ejercicios.length : 0,
            };
          })
          .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
          .slice(0, limit);
        return { trainings };
      },
    },

    {
      name: "get_training",
      description:
        "Devuelve el contenido completo de un entrenamiento (ejercicios, duración, notas). Úsalo cuando el usuario pregunte por una sesión concreta. teamId puede omitirse si se infiere de la pantalla.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si el usuario ya está en un equipo" },
          trainingId: { type: "string" },
        },
        required: ["trainingId"],
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        const trainingId = String(args.trainingId);
        const snap = await ctx.db
          .doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${teamId}/trainings/${trainingId}`).get();
        if (!snap.exists) return { error: "Entrenamiento no encontrado" };
        return { id: trainingId, ...snap.data() };
      },
    },

    {
      name: "list_calendar_sessions",
      description:
        "Lista sesiones del calendario (entrenamientos y partidos) en un rango de fechas. Ideal para '¿qué tengo esta semana?', 'próximos partidos', etc. Formato de fechas: YYYY-MM-DD.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Fecha inicial YYYY-MM-DD" },
          to: { type: "string", description: "Fecha final YYYY-MM-DD" },
          teamId: { type: "string", description: "Filtrar por equipo (opcional)" },
          tipo: { type: "string", enum: ["entrenamiento", "partido"], description: "Filtrar por tipo (opcional)" },
        },
        required: ["from", "to"],
      },
      handler: async (args, ctx) => {
        const from = String(args.from);
        const to = String(args.to);
        let q = userCol(ctx, "calendarSessions")
          .where("fecha", ">=", from)
          .where("fecha", "<=", to)
          .orderBy("fecha", "asc");
        const snap = await q.get();
        let sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
        const teamFilter = (typeof args.teamId === "string" && args.teamId) || ctx.defaults?.teamId;
        if (teamFilter) sessions = sessions.filter((s) => s.teamId === teamFilter);
        if (args.tipo) sessions = sessions.filter((s) => s.tipo === args.tipo);
        return { sessions: sessions.slice(0, 50) };
      },
    },

    {
      name: "list_brackets",
      description:
        "Lista los cuadros de playoffs del usuario con nombre, equipo asociado y estado. Si el usuario menciona un torneo o playoff, úsalo para localizarlo.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Filtrar por equipo (opcional)" },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const snap = await userCol(ctx, "brackets").get();
        let brackets = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || data.tournamentName || "Playoff",
            teamId: data.teamId || null,
            myTeam: data.myTeam || null,
            createdAt: data.createdAt?.toMillis?.() || null,
          };
        });
        const teamFilter = (typeof args.teamId === "string" && args.teamId) || ctx.defaults?.teamId;
        if (teamFilter) brackets = brackets.filter((b) => b.teamId === teamFilter);
        return { brackets };
      },
    },

    {
      name: "get_bracket",
      description:
        "Devuelve el estado completo de un cuadro de playoffs: rondas, partidos, resultados. Úsalo cuando el usuario pregunte detalles de un torneo. Si el usuario ya está viendo un bracket, bracketId se infiere.",
      parameters: {
        type: "object",
        properties: { bracketId: { type: "string", description: "Opcional si el usuario ya está viendo un bracket" } },
        required: [],
      },
      handler: async (args, ctx) => {
        const bracketId = resolveId(args, ctx, "bracketId");
        if (!bracketId) return { error: "Falta bracketId. Llama a list_brackets primero." };
        const snap = await ctx.db
          .doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/brackets/${bracketId}`).get();
        if (!snap.exists) return { error: "Bracket no encontrado" };
        const data = snap.data() || {};
        if (typeof data.shareCode === "string" && data.shareCode) {
          const sharedSnap = await ctx.db
            .doc(`artifacts/${ctx.appId}/shared/${data.shareCode}`).get();
          if (sharedSnap.exists) {
            return { id: bracketId, ...data, ...sharedSnap.data(), isShared: true };
          }
        }
        return { id: bracketId, ...data };
      },
    },

    {
      name: "get_bracket_share_config",
      description:
        "Lee la configuración de compartición de un bracket (owner, linkAccess, invitados). Úsalo cuando el usuario pregunte quién puede acceder o editar.",
      parameters: {
        type: "object",
        properties: { bracketId: { type: "string", description: "Opcional si se infiere de la pantalla" } },
        required: [],
      },
      handler: async (args, ctx) => {
        const bracketId = resolveId(args, ctx, "bracketId");
        if (!bracketId) return { error: "Falta bracketId." };
        const snap = await ctx.db
          .doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/brackets/${bracketId}`).get();
        if (!snap.exists) return { error: "Bracket no encontrado" };
        const data = snap.data() || {};
        if (!data.shareCode) return { bracketId, shared: false };
        const sharedSnap = await ctx.db.doc(`artifacts/${ctx.appId}/shared/${data.shareCode}`).get();
        if (!sharedSnap.exists) return { bracketId, shared: false, shareCode: data.shareCode };
        const shareConfig = sharedSnap.data()?.shareConfig || {};
        return {
          bracketId,
          shared: true,
          shareCode: data.shareCode,
          shareConfig,
        };
      },
    },

    {
      name: "get_cuaderno_section",
      description:
        "Lee una sección del cuaderno del equipo: 'jugadores' (jugadores interesantes), 'test-tiro', 'notas', 'pilares', 'normas'. teamId puede omitirse si se infiere de la pantalla.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si el usuario está viendo un equipo" },
          section: {
            type: "string",
            enum: ["jugadores", "test-tiro", "notas", "pilares", "normas"],
          },
        },
        required: ["section"],
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        const section = String(args.section);
        const snap = await ctx.db
          .doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${teamId}/cuaderno/${section}`).get();
        if (!snap.exists) return { section, empty: true };
        return { section, ...snap.data() };
      },
    },

    {
      name: "read_attendance",
      description: "Lee la asistencia de los jugadores. Si se pasa sessionId, devuelve solo la de esa sesión. Si no, devuelve el registro completo. teamId se infiere si el usuario está viendo un equipo.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si se infiere de la pantalla" },
          sessionId: { type: "string", description: "ID de la sesión de entrenamiento o partido (opcional)" }
        },
        required: []
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${teamId}/cuaderno/asistencia`).get();
        if (!snap.exists) return { empty: true };
        const data = snap.data();
        if (args.sessionId && typeof args.sessionId === 'string') {
          return { sessionId: args.sessionId, attendance: data?.attendance?.[args.sessionId] || null };
        }
        return data || {};
      }
    },

    {
      name: "list_recurring_sessions",
      description:
        "Lista series recurrentes del calendario agrupando las sesiones por recurrenceId. Útil para responder sobre horarios repetidos o cambios en una serie.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Filtrar por equipo (opcional)" },
          from: { type: "string", description: "Fecha inicial YYYY-MM-DD (opcional)" },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const teamId = (typeof args.teamId === "string" && args.teamId) || ctx.defaults?.teamId;
        const from = typeof args.from === "string" ? args.from : "";
        const snap = await userCol(ctx, "calendarSessions")
          .where("recurrenceId", "!=", null)
          .get();
        let sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));
        sessions = sessions.filter((session) => typeof session.recurrenceId === "string" && !!session.recurrenceId);
        if (teamId) sessions = sessions.filter((session) => session.teamId === teamId);
        if (from) sessions = sessions.filter((session) => typeof session.fecha === "string" && session.fecha >= from);

        const grouped = new Map<string, Record<string, unknown>>();
        for (const session of sessions) {
          const recurrenceId = String(session.recurrenceId);
          const existing = grouped.get(recurrenceId);
          if (!existing) {
            grouped.set(recurrenceId, {
              recurrenceId,
              teamId: session.teamId || null,
              teamName: session.teamName || null,
              tipo: session.tipo || "entrenamiento",
              horaInicio: session.horaInicio || "",
              horaFin: session.horaFin || "",
              lugar: session.lugar || "",
              sessionCount: 1,
              firstDate: session.fecha || "",
              lastDate: session.fecha || "",
            });
            continue;
          }
          existing.sessionCount = Number(existing.sessionCount || 0) + 1;
          const fecha = typeof session.fecha === "string" ? session.fecha : "";
          if (fecha && (!existing.firstDate || fecha < existing.firstDate)) existing.firstDate = fecha;
          if (fecha && (!existing.lastDate || fecha > existing.lastDate)) existing.lastDate = fecha;
        }

        return { recurringSessions: Array.from(grouped.values()) };
      }
    },

    {
      name: "read_player_report",
      description: "Lee el informe de jugadores del equipo (valoraciones, estados, notas por jugador). teamId se infiere de la pantalla.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si se infiere de la pantalla" }
        },
        required: []
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${teamId}/cuaderno/informe-jugadores`).get();
        if (!snap.exists) return { empty: true };
        return snap.data() || {};
      }
    },

    {
      name: "read_shooting_test",
      description: "Lee los resultados del test de tiro del equipo. teamId se infiere de la pantalla.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si se infiere de la pantalla" }
        },
        required: []
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${teamId}/cuaderno/test-tiro`).get();
        if (!snap.exists) return { empty: true };
        return snap.data() || {};
      }
    },

    {
      name: "read_scouting",
      description: "Lee el informe de scouting para una sesión o partido específico.",
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Opcional si se infiere de la pantalla" }
        },
        required: []
      },
      handler: async (args, ctx) => {
        const sessionId = resolveId(args, ctx, "sessionId");
        if (!sessionId) return { error: "Falta sessionId." };
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/scoutings/${sessionId}`).get();
        if (!snap.exists) return { empty: true };
        return { id: sessionId, ...snap.data() };
      }
    },

    {
      name: "read_analysis",
      description: "Lee el análisis del partido para una sesión específica.",
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Opcional si se infiere de la pantalla" }
        },
        required: []
      },
      handler: async (args, ctx) => {
        const sessionId = resolveId(args, ctx, "sessionId");
        if (!sessionId) return { error: "Falta sessionId." };
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/analisis/${sessionId}`).get();
        if (!snap.exists) return { empty: true };
        return { id: sessionId, ...snap.data() };
      }
    },

    {
      name: "mandar_convocatoria",
      description:
        "Genera el mensaje de convocatoria de un partido próximo del usuario. Devuelve el texto listo para que el entrenador lo copie o lo comparta por WhatsApp. NO envía nada — solo prepara el mensaje y se renderiza como bloque rico convocatoria_preview en el chat. sessionId puede ser un id de calendarSessions o uno virtual de playoff con prefijo 'playoff-'.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "ID de la sesión (calendarSession o virtual de playoff)",
          },
          notaExtra: {
            type: "string",
            description: "Nota extra opcional para inyectar en la plantilla (ej. 'llevar dos equipaciones')",
          },
          horaCitaOverride: {
            type: "string",
            description: "Hora de cita HH:mm que sobreescribe el offset por defecto del equipo (opcional)",
          },
        },
        required: ["sessionId"],
      },
      renderAs: "convocatoria_preview",
      handler: async (args, ctx) => {
        const sessionId = String(args.sessionId || "");
        if (!sessionId) return { error: "Falta sessionId." };

        const notaExtra = typeof args.notaExtra === "string" ? args.notaExtra : "";
        const horaCitaOverride = typeof args.horaCitaOverride === "string" ? args.horaCitaOverride : "";

        let session: SessionShape & {
          id: string;
          teamId?: string;
          bracketId?: string;
          bracketMatchId?: string;
        };

        if (sessionId.startsWith("playoff-")) {
          // Virtual playoff session: walk brackets to reconstruct.
          const bracketsSnap = await userCol(ctx, "brackets").get();
          let found: typeof session | null = null;
          for (const bDoc of bracketsSnap.docs) {
            const bracket = bDoc.data();
            const state = (bracket.bracketData as { state?: Record<string, Record<string, unknown>> } | undefined)?.state || {};
            for (const match of Object.values(state)) {
              const dates = (match.dates as string[]) || [];
              for (let gi = 0; gi < dates.length; gi++) {
                const candidateId = `playoff-${bDoc.id}-${match.id as string}-${gi}`;
                if (candidateId !== sessionId) continue;
                const isMyTeamTeam1 = match.team1 === bracket.myTeam;
                const rival = isMyTeamTeam1 ? (match.team2 as string) : (match.team1 as string);
                found = {
                  id: sessionId,
                  tipo: "playoff",
                  fecha: dates[gi],
                  horaInicio: ((match.times as string[]) || [])[gi],
                  rival,
                  lugar: ((match.places as string[]) || [])[gi],
                  esLocal: isMyTeamTeam1,
                  matchTitle: match.title as string,
                  gameIndex: gi,
                  notaExtra,
                  horaCita: horaCitaOverride || undefined,
                  teamId: (bracket.teamId as string) || undefined,
                  bracketId: bDoc.id,
                  bracketMatchId: match.id as string,
                };
              }
            }
          }
          if (!found) return { error: `No encontré la sesión de playoff ${sessionId}.` };
          session = found;
        } else {
          const snap = await ctx.db
            .doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/calendarSessions/${sessionId}`)
            .get();
          if (!snap.exists) return { error: `No encontré la sesión ${sessionId}.` };
          const data = snap.data() || {};
          session = {
            id: sessionId,
            tipo: (data.tipo as "partido" | "playoff") || "partido",
            fecha: data.fecha as string | undefined,
            horaInicio: data.horaInicio as string | undefined,
            horaCita: horaCitaOverride || (data.horaCita as string | undefined),
            rival: data.rival as string | undefined,
            lugar: data.lugar as string | undefined,
            lugarMapsUrl: data.lugarMapsUrl as string | undefined,
            esLocal: !!data.esLocal,
            competitionId: (data.competitionId as string | undefined) || null,
            faseId: (data.faseId as string | undefined) || null,
            jornadaNumero: (data.jornadaNumero as number | undefined) ?? null,
            notaExtra: notaExtra || (data.notaExtra as string | undefined) || "",
            teamId: data.teamId as string | undefined,
          };
        }

        if (!session.teamId) return { error: "La sesión no tiene equipo asociado." };

        const teamSnap = await ctx.db
          .doc(`artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${session.teamId}`)
          .get();
        const team: TeamShape | null = teamSnap.exists
          ? ({ id: teamSnap.id, ...teamSnap.data() } as TeamShape)
          : null;

        let competition: CompetitionShape | null = null;
        if (session.competitionId && session.teamId) {
          const cSnap = await ctx.db
            .doc(
              `artifacts/${ctx.appId}/workspaces/${ctx.wsId}/teams/${session.teamId}/competitions/${session.competitionId}`,
            )
            .get();
          if (cSnap.exists) competition = { id: cSnap.id, ...cSnap.data() } as CompetitionShape;
        }

        const { mensaje, encabezado } = renderConvocatoria({ session, team, competition });

        return {
          convocatoria: {
            sessionId: session.id,
            tipo: session.tipo,
            fecha: session.fecha,
            horaInicio: session.horaInicio,
            rival: session.rival,
            lugar: session.lugar,
            teamId: session.teamId,
            bracketId: session.bracketId,
            bracketMatchId: session.bracketMatchId,
            gameIndex: typeof session.gameIndex === "number" ? session.gameIndex : undefined,
            mensaje,
            encabezado,
          },
        };
      },
    },

    {
      name: "listar_partidos_pendientes_convocatoria",
      description:
        "Lista los partidos próximos del usuario que aún no tienen convocatoria enviada, dentro de la ventana de aviso configurada del equipo. Útil cuando el entrenador pregunta '¿qué convocatorias tengo pendientes?' o pide listarle lo que falta esta semana.",
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Filtrar por equipo (opcional)" },
          limit: { type: "integer", description: "Máximo de items (default 10)" },
        },
        required: [],
      },
      handler: async (args, ctx) => {
        const teamId = typeof args.teamId === "string" && args.teamId ? args.teamId : null;
        const limit = Math.min(Number(args.limit) || 10, 50);
        const now = Date.now();
        const todayYmd = new Date(now).toISOString().slice(0, 10);

        const sessionsSnap = await userCol(ctx, "calendarSessions")
          .where("fecha", ">=", todayYmd)
          .orderBy("fecha", "asc")
          .limit(50)
          .get();

        const teamsSnap = await userCol(ctx, "teams").get();
        const teamsById = new Map<string, Record<string, unknown>>();
        teamsSnap.docs.forEach((d) => teamsById.set(d.id, { id: d.id, ...d.data() }));

        const items: Array<{
          sessionId: string;
          fecha: string;
          horaInicio: string;
          rival: string;
          severity: "high" | "normal";
          teamName: string;
        }> = [];

        for (const d of sessionsSnap.docs) {
          const s = { id: d.id, ...d.data() } as Record<string, unknown> & { id: string };
          if (s.tipo !== "partido" && s.tipo !== "playoff") continue;
          if (s.convocatoriaSentAt) continue;
          if (teamId && s.teamId !== teamId) continue;
          if (typeof s.fecha !== "string") continue;
          const team = teamsById.get(s.teamId as string);
          const ventanaH = (team?.convocatoriaReminderHours as number | undefined) ?? 72;
          const [h, m] = ((s.horaInicio as string) || "00:00").split(":").map(Number);
          const [Y, M, D] = s.fecha.split("-").map(Number);
          const startMs = new Date(Y, M - 1, D, h || 0, m || 0).getTime();
          const horas = (startMs - now) / 3600000;
          if (horas <= 0 || horas > ventanaH) continue;
          items.push({
            sessionId: s.id,
            fecha: s.fecha,
            horaInicio: (s.horaInicio as string) || "",
            rival: (s.rival as string) || "Rival",
            severity: horas < 24 ? "high" : "normal",
            teamName: team ? formatTeamDisplayName(team) : "",
          });
          if (items.length >= limit) break;
        }
        return { items };
      },
    }
  ];
}
