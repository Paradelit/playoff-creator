// src/billing/eventBus.ts
type Listener<T = unknown> = (payload: T) => void;

const listeners = new Map<string, Set<Listener>>();

export const eventBus = {
  on<T>(event: string, listener: Listener<T>): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(listener as Listener);
    return () => listeners.get(event)?.delete(listener as Listener);
  },
  emit<T>(event: string, payload: T): void {
    listeners.get(event)?.forEach((l) => l(payload));
  },
};
