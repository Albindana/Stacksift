# Architecture

> **StackSift** — AI-Powered SRE & Log-Analysis Platform

## System Diagram

```mermaid
flowchart TD
    %% ─── Client ──────────────────────────────────────────────────
    FE["Next.js 16 — Frontend\nApp Router · TanStack Query v5 · Zustand\n:3000"]

    %% ─── Backend ─────────────────────────────────────────────────
    subgraph BACKEND["Backend — Clean Architecture  (arrow = depends on)"]
        direction TB
        API["StackSift.Api\nASP.NET 10 · 10 Controllers · SignalR Hub · Hangfire\n:5190"]
        INFRA["StackSift.Infrastructure\nEF Core · Elasticsearch · Redis · MassTransit\nMinIO · Keycloak client · Email · OpenAI"]
        APP["StackSift.Application\nMediatR CQRS · 12 Commands · 11 Queries · FluentValidation"]
        DOMAIN["StackSift.Domain\n9 Entities · 6 Value Objects · 8 Enums\nzero external dependencies"]

        API --> INFRA
        INFRA --> APP
        APP --> DOMAIN
    end

    %% ─── Data & Messaging ────────────────────────────────────────
    subgraph DATA["Data & Messaging"]
        PG[("PostgreSQL 16\n+ pgvector :5432")]
        ES[("Elasticsearch 8.12\n:9200")]
        REDIS[("Redis :6379")]
        MQ[("RabbitMQ 3\n:5672 / :15672")]
        KC["Keycloak\n:8080"]
        MINIO[("MinIO\n:9000")]
        MAILPIT["Mailpit\n:1025"]
    end

    %% ─── Observability ───────────────────────────────────────────
    subgraph OBS["Observability"]
        LOKI["Loki :3100"]
        PROM["Prometheus :9090"]
        GRAFANA["Grafana :3001"]
        UPTIME["Uptime Kuma :3002"]
    end

    %% ─── Message Paths ───────────────────────────────────────────
    FE -->|"① REST / HTTPS"| API
    API -->|"② SignalR WebSocket\nreal-time alerts"| FE
    INFRA -->|"③ publish\nMassTransit"| MQ
    MQ -->|"③ async events\nconsumers"| INFRA

    %% ─── Infrastructure Connections ──────────────────────────────
    INFRA -->|"EF Core + HNSW vectors"| PG
    INFRA -->|"log indexing / search"| ES
    INFRA -->|"cache-aside + SignalR backplane"| REDIS
    INFRA -->|"OIDC / OAuth2"| KC
    INFRA -->|"object storage S3"| MINIO
    INFRA -->|"SMTP via MailKit"| MAILPIT

    %% ─── Observability Connections ───────────────────────────────
    API -->|"Serilog HTTP sink"| LOKI
    API -->|"OpenTelemetry metrics"| PROM
    PROM --> GRAFANA
    LOKI --> GRAFANA
    UPTIME -->|"HTTP probes"| API
```

## Legend

| Arrow | Meaning |
|---|---|
| `A → B` inside Backend subgraph | A **depends on** B — strict layer order enforced |
| `A → B` to a service node | A **connects to / uses** B at runtime |
| ① ② ③ | The three client–server message paths (see below) |

**Dependency direction:** `Api → Infrastructure → Application → Domain`
Domain has zero external dependencies; each outer layer may only import the layer directly inside it.

## Message Paths

| # | Protocol | Direction | Purpose |
|---|---|---|---|
| ① | REST / HTTPS | Frontend → API | All CRUD operations and queries |
| ② | SignalR WebSocket | API → Frontend | Real-time alert push notifications (Redis backplane) |
| ③ | RabbitMQ (MassTransit) | Infrastructure ↔ Infrastructure | Async event processing — `LogBatchConsumer`, `AlertFiredConsumer`, DLX retries |

## Infrastructure Services (10 core)

| Service | Port(s) | Role |
|---|---|---|
| PostgreSQL 16 + pgvector | 5432 | Primary DB + vector embeddings (RAG — HNSW cosine) |
| Elasticsearch 8.12 | 9200 | Log indexing and full-text search (`stacksift-logs-{orgId}`) |
| Redis | 6379 | Cache-aside (60 s TTL) + SignalR backplane |
| RabbitMQ 3 | 5672 / 15672 | Async message broker (management UI on 15672) |
| Keycloak | 8080 | Sole identity provider — OAuth2 / OIDC, PKCE, role mappers |
| MinIO | 9000 / 9001 | S3-compatible object storage + console |
| Mailpit | 1025 / 8025 | SMTP sink + email preview UI (dev only) |
| Prometheus | 9090 | Metrics scraping (API, RabbitMQ, Postgres, node) |
| Loki | 3100 | Log aggregation (Serilog HTTP batch sink) |
| Grafana | 3001 | Dashboards — four golden signals, Hangfire queue, RabbitMQ lag, ES indexing |

> **Uptime Kuma** (:3002) ships as an optional Docker Compose profile and probes the `/api/v1/health` endpoint.
> **Optional profiles:** Tempo (distributed tracing), Alertmanager, n8n (workflow automation), Unleash (feature flags).

---

For the full entity-relationship diagram and column details see [docs/database-schema.md](database-schema.md).
