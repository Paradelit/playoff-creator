import { ToolDefinition, ToolContext } from "./registry";
import { listNavigationTargetIds, resolveAppNavigation } from "../../shared/appRouteCatalog";

export function createNavigationTools(): ToolDefinition[] {
  const enumList = listNavigationTargetIds().join(", ");

  return [
    {
      name: "suggest_navigation",
      description: `Propone llevar al usuario a una pantalla concreta de Pick&Coach. No modifica datos.
Usa esta tool cuando el usuario quiera ver/editar algo en otro sitio de la app, tras generar contenido relacionado,
o cuando expliques dónde encontrar la información. Los destinos válidos son: ${enumList}.
Pasa teamId, trainingId o sessionId cuando el destino lo requiera; si el usuario ya está en un equipo o sesión,
puedes omitirlos si coinciden con el contexto de pantalla (el servidor infiere teamId/sessionId desde defaults).`,
      parameters: {
        type: "object",
        properties: {
          target: {
            type: "string",
            description: `Identificador de pantalla. Valores: ${enumList}`,
            enum: [...listNavigationTargetIds()],
          },
          teamId: { type: "string", description: "ID de equipo Firestore (requerido para rutas bajo /teams/:teamId/...)" },
          trainingId: { type: "string", description: "ID del entrenamiento (para training_editor)" },
          sessionId: {
            type: "string",
            description: "ID del evento de calendario (para scouting, análisis, planilla)",
          },
        },
        required: ["target"],
      },
      handler: async (args, ctx: ToolContext) => {
        const target = typeof args.target === "string" ? args.target : "";
        const teamId =
          (typeof args.teamId === "string" && args.teamId.trim()) || ctx.defaults?.teamId || undefined;
        const trainingId =
          (typeof args.trainingId === "string" && args.trainingId.trim()) || undefined;
        const sessionId =
          (typeof args.sessionId === "string" && args.sessionId.trim()) || ctx.defaults?.sessionId || undefined;

        const resolved = resolveAppNavigation(target, { teamId, trainingId, sessionId });
        if ("error" in resolved) {
          return { error: resolved.error };
        }
        return {
          ok: true,
          path: resolved.path,
          label: resolved.label,
          target,
        };
      },
    },
  ];
}
