import type { MemoryType } from "../tools/memoryTools";

/**
 * Tipos del digest que se inyecta al system prompt de Pick en cada turno.
 * Extraídos de userDigest.ts en sub-A.1 para que cada builder por dominio
 * (teams, calendar, brackets) tenga su propio archivo y los enriquecimientos
 * de sub-A.2 quepan sin que userDigest.ts crezca.
 */

export interface DigestTeam {
  id: string;
  name: string;
  categoria?: string;
  nivel?: string;
  memberCount: number;
}

export interface DigestBracket {
  id: string;
  name: string;
  teamId?: string | null;
}

export interface DigestSession {
  id: string;
  fecha: string;
  horaInicio?: string;
  tipo?: string;
  teamName?: string;
  rival?: string;
  lugar?: string;
}

export interface DigestMemory {
  id: string;
  type: MemoryType;
  content: string;
}

export interface DigestPreferences {
  proactivityMode?: string;
  defaultTrainingDuration?: number;
}

export interface UserDigest {
  teams: DigestTeam[];
  activeBrackets: DigestBracket[];
  upcomingSessions: DigestSession[];
  preferences: DigestPreferences;
  memories: DigestMemory[];
  todayISO: string;
}
