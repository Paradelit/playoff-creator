import { LLMProvider, GeminiMessage, GeminiPart } from "../llmProvider";
import { ObservabilityService } from "../observability";
import { ToolRegistry, ToolContext } from "../tools/registry";
import { ContentBlock, PickAction, OrchestratorResponse, WriteProposal } from "../contentBlocks";
import { ScreenContextData, TraceContext, AgentExecutionOptions } from "../types";
import { digestToPromptText, UserDigest } from "../userDigest";
import { PromptManager } from "../promptManager";

const MAX_TOOL_ITERATIONS = 8;

// ── History compression ──────────────────────────────────────────────────────

/** Number of most-recent turns to keep verbatim; older turns are condensed. */
const RECENT_TURNS_KEEP = 6;

/**
 * Keeps the last RECENT_TURNS_KEEP turns verbatim.
 * Older turns are condensed into a single bracketed context message so the
 * model retains narrative continuity without burning tokens on full history.
 */
function compressConversationHistory(
  history: Array<{ role: "user" | "assistant"; content: string }>
): Array<{ role: "user" | "assistant"; content: string }> {
  if (history.length <= RECENT_TURNS_KEEP) return history;

  const older = history.slice(0, history.length - RECENT_TURNS_KEEP);
  const recent = history.slice(history.length - RECENT_TURNS_KEEP);

  const summaryLines = older.map((turn) => {
    const label = turn.role === "user" ? "U" : "A";
    const excerpt = turn.content.replace(/\n/g, " ").substring(0, 130);
    return `${label}: ${excerpt}${turn.content.length > 130 ? "…" : ""}`;
  });

  const contextTurn: { role: "user" | "assistant"; content: string } = {
    role: "user",
    content: `[Contexto resumido de la conversación anterior]\n${summaryLines.join("\n")}`,
  };

  return [contextTurn, ...recent];
}

// ── Model routing by complexity ───────────────────────────────────────────────

const COMPLEX_KEYWORDS = [
  "crea", "genera", "bracket", "playoff", "entrenamiento", "analiza", "análisis",
  "importa", "extrae", "puntuaciones", "calendario", "planifica", "diseña",
  "construye", "configura", "modifica", "actualiza", "clasifica", "informe",
  "report", "create", "generate", "analyze", "training", "bracket",
];

const SIMPLE_PATTERNS = [
  /^(hola|hi|hey|hello|buenos días|buenas tardes|buenas noches)\b/i,
  /^(gracias|de nada|ok|vale|perfecto|entendido|genial|bien)\b/i,
  /^(qué es|qué son|qué hace|cómo funciona|explícame|cuéntame)\b/i,
  /^(ir a|navega|abre|muéstrame|llévame|ve a)\b/i,
  /^(quién|cuándo|dónde|cuántos|cuántas)\b/i,
];

function classifyQueryComplexity(message: string): "fast" | "capable" {
  const lower = message.toLowerCase().trim();

  // Explicit complex keywords always win
  if (COMPLEX_KEYWORDS.some((kw) => lower.includes(kw))) return "capable";

  // Long messages are usually multi-step
  if (message.length > 200) return "capable";

  // Short messages matching simple patterns → fast model
  if (message.length < 100 && SIMPLE_PATTERNS.some((p) => p.test(lower))) return "fast";

  // Short messages with no complex keywords default to fast
  return message.length < 100 ? "fast" : "capable";
}

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
      promptManager: PromptManager;
    }
  ) {}

  async run(
    input: OrchestratorInput,
    toolCtx: ToolContext,
    traceContext: TraceContext,
    _options: AgentExecutionOptions
  ): Promise<OrchestratorResponse> {
    const blocks: ContentBlock[] = [];
    const actions: PickAction[] = [];
    const toolDecls = this.deps.toolRegistry.toGeminiDeclarations();
    const systemInstruction = await this.buildSystemPrompt(input.screenContext, input.userDigest);
    const traceId = (traceContext.trace as { id?: string })?.id || "";

    // Compress old history to save tokens, keep recent turns verbatim
    const compressedHistory = compressConversationHistory(input.conversationHistory || []);
    const messages: GeminiMessage[] = [];
    for (const m of compressedHistory) {
      messages.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      });
    }
    messages.push({ role: "user", parts: [{ text: input.userMessage }] });

    // Route simple queries to a faster/cheaper model
    const modelHint = classifyQueryComplexity(input.userMessage);

    let totalToolCalls = 0;
    let totalToolErrors = 0;
    let completedIterations = 0;
    const toolCallNames: Array<{ name: string }> = [];
    let loopDetected = false;

    // Loop-protection: track the last set of tool calls to detect repeated identical calls
    let lastToolCallKey: string | null = null;

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
          modelHint,
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

      // Loop protection: break if the model is calling the same tool(s) with identical args again
      const currentToolCallKey = JSON.stringify(
        callParts.map((c) => ({ n: c.functionCall.name, a: c.functionCall.args }))
      );
      if (currentToolCallKey === lastToolCallKey) {
        loopDetected = true;
        this.deps.observability.endSpan(span, { loopDetected: true });
        blocks.push({
          type: "text",
          markdown:
            "No he podido completar la acción (respuesta repetida detectada). Por favor, reformula tu petición con más detalle.",
        });
        break;
      }
      lastToolCallKey = currentToolCallKey;

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
          toolCallNames.push({ name: toolName });

          if (toolName === "suggest_navigation") {
            const out = output as Record<string, unknown>;
            if (out.ok === true && typeof out.path === "string" && typeof out.label === "string") {
              const path = out.path;
              const label = out.label;
              if (!actions.some((a) => a.type === "navigate" && a.path === path)) {
                actions.push({ type: "navigate", label, path });
              }
            }
          }

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

    // Safety: ensure al menos texto o tarjetas ricas no queden "mudas"
    if (!blocks.some((b) => b.type === "text" || b.type === "confirm_write")) {
      const hasRichCard = blocks.some((b) =>
        ["team_list", "training_preview", "bracket_preview", "session_preview", "score_update", "exercise_preview"].includes(
          b.type
        )
      );
      if (actions.length > 0 && !hasRichCard) {
        blocks.push({ type: "text", markdown: "He dejado un acceso directo abajo." });
      } else if (!hasRichCard && actions.length === 0) {
        blocks.push({ type: "text", markdown: "He terminado." });
      }
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

    return {
      blocks,
      traceId,
      actions: actions.length > 0 ? actions : undefined,
      _autoEvalMetrics: { toolCalls: toolCallNames, loopDetected },
    };
  }

  private async buildSystemPrompt(screen: ScreenContextData | undefined, digest: UserDigest): Promise<string> {
    const screenInfo = screen
      ? `\nPANTALLA ACTUAL: ${screen.screen} (ruta: ${screen.route})${
          screen.entityId ? `\nEntidad enfocada: ${screen.entityType} id=${screen.entityId}` : ""
        }${screen.data && Object.keys(screen.data).length > 0 ? `\nDatos visibles: ${JSON.stringify(screen.data)}` : ""}`
      : "";

    const compiled = await this.deps.promptManager.compile("orchestrator-system", {
      digestText: digestToPromptText(digest),
      screenInfo,
    });

    return compiled.text;
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
