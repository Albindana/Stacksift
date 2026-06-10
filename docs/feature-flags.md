# Feature Flags (Unleash)

Satisfies **FS-6** ("LaunchDarkly or Unleash basics integrated") / **M5.6**
(feature flags integrated for at least one toggle). We self-host **Unleash**
(open-source, free) in Docker Compose and gate one real feature: the
**AI-analysis kill-switch** (`ai-analysis`).

## Flag inventory

| Flag | Type | Default | Gates | Off behaviour |
|---|---|---|---|---|
| `ai-analysis` | release / kill-switch | **on** (fail-open) | "Analyze with AI" — `POST /api/v1/incidents/{id}/analyze` | API returns **403 Feature Disabled**; the UI hides the button and shows "AI analysis is currently disabled." |

## Architecture — two gates, one source of truth

```
                         ┌─────────── Unleash server (:4242) ───────────┐
                         │  admin UI flips ai-analysis on/off            │
                         └───────▲───────────────────────▲──────────────┘
              server SDK (poll)  │                       │ server SDK (poll)
                                 │                       │
        ┌────────────────────────┴───────┐               │
        │  .NET API                       │               │
        │  IFeatureFlagService (Unleash)  │               │
        │   ├─ TriggerAiAnalysisHandler ──┤ 403 when off  │  (authoritative)
        │   └─ GET /api/v1/features ──────┤◄──────────────┘
        └───────────────▲─────────────────┘
                        │ bearer (same-origin BFF), polled ~20s
                 ┌──────┴───────┐
                 │  React SPA    │  useFeatureFlag('ai-analysis') → hide button
                 └───────────────┘
```

- **Backend gate (authoritative).** `TriggerAiAnalysisCommandHandler` checks
  `IFeatureFlagService.IsEnabled("ai-analysis")` and throws
  `FeatureDisabledException` → **403** when off. This is the real enforcement —
  a direct API call is blocked even if the UI is bypassed. It satisfies FS-6 on
  its own.
- **Frontend gate (UX only).** The SPA does **not** talk to Unleash directly.
  It reads evaluated flags from the BFF (`GET /api/v1/features`) via the existing
  `apiClient` (bearer, same-origin), with a ~20s refetch, and hides the
  "Analyze with AI" button when the flag is off. **No public Unleash, no baked
  browser token, no CORS** — chosen over Unleash's Frontend API because a
  `NEXT_PUBLIC_*` token bakes into the image (cf. GA4) and project-07 would
  otherwise need Unleash exposed publicly.

### Clean Architecture note

The Application layer must not import the Unleash SDK. So the seam is
`IFeatureFlagService` (Application/Interfaces), implemented by
`UnleashFeatureFlagService` (Infrastructure) wrapping the `IUnleash` singleton —
mirroring `IAiAnalysisJobRunner`. Handlers and unit tests depend only on the
interface (the kill-switch test mocks it).

### Fail-open

Both gates default to **on** when Unleash is unreachable or the flag is unknown
(`IsEnabled(..., defaultValue: true)`), so an Unleash outage never hard-disables
AI. The flag must be **explicitly off** to block.

## Running it

Compose pre-seeds dev SDK tokens (`INIT_*_API_TOKENS`) so a fresh boot works
with no manual clicks:

```bash
cd infrastructure/docker && docker compose up -d --wait unleash-db unleash
# Admin UI: http://localhost:4242  (admin / unleash4all)
```

Create the flag once: **Admin UI → default project → New flag → `ai-analysis`**,
type *release*, enabled in the `development` environment. The API reads it via
`Unleash__Url` (`http://unleash:4242/api/`) + `Unleash__ClientToken`.

## Demo

1. Flag **on** → "Analyze with AI" works.
2. Flip it **off** in the Unleash UI → within ~20s the button vanishes and a
   direct `POST …/analyze` returns **403**.
3. Flip **on** → the feature returns. No redeploy.

## Adding a new flag

1. Create it in the Unleash UI.
2. Add its name to `FeatureFlagNames` (`StackSift.Application/Features`) so it's
   surfaced by `GET /api/v1/features`.
3. Backend: inject `IFeatureFlagService`, guard the path (throw
   `FeatureDisabledException` to 403, or branch as needed).
4. Frontend: `useFeatureFlag('your-flag')` to gate UI.
5. Document it in the inventory table above.

## Config / env

| Var | Where | Notes |
|---|---|---|
| `Unleash__Url` / `Unleash__ClientToken` | API (compose) | server SDK; absent → fail-open |
| `UNLEASH_DB_PASSWORD`, `UNLEASH_CLIENT_TOKEN`, `UNLEASH_ADMIN_TOKEN` | compose / `.env` | dev seed tokens (never prod) |

No `NEXT_PUBLIC_UNLEASH_*` — the browser never holds an Unleash token (BFF delivery).

## Deploying to project-07 (Helm)

The chart ships Unleash + its own Postgres, gated on `unleash.enabled` (on in
`values-beta.yaml`): `templates/unleash.yaml` renders the `unleash` Deployment +
Service + admin-UI Ingress (`unleash.<domain>`) and an `unleash-db`
Deployment + PVC + Service. The API reads flags **in-namespace** —
`Unleash__Url: http://unleash:4242/api/` is set in `stacksift-config` when
`unleash.enabled`, and `Unleash__ClientToken` rides the app secret.

**Prereq secret** `stacksift-unleash` (create before enabling — chart README
prereq 10): `DATABASE_PASSWORD`, `INIT_CLIENT_API_TOKENS`, `INIT_ADMIN_API_TOKENS`.
The app secret (`stacksift-secrets`, from `secrets.env`) must also carry
`Unleash__ClientToken` **equal to** `INIT_CLIENT_API_TOKENS` — that's what the API
authenticates with. Token format: client `default:development.<hex>`, admin `*:*.<hex>`.

**Security:** the admin UI is public via Ingress and ships the well-known default
login `admin` / `unleash4all` — **change it on first login**. Set
`unleash.ingress.enabled=false` to keep Unleash in-cluster only (the API still
reads flags; you'd flip them via `kubectl port-forward` or the admin API).
Because flag delivery is BFF, nothing about Unleash is exposed to the browser.

If `unleash.enabled=false` (or the secret/URL are absent), the API **fails open** —
AI stays on — so the app keeps working without flag control until Unleash is up.

## Config / env

| Var | Where | Notes |
|---|---|---|
| `Unleash__Url` / `Unleash__ClientToken` | API (compose env; Helm configmap + app secret) | server SDK; absent → fail-open |
| `UNLEASH_DB_PASSWORD`, `UNLEASH_CLIENT_TOKEN`, `UNLEASH_ADMIN_TOKEN` | compose `.env` (dev) / `secrets.env` → `stacksift-unleash` (prod) | dev compose values are insecure placeholders |

No `NEXT_PUBLIC_UNLEASH_*` — the browser never holds an Unleash token (BFF delivery).
