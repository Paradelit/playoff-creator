import { ToolDefinition } from "./registry";
import { searchUserContext } from "../userRagService";

/**
 * User context RAG tool — semantic search over the coach's personal data:
 * cuaderno notes, past trainings, match analyses, scouting reports, player reports.
 *
 * Uses lazy embedding with Firestore caching (ragIndex collection per user).
 */
export function createUserContextTools(geminiApiKey: string): ToolDefinition[] {
  return [
    {
      name: "search_user_context",
      description:
        "Busca en el historial y datos personales del entrenador: notas del cuaderno, entrenamientos pasados, análisis de partidos, informes de scouting de rivales, informes de jugadores y memorias guardadas. " +
        "Úsalo cuando el usuario haga referencia a algo pasado o histórico ('el entrenamiento del martes', 'mis notas sobre el Barça', 'el informe de Juan'), " +
        "pida comparar con sesiones anteriores, quiera recordar algo que anotó, o pregunte sobre el rendimiento histórico de jugadores o rivales. " +
        "NO lo uses para datos actuales como equipos o calendario — esos tienen sus propias tools de lectura.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "La pregunta o tema a buscar en el contexto personal del entrenador. Escríbela en lenguaje natural. " +
              "Ejemplos: 'entrenamiento de tiro la semana pasada', 'notas sobre el rival del sábado', 'informe de rendimiento de los bases', 'análisis del último partido'.",
          },
        },
        required: ["query"],
      },
      renderAs: "data",
      handler: async (args, ctx) => {
        const query = String(args.query || "").trim();
        if (!query) return { error: "Falta el parámetro query." };

        const apiKey = geminiApiKey || ctx.geminiApiKey || "";
        if (!apiKey) {
          return { error: "No hay API key disponible para buscar en el contexto del usuario." };
        }

        try {
          const results = await searchUserContext(
            query,
            ctx.db,
            ctx.appId,
            ctx.userId,
            apiKey,
            5
          );

          if (results.length === 0) {
            return {
              found: false,
              message:
                "No encontré información relevante en tus datos personales para esta búsqueda. " +
                "Puede que no hayas guardado notas o análisis relacionados con este tema todavía.",
            };
          }

          return {
            found: true,
            query,
            results: results.map((r) => ({
              title: r.title,
              category: r.category,
              content: r.content,
              teamName: r.teamName,
              relevance: Math.round(r.score * 100),
            })),
          };
        } catch (err) {
          const msg = (err as Error).message || "Error desconocido";
          console.error("[search_user_context] Error:", msg);
          return {
            found: false,
            message: "Error al buscar en el contexto personal: " + msg,
          };
        }
      },
    },
  ];
}
