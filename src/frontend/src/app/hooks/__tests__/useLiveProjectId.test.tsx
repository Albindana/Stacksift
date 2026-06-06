import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Project } from '@/app/types';

let mockProjects: Project[] | undefined;

jest.mock('@/app/hooks/queries/use-projects', () => ({
  useProjects: () => ({ data: mockProjects, isLoading: false }),
}));

import { useLiveProjectId } from '@/app/hooks/useLiveProjectId';
import { useUIStore } from '@/app/hooks/useUIStore';

function buildProject(id: string, name: string): Project {
  return {
    id,
    organizationId: 'org-1',
    name,
    slug: name.toLowerCase(),
    description: null,
    color: '#000000',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    logSourceCount: 0,
    activeIncidentCount: 0,
  };
}

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useLiveProjectId', () => {
  beforeEach(() => {
    mockProjects = [buildProject('proj-first', 'First'), buildProject('proj-second', 'Second')];
    useUIStore.setState({ activeProjectId: null, liveProjectOverride: null });
  });

  it('prefers the logs-page override over everything', () => {
    useUIStore.setState({ activeProjectId: 'proj-active', liveProjectOverride: 'proj-override' });

    const { result } = renderHook(() => useLiveProjectId(), { wrapper: createWrapper() });

    expect(result.current).toBe('proj-override');
  });

  it('falls back to the OrgSwitcher selection when no override is set', () => {
    useUIStore.setState({ activeProjectId: 'proj-active', liveProjectOverride: null });

    const { result } = renderHook(() => useLiveProjectId(), { wrapper: createWrapper() });

    expect(result.current).toBe('proj-active');
  });

  it('falls back to the first project when nothing is selected', () => {
    const { result } = renderHook(() => useLiveProjectId(), { wrapper: createWrapper() });

    expect(result.current).toBe('proj-first');
  });

  it('returns null when there are no projects at all', () => {
    mockProjects = [];

    const { result } = renderHook(() => useLiveProjectId(), { wrapper: createWrapper() });

    expect(result.current).toBeNull();
  });
});
