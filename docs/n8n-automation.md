# n8n Automation — Alert Triage Pipeline

Covers **FS-8** (n8n webhook → LLM → notification) and **DO-12** (AIOps alert
auto-triage). One self-hosted n8n workflow satisfies both: a Prometheus alert
fires → Alertmanager routes it → n8n receives the webhook → OpenAI triages it →
a formatted message lands in Slack.

## Topology

```
Prometheus  →  Alertmanager  →  n8n (/webhook/alert-triage)  →  OpenAI  →  Slack
  rules         receiver            Flatten → triage prompt        gpt-4o-mini   #stacksift-alerts
```

- **n8n** runs as a compose service (`docker.n8n.io/n8nio/n8n:1.70.0`) on
  `stacksift-net`, SQLite on the `n8n_data` volume, editor at
  `http://localhost:5678` (basic-auth `N8N_USER`/`N8N_PASSWORD`).
- **Alertmanager** receiver points at `http://n8n:5678/webhook/alert-triage`
  (`infrastructure/docker/alertmanager/alertmanager.yml`), `send_resolved: true`.
- The workflow lives at
  `infrastructure/docker/n8n/workflows/alert-triage.json` (version-controlled).

## Workflow

`Webhook → Flatten alert → OpenAI triage → Notify Slack`. The Flatten node
builds a compact `alertSummary` from `payload.alerts[]`; the OpenAI node asks
`gpt-4o-mini` for a 3-line SRE triage (severity judgement, probable cause, first
remediation step); the Slack node posts the alert header + triage, with
`:rotating_light:` for firing and `:white_check_mark:` for resolved.

Secrets (`OPENAI_API_KEY`, `SLACK_WEBHOOK_URL`) are read from the container env
via `{{$env...}}` — no literals are committed.

## Setup

1. **Slack Incoming Webhook:** Slack → Apps → *Incoming Webhooks* → add to
   `#stacksift-alerts` → copy the `https://hooks.slack.com/services/...` URL.
2. **Env:** set `OPENAI_API_KEY` (the same key the API uses for RAG) and
   `SLACK_WEBHOOK_URL` in `infrastructure/docker/.env`. Placeholders are in
   `.env.example`. Never commit the real values.
3. **Start + import + activate:**
   ```bash
   cd infrastructure/docker
   docker compose up -d n8n
   docker compose exec n8n n8n import:workflow --input=/workflows/alert-triage.json
   docker compose exec n8n n8n update:workflow --all --active=true
   docker compose restart n8n
   ```
   See `n8n/workflows/README.md` for the UI path and re-export instructions.

## Verify

- **Health:** `curl -fsS http://localhost:5678/healthz` → `{"status":"ok"}`.
- **Synthetic alert (no outage, no real keys needed for the webhook leg):**
  ```bash
  curl -i -X POST http://localhost:5678/webhook/alert-triage \
    -H 'content-type: application/json' \
    -d '{"status":"firing","alerts":[{"status":"firing","labels":{"alertname":"ApiDown","severity":"critical"},"annotations":{"summary":"synthetic"}}]}'
  ```
  returns `HTTP/1.1 200`. With real `OPENAI_API_KEY` + `SLACK_WEBHOOK_URL` a Slack
  message appears within seconds (otherwise the run stops at the OpenAI node).
- **Via Alertmanager (no outage):**
  ```bash
  curl -XPOST http://localhost:9093/api/v2/alerts \
    -H 'content-type: application/json' \
    -d '[{"labels":{"alertname":"ApiDown","severity":"critical"},"annotations":{"summary":"synthetic"}}]'
  ```
  Slack message within ~`group_wait` (30s).
- **End-to-end (real outage):** `docker compose stop api` → `ApiDown` flips to
  firing in Prometheus (`http://localhost:9090/alerts`) after its `for:` window →
  Alertmanager groups → n8n runs → Slack triage. `docker compose start api` →
  a `resolved` message follows.

## Demo (M4.11 / M5.8)

1. Open Slack `#stacksift-alerts`, Prometheus `/alerts`, and the n8n Executions
   tab side by side.
2. `docker compose stop api`; watch `ApiDown` go pending → firing.
3. n8n "Executions" shows the run; Slack receives the LLM triage.
4. `docker compose start api` → resolved notification.

To avoid waiting the full `for:` window live, temporarily lower `ApiDown`'s `for:`
in `prometheus/rules/stacksift.yml` and `curl -X POST http://localhost:9090/-/reload`.
The synthetic-curl paths above are the no-outage fallback if OpenAI/Slack is flaky
at demo time — pre-warm one run beforehand.

## Rollback

Remove the `n8n` service + `n8n_data` volume from compose and revert the
`alertmanager.yml` receiver URL to its prior value.
