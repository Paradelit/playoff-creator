import { ToolDefinition, ToolContext } from "./registry";

function userCol(ctx: ToolContext, collectionName: string) {
  return ctx.db
    .collection("artifacts").doc(ctx.appId)
    .collection("users").doc(ctx.userId)
    .collection(collectionName);
}

function teamSubCol(ctx: ToolContext, teamId: string, collectionName: string) {
  return ctx.db
    .collection("artifacts").doc(ctx.appId)
    .collection("users").doc(ctx.userId)
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
              name: data.teamName || "(sin nombre)",
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
          .doc(`artifacts/${ctx.appId}/users/${ctx.userId}/teams/${teamId}`).get();
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
          name: team.teamName,
          categoria: team.categoria,
          nivel: team.nivel,
          members,
        };
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
          .doc(`artifacts/${ctx.appId}/users/${ctx.userId}/teams/${teamId}/trainings/${trainingId}`).get();
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
          .doc(`artifacts/${ctx.appId}/users/${ctx.userId}/brackets/${bracketId}`).get();
        if (!snap.exists) return { error: "Bracket no encontrado" };
        return { id: bracketId, ...snap.data() };
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
          .doc(`artifacts/${ctx.appId}/users/${ctx.userId}/teams/${teamId}/cuaderno/${section}`).get();
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
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/users/${ctx.userId}/teams/${teamId}/cuaderno/asistencia`).get();
        if (!snap.exists) return { empty: true };
        const data = snap.data();
        if (args.sessionId && typeof args.sessionId === 'string') {
          return { sessionId: args.sessionId, attendance: data?.[args.sessionId] || null };
        }
        return data || {};
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
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/users/${ctx.userId}/teams/${teamId}/cuaderno/informe-jugadores`).get();
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
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/users/${ctx.userId}/teams/${teamId}/cuaderno/test-tiro`).get();
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
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/users/${ctx.userId}/scoutings/${sessionId}`).get();
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
        const snap = await ctx.db.doc(`artifacts/${ctx.appId}/users/${ctx.userId}/analisis/${sessionId}`).get();
        if (!snap.exists) return { empty: true };
        return { id: sessionId, ...snap.data() };
      }
    }
  ];
}
