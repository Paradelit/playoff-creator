import { doc, getDoc, setDoc } from 'firebase/firestore';
import { userDocRef } from './firestoreHelpers';
import { calculateMatchWinner } from '../utils/bracketEngine';
import { parseDateToISO } from '../utils/calendarUtils';

function ensureArrayLength(arr, len, fill = '') {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < len) out.push(fill);
  if (out.length > len) out.length = len;
  return out;
}

/**
 * Resolve the correct Firestore ref for a bracket.
 * Shared brackets store bracketData in artifacts/{appId}/shared/{shareCode},
 * while local brackets store everything in users/{uid}/brackets/{id}.
 * Returns { ref, bracketDoc } or null if not found.
 */
async function resolveBracketRef(bracketId, { uid, db, appId }) {
  const userRef = userDocRef(db, appId, uid, 'brackets', bracketId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return null;
  const userData = userSnap.data();

  // Shared bracket: bracketData lives in the shared doc
  if (userData.shareCode) {
    const sharedRef = doc(db, 'artifacts', appId, 'shared', userData.shareCode);
    const sharedSnap = await getDoc(sharedRef);
    if (!sharedSnap.exists()) return null;
    return { ref: sharedRef, bracketDoc: sharedSnap.data() };
  }

  // Local bracket: everything is in the user doc
  return { ref: userRef, bracketDoc: userData };
}

/**
 * Update a specific game (gameIndex) of a bracket match with the provided
 * schedule fields. Arrays dates/times/endTimes/places are kept parallel to
 * scores/gamesCount. Returns true on success.
 */
export async function updatePlayoffMatchSchedule(
  bracketId,
  matchId,
  gameIndex,
  { fecha, horaInicio, horaFin, lugar },
  { uid, db, appId },
) {
  if (!bracketId || !matchId) return false;
  const resolved = await resolveBracketRef(bracketId, { uid, db, appId });
  if (!resolved) return false;
  const { ref: bracketRef, bracketDoc } = resolved;
  const match = bracketDoc.bracketData?.state?.[matchId];
  if (!match) return false;

  const size = Math.max(match.gamesCount || 1, (match.scores || []).length, gameIndex + 1);
  const dates = ensureArrayLength(match.dates, size, '');
  const times = ensureArrayLength(match.times, size, '');
  const endTimes = ensureArrayLength(match.endTimes, size, '');
  const places = ensureArrayLength(match.places, size, '');

  if (fecha !== undefined) dates[gameIndex] = fecha || '';
  if (horaInicio !== undefined) times[gameIndex] = horaInicio || '';
  if (horaFin !== undefined) endTimes[gameIndex] = horaFin || '';
  if (lugar !== undefined) places[gameIndex] = lugar || '';

  const updatedMatch = { ...match, dates, times, endTimes, places };
  const updatedState = {
    ...bracketDoc.bracketData.state,
    [matchId]: updatedMatch,
  };

  await setDoc(bracketRef, {
    ...bracketDoc,
    bracketData: { ...bracketDoc.bracketData, state: updatedState },
  });
  return true;
}

/**
 * Update the score of a specific game (gameIndex) of a bracket match from
 * calendar-side input (scoreLocal, scoreVisitante). Re-computes the series
 * winner and propagates it to the next round.
 */
export async function updatePlayoffMatchScoreFromSession(
  { bracketId, bracketMatchId, gameIndex, isMyTeamTeam1 },
  { local, visitante },
  { uid, db, appId },
) {
  if (!bracketId || !bracketMatchId) return false;
  const resolved = await resolveBracketRef(bracketId, { uid, db, appId });
  if (!resolved) return false;
  const { ref: bracketRef, bracketDoc } = resolved;
  const match = bracketDoc.bracketData?.state?.[bracketMatchId];
  if (!match) return false;

  const size = Math.max(match.gamesCount || 1, (match.scores || []).length, gameIndex + 1);
  const scores = Array.from({ length: size }, (_, i) => ({
    s1: match.scores?.[i]?.s1 ?? '',
    s2: match.scores?.[i]?.s2 ?? '',
  }));
  const s1 = isMyTeamTeam1 ? local : visitante;
  const s2 = isMyTeamTeam1 ? visitante : local;
  scores[gameIndex] = {
    s1: s1 === undefined || s1 === null ? '' : String(s1),
    s2: s2 === undefined || s2 === null ? '' : String(s2),
  };
  const updatedMatch = { ...match, scores };
  const newWinner = calculateMatchWinner(updatedMatch);
  updatedMatch.winner = newWinner;

  const updatedState = { ...bracketDoc.bracketData.state, [bracketMatchId]: updatedMatch };

  if (match.winner && match.winner !== newWinner && match.nextId) {
    let currId = match.nextId;
    let prevId = bracketMatchId;
    while (currId) {
      const slot = updatedState[prevId]?.slot;
      if (!slot) break;
      const teamToClear = match.winner;
      if (updatedState[currId][slot] === teamToClear) {
        updatedState[currId] = {
          ...updatedState[currId],
          [slot]: null,
          scores: (updatedState[currId].scores || []).map((g) => ({
            ...g,
            [slot === 'team1' ? 's1' : 's2']: '',
          })),
        };
      }
      if (updatedState[currId].winner === teamToClear) {
        updatedState[currId] = { ...updatedState[currId], winner: null };
        prevId = currId;
        currId = updatedState[currId].nextId;
      } else break;
    }
  }
  if (newWinner && match.nextId && match.slot) {
    updatedState[match.nextId] = {
      ...updatedState[match.nextId],
      [match.slot]: newWinner,
    };
  }

  await setDoc(bracketRef, {
    ...bracketDoc,
    bracketData: { ...bracketDoc.bracketData, state: updatedState },
  });
  return true;
}

/**
 * Read the bracket match's score for a specific game and return the local /
 * visitante values as seen from the `myTeam`'s perspective.
 */
export function readPlayoffGameResult(session) {
  if (!session || !session.bracketMatchId) return { local: '', visitante: '' };
  const sc = session.scores?.[session.gameIndex];
  if (!sc) return { local: '', visitante: '' };
  const myS = session.isMyTeamTeam1 ? sc.s1 : sc.s2;
  const rivS = session.isMyTeamTeam1 ? sc.s2 : sc.s1;
  return { local: myS || '', visitante: rivS || '' };
}

/**
 * Helper: convert an ISO date (YYYY-MM-DD) or DD/MM/YYYY to the bracket's
 * preferred DD/MM/YYYY format (matches existing data from the AI flow).
 */
export function toBracketDate(dateStr) {
  const iso = parseDateToISO(dateStr);
  if (!iso) return dateStr || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
