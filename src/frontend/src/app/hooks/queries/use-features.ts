'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiClient } from '@/app/lib/api-client';
import { queryKeys } from '@/app/lib/query-keys';

// Feature flags are delivered through the BFF (GET /api/v1/features), not by the
// browser talking to Unleash directly — so there's no public Unleash, no baked
// frontend token, and no CORS. The backend (server SDK) is the authoritative
// gate; this is UX only.
const featureFlagsSchema = z.object({
  flags: z.record(z.string(), z.boolean()),
});
type FeatureFlags = z.infer<typeof featureFlagsSchema>;

// Re-poll so a flag flipped in the Unleash UI reflects in the SPA within ~20s,
// no redeploy — the canonical feature-flag demo.
const REFRESH_MS = 20_000;

export function useFeatureFlags() {
  return useQuery<FeatureFlags>({
    queryKey: queryKeys.features.all,
    queryFn: async () => {
      const response = await apiClient.get('/api/v1/features', {
        schema: featureFlagsSchema,
      });
      return response.data;
    },
    staleTime: REFRESH_MS,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Whether a feature flag is enabled. Fails **open** (returns `true`) while flags
 * load or if the request fails, mirroring the backend's fail-open gate — the
 * backend stays the real enforcement, so an unreachable flag service never
 * leaves a feature stuck "off" in the UI while the API still allows it.
 */
export function useFeatureFlag(name: string): boolean {
  const { data } = useFeatureFlags();
  return data?.flags[name] ?? true;
}
