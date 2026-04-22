export interface TeamRecord {
  id?: string;
  teamName?: string | null;
  categoria?: string | null;
  "año"?: string | null;
  letra?: string | null;
  genero?: string | null;
  division?: string | null;
}

export function formatTeamDisplayName(team: Partial<TeamRecord> | null | undefined): string {
  if (!team) return "";

  const categoria = typeof team.categoria === "string" ? team.categoria.trim() : "";
  const year = typeof team["año"] === "string" ? team["año"].trim() : "";
  const letra = typeof team.letra === "string" ? team.letra.trim() : "";
  const genero = typeof team.genero === "string" ? team.genero.trim() : "";
  const division = typeof team.division === "string" ? team.division.trim() : "";
  const storedName = typeof team.teamName === "string" ? team.teamName.trim() : "";

  const parts = [categoria];
  if (categoria === "Senior") {
    if (division) parts.push(division);
  } else if (year) {
    parts.push(year);
  }
  if (letra) parts.push(letra);

  const computed = parts.filter(Boolean).join(" ");
  if (!computed) return storedName;
  return genero ? `${computed} · ${genero}` : computed;
}
