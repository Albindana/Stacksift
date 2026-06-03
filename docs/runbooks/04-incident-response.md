# Runbook 04 — Incident response

> How to triage and respond when something breaks in the `project-07` beta. Pairs with the 4 Gate-2
> Prometheus alerts (`infrastructure/helm/stacksift/templates/observability.yaml`) and the SLOs in
> `docs/slo.md`. Closed beta = best-effort, business hours; this is the lightweight version.

## Severity & triage

| Sev | Definition | Examples | Response |
|---|---|---|---|
| **SEV1** | Service down / data-loss risk for all users | API down, Postgres down, cross-org data leak | Drop everything; start now |
| **SEV2** | Major degradation, a core flow broken | ingest stalled, login broken, AI analysis failing | Same-day |
| **SEV3** | Minor / single-feature / cosmetic | one slow endpoint, a non-critical job retrying | Next working day |

A cross-tenant data leak is **always SEV1** regardless of scope.

## First 5 minutes (triage loop)

```bash
export KUBECONFIG=~/Downloads/project-07.kubeconfig
kubectl -n project-07 get pods                       # who's not Ready/Running?
kubectl -n project-07 get events --sort-by=.lastTimestamp | tail -30
kubectl -n project-07 logs deploy/api --tail=100     # or the failing workload
```
Health URLs (the api gates on its dependencies):
- `https://api.dmdailydeals.com/api/v1/health` — public liveness.
- `/health/live` (process), `/health/ready` (deps: PG, ES, Redis, RabbitMQ, …), `/health/startup`
  (incl. migrations). A `/health/ready` **503** means a dependency is down — read the body to see which.

## The 4 alerts → what to do

| Alert | Means | First checks |
|---|---|---|
| **ApiDown** (`up{job="stacksift-api"}==0`, 2m, critical) | Prometheus can't scrape the API | `kubectl get pods -l app.kubernetes.io/component=api`; describe (probe failures? OOMKilled? image pull?); `logs deploy/api`. If `/health/ready` 503 → a dependency is down (check PG/ES/Redis/RabbitMQ pods). |
| **HighErrorRate** (5xx > 5%, 10m, warning) | App throwing 5xx | `logs deploy/api` for stack traces / correlation IDs; recent deploy? (`helm history`) → consider rollback; a dependency flapping? |
| **HighLatencyP99** (p99 > 2s, 10m, warning) | Slow responses | Postgres slow queries (`pg_stat_statements`, auto_explain logs); ES health (`/_cluster/health`); RabbitMQ backlog; resource limits/throttling. |
| **AIAnalysisStalled** (no analyses 1h, warning) | RAG pipeline stuck | Hangfire dashboard / `logs deploy/api`; OpenAI egress reachable + key valid; RabbitMQ `log-ingest`/analysis queues; pgvector reachable. |

If Prometheus itself is the problem (no alerts firing / `prometheus-stacksift-0` not 2/2), check its
PVC is writable (`fsGroup`) and the operator reconciled the CR.

## Common failure modes (seen in this env)

- **api `0/1` (readiness 503):** almost always a dependency — most commonly **Elasticsearch down**
  (e.g. its keystore initContainer can't mount `stacksift-es-s3-creds`). Fix the dep; the api recovers
  on its own once `/health/ready` passes.
- **A pod `CreateContainerConfigError` / `Init:CreateContainerConfigError`:** a referenced Secret/key is
  missing. `kubectl describe pod …` names the Secret. Create it, the kubelet retries (no manual restart).
- **`helm upgrade` reports `failed: post-upgrade hooks failed`:** a hook Job (migrate / minio-init /
  stanza-create) couldn't complete — usually a missing prereq Secret. The release is `failed` but
  applied resources stay; fix the prereq and re-run.
- **Postgres WAL filling (`pg_stat_archiver.failed_count` climbing):** archiving is on but the repo
  isn't reachable (MinIO TLS). Either fix the repo or set `postgres.backups.enabled=false` and re-deploy
  (reverts `archive_mode=off`).

## Escalation & comms

- **Owner:** Dardan (dardan.ternava@gjirafa.com). Capstone team: Dardan, Jona, Albin.
- **Cluster-level issues** (node down, ingress-nginx, cert-manager, Longhorn, Calico egress) are
  **instructor / cluster-admin** territory — namespace admin can't fix them; escalate with the symptom
  + `kubectl describe`/events output.
- **Comms (closed beta):** if user-facing, email the beta cohort with impact + ETA; note SEV1/2 in the
  team channel. Keep a short incident note (what broke, when, fix, follow-up) — feed real fixes into the
  runbooks + `docs/ai-log.md`.

## After resolution
- Confirm the alert cleared and `/health/ready` is 200.
- Capture root cause + the one-line prevention; open a follow-up if it needs a code/chart change.
