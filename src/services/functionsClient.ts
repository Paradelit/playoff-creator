import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

let emulatorConnected = false;

export const CALLABLE_TIMEOUT_MS = 300_000;

export function getRegionalFunctions() {
  const functions = getFunctions(undefined, 'europe-west1');
  if (import.meta.env.DEV && !emulatorConnected) {
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    emulatorConnected = true;
  }
  return functions;
}
