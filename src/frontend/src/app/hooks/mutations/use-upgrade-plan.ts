'use client';

import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { apiClient } from '@/app/lib/api-client';
import { CheckoutSessionSchema, type CheckoutSession } from '@/app/lib/billing-schemas';
import { trackEvent, AnalyticsEvent } from '@/app/lib/analytics';

export type UpgradePlanTier = 'indie' | 'team';

export interface UpgradePlanVars {
  plan: UpgradePlanTier;
  from?: string | null;
}

const TIER_TO_BACKEND: Record<UpgradePlanTier, 'Indie' | 'Team'> = {
  indie: 'Indie',
  team: 'Team',
};

export function useUpgradePlan() {
  return useMutation<CheckoutSession, AxiosError, UpgradePlanVars>({
    mutationFn: async ({ plan, from }) => {
      const response = await apiClient.post(
        '/api/v1/billing/checkout-session',
        {
          plan: TIER_TO_BACKEND[plan],
          from: from ?? null,
        },
        { schema: CheckoutSessionSchema },
      );
      return response.data;
    },
    // Fires once per checkout initiation, from both entry points (the funnel
    // /billing/checkout bootstrap and the settings billing panel) since both go
    // through this hook. `plan_upgraded` (completion) fires on /billing/success.
    onSuccess: (_session, { plan }) => {
      trackEvent(AnalyticsEvent.CheckoutStarted, { plan });
    },
  });
}
