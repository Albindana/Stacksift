# Dynamic Application Security Testing (OWASP ZAP)

Satisfies **FS-5** ("OWASP ZAP pentest") and feeds the **M5.5** security audit.
ZAP runs the **baseline** profile — a passive spider + passive scan rules. It
sends **no active/attack payloads**, so it is safe to point at the live beta.

The first committed baseline: [`m5-zap-baseline.html`](./m5-zap-baseline.html)
(scan of `https://app.dmdailydeals.com`, 2026-06-10).

## What runs where

| Layer | Tool | Scope |
|---|---|---|
| CI (scheduled) | `zaproxy/action-baseline` (`zap-dast` workflow) | weekly Mon 03:00 UTC against `app.dmdailydeals.com` |
| CI (manual) | same workflow, `workflow_dispatch` | any `target` URL you pass (defaults to the beta) |
| Local | `zaproxy/zaproxy:stable` docker image | same `zap-baseline.py` invocation as CI |

The scan targets the **frontend** at `app.dmdailydeals.com`, which fronts the
public pages (`/landing`, `/login`, `/register`) **and** the BFF surface
(`/api/auth/*`, `/api/csp-report`, `/api/healthz`) — covering most of what a
passive baseline catches: security headers, cookies, CSP, and info-leak. The
`/api/v1/*` backend (`api.dmdailydeals.com`) is mostly auth-gated and yields
little from a passive crawl; an authenticated/active scan of it is a documented
follow-up (see below).

## Triage policy

Known-acceptable findings are converted to `IGNORE`/`WARN` in
[`.zap/rules.tsv`](../../.zap/rules.tsv) — each line carries a justification.
Never blanket-disable: `IGNORE` is for true false-positives / pure
informational noise; `WARN` keeps a real-but-accepted item **visible** (it is
tracked, not hidden). `FAIL` is reserved for genuine high-risk findings.

### Baseline result (2026-06-10)

`FAIL: 0 · WARN: 3 (tracked) · IGNORE: 6 · PASS: 61`. No high/critical findings.
Posture is already strong (HSTS, `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy`, a report-only CSP with
`frame-ancestors 'none'`).

The 3 tracked `WARN`s (hardening backlog, none blocking):

| Rule | Finding | Disposition |
|---|---|---|
| `10038` | CSP not *enforced* (only `Content-Security-Policy-Report-Only` is set) | Intentional during CSP rollout; clickjacking already covered by `frame-ancestors 'none'` + `X-Frame-Options: DENY`. **Promote report-only → enforced once tuned.** |
| `10037` | `X-Powered-By: Next.js` leaks the framework | Low. Fix = `poweredByHeader: false` in `src/frontend/next.config.ts`. |
| `90004` | `Cross-Origin-Opener/Embedder/Resource-Policy` headers absent | Optional cross-origin-isolation defense-in-depth. |

The 6 `IGNORE`d rules (`10015`, `10044`, `10049`, `10094`, `10109`, `90005`) are
informational or false positives (Next.js build chunks, the `/ → /landing`
redirect body, request-side `Sec-Fetch-*` headers) — justified inline in the
rules file.

## CI gate

The workflow is **report-only** today (`fail_action: false`, `-I`). Once the
tracked `WARN` backlog above is cleared, flip `fail_action: true` so a *new*
high-risk finding breaks the run — the same gate pattern as Trivy/Dockle in
`docker-build.yml`. The report is uploaded as a build artifact each run
(`allow_issue_writing: false` keeps the recurring scan from spamming issues).

## Run it locally

```bash
mkdir -p zap-out && chmod 777 zap-out
cp .zap/rules.tsv zap-out/rules.tsv
docker run --rm -v "$PWD/zap-out:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py -t https://app.dmdailydeals.com \
  -r report_html.html -w report_md.md -J report_json.json \
  -c rules.tsv -a -I
# reports land in ./zap-out/ (git-ignored)
```

## Follow-ups (documented, not yet wired)

- **Authenticated / active scan** of the `(dashboard)` routes and `/api/v1/*` —
  needs a ZAP context that logs in via the BFF (or injects a session). Active
  scanning sends real payloads, so it must target a throwaway/staging stack, not
  prod. Tracked against the annual external re-test in `repeat-cadence.md`.
- **Clear the WARN backlog** (CSP enforce, `poweredByHeader: false`, COOP/COEP/CORP),
  then enable `fail_action: true`.
