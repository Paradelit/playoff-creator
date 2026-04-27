import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithCredential,
  linkWithPopup,
  deleteUser,
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { useFirebase } from './FirebaseContext';
import logger from '../utils/logger';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { auth } = useFirebase();
  const [user, setUser] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      logger.setUserContext(currentUser ? { uid: currentUser.uid, email: currentUser.email } : {});
    });
    return () => unsubscribe();
  }, [auth]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      logger.error('Error al iniciar sesión', error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || 'scf.usercontent.goog';
        setAuthError(
          `Bloqueo de seguridad: Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade: ${domain}`,
        );
      } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // Silent: usuario cerró el popup intencionalmente.
      } else {
        setAuthError('Error al conectar con Google. Revisa tu configuración de Firebase.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      logger.error('Error al iniciar sesión con Apple', error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || 'scf.usercontent.goog';
        setAuthError(
          `Bloqueo de seguridad: Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade: ${domain}`,
        );
      } else if (error.code === 'auth/operation-not-allowed') {
        setAuthError(
          'Apple Sign-In no está habilitado. Actívalo en Firebase Console → Authentication → Sign-in method.',
        );
      } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        // Silent: usuario cerró el popup intencionalmente.
      } else {
        setAuthError('Error al conectar con Apple.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailLogin = async (email, password) => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      logger.error('Error al iniciar sesión con email', error);
      setAuthError('Correo o contraseña incorrectos.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailRegister = async (email, password) => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      logger.error('Error al registrar con email', error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('El correo ya está en uso. Por favor, inicia sesión.');
      } else if (error.code === 'auth/weak-password') {
        setAuthError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setAuthError('Error al crear la cuenta.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      await signInAnonymously(auth);
    } catch (error) {
      logger.error('Error en login anónimo', error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || 'scf.usercontent.goog';
        setAuthError(
          `Bloqueo de seguridad: Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade: ${domain}`,
        );
      } else {
        setAuthError('Error al iniciar sesión de invitado.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      logger.error('Error al cerrar sesión', error);
    }
  };

  const handleLinkGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await linkWithPopup(auth.currentUser, provider);
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(error);
        if (credential) {
          await signInWithCredential(auth, credential);
          return;
        }
      }
      logger.error('Error al vincular cuenta', error);
      throw error;
    }
  };

  const handleDeleteAuthAccount = async () => {
    try {
      await deleteUser(auth.currentUser);
    } catch (error) {
      logger.error('Error al eliminar cuenta', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggingIn,
        authError,
        setAuthError,
        authReady,
        handleGoogleLogin,
        handleAppleLogin,
        handleEmailLogin,
        handleEmailRegister,
        handleAnonymousLogin,
        handleLogout,
        handleLinkGoogle,
        handleDeleteAuthAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

const SSR_AUTH_FALLBACK = { user: null, authReady: false };

export function useAuth() {
  // During SSR prerender, AuthProvider is not mounted — return a safe fallback.
  return useContext(AuthContext) ?? SSR_AUTH_FALLBACK;
}
