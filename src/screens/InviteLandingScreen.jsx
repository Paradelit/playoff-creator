import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAcceptInvite } from '../hooks/useAcceptInvite';

export function InviteLandingScreen() {
  const { wsId, inviteId } = useParams();
  const state = useAcceptInvite({ wsId, inviteId });

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 max-w-md w-full p-8 text-center">
        {state.status === 'loading' && <p className="text-slate-500">Cargando invitación...</p>}

        {state.status === 'needsAuth' && (
          <>
            <h1 className="text-xl font-semibold mb-2">
              Has sido invitado{state.workspaceName ? ` a ${state.workspaceName}` : ''}
            </h1>
            <p className="text-sm text-slate-600 mb-4">Inicia sesión o regístrate para aceptar la invitación.</p>
            <Link
              to={`/login?redirect=${encodeURIComponent(`/invite/${wsId}/${inviteId}`)}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm"
            >
              Iniciar sesión / Registrarme
            </Link>
          </>
        )}

        {state.status === 'success' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Bienvenido a {state.workspaceName}</h1>
            {state.mismatched && (
              <p className="text-xs text-amber-700 mb-3">
                ⓘ Esta invitación estaba destinada a otro email. Has aceptado igualmente.
              </p>
            )}
            <Link to="/area-privada" className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm">
              Entrar al workspace
            </Link>
          </>
        )}

        {state.status === 'notFound' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Invitación no válida</h1>
            <p className="text-sm text-slate-600">Este enlace ya no es válido. Pídele al DT que te genere una nueva.</p>
          </>
        )}

        {state.status === 'expired' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Invitación caducada</h1>
            <p className="text-sm text-slate-600">El enlace ya no está activo. Pídele al DT que te genere uno nuevo.</p>
          </>
        )}

        {state.status === 'alreadyMember' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Ya formas parte de {state.workspaceName}</h1>
            <Link to="/area-privada" className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm">
              Ir al workspace
            </Link>
          </>
        )}

        {state.status === 'error' && (
          <>
            <h1 className="text-xl font-semibold mb-2">Algo salió mal</h1>
            <p className="text-sm text-slate-600">{state.error || 'Inténtalo de nuevo en unos minutos.'}</p>
          </>
        )}
      </div>
    </div>
  );
}

export default InviteLandingScreen;
