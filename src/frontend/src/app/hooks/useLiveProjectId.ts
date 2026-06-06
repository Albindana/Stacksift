'use client';

import { useUIStore } from '@/app/hooks/useUIStore';
import { useProjects } from '@/app/hooks/queries/use-projects';

// ---------------------------------------------------------------------------
// useLiveProjectId — which project the live SignalR feed should tail.
//
// The server broadcasts log entries to `project-{id}` groups, so the client
// must join exactly one project group to receive anything. Resolution order:
//   1. liveProjectOverride — the logs page's project filter (what the user is
//      actually looking at right now)
//   2. activeProjectId    — the OrgSwitcher selection (persisted preference)
//   3. first project      — sane default so users who never touched the
//      switcher still get a live feed instead of silence
// ---------------------------------------------------------------------------

export function useLiveProjectId(): string | null {
  const override = useUIStore((s) => s.liveProjectOverride);
  const activeProjectId = useUIStore((s) => s.activeProjectId);
  const { data: projects } = useProjects();

  return override ?? activeProjectId ?? projects?.[0]?.id ?? null;
}
