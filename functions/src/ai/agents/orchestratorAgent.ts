import { LLMProvider, GeminiMessage, GeminiPart } from "../llmProvider";
import { ObservabilityService } from "../observability";
import { ToolRegistry, ToolContext } from "../tools/registry";
import { ContentBlock, OrchestratorResponse, WriteProposal } from "../contentBlocks";
import { ScreenContextData, TraceContext, AgentExecutionOptions } from "../types";
import { digestToPromptText, UserDigest } from "../userDigest";

const MAX_TOOL_ITERATIONS = 8;

/** Human-readable status shown before each slow tool runs. */
const SLOW_TOOL_STATUS: Record<string, string> = {
  run_training_generator: "Generando entrenamiento...",
  run_bracket_agent: "Analizando bases y clasificación...",
  run_calendar_import_agent: "Procesando horario...",
  run_results_agent: "Extrayendo puntuaciones...",
};

/** Error messages that suggest a transient network/server failure worth retrying. */
function isRetriableError(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("fetch failed") ||
    m.includes("timeout") ||
    m.includes("abort") ||
    m.includes("econnreset") ||
    m.includes("socket hang up") ||
    m.includes("503") ||
    m.includes("504") ||
    m.includes("network")
  );
}

function randomId(): string {
  // Simple UUID-ish for proposalId; crypto is available in Node 22
  return "p_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export interface OrchestratorInput {
  userMessage: string;
  screenContext?: ScreenContextData;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  userDigest: UserDigest;
}

export class OrchestratorAgent {
  constructor(
    private deps: {
      llmProvider: LLMProvider;
      observability: ObservabilityService;
      toolRegistry: ToolRegistry;
    }
  ) {}

  async run(
    input: OrchestratorInput,
    toolCtx: ToolContext,
    traceContext: TraceContext,
    _options: AgentExecutionOptions
  ): Promise<OrchestratorResponse> {
    const blocks: ContentBlock[] = [];
    const toolDecls = this.deps.toolRegistry.toGeminiDeclarations();
    const systemInstruction = this.buildSystemPrompt(input.screenContext, input.userDigest);
    const traceId = (traceContext.trace as { id?: string })?.id || "";

    const messages: GeminiMessage[] = [];
    for (const m of input.conversationHistory || []) {
      messages.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
    messages.push({ role: "user", parts: [{ text: input.userMessage }] });

    let totalToolCalls = 0;
    let totalToolErrors = 0;
    let completedIterations = 0;

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      completedIterations = iter + 1;
      const span = this.deps.observability.createSpan(traceContext.trace, {
        name: `orchestrator-iter-${iter}`,
        input: { iteration: iter, lastMessage: messages[messages.length - 1] },
      });

      let result;
      try {
        result = await this.deps.llmProvider.generateWithTools({
          systemInstruction,
          messages,
          tools: toolDecls,
          traceContext: { ...traceContext, span },
        });
      } catch (err) {
        const msg = (err as Error).message || String(err);
        this.deps.observability.endSpan(span, { error: msg });
        if (msg === "RATE_LIMIT" || msg === "FORBIDDEN") throw err;
        // Gemini saturation or network failure — degrade gracefully
        blocks.push({
          type: "status",
          text: "La IA está saturada ahora mismo. Prueba en 1 minuto.",
        });
        break;
      }

      const textParts = result.parts.filter((p): p is { text: string } => "text" in p && !!p.text);
      const callParts = result.parts.filter(
        (p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
          "functionCall" in p
      );

      // Emit text blocks
      for (const t of textParts) {
        const trimmed = t.text.trim();
        if (trimmed) blocks.push({ type: "text", markdown: trimmed });
      }

      if (callParts.length === 0) {
        this.deps.observability.endSpan(span, { finished: true });
        break;
      }

      // Add the model turn (with functionCalls) to messages BEFORE responding
      messages.push({ role: "model", parts: result.parts });

      const responseParts: GeminiPart[] = [];
      for (const call of callParts) {
        const toolName = call.functionCall.name;
        const args = call.functionCall.args || {};
        const tool = this.deps.toolRegistry.get(toolName);

        if (!tool) {
          responseParts.push({
            functionResponse: { name: toolName, response: { error: `Tool "${toolName}" no existe.` } },
          });
          continue;
        }

        // Emit a status block before slow tools so the user sees progress
        const statusText = SLOW_TOOL_STATUS[toolName];
        if (statusText) {
          blocks.push({ type: "status", text: statusText });
        }

        try {
          const output = await this.runToolWithRetry(tool.handler, args, toolCtx);
          totalToolCalls += 1;

          // Emit block according to tool type
          if (tool.isWrite) {
            const proposalBlock = this.buildConfirmWriteBlock(output);
            if (proposalBlock) blocks.push(proposalBlock);
          } else if (tool.renderAs && tool.renderAs !== "data") {
            const richBlock = this.buildRichBlock(tool.renderAs, output);
            if (richBlock) blocks.push(richBlock);
          }

          responseParts.push({
            functionResponse: {
              name: toolName,
              response: { result: output as Record<string, unknown> },
            },
          });
        } catch (err) {
          const msg = (err as Error).message || String(err);
          totalToolErrors += 1;
          if (traceId) {
            this.deps.observability.logScore(traceId, {
              name: "tool_error",
              value: 1,
              comment: `${toolName}: ${msg}`,
            });
          }
          responseParts.push({
            functionResponse: { name: toolName, response: { error: msg } },
          });
        }
      }

      // Add combined function response message
      messages.push({ role: "user", parts: responseParts });
      this.deps.observability.endSpan(span, { calls: callParts.length, textBlocks: textParts.length });
    }

    // Safety: ensure at least one text block
    if (!blocks.some((b) => b.type === "text" || b.type === "confirm_write")) {
      blocks.push({ type: "text", markdown: "He terminado." });
    }

    if (traceId) {
      this.deps.observability.logScore(traceId, { name: "tool_calls", value: totalToolCalls });
      this.deps.observability.logScore(traceId, { name: "iteration_count", value: completedIterations });
      if (totalToolErrors > 0) {
        this.deps.observability.logScore(traceId, {
          name: "tool_errors_total",
          value: totalToolErrors,
        });
      }
    }

    return { blocks, traceId };
  }

  private buildSystemPrompt(screen: ScreenContextData | undefined, digest: UserDigest): string {
    const screenInfo = screen
      ? `\nPANTALLA ACTUAL: ${screen.screen} (ruta: ${screen.route})${
          screen.entityId ? `\nEntidad enfocada: ${screen.entityType} id=${screen.entityId}` : ""
        }${screen.data && Object.keys(screen.data).length > 0 ? `\nDatos visibles: ${JSON.stringify(screen.data)}` : ""}`
      : "";

    return `
Eres el copilot IA de CoachApp, una aplicación para entrenadores de baloncesto.
Respondes SIEMPRE en español, con tono profesional pero cercano.

Tu objetivo es ayudar al entrenador en cualquier tarea: consultar datos, generar entrenamientos,
crear cuadros de playoffs, gestionar calendario, anotar notas, etc.

REGLAS CRÍTICAS:
1. Si necesitas datos del usuario (equipos, brackets, calendario, etc.), usa las tools de lectura
   (list_teams, list_calendar_sessions, get_bracket, etc.) en lugar de preguntar al usuario.
2. NUNCA ejecutes una escritura directamente. Para crear/modificar datos usa las tools "propose_*"
   que proponen la acción — el usuario deberá confirmarla manualmente.
3. Cuando uses tools propose_*, NUNCA respondas diciendo "¡Hecho!" o "He guardado los datos exitosamente." 
   En lugar de eso, debes decir "He preparado una propuesta, pulsa Confirmar para guardarla."
4. Si una tool devuelve un error (ej. "Falta teamId") o no hay datos, NUNCA respondas solo "He terminado". 
   INFORMA amablemente al usuario indicando qué datos faltan o que de momento no hay registros creados.
5. Sé conciso en las respuestas de texto. Si ya has devuelto un bloque rico (training_preview,
   team_list, etc.), tu texto debe ser un comentario breve, no repetir los datos.
6. Usa el contexto de pantalla actual para inferir IDs o entidades relevantes.
7. MEMORIA: cuando el usuario declare una preferencia duradera ("prefiero entrenamientos de 75 min",
   "mi equipo principal es X", "siempre entreno los martes"), invoca save_memory automáticamente.
   No pidas confirmación para save_memory — es un apunte personal, no un cambio destructivo.
   Si una memoria ya aparece en "Memorias persistentes" del contexto, NO la vuelvas a guardar.

${digestToPromptText(digest)}
${screenInfo}
`.trim();
  }

  /** Execute a tool handler, retrying once on transient network errors. */
  private async runToolWithRetry(
    handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>,
    args: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<unknown> {
    try {
      return await handler(args, ctx);
    } catch (err) {
      const msg = (err as Error).message || String(err);
      if (!isRetriableError(msg)) throw err;
      // One retry after a short backoff
      await new Promise((r) => setTimeout(r, 400));
      return await handler(args, ctx);
    }
  }

  private buildConfirmWriteBlock(proposal: unknown): ContentBlock | null {
    const p = proposal as {
      kind?: string;
      summary?: string;
      [k: string]: unknown;
    };
    if (!p || !p.kind || !p.summary) return null;
    const { kind, summary, ...payload } = p;
    const writeProposal: WriteProposal = {
      proposalId: randomId(),
      kind: kind as WriteProposal["kind"],
      summary: summary as string,
      payload: payload as Record<string, unknown>,
    };
    return { type: "confirm_write", proposal: writeProposal };
  }

  private buildRichBlock(renderAs: string, output: unknown): ContentBlock | null {
    const data = (output as Record<string, unknown>) || {};
    switch (renderAs) {
      case "team_list": {
        const teams = (data.teams as Array<{ id: string; name: string; categoria?: string; memberCount: number }>) || [];
        return { type: "team_list", teams };
      }
      case "training_preview": {
        const training = data as {
          title: string;
          totalDuration: number;
          warmup?: unknown;
          mainBlocks?: unknown[];
          cooldown?: unknown;
          notes?: string;
        };
        return { type: "training_preview", training };
      }
      case "bracket_preview":
        return {
          type: "bracket_preview",
          bracket: data as { tournamentName?: string; rounds?: unknown[]; initialMatches?: unknown[] },
        };
      case "score_update": {
        const updates = (data.updatedMatches as Array<{ id: string; scores: unknown[] }>) || [];
        return { type: "score_update", updates };
      }
      case "session_preview":
        return { type: "session_preview", session: data };
      default:
        return null;
    }
  }
}
