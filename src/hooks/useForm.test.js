import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm } from './useForm';

describe('useForm', () => {
  const initial = { nombre: '', email: '' };

  it('starts with initial values', () => {
    const { result } = renderHook(() => useForm(initial));
    expect(result.current.values).toEqual({ nombre: '', email: '' });
    expect(result.current.isDirty).toBe(false);
  });

  it('field() returns an onChange handler that updates a field', () => {
    const { result } = renderHook(() => useForm(initial));

    act(() => {
      result.current.field('nombre')({ target: { value: 'Juan' } });
    });

    expect(result.current.values.nombre).toBe('Juan');
    expect(result.current.values.email).toBe('');
    expect(result.current.isDirty).toBe(true);
  });

  it('field() accepts raw values (not events)', () => {
    const { result } = renderHook(() => useForm({ active: false }));

    act(() => {
      result.current.field('active')(true);
    });

    expect(result.current.values.active).toBe(true);
  });

  it('setValues works directly', () => {
    const { result } = renderHook(() => useForm(initial));

    act(() => {
      result.current.setValues({ nombre: 'Ana', email: 'ana@test.com' });
    });

    expect(result.current.values).toEqual({ nombre: 'Ana', email: 'ana@test.com' });
  });

  it('reset() reverts to initial values', () => {
    const { result } = renderHook(() => useForm(initial));

    act(() => {
      result.current.field('nombre')({ target: { value: 'Juan' } });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.values).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it('reset(newValues) sets new baseline', () => {
    const { result } = renderHook(() => useForm(initial));

    const newBaseline = { nombre: 'Pedro', email: 'pedro@test.com' };
    act(() => {
      result.current.reset(newBaseline);
    });

    expect(result.current.values).toEqual(newBaseline);
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.field('nombre')({ target: { value: 'Pedro' } });
    });
    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.field('nombre')({ target: { value: 'Changed' } });
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('isDirty is false when values match initial', () => {
    const { result } = renderHook(() => useForm({ count: 0 }));

    act(() => {
      result.current.field('count')({ target: { value: 5 } });
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.field('count')({ target: { value: 0 } });
    });
    expect(result.current.isDirty).toBe(false);
  });
});
