import { ToolDefinition } from "./registry";
import { searchKnowledgeBase } from "../embeddingService";

/**
 * Knowledge base tool — semantic search over product FAQs, competition rules,
 * bracket engine docs, and basketball concepts.
 *
 * The knowledge base is a global Firestore collection (`knowledgeBase`) indexed
 * offline by the `scripts/indexKnowledge.ts` script.
 *
 * The tool requires a Gemini API key (for embedding the query) passed via closure.
 */
export function createKnowledgeTools(geminiApiKey: string): ToolDefinition[] {
  return [
    {
      name: "search_knowledge_base",
      description:
        "Busca en la base de conocimiento documentación sobre: cómo usar las funciones de la app (crear equipo, generar entrenamiento, crear playoff, importar calendario, cuaderno, ejercicios), reglas de formatos de competición (liga, copa, eliminatoria, BO1/BO2/BO3, fases de grupo), cómo funciona el motor de cuadros de playoff (potencia de 2, BYEs, propagación de ganadores), y conceptos de baloncesto (posiciones, sistemas de ataque/defensa, categorías, planificación de temporada). Usa esta tool cuando el usuario pregunte sobre cómo funciona la app, reglas de torneos o conceptos técnicos de baloncesto que no estén en su contexto personal.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "La pregunta o tema a buscar. Escríbela en lenguaje natural. Ejemplos: '¿cómo creo un playoff?', 'formato BO3', 'qué es un BYE en el cuadro', 'defensa en zona 2-3', 'categorías de baloncesto español'.",
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
          return {
            error: "No hay API key disponible para buscar en la base de conocimiento.",
          };
        }

        try {
          const results = await searchKnowledgeBase(query, ctx.db, apiKey, 4);

          if (results.length === 0) {
            return {
              found: false,
              message:
                "No se encontró información relevante en la base de conocimiento. Responde con tu conocimiento general.",
            };
          }

          return {
            found: true,
            query,
            results: results.map((r) => ({
              title: r.title,
              slug: r.slug,
              category: r.category,
              summary: r.summary,
              body: r.body,
              relevance: Math.round(r.score * 100),
            })),
          };
        } catch (err) {
          const msg = (err as Error).message || "Error desconocido";
          console.error("[search_knowledge_base] Error:", msg);
          // Return gracefully so the orchestrator can still respond without crashing
          return {
            found: false,
            message: `Error al buscar en la base de conocimiento: ${msg}. Responde con tu conocimiento general.`,
          };
        }
      },
    },
  ];
}
