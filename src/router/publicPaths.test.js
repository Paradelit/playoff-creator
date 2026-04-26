import { describe, it, expect } from 'vitest';
import { isPublicPath } from './publicPaths';

describe('isPublicPath', () => {
  it('returns true for landing', () => {
    expect(isPublicPath('/')).toBe(true);
  });

  it('returns true for login', () => {
    expect(isPublicPath('/login')).toBe(true);
  });

  it('returns true for help index', () => {
    expect(isPublicPath('/ayuda')).toBe(true);
  });

  it('returns true for help articles', () => {
    expect(isPublicPath('/ayuda/como-crear-equipo')).toBe(true);
    expect(isPublicPath('/ayuda/foo-bar-baz')).toBe(true);
  });

  it('returns true for share routes', () => {
    expect(isPublicPath('/s/abc123')).toBe(true);
    expect(isPublicPath('/exercise/xyz')).toBe(true);
  });

  it('returns false for /area-privada', () => {
    expect(isPublicPath('/area-privada')).toBe(false);
    expect(isPublicPath('/area-privada/teams')).toBe(false);
    expect(isPublicPath('/area-privada/teams/abc/cuaderno')).toBe(false);
  });

  it('returns false for legacy paths (they will redirect)', () => {
    expect(isPublicPath('/teams')).toBe(false);
    expect(isPublicPath('/calendar')).toBe(false);
  });
});
