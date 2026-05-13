import { useEffect } from 'react';
import { useScreenContext, type ScreenSemantic } from '../contexts/ScreenContextProvider';

/**
 * Hook paralelo a `useRegisterScreenContext`: cada screen relevante computa
 * su semantic snapshot (label + referableIds) y lo registra para que Pick
 * lo reciba en `screenContext.semantic`.
 *
 * Pasar `null` cuando no hay semantic estable (state vacío / cargando) —
 * Pick caerá al render bruto del screen.
 */
export function useRegisterScreenSemantic(semantic: ScreenSemantic | null) {
  const { registerScreenSemantic } = useScreenContext();
  useEffect(() => {
    registerScreenSemantic(semantic);
    // JSON.stringify para que React detecte cambios profundos sin requerir
    // memoización en el caller. El caller PUEDE memoizar si lo desea.
  }, [JSON.stringify(semantic)]); // eslint-disable-line react-hooks/exhaustive-deps
}
