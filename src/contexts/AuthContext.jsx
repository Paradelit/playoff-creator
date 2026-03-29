import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { useFirebase } from './FirebaseContext';

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
    });
    return () => unsubscribe();
  }, [auth]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || 'scf.usercontent.goog';
        setAuthError(`Bloqueo de seguridad: Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade: ${domain}`);
      } else {
        setAuthError('Error al conectar con Google. Revisa tu configuración de Firebase.');
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
      console.error('Error en login anónimo:', error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname || 'scf.usercontent.goog';
        setAuthError(`Bloqueo de seguridad: Ve a Firebase Console -> Authentication -> Settings -> Authorized domains y añade: ${domain}`);
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
      console.error('Error al cerrar sesión', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoggingIn, authError, setAuthError, authReady, handleLogin, handleAnonymousLogin, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
