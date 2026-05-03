// src/billing/components/PaymentFailedBanner.jsx
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { getRegionalFunctions } from '../../services/functionsClient';

export function PaymentFailedBanner() {
  const { appId } = useFirebase();
  const { user } = useAuth();
  const { activeWsId, activeWorkspace } = useWorkspace();
  const { isPro, isPastDue } = useWorkspacePlan(activeWsId);
  const [opening, setOpening] = useState(false);

  if (!isPro || !isPastDue) return null;

  const isOwner = Boolean(activeWorkspace?.ownerId && user?.uid && activeWorkspace.ownerId === user.uid);

  const openPortal = async () => {
    setOpening(true);
    try {
      const functions = getRegionalFunctions();
      const fn = httpsCallable(functions, 'createPortalSession');
      const { data } = await fn({
        wsId: activeWsId,
        appId,
        returnUrl: window.location.href,
      });
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setOpening(false);
    } catch {
      setOpening(false);
    }
  };

  const message = isOwner
    ? 'Tu pago ha fallado. Actualiza tu tarjeta o el equipo se queda sin Pick.'
    : 'El pago del workspace ha fallado. Avisa al propietario para que actualice el método de pago.';

  return (
    <div
      role="alert"
      className="bg-red-50 border-l-4 border-red-500 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <span className="text-red-900">{message}</span>
      {isOwner && (
        <button
          type="button"
          onClick={openPortal}
          disabled={opening}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition disabled:opacity-50"
        >
          {opening ? 'Abriendo…' : 'Actualizar tarjeta'}
        </button>
      )}
    </div>
  );
}
