import type { Timestamp } from 'firebase-admin/firestore';

export type ClubRole = 'dt' | 'coach';

// workspaces/{wsId}/invites/{inviteId}
export interface InviteDoc {
  inviteId: string;
  workspaceId: string;
  invitedBy: string;
  inviteEmail: string | null;
  inviteName: string | null;
  role: ClubRole;
  assignedTeamIds: string[];
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// workspaces/{wsId}/members/{uid} en clubs (en personal el role es 'owner').
export interface ClubMemberDoc {
  role: ClubRole;
  assignedTeamIds: string[];
  displayName: string;
  email: string;
  joinedAt: Timestamp;
  invitedBy: string | null;
  mismatchedEmailHint?: true;
}

// users/{uid}/memberships/{wsId}
export interface MembershipDoc {
  workspaceType: 'personal' | 'club';
  workspaceName: string;
  role: 'owner' | ClubRole;
  joinedAt: Timestamp;
}

export const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
