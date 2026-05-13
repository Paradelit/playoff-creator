import { describe, expect, it } from "vitest";
import { buildPendingConvocatorias } from "../../digest/pendingConvocatorias";

const NOW = new Date("2026-05-13T10:00:00");

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    fecha: "2026-05-15",
    horaInicio: "18:00",
    tipo: "partido",
    teamId: "tA",
    teamName: "Cadete A",
    rival: "Hispano",
    ...overrides,
  };
}

describe("buildPendingConvocatorias", () => {
  it("includes futuro partido sin convocatoria dentro de ventana 72h", () => {
    const result = buildPendingConvocatorias({
      sessions: [session()],
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe("s1");
    expect(result[0].teamId).toBe("tA");
  });

  it("excludes session marcada como convocatoriaSentAt", () => {
    const result = buildPendingConvocatorias({
      sessions: [session({ convocatoriaSentAt: new Date() })],
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("excludes session pasada", () => {
    const result = buildPendingConvocatorias({
      sessions: [session({ fecha: "2026-05-10" })],
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("excludes session fuera de la ventana de recordatorio", () => {
    const result = buildPendingConvocatorias({
      sessions: [session({ fecha: "2026-06-15" })], // ~33 días → fuera de 72h
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("excludes session que no es partido ni playoff", () => {
    const result = buildPendingConvocatorias({
      sessions: [session({ tipo: "entrenamiento" })],
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(result).toHaveLength(0);
  });

  it("includes session tipo playoff (no solo partido)", () => {
    const result = buildPendingConvocatorias({
      sessions: [session({ tipo: "playoff" })],
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(result).toHaveLength(1);
  });

  it("marca severity high cuando faltan <24h", () => {
    const result = buildPendingConvocatorias({
      sessions: [session({ fecha: "2026-05-13", horaInicio: "20:00" })], // mismo día, ~10h
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(result[0].severity).toBe("high");
  });

  it("usa convocatoriaReminderHours del team cuando definido", () => {
    // Team con ventana custom 168h (1 semana): session a 5 días entra.
    const fiveDaysFromNow = new Date(NOW.getTime() + 5 * 86400000)
      .toISOString()
      .slice(0, 10);
    const tight = buildPendingConvocatorias({
      sessions: [session({ fecha: fiveDaysFromNow })],
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(tight).toHaveLength(0); // default 72h excluye

    const wide = buildPendingConvocatorias({
      sessions: [session({ fecha: fiveDaysFromNow })],
      reminderHoursByTeam: new Map([["tA", 168]]),
      now: NOW,
    });
    expect(wide).toHaveLength(1);
  });

  it("ordena: high primero, dentro de cada severity el más inminente primero", () => {
    const result = buildPendingConvocatorias({
      sessions: [
        // Mismo día +20h → high
        session({ id: "s-high-1", fecha: "2026-05-14", horaInicio: "06:00" }),
        // Mañana +56h → normal
        session({ id: "s-normal-late", fecha: "2026-05-15", horaInicio: "18:00" }),
        // Mismo día +10h → high inminente
        session({ id: "s-high-imminent", fecha: "2026-05-13", horaInicio: "20:00" }),
      ],
      reminderHoursByTeam: new Map(),
      now: NOW,
    });
    expect(result.map((r) => r.sessionId)).toEqual([
      "s-high-imminent",
      "s-high-1",
      "s-normal-late",
    ]);
  });
});
