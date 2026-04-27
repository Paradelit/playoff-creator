import { vi } from 'vitest';

let reducedMotion = false;
const mediaListeners = new Set();

function buildMediaQueryList(query) {
  return {
    matches: reducedMotion,
    media: query,
    onchange: null,
    addEventListener: (_event, listener) => mediaListeners.add(listener),
    removeEventListener: (_event, listener) => mediaListeners.delete(listener),
    addListener: (listener) => mediaListeners.add(listener),
    removeListener: (listener) => mediaListeners.delete(listener),
    dispatchEvent: vi.fn(),
  };
}

export function installLandingBrowserMocks() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query) => buildMediaQueryList(query)),
  });

  class MockIntersectionObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe = (target) => {
      this.callback([{ isIntersecting: true, target }], this);
    };

    disconnect = vi.fn();

    unobserve = vi.fn();
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    writable: true,
    value: MockIntersectionObserver,
  });
}

export function resetLandingBrowserMocks() {
  reducedMotion = false;
  mediaListeners.clear();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
  document.documentElement.removeAttribute('data-public-theme');
}

export function setReducedMotion(matches) {
  reducedMotion = matches;
  mediaListeners.forEach((listener) => listener({ matches }));
}
