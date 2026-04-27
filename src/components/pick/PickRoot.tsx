import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePick } from '../../contexts/PickProvider';
import { isPublicPath } from '../../router/publicPaths';
import PickCompact from './PickCompact';
import PickPanel from './PickPanel';
import PickColumn from './PickColumn';

export default function PickRoot() {
  const location = useLocation();
  const { mode, isTransitioning, isDesktop } = usePick();

  // Pick is the authenticated assistant — never mount it on public surfaces
  // (landing, /ayuda, /ayuda/*, /login, /s/*, /exercise/*).
  if (isPublicPath(location.pathname)) return null;

  if (isTransitioning) return <PickCompact animating />;

  const effectiveMode = mode === 'column' && !isDesktop ? 'panel' : mode;

  switch (effectiveMode) {
    case 'compact':
      return <PickCompact />;
    case 'panel':
      return <PickPanel />;
    case 'column':
      return <PickColumn />;
    default:
      return <PickCompact />;
  }
}
