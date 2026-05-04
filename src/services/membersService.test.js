import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMembersService } from './membersService';

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => 'FN_REGION'),
  httpsCallable: vi.fn((_fn, name) => async (data) => ({ data: { _called: name, _payload: data } })),
}));

describe('membersService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createClub calls callable with name', async () => {
    const svc = createMembersService({ app: {} });
    const r = await svc.createClub({ name: 'Uros' });
    expect(r._called).toBe('createClub');
    expect(r._payload).toEqual({ name: 'Uros' });
  });

  it('inviteMember passes wsId+role+teams+email+name', async () => {
    const svc = createMembersService({ app: {} });
    const r = await svc.inviteMember({
      wsId: 'ws1',
      role: 'coach',
      assignedTeamIds: ['t'],
      email: 'p@x.com',
      name: 'P',
    });
    expect(r._called).toBe('inviteMember');
    expect(r._payload).toMatchObject({
      wsId: 'ws1',
      role: 'coach',
      assignedTeamIds: ['t'],
      email: 'p@x.com',
      name: 'P',
    });
  });

  it('acceptInvite passes wsId+inviteId', async () => {
    const svc = createMembersService({ app: {} });
    const r = await svc.acceptInvite({ wsId: 'ws1', inviteId: 'inv' });
    expect(r._called).toBe('acceptInvite');
  });

  it('transferOwnership passes wsId+newOwnerUid', async () => {
    const svc = createMembersService({ app: {} });
    const r = await svc.transferOwnership({ wsId: 'ws1', newOwnerUid: 'u2' });
    expect(r._called).toBe('transferOwnership');
    expect(r._payload).toEqual({ wsId: 'ws1', newOwnerUid: 'u2' });
  });
});
