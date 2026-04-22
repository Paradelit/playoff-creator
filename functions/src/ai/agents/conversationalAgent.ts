import { BaseAgent } from "./baseAgent";
import { ScreenContextData } from "../types";
import { CompiledPrompt } from "../promptManager";

export interface ConversationalInput {
  userMessage: string;
  screenContext?: ScreenContextData;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface ConversationalOutput {
  naturalResponse: string;
  suggestedMode: "compact" | "panel" | "column";
  actions?: Array<{ type: "navigate" | "create"; label: string; path?: string; data?: unknown }>;
}

export class ConversationalAgent extends BaseAgent<ConversationalInput, ConversationalOutput> {
  readonly name = "conversational";
  readonly description =
    "Responde preguntas generales sobre la app, sugiere acciones y ayuda al usuario con navegación y uso de la herramienta.";

  validateInput(input: ConversationalInput): ConversationalInput {
    if (!input.userMessage) throw new Error("Se requiere un mensaje del usuario.");
    return input;
  }

  async buildPrompt(input: ConversationalInput): Promise<CompiledPrompt> {
    const screenInfo = input.screenContext
      ? `\nPANTALLA ACTUAL: ${input.screenContext.screen} (ruta: ${input.screenContext.route})${input.screenContext.data ? `\nDatos visibles: ${JSON.stringify(input.screenContext.data)}` : ""}`
      : "";

    const historyInfo =
      input.conversationHistory && input.conversationHistory.length > 0
        ? `\nHISTORIAL DE CONVERSACIÓN:\n${input.conversationHistory.slice(-10).map((m) => `${m.role}: ${m.content}`).join("\n")}`
        : "";

    return this.promptManager.compile("conversational", {
      userMessage: input.userMessage,
      screenInfo,
      historyInfo,
    });
  }

  processOutput(raw: unknown): ConversationalOutput {
    const data = raw as Record<string, unknown>;
    return {
      naturalResponse: (data.naturalResponse as string) || "No pude procesar tu solicitud.",
      suggestedMode: (["compact", "panel", "column"].includes(data.suggestedMode as string)
        ? data.suggestedMode
        : "panel") as "compact" | "panel" | "column",
      actions: Array.isArray(data.actions) ? data.actions : [],
    };
  }

  describe() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: "{ userMessage: string, screenContext?: object, conversationHistory?: array }",
    };
  }
}
