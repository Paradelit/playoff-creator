import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    exclude: [
      'node_modules',
      'dist',
      'functions/**',
      'tests/**',
      '.claude/**',
      '.worktrees/**',
      'firestore.rules.test.ts',
    ],
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
    },
  },
  build: {
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');
          if (
            normalizedId.includes('/src/screens/LandingScreen.jsx') ||
            normalizedId.includes('/src/components/landing/')
          ) {
            return 'public-landing';
          }
          if (
            normalizedId.includes('/src/screens/HelpIndexScreen.jsx') ||
            normalizedId.includes('/src/screens/HelpArticleScreen.jsx') ||
            normalizedId.includes('/src/components/help/') ||
            normalizedId.includes('/src/content/helpArticles') ||
            normalizedId.includes('/node_modules/react-markdown') ||
            normalizedId.includes('/node_modules/remark-gfm')
          ) {
            return 'public-help';
          }
          if (id.includes('pdfjs-dist')) return 'pdf';
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('html-to-image')) return 'html-to-image';
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('lucide-react'))
            return 'vendor';
        },
      },
    },
  },
});
