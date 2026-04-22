import { BaseAgent } from "./baseAgent";
import { CompiledPrompt } from "../promptManager";

export interface CalendarInput {
  excelText: string;
  teams: Array<{ id: string; teamName: string }>;
}

export interface CalendarAIResult {
  analysis: string;
  recurring: Array<{
    teamId: string;
    teamName: string;
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
    lugar: string;
    tipo: string;
  }>;
  specific: Array<{
    teamId: string;
    teamName: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    lugar: string;
    tipo: string;
    rival: string;
  }>;
}

export class CalendarAgent extends BaseAgent<CalendarInput, CalendarAIResult> {
  readonly name = "calendar";
  readonly description = "Analiza un archivo Excel con cuadrante de entrenamientos y extrae sesiones recurrentes y específicas para los equipos del entrenador.";

  validateInput(input: CalendarInput): CalendarInput {
    if (!input.excelText) {
      throw new Error("Se requiere el contenido del archivo Excel.");
    }
    if (!Array.isArray(input.teams) || input.teams.length === 0) {
      throw new Error("Se requiere al menos un equipo.");
    }
    return input;
  }

  async buildPrompt(input: CalendarInput): Promise<CompiledPrompt> {
    return this.promptManager.compile("calendar-import", {
      excelText: input.excelText.substring(0, 45000),
      teamsJson: JSON.stringify(input.teams),
    });
  }

  processOutput(raw: unknown): CalendarAIResult {
    const data = raw as Record<string, unknown>;
    return {
      analysis: (data.analysis as string) || "",
      recurring: Array.isArray(data.recurring) ? data.recurring : [],
      specific: Array.isArray(data.specific) ? data.specific : [],
    };
  }

  describe() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: '{ excelText: string, teams: [{ id, teamName }] }',
    };
  }
}
