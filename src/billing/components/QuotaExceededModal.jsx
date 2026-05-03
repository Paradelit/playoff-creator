// src/billing/components/QuotaExceededModal.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventBus } from '../eventBus';

/**
 * Modal que aparece cuando aiClient recibe HttpsError('resource-exhausted').
 * Se monta una vez en AppShell (singleton) y escucha el eventBus.
 */
export function QuotaExceededModal() {
  const [details, setDetails] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    return eventBus.on('quota-exceeded', (d) => setDetails(d));
  }, []);

  if (!details) return null;

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
        <p className="text-sm text-zinc-600 mb-4">
          Llevas <strong>{details.count}</strong> de {details.limit} acciones de IA este mes. Pasa a Pro y Pick deja de
          mirar el reloj. O vuelve el día 1.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDetails(null)}
            className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
          >
            Vuelvo el día 1
          </button>
          <button
            type="button"
            onClick={() => {
              setDetails(null);
              navigate('/upgrade');
            }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
          >
            Hazte Pro
          </button>
        </div>
      </div>
    </div>
  );
}
