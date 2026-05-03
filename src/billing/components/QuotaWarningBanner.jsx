// src/billing/components/QuotaWarningBanner.jsx
import { Link } from 'react-router-dom';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { useWorkspaceUsage } from '../useWorkspaceUsage';
import { useWorkspace } from '../../contexts/WorkspaceContext';

/**
 * Banner sutil que aparece cuando free user está al 80%+ del cap.
 * Voz Pick: tutea, baloncesto-nativo.
 */
export function QuotaWarningBanner() {
  const { activeWsId } = useWorkspace();
  const { isPro } = useWorkspacePlan(activeWsId);
  const { count, limit, isNearCap, isAtCap } = useWorkspaceUsage(activeWsId);

  if (isPro || !isNearCap || isAtCap) return null;

  const remaining = limit - count;
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 text-sm flex items-center justify-between">
      <span className="text-amber-900">
        Te quedan <strong>{remaining}</strong> acciones de IA este mes. Pasa a Pro para que Pick no mire el reloj.
      </span>
      <Link
        to="/upgrade"
        className="ml-4 px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 text-xs font-medium"
      >
        Hazte Pro
      </Link>
    </div>
  );
}
