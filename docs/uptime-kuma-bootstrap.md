# Uptime Kuma — Bootstrap (DO-7 / M4.6)

Status page + **multi-channel notifications** (≥2) for the StackSift surfaces.
Uptime Kuma 1.x has no first-class IaC — config lives in its SQLite volume
(`uptime_kuma_data`), created via the UI. `scripts/bootstrap-uptime-kuma.py`
codifies that config (notifications + monitors + status page) so it's
reproducible after a `docker compose down -v`. Idempotent.

## Quick setup (script — recommended)

```bash
cd infrastructure/docker && docker compose up -d uptime-kuma mailpit
cd ../..
python3 -m venv .venv && .venv/bin/pip install uptime-kuma-api
UPTIME_KUMA_PASSWORD='<choose-admin-pw>' \
  SLACK_WEBHOOK_URL='https://hooks.slack.com/services/...' \
  .venv/bin/python scripts/bootstrap-uptime-kuma.py
```

This creates the admin (on a fresh volume), both notification channels, all
monitors (with both channels attached), and the public status page. Re-running
is safe — existing items are detected by name/slug and skipped.

> If `SLACK_WEBHOOK_URL` is unset the script configures **email only** and says
> so. To add/replace Slack later, `down -v` + re-run (the script skips a Slack
> channel that already exists by name rather than rewriting its webhook).

UI: `http://localhost:3002` · Status page: `http://localhost:3002/status/status`
· Mailpit (captured email): `http://localhost:8025`.

## Notification channels (multi-channel)

| Channel | Type | Config | Notes |
|---|---|---|---|
| **Email (SMTP)** | SMTP | host `mailpit`, port `1025`, no TLS, from `uptime@stacksift.local`, to `sre@stacksift.local` | Mailpit captures it at `:8025`. Swap for Resend/real SMTP in prod. |
| **Slack** | Slack | `SLACK_WEBHOOK_URL`, channel `#stacksift-uptime` | reuses the AIOps webhook (a separate uptime channel). |

Both channels are attached to every monitor.

## Monitors

Demo (compose-internal hostnames — Kuma evaluates them from inside
`stacksift-net`; the status page is viewed from the host on `:3002`):

| Name | URL (internal) | Interval |
|---|---|---|
| app | `http://frontend:3000/api/health` | 60s |
| api ready | `http://api:5190/health/ready` | 30s |
| api live | `http://api:5190/health/live` | 30s |
| auth | `http://keycloak:8080/realms/stacksift/.well-known/openid-configuration` | 60s |
| grafana | `http://grafana:3000/api/health` | 60s |
| rabbitmq mgmt | `http://rabbitmq:15672` | 60s |

For a deployed/external monitor, point these at the public `https://` URLs
instead: `app.<domain>/api/health`, `api.<domain>/health/ready` + `/health/live`,
`auth.<domain>/realms/stacksift/.well-known/openid-configuration`,
`grafana.<domain>/api/health`, `www.<domain>/api/health`.

## Public status page

Slug `status`, title "StackSift Status", one "Services" group with all monitors.
Public at `http://localhost:3002/status/status`.

## Verify (outage demo)

```bash
docker compose stop api          # within ~1 interval the api monitors flip red
# → status page shows the outage; an email lands in Mailpit (:8025) and Slack
#   posts to #stacksift-uptime (with a real webhook).
docker compose start api         # recovery notification + green status page
```

Config survives `docker compose restart uptime-kuma` (named volume). A
`docker compose down -v` wipes it — re-run the script to restore.

## Deploy to project-07 (Helm)

Uptime Kuma ships in the chart (`templates/uptime-kuma.yaml`), gated on
`uptimeKuma.enabled` (on in `values-beta.yaml`): Deployment + PVC + Service +
an Ingress at **`status.<domain>`** serving the public status page (`/status/status`)
and the admin UI (`/`). No prereq Secret — config is applied **after** deploy by
the bootstrap script. It runs as **root** (the image chowns `/app/data`); if the
namespace enforces the *restricted* Pod Security Standard, grant it an exception.

> **Caveat:** an in-cluster monitor can't alert you when the cluster/ingress
> itself is down (it's down too). Pair it with an external checker for true
> outage insurance. It's "is the app healthy", not "is everything down" cover.

### Bootstrap the deployed instance

1. Create the DNS record for `status.<domain>` → ingress-nginx; deploy the chart.
2. Port-forward to the in-cluster Kuma (avoids WebSocket-over-ingress quirks)
   and run the script with your real Slack webhook + Resend SMTP, sourced from
   `secrets.env` (note its keys are **.NET-config style** — `Smtp__Host`,
   `Smtp__Password`, `Smtp__UseSsl`, … — which the script reads directly):

   ```bash
   export KUBECONFIG=~/Downloads/project-07.kubeconfig
   kubectl -n project-07 port-forward svc/uptime-kuma 3002:3001 &

   set -a; . ~/.config/stacksift-deploy/secrets.env; set +a   # SLACK_WEBHOOK_URL + Smtp__*
   python3 -m venv .venv && .venv/bin/pip install uptime-kuma-api
   UPTIME_KUMA_PASSWORD='<choose-admin-pw>' \
     STACKSIFT_DOMAIN=dmdailydeals.com \
     MAIL_TO='sre@yourteam.com' \
     .venv/bin/python scripts/bootstrap-uptime-kuma.py
   ```

   `STACKSIFT_DOMAIN` switches the monitors to the **public** `https://*.<domain>`
   URLs (tests the full DNS→ingress→app path). Slack uses `SLACK_WEBHOOK_URL`;
   email uses Resend via the `Smtp__*` keys (`Smtp__UseSsl=true` → TLS on :465).
   `MAIL_FROM` defaults to `Smtp__FromAddress` (must be a Resend-verified sender).

3. Open `https://status.<domain>` → log in (`admin` / the password you set) →
   **change nothing else is needed**; the status page is at
   `https://status.<domain>/status/status`.
