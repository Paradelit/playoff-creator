// src/billing/components/UpgradeSuccessPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspacePlan } from '../useWorkspacePlan';

const TIMEOUT_MS = 8000;

export function UpgradeSuccessPage() {
  const navigate = useNavigate();
  const { activeWsId } = useWorkspace();
  const { isPro, loading } = useWorkspacePlan(activeWsId);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && isPro) {
      navigate('/area-privada?upgraded=true', { replace: true });
    }
  }, [loading, isPro, navigate]);

  if (timedOut && !isPro) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Procesando tu pago…</h1>
          <p className="text-sm text-slate-600 mb-6">
            Recibirás un email de confirmación en breves. Tu Pro estará activo cuando el banner desaparezca de tu home.
          </p>
          <button
            type="button"
            onClick={() => navigate('/area-privada', { replace: true })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
        <Loader2 size={32} className="text-blue-600 animate-spin mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Activando tu Pro…</h1>
        <p className="text-sm text-slate-600">Un momento.</p>
      </div>
    </div>
  );
}
