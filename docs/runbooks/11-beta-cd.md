# Runbook 11 — Beta Continuous Delivery (project-07)

Design + decision record: `zhelpers/CD/plan.md`.

## Flow

Every merge to `develop` runs `docker-build.yml`:

1. **changes** — detects whether `src/frontend/**` / `src/marketing/**` moved.
2. **build** — the existing 5-image generic matrix (`sha-<sha>` tags).
3. **build-beta** — only for changed surfaces: dmdailydeals.com-baked frontend/marketing, tagged **`sha-<sha>-beta`** (+ `develop-beta` tracker). Backend-only merges skip this entirely.
4. **deploy-beta** — pauses on the `beta` GitHub environment until a reviewer approves, then:
   - `helm upgrade -f values-beta.yaml --set images.api.tag=sha-<sha> --set images.migrator.tag=sha-<sha> [--set images.frontend.tag=sha-<sha>-beta] [--set images.marketing.tag=sha-<sha>-beta]`
   - migrations run via the chart's post-upgrade hook (a failed hook fails the deploy — intended)
   - smoke: rollout status api+frontend, `https://api.dmdailydeals.com/health/ready`, `https://app.dmdailydeals.com/api/healthz`
   - run summary lists the deployed pins + helm revision

**Approve** in the Actions UI (the run sits in "waiting" until then; a newer develop merge cancels a superseded waiting run — latest wins). Not approving = no deploy; the images still exist.

## Where "what's live" is recorded

The **Helm release** is authoritative:

```bash
helm get values stacksift -n project-07     # live pins (--set overrides)
helm history stacksift -n project-07
```

`values-beta.yaml` holds the **manual-deploy baseline** and may lag the release — branch protection on develop (PRs required, admins enforced) rules out bot commit-back, and a pin-PR would burn CI minutes. Refresh the file's pins via a normal PR when convenient (e.g., at `develop → main` promotions).

## What is still manual (on purpose)

- **postgres pin** — tag change restarts the StatefulSet; edit `values-beta.yaml` + manual `helm upgrade`.
- `develop → main` promotion, Keycloak realm changes, NetworkPolicy, secret rotation.
- **Ad-hoc bakes** — `workflow_dispatch` on docker-build still works (custom domain/tag inputs).

## Rollback

Two equivalent options:

```bash
# 1. Helm-native (fastest)
helm history stacksift -n project-07
helm rollback stacksift <rev> -n project-07
```

2. Actions-native: open the last green **deploy-beta** run → "Re-run job" — it redeploys that commit's pins (images are immutable, no rebuild).

## Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| deploy fails at `Helm upgrade` with hook error | migration failed (see Runbook 04 + the 2026-06-06 42501/ownership incidents) | `kubectl logs -n project-07 -l job-name=stacksift-migrate`; fix; re-run job |
| `Write kubeconfig` ok but kubectl auth errors | cluster cert/token rotated | re-create `BETA_KUBECONFIG_B64` env secret from a fresh namespace kubeconfig |
| build-beta fails on Trivy | new CVE in a base image | triage per `.trivyignore` conventions (cite reason + re-evaluation trigger) |
| run stuck "waiting" for weeks | nobody approved | dismiss it; approvals expire after 30 days |

## Setup (one-time, GitHub repo settings)

1. **Environments → New environment: `beta`** — required reviewers: `drdtrn`; deployment branches: `develop` only.
2. **Secret `BETA_KUBECONFIG_B64`** on the environment: `base64 -w0 <namespace-scoped kubeconfig>` (and keep the laptop copy out of world-readable `~/Downloads`).
