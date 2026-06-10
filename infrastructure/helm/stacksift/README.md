# StackSift Helm chart (namespace `project-07`, closed-beta)

Single-namespace deploy of all StackSift surfaces + dependencies. Built from the
research in `zhelpers/DEPLOY/`. Targets `life-cluster` / namespace `project-07`
(namespace-scoped admin only — no cluster-wide operators are installed by this
chart; it consumes the cluster's pre-installed **ECK** and **cert-manager**).

## What it deploys
- **Apps:** api, frontend (dashboard), marketing, + EF-migration hook Job
  (optional `cronworker` when api scales >1).
- **Stateful deps:** Postgres (custom pgvector image, shared DB with Keycloak),
  Redis, RabbitMQ, MinIO (+ bucket-init hook), Keycloak (realm-import), and
  Elasticsearch via the **ECK** `Elasticsearch` CR.
- **Ingress + TLS:** ingress-nginx + cert-manager namespaced ACME `Issuer`
  (HTTP-01), one host per surface under `dmdailydeals.com`.

## Prerequisites (do these BEFORE `helm install`)

1. **DNS** — A-records for `app. api. auth. @ www. files.dmdailydeals.com` → the
   four worker IPs (`159.69.8.132, 159.69.2.83, 159.69.16.208, 159.69.5.128`).
   Add `grafana.` and `n8n.` too if the observability flags are on (Grafana +
   n8n editor Ingresses).
2. **kubectl/helm context** → `project-07`:
   ```bash
   export KUBECONFIG=~/Downloads/project-07.kubeconfig
   kubectl config current-context   # → project-07
   ```
3. **App secret** (NOT templated — keep values out of git):
   ```bash
   kubectl -n project-07 create secret generic stacksift-secrets \
     --from-env-file=$HOME/.config/stacksift-deploy/secrets.env
   ```
4. **Keycloak realm secret** — substitute the backend-admin client secret, then load:
   ```bash
   SECRET=$(grep '^KC_BACKEND_ADMIN_CLIENT_SECRET=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   sed "s/REPLACE_AT_RUNTIME/${SECRET}/" infrastructure/keycloak/stacksift-realm.json > /tmp/stacksift-realm.json
   # Point the public client redirect/web-origin at the real domain (verify/adjust):
   #   sed -i 's#http://localhost:3000#https://app.dmdailydeals.com#g' /tmp/stacksift-realm.json
   kubectl -n project-07 create secret generic stacksift-realm \
     --from-file=stacksift-realm.json=/tmp/stacksift-realm.json
   rm -f /tmp/stacksift-realm.json
   ```
   ⚠️ The realm JSON's `stacksift-frontend` client **Valid Redirect URIs** and
   **Web Origins**, and `stacksift-api` settings, must include the
   `https://*.dmdailydeals.com` hosts or login/CORS will fail. Verify before loading.

   **Keycloak SMTP (Resend).** The imported realm JSON ships with dev SMTP (Mailpit),
   which sends no real mail. To enable verification + password-reset email in the beta,
   reconcile the realm with the Terraform module (`infrastructure/terraform/keycloak/`)
   against the live `auth.dmdailydeals.com` after first boot — it sets Resend SMTP
   (`smtp.resend.com:587`, STARTTLS, user `resend`, from `noreply@dmdailydeals.com`) from
   `smtp_*` vars sourced from `secrets.env` (`RESEND_API_KEY`). The Resend secret is never
   committed; dev stays on Mailpit.
5. *(Only if `elasticsearch.lifecycle.enabled=true`)* ES S3 creds for snapshots —
   loaded into the ES keystore by an initContainer:
   ```bash
   MK=$(grep '^MINIO_ROOT_USER=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   MS=$(grep '^MINIO_ROOT_PASSWORD=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   kubectl -n project-07 create secret generic stacksift-es-s3-creds \
     --from-literal=s3.client.default.access_key="$MK" \
     --from-literal=s3.client.default.secret_key="$MS"
   ```
6. *(Only if `postgres.backups.enabled=true`)* pgBackRest → MinIO creds. Reuses the
   MinIO root creds for repo access plus a strong repo-encryption passphrase:
   ```bash
   MK=$(grep '^MINIO_ROOT_USER=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   MS=$(grep '^MINIO_ROOT_PASSWORD=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   CP=$(grep '^PGBACKREST_REPO1_CIPHER_PASS=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   kubectl -n project-07 create secret generic stacksift-pgbackrest \
     --from-literal=access-key="$MK" \
     --from-literal=secret-key="$MS" \
     --from-literal=cipher-pass="$CP"
   ```
   The `stacksift-pgbackrest-stanza-create` Helm hook then creates the `stacksift`
   stanza on first deploy; the full/diff CronJobs back up to `stacksift-pg-backup`.
   stanza-create + first WAL archive are verified at deploy-time (runbook 01).
7. *(Only if `n8n.enabled=true`)* n8n basic-auth + the workflow's OpenAI/Slack
   secrets (the alert-triage workflow reads these via `{{$env...}}`):
   ```bash
   # NOTE: the OpenAI key is stored .NET-config style (OpenAI__ApiKey) in secrets.env,
   # but the n8n container reads it as OPENAI_API_KEY — so source one, store as the other.
   OK=$(grep '^OpenAI__ApiKey=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   SW=$(grep '^SLACK_WEBHOOK_URL=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   NP=$(grep '^N8N_PASSWORD=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   kubectl -n project-07 create secret generic stacksift-n8n \
     --from-literal=N8N_BASIC_AUTH_USER="admin" \
     --from-literal=N8N_BASIC_AUTH_PASSWORD="$NP" \
     --from-literal=OPENAI_API_KEY="$OK" \
     --from-literal=SLACK_WEBHOOK_URL="$SW"
   ```
   The Slack Incoming Webhook for `#stacksift-alerts` is set up per `docs/n8n-automation.md`.
8. *(Only if `grafana.enabled=true`)* Grafana admin credentials:
   ```bash
   GP=$(grep '^GRAFANA_ADMIN_PASSWORD=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   kubectl -n project-07 create secret generic stacksift-grafana-admin \
     --from-literal=admin-user="admin" \
     --from-literal=admin-password="$GP"
   ```
9. *(Only if `alertmanager.receiver.slack.enabled=true`)* the Slack receiver URL
   (the default routes via n8n and does **not** need this):
   ```bash
   SW=$(grep '^SLACK_WEBHOOK_URL=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   kubectl -n project-07 create secret generic stacksift-alertmanager \
     --from-literal=slack-api-url="$SW"
   ```
10. *(Only if `unleash.enabled=true`)* Unleash DB password + pre-seeded SDK tokens
    (FS-6 feature flags). Token format is `<project>:<env>.<secret>` for the client
    (`default:development.<hex>`) and `*:*.<hex>` for admin:
    ```bash
    UDB=$(grep '^UNLEASH_DB_PASSWORD='    ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
    UCT=$(grep '^UNLEASH_CLIENT_TOKEN='   ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
    UAT=$(grep '^UNLEASH_ADMIN_TOKEN='    ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
    kubectl -n project-07 create secret generic stacksift-unleash \
      --from-literal=DATABASE_PASSWORD="$UDB" \
      --from-literal=INIT_CLIENT_API_TOKENS="$UCT" \
      --from-literal=INIT_ADMIN_API_TOKENS="$UAT"
    ```
    **Also** add `Unleash__ClientToken=<same value as UNLEASH_CLIENT_TOKEN>` to
    `secrets.env` so it lands in `stacksift-secrets` — that's the token the API
    authenticates to Unleash with (it must equal `INIT_CLIENT_API_TOKENS`). The
    browser never gets a token (flags come via the BFF `GET /api/v1/features`).
    After first login at `https://unleash.<domain>` (default `admin` / `unleash4all`)
    **change the admin password** — the UI is publicly reachable. See `docs/feature-flags.md`.

## Install / upgrade
```bash
helm upgrade --install stacksift infrastructure/helm/stacksift \
  -n project-07 -f infrastructure/helm/stacksift/values-beta.yaml
```
First run uses the **Let's Encrypt staging** issuer (`certIssuer.useStaging=true`)
— browsers will warn. Once the cert flow + smoke test pass, set `useStaging=false`
and re-run for trusted certs.

## Images
api/migrator/postgres use published GHCR tags as-is (runtime-configurable).
**frontend + marketing MUST be rebuilt** for `dmdailydeals.com` (Next bakes
`NEXT_PUBLIC_*` at build time; CI baked `*.stacksift.com`). See
`zhelpers/DEPLOY/06-images-and-registry`. Build args:
`NEXT_PUBLIC_API_URL=https://api.dmdailydeals.com`,
`NEXT_PUBLIC_KEYCLOAK_URL=https://auth.dmdailydeals.com`,
`NEXT_PUBLIC_APP_URL=https://app.dmdailydeals.com`,
`NEXT_PUBLIC_SIGNALR_HUB_URL=https://api.dmdailydeals.com/hubs/stacksift`,
`NEXT_PUBLIC_AUTH_MOCK=false`, `NEXT_PUBLIC_SIGNALR_MOCK=false`,
`NEXT_PUBLIC_REGISTRATION_INVITE_ONLY=true` (closed beta — hides the create-org path);
marketing: `NEXT_PUBLIC_APP_BASE_URL=https://app.dmdailydeals.com`. Push as tag `dmdailydeals`.

## Key design decisions (see zhelpers/DEPLOY for rationale)
- **Single api replica, role `api`** runs web + Hangfire cron (matches compose).
  Scaling >1 requires `api.role=web` + `cronworker.enabled=true`.
- **RLS role cutover active** (`Database__RlsRoleSwitching=true`): the app connects as
  `stacksift_app` (NOBYPASSRLS) so Postgres row-level security is enforced per request;
  the migrator runs as `stacksift_owner` via `ConnectionStrings__MigrationsConnection`;
  trusted background jobs/consumers `SET ROLE` to the owner for cross-org work. Keycloak
  still shares the `stacksift` DB on the bootstrap superuser (dedicated DB is Gate 3).
- **Elasticsearch security/http-TLS OFF** to match the app's plain-http ES client.
- **Full in-cluster observability** (gated): Prometheus + all 14 alerts,
  Alertmanager → in-cluster n8n → OpenAI → Slack, Loki (+ Serilog wiring), and
  Grafana with the 6 dashboards. **Tempo/OTLP traces** remain bucket B (the
  Grafana Tempo datasource is intentionally omitted).

## Optional hardening (WS4 — all namespaced, gated by values flags)
`values-beta.yaml` turns on the in-cluster hardening that's safe from the start;
`networkPolicy` ships **after** the app is verified up.

| Flag | Default | Beta | What it renders |
|---|---|---|---|
| `prometheus.enabled` | false | **true** | namespaced Prometheus CR + RBAC, api + rabbitmq ServiceMonitors, `PrometheusRule` with **all 14 alerts**. Needs the Prometheus-Operator CRDs. |
| `n8n.enabled` | false | **true** | n8n Deployment + PVC + Service + editor Ingress (`n8n.<domain>`); imports + activates the `alert-triage` workflow on first boot. The AIOps alert receiver. Needs `stacksift-n8n` (prereq 7). |
| `alertmanager.enabled` | false | **true** | namespaced Alertmanager CR + AlertmanagerConfig routing `severity=critical` → the in-cluster n8n webhook (→ OpenAI → Slack); points the Prometheus CR at it. Optional Slack-direct fallback needs `stacksift-alertmanager` (prereq 9). |
| `loki.enabled` | false | **true** | Loki single-binary (filesystem, 336h) + Service `loki:3100`; sets `Serilog__Loki__Url` so prod app logs ship to Loki (closes the console-only gap). |
| `grafana.enabled` | false | **true** | Grafana + provisioned Prometheus/Loki datasources + the 6 dashboards; Ingress `grafana.<domain>`. Needs `stacksift-grafana-admin` (prereq 8). |
| `postgres.backups.enabled` | false | **true** | keeps `archive_mode=on`, renders the pgBackRest `stanza-create` hook Job + full/diff CronJobs → MinIO `stacksift-pg-backup`. Needs the `stacksift-pgbackrest` Secret (prereq 6). |
| `elasticsearch.lifecycle.enabled` | false | **true** | ES keystore initContainer + plain-http MinIO S3 client; app registers ILM + the `stacksift-es-backup` repo at startup. Needs `stacksift-es-s3-creds` (prereq 5). |
| `unleash.enabled` | false | **true** | Unleash + its own Postgres (Deployment + PVC + Service) + admin-UI Ingress (`unleash.<domain>`); the API reads flags in-namespace (`Unleash__Url` in configmap + `Unleash__ClientToken` in the app secret). Needs `stacksift-unleash` (prereq 10). FS-6 feature flags; see `docs/feature-flags.md`. |
| `uptimeKuma.enabled` | false | **true** | Uptime Kuma (Deployment + PVC + Service) + status-page/admin Ingress (`status.<domain>`). **No prereq Secret** — monitors/channels/status page are applied post-deploy by `scripts/bootstrap-uptime-kuma.py` (Slack + Resend email, from `secrets.env`). Runs as **root** (the image chowns `/app/data`). DO-7 / M4.6; see `docs/uptime-kuma-bootstrap.md`. Caveat: an in-cluster monitor can't alert when the cluster itself is down. |
| `networkPolicy.enabled` | false | false | default-deny ingress + intra-ns allow + ingress-nginx→web. **Apply post-stand-up:** `helm upgrade … --set networkPolicy.enabled=true`. |

Deploy-time validation (DEPLOY/10 + runbook 01): stanza-create + first WAL archive,
ES repo register, Prometheus actually scraping, and the NetworkPolicy
ingress-nginx `namespaceSelector` + cluster egress.

## Uninstall
`helm uninstall stacksift -n project-07` removes workloads. **PVCs persist**
(delete manually if you want to wipe data). Pre-created Secrets are not managed by
Helm — delete them separately.
