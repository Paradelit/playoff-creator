// src/billing/components/ClubUpgradePage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { httpsCallable } from 'firebase/functions';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { getRegionalFunctions } from '../../services/functionsClient';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const PRICE_PER_SEAT = import.meta.env.VITE_STRIPE_PRICE_B2B_PER_SEAT;

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

/**
 * Upgrade flow específico para clubs (B2B per-seat). Diferencias vs UpgradePage:
 * - Único plan ofertado (per-seat). Sin toggle periodicidad.
 * - Quantity inicial = miembros actuales del club. La llamada al backend cuenta
 *   server-side; la mostramos aquí solo para preview.
 * - Validación: workspace.type debe ser 'club'. Redirige si no.
 */
export function ClubUpgradePage() {
  const navigate = useNavigate();
  const { appId } = useFirebase();
  const { activeWsId, activeWorkspace, isLoading: wsLoading } = useWorkspace();
  const { isPro, loading: planLoading } = useWorkspacePlan(activeWsId);
  const [clientSecret, setClientSecret] = useState(null);
  const [seatCount, setSeatCount] = useState(null);
  const [error, setError] = useState(null);

  const checkoutOptions = useMemo(() => (clientSecret ? { clientSecret } : null), [clientSecret]);
  const isClub = activeWorkspace?.type === 'club';

  useEffect(() => {
    if (!STRIPE_PUBLISHABLE_KEY) {
      setError('Stripe no está configurado en este entorno.');
      return;
    }
    if (!PRICE_PER_SEAT) {
      setError('Falta el price ID de Pro Club.');
      return;
    }
    if (wsLoading || planLoading) return;
    if (!activeWsId || !appId) return;
    if (isPro) return;
    if (!isClub) return;

    let cancelled = false;
    setClientSecret(null);
    setError(null);
    const functions = getRegionalFunctions();
    const fn = httpsCallable(functions, 'createClubSubscription');
    fn({ wsId: activeWsId, appId, priceId: PRICE_PER_SEAT })
      .then(({ data }) => {
        if (cancelled) return;
        setClientSecret(data?.clientSecret ?? null);
        setSeatCount(data?.seatCount ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'No hemos podido iniciar el pago.');
      });
    return () => {
      cancelled = true;
    };
  }, [appId, activeWsId, wsLoading, planLoading, isPro, isClub]);

  // Workspace personal intentando upgrade B2B: redirigir al flow B2C.
  if (!wsLoading && activeWorkspace && !isClub) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Esto es Pro Club</h1>
          <p className="text-sm text-slate-600 mb-6">
            Tu workspace personal va por otra ruta. Te llevamos al plan Pro.
          </p>
          <button
            type="button"
            onClick={() => navigate('/upgrade')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Ir a Pro personal
          </button>
        </div>
      </div>
    );
  }

  if (!planLoading && isPro) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Tu club ya tiene Pro</h1>
          <p className="text-sm text-slate-600 mb-6">Pick está al 100% para todo el club.</p>
          <button
            type="button"
            onClick={() => navigate('/area-privada')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Volver al área privada
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-indigo-950 px-5 pt-10 pb-6">
        <button
          onClick={() => navigate('/area-privada')}
          className="flex items-center gap-1.5 text-indigo-300 hover:text-white text-sm font-medium transition mb-4"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Inicio
        </button>
        <h1 className="text-white text-2xl font-bold">Pro Club</h1>
        <p className="text-indigo-200 text-sm mt-0.5">
          Pick ilimitado para todo el staff del club. Facturación per-seat — pagas solo por miembros activos.
        </p>
        {seatCount != null && (
          <p className="text-indigo-300 text-xs mt-3 flex items-center gap-1.5">
            <Users size={12} aria-hidden="true" />
            {seatCount} {seatCount === 1 ? 'asiento inicial' : 'asientos iniciales'} (todo el staff actual)
          </p>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error ? (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900">
            No hemos podido iniciar el pago: {error}
          </div>
        ) : checkoutOptions && stripePromise ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center">
            <Loader2 size={32} className="text-indigo-600 animate-spin" aria-hidden="true" />
            <span className="sr-only">Cargando checkout</span>
          </div>
        )}
      </div>
    </div>
  );
}
