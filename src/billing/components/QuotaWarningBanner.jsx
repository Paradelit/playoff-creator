// src/billing/components/QuotaWarningBanner.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { useWorkspaceUsage } from '../useWorkspaceUsage';
import { useWorkspace } from '../../contexts/WorkspaceContext';

/**
 * Banner sutil que aparece cuando free user está al 80%+ del cap.
 * Voz Pick: tutea, baloncesto-nativo.
 *
 * En clubs: solo el owner (DT) ve el CTA accionable. Coaches ven la
 * advertencia sin CTA para no inflar acciones de gestión que no les pertenecen.
 */
export function QuotaWarningBanner() {
  const { user } = useAuth();
  const { activeWsId, activeWorkspace } = useWorkspace();
  const { isPro } = useWorkspacePlan(activeWsId);
  const { count, limit, isNearCap, isAtCap } = useWorkspaceUsage(activeWsId);

  if (isPro || !isNearCap || isAtCap) return null;

  const isClub = activeWorkspace?.type === 'club';
  const isOwner = Boolean(activeWorkspace?.ownerId && user?.uid && activeWorkspace.ownerId === user.uid);
  const showCta = !isClub || isOwner;
  const upgradeHref = isClub ? '/upgrade/club' : '/upgrade';
  const upgradeLabel = isClub ? 'Activa Pro Club' : 'Hazte Pro';
  const bodyCopy = isClub
    ? isOwner
      ? `Al club le quedan ${limit - count} acciones de IA este mes. Activa Pro Club para que Pick no mire el reloj.`
      : `Al club le quedan ${limit - count} acciones de IA este mes. Avisa al DT para activar Pro Club.`
    : `Te quedan ${limit - count} acciones de IA este mes. Pasa a Pro para que Pick no mire el reloj.`;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 text-sm flex items-center justify-between">
      <span className="text-amber-900">{bodyCopy}</span>
      {showCta && (
        <Link
          to={upgradeHref}
          className="ml-4 px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 text-xs font-medium"
        >
          {upgradeLabel}
        </Link>
      )}
    </div>
  );
}
