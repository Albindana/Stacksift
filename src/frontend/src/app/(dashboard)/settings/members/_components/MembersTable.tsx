'use client';

import { useMemo } from 'react';
import { Button } from '@/app/components/ui';
import type { Member, UserRole } from '@/app/types';

interface MembersTableProps {
  members: Member[];
  currentUserId: string | undefined;
  canManage: boolean;
  onChangeRole: (userId: string, role: UserRole) => void;
  onRemove: (userId: string) => void;
}

const ROLES: UserRole[] = ['owner', 'admin', 'member', 'viewer'];

export function MembersTable({
  members,
  currentUserId,
  canManage,
  onChangeRole,
  onRemove,
}: MembersTableProps) {
  const ownerCount = useMemo(
    () => members.filter((m) => m.role === 'owner').length,
    [members],
  );

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line bg-elevated p-8 text-center text-sm text-muted">
        No members yet.
      </div>
    );
  }

  // Responsive list (not a <table>): each member stacks into a card below `sm`
  // and reflows into aligned columns at `sm+`. A single set of controls per
  // member keeps the DOM unambiguous (one <select>/<button> each).
  return (
    <div className="flex flex-col gap-3 sm:gap-0 sm:overflow-hidden sm:rounded-xl sm:border sm:border-line sm:bg-surface">
      {/* Column header — desktop only; the cards are self-describing on mobile. */}
      <div
        aria-hidden="true"
        className="hidden bg-elevated px-4 py-3 text-xs uppercase tracking-wide text-muted sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-4"
      >
        <span className="font-medium">Member</span>
        <span className="font-medium">Role</span>
        <span className="font-medium text-right">Actions</span>
      </div>

      <ul className="flex flex-col gap-3 sm:gap-0 sm:divide-y sm:divide-line">
        {members.map((member) => {
          const isLastOwner = member.role === 'owner' && ownerCount <= 1;
          const isSelf = member.id === currentUserId;
          return (
            <li
              key={member.id}
              className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 text-sm sm:grid sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:px-4 sm:py-3"
            >
              <div>
                <div className="font-medium text-primary">{member.displayName}</div>
                <div className="text-xs text-muted">{member.email}</div>
                {member.invitedByDisplayName ? (
                  <div className="mt-1 text-xs text-muted">
                    Invited by {member.invitedByDisplayName}
                  </div>
                ) : null}
              </div>

              <div>
                {canManage ? (
                  <select
                    aria-label={`Role for ${member.displayName}`}
                    className="w-full rounded-md border border-line bg-elevated px-2 py-1 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:w-auto"
                    value={member.role}
                    onChange={(e) => onChangeRole(member.id, e.target.value as UserRole)}
                  >
                    {ROLES.map((role) => (
                      <option
                        key={role}
                        value={role}
                        disabled={isLastOwner && role !== 'owner'}
                      >
                        {role}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="inline-flex rounded-md bg-elevated px-2 py-1 text-sm capitalize text-primary">
                    {member.role}
                  </span>
                )}
                {isLastOwner ? (
                  <p className="mt-1 text-xs text-muted">
                    Promote another member to owner before changing this role.
                  </p>
                ) : null}
              </div>

              <div className="sm:justify-self-end sm:text-right">
                {canManage && !isLastOwner ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onRemove(member.id)}
                    aria-label={`Remove ${member.displayName}`}
                  >
                    {isSelf ? 'Leave' : 'Remove'}
                  </Button>
                ) : null}
                {!canManage ? <span className="text-xs text-muted">Read-only</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
