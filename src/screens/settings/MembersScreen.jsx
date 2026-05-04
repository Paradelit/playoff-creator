import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFirebase } from '../../contexts/FirebaseContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import { useMembers } from '../../hooks/useMembers';
import { useInvites } from '../../hooks/useInvites';
import { useTeams } from '../../hooks/useTeams';
import { createMembersService } from '../../services/membersService';
import { InviteMemberModal } from './InviteMemberModal';
import { InviteSuccessModal } from './InviteSuccessModal';
import { MemberActionMenu } from './MemberActionMenu';

function daysUntil(ts) {
  if (!ts?.toDate) return '—';
  const ms = ts.toDate().getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function MembersScreen() {
  const { app } = useFirebase();
  const { user } = useAuth();
  const { activeWsId, activeWorkspace } = useWorkspace();
  const { push } = useToast();
  const { members } = useMembers(activeWsId);
  const { invites } = useInvites(activeWsId);
  const { teams } = useTeams();

  const svc = useMemo(() => createMembersService({ app }), [app]);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [successLink, setSuccessLink] = useState(null);

  if (!activeWorkspace || activeWorkspace.type !== 'club') {
    return null;
  }

  const callerUid = user?.uid;
  const ownerUid = activeWorkspace.ownerId;
  const callerIsOwner = callerUid === ownerUid;
  const callerMember = members.find((m) => m.uid === callerUid);
  const callerIsDt = callerMember?.role === 'dt';
  const canEdit = callerIsOwner || callerIsDt;

  async function handleInvite(payload) {
    setInviteSubmitting(true);
    try {
      const r = await svc.inviteMember({ wsId: activeWsId, ...payload });
      setShowInvite(false);
      setSuccessLink(r.link);
    } catch (err) {
      push({ message: err?.message || 'Error al crear invitación', tone: 'error' });
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleRevokeInvite(inviteId) {
    try {
      await svc.revokeInvite({ wsId: activeWsId, inviteId });
      push({ message: 'Invitación cancelada', tone: 'success' });
    } catch (err) {
      push({ message: err?.message || 'Error', tone: 'error' });
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="flex justify-between items-baseline mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Miembros del club</h1>
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            Invitar al staff
          </button>
        )}
      </header>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Miembros activos</h2>
        <ul className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {members.map((m) => {
            const isOwner = m.uid === ownerUid;
            const isCallerRow = m.uid === callerUid;
            const editable = canEdit && !isCallerRow && !isOwner;
            return (
              <li key={m.uid} className="px-4 py-3 flex items-center justify-between relative">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.displayName || m.email}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded">
                      {m.role}
                    </span>
                    {isOwner && (
                      <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        Propietario
                      </span>
                    )}
                  </div>
                </div>
                {editable && (
                  <MemberActionMenu
                    member={m}
                    teams={teams}
                    onChangeRole={async (role) => {
                      await svc.setMemberRole({ wsId: activeWsId, memberUid: m.uid, role });
                    }}
                    onEditTeams={async (assignedTeamIds) => {
                      await svc.setMemberTeams({ wsId: activeWsId, memberUid: m.uid, assignedTeamIds });
                    }}
                    onRevoke={async () => {
                      await svc.revokeMember({ wsId: activeWsId, memberUid: m.uid });
                    }}
                  />
                )}
                {isCallerRow && callerIsOwner && (
                  <Link
                    to="/area-privada/settings/transferir-propiedad"
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Transferir propiedad
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Invitaciones pendientes ({invites.length})
        </h2>
        <ul className="space-y-2">
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">
                  {inv.inviteName || inv.inviteEmail || '(sin nombre)'}{' '}
                  <span className="text-xs text-slate-400">· {inv.role}</span>
                </p>
                <p className="text-xs text-slate-500">Caduca en {daysUntil(inv.expiresAt)} días</p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard?.writeText(`${window.location.origin}/invite/${activeWsId}/${inv.id}`)
                    }
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Copiar link
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar invitación"
                    onClick={() => handleRevokeInvite(inv.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {showInvite && (
        <InviteMemberModal
          teams={teams}
          submitting={inviteSubmitting}
          onClose={() => setShowInvite(false)}
          onSubmit={handleInvite}
        />
      )}
      {successLink && <InviteSuccessModal link={successLink} onClose={() => setSuccessLink(null)} />}
    </div>
  );
}

export default MembersScreen;
