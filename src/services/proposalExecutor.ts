import type { Firestore } from 'firebase/firestore';
import { setDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { userDocRef, userColRef } from './firestoreHelpers';
import type { WriteProposal } from './contentBlocks';

export interface ExecuteContext {
  db: Firestore;
  appId: string;
  uid: string;
}

/**
 * Execute a confirmed WriteProposal against Firestore.
 * Server never executes writes — it only proposes. The client runs these writes
 * under the authenticated user's security rules.
 */
export async function executeProposal(ctx: ExecuteContext, proposal: WriteProposal): Promise<void> {
  const { db, appId, uid } = ctx;
  const { kind, payload } = proposal;

  switch (kind) {
    case 'create_training': {
      const training = payload.training as Record<string, unknown> | undefined;
      const teamId = payload.teamId as string | undefined;
      if (!training || !teamId) throw new Error('Propuesta inválida: falta training o teamId');
      const id = (training.id as string) || `tr_${Date.now()}`;
      await setDoc(
        doc(userColRef(db, appId, uid, 'teams'), teamId, 'trainings', id),
        { ...training, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true },
      );
      return;
    }

    case 'create_calendar_session': {
      const session = payload.session as Record<string, unknown> | undefined;
      if (!session) throw new Error('Propuesta inválida: falta session');
      const id = (session.id as string) || `cal_${Date.now()}`;
      await setDoc(
        userDocRef(db, appId, uid, 'calendarSessions', id),
        { ...session, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true },
      );
      return;
    }

    case 'update_bracket_scores': {
      const bracketId = payload.bracketId as string | undefined;
      const updates = payload.updates as Array<{ matchId: string; scores: unknown[] }> | undefined;
      if (!bracketId || !updates) throw new Error('Propuesta inválida: falta bracketId o updates');
      const ref = userDocRef(db, appId, uid, 'brackets', bracketId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Bracket no encontrado');
      const bracket = snap.data() as { state?: Record<string, { scores?: unknown[] }> };
      const state = { ...(bracket.state || {}) };
      for (const u of updates) {
        if (!state[u.matchId]) continue;
        state[u.matchId] = { ...state[u.matchId], scores: u.scores };
      }
      await setDoc(ref, { state, updatedAt: serverTimestamp() }, { merge: true });
      return;
    }

    case 'save_note': {
      const teamId = payload.teamId as string | undefined;
      const text = payload.text as string | undefined;
      const append = payload.append as boolean | undefined;
      if (!teamId || typeof text !== 'string') {
        throw new Error('Propuesta inválida: falta teamId o text');
      }
      const ref = doc(userColRef(db, appId, uid, 'teams'), teamId, 'cuaderno', 'notas');
      let finalText = text;
      if (append) {
        const snap = await getDoc(ref);
        const prev = snap.exists() ? (snap.data().texto as string) || '' : '';
        finalText = prev ? `${prev}\n\n${text}` : text;
      }
      await setDoc(ref, { texto: finalText, updatedAt: serverTimestamp() }, { merge: true });
      return;
    }

    case 'create_bracket': {
      const bracket = payload.bracket as Record<string, unknown> | undefined;
      if (!bracket) throw new Error('Propuesta inválida: falta bracket');
      const id = (bracket.id as string) || `bracket_${Date.now()}`;
      await setDoc(
        userDocRef(db, appId, uid, 'brackets', id),
        { ...bracket, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true },
      );
      return;
    }

    case 'save_attendance': {
      const teamId = payload.teamId as string | undefined;
      const sessionId = payload.sessionId as string | undefined;
      const attendance = payload.attendance as Record<string, unknown> | undefined;
      if (!teamId || !sessionId || !attendance)
        throw new Error('Propuesta inválida: falta teamId, sessionId o attendance');

      const ref = doc(userColRef(db, appId, uid, 'teams'), teamId, 'cuaderno', 'asistencia');
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};

      await setDoc(
        ref,
        {
          ...data,
          [sessionId]: attendance,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    case 'save_player_report': {
      const teamId = payload.teamId as string | undefined;
      const report = payload.report as Record<string, unknown> | undefined;
      if (!teamId || !report) throw new Error('Propuesta inválida: falta teamId o report');

      const ref = doc(userColRef(db, appId, uid, 'teams'), teamId, 'cuaderno', 'informe-jugadores');
      await setDoc(
        ref,
        {
          ...report,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    case 'save_shooting_test': {
      const teamId = payload.teamId as string | undefined;
      const testResults = payload.testResults as Record<string, unknown> | undefined;
      if (!teamId || !testResults) throw new Error('Propuesta inválida: falta teamId o testResults');

      const ref = doc(userColRef(db, appId, uid, 'teams'), teamId, 'cuaderno', 'test-tiro');
      await setDoc(
        ref,
        {
          ...testResults,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    case 'save_scouting': {
      const sessionId = payload.sessionId as string | undefined;
      const scoutingData = payload.scoutingData as Record<string, unknown> | undefined;
      if (!sessionId || !scoutingData) throw new Error('Propuesta inválida: falta sessionId o scoutingData');

      const ref = userDocRef(db, appId, uid, 'scoutings', sessionId);
      await setDoc(
        ref,
        {
          ...scoutingData,
          sessionId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    case 'save_analysis': {
      const sessionId = payload.sessionId as string | undefined;
      const analysisData = payload.analysisData as Record<string, unknown> | undefined;
      if (!sessionId || !analysisData) throw new Error('Propuesta inválida: falta sessionId o analysisData');

      const ref = userDocRef(db, appId, uid, 'analisis', sessionId);
      await setDoc(
        ref,
        {
          ...analysisData,
          sessionId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    default:
      throw new Error(`Tipo de propuesta desconocido: ${kind}`);
  }
}
