import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'dist-ssr', 'functions', '.claude']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      importPlugin.flatConfigs.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
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
      // Sub-7 quality batch — circular deps son arquitecturalmente prohibidos.
      // Detectarlos como ERROR previene loops importables que rompen tree-shaking
      // y crean acoplamiento implícito.
      'import/no-cycle': ['error', { maxDepth: 10 }],
      // Imports duplicados son code smell puro. Como error.
      'import/no-duplicates': 'error',
      // eslint-plugin-import en ESM-modern (vitest, firebase v12, vite 8) tiene
      // resolver issues con chunks/exports condicionales. Las reglas estructurales
      // (no-cycle, no-duplicates) son las realmente valiosas; las que dependen de
      // resolver (no-unresolved, named, namespace) generan ruido sin valor.
      'import/no-unresolved': 'off',
      'import/named': 'off',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-named-as-default': 'off',
      // Sub-7 quality batch — a11y target 'funcional': sólo reglas que pegan
      // contra patrones reales que rompen keyboard nav o screen readers.
      // No WCAG full porque el target del proyecto es informal (CLAUDE.md).
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/anchor-is-valid': 'off', // react-router NavLink rompe esta regla por defecto
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/no-redundant-roles': 'warn',
      // autoFocus en modales + buscadores es UX intencional (cursor en el input
      // que el usuario espera) y nuestro target a11y es funcional. Warn para
      // visibilidad sin bloquear.
      'jsx-a11y/no-autofocus': 'warn',
      // label-has-associated-control flagea labels sin htmlFor o sin envoltura
      // del input. Como warn mientras pasamos los forms a wrap-pattern incremental.
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'off', // demasiado ruido para target funcional
      'jsx-a11y/click-events-have-key-events': 'off', // idem
      'jsx-a11y/no-static-element-interactions': 'off', // idem
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.typescript,
      jsxA11y.flatConfigs.recommended,
    ],
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
      // Mismas reglas import + a11y que en JS (ver rationale arriba).
      'import/no-cycle': ['error', { maxDepth: 10 }],
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off',
      'import/named': 'off',
      'import/namespace': 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-named-as-default': 'off',
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/aria-unsupported-elements': 'error',
      'jsx-a11y/role-has-required-aria-props': 'error',
      'jsx-a11y/role-supports-aria-props': 'error',
      'jsx-a11y/no-redundant-roles': 'warn',
      // autoFocus en modales + buscadores es UX intencional (cursor en el input
      // que el usuario espera) y nuestro target a11y es funcional. Warn para
      // visibilidad sin bloquear.
      'jsx-a11y/no-autofocus': 'warn',
      // label-has-associated-control flagea labels sin htmlFor o sin envoltura
      // del input. Como warn mientras pasamos los forms a wrap-pattern incremental.
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
    },
  },
  // Sub-7 quality batch — test files: override max-lines. Los rules tests
  // crecen con cada describe block (87 tests / 880 LOC actual). Splitearlos
  // perdería cohesión (orden + setup compartido por bloque). Mismo argumento
  // para vitest test files que apilan describes relacionados.
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', 'firestore.rules.test.ts'],
    rules: {
      'max-lines': 'off',
      'complexity': 'off', // setup helpers en tests pueden ser densos sin ser code smell
      'no-shadow': 'off', // shadow de variables locales en describes es idiomático
    },
  },
  // Sub-7 quality batch — archivos de contenido (markdown inline, AI tool
  // registries): los array de objetos editorialmente densos no son code smell.
  // Split por categoría perdería source-of-truth única y aumentaría coste de
  // mantener. Override max-lines.
  {
    files: [
      'src/content/**/*.{js,ts}',
      'functions/src/ai/tools/**/*.ts',
      'src/components/landing/**/*.{js,jsx}', // landing tiene mucho inline JSX + data por design
    ],
    rules: {
      'max-lines': 'off',
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
  // Scripts y configs (vite, prerender, sitemap): node globals + sin import rules
  // estrictas (algunos usan dynamic imports de ESM que el plugin no resuelve).
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,mjs}', 'vite.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      'import/no-unresolved': 'off',
    },
  },
  eslintConfigPrettier,
]);
