// src/billing/components/QuotaExceededModal.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventBus } from '../eventBus';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';

/**
 * Modal que aparece cuando aiClient recibe HttpsError('resource-exhausted').
 * Se monta una vez en AppShell (singleton) y escucha el eventBus.
 *
 * 3 estados según role + workspace.type:
 * - Personal owner → CTA "Hazte Pro" → /upgrade
 * - Club owner (DT) → CTA "Activa Pro Club" → /upgrade/club
 * - Club member (coach) → texto "Avisa al DT", sin CTA accionable
 */
export function QuotaExceededModal() {
  const [details, setDetails] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspace();

  useEffect(() => {
    return eventBus.on('quota-exceeded', (d) => setDetails(d));
  }, []);

  if (!details) return null;

  const isClub = activeWorkspace?.type === 'club';
  const isOwner = Boolean(activeWorkspace?.ownerId && user?.uid && activeWorkspace.ownerId === user.uid);
  const showUpgradeCta = !isClub || isOwner;
  const upgradeHref = isClub ? '/upgrade/club' : '/upgrade';
  const upgradeLabel = isClub ? 'Activa Pro Club' : 'Hazte Pro';
  const bodyCopy = isClub
    ? isOwner
      ? `El club lleva ${details.count} de ${details.limit} acciones de IA este mes. Activa Pro Club y Pick deja de mirar el reloj para todo el staff.`
      : `El club lleva ${details.count} de ${details.limit} acciones de IA este mes. Avisa al DT para activar Pro Club o vuelve el día 1.`
    : `Llevas ${details.count} de ${details.limit} acciones de IA este mes. Pasa a Pro y Pick deja de mirar el reloj. O vuelve el día 1.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quota-exceeded-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 id="quota-exceeded-title" className="text-lg font-semibold mb-2">
          Has llegado a tu cap mensual
        </h2>
        <p className="text-sm text-zinc-600 mb-4">{bodyCopy}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDetails(null)}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
          >
            Vuelvo el día 1
          </button>
          {showUpgradeCta && (
            <button
              type="button"
              onClick={() => {
                setDetails(null);
                navigate(upgradeHref);
              }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              {upgradeLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
