import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFirebase } from '../contexts/FirebaseContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { subscribeToTeams } from '../services/teamsService';
import { useFirestoreSubscription } from './useFirestoreSubscription';

/**
 * Subscribe to teams visible to the caller in the active workspace.
 *
 * Sub-3 visibility scoping: owner del workspace ve TODOS los teams; cualquier
 * otro member ve solo los de su `activeMember.assignedTeamIds`. Sin esto, una
 * collection query a `teams` fallaría con permission-denied porque las rules
 * sub-3 bloquean la lectura de teams no asignados.
 *
 * Returns { teams, loading }.
 */
export function useTeams() {
  const { user } = useAuth();
  const { db, appId } = useFirebase();
  const { activeWsId, activeWorkspace, activeMember } = useWorkspace();

  const isOwner = !!user && !!activeWorkspace && activeWorkspace.ownerId === user.uid;

  // Stringificamos los ids como clave estable para que el useCallback no se
  // rehaga en cada render (la referencia del array cambia aunque el contenido
  // no). Aceptamos una pequeña copia por render — la lista es < 30 ids en V1.
  const rawIds = activeMember?.assignedTeamIds;
  const assignedKey = Array.isArray(rawIds) ? rawIds.join(',') : '';

  const subscribeFn = useCallback(
    (cb) => {
      const ids = assignedKey ? assignedKey.split(',') : [];
      const scope = isOwner ? { scope: 'all' } : { scope: 'assigned', assignedTeamIds: ids };
      return subscribeToTeams(activeWsId, db, appId, cb, scope);
    },
    [activeWsId, db, appId, isOwner, assignedKey],
  );

  // Esperamos a tener activeMember antes de suscribir si NO somos owner —
  // sino haríamos un query 'all' transitorio que dispararía permission-denied.
  const ready = !!user && !!db && !!activeWsId && !!activeWorkspace && (isOwner || !!activeMember);

  const { data: teams, loading } = useFirestoreSubscription(ready ? subscribeFn : null);

  return { teams, loading };
}
