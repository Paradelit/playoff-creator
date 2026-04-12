export function teamDisplayName(team) {
  const parts = [team.categoria];
  if (team.categoria === 'Senior') {
    if (team.division) parts.push(team.division);
  } else {
    if (team.año) parts.push(team.año);
  }
  if (team.letra) parts.push(team.letra);
  const genero = team.genero ? ` · ${team.genero}` : '';
  return parts.join(' ') + genero;
}
