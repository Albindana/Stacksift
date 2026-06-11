# Runbook 05 — Observability (in-cluster)

> Operating the in-cluster observability stack on `project-07`: metrics
> (Prometheus + 14 alerts), alert routing (Alertmanager → n8n → OpenAI → Slack),
> logs (Loki + Serilog), and dashboards (Grafana). Pairs with runbook 04
> (incident response), `docs/slo.md`, and `docs/n8n-automation.md`. All objects
> are gated by values flags (on in `values-beta.yaml`).

## Prereq Secrets (create before enabling the flags)

`stacksift-n8n` (n8n basic-auth + `OPENAI_API_KEY` + `SLACK_WEBHOOK_URL`),
`stacksift-grafana-admin` (`admin-user`/`admin-password`), and — only for the
Slack-direct fallback — `stacksift-alertmanager` (`slack-api-url`). Commands are
in the chart README (prereqs 7–9). A missing Secret → `CreateContainerConfigError`
on the pod, same failure mode as the ES/pgBackRest Secrets (runbook 01).

## Health checks

```bash
export KUBECONFIG=~/Downloads/project-07.kubeconfig
kubectl -n project-07 get prometheus,alertmanager,prometheusrule,servicemonitor
kubectl -n project-07 get pods -l app.kubernetes.io/name=stacksift -o wide
kubectl -n project-07 get ingress grafana n8n
```

- **Prometheus targets:** `kubectl -n project-07 port-forward svc/prometheus 9090` → http://localhost:9090/targets (api + rabbitmq `up`), `/alerts` (14 rules loaded).
- **Alertmanager:** `kubectl -n project-07 port-forward svc/alertmanager-operated 9093` → http://localhost:9093 shows active alerts + the n8n receiver.
- **Loki:** in Grafana → Explore → Loki → `{app="stacksift"}` returns app logs (confirms the Serilog sink reached Loki).
- **Grafana:** https://grafana.dmdailydeals.com → the 6 dashboards under the StackSift folder; both datasources green in Settings.
- **n8n:** https://n8n.dmdailydeals.com (basic-auth) → Executions tab shows alert runs; `kubectl -n project-07 logs deploy/n8n -c import-workflow` shows the first-boot import.

## Test the alert path (no real outage)

Post a synthetic alert straight to Alertmanager and watch it flow to Slack:

```bash
kubectl -n project-07 port-forward svc/alertmanager-operated 9093 &
curl -XPOST http://localhost:9093/api/v2/alerts -H 'content-type: application/json' \
  -d '[{"labels":{"alertname":"ApiDown","severity":"critical"},"annotations":{"summary":"synthetic"}}]'
```

Expect a Slack message in `#stacksift-alerts` within ~`group_wait` (30s), with the
LLM triage. n8n "Executions" records the run. If nothing arrives, check (in order):
Alertmanager received it (`/#/alerts`), the AlertmanagerConfig receiver URL, n8n
Executions for an error, and that `OPENAI_API_KEY`/`SLACK_WEBHOOK_URL` are set in
`stacksift-n8n`.

## Real firing alert (demo / drill)

Scale the API to 0 → `ApiDown` fires after its `for: 2m` window → Alertmanager →
n8n → Slack. Recover and a `resolved` message follows (`sendResolved: true`).

```bash
kubectl -n project-07 scale deploy/api --replicas=0   # trigger
kubectl -n project-07 scale deploy/api --replicas=1   # recover
```

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Alertmanager/Loki/Grafana pod `CreateContainerConfigError` | prereq Secret missing | create the Secret (README prereqs 7–9), then the pod self-heals |
| Prometheus or Alertmanager `CrashLoopBackOff`, can't write PVC | operator dropped the CR `securityContext.fsGroup` on a 3-way merge (seen with Prometheus, runbook 01) | confirm `fsGroup` on the live CR; `kubectl patch` if missing |
| Grafana Prometheus datasource "no data" | `Service/prometheus` selector doesn't match the operator pod labels | verify `kubectl -n project-07 get endpoints prometheus` has an address |
| No Slack message | `OPENAI_API_KEY`/`SLACK_WEBHOOK_URL` unset, or workflow not active | check `stacksift-n8n`; n8n UI → workflow toggled **Active** |
| App logs absent from Loki | `loki.enabled` off (so `Serilog__Loki__Url` unset), or Loki not ready | confirm the flag + `kubectl -n project-07 get pod -l app.kubernetes.io/component=loki` |
