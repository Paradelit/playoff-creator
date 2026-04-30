import { formatTeamDisplayName } from '../../functions/src/shared/teamDomain';

export function teamDisplayName(team) {
  return formatTeamDisplayName(team);
}

// Trophy Amber is reserved (per DESIGN.md) for trophy/final/path. Team identity
// gradients use cool blues, slate, and a single warm orange accent so the bracket's
// amber wayfinding stays meaningful elsewhere.
export const TEAM_GRADIENTS = [
  'from-blue-900 via-blue-800 to-blue-700',
  'from-blue-800 via-blue-700 to-blue-600',
  'from-orange-700 via-orange-600 to-orange-500',
  'from-slate-800 via-slate-700 to-slate-600',
  'from-blue-950 via-blue-900 to-blue-800',
  'from-slate-900 via-slate-800 to-blue-900',
];

// Deterministic, stable hash so the same team always wears the same gradient
// across HomeScreen, TeamDetail, Bracket card, etc. Avoids storing colorIdx in
// Firestore while keeping continuity per team across devices/sessions.
export function teamGradientIndex(teamId) {
  if (!teamId) return 0;
  let hash = 0;
  const str = String(teamId);
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % TEAM_GRADIENTS.length;
}

export function teamGradient(teamId) {
  return TEAM_GRADIENTS[teamGradientIndex(teamId)];
}
