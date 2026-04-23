// Auditor de accesibilidad en dev.
//
// Instala dos hooks:
//   1. Auditoría automática al cargar y tras cada cambio de ruta (pushState/popstate).
//   2. `window.__a11y()` → audita bajo demanda desde la DevTools console.
//
// Solo se importa bajo `if (import.meta.env.DEV)` en main.jsx → no llega a producción.

import axe from 'axe-core';

const CONFIG = {
  runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
  resultTypes: ['violations', 'incomplete'],
};

let scheduled = false;

function scheduleAudit(delay = 800) {
  if (scheduled) return;
  scheduled = true;
  setTimeout(async () => {
    scheduled = false;
    try {
      const results = await axe.run(document, CONFIG);
      logResults(results);
    } catch (err) {
      console.warn('[a11y] axe-core falló:', err);
    }
  }, delay);
}

function logResults(results) {
  const { violations, incomplete } = results;
  if (violations.length === 0 && incomplete.length === 0) {
    console.log('%c[a11y] ✓ sin violaciones en la ruta actual', 'color:#10b981;font-weight:bold');
    return;
  }
  console.groupCollapsed(
    `%c[a11y] ${violations.length} violación(es) · ${incomplete.length} dudosas — ${location.pathname}`,
    'color:#dc2626;font-weight:bold',
  );
  violations.forEach((v) => {
    console.groupCollapsed(`%c[${v.impact}] ${v.id}`, `color:${impactColor(v.impact)};font-weight:bold`, `— ${v.help}`);
    console.log('Regla:', v.helpUrl);
    v.nodes.forEach((n) => {
      console.log(n.target.join(' '), '\n', n.failureSummary);
      if (n.element) console.log(n.element);
    });
    console.groupEnd();
  });
  if (incomplete.length > 0) {
    console.groupCollapsed(`%c${incomplete.length} casos dudosos (revisar manualmente)`, 'color:#d97706');
    incomplete.forEach((v) => console.log(`- ${v.id}: ${v.help}`));
    console.groupEnd();
  }
  console.groupEnd();
}

function impactColor(impact) {
  return { critical: '#dc2626', serious: '#ea580c', moderate: '#d97706', minor: '#65a30d' }[impact] || '#6b7280';
}

function hookHistory() {
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args);
    scheduleAudit();
    return r;
  };
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args);
    scheduleAudit();
    return r;
  };
  window.addEventListener('popstate', () => scheduleAudit());
}

export function installDevA11y() {
  if (typeof window === 'undefined') return;
  if (window.__a11yInstalled) return;
  window.__a11yInstalled = true;
  window.__a11y = (opts = {}) => axe.run(opts.context || document, { ...CONFIG, ...opts }).then(logResults);
  hookHistory();
  // Primera auditoría tras montar
  scheduleAudit(1500);
  console.log('%c[a11y] auditor activo — llama window.__a11y() para auditar bajo demanda', 'color:#2563eb');
}
