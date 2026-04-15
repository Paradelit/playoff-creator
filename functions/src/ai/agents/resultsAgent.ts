import { BaseAgent } from "./baseAgent";
import { PROMPTS } from "../promptManager";

export interface ResultsInput {
  bracketState: Array<{
    id: string;
    title: string;
    team1: string | null;
    team2: string | null;
    gamesCount: number;
    format: string;
  }>;
  resultsText: string;
}

export interface ResultsAIResult {
  updatedMatches: Array<{
    id: string;
    scores: Array<{ s1: string; s2: string }>;
  }>;
}

export class ResultsAgent extends BaseAgent<ResultsInput, ResultsAIResult> {
  readonly name = "results";
  readonly description = "Extrae puntuaciones de partidos a partir de actas o documentos de resultados y las asocia con los partidos del cuadro de playoffs.";

  validateInput(input: ResultsInput): ResultsInput {
    if (!Array.isArray(input.bracketState) || input.bracketState.length === 0) {
      throw new Error("Se requiere el estado del cuadro.");
    }
    if (!input.resultsText) {
      throw new Error("Se requiere el texto de resultados.");
    }
    return input;
  }

  buildPrompt(input: ResultsInput): string {
    return PROMPTS.RESULTS_EXTRACT.build(input.bracketState, input.resultsText);
  }

  processOutput(raw: unknown): ResultsAIResult {
    const data = raw as Record<string, unknown>;
    return {
      updatedMatches: Array.isArray(data.updatedMatches) ? data.updatedMatches : [],
    };
  }

  describe() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: '{ bracketState: [{ id, title, team1, team2, gamesCount, format }], resultsText: string }',
    };
  }
}
