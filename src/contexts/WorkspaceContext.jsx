/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from './FirebaseContext';
import { useAuth } from './AuthContext';

export function resolveActiveWsId(memberships, savedWsId) {
  if (!Array.isArray(memberships) || memberships.length === 0) {
    return null;
  }
  if (savedWsId && memberships.some((m) => m.wsId === savedWsId)) {
    return savedWsId;
  }
  const personal = memberships.find((m) => m.workspaceType === 'personal');
  if (personal) return personal.wsId;
  return memberships[0]?.wsId ?? null;
}

const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  return ctx;
}

const STORAGE_KEY = 'pickncoach.activeWsId';

function readSavedWsId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSavedWsId(wsId) {
  try {
    if (wsId) localStorage.setItem(STORAGE_KEY, wsId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function WorkspaceProvider({ children }) {
  const { db, appId } = useFirebase();
  const { user } = useAuth();

  const [memberships, setMemberships] = useState([]);
  const [activeWsId, setActiveWsIdState] = useState(null);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to user's memberships
  useEffect(() => {
    if (!db || !appId || !user?.uid) {
      setMemberships([]);
      setActiveWsIdState(null);
      setActiveWorkspace(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const ref = collection(db, 'artifacts', appId, 'users', user.uid, 'memberships');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list = snap.docs.map((d) => ({ wsId: d.id, ...d.data() }));
        setMemberships(list);
        setActiveWsIdState((current) => {
          if (current && list.some((m) => m.wsId === current)) return current;
          return resolveActiveWsId(list, readSavedWsId());
        });
        setIsLoading(false);
      },
      (err) => {
        console.error('[WorkspaceProvider] memberships snapshot error', err);
        setMemberships([]);
        setIsLoading(false);
      },
    );
    return unsub;
  }, [db, appId, user?.uid]);

  // Subscribe to the active workspace doc
  useEffect(() => {
    if (!db || !appId || !activeWsId) {
      setActiveWorkspace(null);
      return;
    }
    const ref = doc(db, 'artifacts', appId, 'workspaces', activeWsId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setActiveWorkspace(snap.exists() ? { wsId: snap.id, ...snap.data() } : null);
      },
      (err) => {
        console.error('[WorkspaceProvider] workspace doc snapshot error', err);
        setActiveWorkspace(null);
      },
    );
    return unsub;
  }, [db, appId, activeWsId]);

  const setActive = useCallback(
    (wsId) => {
      if (!memberships.some((m) => m.wsId === wsId)) {
        console.warn(`[WorkspaceProvider] setActiveWorkspace ignored: ${wsId} not in memberships`);
        return;
      }
      writeSavedWsId(wsId);
      setActiveWsIdState(wsId);
    },
    [memberships],
  );

  const value = useMemo(
    () => ({
      activeWsId,
      activeWorkspace,
      memberships,
      isLoading,
      setActiveWorkspace: setActive,
    }),
    [activeWsId, activeWorkspace, memberships, isLoading, setActive],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
