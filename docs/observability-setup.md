# Observability Setup

Start the local stack from `infrastructure/docker`:

```bash
docker compose up -d --wait
```

Prometheus scrapes the API at `/metrics`, RabbitMQ at `:15692`, and postgres-exporter at `:9187`. Grafana is available at `http://localhost:3001`; dashboards are provisioned into the `StackSift` folder from `infrastructure/docker/grafana/dashboards`.

Health endpoints:

```bash
curl http://localhost:5190/health/live
curl http://localhost:5190/health/ready
curl http://localhost:5190/health/startup
curl http://localhost:3000/api/health
curl http://localhost:3000/api/healthz
```

Apply Elasticsearch lifecycle policy and template:

```bash
ES_URL=http://localhost:9200 ./scripts/apply-elasticsearch-ilm.sh
```

Uptime Kuma monitor setup is documented in `docs/uptime-kuma-bootstrap.md`. SLO definitions and burn-rate alert rationale are in `docs/slo.md`.

## In-cluster (`project-07`)

The Helm chart deploys the same stack to Kubernetes, namespaced and gated by values flags (on in `values-beta.yaml`). It relies on the pre-installed Prometheus Operator (namespaced CRs only). See the chart README for the prereq Secrets and `docs/runbooks/05-observability.md` for operations.

| Flag | Renders |
|---|---|
| `prometheus.enabled` | Prometheus CR + api/rabbitmq ServiceMonitors + `PrometheusRule` with all **14** alerts (`templates/prometheusrule.yaml`, ported verbatim from `prometheus/rules/stacksift.yml`). |
| `alertmanager.enabled` | Alertmanager CR + AlertmanagerConfig routing `severity=critical` → the in-cluster n8n webhook; the Prometheus CR is pointed at `alertmanager-operated:9093`. |
| `n8n.enabled` | n8n + the `alert-triage` workflow (imported/activated on first boot). Receives the Alertmanager webhook → OpenAI → Slack. See `docs/n8n-automation.md`. |
| `loki.enabled` | Loki single-binary (`loki:3100`) + `Serilog__Loki__Url` wired into the app ConfigMap, so prod logs ship to Loki instead of console-only. |
| `grafana.enabled` | Grafana at `grafana.<domain>` with provisioned Prometheus + Loki datasources and the 6 dashboards. (Tempo/OTLP traces are bucket B — not provisioned.) |

Datasource/service URLs in-cluster: Prometheus `http://prometheus:9090` (a named Service selecting the operator's Prometheus pods), Loki `http://loki:3100`, Alertmanager `http://alertmanager-operated:9093`, n8n webhook `http://n8n:5678/webhook/alert-triage`.
