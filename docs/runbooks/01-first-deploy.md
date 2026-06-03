# Runbook 01 — First deploy (project-07 / dmdailydeals.com)

> Empty namespace → working closed-beta on `*.dmdailydeals.com`, plus how to prove it and roll back.
> Promoted from `zhelpers/DEPLOY/10-cutover-and-smoketest/research.md`; updated for the shipped chart
> (self-hosted plain ES, Keycloak on the shared `stacksift` DB, RLS role-cutover live, gated WS4
> hardening). **Namespace-only admin** — no cluster-scoped objects.

## 0. Pre-flight (must be true before `helm install`)

- [ ] **DNS** A-records for `app. api. auth. @ www. files.dmdailydeals.com` → the 4 worker IPs
      (`159.69.8.132, 159.69.2.83, 159.69.16.208, 159.69.5.128`). **Hard blocker** — HTTP-01 cert
      issuance needs the hosts resolvable.
- [ ] **Images in GHCR**, pullable. **frontend + marketing rebuilt** with the `dmdailydeals.com`
      `NEXT_PUBLIC_*` build args and pushed as `:dmdailydeals` (see runbook chores / `DEPLOY/06`) —
      **login is silently broken otherwise.**
- [ ] **Secrets created** (not templated):
      - `stacksift-secrets` (`kubectl create secret generic … --from-env-file=~/.config/stacksift-deploy/secrets.env`)
      - `stacksift-realm` (realm JSON with the `stacksift-backend-admin` secret substituted +
        `localhost:3000`→`app.dmdailydeals.com` redirect/web-origin swap)
      - *(only if the matching flag is on)* `stacksift-es-s3-creds` (ES ILM), `stacksift-pgbackrest`
        (pg backups). See the chart README §Prerequisites.
- [ ] **kubectl/helm context** = `project-07`: `export KUBECONFIG=~/Downloads/project-07.kubeconfig && kubectl config use-context project-07`.

## 1. Apply order

A single `helm upgrade --install` encodes most of this; the **realm-secret reconcile** and **DNS** are
the manual seams.

```bash
helm upgrade --install stacksift infrastructure/helm/stacksift \
  -n project-07 -f infrastructure/helm/stacksift/values-beta.yaml
```

Helm ordering inside that run:
1. Secrets/ConfigMap (pre-created) + cert-manager `Issuer` (chart) + the data stores
   (Postgres/Redis/RabbitMQ/MinIO StatefulSets+Deployments, self-hosted ES StatefulSet).
2. **Hooks (post-install/upgrade, by weight):** `minio-init` (-10, buckets) → `stacksift-migrate` (-5,
   EF migrations + RLS as `stacksift_owner`) → `stacksift-pgbackrest-stanza-create` (0, only if
   `postgres.backups.enabled`).
3. Keycloak (`start --import-realm`, shares the `stacksift` DB on the bootstrap superuser).
4. App tier: `api` (role `api` = web + Hangfire cron at 1 replica), `frontend`, `marketing`.
5. Per-host Ingresses → cert-manager issues certs.
6. Observability (if `prometheus.enabled`): namespaced Prometheus CR + ServiceMonitors + PrometheusRule.

**First issuance:** set `certIssuer.useStaging=true` to dodge Let's Encrypt rate limits, confirm the
flow, then `useStaging=false` and re-run for trusted certs.

**Realm-secret reconcile (manual seam):** if the `stacksift-backend-admin` client secret isn't pinned,
capture the generated value from Keycloak after first import and update `stacksift-secrets` →
`Keycloak__Admin__AdminClientSecret`, then restart the api.

## 2. WS1 — RLS role-cutover verification (deploy-time)

The app runs as `stacksift_app` (NOBYPASSRLS); the migrator as `stacksift_owner` (BYPASSRLS). Verify
RLS is live at the DB (mirrors `RowLevelSecurityTests`):

```bash
# as stacksift_app, GUC unset → fail-closed, 0 rows
kubectl -n project-07 exec postgres-0 -c postgres -- psql -U stacksift_app -d stacksift \
  -c 'SELECT COUNT(*) FROM "Incidents";'              # → 0

# as stacksift_app, scoped to an org → only that org's rows
#   SELECT set_config('app.current_org_id','<orgA-uuid>',false); SELECT COUNT(*) FROM "Incidents";
# as stacksift_owner (migrator) → sees all rows (BYPASSRLS)
```
A real API call as an org-A user must not return org-B rows (cross-org → 404).

## 3. WS4 — backups (only if enabled)

⚠️ **pgBackRest is currently disabled** (`postgres.backups.enabled=false`). It needs **MinIO TLS** (the
S3 driver is HTTPS-only) **and** a data-dir topology fix before it can run — see
`zhelpers/DEPLOY/to-fix/minio-tls-plan.md`. When both are done: create `stacksift-pgbackrest`, set the
flag, re-deploy; the `stanza-create` hook must go green (`pgbackrest … stanza-create && check`), then
`pgbackrest info` shows a backup and `pg_stat_archiver.failed_count` stays flat.

## 4. Smoke test — Gate-2 acceptance E2E (run against the public hosts)

1. `curl https://api.dmdailydeals.com/api/v1/health` → 200; certs valid (not LE staging) on all hosts.
2. `https://dmdailydeals.com` loads; pricing CTA → dashboard.
3. **Register** on `app.dmdailydeals.com` → receive the Keycloak verification email (SMTP/Resend).
4. **Verify + login** via the email link (`auth.dmdailydeals.com`) → no 401 reload loop (dual-issuer).
5. **Onboard** → create org → lands on dashboard (BFF server-side hop + token refresh).
6. **Project + log source** → reveal the API key once.
7. **Ingest** `scripts/stacksift-test-ingest.sh` → 202; log appears **live** (RabbitMQ→ES→SignalR).
8. **Incident + AI** → trigger analysis → completes (Hangfire + OpenAI egress + pgvector).
9. **Billing (test mode)** → Stripe **test** checkout renders (no live charge).
10. **Multi-tenant** → a second org cannot see the first's resources (404).

## 5. Rollback

- **App regression:** `helm rollback stacksift <rev> -n project-07` — Deployments/Jobs revert; **PVC
  data persists**. Prefer this over `helm uninstall` (which risks PVC reclaim).
- **Bad migration:** migrations follow expand/contract (`docs/migrations-policy.md`); an app rollback is
  safe against the prior schema. A destructive migration needs its documented reverse.
- **Cert/DNS:** flip the Issuer to LE **staging** to iterate without rate limits, then back to prod.
- **A hook fails the upgrade** (e.g. a missing prereq Secret): the release goes `failed` but the
  already-applied resources stay. Fix the prereq and re-run; `before-hook-creation` recreates the hook.

## 6. Post-cutover
- Point an external uptime check at the health URLs.
- Record the deployed image digests + Helm revision (`helm history stacksift -n project-07`).
- File Gate-3 deferrals (verified restore drill, off-site backup, full MinIO TLS, Stripe live) in the
  backlog.

## 7. Hard blockers recap
1. DNS A-records live (cert issuance).
2. frontend/marketing images rebuilt for `dmdailydeals.com`.
3. Real secret values: OpenAI, Stripe-test, SMTP/Resend.
