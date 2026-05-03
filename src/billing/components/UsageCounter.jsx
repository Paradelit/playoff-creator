// src/billing/components/UsageCounter.jsx
import { useWorkspacePlan } from '../useWorkspacePlan';
import { useWorkspaceUsage } from '../useWorkspaceUsage';
import { useWorkspace } from '../../contexts/WorkspaceContext';

/**
 * Counter visible en el header del área privada.
 * Solo se renderiza para usuarios free.
 */
export function UsageCounter() {
  const { activeWsId } = useWorkspace();
  const { isPro, loading: planLoading } = useWorkspacePlan(activeWsId);
  const { count, limit, isNearCap, isAtCap, loading: usageLoading } = useWorkspaceUsage(activeWsId);

  if (planLoading || usageLoading || isPro) return null;

  const tone = isAtCap ? 'text-red-600' : isNearCap ? 'text-amber-600' : 'text-zinc-500';
  return (
    <span
      className={`inline-flex items-center text-xs font-medium ${tone}`}
      aria-label={`Llevas ${count} de ${limit} acciones de IA este mes`}
      title="Acciones de IA este mes"
    >
      {count}/{limit} IA
    </span>
  );
}
