# StackSift — Backend Test Coverage

> Last updated: 2026-05-09

---

## How to Run

```bash
# All tests (unit + integration)
cd src/backend
dotnet test

# Integration tests only
dotnet test --filter "FullyQualifiedName~Integration"

# Unit tests only (no containers)
dotnet test --filter "FullyQualifiedName~StackSift.Tests" --filter "FullyQualifiedName~!Integration"

# With code coverage (produces coverage.cobertura.xml)
dotnet test --collect:"XPlat Code Coverage"

# Coverage report (requires reportgenerator tool)
dotnet tool install -g dotnet-reportgenerator-globaltool
reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:"coveragereport" -reporttypes:Html
```

---

## No InMemory Database

`Microsoft.EntityFrameworkCore.InMemory` has been **permanently removed** from `StackSift.Tests.csproj`.

**Rationale:**
- InMemory does not enforce Postgres constraints (unique, foreign key, check) — tests can pass locally but fail in production.
- InMemory ignores the `pgvector` extension entirely — any test touching `AiAnalysis.Embedding` silently skips vector behavior.
- InMemory does not model transaction isolation, so concurrency bugs go undetected.
- The "green InMemory badge" provides false confidence; the "green real-Postgres badge" proves the production Npgsql provider actually works.

All tests that previously used `TestAppDbContext` (which internally called `UseInMemoryDatabase`) now run against a real `pgvector/pgvector:pg16` container.

---

## Container Strategy

| Container | Image | Shared via | Start cost | Per-test cost |
|---|---|---|---|---|
| Postgres (unit layer) | `pgvector/pgvector:pg16` | `ICollectionFixture<PostgresContainerFixture>` | ~15s | ~50ms (Respawn) |
| Postgres (integration layer) | `pgvector/pgvector:pg16` | `ICollectionFixture<StackSiftWebApplicationFactory>` | ~15s | ~50ms (Respawn) |
| Keycloak (integration layer) | `quay.io/keycloak/keycloak:21.1` | `ICollectionFixture<StackSiftWebApplicationFactory>` | ~30–60s | 0 (tokens cached) |
| Redis (integration layer) | `redis:7.0` | `ICollectionFixture<StackSiftWebApplicationFactory>` | ~5s | 0 |

**Total CI startup overhead:** +60–90 seconds versus InMemory. This is a one-time cost per run; per-test overhead is negligible thanks to Respawn row deletion rather than container restart.

**Config override note:** Redis and Postgres connection strings are injected via `Environment.SetEnvironmentVariable("Key__Sub", value)` before `_ = Server` in `InitializeAsync()`. `ConfigureAppConfiguration` is too late for values consumed eagerly at DI registration time (e.g. `ConnectionMultiplexer.Connect()` called inline in `AddSingleton`).

---

## Test Collections

### `"Postgres"` collection (unit-level DB tests)

Shared by tests that construct `AppDbContext` directly:

| Class | Tests | Notes |
|---|---|---|
| `ImmediateAlertEmailJobTests` | 2 | Inserts an Alert, verifies email per admin |
| `RunAiAnalysisJobTests` | 5 | Inserts Incident + AiAnalysis, asserts status transitions |
| `AlertFiredConsumerTests` | 2 | Inserts an Alert, asserts Hangfire enqueue behavior |

### `"Integration"` collection (WebApplicationFactory + Keycloak)

Full API stack tests with real JWTs:

| Class | Tests | What's covered |
|---|---|---|
| `AuthIntegrationTests` | 5 | No-token 401, tampered-token 401, valid-token 200, viewer 403, wrong-org 404, health 200 |
| `ProjectsControllerTests` | 6 | POST 201, GET list pagination, GET by ID, PUT update, DELETE + subsequent 404, duplicate slug 409 |
| `IncidentsControllerTests` | 5 | Status filter, GET by ID, Open→Ack, Ack→Resolved, Resolved→Open 400, cross-tenant 404 |

### Pure-mock tests (no containers)

These tests operate entirely at the interface/mock level and do not require a database or containers:

| Class | Tests |
|---|---|
| `MailKitEmailServiceTests` | 3 |
| `DigestEmailJobTests` | 1 |
| `LogRetentionJobTests` | 1 |
| `ImmediateAlertEmailJobTests` | — (moved to Postgres collection) |
| `OpenAiAnalysisServiceTests` | 4 |
| `GetDashboardStatsQueryHandlerTests` | 2 |

---

## Coverage by Project (latest run)

Run `dotnet test --collect:"XPlat Code Coverage"` to regenerate.

| Project | Approximate coverage | Notes |
|---|---|---|
| `StackSift.Domain` | ~90% | Pure value objects and exceptions; near-full coverage through integration tests |
| `StackSift.Application` | ~75% | Command/query handlers exercised via integration; some edge-case handlers not yet covered |
| `StackSift.Infrastructure` | ~60% | Repositories covered by integration tests; Elasticsearch and S3 adapters not yet integration-tested |
| `StackSift.Api` | ~65% | All controller actions exercised by integration suite; Hangfire jobs tested via unit suite |

*Note: Coverage percentages are estimates based on the current test suite. Run with Coverlet for accurate numbers.*

---

## CI Run Time

| Phase | Approx. time |
|---|---|
| Container startup (Postgres × 2 + Keycloak + Redis) | 30–60 seconds (once per run) |
| Unit tests (pure-mock + Postgres collection) | ~10 seconds |
| Integration tests (WebApplicationFactory + all containers) | ~20 seconds |
| **Total** | **~60–90 seconds** |

Containers start once per `dotnet test` run. All test classes in the same `[Collection]` share a single fixture instance — no per-class or per-test container restart.

---

## Frontend E2E (Playwright)

Two modes, selected by `REAL_STACK`:

| Mode | Project(s) | Auth / data | Server | When |
|---|---|---|---|---|
| **Mock** (default) | `chromium` | `NEXT_PUBLIC_AUTH_MOCK=true` (auto-Alice) | `pnpm dev` webServer | `pnpm test:e2e` — fast specs (a11y, navigation, dashboard, …); ignores `e2e/real-stack/` |
| **Real-stack** (`REAL_STACK=1`) | `real-setup` → `real-stack` | real Keycloak ROPC + seeded org/user | none — points at composed stack via `PLAYWRIGHT_BASE_URL` | `e2e-real` workflow (dispatch + nightly); the M2.6 "one complete flow in CI" |

### Real-stack journey (FE-7 / M2.6)

`e2e/real-stack/core-journey.spec.ts` proves the value loop with nothing mocked:
login (real Keycloak) → create project → create log source → **ingest a log via
`POST /api/v1/logs/ingest`** → see it on `/logs` (a genuine ingest → RabbitMQ →
Elasticsearch → UI round-trip). `auth.setup.ts` logs in once and saves
`storageState` so the journey starts authenticated.

**Fixture (`scripts/seed-e2e.sh`).** The journey needs a deterministic login
*and* matching app-DB rows. The script provisions both idempotently via the
Keycloak **admin API** (a `e2e@stacksift.local` owner with `organization_id`/
`stacksift_role` claims + a non-temporary password) and `psql` (the
`Organizations` + `Users` rows, `User.Id == Keycloak id`). It is used instead of
realm-import credentials because import is **skipped when the realm already
exists** (dev volumes) and the realm enforces a password policy — the admin API
works on fresh *and* existing realms without a destructive `down -v`.

### Run it locally

```bash
cd infrastructure/docker && docker compose up -d --wait \
  postgres elasticsearch redis rabbitmq keycloak minio minio-init api frontend
docker compose --profile migrate run --rm migrate     # create the schema
cd ../.. && ./scripts/seed-e2e.sh                      # KC user + app-DB rows
ES_URL=http://localhost:9200 ./scripts/apply-elasticsearch-ilm.sh
cd src/frontend && REAL_STACK=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
  E2E_API_URL=http://localhost:5190 pnpm exec playwright test --project=real-stack
```

The mock suite is unaffected: `pnpm exec playwright test` still runs only
`chromium` with its `pnpm dev` webServer.
