import { sendGAEvent } from '@next/third-parties/google';

/**
 * Product analytics (GA4) — thin wrapper around `@next/third-parties`.
 *
 * The `<GoogleAnalytics>` component in the root layout only loads gtag.js when
 * `NEXT_PUBLIC_GA_MEASUREMENT_ID` is baked into the build. This wrapper mirrors
 * that gate so that:
 *   - components never touch `gtag`/`sendGAEvent` directly, and
 *   - every `trackEvent` call is a **no-op** when GA is disabled (no measurement
 *     ID) or off the client (SSR / Node) — which keeps Jest and the local dev
 *     build clean without any GA wiring.
 *
 * `NEXT_PUBLIC_*` vars are inlined at build time, so an absent ID compiles to
 * `undefined` here and `isEnabled()` is permanently false in that build.
 *
 * The AARRR funnel → event mapping lives in `docs/product-metrics.md`.
 */

/** Canonical GA4 event names. Keep in sync with docs/product-metrics.md. */
export const AnalyticsEvent = {
  /** Acquisition */
  SignUp: 'sign_up',
  /** Activation */
  ProjectCreated: 'project_created',
  LogSourceCreated: 'log_source_created',
  FirstLogIngested: 'first_log_ingested',
  /** Activation / core value */
  AiAnalysisTriggered: 'ai_analysis_triggered',
  /** Retention */
  IncidentResolved: 'incident_resolved',
  /** Referral */
  IncidentLinkShared: 'incident_link_shared',
  /** Revenue */
  CheckoutStarted: 'checkout_started',
  PlanUpgraded: 'plan_upgraded',
  /** A/B testing — tracks which variant a user saw, for experiment analysis */
  AbVariantViewed: 'ab_variant_viewed',
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** Only primitive params — GA4 rejects nested objects, and PII must never be sent. */
export type AnalyticsParams = Record<string, string | number | boolean>;

/** True only when a measurement ID was baked into this build. */
export function isAnalyticsEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
}

/**
 * Fire a custom GA4 event. No-ops when GA is disabled or not on the client.
 * Do not pass PII (emails, names, log contents) — ids are fine.
 */
export function trackEvent(
  name: AnalyticsEventName,
  params: AnalyticsParams = {},
): void {
  if (!isAnalyticsEnabled() || typeof window === 'undefined') return;
  sendGAEvent('event', name, params);
}
