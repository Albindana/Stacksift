# n8n workflows

Version-controlled n8n workflows for the StackSift automation pipeline. The
running n8n stores workflows in its own DB (`n8n_data` volume); these JSON files
are the reproducible source of truth, mounted read-only into the container at
`/workflows`.

## `alert-triage.json`

The FS-8 / DO-12 pipeline: **Alertmanager → n8n webhook → OpenAI → Slack**.

| Node | Role |
|---|---|
| Webhook | `POST /webhook/alert-triage` — receives the Alertmanager payload |
| Flatten alert | Builds a compact `alertSummary` string from `payload.alerts[]` |
| OpenAI triage | `gpt-4o-mini` chat completion — 3-line SRE triage of the alert |
| Notify Slack | Posts the alert header + triage to the Slack Incoming Webhook |

Both `firing` and `resolved` notifications are sent (`:rotating_light:` vs
`:white_check_mark:`), matching Alertmanager's `send_resolved: true`.

Secrets are read from the container env (`OPENAI_API_KEY`, `SLACK_WEBHOOK_URL`)
via `{{$env...}}` expressions — no literals are committed.

## Import / activate

The workflow is **not** auto-activated on boot (n8n registers webhooks only for
active workflows). After `docker compose up -d n8n`:

```bash
# Import the committed JSON into the running instance:
docker compose exec n8n n8n import:workflow --input=/workflows/alert-triage.json

# Activate it (registers the webhook), then restart so it takes effect:
docker compose exec n8n n8n update:workflow --all --active=true
docker compose restart n8n
```

Or via the UI (`http://localhost:5678`, basic-auth `N8N_USER`/`N8N_PASSWORD`):
**Workflows → Import from File → `/workflows/alert-triage.json`**, then toggle
**Active**.

## Re-export after UI edits

If you change the workflow in the UI, re-export it so the repo stays the source
of truth:

```bash
docker compose exec n8n n8n export:workflow --id=<id> --output=/workflows/alert-triage.json
```

(`--id` is shown by `docker compose exec n8n n8n list:workflow`.) Verify the
export still references `{{$env...}}` and contains no secret literals before
committing.
