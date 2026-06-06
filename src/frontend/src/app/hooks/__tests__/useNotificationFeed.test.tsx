import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Alert, User } from '@/app/types';

const mockGet = jest.fn();
jest.mock('@/app/lib/api-client', () => ({
  apiClient: { get: (...args: Parameters<typeof mockGet>) => mockGet(...args) },
}));

import { useNotificationFeed } from '@/app/hooks/useNotificationFeed';
import { useNotificationStore } from '@/app/hooks/useNotificationStore';
import { useAuthStore } from '@/app/hooks/useAuthStore';

const ORG_ID = '00000000-0000-0000-0000-000000000001';

const USER: User = {
  id: '00000000-0000-0000-0000-000000000099',
  email: 'user@example.com',
  displayName: 'User',
  avatarUrl: null,
  role: 'owner',
  organizationId: ORG_ID,
  createdAt: '2026-01-01T00:00:00+00:00',
  lastLoginAt: null,
};

let alertSeq = 0;

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  alertSeq += 1;
  return {
    id: `00000000-0000-0000-0000-${String(alertSeq).padStart(12, '0')}`,
    projectId: '00000000-0000-0000-0000-000000000010',
    alertRuleId: null,
    severity: 'high',
    title: 'Error spike',
    description: 'desc',
    firedAt: '2026-06-06T12:00:00+00:00',
    acknowledgedAt: null,
    resolvedAt: null,
    incidentId: '00000000-0000-0000-0000-000000000020',
    ...overrides,
  };
}

function alertsResponse(alerts: Alert[]) {
  return {
    data: {
      data: alerts,
      page: 1,
      pageSize: 15,
      total: alerts.length,
    },
  };
}

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function renderFeed() {
  return renderHook(() => useNotificationFeed(), { wrapper: createWrapper() });
}

describe('useNotificationFeed', () => {
  beforeEach(() => {
    mockGet.mockReset();
    useNotificationStore.setState({ lastSeenAt: {}, ephemeral: [] });
    useAuthStore.setState({ user: USER });
  });

  it('counts unseen High and Critical alerts toward the badge', async () => {
    mockGet.mockResolvedValue(alertsResponse([
      makeAlert({ severity: 'high' }),
      makeAlert({ severity: 'critical' }),
    ]));

    const { result } = renderFeed();

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.unreadCount).toBe(2);
  });

  it('lists Medium/Low alerts without counting them', async () => {
    mockGet.mockResolvedValue(alertsResponse([
      makeAlert({ severity: 'medium' }),
      makeAlert({ severity: 'low' }),
      makeAlert({ severity: 'high' }),
    ]));

    const { result } = renderFeed();

    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.items.every((i) => i.unread)).toBe(true);
  });

  it('does not count alerts older than the lastSeenAt watermark', async () => {
    useNotificationStore.setState({
      lastSeenAt: { [ORG_ID]: '2026-06-06T13:00:00+00:00' },
      ephemeral: [],
    });
    mockGet.mockResolvedValue(alertsResponse([
      makeAlert({ severity: 'high', firedAt: '2026-06-06T12:00:00+00:00' }),
      makeAlert({ severity: 'high', firedAt: '2026-06-06T14:00:00+00:00' }),
    ]));

    const { result } = renderFeed();

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.unreadCount).toBe(1);
  });

  it('counts unseen ephemeral items regardless of severity policy', async () => {
    mockGet.mockResolvedValue(alertsResponse([]));
    useNotificationStore.getState().pushEphemeral({
      id: 'analysis-1',
      type: 'ai',
      title: 'AI analysis completed',
      incidentId: 'inc-1',
      at: '2026-06-06T12:00:00+00:00',
    });

    const { result } = renderFeed();

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.items[0]).toMatchObject({ kind: 'ai', incidentId: 'inc-1' });
  });

  it('markAllRead zeroes the badge', async () => {
    mockGet.mockResolvedValue(alertsResponse([makeAlert({ severity: 'critical' })]));

    const { result } = renderFeed();
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    act(() => result.current.markAllRead());

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(result.current.items).toHaveLength(1);
  });

  it('returns an empty feed for org-less users and never queries', () => {
    useAuthStore.setState({ user: { ...USER, organizationId: null } });

    const { result } = renderFeed();

    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(mockGet).not.toHaveBeenCalled();
  });
});
