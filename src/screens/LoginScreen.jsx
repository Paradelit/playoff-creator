import React, { useState, useId } from 'react';
import { Trophy, Loader2, User, Mail, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function GoogleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function AppleIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.536c-.03-3.053 2.49-4.517 2.604-4.588-1.42-2.075-3.633-2.36-4.417-2.394-1.88-.19-3.67 1.108-4.625 1.108-.955 0-2.427-1.08-3.99-1.05-2.053.03-3.948 1.193-5.003 3.028-2.133 3.697-.545 9.17 1.534 12.175 1.02 1.47 2.23 3.12 3.82 3.06 1.535-.062 2.113-.992 3.966-.992 1.853 0 2.374.992 3.99.96 1.65-.03 2.693-1.494 3.697-2.97 1.166-1.702 1.645-3.35 1.673-3.436-.037-.015-3.208-1.23-3.25-4.88zm-3.063-8.96c.842-1.02 1.41-2.438 1.255-3.85-1.213.05-2.685.81-3.558 1.83-.78.91-1.464 2.357-1.28 3.742 1.354.105 2.738-.688 3.583-1.722z" />
    </svg>
  );
}

export default function LoginScreen() {
  const {
    authError,
    isLoggingIn,
    handleEmailLogin,
    handleEmailRegister,
    handleGoogleLogin,
    handleAppleLogin,
    handleAnonymousLogin,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [pendingProvider, setPendingProvider] = useState(null);
  const emailId = useId();
  const passwordId = useId();

  const runProvider = (name, fn) => async () => {
    setPendingProvider(name);
    try {
      await fn();
    } finally {
      setPendingProvider(null);
    }
  };

  const onSubmitEmailForm = (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setPendingProvider('email');
    const action = isRegisterMode ? handleEmailRegister(email, password) : handleEmailLogin(email, password);
    Promise.resolve(action).finally(() => setPendingProvider(null));
  };

  const disableAll = isLoggingIn;
  const isPending = (name) => pendingProvider === name && isLoggingIn;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md md:max-w-xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-br from-blue-900 to-blue-950 p-6 md:p-10 text-center text-white">
          <Trophy size={48} className="mx-auto mb-3 text-amber-400" aria-hidden="true" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-wide">Pick&amp;Coach</h1>
          <p className="text-blue-200 mt-2 text-sm md:text-base">Gestiona tus equipos</p>
        </div>

        <div className="p-6 md:p-10">
          <p className="text-slate-600 mb-6 text-sm md:text-base text-center">
            Inicia sesión para crear tus cuadros, autocompletar resultados con IA y sincronizarlos automáticamente.
          </p>

          {authError && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-left leading-tight"
            >
              {authError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={runProvider('google', handleGoogleLogin)}
              disabled={disableAll}
              className="w-full flex items-center justify-center gap-2.5 bg-white border-2 border-slate-200 hover:border-blue-500 text-slate-700 hover:bg-blue-50 px-4 py-3 rounded-xl font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending('google') ? (
                <Loader2 size={20} className="animate-spin text-blue-600" aria-hidden="true" />
              ) : (
                <GoogleIcon size={20} />
              )}
              <span className="text-sm md:text-base">Google</span>
            </button>

            <button
              onClick={runProvider('apple', handleAppleLogin)}
              disabled={disableAll}
              className="w-full flex items-center justify-center gap-2.5 bg-black hover:bg-gray-900 text-white px-4 py-3 rounded-xl font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border-2 border-black"
            >
              {isPending('apple') ? (
                <Loader2 size={20} className="animate-spin text-white" aria-hidden="true" />
              ) : (
                <AppleIcon size={20} />
              )}
              <span className="text-sm md:text-base">Apple</span>
            </button>
          </div>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-medium">o con correo</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form onSubmit={onSubmitEmailForm} className="flex flex-col gap-3">
            <div className="relative">
              <label htmlFor={emailId} className="sr-only">
                Correo electrónico
              </label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-slate-400" aria-hidden="true" />
              </div>
              <input
                id={emailId}
                type="email"
                placeholder="Correo electrónico"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={disableAll}
                autoComplete="email"
                required
              />
            </div>
            <div className="relative">
              <label htmlFor={passwordId} className="sr-only">
                Contraseña
              </label>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-400" aria-hidden="true" />
              </div>
              <input
                id={passwordId}
                type="password"
                placeholder="Contraseña"
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={disableAll}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={disableAll}
              className="w-full mt-1 bg-blue-600 text-white hover:bg-blue-700 px-6 py-2.5 rounded-xl font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isPending('email') && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isRegisterMode ? 'Crear cuenta' : 'Entrar con correo'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setIsRegisterMode(!isRegisterMode)}
            className="w-full text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium mt-3 text-center"
          >
            {isRegisterMode ? '¿Ya tienes cuenta? Iniciar sesión' : '¿No tienes cuenta? Regístrate'}
          </button>

          <div className="relative flex py-4 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-medium">o de forma anónima</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <button
            onClick={runProvider('anon', handleAnonymousLogin)}
            disabled={disableAll}
            className="w-full flex items-center justify-center gap-3 bg-slate-100 text-slate-600 hover:bg-slate-200 px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending('anon') ? (
              <Loader2 size={20} className="animate-spin text-slate-500" aria-hidden="true" />
            ) : (
              <User size={20} className="text-slate-500" aria-hidden="true" />
            )}
            Continuar como Invitado
          </button>

          <p className="mt-5 text-xs text-slate-400 text-center">
            Al entrar como invitado, los datos solo se guardarán temporalmente en tu navegador actual.
          </p>
        </div>
      </div>
    </div>
  );
}
