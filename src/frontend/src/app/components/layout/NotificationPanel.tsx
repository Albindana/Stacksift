'use client';

import Link from 'next/link';
import { AlertTriangle, Sparkles, CreditCard, CheckCheck } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { cn } from '@/app/lib/utils';
import type { NotificationFeedItem } from '@/app/hooks/useNotificationFeed';
import type { AlertSeverity } from '@/app/types';

interface NotificationPanelProps {
  id: string;
  items: NotificationFeedItem[];
  isLoading: boolean;
  onMarkAllRead: () => void;
  onClose: () => void;
}

const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-amber-500',
  low: 'text-sky-500',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function itemHref(item: NotificationFeedItem): string {
  if (item.kind === 'subscription') return '/settings/billing';
  return item.incidentId ? `/incidents/${item.incidentId}` : '/alerts';
}

function ItemIcon({ item }: { item: NotificationFeedItem }) {
  if (item.kind === 'ai') {
    return <Sparkles className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />;
  }
  if (item.kind === 'subscription') {
    return <CreditCard className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />;
  }
  return (
    <AlertTriangle
      className={cn(
        'h-4 w-4 shrink-0',
        item.severity ? SEVERITY_COLOR[item.severity] : 'text-muted',
      )}
      aria-hidden="true"
    />
  );
}

export function NotificationPanel({
  id,
  items,
  isLoading,
  onMarkAllRead,
  onClose,
}: NotificationPanelProps) {
  return (
    <div
      id={id}
      role="dialog"
      aria-label="Notifications"
      className={cn(
        'absolute right-0 top-full z-50 mt-2 flex flex-col',
        'w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-lg border border-line bg-surface shadow-xl',
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-sm font-semibold">Notifications</span>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted transition-colors hover:bg-elevated hover:text-primary"
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Mark all read
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            You&apos;re all caught up.
          </p>
        ) : (
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={itemHref(item)}
                  onClick={onClose}
                  className="flex items-start gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-elevated"
                >
                  <ItemIcon item={item} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm">
                      {item.severity ? (
                        <span className="capitalize">{item.severity}: </span>
                      ) : null}
                      {item.title}
                    </span>
                    <span className="text-xs text-muted">{timeAgo(item.at)}</span>
                  </span>
                  {item.unread ? (
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
                      aria-label="Unread"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/alerts"
        onClick={onClose}
        className="border-t border-line px-4 py-2.5 text-center text-xs font-medium text-blue-500 transition-colors hover:bg-elevated"
      >
        View all alerts →
      </Link>
    </div>
  );
}
