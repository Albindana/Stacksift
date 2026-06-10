# Product Metrics — North Star & AARRR Funnel

> Satisfies **PM-6** ("North Star Metric defined, AARRR funnel mapped, GA4
> tracking implemented") and feeds **M6.1** (analytics with custom events +
> conversion funnel), **M6.2** (NSM), and **M6.4** (A/B test design).

Analytics is **GA4**, instrumented in the product/dashboard app (`src/frontend`)
via `@next/third-parties/google`. Events fire through a thin wrapper
(`src/app/lib/analytics.ts` → `trackEvent`) that **no-ops** unless a measurement
ID is baked into the build (`NEXT_PUBLIC_GA_MEASUREMENT_ID`). The marketing site
uses Plausible separately and is out of scope here.

---

## North Star Metric

**Weekly Active Organisations that triage ≥1 incident with AI.**

i.e. the count of distinct organisations that, in a rolling 7-day window,
triggered at least one AI analysis on an incident (`ai_analysis_triggered`).

**Why this one.** StackSift's core value loop is **ingest → alert → AI triage**.
An org that runs AI triage has reached the moment the product actually does its
job (turning noisy logs into a root-cause story), so this is a *leading*
indicator of retained value — not a vanity count:

- It is **organisation-weekly**, not per-user or all-time, so it tracks *active,
  recurring* value rather than one-time signups or seat inflation.
- It sits at the **end of activation**, so it only moves when the upstream funnel
  (signup → project → log source → first logs → alert → incident) is actually
  working — a single number that proxies the health of the whole loop.
- It is **causally tied to retention and revenue**: orgs that repeatedly get AI
  triage value are the ones that renew and upgrade.

Counted server-side from the AI-analysis + organisation data; `ai_analysis_triggered`
is the GA4 mirror used for funnel/segment analysis in GA.

---

## AARRR funnel → GA4 events

Each stage maps to a concrete event fired by `trackEvent(...)`. Params carry
ids/flags only — **never PII** (no emails, names, or log contents).

| AARRR stage | GA4 event | Fires when / where | Params |
|---|---|---|---|
| **Acquisition** | `sign_up` | account created — `(auth)/register` success (both verify-email and auto-login branches) | `attached_via_invitation` |
| **Activation** | `project_created` | `use-create-project` onSuccess | `project_id` |
| **Activation** | `log_source_created` | `use-log-sources` (`useCreateLogSource`) onSuccess | `project_id`, `type` |
| **Activation** | `first_log_ingested` | dashboard observes `totalLogsToday` go 0 → >0 live (NSM input) | `total_logs_today` |
| **Activation / core** | `ai_analysis_triggered` | `use-trigger-ai-analysis` onSuccess (the NSM event) | `incident_id` |
| **Retention** | `incident_resolved` | `use-update-incident-status` onSuccess, status → `resolved` | `incident_id` |
| **Referral** | `incident_link_shared` | "Copy link" on the incident header | `incident_id` |
| **Revenue** | `checkout_started` | `use-upgrade-plan` onSuccess — Stripe session created (both the `/billing/checkout` funnel and the settings billing panel route through this hook) | `plan` |
| **Revenue** | `plan_upgraded` | `/billing/success` once the backend confirms the synced subscription (a real completion, not just initiation) | `plan` |

GA4's automatic `page_view` covers navigation, so no manual route events are needed.

### Notes on two events

- **`first_log_ingested`** is a client-side approximation: it fires on a live
  `0 → >0` transition of `totalLogsToday` while the dashboard is open, *not* on a
  cold load that already shows logs (that isn't a "first" we can attribute). The
  authoritative activation signal is computed server-side from ingestion data;
  this event is for in-GA funnel shape only.
- **`checkout_started` vs `plan_upgraded`** — the SPA can't observe Stripe payment
  completion directly, so `checkout_started` marks *initiation* (session created,
  about to redirect to Stripe) and `plan_upgraded` marks *completion* (the user
  returned to `/billing/success` and the backend sync confirmed the new plan).

---

## How it's wired

- **Loader:** `<GoogleAnalytics gaId={…} />` in `src/app/layout.tsx`, rendered
  only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set.
- **Events:** `trackEvent(AnalyticsEvent.X, params)` from `src/app/lib/analytics.ts`.
  Event names are centralised in the `AnalyticsEvent` constant.
- **Env:** `NEXT_PUBLIC_GA_MEASUREMENT_ID` is a frontend **build arg** (baked),
  wired in `src/frontend/Dockerfile`, `docker-compose.yml`, and the
  `docker-build.yml` matrix (sourced from the `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  repo variable). Absent → analytics is a silent no-op. GA4 has no server secret;
  the measurement ID is public by design.
- **Privacy:** GA4 sets analytics cookies — recorded in `docs/pii-inventory.md`.

## Verifying (manual — needs a real GA4 property)

1. Create a GA4 property + Web data stream → copy the `G-XXXXXXXXXX` ID.
2. `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX pnpm build && pnpm start` in
   `src/frontend`.
3. Open GA4 **Realtime** / **DebugView**, walk the funnel (register → create
   project → trigger AI analysis → resolve incident → copy link), and confirm the
   events + params arrive. Ad-blockers swallow GA — use a clean profile or
   DebugView.
