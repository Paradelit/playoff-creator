import { useState, useCallback, useRef } from 'react';

/**
 * Lightweight controlled form hook.
 *
 * @param {Object} initialValues - Default form values.
 * @returns {{ values, setValues, field, reset, isDirty }}
 *
 * @example
 * const form = useForm({ nombre: '', email: '' });
 * <input value={form.values.nombre} onChange={form.field('nombre')} />
 * <button disabled={!form.isDirty} onClick={handleSave}>Guardar</button>
 */
export function useForm(initialValues) {
  const [values, setValues] = useState(initialValues);
  const initialRef = useRef(initialValues);

  /** Returns an onChange handler for a given field name. */
  const field = useCallback(
    (name) => (e) => {
      const value = e?.target !== undefined ? e.target.value : e;
      setValues((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  /** Reset form to initial values, or to new values if provided. */
  const reset = useCallback((newValues) => {
    const vals = newValues ?? initialRef.current;
    initialRef.current = vals;
    setValues(vals);
  }, []);

  const isDirty = JSON.stringify(values) !== JSON.stringify(initialRef.current);

  return { values, setValues, field, reset, isDirty };
}
