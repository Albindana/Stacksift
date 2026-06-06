import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type EphemeralNotificationType = 'ai' | 'subscription';

export interface EphemeralNotification {
  id: string;
  type: EphemeralNotificationType;
  title: string;
  incidentId?: string;
  at: string;
  seen: boolean;
}

const EPHEMERAL_CAP = 20;

interface NotificationStore {
  /**
   * Per-org "everything up to here has been seen" watermark (ISO timestamp).
   * Persisted — survives refresh AND sign-out so re-login doesn't resurrect
   * a stale badge. The unread badge is computed against it, never stored.
   */
  lastSeenAt: Record<string, string>;
  /** Session-only notifications collected from SignalR (AI completions,
   * subscription updates). Not persisted — vanishes on refresh by design. */
  ephemeral: EphemeralNotification[];

  pushEphemeral: (notification: Omit<EphemeralNotification, 'seen'>) => void;
  markAllSeen: (orgId: string) => void;
  /** Sign-out hygiene: clears session notifications, keeps lastSeenAt. */
  reset: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      (set) => ({
        lastSeenAt: {},
        ephemeral: [],

        pushEphemeral: (notification) =>
          set(
            (state) => {
              if (state.ephemeral.some((n) => n.id === notification.id)) return state;
              return {
                ephemeral: [
                  { ...notification, seen: false },
                  ...state.ephemeral,
                ].slice(0, EPHEMERAL_CAP),
              };
            },
            false,
            'pushEphemeral',
          ),

        markAllSeen: (orgId) =>
          set(
            (state) => ({
              lastSeenAt: { ...state.lastSeenAt, [orgId]: new Date().toISOString() },
              ephemeral: state.ephemeral.map((n) => (n.seen ? n : { ...n, seen: true })),
            }),
            false,
            'markAllSeen',
          ),

        reset: () => set({ ephemeral: [] }, false, 'reset'),
      }),
      {
        name: 'stacksift-notifications',
        partialize: (state) => ({ lastSeenAt: state.lastSeenAt }),
      },
    ),
    { name: 'NotificationStore' },
  ),
);
