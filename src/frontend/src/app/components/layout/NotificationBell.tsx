'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { PulsingBadge } from '@/app/components/animation/PulsingBadge';
import { useNotificationFeed } from '@/app/hooks/useNotificationFeed';
import { NotificationPanel } from './NotificationPanel';

// ---------------------------------------------------------------------------
// NotificationBell
//
// Bell button + unread badge + notification panel. Self-contained: the feed
// (recent alerts + session SignalR events) and the High/Critical badge policy
// live in useNotificationFeed. Opening the panel marks everything read after
// a short grace delay so the user can still see which items were new.
// ---------------------------------------------------------------------------

const MARK_READ_GRACE_MS = 1_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { items, unreadCount, isLoading, markAllRead } = useNotificationFeed();

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || unreadCount === 0) return;
    const timer = setTimeout(markAllRead, MARK_READ_GRACE_MS);
    return () => clearTimeout(timer);
  }, [open, unreadCount, markAllRead]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-1.5 text-muted transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />

        <PulsingBadge count={unreadCount} className="absolute -top-0.5 -right-0.5" />
      </button>

      {open ? (
        <NotificationPanel
          id={panelId}
          items={items}
          isLoading={isLoading}
          onMarkAllRead={markAllRead}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
