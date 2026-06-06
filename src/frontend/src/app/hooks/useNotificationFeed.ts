'use client';

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/app/lib/api-client';
import { AlertSchema, PaginatedResponseSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import { useNotificationStore } from '@/app/hooks/useNotificationStore';
import type { Alert, AlertSeverity } from '@/app/types';
import type { EphemeralNotificationType } from '@/app/hooks/useNotificationStore';

const FEED_PAGE_SIZE = 15;
const BADGE_SEVERITIES: readonly AlertSeverity[] = ['high', 'critical'];

export interface NotificationFeedItem {
  id: string;
  kind: 'alert' | EphemeralNotificationType;
  title: string;
  severity: AlertSeverity | null;
  incidentId: string | null;
  projectId: string | null;
  at: string;
  unread: boolean;
}

export interface NotificationFeed {
  items: NotificationFeedItem[];
  unreadCount: number;
  isLoading: boolean;
  markAllRead: () => void;
}

// ---------------------------------------------------------------------------
// useNotificationFeed
//
// Computes the bell feed + unread badge from two sources:
//   durable:   recent alerts from the API (refetched on ReceiveAlert
//              invalidation), unread = firedAt after the org's lastSeenAt
//              watermark
//   ephemeral: session-collected SignalR events (AI completions,
//              subscription updates) from useNotificationStore
//
// Badge policy: only High/Critical alerts interrupt (mirrors the
// immediate-email gate) + any unseen ephemeral item. Medium/Low alerts are
// listed but never counted.
// ---------------------------------------------------------------------------

export function useNotificationFeed(): NotificationFeed {
  const orgId = useAuthStore((s) => s.user?.organizationId ?? null);
  const lastSeenAt = useNotificationStore((s) => s.lastSeenAt);
  const ephemeral = useNotificationStore((s) => s.ephemeral);
  const markAllSeen = useNotificationStore((s) => s.markAllSeen);

  const alertsQuery = useQuery<Alert[]>({
    queryKey: queryKeys.alerts.list(),
    enabled: orgId !== null,
    queryFn: async () => {
      const response = await apiClient.get(
        '/api/v1/alerts',
        {
          params: { page: 1, pageSize: FEED_PAGE_SIZE },
          schema: PaginatedResponseSchema(AlertSchema),
        },
      );
      return response.data.data;
    },
  });

  const watermark = orgId ? lastSeenAt[orgId] ?? null : null;

  const { items, unreadCount } = useMemo(() => {
    if (!orgId) return { items: [], unreadCount: 0 };

    const alertItems: NotificationFeedItem[] = (alertsQuery.data ?? []).map((alert) => ({
      id: alert.id,
      kind: 'alert',
      title: alert.title,
      severity: alert.severity,
      incidentId: alert.incidentId,
      projectId: alert.projectId,
      at: alert.firedAt,
      unread: watermark === null || alert.firedAt > watermark,
    }));

    const ephemeralItems: NotificationFeedItem[] = ephemeral.map((n) => ({
      id: n.id,
      kind: n.type,
      title: n.title,
      severity: null,
      incidentId: n.incidentId ?? null,
      projectId: null,
      at: n.at,
      unread: !n.seen,
    }));

    const merged = [...alertItems, ...ephemeralItems]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, FEED_PAGE_SIZE);

    const count =
      alertItems.filter(
        (i) => i.unread && i.severity !== null && BADGE_SEVERITIES.includes(i.severity),
      ).length + ephemeralItems.filter((i) => i.unread).length;

    return { items: merged, unreadCount: count };
  }, [orgId, alertsQuery.data, ephemeral, watermark]);

  const markAllRead = useCallback(() => {
    if (orgId) markAllSeen(orgId);
  }, [orgId, markAllSeen]);

  return {
    items,
    unreadCount,
    isLoading: orgId !== null && alertsQuery.isLoading,
    markAllRead,
  };
}
