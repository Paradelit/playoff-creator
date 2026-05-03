// src/billing/components/UpgradePage.jsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { httpsCallable } from 'firebase/functions';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';
import { getRegionalFunctions } from '../../services/functionsClient';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const PRICE_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_MONTHLY;
const PRICE_ANNUAL = import.meta.env.VITE_STRIPE_PRICE_ANNUAL;

const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

export function UpgradePage() {
  const navigate = useNavigate();
  const { appId } = useFirebase();
  const { activeWsId, isLoading: wsLoading } = useWorkspace();
  const { isPro, loading: planLoading } = useWorkspacePlan(activeWsId);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);

  const priceId = billingPeriod === 'annual' ? PRICE_ANNUAL : PRICE_MONTHLY;
  const checkoutOptions = useMemo(() => (clientSecret ? { clientSecret } : null), [clientSecret]);

  useEffect(() => {
    if (!STRIPE_PUBLISHABLE_KEY) {
      setError('Stripe no está configurado en este entorno.');
      return;
    }
    if (!priceId) {
      setError('Falta el price ID de Stripe.');
      return;
    }
    if (wsLoading || planLoading) return;
    if (!activeWsId || !appId) return;
    if (isPro) return;

    let cancelled = false;
    setClientSecret(null);
    setError(null);
    const functions = getRegionalFunctions();
    const fn = httpsCallable(functions, 'createCheckoutSession');
    fn({ wsId: activeWsId, appId, priceId })
      .then(({ data }) => {
        if (cancelled) return;
        setClientSecret(data?.clientSecret ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message ?? 'No hemos podido iniciar el pago.');
      });
    return () => {
      cancelled = true;
    };
  }, [appId, activeWsId, wsLoading, planLoading, isPro, priceId]);

  if (!planLoading && isPro) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Ya tienes Pro</h1>
          <p className="text-sm text-slate-600 mb-6">Pick está al 100% en este workspace.</p>
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
      <div className="bg-blue-950 px-5 pt-10 pb-6">
        <button
          onClick={() => navigate('/area-privada')}
          className="flex items-center gap-1.5 text-blue-400 hover:text-white text-sm font-medium transition mb-4"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Inicio
        </button>
        <h1 className="text-white text-2xl font-bold">Hazte Pro</h1>
        <p className="text-blue-200 text-sm mt-0.5">
          Pick deja de mirar el reloj. Acciones de IA ilimitadas en tu workspace.
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div role="tablist" aria-label="Periodicidad" className="flex gap-2 mb-6">
          <button
            type="button"
            role="tab"
            aria-selected={billingPeriod === 'monthly'}
            onClick={() => setBillingPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              billingPeriod === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            €4,99/mes
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={billingPeriod === 'annual'}
            onClick={() => setBillingPeriod('annual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              billingPeriod === 'annual'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            €49/año <span className="text-xs opacity-80">(2 meses gratis)</span>
          </button>
        </div>

        {error ? (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900">
            No hemos podido iniciar el pago: {error}
          </div>
        ) : checkoutOptions && stripePromise ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* key forces a clean remount when priceId changes — Stripe's
                EmbeddedCheckoutProvider does not support live clientSecret swap. */}
            <EmbeddedCheckoutProvider key={priceId} stripe={stripePromise} options={checkoutOptions}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex items-center justify-center">
            <Loader2 size={32} className="text-blue-600 animate-spin" aria-hidden="true" />
            <span className="sr-only">Cargando checkout</span>
          </div>
        )}
      </div>
    </div>
  );
}
