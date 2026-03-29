import React, { createContext, useContext } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const FirebaseContext = createContext(null);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let _app, _auth, _db, _appId;
try {
  const configToUse = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : firebaseConfig;

  if (configToUse.apiKey) {
    _app = getApps().length ? getApps()[0] : initializeApp(configToUse);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _appId = typeof __app_id !== 'undefined' ? __app_id : 'uros-fbm-app';
  }
} catch (error) {
  console.error('Error inicializando Firebase:', error);
}

export function FirebaseProvider({ children }) {
  return (
    <FirebaseContext.Provider value={{ app: _app, auth: _auth, db: _db, appId: _appId }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  return useContext(FirebaseContext);
}
