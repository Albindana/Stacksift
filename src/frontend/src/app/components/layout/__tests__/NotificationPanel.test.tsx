import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationPanel } from '../NotificationPanel';
import type { NotificationFeedItem } from '@/app/hooks/useNotificationFeed';

function item(overrides: Partial<NotificationFeedItem> = {}): NotificationFeedItem {
  return {
    id: 'alert-1',
    kind: 'alert',
    title: 'Error spike',
    severity: 'high',
    incidentId: 'inc-1',
    projectId: 'proj-1',
    at: new Date().toISOString(),
    unread: true,
    ...overrides,
  };
}

function renderPanel(items: NotificationFeedItem[], overrides: Partial<Parameters<typeof NotificationPanel>[0]> = {}) {
  const onMarkAllRead = jest.fn();
  const onClose = jest.fn();
  render(
    <NotificationPanel
      id="panel"
      items={items}
      isLoading={false}
      onMarkAllRead={onMarkAllRead}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onMarkAllRead, onClose };
}

describe('NotificationPanel', () => {
  it('routes alert items to their incident', () => {
    renderPanel([item()]);
    expect(screen.getByRole('link', { name: /error spike/i }))
      .toHaveAttribute('href', '/incidents/inc-1');
  });

  it('routes incident-less alerts to /alerts', () => {
    renderPanel([item({ incidentId: null })]);
    expect(screen.getByRole('link', { name: /error spike/i }))
      .toHaveAttribute('href', '/alerts');
  });

  it('routes subscription items to billing settings', () => {
    renderPanel([item({ id: 's1', kind: 'subscription', title: 'Subscription updated', severity: null, incidentId: null })]);
    expect(screen.getByRole('link', { name: /subscription updated/i }))
      .toHaveAttribute('href', '/settings/billing');
  });

  it('routes AI items to their incident', () => {
    renderPanel([item({ id: 'a1', kind: 'ai', title: 'AI analysis completed', severity: null })]);
    expect(screen.getByRole('link', { name: /ai analysis completed/i }))
      .toHaveAttribute('href', '/incidents/inc-1');
  });

  it('shows an unread dot only for unread items', () => {
    renderPanel([item({ id: 'u', unread: true }), item({ id: 'r', title: 'Old alert', unread: false })]);
    expect(screen.getAllByLabelText('Unread')).toHaveLength(1);
  });

  it('closes on item navigation', () => {
    const { onClose } = renderPanel([item()]);
    fireEvent.click(screen.getByRole('link', { name: /error spike/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('fires mark-all-read from the header button', () => {
    const { onMarkAllRead } = renderPanel([item()]);
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when there is nothing to show', () => {
    renderPanel([]);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('always offers the view-all footer link', () => {
    renderPanel([]);
    expect(screen.getByRole('link', { name: /view all alerts/i }))
      .toHaveAttribute('href', '/alerts');
  });
});
