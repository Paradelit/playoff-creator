// src/billing/components/BillingSection.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { CreditCard, AlertTriangle } from 'lucide-react';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { getRegionalFunctions } from '../../services/functionsClient';

export function BillingSection() {
  const { appId } = useFirebase();
  const { user } = useAuth();
  const { activeWsId, activeWorkspace } = useWorkspace();
  const { plan, billing, cancelAtPeriodEnd, currentPeriodEnd, loading } = useWorkspacePlan(activeWsId);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(null);

  const isOwner = Boolean(activeWorkspace?.ownerId && user?.uid && activeWorkspace.ownerId === user.uid);
  if (!isOwner) return null;

  const openPortal = async () => {
    setOpening(true);
    setError(null);
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
      } else {
        throw new Error('Stripe no devolvió la URL del portal.');
      }
    } catch (err) {
      setError(err?.message ?? 'No se pudo abrir el portal.');
      setOpening(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
          <CreditCard size={18} className="text-emerald-700" aria-hidden="true" />
        </div>
        <p className="font-bold text-slate-800">Plan y suscripción</p>
      </div>
      <div className="px-5 py-4">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : plan === 'free' ? (
          <div>
            <p className="text-sm text-slate-600 mb-3">Estás en plan Free. 50 acciones de IA al mes.</p>
            <Link
              to="/upgrade"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Hazte Pro
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-700 mb-1">
              <strong>Pro</strong>
              {cancelAtPeriodEnd && currentPeriodEnd
                ? ` · activo hasta ${currentPeriodEnd.toLocaleDateString('es-ES')}`
                : ' · activo'}
            </p>
            {billing?.status === 'past_due' && (
              <p className="text-amber-700 text-xs mb-3 flex items-center gap-1.5">
                <AlertTriangle size={14} aria-hidden="true" />
                Tu pago ha fallado. Actualiza tu tarjeta para que Pick siga al 100%.
              </p>
            )}
            <button
              type="button"
              onClick={openPortal}
              disabled={opening}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition disabled:opacity-50"
            >
              {opening ? 'Abriendo…' : 'Gestionar suscripción'}
            </button>
            {error && (
              <p role="alert" className="text-red-600 text-xs mt-2">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
