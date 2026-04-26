import { describe, it, expect } from "vitest";
import { resolveAppNavigation } from "./appRouteCatalog";

describe("resolveAppNavigation", () => {
  it("resolves home and static routes under /area-privada", () => {
    expect(resolveAppNavigation("home", {})).toEqual({ path: "/area-privada", label: "Ir a inicio" });
    expect(resolveAppNavigation("teams", {})).toEqual({ path: "/area-privada/teams", label: "Ir a mis equipos" });
    expect(resolveAppNavigation("calendar", {})).toEqual({ path: "/area-privada/calendar", label: "Ir al calendario" });
  });

  it("requires teamId for team routes", () => {
    const r = resolveAppNavigation("team_detail", {});
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/teamId/i);
  });

  it("builds team detail path", () => {
    expect(resolveAppNavigation("team_detail", { teamId: "abc" })).toEqual({
      path: "/area-privada/teams/abc",
      label: "Ir al equipo",
    });
  });

  it("builds training editor path", () => {
    expect(resolveAppNavigation("training_editor", { teamId: "t1", trainingId: "tr1" })).toEqual({
      path: "/area-privada/teams/t1/trainings/tr1",
      label: "Abrir editor de entrenamiento",
    });
  });

  it("adds teamId query on playoffs when provided", () => {
    expect(resolveAppNavigation("playoffs", { teamId: "x y" })).toEqual({
      path: "/area-privada/playoffs?teamId=x%20y",
      label: "Ir a torneos (playoffs)",
    });
  });

  it("rejects unknown target", () => {
    const r = resolveAppNavigation("not_a_screen", {});
    expect("error" in r).toBe(true);
  });
});
