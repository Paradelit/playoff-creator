import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'pickcoach.publicTheme';
const PublicThemeContext = createContext(null);

function resolveInitialTheme() {
  if (typeof document !== 'undefined') {
    const documentTheme = document.documentElement.dataset.publicTheme;
    if (documentTheme === 'light' || documentTheme === 'dark') {
      return documentTheme;
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const storedTheme = window.localStorage.getItem(STORAGE_KEY);
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme;
      }
    } catch {
      // Ignore storage access errors and continue with the system preference.
    }

    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
  }

  return 'dark';
}

export function PublicThemeProvider({ children }) {
  const [theme, setTheme] = useState(resolveInitialTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    document.documentElement.dataset.publicTheme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage access errors so the UI still works.
    }

    return undefined;
  }, [theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    return () => {
      document.documentElement.removeAttribute('data-public-theme');
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = '';
    };
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <PublicThemeContext.Provider value={value}>{children}</PublicThemeContext.Provider>;
}

const PUBLIC_THEME_FALLBACK = {
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
};

export function usePublicThemeContext() {
  return useContext(PublicThemeContext) ?? PUBLIC_THEME_FALLBACK;
}
