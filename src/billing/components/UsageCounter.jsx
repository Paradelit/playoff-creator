// src/billing/components/UsageCounter.jsx
import { useEffect, useRef, useState } from 'react';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { useWorkspaceUsage } from '../useWorkspaceUsage';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const BUMP_DURATION_MS = 280;

/**
 * Counter visible en el header del área privada.
 * Solo se renderiza para usuarios free.
 */
export function UsageCounter() {
  const { activeWsId } = useWorkspace();
  const { isPro, loading: planLoading } = useWorkspacePlan(activeWsId);
  const { count, limit, isNearCap, isAtCap, loading: usageLoading } = useWorkspaceUsage(activeWsId);
  const reducedMotion = useReducedMotion();
  const [bump, setBump] = useState(false);
  const previousCountRef = useRef(count);

  useEffect(() => {
    if (reducedMotion) {
      previousCountRef.current = count;
      return;
    }
    if (count > previousCountRef.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), BUMP_DURATION_MS);
      previousCountRef.current = count;
      return () => clearTimeout(t);
    }
    previousCountRef.current = count;
  }, [count, reducedMotion]);

  if (planLoading || usageLoading || isPro) return null;

  const tone = isAtCap ? 'text-red-600' : isNearCap ? 'text-amber-600' : 'text-zinc-500';
  const bumpClass = bump ? 'scale-110' : 'scale-100';
  return (
    <span
      className={`inline-flex items-center text-xs font-medium transition-transform duration-200 ease-out ${tone} ${bumpClass}`}
      aria-label={`Llevas ${count} de ${limit} acciones de IA este mes`}
      title="Acciones de IA este mes"
    >
      {count}/{limit} IA
    </span>
  );
}
