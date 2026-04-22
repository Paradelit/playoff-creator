import { BaseAgent } from "./baseAgent";
import { CompiledPrompt } from "../promptManager";

export interface TrainingInput {
  teamCategory: string;
  duration: number;
  objectives: string;
  focusAreas?: string[];
  playerCount?: number;
  constraints?: string;
}

export interface ExerciseBlock {
  name: string;
  duration: number;
  description: string;
  setup: string;
  variations?: string[];
  players: string;
  materials?: string[];
}

export interface TrainingOutput {
  title: string;
  totalDuration: number;
  warmup: ExerciseBlock;
  mainBlocks: ExerciseBlock[];
  cooldown: ExerciseBlock;
  notes: string;
}

export class TrainingGeneratorAgent extends BaseAgent<TrainingInput, TrainingOutput> {
  readonly name = "training";
  readonly description =
    "Genera sesiones de entrenamiento de baloncesto completas con calentamiento, bloques principales y vuelta a la calma, adaptadas a la categoría y objetivos del equipo.";

  validateInput(input: TrainingInput): TrainingInput {
    if (!input.objectives && (!input.focusAreas || input.focusAreas.length === 0)) {
      throw new Error("Se necesita al menos un objetivo o área de enfoque.");
    }
    return {
      ...input,
      teamCategory: input.teamCategory || "cadete",
      duration: input.duration || 90,
    };
  }

  async buildPrompt(input: TrainingInput): Promise<CompiledPrompt> {
    const focusStr = input.focusAreas?.length ? `\nÁreas de enfoque: ${input.focusAreas.join(", ")}` : "";
    const playersStr = input.playerCount ? `\nNúmero de jugadores: ${input.playerCount}` : "";
    const constraintsStr = input.constraints ? `\nRestricciones: ${input.constraints}` : "";

    return this.promptManager.compile("training-generation", {
      teamCategory: input.teamCategory,
      duration: String(input.duration),
      objectives: input.objectives,
      focusStr,
      playersStr,
      constraintsStr,
    });
  }

  processOutput(raw: unknown): TrainingOutput {
    const data = raw as Record<string, unknown>;
    return {
      title: (data.title as string) || "Sesión de entrenamiento",
      totalDuration: (data.totalDuration as number) || 90,
      warmup: (data.warmup as ExerciseBlock) || {
        name: "Calentamiento",
        duration: 10,
        description: "",
        setup: "",
        players: "Todo el grupo",
      },
      mainBlocks: Array.isArray(data.mainBlocks) ? data.mainBlocks : [],
      cooldown: (data.cooldown as ExerciseBlock) || {
        name: "Vuelta a la calma",
        duration: 5,
        description: "",
        setup: "",
        players: "Todo el grupo",
      },
      notes: (data.notes as string) || "",
    };
  }

  describe() {
    return {
      name: this.name,
      description: this.description,
      inputSchema:
        "{ teamCategory: string, duration: number, objectives: string, focusAreas?: string[], playerCount?: number, constraints?: string }",
    };
  }
}
