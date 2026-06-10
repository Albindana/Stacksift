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

## Production (project-07)

Uptime Kuma is **not** in the Helm chart by design — an outage monitor should
live **outside** the cluster it watches. For `project-07`, use an external,
out-of-cluster monitor against the public health URLs above (a separate Kuma, or
a hosted checker). The status page + channels here cover the M4.6 demo; an
in-cluster Kuma is explicitly out of scope.
