import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseArgs } from '../migrateToWorkspaces.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseArgs', () => {
  it('parses --user UID into args.user', () => {
    const argv = ['node', 'migrateToWorkspaces.js', '--user', 'abc123'];
    const args = parseArgs(argv);
    expect(args.user).toBe('abc123');
  });

  it('parses all value-taking flags together', () => {
    const argv = [
      'node',
      'migrateToWorkspaces.js',
      '--dry-run',
      '--user',
      'u1',
      '--project',
      'p1',
      '--credentials',
      '/tmp/creds.json',
      '--app-id',
      'custom-app',
    ];
    const args = parseArgs(argv);
    expect(args).toMatchObject({
      dryRun: true,
      user: 'u1',
      project: 'p1',
      credentials: '/tmp/creds.json',
      appId: 'custom-app',
    });
  });

  it('rejects --user when followed by another flag', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    expect(() => parseArgs(['node', 'migrateToWorkspaces.js', '--user', '--project'])).toThrow(/process\.exit/);
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringMatching(/--user/));
  });

  it('rejects --user at the end of argv (no value)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    expect(() => parseArgs(['node', 'migrateToWorkspaces.js', '--user'])).toThrow(/process\.exit/);
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(errSpy).toHaveBeenCalledWith(expect.stringMatching(/--user/));
  });

  it('rejects --project when followed by another flag', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    expect(() => parseArgs(['node', 'migrateToWorkspaces.js', '--project', '--user', 'u1'])).toThrow(/process\.exit/);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('rejects --credentials with no value at end of argv', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    expect(() => parseArgs(['node', 'migrateToWorkspaces.js', '--credentials'])).toThrow(/process\.exit/);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('rejects --app-id when followed by another flag', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    expect(() => parseArgs(['node', 'migrateToWorkspaces.js', '--app-id', '--dry-run'])).toThrow(/process\.exit/);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('uses default appId when --app-id is not passed', () => {
    const args = parseArgs(['node', 'migrateToWorkspaces.js', '--dry-run']);
    expect(args.appId).toBe('uros-fbm-app');
  });
});
