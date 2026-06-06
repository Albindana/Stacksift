import { useNotificationStore } from '../useNotificationStore';
import type { EphemeralNotificationType } from '../useNotificationStore';

function pushTest(id: string, type: EphemeralNotificationType = 'ai') {
  useNotificationStore.getState().pushEphemeral({
    id,
    type,
    title: `Notification ${id}`,
    at: new Date().toISOString(),
  });
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ lastSeenAt: {}, ephemeral: [] });
    window.localStorage.clear();
  });

  it('pushEphemeral adds unseen notifications newest-first', () => {
    pushTest('a');
    pushTest('b');

    const { ephemeral } = useNotificationStore.getState();
    expect(ephemeral.map((n) => n.id)).toEqual(['b', 'a']);
    expect(ephemeral.every((n) => !n.seen)).toBe(true);
  });

  it('pushEphemeral dedupes by id', () => {
    pushTest('a');
    pushTest('a');

    expect(useNotificationStore.getState().ephemeral).toHaveLength(1);
  });

  it('pushEphemeral caps the list at 20', () => {
    for (let i = 0; i < 25; i += 1) pushTest(`n-${i}`);

    const { ephemeral } = useNotificationStore.getState();
    expect(ephemeral).toHaveLength(20);
    expect(ephemeral[0].id).toBe('n-24');
  });

  it('markAllSeen stamps the org watermark and flags ephemeral items', () => {
    pushTest('a');
    const before = new Date().toISOString();

    useNotificationStore.getState().markAllSeen('org-1');

    const state = useNotificationStore.getState();
    expect(state.lastSeenAt['org-1'] >= before).toBe(true);
    expect(state.lastSeenAt['org-2']).toBeUndefined();
    expect(state.ephemeral[0].seen).toBe(true);
  });

  it('reset clears ephemeral but keeps lastSeenAt', () => {
    pushTest('a');
    useNotificationStore.getState().markAllSeen('org-1');

    useNotificationStore.getState().reset();

    const state = useNotificationStore.getState();
    expect(state.ephemeral).toEqual([]);
    expect(state.lastSeenAt['org-1']).toBeDefined();
  });

  it('persists only lastSeenAt', () => {
    pushTest('a');
    useNotificationStore.getState().markAllSeen('org-1');

    const persisted = JSON.parse(
      window.localStorage.getItem('stacksift-notifications') ?? '{}',
    ) as { state?: { lastSeenAt?: Record<string, string>; ephemeral?: unknown } };

    expect(persisted.state?.lastSeenAt?.['org-1']).toBeDefined();
    expect(persisted.state?.ephemeral).toBeUndefined();
  });
});
