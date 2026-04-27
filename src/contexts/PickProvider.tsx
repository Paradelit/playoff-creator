/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext } from 'react';
import { usePickInternal } from '../hooks/usePick';
import type { PickAPI } from '../hooks/usePick';

const PickCtx = createContext<PickAPI | null>(null);

export function PickProvider({ children }: { children: React.ReactNode }) {
  const pick = usePickInternal();
  return <PickCtx.Provider value={pick}>{children}</PickCtx.Provider>;
}

export function usePick(): PickAPI {
  const ctx = useContext(PickCtx);
  if (!ctx) throw new Error('usePick must be used within PickProvider');
  return ctx;
}
