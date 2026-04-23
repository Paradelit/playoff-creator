import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import CoachesApp from './shell/CoachesApp';

// Auditor de accesibilidad en dev: expone window.__a11y() y corre axe tras cada
// cambio de ruta. Solo se carga en desarrollo — no entra en el bundle de prod.
if (import.meta.env.DEV) {
  import('./utils/devA11y').then(({ installDevA11y }) => installDevA11y());
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CoachesApp />
  </StrictMode>,
);
