import { ToolDefinition, ToolContext } from "./registry";

function requireAgentCtx(ctx: ToolContext) {
  if (!ctx.agents || !ctx.traceContext || !ctx.agentOptions) {
    throw new Error("Agent tools require agents, traceContext and agentOptions in ToolContext.");
  }
  return { agents: ctx.agents, traceContext: ctx.traceContext, options: ctx.agentOptions };
}

export function createAgentTools(): ToolDefinition[] {
  return [
    {
      name: "run_training_generator",
      description:
        "Genera una sesión de entrenamiento completa (calentamiento, bloques principales, vuelta a la calma) adaptada a la categoría y objetivos. Úsalo cuando el usuario pida 'genera un entrenamiento' o similar. Tras obtener el resultado, usa propose_create_training si el usuario quiere guardarlo.",
      renderAs: "training_preview",
      parameters: {
        type: "object",
        properties: {
          teamCategory: {
            type: "string",
            description:
              "Categoría: minibasket, alevín, infantil, cadete, junior, senior.",
          },
          duration: { type: "integer", description: "Duración total en minutos (ej. 90)" },
          objectives: { type: "string", description: "Objetivos de la sesión en prosa" },
          focusAreas: { type: "array", items: { type: "string" }, description: "Áreas de enfoque (opcional)" },
          playerCount: { type: "integer", description: "Nº de jugadores (opcional)" },
          constraints: { type: "string", description: "Restricciones (opcional)" },
        },
        required: ["teamCategory", "duration", "objectives"],
      },
      handler: async (args, ctx) => {
        const { agents, traceContext, options } = requireAgentCtx(ctx);
        return await agents.training.execute(args, traceContext, options);
      },
    },

    {
      name: "run_bracket_agent",
      description:
        "Analiza los documentos de bases de competición y clasificación final para generar la estructura del cuadro de playoffs. Requiere los textos ya extraídos de los PDFs.",
      renderAs: "bracket_preview",
      parameters: {
        type: "object",
        properties: {
          basesText: { type: "string", description: "Texto de las bases de competición" },
          clasifText: { type: "string", description: "Texto de la clasificación final" },
          userInstructions: { type: "string", description: "Instrucciones adicionales (opcional)" },
        },
        required: ["basesText", "clasifText"],
      },
      handler: async (args, ctx) => {
        const { agents, traceContext, options } = requireAgentCtx(ctx);
        return await agents.bracket.execute(args, traceContext, options);
      },
    },

    {
      name: "run_calendar_import_agent",
      description:
        "Analiza un Excel de horarios y devuelve sesiones recurrentes y específicas para importar al calendario. Requiere el texto del Excel y la lista de equipos conocidos.",
      parameters: {
        type: "object",
        properties: {
          excelText: { type: "string", description: "Contenido textual del Excel" },
          teams: {
            type: "array",
            items: { type: "object" },
            description: "Lista de equipos {id, teamName} conocidos del entrenador",
          },
        },
        required: ["excelText", "teams"],
      },
      handler: async (args, ctx) => {
        const { agents, traceContext, options } = requireAgentCtx(ctx);
        return await agents.calendar.execute(args, traceContext, options);
      },
    },

    {
      name: "run_results_agent",
      description:
        "Extrae puntuaciones de un acta textual para los partidos de un bracket. Devuelve los matchIds actualizados con sus scores.",
      renderAs: "score_update",
      parameters: {
        type: "object",
        properties: {
          bracketState: {
            type: "array",
            items: { type: "object" },
            description: "Array de partidos actuales del bracket (id, title, team1, team2, format, gamesCount)",
          },
          resultsText: { type: "string", description: "Texto del acta con los resultados" },
        },
        required: ["bracketState", "resultsText"],
      },
      handler: async (args, ctx) => {
        const { agents, traceContext, options } = requireAgentCtx(ctx);
        return await agents.results.execute(args, traceContext, options);
      },
    },
  ];
}
