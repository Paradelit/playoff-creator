import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'dist-ssr', 'functions', '.claude']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      'react-compiler/react-compiler': 'off',
      'react-hooks/refs': 'warn',
      // sub-7 batch audit (2026-05-13): react-hooks/set-state-in-effect es
      // experimental en eslint-plugin-react-hooks v6 y flagea muchos patrones
      // legítimos de React 19 (setError on validation, setLoading al inicio
      // del effect, setData al recibir snapshot). El audit los clasificó como
      // BLOCKER pero la revisión caso-a-caso muestra que la mayoría son
      // patrones documentados en react.dev. Una pasada dedicada de React 19
      // readiness re-encenderá la regla y migrará a useReducer/useMemo donde
      // toque. Hasta entonces 'off' con rationale visible aquí en lugar de
      // dispersar eslint-disable por todo el código.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      complexity: ['warn', { max: 20 }],
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      // sub-7 batch audit: consistent-return marca useEffect bodies con early
      // `return;` que conviven con `return cleanupFn;` final — patrón idiomático
      // de React. Refactorizar a if/else aumenta complejidad ciclomática sin
      // ganancia funcional. Mismo trade-off que set-state-in-effect.
      'consistent-return': 'off',
      'no-shadow': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true, allowExportNames: [] }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Mismo trade-off — ver rationale en bloque JS arriba.
      'react-hooks/set-state-in-effect': 'off',
      'consistent-return': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      complexity: ['warn', { max: 20 }],
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'no-shadow': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true, allowExportNames: [] }],
    },
  },
  // Node-side migration / cleanup scripts: run via `node`, need
  // process / console / etc.
  {
    files: ['scripts/migration/**/*.js', 'scripts/cleanupOldPaths.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },
  eslintConfigPrettier,
]);
