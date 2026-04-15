import { BaseAgent } from "./baseAgent";
import { PROMPTS } from "../promptManager";
import { ScreenContextData } from "../types";

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

  buildPrompt(input: ConversationalInput): string {
    return PROMPTS.CONVERSATIONAL.build(input.userMessage, input.screenContext, input.conversationHistory);
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
