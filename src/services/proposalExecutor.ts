import type { Firestore } from 'firebase/firestore';
import { setDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { userDocRef, userColRef } from './firestoreHelpers';
import type { WriteProposal, WriteProposalKind } from './contentBlocks';
import { calculateMatchWinner } from '../utils/bracketEngine';

export interface ExecuteContext {
  db: Firestore;
  appId: string;
  uid: string;
}

type ProposalPayload = WriteProposal['payload'];
type ProposalHandler = (ctx: ExecuteContext, payload: ProposalPayload) => Promise<void>;

function invalidProposal(message: string): Error {
  return new Error(`Propuesta invalida: ${message}`);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function normalizeScores(rawScores: unknown, fallbackSize: number): Array<{ s1: string; s2: string }> {
  const scores = Array.isArray(rawScores) ? rawScores : [];
  const size = Math.max(fallbackSize, scores.length || 0, 1);
  return Array.from({ length: size }, (_, index) => {
    const score = scores[index];
    if (!score || typeof score !== 'object') return { s1: '', s2: '' };
    const entry = score as Record<string, unknown>;
    return {
      s1: entry.s1 == null ? '' : String(entry.s1),
      s2: entry.s2 == null ? '' : String(entry.s2),
    };
  });
}

function cloneBracketState(bracketData: Record<string, unknown>) {
  const rawState = asRecord(bracketData.state);
  if (!rawState) return {};
  return Object.fromEntries(Object.entries(rawState).map(([key, value]) => [key, { ...(asRecord(value) || {}) }]));
}

function assignWinnerToNextMatch(
  state: Record<string, Record<string, unknown>>,
  matchId: string,
  winner: string | null,
) {
  const match = state[matchId];
  if (!match || typeof match.nextId !== 'string' || typeof match.slot !== 'string') return null;

  const nextMatch = state[match.nextId];
  if (!nextMatch) return match.nextId;

  const scoreKey = match.slot === 'team1' ? 's1' : 's2';
  state[match.nextId] = {
    ...nextMatch,
    [match.slot]: winner,
    scores: normalizeScores(nextMatch.scores, Number(nextMatch.gamesCount) || 1).map((score) => ({
      ...score,
      [scoreKey]: '',
    })),
  };

  return match.nextId;
}

function refreshWinnerCascade(
  state: Record<string, Record<string, unknown>>,
  matchId: string | null | undefined,
): void {
  if (!matchId || !state[matchId]) return;

  const match = state[matchId];
  const scores = normalizeScores(match.scores, Number(match.gamesCount) || 1);
  const winner = calculateMatchWinner({ ...match, scores });

  state[matchId] = { ...match, scores, winner };
  const nextId = assignWinnerToNextMatch(state, matchId, winner);
  if (nextId) refreshWinnerCascade(state, nextId);
}

async function resolveBracketWriteTarget(ctx: ExecuteContext, bracketId: string) {
  const userRef = userDocRef(ctx.db, ctx.appId, ctx.uid, 'brackets', bracketId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('Bracket no encontrado');

  const userBracket = asRecord(userSnap.data()) || {};
  const shareCode = typeof userBracket.shareCode === 'string' ? userBracket.shareCode : '';
  if (!shareCode) return { ref: userRef, bracket: userBracket };

  const sharedRef = doc(ctx.db, 'artifacts', ctx.appId, 'shared', shareCode);
  const sharedSnap = await getDoc(sharedRef);
  if (!sharedSnap.exists()) throw new Error('Bracket compartido no encontrado');

  return { ref: sharedRef, bracket: (asRecord(sharedSnap.data()) || {}) as Record<string, unknown> };
}

async function handleCreateTraining(ctx: ExecuteContext, payload: ProposalPayload) {
  const training = asRecord(payload.training);
  const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
  if (!training || !teamId) throw invalidProposal('falta training o teamId');

  const id = (training.id as string) || `tr_${Date.now()}`;
  await setDoc(
    doc(userColRef(ctx.db, ctx.appId, ctx.uid, 'teams'), teamId, 'trainings', id),
    { ...training, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

async function handleCreateCalendarSession(ctx: ExecuteContext, payload: ProposalPayload) {
  const session = asRecord(payload.session);
  if (!session) throw invalidProposal('falta session');

  const id = (session.id as string) || `cal_${Date.now()}`;
  await setDoc(
    userDocRef(ctx.db, ctx.appId, ctx.uid, 'calendarSessions', id),
    { ...session, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

async function handleUpdateBracketScores(ctx: ExecuteContext, payload: ProposalPayload) {
  const bracketId = typeof payload.bracketId === 'string' ? payload.bracketId : undefined;
  const updates = Array.isArray(payload.updates) ? payload.updates : undefined;
  if (!bracketId || !updates) throw invalidProposal('falta bracketId o updates');

  const { ref, bracket } = await resolveBracketWriteTarget(ctx, bracketId);
  const bracketData = asRecord(bracket.bracketData) || {};
  const state = cloneBracketState(bracketData);

  for (const rawUpdate of updates) {
    const update = asRecord(rawUpdate);
    const matchId = typeof update?.matchId === 'string' ? update.matchId : undefined;
    if (!matchId) continue;

    const currentMatch = state[matchId];
    if (!currentMatch) continue;

    const scores = normalizeScores(update.scores, Number(currentMatch.gamesCount) || 1);
    const winner = calculateMatchWinner({ ...currentMatch, scores });
    state[matchId] = { ...currentMatch, scores, winner };

    const nextId = assignWinnerToNextMatch(state, matchId, winner);
    if (nextId) refreshWinnerCascade(state, nextId);
  }

  await setDoc(
    ref,
    {
      bracketData: { ...bracketData, state },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function handleSaveNote(ctx: ExecuteContext, payload: ProposalPayload) {
  const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
  const text = typeof payload.text === 'string' ? payload.text : undefined;
  const append = payload.append === true;
  if (!teamId || typeof text !== 'string') throw invalidProposal('falta teamId o text');

  const ref = doc(userColRef(ctx.db, ctx.appId, ctx.uid, 'teams'), teamId, 'cuaderno', 'notas');
  let finalText = text;

  if (append) {
    const snap = await getDoc(ref);
    const previousData = snap.exists() ? asRecord(snap.data()) : undefined;
    const previousText = typeof previousData?.texto === 'string' ? previousData.texto : '';
    finalText = previousText ? `${previousText}\n\n${text}` : text;
  }

  await setDoc(ref, { texto: finalText, updatedAt: serverTimestamp() }, { merge: true });
}

async function handleCreateBracket(ctx: ExecuteContext, payload: ProposalPayload) {
  const bracket = asRecord(payload.bracket);
  if (!bracket) throw invalidProposal('falta bracket');

  const id = (bracket.id as string) || `bracket_${Date.now()}`;
  const teamId = (payload.teamId as string | undefined) || (bracket.teamId as string | undefined) || null;
  const teamName = (payload.teamName as string | undefined) || (bracket.teamName as string | undefined) || null;

  await setDoc(
    userDocRef(ctx.db, ctx.appId, ctx.uid, 'brackets', id),
    { ...bracket, id, teamId, teamName, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

async function handleSaveAttendance(ctx: ExecuteContext, payload: ProposalPayload) {
  const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined;
  const attendance = asRecord(payload.attendance);
  if (!teamId || !sessionId || !attendance) {
    throw invalidProposal('falta teamId, sessionId o attendance');
  }

  const ref = doc(userColRef(ctx.db, ctx.appId, ctx.uid, 'teams'), teamId, 'cuaderno', 'asistencia');
  const snap = await getDoc(ref);
  const data = snap.exists() ? asRecord(snap.data()) || {} : {};

  await setDoc(
    ref,
    {
      ...data,
      attendance: {
        ...((asRecord(data.attendance) || {}) as Record<string, unknown>),
        [sessionId]: attendance,
      },
      manualSessions: asRecord(data.manualSessions) || {},
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function handleSavePlayerReport(ctx: ExecuteContext, payload: ProposalPayload) {
  const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
  const report = asRecord(payload.report);
  if (!teamId || !report) throw invalidProposal('falta teamId o report');

  const rows = Array.isArray(report.rows) ? report.rows : [];
  const ref = doc(userColRef(ctx.db, ctx.appId, ctx.uid, 'teams'), teamId, 'cuaderno', 'informe-jugadores');
  await setDoc(ref, { ...report, rows, updatedAt: serverTimestamp() }, { merge: true });
}

async function handleSaveShootingTest(ctx: ExecuteContext, payload: ProposalPayload) {
  const teamId = typeof payload.teamId === 'string' ? payload.teamId : undefined;
  const testResults = asRecord(payload.testResults);
  if (!teamId || !testResults) throw invalidProposal('falta teamId o testResults');

  const tables = testResults.tables !== undefined ? testResults.tables : testResults;
  const ref = doc(userColRef(ctx.db, ctx.appId, ctx.uid, 'teams'), teamId, 'cuaderno', 'test-tiro');
  await setDoc(ref, { ...testResults, tables, updatedAt: serverTimestamp() }, { merge: true });
}

async function handleSaveScouting(ctx: ExecuteContext, payload: ProposalPayload) {
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined;
  const scoutingData = asRecord(payload.scoutingData);
  if (!sessionId || !scoutingData) throw invalidProposal('falta sessionId o scoutingData');

  const ref = userDocRef(ctx.db, ctx.appId, ctx.uid, 'scoutings', sessionId);
  await setDoc(ref, { ...scoutingData, sessionId, updatedAt: serverTimestamp() }, { merge: true });
}

async function handleSaveAnalysis(ctx: ExecuteContext, payload: ProposalPayload) {
  const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : undefined;
  const analysisData = asRecord(payload.analysisData);
  if (!sessionId || !analysisData) throw invalidProposal('falta sessionId o analysisData');

  const ref = userDocRef(ctx.db, ctx.appId, ctx.uid, 'analisis', sessionId);
  await setDoc(ref, { ...analysisData, sessionId, updatedAt: serverTimestamp() }, { merge: true });
}

function normalizeExerciseTags(exercise: Record<string, unknown>): Record<string, unknown> {
  const tags = Array.isArray(exercise.tags) ? exercise.tags : [];
  const contenido = typeof exercise.contenido === 'string' && exercise.contenido ? exercise.contenido : tags.join(', ');
  return { ...exercise, tags, contenido };
}

async function handleCreateExercise(ctx: ExecuteContext, payload: ProposalPayload) {
  const exercise = asRecord(payload.exercise);
  if (!exercise) throw invalidProposal('falta exercise');
  if (!exercise.nombre) throw invalidProposal('falta nombre del ejercicio');

  const id = (exercise.id as string) || `ex_${Date.now()}`;
  const normalized = normalizeExerciseTags({ ...exercise, id });
  await setDoc(
    userDocRef(ctx.db, ctx.appId, ctx.uid, 'exercises', id),
    { ...normalized, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

async function handleCreateExercises(ctx: ExecuteContext, payload: ProposalPayload) {
  const exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
  if (exercises.length === 0) throw invalidProposal('array de ejercicios vac\u00edo');

  for (const raw of exercises) {
    const exercise = asRecord(raw);
    if (!exercise || !exercise.nombre) continue;
    await handleCreateExercise(ctx, { exercise });
  }
}

const proposalHandlers: Record<WriteProposalKind, ProposalHandler> = {
  create_training: handleCreateTraining,
  create_calendar_session: handleCreateCalendarSession,
  update_bracket_scores: handleUpdateBracketScores,
  save_note: handleSaveNote,
  create_bracket: handleCreateBracket,
  save_attendance: handleSaveAttendance,
  save_player_report: handleSavePlayerReport,
  save_shooting_test: handleSaveShootingTest,
  save_scouting: handleSaveScouting,
  save_analysis: handleSaveAnalysis,
  create_exercise: handleCreateExercise,
  create_exercises: handleCreateExercises,
};

/**
 * Execute a confirmed WriteProposal against Firestore.
 * Server never executes writes: it only proposes. The client runs these writes
 * under the authenticated user's security rules.
 */
export async function executeProposal(ctx: ExecuteContext, proposal: WriteProposal): Promise<void> {
  const handler = proposalHandlers[proposal.kind];
  if (!handler) {
    throw new Error(`Tipo de propuesta desconocido: ${proposal.kind}`);
  }
  await handler(ctx, proposal.payload);
}
