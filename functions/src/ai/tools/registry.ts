import type { Firestore } from "firebase-admin/firestore";
import type { BaseAgent } from "../agents/baseAgent";
import type { TraceContext, AgentExecutionOptions } from "../types";

export interface AgentsMap {
  bracket: BaseAgent<unknown, unknown>;
  calendar: BaseAgent<unknown, unknown>;
  results: BaseAgent<unknown, unknown>;
  training: BaseAgent<unknown, unknown>;
}

export interface ToolContext {
  db: Firestore;
  userId: string;
  appId: string;
  /** IDs inferred from the current screen — tools can use these as fallbacks
   *  when the LLM doesn't provide an explicit arg. */
  defaults?: {
    teamId?: string;
    sessionId?: string;
    bracketId?: string;
  };
  // Optional dependencies for agent-wrapper tools:
  agents?: AgentsMap;
  traceContext?: TraceContext;
  agentOptions?: AgentExecutionOptions;
  /** Gemini API key — needed by tools that call embedding or generation APIs directly. */
  geminiApiKey?: string;
}

/** JSON Schema subset supported by Gemini function declarations */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<string, {
    type: "string" | "number" | "integer" | "boolean" | "array" | "object";
    description?: string;
    items?: { type: string };
    enum?: string[];
  }>;
  required?: string[];
}

/**
 * How the tool's output should be represented in the chat.
 * 'data' — raw data, orchestrator will summarize in a text block
 * 'proposal' — write proposal, orchestrator emits a confirm_write block
 * Other values = specific rich card
 */
export type ToolRenderAs =
  | "data"
  | "proposal"
  | "training_preview"
  | "bracket_preview"
  | "session_preview"
  | "score_update"
  | "note_preview"
  | "team_list"
  | "convocatoria_preview";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  /** Whether this tool proposes a write — if true, its output is rendered as a confirm_write block */
  isWrite?: boolean;
  /** Override rendering hint for the block this tool produces (for reads only) */
  renderAs?: ToolRenderAs;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  registerMany(tools: ToolDefinition[]): void {
    for (const t of tools) this.register(t);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Gemini-compatible function declarations (snake_case keys) */
  toGeminiDeclarations(): Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as unknown as Record<string, unknown>,
    }));
  }
}
