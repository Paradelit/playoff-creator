import React from 'react';
import { useLocation } from 'react-router-dom';
import { usePick } from '../../contexts/PickProvider';
import PickCompact from './PickCompact';
import PickPanel from './PickPanel';
import PickColumn from './PickColumn';

export default function PickRoot() {
  const location = useLocation();
  const { mode, isTransitioning, isDesktop } = usePick();

  if (location.pathname === '/login') return null;

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
