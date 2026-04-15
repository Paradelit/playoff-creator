import { BaseAgent } from "./baseAgent";
import { PROMPTS } from "../promptManager";

export interface BracketInput {
  basesText: string;
  clasifText: string;
  userInstructions?: string;
}

interface BracketMatch {
  title: string;
  team1: string | null;
  team2: string | null;
  team1Origin: string;
  team2Origin: string;
  team1Options: string[];
  team2Options: string[];
}

export interface BracketAIResult {
  tournamentName: string;
  analysis: string;
  rounds: Array<{
    name: string;
    dates: string[];
    format: string;
    gamesCount: number;
  }>;
  initialMatches: BracketMatch[];
}

export class BracketAgent extends BaseAgent<BracketInput, BracketAIResult> {
  readonly name = "bracket";
  readonly description = "Analiza documentos de competición (bases + clasificación) y genera la estructura de un cuadro de playoffs con los cruces correctos.";

  validateInput(input: BracketInput): BracketInput {
    if (!input.basesText || !input.clasifText) {
      throw new Error("Se requieren los textos de bases y clasificación.");
    }
    return input;
  }

  buildPrompt(input: BracketInput): string {
    return PROMPTS.BRACKET_CREATION.build(
      input.basesText,
      input.clasifText,
      input.userInstructions
    );
  }

  processOutput(raw: unknown, _input: BracketInput): BracketAIResult {
    const data = raw as Record<string, unknown>;

    if (!data || !Array.isArray(data.initialMatches) || data.initialMatches.length === 0) {
      throw new Error("La IA no devolvió un cuadro válido.");
    }

    // Validate and normalize match count to power of 2
    let matches = data.initialMatches as BracketMatch[];
    const len = matches.length;
    const isPowerOf2 = len > 0 && (len & (len - 1)) === 0;
    if (!isPowerOf2) {
      const nearestPow2 = Math.pow(2, Math.floor(Math.log2(len)));
      matches = matches.slice(0, nearestPow2);
    }

    // Normalize each match to ensure required fields
    const normalizedMatches: BracketMatch[] = matches.map((m, i) => ({
      title: m.title || `Partido ${i + 1}`,
      team1: m.team1 || null,
      team2: m.team2 || null,
      team1Origin: m.team1Origin || "",
      team2Origin: m.team2Origin || "",
      team1Options: Array.isArray(m.team1Options) ? m.team1Options : [],
      team2Options: Array.isArray(m.team2Options) ? m.team2Options : [],
    }));

    return {
      tournamentName: (data.tournamentName as string) || "",
      analysis: (data.analysis as string) || "",
      rounds: Array.isArray(data.rounds) ? data.rounds : [],
      initialMatches: normalizedMatches,
    };
  }

  describe() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: '{ basesText: string, clasifText: string, userInstructions?: string }',
    };
  }
}
