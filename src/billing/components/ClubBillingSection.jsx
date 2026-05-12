// src/billing/components/ClubBillingSection.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { Building2, AlertTriangle, Users } from 'lucide-react';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { getRegionalFunctions } from '../../services/functionsClient';

/**
 * Billing section para workspaces type='club'. Sólo visible al owner del club.
 *
 * Estados:
 * - Free: CTA "Activar Pro Club" → /upgrade/club. Preview del coste por seat.
 * - Pro: detalle de seats activos + botón "Gestionar suscripción" (Customer Portal).
 * - past_due: badge + botón directo a portal para actualizar tarjeta.
 *
 * La info de seats se lee en vivo de Stripe vía billing.seatCount (sincronizado
 * por el webhook customer.subscription.updated tras cada cambio de quantity).
 */
export function ClubBillingSection() {
  const { appId } = useFirebase();
  const { user } = useAuth();
  const { activeWsId, activeWorkspace } = useWorkspace();
  const { plan, billing, seatCount, cancelAtPeriodEnd, currentPeriodEnd, loading } = useWorkspacePlan(activeWsId);
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
        <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
          <Building2 size={18} className="text-indigo-700" aria-hidden="true" />
        </div>
        <p className="font-bold text-slate-800">Plan del club</p>
      </div>
      <div className="px-5 py-4">
        {loading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : plan === 'free' ? (
          <div>
            <p className="text-sm text-slate-600 mb-1">
              Tu club está en plan Free. Pick comparte 50 acciones/mes entre todos los miembros.
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Activa Pro Club y cada miembro tendrá Pick ilimitado en este workspace.
            </p>
            <Link
              to="/upgrade/club"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
            >
              Activar Pro Club
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-700 mb-1">
              <strong>Pro Club</strong>
              {cancelAtPeriodEnd && currentPeriodEnd
                ? ` · activo hasta ${currentPeriodEnd.toLocaleDateString('es-ES')}`
                : ' · activo'}
            </p>
            <p className="text-xs text-slate-500 mb-3 flex items-center gap-1.5">
              <Users size={12} aria-hidden="true" />
              {seatCount ?? '—'} {seatCount === 1 ? 'asiento' : 'asientos'} facturándose actualmente
            </p>
            {billing?.status === 'past_due' && (
              <p className="text-amber-700 text-xs mb-3 flex items-center gap-1.5">
                <AlertTriangle size={14} aria-hidden="true" />
                El pago ha fallado. Actualiza la tarjeta para que Pick siga funcionando para el club.
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
