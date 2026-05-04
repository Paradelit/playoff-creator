import { getFunctions, httpsCallable } from 'firebase/functions';

const REGION = 'europe-west1';

export function createMembersService({ app }) {
  const fns = getFunctions(app, REGION);
  const wrap = (name) => async (payload) => {
    const cb = httpsCallable(fns, name);
    const res = await cb(payload);
    return res.data;
  };
  return {
    createClub: wrap('createClub'),
    inviteMember: wrap('inviteMember'),
    acceptInvite: wrap('acceptInvite'),
    revokeInvite: wrap('revokeInvite'),
    revokeMember: wrap('revokeMember'),
    setMemberTeams: wrap('setMemberTeams'),
    setMemberRole: wrap('setMemberRole'),
    transferOwnership: wrap('transferOwnership'),
    getClubAllowlistStatus: wrap('getClubAllowlistStatus'),
  };
}
