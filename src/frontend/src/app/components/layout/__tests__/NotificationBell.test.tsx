import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { NotificationFeed, NotificationFeedItem } from '@/app/hooks/useNotificationFeed';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// PulsingBadge is a Framer Motion component — mock it as a plain span so
// tests can assert on its content without needing the animation runtime.
jest.mock('@/app/components/animation/PulsingBadge', () => ({
  PulsingBadge: ({
    count,
    className,
  }: {
    count: number;
    className?: string;
  }) => {
    if (count === 0) return null;
    return (
      <span aria-hidden="true" className={className}>
        {count > 99 ? '99+' : count}
      </span>
    );
  },
}));

const mockMarkAllRead = jest.fn();
let mockFeed: NotificationFeed;

jest.mock('@/app/hooks/useNotificationFeed', () => ({
  useNotificationFeed: () => mockFeed,
}));

import { NotificationBell } from '../NotificationBell';

function feedItem(overrides: Partial<NotificationFeedItem> = {}): NotificationFeedItem {
  return {
    id: 'alert-1',
    kind: 'alert',
    title: 'Error spike',
    severity: 'high',
    incidentId: 'inc-1',
    projectId: 'proj-1',
    at: '2026-06-06T12:00:00+00:00',
    unread: true,
    ...overrides,
  };
}

function setFeed(overrides: Partial<NotificationFeed> = {}) {
  mockFeed = {
    items: [],
    unreadCount: 0,
    isLoading: false,
    markAllRead: mockMarkAllRead,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationBell', () => {
  beforeEach(() => {
    mockMarkAllRead.mockReset();
    setFeed();
  });

  it('renders a button with the unread count in the aria-label', () => {
    setFeed({ unreadCount: 3 });
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: /3 unread/i })).toBeInTheDocument();
  });

  it('does not render a badge when unreadCount is 0', () => {
    render(<NotificationBell />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('renders a badge with the count when unreadCount > 0', () => {
    setFeed({ unreadCount: 5 });
    render(<NotificationBell />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('toggles the panel and aria-expanded on click', () => {
    setFeed({ items: [feedItem()] });
    render(<NotificationBell />);

    const button = screen.getByRole('button', { name: /notifications/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: /notifications/i })).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the panel on Escape', () => {
    setFeed({ items: [feedItem()] });
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks all read after the grace delay when opened with unread items', () => {
    jest.useFakeTimers();
    try {
      setFeed({ items: [feedItem()], unreadCount: 1 });
      render(<NotificationBell />);

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      expect(mockMarkAllRead).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1_000);
      });
      expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not mark read when there is nothing unread', () => {
    jest.useFakeTimers();
    try {
      setFeed({ items: [feedItem({ unread: false })], unreadCount: 0 });
      render(<NotificationBell />);

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(mockMarkAllRead).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
