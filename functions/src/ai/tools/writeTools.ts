import { ToolDefinition, ToolContext } from "./registry";

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

/**
 * Write tools do NOT execute writes on the server.
 * They validate inputs and return a "proposal" object.
 * The orchestrator emits a confirm_write ContentBlock;
 * the frontend executes the Firestore write on user confirmation.
 */
export function createWriteTools(): ToolDefinition[] {
  return [
    {
      name: "propose_create_training",
      description:
        "Propone guardar una sesión de entrenamiento en el equipo indicado. NO ejecuta la escritura — el usuario debe confirmarla. Usa esto cuando el usuario acepte aplicar un entrenamiento generado por run_training_generator. teamId se infiere de la pantalla si el usuario ya está viendo un equipo.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Equipo destino (opcional si se está viendo un equipo)" },
          training: { type: "object", description: "Objeto completo de entrenamiento a guardar" },
          summary: { type: "string", description: "Resumen humano de 1 línea de lo que se guardará" },
        },
        required: ["training", "summary"],
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId. Pregunta al usuario a qué equipo aplicar." };
        return {
          kind: "create_training",
          teamId,
          training: args.training,
          summary: args.summary,
        };
      },
    },

    {
      name: "propose_create_calendar_session",
      description:
        "Propone crear un evento en el calendario (entrenamiento o partido). Incluye teamId, fecha YYYY-MM-DD, horaInicio, horaFin, lugar, tipo. Si session.teamId falta y el usuario está viendo un equipo, se rellena automáticamente.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          session: {
            type: "object",
            description: "Datos de la sesión: teamId, fecha, horaInicio, horaFin, lugar, tipo, rival?",
          },
          summary: { type: "string" },
        },
        required: ["session", "summary"],
      },
      handler: async (args, ctx) => {
        const session = (args.session as Record<string, unknown>) || {};
        if (!session.teamId && ctx.defaults?.teamId) {
          session.teamId = ctx.defaults.teamId;
        }
        if (!session.teamId) {
          return { error: "Falta teamId en la sesión." };
        }
        return {
          kind: "create_calendar_session",
          session,
          summary: args.summary,
        };
      },
    },

    {
      name: "propose_update_bracket_scores",
      description:
        "Propone actualizar los marcadores de uno o varios partidos de un cuadro. `updates` es un array de { matchId, scores }. bracketId se infiere si el usuario está viendo un cuadro.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          bracketId: { type: "string", description: "Opcional si se infiere de la pantalla" },
          updates: {
            type: "array",
            description:
              "Array de actualizaciones: [{ matchId: 'R1-M0', scores: [{s1, s2}, ...] }, ...]",
            items: { type: "object" },
          },
          summary: { type: "string" },
        },
        required: ["updates", "summary"],
      },
      handler: async (args, ctx) => {
        const bracketId = resolveId(args, ctx, "bracketId");
        if (!bracketId) return { error: "Falta bracketId." };
        return {
          kind: "update_bracket_scores",
          bracketId,
          updates: args.updates,
          summary: args.summary,
        };
      },
    },

    {
      name: "propose_save_note",
      description:
        "Propone añadir texto al cuaderno de notas del equipo. Por defecto se añade al final (append=true). Si append=false, se reemplaza el contenido actual. teamId se infiere de la pantalla.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si se infiere de la pantalla" },
          text: { type: "string", description: "Texto a guardar en el cuaderno" },
          append: {
            type: "boolean",
            description: "Si es true (por defecto), añade al final; si es false, reemplaza.",
          },
          summary: { type: "string" },
        },
        required: ["text", "summary"],
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        return {
          kind: "save_note",
          teamId,
          text: args.text,
          append: args.append !== false,
          summary: args.summary,
        };
      },
    },

    {
      name: "propose_create_bracket",
      description:
        "Propone crear un cuadro de playoffs completo. El usuario confirma antes de que se guarde.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          bracket: { type: "object", description: "Estructura completa del bracket (tournamentName, rounds, initialMatches)" },
          teamId: { type: "string", description: "Equipo asociado (opcional, se infiere de la pantalla si aplica)" },
          summary: { type: "string" },
        },
        required: ["bracket", "summary"],
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        return {
          kind: "create_bracket",
          bracket: args.bracket,
          teamId: teamId || null,
          summary: args.summary,
        };
      },
    },

    {
      name: "propose_save_attendance",
      description: "Propone guardar la asistencia para una sesión específica.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si se infiere de la pantalla" },
          sessionId: { type: "string", description: "ID de la sesión de entrenamiento o partido" },
          attendance: { type: "object", description: "Objeto con los datos de asistencia a guardar" },
          summary: { type: "string" }
        },
        required: ["sessionId", "attendance", "summary"]
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        return {
          kind: "save_attendance",
          teamId,
          sessionId: args.sessionId,
          attendance: args.attendance,
          summary: args.summary
        };
      }
    },

    {
      name: "propose_save_player_report",
      description: "Propone actualizar el informe de jugadores.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si se infiere de la pantalla" },
          report: { type: "object", description: "Datos del informe a guardar" },
          summary: { type: "string" }
        },
        required: ["report", "summary"]
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        return {
          kind: "save_player_report",
          teamId,
          report: args.report,
          summary: args.summary
        };
      }
    },

    {
      name: "propose_save_shooting_test",
      description: "Propone guardar resultados de un test de tiro.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          teamId: { type: "string", description: "Opcional si se infiere de la pantalla" },
          testResults: { type: "object", description: "Resultados del test de tiro" },
          summary: { type: "string" }
        },
        required: ["testResults", "summary"]
      },
      handler: async (args, ctx) => {
        const teamId = resolveId(args, ctx, "teamId");
        if (!teamId) return { error: "Falta teamId." };
        return {
          kind: "save_shooting_test",
          teamId,
          testResults: args.testResults,
          summary: args.summary
        };
      }
    },

    {
      name: "propose_save_scouting",
      description: "Propone guardar un informe de scouting para una sesión.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Opcional si se infiere de la pantalla" },
          scoutingData: { type: "object", description: "Datos a guardar" },
          summary: { type: "string" }
        },
        required: ["scoutingData", "summary"]
      },
      handler: async (args, ctx) => {
        const sessionId = resolveId(args, ctx, "sessionId");
        if (!sessionId) return { error: "Falta sessionId." };
        return {
          kind: "save_scouting",
          sessionId,
          scoutingData: args.scoutingData,
          summary: args.summary
        };
      }
    },

    {
      name: "propose_save_analysis",
      description: "Propone guardar un análisis de partido para una sesión.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          sessionId: { type: "string", description: "Opcional si se infiere de la pantalla" },
          analysisData: { type: "object", description: "Datos a guardar" },
          summary: { type: "string" }
        },
        required: ["analysisData", "summary"]
      },
      handler: async (args, ctx) => {
        const sessionId = resolveId(args, ctx, "sessionId");
        if (!sessionId) return { error: "Falta sessionId." };
        return {
          kind: "save_analysis",
          sessionId,
          analysisData: args.analysisData,
          summary: args.summary
        };
      }
    },

    {
      name: "propose_create_exercise",
      description:
        "Propone crear un ejercicio en la biblioteca del usuario. Incluye nombre, descripci\u00f3n, contenido/tags, tipo de pista, duraci\u00f3n, nivel. El usuario debe confirmar antes de guardar.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          exercise: {
            type: "object",
            description:
              "Objeto del ejercicio: { nombre, descripcion?, contenido?, tags?: string[], duracion?: number, nivel?: string, tipoPista?: string, elementos?: string[], pasos?: string[] }",
          },
          summary: { type: "string", description: "Resumen de 1 l\u00ednea" },
        },
        required: ["exercise", "summary"],
      },
      handler: async (args) => {
        const exercise = (args.exercise as Record<string, unknown>) || {};
        if (!exercise.nombre) {
          return { error: "Falta el nombre del ejercicio." };
        }
        return {
          kind: "create_exercise",
          exercise,
          summary: args.summary,
        };
      },
    },

    {
      name: "propose_create_exercises",
      description:
        "Propone crear varios ejercicios a la vez en la biblioteca del usuario. \u00datil cuando se genera una bater\u00eda de ejercicios o se extraen de un entrenamiento. exercises es un array de objetos ejercicio.",
      isWrite: true,
      parameters: {
        type: "object",
        properties: {
          exercises: {
            type: "array",
            description: "Array de objetos ejercicio (misma estructura que propose_create_exercise)",
            items: { type: "object" },
          },
          summary: { type: "string" },
        },
        required: ["exercises", "summary"],
      },
      handler: async (args) => {
        const exercises = Array.isArray(args.exercises) ? args.exercises : [];
        if (exercises.length === 0) {
          return { error: "El array de ejercicios est\u00e1 vac\u00edo." };
        }
        const invalid = exercises.filter(
          (e) => !e || typeof e !== "object" || !(e as Record<string, unknown>).nombre
        );
        if (invalid.length > 0) {
          return { error: `${invalid.length} ejercicio(s) sin nombre.` };
        }
        return {
          kind: "create_exercises",
          exercises,
          summary: args.summary,
        };
      },
    },
  ];
}
