// @vitest-environment jsdom — axe-core necesita APIs DOM completas.
// Úsalo así en tus tests de componentes:
//
//   /**
//    * @vitest-environment jsdom
//    */
//   import { render } from '@testing-library/react';
//   import { expectNoA11yViolations } from '../../test/a11y';
//
//   it('no infringe WCAG 2.1 AA', async () => {
//     const { container } = render(<MiComponente />);
//     await expectNoA11yViolations(container);
//   });

import axe from 'axe-core';
import { expect } from 'vitest';

const DEFAULT_CONFIG = {
  // Ejecutamos A, AA y best-practices (EN 301 549 / EAA se apoya en WCAG 2.1 AA).
  runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
};

/**
 * Ejecuta axe-core sobre un contenedor DOM y devuelve el resultado en crudo.
 * Útil cuando quieres inspeccionar violaciones concretas en el test.
 */
export async function runA11y(container, overrides = {}) {
  if (!container) throw new Error('runA11y: se requiere un contenedor DOM');
  return axe.run(container, { ...DEFAULT_CONFIG, ...overrides });
}

/**
 * Aserta que un contenedor no tiene violaciones. Si las hay, imprime un resumen
 * legible con regla, impacto y nodos afectados.
 */
export async function expectNoA11yViolations(container, overrides = {}) {
  const results = await runA11y(container, overrides);
  if (results.violations.length > 0) {
    const summary = results.violations
      .map((v) => {
        const nodes = v.nodes
          .map((n) => `    • ${n.target.join(' ')} — ${n.failureSummary?.split('\n')[0] || ''}`)
          .join('\n');
        return `  [${v.impact || 'unknown'}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nodes}`;
      })
      .join('\n\n');
    throw new Error(`Violaciones de accesibilidad detectadas (${results.violations.length}):\n${summary}`);
  }
  expect(results.violations).toEqual([]);
}
