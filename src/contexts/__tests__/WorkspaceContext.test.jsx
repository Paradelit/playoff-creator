import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';

// `vi.hoisted` is required because `vi.mock` factories are hoisted above
// all top-level declarations — referencing a normal `let mockAuth` from
// inside a factory would read `undefined` at the time the mocked module
// is first loaded. Hoisted state lets the factories read live values.
//
// IMPORTANT: `useFirebase` must return a stable object on every render —
// the WorkspaceProvider's membership effect depends on
// `[db, appId, user?.uid]`, so a fresh object literal each call creates
// an unsub→resub→setIsLoading(true)→rerender→fresh-object loop that
// runs the test out of memory. The hoisted singleton avoids that.
const hoisted = vi.hoisted(() => ({
  mockFirebase: { db: { __mock: 'db' }, appId: 'app1' },
  mockAuth: { user: null },
  onSnapshotMock: null, // populated below from vi.fn() at hoist time
}));

vi.mock('../FirebaseContext', () => ({
  useFirebase: () => hoisted.mockFirebase,
}));

vi.mock('../AuthContext', () => ({
  useAuth: () => hoisted.mockAuth,
}));

// Override the global firebase/firestore mock from src/test/setup.js. The
// global mock returns generic spies; here we need `onSnapshot` to be a
// configurable spy so each test can capture the snapshot callback and
// trigger it manually with mock memberships data.
vi.mock('firebase/firestore', () => ({
  collection: (...args) => ({ __col: args.slice(1).join('/') }),
  doc: (...args) => ({ __doc: args.slice(1).join('/') }),
  onSnapshot: (...args) => hoisted.onSnapshotMock(...args),
}));

import { resolveActiveWsId, WorkspaceProvider, useWorkspace } from '../WorkspaceContext';

const personal = { wsId: 'ws-personal', workspaceType: 'personal', role: 'owner' };
const club = { wsId: 'ws-club', workspaceType: 'club', role: 'coach' };

hoisted.onSnapshotMock = vi.fn();
const onSnapshotMock = hoisted.onSnapshotMock;
function setMockUser(user) {
  hoisted.mockAuth = { user };
}

describe('resolveActiveWsId', () => {
  it('returns savedWsId when it exists in memberships', () => {
    expect(resolveActiveWsId([personal, club], 'ws-club')).toBe('ws-club');
  });

  it('falls back to personal when savedWsId is not in memberships', () => {
    expect(resolveActiveWsId([personal, club], 'ws-deleted')).toBe('ws-personal');
  });

  it('falls back to personal when savedWsId is null', () => {
    expect(resolveActiveWsId([personal, club], null)).toBe('ws-personal');
  });

  it('returns first membership when no personal exists', () => {
    expect(resolveActiveWsId([club], null)).toBe('ws-club');
  });

  it('returns null when memberships is empty', () => {
    expect(resolveActiveWsId([], null)).toBe(null);
    expect(resolveActiveWsId([], 'whatever')).toBe(null);
  });
});

function Probe() {
  const ws = useWorkspace();
  return (
    <div>
      <span data-testid="loading">{String(ws.isLoading)}</span>
      <span data-testid="active">{ws.activeWsId ?? 'null'}</span>
      <span data-testid="count">{ws.memberships.length}</span>
    </div>
  );
}

beforeEach(() => {
  onSnapshotMock.mockReset();
  localStorage.clear();
});

describe('WorkspaceProvider', () => {
  it('renders with empty state when no user', () => {
    setMockUser(null);
    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('active').textContent).toBe('null');
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('subscribes to memberships and resolves active when user is set', async () => {
    setMockUser({ uid: 'u1' });
    let snapshotCallback;
    onSnapshotMock.mockImplementation((_ref, cb) => {
      snapshotCallback = cb;
      return () => {};
    });

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
    expect(onSnapshotMock).toHaveBeenCalled();

    act(() => {
      snapshotCallback({
        docs: [
          {
            id: 'ws-personal',
            data: () => ({ workspaceType: 'personal', role: 'owner', workspaceName: 'Mi cuenta' }),
          },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('ws-personal');
      expect(screen.getByTestId('count').textContent).toBe('1');
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('uses saved wsId from localStorage when present', async () => {
    setMockUser({ uid: 'u1' });
    localStorage.setItem('pickncoach.activeWsId', 'ws-club');

    let snapshotCallback;
    onSnapshotMock.mockImplementation((_ref, cb) => {
      snapshotCallback = cb;
      return () => {};
    });

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
    act(() => {
      snapshotCallback({
        docs: [
          { id: 'ws-personal', data: () => ({ workspaceType: 'personal' }) },
          { id: 'ws-club', data: () => ({ workspaceType: 'club' }) },
        ],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('ws-club');
    });
  });

  it('falls back to personal when saved wsId is no longer a membership', async () => {
    setMockUser({ uid: 'u1' });
    localStorage.setItem('pickncoach.activeWsId', 'ws-deleted');

    let snapshotCallback;
    onSnapshotMock.mockImplementation((_ref, cb) => {
      snapshotCallback = cb;
      return () => {};
    });

    render(
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>,
    );
    act(() => {
      snapshotCallback({
        docs: [{ id: 'ws-personal', data: () => ({ workspaceType: 'personal' }) }],
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('ws-personal');
    });
  });
});
