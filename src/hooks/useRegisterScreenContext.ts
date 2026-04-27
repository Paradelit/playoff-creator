import { useEffect } from 'react';
import { useScreenContext } from '../contexts/ScreenContextProvider';

export function useRegisterScreenContext(data: Record<string, unknown>) {
  const { registerScreenData } = useScreenContext();
  useEffect(() => {
    registerScreenData(data);
  }, [JSON.stringify(data)]); // eslint-disable-line react-hooks/exhaustive-deps
}
