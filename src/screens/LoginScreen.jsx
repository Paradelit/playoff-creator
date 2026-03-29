import React from 'react';
import { Trophy, Loader2, LogIn, User } from 'lucide-react';

export default function LoginScreen({ errorMsg, isLoggingIn, handleLogin, handleAnonymousLogin }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-blue-900 p-8 text-center text-white">
          <Trophy size={48} className="mx-auto mb-4 text-amber-400" />
          <h1 className="text-3xl font-bold tracking-wide">FBM Brackets</h1>
          <p className="text-blue-200 mt-2">Gestiona tus playoffs en la nube</p>
        </div>
        <div className="p-8 text-center">
          <p className="text-slate-600 mb-8">
            Inicia sesión para crear tus cuadros, autocompletar resultados con IA y sincronizarlos automáticamente en todos tus dispositivos.
          </p>
          {errorMsg && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-left leading-tight">{errorMsg}</div>}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-blue-500 text-slate-700 hover:bg-blue-50 px-6 py-3 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
            >
              {isLoggingIn ? <Loader2 size={20} className="animate-spin text-blue-600" /> : <LogIn size={20} className="text-blue-600" />}
              {isLoggingIn ? "Conectando..." : "Continuar con Google"}
            </button>
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-medium">o prueba rápido</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>
            <button
              onClick={handleAnonymousLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-slate-100 text-slate-600 hover:bg-slate-200 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              <User size={20} className="text-slate-500" />
              Continuar como Invitado
            </button>
          </div>
          <p className="mt-6 text-xs text-slate-400">
            Al entrar como invitado, los datos solo se guardarán temporalmente en tu navegador actual.
          </p>
        </div>
      </div>
    </div>
  );
}
